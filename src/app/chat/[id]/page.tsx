"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation"; 
import { Send, ArrowLeft, Globe, ChevronUp, MoreVertical, Edit2, Trash2, Download, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams(); 
  const [contactName, setContactName] = useState("Loading...");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]); 
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chatMeta, setChatMeta] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMetaRef = useRef<any>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const languages = [
    { name: "English", code: "en", col: "translation_en" },
    { name: "සිංහල (Sinhala)", code: "si", col: "translation_si" },
    { name: "தமிழ் (Tamil)", code: "ta", col: "translation_ta" }
  ];

  const activeChatId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Safe translation call that looks at database structures
  const translateIncomingMessage = async (msg: any, currentLangName: string) => {
    const activeUserId = currentUserId || currentUserIdRef.current;
    if (!activeUserId || String(msg.sender_id) === String(activeUserId)) return;

    // Check if the current language column is already filled in the row object
    const targetLangObj = languages.find(l => l.name === currentLangName);
    if (targetLangObj && msg[targetLangObj.col]) {
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, _local_translation: msg[targetLangObj.col] } : m)
      );
      return;
    }

    try {
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, _local_translating: true } : m)
      );

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, text: msg.content, targetLanguage: currentLangName }),
      });

      const resultData = await response.json();

      if (response.ok && resultData.translatedText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, _local_translation: resultData.translatedText.trim(), _local_translating: false }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, _local_translating: false } : m));
      }
    } catch (err) {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, _local_translating: false } : m));
    }
  };

  // 1. Initial Loader
  useEffect(() => {
    const fetchChatData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        currentUserIdRef.current = user.id;
      }

      const { data: chatRow } = await supabase.from('chats').select('*').eq('id', activeChatId).single();
      let initialLangName = "English";

      if (chatRow && user) {
        setChatMeta(chatRow);
        chatMetaRef.current = chatRow;
        const isUser1 = chatRow.user_1 === user.id;
        const activeName = isUser1 ? (chatRow.user_2_name || "Partner") : (chatRow.user_1_name || "Partner");
        setContactName(activeName);
        setEditName(activeName);

        const savedLangCode = isUser1 ? chatRow.user_1_lang : chatRow.user_2_lang;
        const matchedLang = languages.find(l => l.code === savedLangCode);
        if (matchedLang) {
          setTargetLanguage(matchedLang.name);
          initialLangName = matchedLang.name;
        }
      }

      const { data: history } = await supabase.from('messages').select('*').eq('chat_id', activeChatId).order('created_at', { ascending: true });
      if (history) {
        setMessages(history);
        if (user) {
          // Dispatches calculations cleanly
          for (const msg of history) {
            if (String(msg.sender_id) !== String(user.id)) {
              await translateIncomingMessage(msg, initialLangName);
            }
          }
        }
      }
    };
    if (activeChatId) fetchChatData();
  }, [activeChatId]);

  // Dropdown translation selector change
  const handleLanguageChange = async (langName: string, langCode: string) => {
    setTargetLanguage(langName);
    setIsLangMenuOpen(false);
    if (!chatMeta || !currentUserId) return;

    const isUser1 = chatMeta.user_1 === currentUserId;
    const updatePayload = isUser1 ? { user_1_lang: langCode } : { user_2_lang: langCode };

    await supabase.from('chats').update(updatePayload).eq('id', activeChatId);
    const updatedMeta = { ...chatMeta, ...updatePayload };
    setChatMeta(updatedMeta);
    chatMetaRef.current = updatedMeta;

    for (const msg of messages) {
      if (String(msg.sender_id) !== String(currentUserId)) {
        await translateIncomingMessage(msg, langName);
      }
    }
  };

  // 2. Real-time Subscription Channel
  useEffect(() => {
    if (!activeChatId) return;
    const channel = supabase
      .channel(`chat-room-global-${activeChatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChatId}` }, 
        async (payload) => {
          const newData = payload.new as any;
          const activeUserId = currentUserIdRef.current;
          
          setMessages((prev) => prev.some(m => m.id === newData.id) ? prev : [...prev, newData]);

          if (activeUserId && String(newData.sender_id) !== String(activeUserId)) {
            let activeTargetLang = "English";
            const freshMeta = chatMetaRef.current;
            if (freshMeta) {
              const isUser1 = freshMeta.user_1 === activeUserId;
              const activeCode = isUser1 ? freshMeta.user_1_lang : freshMeta.user_2_lang;
              const foundLang = languages.find(l => l.code === activeCode);
              if (foundLang) activeTargetLang = foundLang.name;
            }
            await translateIncomingMessage(newData, activeTargetLang);
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChatId]);

  // 3. Send Message Action
  const handleSendMessage = async () => {
    if (!message.trim() || !currentUserId || !activeChatId) return;
    const txt = message;
    setMessage("");

    const { data } = await supabase.from("messages").insert([{ chat_id: activeChatId, sender_id: currentUserId, content: txt }]).select();
    if (data) {
      setMessages((prev) => prev.some(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
    }
  };

  // Safe Export Engine
  const handleDownloadXML = () => {
    try {
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<chat>\n  <info><partner>${contactName}</partner></info>\n  <messages>\n`;
      messages.forEach((msg) => {
        const isMe = String(msg.sender_id) === String(currentUserId);
        const trans = msg._local_translation || "No translation loaded";
        xml += `    <message>\n      <sender>${isMe ? "Me" : contactName}</sender>\n      <content>${msg.content}</content>\n      <translation>${trans}</translation>\n    </message>\n`;
      });
      xml += `  </messages>\n</chat>`;

      const blob = new Blob([xml], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contactName}_history.xml`;
      a.click();
      toast.success("XML exported cleanly!");
    } catch {
      toast.error("XML download error");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-700 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-lg">{contactName}</h2>
            <p className="text-[10px] text-emerald-400 font-medium">TARGET LANGUAGE: {targetLanguage}</p>
          </div>
        </div>
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
          <MoreVertical size={24} />
        </button>
        {isSettingsOpen && (
          <div className="absolute right-4 top-16 w-52 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <button onClick={handleDownloadXML} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-sm text-emerald-400">
              <Download size={16} /> Download XML
            </button>
          </div>
        )}
      </header>

      {/* Chat Display List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {messages.map((msg, index) => {
          const isMe = String(msg.sender_id) === String(currentUserId);
          const isTranslating = msg._local_translating === true;

          return (
            <div key={msg.id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl shadow-md ${isMe ? 'bg-blue-600' : 'bg-slate-800'}`}>
                {isMe ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <>
                    {isTranslating ? (
                      <p className="text-xs text-slate-400 italic animate-pulse">Translating text...</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-emerald-400">{msg._local_translation || msg.content}</p>
                        {msg._local_translation && <span className="text-[10px] text-slate-400 border-t border-slate-700/60 pt-1">Original: {msg.content}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <footer className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex gap-2">
          <div className="relative">
            {isLangMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
                {languages.map((lang) => (
                  <button key={lang.code} onClick={() => handleLanguageChange(lang.name, lang.code)} className="w-full text-left px-4 py-3 text-xs hover:bg-slate-700">
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="bg-slate-900 border border-slate-700 p-3.5 rounded-2xl flex items-center gap-2">
              <Globe size={20} className="text-blue-400" />
            </button>
          </div>
          <input type="text" placeholder="Type a message..." className="flex-1 bg-slate-900 border border-slate-700 p-3.5 rounded-2xl outline-none text-sm" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} />
          <button onClick={handleSendMessage} className="bg-blue-600 p-3.5 rounded-2xl"><Send size={20} /></button>
        </div>
      </footer>
    </div>
  );
}
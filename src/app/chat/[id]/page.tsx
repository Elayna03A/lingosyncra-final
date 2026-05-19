"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation"; 
import { Send, ArrowLeft, Globe, ChevronUp, MoreVertical, Edit2, Trash2, Download, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { translateText } from "@/lib/gemini";

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

  const languages = [
    { name: "English", code: "en" },
    { name: "සිංහල (Sinhala)", code: "si" },
    { name: "தமிழ் (Tamil)", code: "ta" }
  ];

  const activeChatId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 1. Initial Load Fetcher
  useEffect(() => {
    const fetchChatData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: chatRow } = await supabase
        .from('chats')
        .select('*')
        .eq('id', activeChatId)
        .single();
      
      if (chatRow && user) {
        setChatMeta(chatRow);
        const isCurrentUserSender = chatRow.user_1 === user.id;
        const activeName = isCurrentUserSender 
          ? (chatRow.user_2_name || "Chat Partner") 
          : (chatRow.user_1_name || "Chat Partner");
        
        setContactName(activeName);
        setEditName(activeName);

        const savedLangCode = isCurrentUserSender ? chatRow.user_1_lang : chatRow.user_2_lang;
        const matchedLang = languages.find(l => l.code === savedLangCode);
        if (matchedLang) setTargetLanguage(matchedLang.name);
      }

      const { data: history } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: true });
      if (history) setMessages(history);
    };

    if (activeChatId) fetchChatData();
  }, [activeChatId]);

  // Persist local selection changes down to db profiles dynamically
  const handleLanguageChange = async (langName: string, langCode: string) => {
    setTargetLanguage(langName);
    setIsLangMenuOpen(false);
    if (!chatMeta || !currentUserId) return;

    const isUser1 = chatMeta.user_1 === currentUserId;
    const updatePayload = isUser1 ? { user_1_lang: langCode } : { user_2_lang: langCode };

    await supabase.from('chats').update(updatePayload).eq('id', activeChatId);
    setChatMeta((prev: any) => prev ? { ...prev, ...updatePayload } : null);
  };

  // 2. RESILIENT REAL-TIME BROADCAST LISTENER (Listens to ALL changes on this chat)
  useEffect(() => {
    if (!activeChatId) return;
    const safeChatId = String(activeChatId).trim();

    const channel = supabase
      .channel(`chat-room-global-${safeChatId}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${safeChatId}` }, 
        (payload) => {
          const newData = payload.new as any;
          
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              if (prev.some(m => m.id === newData.id)) return prev;
              return [...prev, newData];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => 
              prev.map((msg) => msg.id === newData.id ? newData : msg)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  // 3. SEND & TRANSLATE MESSAGE ENGINE
  const handleSendMessage = async () => {
    if (!message.trim() || !currentUserId || !activeChatId || !chatMeta) return;

    // Fetch up-to-the-second details regarding the recipient's translation mode
    const { data: freshChat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', activeChatId)
      .single();

    const currentMeta = freshChat || chatMeta;
    const isMeUser1 = currentMeta.user_1 === currentUserId;
    
    // Find target language based on what the OTHER user has chosen
    const receiverLangCode = isMeUser1 ? (currentMeta.user_2_lang || 'en') : (currentMeta.user_1_lang || 'en');
    const receiverLangObj = languages.find(l => l.code === receiverLangCode) || { name: "English", code: "en" };

    const originalText = message;
    setMessage(""); // Clear instantly for UI responsiveness

    // If receiver doesn't need translation (reads English), save directly
    if (receiverLangObj.name.toLowerCase().trim() === "english") {
      await supabase.from("messages").insert([
        {
          chat_id: activeChatId,
          sender_id: currentUserId,
          content: originalText,
          translated_content: originalText, 
          target_lang: 'en'
        },
      ]);
      return;
    }

    // Insert original message with temporary "Translating..." placeholder state
    const { data: insertedMsg, error } = await supabase
      .from("messages")
      .insert([
        {
          chat_id: activeChatId,
          sender_id: currentUserId,
          content: originalText,
          translated_content: "Translating...", 
          target_lang: receiverLangObj.code 
        },
      ])
      .select()
      .single();

    if (error || !insertedMsg) {
      setMessage(originalText);
      toast.error("Message delivery failed");
      return;
    }

    // Trigger translate fetch API route in background
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText, targetLanguage: receiverLangObj.name }),
      });

      const resultData = await response.json();

      if (response.ok && resultData.translatedText) {
        await supabase
          .from("messages")
          .update({ translated_content: resultData.translatedText.trim() })
          .eq("id", insertedMsg.id);
      } else {
        throw new Error(resultData.error || "Translation API responded with error");
      }
    } catch (err) {
      console.error("Background AI run failed:", err);
      await supabase
        .from("messages")
        .update({ translated_content: "[Translation error occurred]" })
        .eq("id", insertedMsg.id);
    }
  };

  const saveNewName = async () => {
    if (!editName || !chatMeta || !currentUserId || !activeChatId) return;
    const isUser1 = chatMeta.user_1 === currentUserId;
    const updatePayload = isUser1 ? { user_2_name: editName } : { user_1_name: editName };

    const { error } = await supabase.from('chats').update(updatePayload).eq('id', activeChatId);
    if (!error) { 
      setContactName(editName); 
      setIsEditing(false); 
      toast.success("Display name saved!"); 
    }
  };

  const confirmDelete = async () => {
    if (!activeChatId) return;
    const { error } = await supabase.from('chats').delete().eq('id', activeChatId);
    if (!error) { 
      toast.success("Contact removed"); 
      router.push('/dashboard'); 
    }
  };

  const handleDownloadXML = () => {
    try {
      const content = `<?xml version="1.0" encoding="UTF-8"?>\n<chat><info>Chat history with ${contactName}</info></chat>`;
      const blob = new Blob([content], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contactName}_history.xml`;
      a.click();
      toast.success("XML file downloaded");
    } catch (e) { 
      toast.error("Download failed"); 
    }
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      {/* Header Bar */}
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-bold uppercase">
              {contactName ? contactName[0] : "U"}          
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{contactName}</h2>
              <p className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">
                My Target Translation Language: {targetLanguage} 
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-all">
            {isSettingsOpen ? <X size={20} /> : <MoreVertical size={24} />}
          </button>
          {isSettingsOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <button onClick={() => { setEditName(contactName); setIsEditing(true); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-sm">
                <Edit2 size={16} className="text-blue-400" /> Edit Contact
              </button>
              <button onClick={handleDownloadXML} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-sm">
                <Download size={16} className="text-emerald-400" /> Download XML
              </button>
              <button onClick={() => { setShowDeleteConfirm(true); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900/20 text-red-400 text-sm border-t border-slate-700">
                <Trash2 size={16} /> Delete Contact
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Chat Messages Display Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {messages.map((msg, index) => {
          const isMe = msg.sender_id === currentUserId;

          return (
            <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-white rounded-tl-none'}`}>
                <p className="text-sm">{msg.content}</p>
                {msg.translated_content === "Translating..." ? (
                  <p className="text-[10px] text-slate-400 italic mt-1 animate-pulse">
                    Translating message...
                  </p>
                ) : msg.translated_content && msg.translated_content !== msg.content ? (
                  <>
                    <hr className="my-2 border-white/10" />
                    <p className="text-xs italic text-blue-100 flex items-center gap-1">
                      <Globe size={12} className="inline" /> {msg.translated_content}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Inputs Footer */}
      <footer className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          <div className="flex gap-2 items-end">
            <div className="relative">
              {isLangMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
                  {languages.map((lang) => (
                    <button key={lang.code} onClick={() => handleLanguageChange(lang.name, lang.code)}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-700 ${targetLanguage === lang.name ? 'text-blue-400 font-bold' : 'text-slate-300'}`}>
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="bg-slate-900 border border-slate-700 p-3.5 rounded-2xl flex items-center gap-2">
                <Globe size={20} className="text-blue-400" />
                <ChevronUp size={16} className={isLangMenuOpen ? 'rotate-180' : ''} />
              </button>
            </div>
            <input type="text" placeholder="Type a message..."
              className="flex-1 bg-slate-900 border border-slate-700 p-3.5 rounded-2xl outline-none focus:border-blue-500 text-sm"
              value={message} onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} />
            <button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-500 p-3.5 rounded-2xl transition-all">
              <Send size={20} />
            </button>
          </div>
        </div>
      </footer>

      {/* Modals placeholders */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-800 border border-slate-700 p-6 rounded-3xl shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Edit Contact Name</h2>
            <input type="text" className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-700 outline-none mb-4"
              value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setIsEditing(false)} className="flex-1 p-3 rounded-xl bg-slate-700">Cancel</button>
              <button onClick={saveNewName} className="flex-1 p-3 rounded-xl bg-blue-600 font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-800 border border-slate-700 p-6 rounded-3xl shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Delete Contact?</h2>
            <p className="text-red-500 text-sm mb-6">Permanently remove chat history.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 p-3 rounded-xl bg-slate-700">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 p-3 rounded-xl bg-red-600 font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
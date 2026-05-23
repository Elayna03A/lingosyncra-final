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

  const languages = [
    { name: "English", code: "en" },
    { name: "සිංහල (Sinhala)", code: "si" },
    { name: "தமிழ் (Tamil)", code: "ta" }
  ];

  const activeChatId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Dynamic Translation Processor
  const translateIncomingMessage = async (msg: any, currentLangName: string, userIdString: string) => {
    if (!userIdString || String(msg.sender_id) === String(userIdString)) return;

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
        const cleanTranslation = resultData.translatedText.trim();
        
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { 
                  ...m, 
                  _local_translation: cleanTranslation, 
                  _local_translating: false,
                  _is_same: cleanTranslation.toLowerCase() === msg.content.toLowerCase()
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => m.id === msg.id ? { ...m, _local_translating: false } : m)
        );
      }
    } catch (err) {
      console.error("Translation API error:", err);
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, _local_translating: false } : m)
      );
    }
  };

  // 1. Initial Load Fetcher (FIXED PERSPECTIVE LOGIC VIA RELATIONSHIPS)
  useEffect(() => {
    const fetchChatData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      const { data: chatRow } = await supabase
        .from('chats')
        .select('*')
        .eq('id', activeChatId)
        .single();
      
      let initialLangName = "English";

      if (chatRow) {
        setChatMeta(chatRow);
        
        const isIUser1 = chatRow.user_1 === user.id;
        
        // Find out the ID of the OTHER user in this chat
        const partnerId = isIUser1 ? chatRow.user_2 : chatRow.user_1;

        // DYNAMIC LOOKUP: Fetch the partner's actual profile name from the profiles table
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', partnerId)
          .single();

        // Fall back to the row strings if the profiles table doesn't have a name yet
        const backupName = isIUser1 
          ? (chatRow.user_2_name || "Chat Partner") 
          : (chatRow.user_1_name || "Chat Partner");

        const activeName = partnerProfile?.full_name || backupName;
        
        setContactName(activeName);
        setEditName(activeName);

        const savedLangCode = isIUser1 ? chatRow.user_1_lang : chatRow.user_2_lang;
        const matchedLang = languages.find(l => l.code === savedLangCode);
        if (matchedLang) {
          setTargetLanguage(matchedLang.name);
          initialLangName = matchedLang.name;
        }
      }

      const { data: history } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: true });

      if (history) {
        setMessages(history);
        history.forEach((msg) => {
          translateIncomingMessage(msg, initialLangName, user.id);
        });
      }
    };

    if (activeChatId) fetchChatData();
  }, [activeChatId]);

  // Handle Language Dropdown Selection Change
  const handleLanguageChange = async (langName: string, langCode: string) => {
    setTargetLanguage(langName);
    setIsLangMenuOpen(false);
    if (!chatMeta || !currentUserId) return;

    const isUser1 = chatMeta.user_1 === currentUserId;
    const updatePayload = isUser1 ? { user_1_lang: langCode } : { user_2_lang: langCode };

    await supabase.from('chats').update(updatePayload).eq('id', activeChatId);
    setChatMeta((prev: any) => prev ? { ...prev, ...updatePayload } : null);

    messages.forEach((msg) => {
      translateIncomingMessage(msg, langName, currentUserId);
    });
  };

  // 2. Realtime Listener + Custom In-App Toast Notification (EDITED SECTION)
  useEffect(() => {
    if (!activeChatId || !currentUserId) return;
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

            translateIncomingMessage(newData, targetLanguage, currentUserId);

            // Trigger internal request-style notification if sent by the partner
            const isFromPartner = String(newData.sender_id) !== String(currentUserId);
            if (isFromPartner) {
              toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-800 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-slate-700 p-4`}>
                  <div className="flex-1 w-0">
                    <div className="flex items-start">
                      <div className="shrink-0 pt-0.5">
                        <div className="h-10 w-10 rounded-full bg-linear-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-bold text-white uppercase">
                          {contactName ? contactName[0] : "U"}
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-bold text-white">
                          New Message from {contactName}
                        </p>
                        <p className="mt-1 text-sm text-slate-300 truncate max-w-60">
                          {newData.content}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 shrink-0 flex items-center">
                    <button onClick={() => toast.dismiss(t.id)} className="rounded-xl p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ), { id: newData.id, duration: 4000 });
            }

          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => 
              prev.map((msg) => msg.id === newData.id ? { ...msg, ...newData } : msg)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, currentUserId, targetLanguage, contactName]); 

  // 3. Send Message
  const handleSendMessage = async () => {
    if (!message.trim() || !currentUserId || !activeChatId || !chatMeta) return;

    const originalText = message;
    setMessage(""); 

    const { data: insertedMsg, error: insertError } = await supabase
      .from("messages")
      .insert([
        {
          chat_id: activeChatId,
          sender_id: currentUserId,
          content: originalText
        },
      ])
      .select()
      .single(); 

    if (insertError || !insertedMsg) {
      setMessage(originalText);
      toast.error("Message delivery failed");
      return;
    }

    setMessages((prev) => {
      if (prev.some(m => m.id === insertedMsg.id)) return prev;
      return [...prev, insertedMsg];
    });
  };

  const saveNewName = async () => {
    if (!editName || !chatMeta || !currentUserId || !activeChatId) return;
    const isUser1 = chatMeta.user_1 === currentUserId;
    
    const updatePayload = isUser1 ? { user_2_name: editName } : { user_1_name: editName };

    const { error } = await supabase.from('chats').update(updatePayload).eq('id', activeChatId);
    if (!error) { 
      setContactName(editName); 
      setChatMeta((prev: any) => prev ? { ...prev, ...updatePayload } : null);
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
      let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xmlContent += `<chat>\n`;
      xmlContent += `  <info>\n`;
      xmlContent += `    <partner>${contactName}</partner>\n`;
      xmlContent += `    <my_target_language>${targetLanguage}</my_target_language>\n`;
      xmlContent += `    <exported_at>${new Date().toISOString()}</exported_at>\n`;
      xmlContent += `  </info>\n`;
      xmlContent += `  <messages>\n`;

      messages.forEach((msg) => {
        const isMe = String(msg.sender_id) === String(currentUserId);
        const senderLabel = isMe ? "Me" : contactName;
        
        const escapeXml = (str: string) => {
          if (!str) return "";
          return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
        };

        xmlContent += `    <message id="${msg.id || ''}">\n`;
        xmlContent += `      <sender>${escapeXml(senderLabel)}</sender>\n`;
        xmlContent += `      <original_text>${escapeXml(msg.content)}</original_text>\n`;
        
        if (msg._local_translation) {
          xmlContent += `      <translated_text>${escapeXml(msg._local_translation)}</translated_text>\n`;
        }
        
        xmlContent += `      <timestamp>${msg.created_at || ''}</timestamp>\n`;
        xmlContent += `    </message>\n`;
      });

      xmlContent += `  </messages>\n`;
      xmlContent += `</chat>`;

      const blob = new Blob([xmlContent], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contactName.replace(/\s+/g, '_')}_history.xml`;
      a.click();
      
      URL.revokeObjectURL(url);
      toast.success("XML file downloaded with history!");
    } catch (e) { 
      console.error("XML compilation error:", e);
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50 flex flex-col">
        {messages.map((msg, index) => {
          const isMe = String(msg.sender_id) === String(currentUserId);
          const isTranslating = msg._local_translating === true;
          const hasTranslationText = msg._local_translation && !isTranslating;
          const isSameAsOriginal = msg._is_same === true;

          return (
            <div key={msg.id || `msg-${index}`} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl shadow-md transition-all duration-200 ${
                isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-white rounded-tl-none'
              }`}>
                
                {isMe ? (
                  <p className="text-sm wrap-break-words whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <>
                    {isTranslating && (
                      <p className="text-[10px] text-slate-400 italic animate-pulse flex items-center gap-1">
                        Translating incoming message...
                      </p>
                    )}
                    
                    {hasTranslationText && !isSameAsOriginal && (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm wrap-break-words whitespace-pre-wrap">{msg._local_translation}</p>
                        <span className="text-[10px] text-slate-400 border-t border-slate-700/60 pt-1 mt-0.5 block">
                          Original: {msg.content}
                        </span>
                      </div>
                    )}

                    {(!hasTranslationText || isSameAsOriginal) && !isTranslating && (
                      <p className="text-sm wrap-break-words whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </>
                )}

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

      {/* Modals */}
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
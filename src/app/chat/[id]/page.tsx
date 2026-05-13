"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation"; 
import { Send, ArrowLeft, Globe, ChevronUp, MoreVertical, Settings, Edit2, Trash2, Download, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { translateText } from "@/lib/gemini";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams(); 
  const [contactName, setContactName] = useState("Loading...");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]); // New state for chat bubbles
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(contactName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 1. Initial Data Fetch (Contact Name & Existing Messages)
  useEffect(() => {
    const fetchChatData = async () => {
      // Fetch Contact Name
      const { data: contact } = await supabase
        .from('chats')
        .select('contact_name')
        .eq('id', params.id)
        .single();
      if (contact) setContactName(contact.contact_name);

      // Fetch Message History
      const { data: history } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', params.id)
        .order('created_at', { ascending: true });
      if (history) setMessages(history);
    };

    fetchChatData();
  }, [params.id]);

  // 2. REAL-TIME TCP/WEBSOCKET LISTENER
  useEffect(() => {
    // This creates a persistent channel over TCP
    const channel = supabase
      .channel(`chat-${params.id}`)
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${params.id}` }, 
        (payload) => {
          // Logic to update chat UI instantly when a new row is detected
          console.log('New message received via TCP/WebSocket:', payload);
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id]);

  const languages = [
    { name: "English", code: "en" },
    { name: "සිංහල (Sinhala)", code: "si" },
    { name: "தமிழ் (Tamil)", code: "ta" }
  ];

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const translated = await translateText(message, targetLanguage);

      const { error } = await supabase.from("messages").insert([
        {
          chat_id: params.id,
          sender_id: user.id,
          content: message,
          translated_content: translated,
        },
      ]);

      if (!error) {
        setMessage(""); 
      }
    } catch (err) {
      toast.error("Translation failed");
      console.error(err);
    }
  };

  // ... (Keep your existing Edit/Delete/XML functions here) ...
  const handleEdit = () => { setEditName(contactName); setIsEditing(true); setIsSettingsOpen(false); };
  const saveNewName = async () => {
    if (!editName) return;
    const { error } = await supabase.from('chats').update({ contact_name: editName }).eq('id', params.id);
    if (!error) { setContactName(editName); setIsEditing(false); toast.success("Name updated!"); }
  };
  const handleDeleteClick = () => { setShowDeleteConfirm(true); setIsSettingsOpen(false); };
  const confirmDelete = async () => {
    const { error } = await supabase.from('chats').delete().eq('id', params.id);
    if (!error) { toast.success("Contact removed"); router.push('/dashboard'); }
  };
  const handleDownloadXML = () => {
    try {
      const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<chat>\n`;
      const xmlFooter = `\n</chat>`;
      const content = `${xmlHeader}  <info>Chat history with ${contactName}</info>${xmlFooter}`;
      const blob = new Blob([content], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contactName}_history.xml`;
      a.click();
      toast.success("XML file downloaded");
    } catch (e) { toast.error("Download failed"); }
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-bold">
             {contactName ? contactName[0] : "U"}           
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{contactName}</h2>
              <p className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">
               Current Language: {targetLanguage} 
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
              <button onClick={handleEdit} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-sm">
                <Edit2 size={16} className="text-blue-400" /> Edit Contact
              </button>
              <button onClick={handleDownloadXML} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-sm">
                <Download size={16} className="text-emerald-400" /> Download XML
              </button>
              <button onClick={handleDeleteClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900/20 text-red-400 text-sm border-t border-slate-700">
                <Trash2 size={16} /> Delete Contact
              </button>
            </div>
          )}
        </div>
      </header>

      {/* RENDER MESSAGES HERE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.sender_id === params.id ? 'items-start' : 'items-end'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender_id === params.id ? 'bg-slate-800 text-white rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
              <p className="text-sm">{msg.content}</p>
              <hr className="my-2 border-white/10" />
              <p className="text-xs italic text-blue-100">
                <Globe size={10} className="inline mr-1" /> {msg.translated_content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          <div className="flex gap-2 items-end">
            <div className="relative">
              {isLangMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
                  {languages.map((lang) => (
                    <button key={lang.code} onClick={() => { setTargetLanguage(lang.name); setIsLangMenuOpen(false); }}
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
            <input type="text" placeholder={`Type in ${targetLanguage}...`}
              className="flex-1 bg-slate-900 border border-slate-700 p-3.5 rounded-2xl outline-none focus:border-blue-500 text-sm"
              value={message} onChange={(e) => setMessage(e.target.value)} />
            <button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-500 p-3.5 rounded-2xl transition-all">
              <Send size={20} />
            </button>
          </div>
        </div>
      </footer>

      {/* Modals remain the same */}
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
            <p className="text-red-600 text-sm mb-6">Permanently remove chat history.</p>
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
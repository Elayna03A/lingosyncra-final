"use client";
import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import { toast } from "react-hot-toast"; 
import { Menu, X, MessageSquare, User, LogOut, Settings, Plus } from "lucide-react";

export default function Dashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [contacts, setContacts] = useState<any[]>([]); // Handles the adding contacts
  const [saveName, setSaveName] = useState(""); // State for the contact's name
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]); 

useEffect(() => {
  const fetchChats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('chats') 
        .select('*')
        .or(`user_1.eq.${user.id},user_2.eq.${user.id}`);
      
      if (data) {
        // Main list: only chats where status is 'accepted'
        setContacts(data.filter((c: any) => c.status === 'accepted'));
        
        // Requests list: chats where status is 'pending' AND you are the recipient (user_B )
        setPendingRequests(data.filter((c: any) => c.status === 'pending' && c.user_2 === user.id));
      }
    }
  };
  fetchChats();
}, []);

  // Handle adding new contacts ---
 const handleAddContact = async () => {
  if (!searchEmail || !saveName) {
    toast.error("Invalid: Must enter credentials"); // error message
    return;
  }

  // 1. Check if the target user exists in Supabase
  const { data: targetUser, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', searchEmail)
    .single();

  if (findError || !targetUser) {
    toast.error("User does not have an account");
    return;
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // 2. Insert into the chats table with the custom name
  const { error: insertError } = await supabase
    .from('chats')
    .insert([{ 
      user_1: currentUser?.id, 
      user_2: targetUser.id, 
      contact_name: saveName, // Saving the custom contact name here
      status: 'pending' 
    }]);

  if (insertError) {
    toast.error("Invite already sent or error occurred");
  } else {
    toast.success("Invite sent successfully!");
    setIsAddModalOpen(false);
    setSearchEmail("");
    setSaveName("");
  }
};

const handleAcceptInvite = async (chatId: string) => {
  const { error } = await supabase
    .from('chats')
    .update({ status: 'accepted' })
    .eq('id', chatId);

  if (!error) {
    toast.success("Invite Accepted!");
    // Refresh the lists
    window.location.reload(); 
  } else {
    toast.error("Error accepting invite");
  }
};

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">

      {/* Mobile Hamburger Menu */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:block w-64 bg-slate-800 border-r border-slate-700 transition-transform duration-300 ease-in-out z-40`}>
        <div className="p-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-emerald-400">LingoSyncra</h2>
        </div>
        <nav className="mt-6 space-y-2 px-4">
          <button className="flex items-center gap-3 w-full p-3 bg-blue-600 rounded-xl font-medium"><MessageSquare size={20}/> Chats</button>
<button 
  onClick={() => router.push("/profile")} 
  className="flex items-center gap-3 w-full p-3 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"
>
  <User size={20}/> Profile
</button>          <button onClick={() => router.push("/login")} className="flex items-center gap-3 w-full p-3 hover:bg-red-900/30 text-red-400 rounded-xl mt-10"><LogOut size={20}/> Logout</button>
        </nav>
      </aside>

      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Chats</h1>
            <p className="text-slate-400"></p>
          </div>
    {/* Button Group: Aligns Requests and Add Contact side-by-side */}
  <div className="flex items-center gap-3 w-full sm:w-auto">
    
    {/* Requests Button */}
    <button 
      onClick={() => setIsRequestsModalOpen(true)}
      className="relative flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border border-slate-700 group"
    >
      <MessageSquare size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
      <span className="text-sm">Requests</span>
      
      {/* Notification Badge */}
      {pendingRequests.length > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-black animate-pulse">
          {pendingRequests.length}
        </span>
      )}
    </button>

    {/* Add Contact Button */}
    <button 
      onClick={() => setIsAddModalOpen(true)}
      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 p-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-emerald-900/20"
    >
      <Plus size={20} />
      <span className="text-sm">Add Contact</span>
    </button>
    
  </div>
        </header>

        {contacts.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-700 rounded-3xl">
    <MessageSquare size={48} className="text-slate-700 mb-4" />
    <p className="text-slate-500">No active chats. Start a new conversation!</p>
  </div>
) : (
  <div className="grid gap-4 max-w-2xl">
    {contacts.map((chat: any) => (
      <div 
        key={chat.id} 
        onClick={() => router.push(`/chat/${chat.id}`)}
        className="p-4 bg-slate-800 border border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-700 transition-all flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center font-bold">
          {chat.contact_name ? chat.contact_name[0] : "U"}
        </div>
        <div>
          <h3 className="font-bold">{chat.contact_name || "Unknown User"}</h3>
          <p className="text-xs text-slate-400">Tap to start translating</p>
        </div>
      </div>
    ))}
  </div>
)}
      </main>

      {/* --- ADD CONTACT MODAL --- */}
      {isAddModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
    <div className="w-full max-w-md bg-slate-800 border border-slate-700 p-6 rounded-3xl shadow-2xl">
      <h2 className="text-xl font-bold mb-6">Add Contact</h2>
      
      <div className="space-y-4">

        {/* Email Input */}
        <div>
          <label className="text-xs text-slate-400 ml-1">Enter Email</label>
          <input 
            type="email"
            placeholder="example@mail.com"
            className="w-full mt-1 p-3.5 rounded-xl bg-slate-900/50 border border-slate-700 outline-none focus:border-emerald-500"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
        </div>

        {/* Name Input */}
        <div>
          <label className="text-xs text-slate-400 ml-1">Save Contact Name</label>
          <input 
            type="text"
            placeholder="e.g. Arjun"
            className="w-full mt-1 p-3.5 rounded-xl bg-slate-900/50 border border-slate-700 outline-none focus:border-emerald-500"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button 
            onClick={() => setIsAddModalOpen(false)} 
            className="flex-1 p-3.5 rounded-xl bg-slate-700 font-bold hover:bg-slate-600 transition-all"
          >
            Cancel Request
          </button>
          <button 
            onClick={handleAddContact} 
            className="flex-1 p-3.5 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500 transition-all"
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* --- REQUESTS MODAL --- */}
{isRequestsModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
    <div className="w-full max-w-md bg-slate-800 border border-slate-700 p-6 rounded-3xl shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Pending Requests</h2>
        <button onClick={() => setIsRequestsModalOpen(false)} className="text-slate-400 hover:text-white">
          <X size={24} />
        </button>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-500">No pending invites at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <div key={request.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-2xl">
              <div>
                <p className="font-bold text-sm">{request.contact_name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Wants to connect</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAcceptInvite(request.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-all"
                >
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
    </div>
  );
}
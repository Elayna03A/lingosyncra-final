"use client";
import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import { toast } from "react-hot-toast"; 
import { Menu, X, MessageSquare, User, LogOut, Settings, Plus, ShieldCheck } from "lucide-react";


export default function Dashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [contacts, setContacts] = useState<any[]>([]); 
  const [saveName, setSaveName] = useState(""); 
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]); 
  const [userRole, setUserRole] = useState("user");

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile) setUserRole(profile.role);

        const { data, error } = await supabase
          .from('chats') 
          .select('*')
          .or(`user_1.eq.${user.id},user_2.eq.${user.id}`); 

        if (data) {
          // 1. Established friends (Both sides accepted)
          setContacts(data.filter((c: any) => c.status === 'accepted'));
          
          // 2. Invites waiting for THIS logged-in user to accept (Incoming)
          setPendingRequests(data.filter((c: any) => c.status === 'pending' && c.user_2 === user.id));
        }
      }
    };
    fetchDashboardData();
  }, []);


  const handleAddContact = async () => {
    if (!searchEmail || !saveName) {
      toast.error("Invalid: Must enter credentials"); 
      return;
    }

    const { data: targetUser, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', searchEmail.trim())
      .single();

    if (findError || !targetUser) {
      toast.error("User does not have an account");
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from('chats')
      .insert([{ 
        user_1: currentUser?.id, 
        user_2: targetUser.id, 
        contact_name: saveName, 
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
      window.location.reload(); 
    } else {
      toast.error("Error accepting invite");
    }
  };

  const handleDeclineInvite = async (chatId: string) => {
    const { error } = await supabase
      .from('chats')
      .update({ status: 'declined' }) 
      .eq('id', chatId);

    if (!error) {
      toast.error("Invite Declined");
      window.location.reload(); 
    } else {
      toast.error("Error declining invite");
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">

      {/* Mobile Hamburger Menu - Layer priority heightened */}
      <div className="lg:hidden fixed top-5 left-5 z-50">
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)} 
          className="p-3 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl text-blue-400 active:scale-90 transition-transform"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Solid layout colors implemented to isolate bleed-through views */}
      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:block w-72 bg-slate-800 lg:bg-slate-800 border-r border-slate-700 transition-transform duration-300 ease-in-out z-40 shadow-2xl lg:shadow-none`}>
  {/* Increased left padding slightly and added pl-16 on mobile to clear the close icon space */}
  <div className="p-8 max-lg:pl-16 max-lg:pr-4">
    <h2 className="text-2xl font-black bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-emerald-400 whitespace-nowrap">
      LingoSyncra
    </h2>
    {/* Added break-words so the subtitle cleanly wraps onto a new line if it runs out of space */}
    <p className="text-[10px] text-slate-500 tracking-[0.15em] uppercase mt-1 wrap-break-words leading-relaxed">
      Your go-to translation app
    </p>
  </div>
        
        <nav className="mt-4 space-y-2 px-6">
          <button className="flex items-center gap-4 w-full p-4 bg-blue-600 rounded-2xl font-bold text-sm shadow-lg shadow-blue-900/20"><MessageSquare size={18}/> Chats</button>
          
          <button 
            onClick={() => router.push("/profile")} 
            className="flex items-center gap-4 w-full p-4 hover:bg-slate-700/50 rounded-2xl text-slate-300 text-sm transition-all"
          >
            <User size={18}/> Profile
          </button>   

          {userRole === 'admin' && (
            <button 
              onClick={() => router.push("/admin")} 
              className="flex items-center gap-4 w-full p-4 hover:bg-emerald-900/20 text-emerald-400 rounded-2xl border border-emerald-900/30 text-sm transition-all"
            >
              <ShieldCheck size={18}/> Admin Panel
            </button>
          )}        
          
          <div className="pt-10">
            <button onClick={() => router.push("/login")} className="flex items-center gap-4 w-full p-4 hover:bg-red-900/20 text-red-400 rounded-2xl text-sm transition-all">
              <LogOut size={18}/> Logout
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-5 sm:p-8 lg:p-12 pt-24 lg:pt-12 overflow-x-hidden">
        
        {/* FIX: Added 'max-sm:pl-16' so the text shifts perfectly away from the hamburger icon on mobile views */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10 pl-16 lg:pl-0">          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Chats</h1>
            <div className="h-1 w-12 bg-blue-500 mt-2 rounded-full"></div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setIsRequestsModalOpen(true)}
              className="relative flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 p-3.5 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all border border-slate-700 group text-sm"
            >
              <MessageSquare size={18} className="text-blue-400 group-hover:rotate-12 transition-transform" />
              <span>Requests</span>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-4 border-slate-900 flex items-center justify-center text-[10px] text-white font-black animate-bounce">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 p-3.5 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-xl shadow-emerald-900/30 text-sm"
            >
              <Plus size={18} />
              <span>Add Contact</span>
            </button>
          </div>
        </header>

        {/* Contacts Grid */}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-slate-800 rounded-[2.5rem] bg-slate-800/20 px-6 text-center">
            <div className="p-5 bg-slate-800 rounded-3xl mb-4">
              <MessageSquare size={40} className="text-slate-600" />
            </div>
            <p className="text-slate-500 font-medium">No active chats yet.</p>
            <p className="text-xs text-slate-600 mt-1">Connect with others to start translating.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {contacts.map((chat: any) => (
              <div 
                key={chat.id} 
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-2rem cursor-pointer hover:bg-slate-800 hover:border-blue-500/50 hover:-translate-y-1 transition-all flex items-center gap-5 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-600 to-blue-400 flex items-center justify-center font-black text-xl shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform">
                  {chat.contact_name ? chat.contact_name[0] : "U"}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">{chat.contact_name || "Unknown User"}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Active Channel</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* --- MODALS --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-emerald-500 to-blue-500"></div>
            <h2 className="text-2xl font-black mb-8">Add New Contact</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Email</label>
                <input 
                  type="email"
                  placeholder="name@example.com"
                  className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 transition-all text-sm"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identify As</label>
                <input 
                  type="text"
                  placeholder="e.g. Project Manager"
                  className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 transition-all text-sm"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="order-2 sm:order-1 flex-1 p-4 rounded-2xl bg-slate-700 font-bold hover:bg-slate-600 transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddContact} 
                  className="order-1 sm:order-2 flex-1 p-4 rounded-2xl bg-emerald-600 font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40 text-sm"
                >
                  Send Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- REQUESTS MODAL --- */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-blue-500 to-emerald-500"></div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Invitations</h2>
              <button onClick={() => setIsRequestsModalOpen(false)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                  <MessageSquare size={24} className="text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium">Your inbox is clean!</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="p-5 bg-slate-900 border border-slate-700 rounded-3xl flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-blue-400">
                        {request.contact_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{request.contact_name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Connect Request</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAcceptInvite(request.id)}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black transition-all"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleDeclineInvite(request.id)}
                        className="flex-1 py-3 bg-slate-800 hover:bg-red-600/20 hover:text-red-400 rounded-xl text-xs font-bold transition-all border border-slate-700"
                      >
                        Decline
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
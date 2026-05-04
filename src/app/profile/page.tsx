"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { ArrowLeft, User, Mail, Lock, Moon, Sun, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Fetch User Data from Supabase Auth & Profiles
  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData(user);
      } else {
        router.push("/login");
      }
      setLoading(false);
    };
    getProfile();
  }, [router]);

  const handlePasswordReset = async () => {
    if (userData?.email) {
      const { error } = await supabase.auth.resetPasswordForEmail(userData.email);
      if (error) toast.error(error.message);
      else toast.success("Password reset email sent!");
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 lg:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full transition-all">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </header>

        <div className="space-y-6">
          {/* Section: Account Info */}
          <section className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                {userData?.email?.[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold">User Profile</h2>
                <p className="text-slate-400 text-sm">Manage your public information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 ml-1">Email Address</label>
                <div className="flex items-center gap-3 p-3.5 bg-slate-900/50 border border-slate-700 rounded-xl">
                  <Mail size={18} className="text-slate-500" />
                  <span className="text-sm">{userData?.email}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Preferences */}
          <section className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Sun size={18} className="text-emerald-400" /> Preferences
            </h3>
            <div className="flex items-center justify-between p-2">
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-slate-400">Reduce eye strain in low light</p>
              </div>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-blue-600' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </section>

          {/* Section: Security */}
          <section className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Lock size={18} className="text-red-400" /> Security
            </h3>
            <button 
              onClick={handlePasswordReset}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 rounded-xl transition-all border border-transparent hover:border-slate-600"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-slate-400" />
                <span className="text-sm">Change Password</span>
              </div>
              <span className="text-xs text-blue-400 font-bold">Send Email</span>
            </button>
          </section>

          {/* Account Status Footer */}
          <div className="text-center pt-6">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest">
              LingoSyncra Secure Account • {new Date(userData?.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
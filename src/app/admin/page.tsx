"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Users, ArrowLeft, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.error("Auth verification failed:", authError);
          router.push("/dashboard");
          return;
        }
        
        // Security Check: Verify profile role matching 'admin'
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || profile?.role !== 'admin') {
          console.error("Admin verification failed or insufficient role:", profileError);
          router.push("/dashboard");
          return;
        }

        // Fetch User Stats safely without requesting the missing created_at field
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*'); // Grabs existing columns safely without broken order dependencies

        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          setUsers(data);
        }
      } catch (err: any) {
        console.error("Dashboard data fetching error:", err);
        setErrorMessage(err?.message || "Failed to retrieve user logs. Check your database RLS policies.");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
        <p className="text-slate-400 animate-pulse">Verifying Admin Credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" /> Admin Control Center
            </h1>
            <p className="text-slate-400">System Monitoring & User Analytics</p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 transition p-3 rounded-xl cursor-pointer">
            <ArrowLeft size={18} /> Back to App
          </button>
        </header>

        {/* Display RLS Policy Errors or Column Mismatch Alerts if they occur */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800 text-red-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold">Database Connection Warning</p>
              <p className="text-sm text-red-300/90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <Users className="text-blue-400 mb-4" size={32} />
            <h3 className="text-slate-400 text-sm uppercase">Total Registered Users</h3>
            <p className="text-4xl font-bold">{users.length}</p>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-700/50 text-slate-300">
              <tr>
                <th className="p-4">User Details</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    No records found. If RLS is enabled, ensure your user profile has explicit read authorization.
                  </td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.id || i} className="border-t border-slate-700 hover:bg-slate-700/30">
                    <td className="p-4 font-medium flex flex-col gap-0.5">
                      {/* Displays Full Name if available, otherwise defaults to Email */}
                      <span className="text-slate-200 font-semibold">{u.full_name || u.email || "Unnamed User"}</span>
                      {u.full_name && u.email && <span className="text-xs text-slate-400">{u.email}</span>}
                      <span className="text-[10px] text-slate-500 font-mono tracking-tight select-all">ID: {u.id.substring(0, 8)}...</span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "Unavailable"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs tracking-wide uppercase font-semibold ${u.role === 'admin' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-blue-950 text-blue-400 border border-blue-800/60'}`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
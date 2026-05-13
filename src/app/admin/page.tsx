"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Users, Calendar, ArrowLeft, ShieldCheck } from "lucide-react";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Security Check: If not logged in or not an admin, kick them out
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push("/dashboard");
        return;
      }

      // Fetch User Stats
      const { data } = await supabase
        .from('profiles')
        .select('email, created_at, role')
        .order('created_at', { ascending: false });

      if (data) setUsers(data);
      setLoading(false);
    };

    checkAdminAndFetchData();
  }, [router]);

  if (loading) return <div className="p-10 text-white">Verifying Admin Credentials...</div>;

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
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 bg-slate-800 p-3 rounded-xl">
            <ArrowLeft size={18} /> Back to App
          </button>
        </header>

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
            <thead className="bg-slate-700/50">
              <tr>
                <th className="p-4">User Email</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                  <td className="p-4 font-medium">{u.email}</td>
                  <td className="p-4 text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-emerald-900 text-emerald-400' : 'bg-blue-900 text-blue-400'}`}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
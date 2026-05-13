"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strengthScore, setStrengthScore] = useState(0);
  const [isSignUp, setIsSignUp] = useState(false); 
  const router = useRouter();

  const checkStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++; 
    if (/[0-9]/.test(pass)) score++; 
    if (/[A-Z]/.test(pass)) score++; 
    if (/[^A-Za-z0-9]/.test(pass)) score++; 
    setStrengthScore(score);
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let newPass = "";
    for (let i = 0; i < 12; i++) newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(newPass);
    checkStrength(newPass);
  };

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !age)) {
      toast.error("Invalid: Must enter credentials");
      return;
    }

    if (isSignUp && parseInt(age) < 16) {
      toast.error("Invalid: User must be 16 plus");
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
      } else if (data.user) {
        await supabase.from("profiles").upsert([{ id: data.user.id, email, age: parseInt(age) }]);
        toast.success("Account created! You can now login.");
        setIsSignUp(false); 
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast.error("Invalid credentials");
      } else if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profile?.role === "admin") {
          toast.success("Welcome back, Admin!");
          router.push("/admin");
        } else {
          toast.success("Welcome back!");
          router.push("/dashboard");
        }
      }
    }
    setLoading(false);
  };
  
  return (
    // UPDATED: Added p-4 for a safe gutter on small mobile screens
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      
      {/* UPDATED: max-w-[92%] ensures it doesn't touch screen edges on tiny phones */}
      <div className="w-full max-w-[92%] sm:max-w-md bg-slate-800/50 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-2xl">
        
        {/* UPDATED: text-2xl for mobile, sm:text-3xl for desktop */}
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">
          LingoSyncra
        </h2>
        <p className="text-slate-400 text-center mb-8 text-xs sm:text-sm uppercase tracking-widest font-medium">
          Secure Distributed Messaging
        </p>
        
        <div className="space-y-5">
          {password.length > 0 && (
            <div className="space-y-2 mb-4 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Strength</span>
                <span className={`text-[10px] font-bold ${strengthScore > 2 ? 'text-emerald-400' : 'text-yellow-500'}`}>
                  {strengthScore < 3 ? "Weak" : "Strong"}
                </span>
              </div>
              <div className="flex gap-1 h-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step}
                    className={`flex-1 rounded-full transition-all duration-500 ${
                      strengthScore >= step 
                        ? (strengthScore > 2 ? 'bg-emerald-500' : 'bg-yellow-500') 
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <input
            type="email"
            placeholder="Email Address"
            className="w-full p-3.5 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-blue-500 outline-none transition-all text-sm"
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="Password"
              className="w-full p-3.5 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-blue-500 outline-none text-sm"
              onChange={(e) => {
                setPassword(e.target.value);
                checkStrength(e.target.value);
              }}
            />
            <div className="absolute right-3 top-3.5 flex gap-2 text-slate-400">
              <button onClick={() => setShowPassword(!showPassword)} type="button" className="hover:text-white transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button onClick={generatePassword} type="button" className="hover:text-emerald-400 transition-colors">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="relative animate-in slide-in-from-top-2 duration-300">
              <input
                type="number"
                placeholder="Age (Min. 16)"
                className={`w-full p-3.5 rounded-xl bg-slate-900/50 border outline-none transition-all text-sm ${parseInt(age) < 16 && age !== "" ? 'border-red-500' : 'border-slate-700'}`}
                onChange={(e) => setAge(e.target.value)}
              />
              {parseInt(age) < 16 && age !== "" && (
                <span className="text-red-400 text-[10px] mt-1 block px-1 animate-pulse">Must be 16 or older</span>
              )}
            </div>
          )}
          
          <div className="flex flex-col gap-4 pt-4">
            <button 
              onClick={handleAuth}
              className={`w-full p-4 rounded-xl font-bold transition-all shadow-lg text-sm active:scale-95 ${isSignUp ? 'bg-linear-to-r from-blue-600 to-blue-500' : 'bg-linear-to-r from-emerald-600 to-emerald-500'}`}
            >
              {loading ? "Processing..." : (isSignUp ? "Create Account" : "Sign In")}
            </button>

            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              type="button"
              className="text-xs text-slate-400 hover:text-white transition-colors py-2"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
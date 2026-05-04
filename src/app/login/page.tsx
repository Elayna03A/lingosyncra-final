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
  const [strengthScore, setStrengthScore] = useState(0); // Using only one score variable
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
    checkStrength(newPass); // Updating the strength when generating a password
  };

  const handleAuth = async (type: "login" | "signup") => {
  // 1. Check for empty fields first
  if (!email || !password || (type === "signup" && !age)) {
    toast.error("Invalid: Must enter credentials");
    return;
  }

  // 2. Age check (For both Login and Signup)
  if (parseInt(age) < 16) {
    toast.error("Invalid: User must be 16 plus");
    return;
  }

  setLoading(true);

  if (type === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else if (data.user) {
      await supabase.from("profiles").insert([{ id: data.user.id, email, age: parseInt(age) }]);
      toast.success("Account created! Check your email.");
    }
  } else {
    // LOGIN LOGIC
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      // Standardize error message for security
      toast.error("Invalid credentials");
    } else {
      toast.success("Welcome back!");
      router.push("/dashboard");
    }
  }
  setLoading(false);
};
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="w-full max-w-sm md:max-w-md bg-slate-800/50 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-slate-700 shadow-2xl">
        
        <h2 className="text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">
          LingoSyncra
        </h2>
        <p className="text-slate-400 text-center mb-8 text-sm">Secure Distributed Messaging</p>
        
        <div className="space-y-5">
          {/* Strength Meter at the top of the section when entering a password */}
          {password.length > 0 && (
            <div className="space-y-2 mb-4 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Security Strength</span>
                <span className={`text-[11px] font-bold ${strengthScore > 2 ? 'text-emerald-400' : 'text-yellow-500'}`}>
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
            className="w-full p-3.5 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-blue-500 outline-none transition-all"
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="Password"
              className="w-full p-3.5 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-blue-500 outline-none"
              onChange={(e) => {
                setPassword(e.target.value);
                checkStrength(e.target.value);
              }}
            />
            <div className="absolute right-3 top-3.5 flex gap-2 text-slate-400">
              <button onClick={() => setShowPassword(!showPassword)} type="button">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              <button onClick={generatePassword} type="button" className="hover:text-emerald-400 transition-colors">
                <RefreshCw size={20} />
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="number"
              placeholder="Age (Min. 16)"
              className={`w-full p-3.5 rounded-xl bg-slate-900/50 border outline-none transition-all ${parseInt(age) < 16 && age !== "" ? 'border-red-500' : 'border-slate-700'}`}
              onChange={(e) => setAge(e.target.value)}
            />
            {parseInt(age) < 16 && age !== "" && (
              <span className="text-red-400 text-xs mt-1 block px-1 animate-pulse">Must be 16 or older</span>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 pt-4">
            <button 
              onClick={() => handleAuth("login")}
              className="w-full bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 p-3.5 rounded-xl font-bold transition-all"
            >
              Login
            </button>
            <button 
              onClick={() => handleAuth("signup")}
              className="w-full bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 p-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
            >
              {loading ? "Processing..." : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
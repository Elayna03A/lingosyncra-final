import Link from 'next/link';

export default function HeroPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
    <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400 mb-4 py-2">        LingoSyncra
      </h1>
      <p className="text-xl text-slate-300 text-center max-w-lg mb-10">
        Breaking language barriers with real-time AI translation and phonetic transliteration.
      </p>
      
      <Link href="/login">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-full font-bold text-lg transition-all shadow-lg shadow-blue-500/20">
          Get Started
        </button>
      </Link>

      <footer className="mt-20 text-slate-500 text-sm italic">
        Powered by Gemini AI & Supabase
      </footer>
    </div>
  );
}
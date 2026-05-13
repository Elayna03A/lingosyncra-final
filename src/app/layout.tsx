import type { Metadata, Viewport } from "next"; // Added Viewport type
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LingoSyncra",
  description: "Secure Real-time Translation Messaging",
};

// ADD THIS: Prevents mobile input zoom-in bugs
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* UPDATED: added selection:bg-blue-500/30 for better UI feel */}
      <body className="min-h-full flex flex-col bg-slate-900 text-white selection:bg-blue-500/30">
        
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: '16px', // Matches your 3xl/2xl cards better
              fontSize: '14px',
              padding: '16px',
              maxWidth: '90vw', // Ensures toast doesn't go off-screen on mobile
            },
          }} 
        />
        
        {/* Added a main wrapper to ensure content handles the footer/bottom correctly */}
        <main className="grow">
          {children}
        </main>

      </body>
    </html>
  );
}
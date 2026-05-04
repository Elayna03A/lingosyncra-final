import type { Metadata } from "next";
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
      <body className="min-h-full flex flex-col bg-slate-900 text-white">
        
<Toaster 
  position="top-center" 
  toastOptions={{
    duration: 4000,
    style: {
      background: '#1e293b',
      color: '#fff',
      border: '1px solid #334155',
      borderRadius: '12px',
      fontSize: '14px',
      padding: '16px'
    },
  }} 
/>
        {children}
      </body>
    </html>
  );
}
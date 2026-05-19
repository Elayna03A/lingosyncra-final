export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server Error: Translation configuration key missing." }, { status: 500 });
    }

    // 1. Correct modern SDK structural initialization 
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 2. Explicitly target the core model instance
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following text accurately into ${targetLanguage}. Do not return anything else except the raw translated text content string itself:\n\n"${text}"`,
    });

    const translatedResultText = response.text || "";

    if (!translatedResultText) {
      throw new Error("Empty response object received from generation endpoint");
    }

    return NextResponse.json({ translatedText: translatedResultText.trim() });
  } catch (error: any) {
    // This will print the precise underlying technical issue directly into your Vercel Dashboard logs
    console.error("Detailed Gemini Handshake Exception:", error);
    
    // This sends the precise breakdown message back to your browser console so you can see it live!
    return NextResponse.json(
      { error: `Server Error: Translation generation broke down. Detail: ${error.message || error}` },
      { status: 500 }
    );
  }
}
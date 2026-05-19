import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    // 1. Guard checks
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing text or targetLanguage strings." },
        { status: 400 }
      );
    }

    // 2. Safely grab your API key from the environment
    // It checks both variants just to be completely safe!
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.error("CRITICAL CONFIG ERROR: Gemini API key is completely missing from Vercel/environment variables.");
      return NextResponse.json(
        { error: "Server authentication misconfigured. API Key not found." },
        { status: 501 }
      );
    }

    // 3. Initialize the client using the correct @google/genai package format
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 4. Map the frontend display names to clean instructions for the AI
    let cleanLanguage = "English";
    const lowerLang = targetLanguage.toLowerCase();
    
    if (lowerLang.includes("sinhala") || lowerLang === "si") {
      cleanLanguage = "Sinhala";
    } else if (lowerLang.includes("tamil") || lowerLang === "ta") {
      cleanLanguage = "Tamil";
    }

    // 5. Generate content using the proper SDK syntax
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following text strictly into ${cleanLanguage}. Do not add any conversational remarks, commentary, introductions, markdown formatting, or extra explanations. Only return the exact translated text.\n\nText to translate:\n"${text}"`,
    });

    const translatedText = response.text?.trim();

    if (!translatedText) {
      throw new Error("Gemini returned an empty translation response string.");
    }

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error("Translation API Route Error Handler Logging:", error);
    return NextResponse.json(
      { error: error.message || "Internal server translation failure." },
      { status: 500 }
    );
  }
}
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
      console.error("Missing critical environment configuration variable: NEXT_PUBLIC_GEMINI_API_KEY");
      return NextResponse.json({ error: "Server Error: Translation service configuration key missing." }, { status: 500 });
    }

    // Initialize using the correct authentication configuration mapping
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Using the stable, universally supported production model name string
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following text accurately into ${targetLanguage}. Do not return anything else except the raw translated text content result string itself:\n\n"${text}"`,
    });

    const translatedResultText = response.text || "";

    if (!translatedResultText) {
      throw new Error("Empty response received from Gemini model generation endpoint");
    }

    return NextResponse.json({ translatedText: translatedResultText.trim() });
  } catch (error: any) {
    // This logs the exact hidden engine issue to your Vercel Dashboard Logs tab
    console.error("Detailed Gemini API Handshake breakdown:", error);
    return NextResponse.json(
      { error: `Server Error: Translation generation instance broke down. Details: ${error.message || error}` },
      { status: 500 }
    );
  }
}
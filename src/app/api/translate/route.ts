import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize the correct Google Gen AI SDK package securely using the public key name
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "" });

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check for the updated public variable name
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.error("Missing critical environment configuration variable: NEXT_PUBLIC_GEMINI_API_KEY");
      return NextResponse.json({ error: "Server Error: Translation service configuration key missing." }, { status: 500 });
    }

    // Run structured text prompt execution instruction model
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following text accurately into ${targetLanguage}. Do not return anything else except the raw translated text content result string itself:\n\n"${text}"`,
    });

    const translatedResultText = response.text || "";

    return NextResponse.json({ translatedText: translatedResultText.trim() });
  } catch (error: any) {
    console.error("Internal translation handler pipeline crash details:", error);
    return NextResponse.json(
      { error: "Server Error: Translation generation instance broke down." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    // Fallback lookups for the API key string variables
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ 
        error: "CRITICAL CONFIG ERROR: Your Gemini API key is missing from Vercel environment variables!" 
      }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Translate the following text into ${targetLanguage}. 
      Provide only the translated text and nothing else. Do not include quotes.
      
      Text to translate: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedText = response.text().trim();

    return NextResponse.json({ translation: translatedText });
  } catch (error: any) {
    console.error("Gemini server-side crash details:", error);
    return NextResponse.json({ 
      error: "Gemini API crashed during execution", 
      details: error?.message || String(error) 
    }, { status: 500 });
  }
}
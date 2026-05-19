import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Securely runs on the server side using whichever variable key variant is present
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!apiKey) {
      console.error("Gemini Key Error: API key is completely missing on server variables.");
      return NextResponse.json({ error: "API key configuration missing" }, { status: 500 });
    }

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
  } catch (error) {
    console.error("Gemini Internal Server Translation Error:", error);
    return NextResponse.json({ error: "Internal translation processing failed" }, { status: 500 });
  }
}
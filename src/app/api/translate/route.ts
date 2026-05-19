import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// This runs strictly on the secure server side on Vercel
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
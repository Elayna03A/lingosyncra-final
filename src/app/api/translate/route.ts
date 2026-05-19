import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Initialize the Google GenAI SDK with your environment API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    // 1. Validation guard check
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing required fields: text or targetLanguage name strings." },
        { status: 400 }
      );
    }

    // 2. Clean up the target language string so the AI instructions stay pristine.
    // This turns strings like "සිංහල (Sinhala)" or "தமிழ் (Tamil)" into clear identifiers.
    let cleanLanguage = targetLanguage;
    if (targetLanguage.toLowerCase().includes("sinhala")) {
      cleanLanguage = "Sinhala";
    } else if (targetLanguage.toLowerCase().includes("tamil")) {
      cleanLanguage = "Tamil";
    } else if (targetLanguage.toLowerCase().includes("english")) {
      cleanLanguage = "English";
    }

    // 3. Request translation content generation from gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following text strictly into ${cleanLanguage}. Do not add any conversational remarks, commentary, introductions, markdown styling, or extra explanations. Only return the exact translated text.\n\nText to translate:\n"${text}"`,
    });

    const translatedText = response.text?.trim();

    // 4. Ensure response is valid before passing back down to user UI instance
    if (!translatedText) {
      throw new Error("Gemini returned an empty response string.");
    }

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error("Translation API Route Error Handler Logging:", error);
    return NextResponse.json(
      { error: error.message || "Internal translation generation failure." },
      { status: 500 }
    );
  }
}
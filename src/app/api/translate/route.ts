import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Force Next.js to treat this as a dynamic server runtime route
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Grab raw body safely
    const body = await request.json();
    const { text, targetLanguage } = body;

    console.log("Incoming API Translation Request Payload:", { text, targetLanguage });

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing required text or targetLanguage parameters." },
        { status: 400 }
      );
    }

    // 2. Fallback key selection lookup matrix
    const apiKey = 
      process.env.GEMINI_API_KEY || 
      process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
      "";

    if (!apiKey || apiKey.trim() === "") {
      console.error("CRITICAL RUNTIME ERROR: Environment key storage is completely empty.");
      return NextResponse.json(
        { error: "Server authentication misconfigured. API key not found." },
        { status: 501 }
      );
    }

    // 3. Map language inputs to clean instruction strings
    let cleanLanguage = "English";
    const lowerLang = String(targetLanguage).toLowerCase();
    
    if (lowerLang.includes("sinhala") || lowerLang === "si") {
      cleanLanguage = "Sinhala";
    } else if (lowerLang.includes("tamil") || lowerLang === "ta") {
      cleanLanguage = "Tamil";
    }

    // 4. Initialize GenAI client safely inline inside execution context
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 5. Model execution configuration call block
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert translator. Translate the following user message cleanly into ${cleanLanguage}. 
Requirements:
- Translate the true meaning of the message contextually.
- If the text is a phonetic spelling (e.g., Sinhala words written in English letters like 'aybowan' or 'kohomada'), translate it to its proper meaningful form in ${cleanLanguage}.
- Do not include conversational remarks, markdown syntax, or additional thoughts.
- Reply ONLY with the pure translation text.

User message to translate:
${text}`,
    });

    // FIX: Safely extract text from the getter or fallback to structural data tree
    let translatedText = "";
    if (typeof response.text === "string") {
      translatedText = response.text;
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      translatedText = response.candidates[0].content.parts[0].text;
    }

    translatedText = translatedText.trim();

    // 6. Return successful structured response object literal
    return NextResponse.json({ translatedText: translatedText });

  } catch (error: any) {
    console.error("CRITICAL API BREAKDOWN DETECTED:", error);
    return NextResponse.json(
      { error: error.message || "Internal system server execution crash." },
      { status: 500 }
    );
  }
}
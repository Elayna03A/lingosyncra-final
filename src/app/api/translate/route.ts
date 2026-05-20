import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Service Role client safely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { messageId, text, targetLanguage } = await request.json();

    if (!text || !targetLanguage || !messageId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Explicitly type the language map structure to prevent indexing errors
    const langMap: { 
      [key: string]: { 
        col: "translation_en" | "translation_si" | "translation_ta"; 
        code: string; 
      } 
    } = {
      "English": { col: "translation_en", code: "en" },
      "සිංහල (Sinhala)": { col: "translation_si", code: "si" },
      "தமிழ் (Tamil)": { col: "translation_ta", code: "ta" }
    };

    const target = langMap[targetLanguage];
    if (!target) {
      return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });
    }

    // 2. Check if the database already has this translation cached
    const { data: existingMsg } = await supabase
      .from("messages")
      .select(target.col)
      .eq("id", messageId)
      .single();

    if (existingMsg && (existingMsg as any)[target.col]) {
      return NextResponse.json({ translatedText: (existingMsg as any)[target.col] });
    }

    // 3. Call Gemini ONLY if it's missing from the database cache
    const prompt = `You are a professional real-time chat translator. Translate the following user message accurately into "${targetLanguage}". Return ONLY the final translated text response. Do not include any notes, explanations, or markdown formatting.\n\nMessage: ${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const translatedText = response.text?.trim() || text;

    // 4. Cache the translation result in Supabase immediately
    await supabase
      .from("messages")
      .update({ [target.col]: translatedText })
      .eq("id", messageId);

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error("Translation Engine breakdown:", error);
    if (error.status === 429 || error.message?.includes("429")) {
      return NextResponse.json({ error: "Rate limit reached. Please wait." }, { status: 429 });
    }
    return NextResponse.json({ error: "Internal server translation error" }, { status: 500 });
  }
}
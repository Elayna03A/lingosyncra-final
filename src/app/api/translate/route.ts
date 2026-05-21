import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js"; 

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. Explicitly type the possible language columns to satisfy TypeScript
type TranslationColumns = "translation_en" | "translation_si" | "translation_ta";

export async function POST(request: Request) {
  try {
    const { messageId, text, targetLanguage } = await request.json();

    if (!text || !targetLanguage || !messageId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 2. Enforce the strict type on our dynamic tracking column variable
    let langColumn: TranslationColumns = "translation_en";
    
    if (targetLanguage.includes("Sinhala")) {
      langColumn = "translation_si";
    } else if (targetLanguage.includes("Tamil")) {
      langColumn = "translation_ta";
    }

    // STEP 1: Check if this specific message already has the translation saved
    const { data: existingMessage, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select(langColumn)
      .eq("id", messageId)
      .single();

    // 3. Cast the fetched record data so TypeScript recognizes the dynamic text key indexing
    if (!fetchError && existingMessage) {
      const messageData = existingMessage as Record<TranslationColumns, string | null>;
      if (messageData[langColumn]) {
        return NextResponse.json({ translatedText: messageData[langColumn] });
      }
    }

    // STEP 2: If it wasn't saved, call Gemini to translate it
    const prompt = `You are a professional real-time chat translator. Translate the following text exactly into ${targetLanguage}. Return ONLY the direct translation text. Do not add explanations, notes, or extra punctuation: "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const translatedText = response.text?.trim() || text;

    // STEP 3: Save it permanently to that message row so it never translates again
    await supabaseAdmin
      .from("messages")
      .update({ [langColumn]: translatedText })
      .eq("id", messageId);

    return NextResponse.json({ translatedText });

  } catch (error: any) {
    console.error("Critical Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
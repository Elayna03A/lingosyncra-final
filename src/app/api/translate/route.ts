import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js"; 

// Initialize the Google Gen AI client. 
// It will automatically read process.env.GEMINI_API_KEY natively.
// Pass an empty object so the SDK initializes correctly and pulls GEMINI_API_KEY from your environment variables natively.
const ai = new GoogleGenAI({});
// Safeguard initialization so Vercel can build without crashing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

type TranslationColumns = "translation_en" | "translation_si" | "translation_ta";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, text, targetLanguage } = body;

    // Enhanced logging to check exactly what the frontend is sending in production
    console.log("Incoming Translation Payload:", { messageId, text, targetLanguage });

    if (!text || !targetLanguage || !messageId) {
      return NextResponse.json(
        { 
          error: "Missing parameters", 
          received: { messageId: !!messageId, text: !!text, targetLanguage: !!targetLanguage } 
        }, 
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
    }

    let langColumn: TranslationColumns = "translation_en";
    
    // Normalize string casing to prevent matching failures
    const normalizedTarget = targetLanguage.toLowerCase();
    if (normalizedTarget.includes("sinhala") || normalizedTarget.includes("සිංහල")) {
      langColumn = "translation_si";
    } else if (normalizedTarget.includes("tamil") || normalizedTarget.includes("தமிழ்")) {
      langColumn = "translation_ta";
    } else {
      langColumn = "translation_en";
    }

    // STEP 1: Check if this specific message already has the translation saved
    const { data: existingMessage, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select(langColumn)
      .eq("id", messageId)
      .single();

    if (!fetchError && existingMessage) {
      const messageData = existingMessage as Record<TranslationColumns, string | null>;
      if (messageData[langColumn]) {
        return NextResponse.json({ translatedText: messageData[langColumn] });
      }
    }

    // STEP 2: Call Gemini to translate it
    const prompt = `You are a professional real-time chat translator. Translate the following text exactly into ${targetLanguage}. Return ONLY the direct translation text. Do not add explanations, notes, or extra punctuation: "${text}"`;

    // Make sure your Vercel Environment Key is named GEMINI_API_KEY
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // Extracting text safely from the official @google/genai SDK response structure
    const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    const translatedText = (candidateText || response.text || "").trim() || text;

    // STEP 3: Save it permanently to that message row so it never translates again
    const { error: updateError } = await supabaseAdmin
      .from("messages")
      .update({ [langColumn]: translatedText })
      .eq("id", messageId);

    if (updateError) {
      console.error("Supabase Admin Save Error:", updateError.message);
    }

    return NextResponse.json({ translatedText });

  } catch (error: any) {
    console.error("Critical Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
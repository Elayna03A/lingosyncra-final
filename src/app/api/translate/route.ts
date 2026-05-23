import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js"; 

type TranslationColumns = "translation_en" | "translation_si" | "translation_ta";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, text, targetLanguage } = body;

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

    // 1. DYNAMIC INITIALIZATION: Read variables inside the handler function block
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    
    // Fallback safely to public anon key if service key wasn't added to Vercel yet
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    // Comprehensive Diagnostics if variables are missing
    if (!apiKey) {
      return NextResponse.json({ error: "Configuration Error: GEMINI_API_KEY is not defined in Vercel settings." }, { status: 500 });
    }
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Configuration Error: Supabase connection keys are missing." }, { status: 500 });
    }

    // Initialize fresh instances per request invocation
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    let langColumn: TranslationColumns = "translation_en";
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    const translatedText = (candidateText || response.text || "").trim() || text;

    // STEP 3: Save it permanently to that message row
    const { error: updateError } = await supabaseAdmin
      .from("messages")
      .update({ [langColumn]: translatedText })
      .eq("id", messageId);

    if (updateError) {
      console.error("Supabase Database Update Error:", updateError.message);
      // Return the translation anyway so the UI updates even if db logging fails
    }

    return NextResponse.json({ translatedText });

  } catch (error: any) {
    console.error("Critical Route Error:", error);
    return NextResponse.json({ 
      error: "Internal Server Exception",
      message: error?.message || String(error)
    }, { status: 500 });
  }
}
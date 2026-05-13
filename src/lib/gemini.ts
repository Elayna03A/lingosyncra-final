import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

/**
 * Translates text into a target language using Gemini AI
 */
export async function translateText(text: string, targetLanguage: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Translate the following text into ${targetLanguage}. 
      Provide only the translated text and nothing else.
      
      Text to translate: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return "Translation error occurred.";
  }
}
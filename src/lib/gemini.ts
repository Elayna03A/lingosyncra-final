/**
 * Route proxy that safely sends translation requests to our internal Next.js API server
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, targetLanguage }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status code: ${response.status}`);
    }

    const data = await response.json();
    return data.translation || "Translation error occurred.";
  } catch (error) {
    console.error("Gemini Client-Side Fetch Error:", error);
    return "Translation error occurred.";
  }
}
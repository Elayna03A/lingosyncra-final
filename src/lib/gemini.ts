/**
 * Safely routes the translation to our internal Next.js API server
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    // We add a cache-busting setting so the browser cannot use older local cached results
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, targetLanguage }),
      cache: "no-store", 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Server API returned an error:", response.status, errorData);
      return `[Translation Server Error: ${response.status}]`;
    }

    const data = await response.json();
    return data.translation || "[Translation completely empty]";
  } catch (error) {
    console.error("Critical Client-Side Fetch Error:", error);
    return "[Connection to translation server failed]";
  }
}
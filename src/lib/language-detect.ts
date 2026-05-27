const SUPPORTED_LANGS = new Map([
  ["en", "en"],
  ["es", "es"],
  ["fr", "fr"],
  ["de", "de"],
  ["pt", "pt"],
  ["it", "it"],
  ["nl", "nl"],
  ["ja", "ja"],
  ["zh", "zh"],
  ["ko", "ko"],
  ["ar", "ar"],
  ["hi", "hi"],
  ["ru", "ru"],
]);

function mapLangCode(raw: string): string | null {
  const base = raw.split("-")[0].toLowerCase();
  return SUPPORTED_LANGS.get(base) || null;
}

export async function detectLanguageFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; nuncio-bot/1.0)",
        Accept: "text/html",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const langMatch = html.match(/<html[^>]*\slang=["']([a-zA-Z-]+)["']/i);
    if (langMatch) {
      return mapLangCode(langMatch[1]);
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
// Paste your keys here before loading the extension.
// DeepL API key:  https://www.deepl.com/pro-api
// SerpAPI key:    https://serpapi.com/manage-api-key
const DEEPL_API_KEY = 'a071b20d-d3a7-4192-b28e-0126f87c0f66:fx';
const SERP_API_KEY  = '7b35efd97089483fb39c8c4b6d1c14b4b10ec720e8d7c264166993f7641f62bb';

// DeepL free-tier uses api-free.deepl.com; paid tier uses api.deepl.com.
// Change this to 'https://api.deepl.com' if you are on a paid DeepL plan.
const DEEPL_BASE = 'https://api-free.deepl.com';

// ─── Language config ──────────────────────────────────────────────────────────
// deepl:  target language code for DeepL translation
// google: gl + hl params for SerpAPI (Google search locale)

const LANG_CONFIG = {
  de: { deepl: 'DE',    gl: 'de', hl: 'de' },
  fr: { deepl: 'FR',    gl: 'fr', hl: 'fr' },
  es: { deepl: 'ES',    gl: 'es', hl: 'es' },
  pt: { deepl: 'PT-BR', gl: 'br', hl: 'pt' },
  ja: { deepl: 'JA',    gl: 'jp', hl: 'ja' },
  zh: { deepl: 'ZH',    gl: 'cn', hl: 'zh-cn' },
  ar: { deepl: 'AR',    gl: 'sa', hl: 'ar' },
  ko: { deepl: 'KO',    gl: 'kr', hl: 'ko' },
};

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SEARCH') return false;

  const { query, langCode } = message;
  const config = LANG_CONFIG[langCode];

  if (!config) {
    sendResponse({ error: `Unknown language code: ${langCode}` });
    return false;
  }

  handleSearch(query, langCode, config)
    .then(payload => sendResponse(payload))
    .catch(err => sendResponse({ error: err.message || 'Unknown error.' }));

  // Keep message channel open for async response
  return true;
});

// ─── Main flow: translate query → search → translate titles back ──────────────

async function handleSearch(originalQuery, langCode, config) {
  validateKeys();

  // Step 1: translate query to target language
  let translatedQuery;
  try {
    const out = await translate([originalQuery], config.deepl);
    translatedQuery = out[0];
  } catch (err) {
    throw new Error(`Query translation failed: ${err.message}`);
  }

  // Step 2: search with translated query via SerpAPI
  let results;
  try {
    results = await searchSerpApi(translatedQuery, config.gl, config.hl);
  } catch (err) {
    throw new Error(`Search failed: ${err.message}`);
  }

  // Step 3: translate all result titles back to English in one batch request
  if (results.length > 0) {
    try {
      const titles = results.map(r => r.title);
      const translatedTitles = await translate(titles, 'EN-US');
      results = results.map((r, i) => ({
        ...r,
        title: translatedTitles[i] || r.title,
        originalTitle: r.title,
      }));
    } catch (err) {
      // Non-fatal: keep original titles if back-translation fails
      console.warn('Title back-translation failed, keeping original titles:', err.message);
    }
  }

  return { translatedQuery, results };
}

// ─── DeepL translation (batch) ───────────────────────────────────────────────
// Accepts an array of strings, returns an array of translated strings.
// DeepL supports up to 50 texts per request, so all titles fit in one call.

async function translate(texts, targetLang) {
  const res = await fetch(`${DEEPL_BASE}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.message || `DeepL HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return data.translations.map(t => t.text);
}

// ─── SerpAPI search ───────────────────────────────────────────────────────────

async function searchSerpApi(query, gl, hl) {
  const params = new URLSearchParams({
    api_key: SERP_API_KEY,
    engine:  'google',
    q:       query,
    gl,
    hl,
    num:     5,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error || `SerpAPI HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();

  if (!data.organic_results || data.organic_results.length === 0) return [];

  return data.organic_results.slice(0, 5).map(item => ({
    title: item.title,
    url:   item.link,
  }));
}

// ─── Key validation ───────────────────────────────────────────────────────────

function validateKeys() {
  if (!DEEPL_API_KEY || DEEPL_API_KEY === 'YOUR_DEEPL_API_KEY') {
    throw new Error('DeepL API key not set. Open background.js and add your key.');
  }
  if (!SERP_API_KEY || SERP_API_KEY === 'YOUR_SERPAPI_KEY') {
    throw new Error('SerpAPI key not set. Open background.js and add your key.');
  }
}

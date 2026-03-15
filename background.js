
const DEEPL_API_KEY = 'a071b20d-d3a7-4192-b28e-0126f87c0f66:fx';
const SERP_API_KEY  = '7b35efd97089483fb39c8c4b6d1c14b4b10ec720e8d7c264166993f7641f62bb';

const DEEPL_BASE = 'https://api-free.deepl.com';


const LANG_CONFIG = {
  ar:    { deepl: 'AR',    gl: 'sa', hl: 'ar'    },
  bg:    { deepl: 'BG',    gl: 'bg', hl: 'bg'    },
  cs:    { deepl: 'CS',    gl: 'cz', hl: 'cs'    },
  da:    { deepl: 'DA',    gl: 'dk', hl: 'da'    },
  de:    { deepl: 'DE',    gl: 'de', hl: 'de'    },
  el:    { deepl: 'EL',    gl: 'gr', hl: 'el'    },
  es:    { deepl: 'ES',    gl: 'es', hl: 'es'    },
  et:    { deepl: 'ET',    gl: 'ee', hl: 'et'    },
  fi:    { deepl: 'FI',    gl: 'fi', hl: 'fi'    },
  fr:    { deepl: 'FR',    gl: 'fr', hl: 'fr'    },
  hu:    { deepl: 'HU',    gl: 'hu', hl: 'hu'    },
  id:    { deepl: 'ID',    gl: 'id', hl: 'id'    },
  it:    { deepl: 'IT',    gl: 'it', hl: 'it'    },
  ja:    { deepl: 'JA',    gl: 'jp', hl: 'ja'    },
  ko:    { deepl: 'KO',    gl: 'kr', hl: 'ko'    },
  lt:    { deepl: 'LT',    gl: 'lt', hl: 'lt'    },
  lv:    { deepl: 'LV',    gl: 'lv', hl: 'lv'    },
  nb:    { deepl: 'NB',    gl: 'no', hl: 'no'    },
  nl:    { deepl: 'NL',    gl: 'nl', hl: 'nl'    },
  pl:    { deepl: 'PL',    gl: 'pl', hl: 'pl'    },
  pt:    { deepl: 'PT-BR', gl: 'br', hl: 'pt'    },
  ptpt:  { deepl: 'PT-PT', gl: 'pt', hl: 'pt'    },
  ro:    { deepl: 'RO',    gl: 'ro', hl: 'ro'    },
  ru:    { deepl: 'RU',    gl: 'ru', hl: 'ru'    },
  sk:    { deepl: 'SK',    gl: 'sk', hl: 'sk'    },
  sl:    { deepl: 'SL',    gl: 'si', hl: 'sl'    },
  sv:    { deepl: 'SV',    gl: 'se', hl: 'sv'    },
  tr:    { deepl: 'TR',    gl: 'tr', hl: 'tr'    },
  uk:    { deepl: 'UK',    gl: 'ua', hl: 'uk'    },
  zh:    { deepl: 'ZH',    gl: 'cn', hl: 'zh-cn' },
  zhtw:  { deepl: 'ZH-HANT', gl: 'tw', hl: 'zh-TW' },
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SEARCH') return false;

  const { query, langCode, resultTypes = ['web'] } = message;
  const config = LANG_CONFIG[langCode];

  if (!config) {
    sendResponse({ error: `Unknown language code: ${langCode}` });
    return false;
  }

  handleSearch(query, langCode, config, resultTypes)
    .then(payload => sendResponse(payload))
    .catch(err => sendResponse({ error: err.message || 'Unknown error.' }));

  return true;
});

async function handleSearch(originalQuery, langCode, config, resultTypes) {
  validateKeys();

  // Step 1: translate query to target language once (shared across all types)
  let translatedQuery;
  try {
    const out = await translate([originalQuery], config.deepl);
    translatedQuery = out[0];
  } catch (err) {
    throw new Error(`Query translation failed: ${err.message}`);
  }

  // Step 2: run all requested result types in parallel
  const typeResults = await Promise.allSettled(
    resultTypes.map(async resultType => {
      const results = await searchSerpApi(translatedQuery, config.gl, config.hl, resultType);
      return { resultType, results };
    })
  );

  // Step 3: collect all titles across all types for a single batch back-translation
  const resultsByType = {};
  const allResults = [];
  const allIndices = []; // track which type/index each title belongs to

  for (const outcome of typeResults) {
    if (outcome.status === 'fulfilled') {
      const { resultType, results } = outcome.value;
      resultsByType[resultType] = results;
      results.forEach((r, i) => {
        allIndices.push({ resultType, i });
        allResults.push(r);
      });
    } else {
      // Mark failed types so results.js can show a per-type error
      const idx = typeResults.indexOf(outcome);
      resultsByType[resultTypes[idx]] = { error: outcome.reason?.message || 'Search failed.' };
    }
  }

  // Step 4: back-translate all titles in one batch call
  if (allResults.length > 0) {
    try {
      const titles = allResults.map(r => r.title);
      const translatedTitles = await translate(titles, 'EN-US');
      allIndices.forEach(({ resultType, i }, flatIdx) => {
        if (Array.isArray(resultsByType[resultType])) {
          resultsByType[resultType][i] = {
            ...resultsByType[resultType][i],
            title: translatedTitles[flatIdx] || resultsByType[resultType][i].title,
            originalTitle: resultsByType[resultType][i].title,
          };
        }
      });
    } catch (err) {
      console.warn('Title back-translation failed, keeping original titles:', err.message);
    }
  }

  return { translatedQuery, resultsByType };
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

async function searchSerpApi(query, gl, hl, resultType = 'web') {
  let serpParams;
  let endpoint = 'https://serpapi.com/search.json';

  if (resultType === 'news') {
    serpParams = {
      api_key: SERP_API_KEY,
      engine:  'google_news',
      q:       query,
      gl,
    };

  } else if (resultType === 'blogs') {
    const exclusions = [
      '-site:wikipedia.org',
      '-site:reddit.com',
      '-site:quora.com',
      '-site:youtube.com',
      '-site:twitter.com',
      '-site:facebook.com',
      '-site:linkedin.com',
      '-site:amazon.com',
      '-site:bbc.com',
      '-site:cnn.com',
      '-site:reuters.com',
      '-site:nytimes.com',
      '-site:theguardian.com',
    ].join(' ');

    serpParams = {
      api_key: SERP_API_KEY,
      engine:  'google',
      q:       `${query} ("blog" OR "opinion" OR "my experience" OR "I think") ${exclusions}`,
      gl,
      hl,
      num:     10,  
      tbs:     'qdr:y',
    };

  } else if (resultType === 'academic') {
    serpParams = {
      api_key: SERP_API_KEY,
      engine:  'google_scholar',
      q:       query,
      num:     5,
    };

  } else {
    
    serpParams = {
      api_key: SERP_API_KEY,
      engine:  'google',
      q:       query,
      gl,
      hl,
      num:     5,
    };
  }

  const params = new URLSearchParams(serpParams);
  const res = await fetch(`${endpoint}?${params}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error || `SerpAPI HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return parseResults(data, resultType);
}


function parseResults(data, resultType) {
  if (resultType === 'news') {
    const items = data.news_results || [];
    return items.slice(0, 5).map(item => ({
      title:  item.title,
      url:    item.link,
      source: item.source?.name || null,
      date:   item.date         || null,
    }));
  }

  if (resultType === 'academic') {
    const items = data.organic_results || [];
    return items.slice(0, 5).map(item => ({
      title:    item.title,
      url:      item.link || item.result_id,
      authors:  item.publication_info?.authors?.map(a => a.name).join(', ') || null,
      journal:  item.publication_info?.summary || null,
      cited:    item.inline_links?.cited_by?.total ?? null,
    }));
  }

  if (resultType === 'blogs') {
    const items = data.organic_results || [];
    return items.slice(0, 5).map(item => ({
      title: item.title,
      url:   item.link,
    }));
  }

  const items = data.organic_results || [];
  return items.slice(0, 5).map(item => ({
    title: item.title,
    url:   item.link,
  }));
}

function validateKeys() {
  if (!DEEPL_API_KEY || DEEPL_API_KEY === 'YOUR_DEEPL_API_KEY') {
    throw new Error('DeepL API key not set. Open background.js and add your key.');
  }
  if (!SERP_API_KEY || SERP_API_KEY === 'YOUR_SERPAPI_KEY') {
    throw new Error('SerpAPI key not set. Open background.js and add your key.');
  }
}

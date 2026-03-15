const LANG_META = {
  de: { flag: '🇩🇪', name: 'German'         },
  fr: { flag: '🇫🇷', name: 'French'          },
  es: { flag: '🇪🇸', name: 'Spanish'         },
  pt: { flag: '🇧🇷', name: 'Portuguese (BR)' },
  ja: { flag: '🇯🇵', name: 'Japanese'        },
  zh: { flag: '🇨🇳', name: 'Chinese (CN)'    },
  ar: { flag: '🇸🇦', name: 'Arabic'          },
  ko: { flag: '🇰🇷', name: 'Korean'          },
};

// ─── URL params ───────────────────────────────────────────────────────────────

function getParams() {
  const p = new URLSearchParams(window.location.search);
  const q = p.get('q');
  const langs = p.get('langs');
  if (q && langs) return { query: q, langs: langs.split(',').filter(Boolean) };
  return null;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function renderHeader(query, langs) {
  document.getElementById('originalQuery').textContent = query;
  const pills = document.getElementById('langPills');
  pills.innerHTML = '';
  langs.forEach(code => {
    const meta = LANG_META[code];
    if (!meta) return;
    const el = document.createElement('span');
    el.className = 'lang-pill';
    el.textContent = `${meta.flag} ${meta.name}`;
    pills.appendChild(el);
  });
}

// ─── Section scaffolding ──────────────────────────────────────────────────────

function createSection(code) {
  const meta = LANG_META[code];
  const section = document.createElement('div');
  section.className = 'section';
  section.id = `section-${code}`;
  section.innerHTML = `
    <div class="section-header">
      <span class="flag">${meta.flag}</span>
      <span class="region-name">${meta.name}</span>
    </div>
    <div class="localized-query" id="lq-${code}">
      <span class="qlabel">Query:</span><span class="lq-text">Translating…</span>
    </div>
    <div class="section-body" id="body-${code}">
      ${skeletonHTML()}
    </div>
  `;
  return section;
}

function updateLocalizedQuery(code, translatedQuery) {
  const el = document.querySelector(`#lq-${code} .lq-text`);
  if (el) el.textContent = translatedQuery;
}

function skeletonHTML() {
  return `
    <div class="skeleton-wrap" aria-label="Loading results…">
      ${[1, 2, 3].map(() => `
        <div class="skeleton-item">
          <div class="skel skel-num"></div>
          <div class="skel-content">
            <div class="skel skel-title"></div>
            <div class="skel skel-url"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Render results / errors ──────────────────────────────────────────────────

function renderResults(code, results) {
  const body = document.getElementById(`body-${code}`);
  if (!body) return;
  if (!results || results.length === 0) {
    body.innerHTML = `<p class="inline-error">No results found for this language.</p>`;
    return;
  }
  const items = results.map((r, i) => `
    <li class="result-item">
      <span class="result-num">${i + 1}</span>
      <div class="result-content">
        <a class="result-title" href="${escapeHTML(r.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHTML(r.title)}
        </a>
        <span class="result-url">${escapeHTML(displayUrl(r.url))}</span>
      </div>
    </li>
  `).join('');
  body.innerHTML = `<ol class="results-list">${items}</ol>`;
}

function renderSectionError(code, message) {
  const body = document.getElementById(`body-${code}`);
  if (!body) return;
  body.innerHTML = `
    <div class="inline-error">
      ${escapeHTML(message)}
    </div>
  `;
}

// ─── Fetch via background service worker ─────────────────────────────────────
// background.js returns: { translatedQuery: string, results: [{title, url}] }
//                     or: { error: string }

function fetchResultsForLang(query, code) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'SEARCH', query, langCode: code },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response); // { translatedQuery, results }
        }
      }
    );
  });
}

// ─── Fatal error (no URL params) ─────────────────────────────────────────────

function showFatalError() {
  document.getElementById('sectionsContainer').innerHTML = `
    <div class="error-state">
      <p>No search data found.</p>
      <p>Please run a search from the extension popup.</p>
    </div>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/$/, '');
  } catch {
    return url;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const params = getParams();
  if (!params) { showFatalError(); return; }

  const { query, langs } = params;
  renderHeader(query, langs);

  const container = document.getElementById('sectionsContainer');
  container.innerHTML = '';

  // Render all section shells with skeletons immediately
  langs.forEach(code => {
    if (!LANG_META[code]) return;
    container.appendChild(createSection(code));
  });

  // Fetch all languages in parallel; each section updates as it resolves
  await Promise.allSettled(
    langs.map(async code => {
      if (!LANG_META[code]) return;
      try {
        const { translatedQuery, results } = await fetchResultsForLang(query, code);
        updateLocalizedQuery(code, translatedQuery); // show real DeepL translation
        renderResults(code, results);
      } catch (err) {
        updateLocalizedQuery(code, '—');
        renderSectionError(code, err.message || 'Failed to load results.');
      }
    })
  );
}

document.addEventListener('DOMContentLoaded', init);

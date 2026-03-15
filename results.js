const LANG_META = {
  ar:   { flag: '🇸🇦', name: 'Arabic'                  },
  bg:   { flag: '🇧🇬', name: 'Bulgarian'                },
  cs:   { flag: '🇨🇿', name: 'Czech'                    },
  da:   { flag: '🇩🇰', name: 'Danish'                   },
  de:   { flag: '🇩🇪', name: 'German'                   },
  el:   { flag: '🇬🇷', name: 'Greek'                    },
  es:   { flag: '🇪🇸', name: 'Spanish'                  },
  et:   { flag: '🇪🇪', name: 'Estonian'                 },
  fi:   { flag: '🇫🇮', name: 'Finnish'                  },
  fr:   { flag: '🇫🇷', name: 'French'                   },
  hu:   { flag: '🇭🇺', name: 'Hungarian'                },
  id:   { flag: '🇮🇩', name: 'Indonesian'               },
  it:   { flag: '🇮🇹', name: 'Italian'                  },
  ja:   { flag: '🇯🇵', name: 'Japanese'                 },
  ko:   { flag: '🇰🇷', name: 'Korean'                   },
  lt:   { flag: '🇱🇹', name: 'Lithuanian'               },
  lv:   { flag: '🇱🇻', name: 'Latvian'                  },
  nb:   { flag: '🇳🇴', name: 'Norwegian'                },
  nl:   { flag: '🇳🇱', name: 'Dutch'                    },
  pl:   { flag: '🇵🇱', name: 'Polish'                   },
  pt:   { flag: '🇧🇷', name: 'Portuguese (BR)'          },
  ptpt: { flag: '🇵🇹', name: 'Portuguese (PT)'          },
  ro:   { flag: '🇷🇴', name: 'Romanian'                 },
  ru:   { flag: '🇷🇺', name: 'Russian'                  },
  sk:   { flag: '🇸🇰', name: 'Slovak'                   },
  sl:   { flag: '🇸🇮', name: 'Slovenian'                },
  sv:   { flag: '🇸🇪', name: 'Swedish'                  },
  tr:   { flag: '🇹🇷', name: 'Turkish'                  },
  uk:   { flag: '🇺🇦', name: 'Ukrainian'                },
  zh:   { flag: '🇨🇳', name: 'Chinese (Simplified)'     },
  zhtw: { flag: '🇹🇼', name: 'Chinese (Traditional)'    },
};

const RESULT_TYPE_META = {
  web:      { label: 'General Web', icon: '🌐', color: '#5f5e5a' },
  news:     { label: 'News',        icon: '📰', color: '#185fa5' },
  blogs:    { label: 'Blogs',       icon: '✍️',  color: '#3b6d11' },
  academic: { label: 'Academic',    icon: '🎓', color: '#854f0b' },
};

function getParams() {
  const p = new URLSearchParams(window.location.search);
  const q = p.get('q');
  const langs = p.get('langs');
  const typesParam = p.get('types') || 'web';
  const resultTypes = typesParam.split(',').filter(Boolean);
  if (q && langs) return { query: q, langs: langs.split(',').filter(Boolean), resultTypes };
  return null;
}

function renderHeader(query, langs, resultTypes) {
  document.getElementById('originalQuery').textContent = query;

  const typeBadgeContainer = document.getElementById('resultTypeBadge');
  if (typeBadgeContainer) {
    typeBadgeContainer.innerHTML = '';
    resultTypes.forEach(type => {
      const typeMeta = RESULT_TYPE_META[type] || RESULT_TYPE_META.web;
      const badge = document.createElement('span');
      badge.className = 'result-type-badge';
      badge.textContent = `${typeMeta.icon} ${typeMeta.label}`;
      badge.style.color = typeMeta.color;
      typeBadgeContainer.appendChild(badge);
    });
  }

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


function resultItemHTML(r, i, resultType) {
  let meta = '';

  if (resultType === 'news') {
    const parts = [];
    if (r.source) parts.push(`<span class="result-source">${escapeHTML(r.source)}</span>`);
    if (r.date)   parts.push(`<span class="result-date">${escapeHTML(r.date)}</span>`);
    if (parts.length) meta = `<div class="result-meta">${parts.join('<span class="meta-dot">·</span>')}</div>`;
  } else if (resultType === 'academic') {
    const parts = [];
    if (r.authors)   parts.push(`<span class="result-authors">${escapeHTML(r.authors)}</span>`);
    if (r.journal)   parts.push(`<span class="result-journal">${escapeHTML(r.journal)}</span>`);
    if (r.cited != null) parts.push(`<span class="result-cited">Cited by ${r.cited}</span>`);
    if (parts.length) meta = `<div class="result-meta">${parts.join('<span class="meta-dot">·</span>')}</div>`;
  }

  const href = r.url && r.url.startsWith('http') ? escapeHTML(r.url) : '#';

  return `
    <li class="result-item">
      <span class="result-num">${i + 1}</span>
      <div class="result-content">
        <a class="result-title" href="${href}" target="_blank" rel="noopener noreferrer">
          ${escapeHTML(r.title)}
        </a>
        <span class="result-url">${escapeHTML(displayUrl(r.url || ''))}</span>
        ${meta}
      </div>
    </li>
  `;
}

function renderResults(code, resultsByType, resultTypes) {
  const body = document.getElementById(`body-${code}`);
  if (!body) return;
  if (resultTypes.length === 1) {
    const type = resultTypes[0];
    const data = resultsByType[type];
    if (!data || data.error) {
      body.innerHTML = `<div class="inline-error"><span class="error-icon">!</span>${escapeHTML(data?.error || 'No results found.')}</div>`;
      return;
    }
    if (data.length === 0) {
      body.innerHTML = `<p class="inline-error">No results found for this language.</p>`;
      return;
    }
    body.innerHTML = `<ol class="results-list">${data.map((r, i) => resultItemHTML(r, i, type)).join('')}</ol>`;
    return;
  }

  const sections = resultTypes.map(type => {
    const typeMeta = RESULT_TYPE_META[type] || RESULT_TYPE_META.web;
    const data = resultsByType[type];

    let inner;
    if (!data || data.error) {
      inner = `<div class="inline-error"><span class="error-icon">!</span>${escapeHTML(data?.error || 'No results.')}</div>`;
    } else if (data.length === 0) {
      inner = `<p class="type-empty">No results found.</p>`;
    } else {
      inner = `<ol class="results-list">${data.map((r, i) => resultItemHTML(r, i, type)).join('')}</ol>`;
    }

    return `
      <div class="type-subsection">
        <div class="type-subheader">
          <span class="type-subicon">${typeMeta.icon}</span>
          <span class="type-sublabel" style="color:${typeMeta.color}">${typeMeta.label}</span>
        </div>
        ${inner}
      </div>
    `;
  }).join('');

  body.innerHTML = sections;
}

function renderSectionError(code, message) {
  const body = document.getElementById(`body-${code}`);
  if (!body) return;
  body.innerHTML = `
    <div class="inline-error">
      <span class="error-icon">!</span>
      ${escapeHTML(message)}
    </div>
  `;
}

function fetchResultsForLang(query, code, resultTypes) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'SEARCH', query, langCode: code, resultTypes },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response); 
        }
      }
    );
  });
}


function showFatalError() {
  document.getElementById('sectionsContainer').innerHTML = `
    <div class="error-state">
      <p>No search data found.</p>
      <p>Please run a search from the extension popup.</p>
    </div>
  `;
}


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


async function init() {
  const params = getParams();
  if (!params) { showFatalError(); return; }

  const { query, langs, resultTypes } = params;
  renderHeader(query, langs, resultTypes);

  const container = document.getElementById('sectionsContainer');
  container.innerHTML = '';

  langs.forEach(code => {
    if (!LANG_META[code]) return;
    container.appendChild(createSection(code));
  });

  await Promise.allSettled(
    langs.map(async code => {
      if (!LANG_META[code]) return;
      try {
        const { translatedQuery, resultsByType } = await fetchResultsForLang(query, code, resultTypes);
        updateLocalizedQuery(code, translatedQuery);
        renderResults(code, resultsByType, resultTypes);
      } catch (err) {
        updateLocalizedQuery(code, '—');
        renderSectionError(code, err.message || 'Failed to load results.');
      }
    })
  );
}

document.addEventListener('DOMContentLoaded', init);

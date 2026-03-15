const langItems = document.querySelectorAll('.lang-item');
const searchBtn = document.getElementById('searchBtn');
const queryInput = document.getElementById('queryInput');
const hint = document.getElementById('hint');

function updateState() {
  const selected = document.querySelectorAll('.lang-item.selected');
  const count = selected.length;
  const hasQuery = queryInput.value.trim().length > 0;

  if (count === 0) {
    hint.innerHTML = 'Select at least 1 language to search';
    searchBtn.disabled = true;
  } else if (!hasQuery) {
    hint.innerHTML = `<b>${count}</b> language${count > 1 ? 's' : ''} selected — enter a query above`;
    searchBtn.disabled = true;
  } else {
    hint.innerHTML = `Ready to search in <b>${count}</b> language${count > 1 ? 's' : ''}`;
    searchBtn.disabled = false;
  }
}

langItems.forEach(item => {
  item.addEventListener('click', () => {
    item.classList.toggle('selected');
    updateState();
  });
});

queryInput.addEventListener('input', updateState);

queryInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !searchBtn.disabled) searchBtn.click();
});

searchBtn.addEventListener('click', () => {
  const query = queryInput.value.trim();
  const langs = [...document.querySelectorAll('.lang-item.selected')]
    .map(el => el.dataset.lang);

  const resultsUrl = `results.html?q=${encodeURIComponent(query)}&langs=${langs.join(',')}`;
  chrome.tabs.create({ url: chrome.runtime.getURL(resultsUrl) });
});

updateState();

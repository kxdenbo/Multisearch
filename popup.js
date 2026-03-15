const langItems   = document.querySelectorAll('.lang-item');
const typeItems   = document.querySelectorAll('.type-item');
const searchBtn   = document.getElementById('searchBtn');
const queryInput  = document.getElementById('queryInput');
const hint        = document.getElementById('hint');
const selectAllBtn = document.getElementById('selectAll');
const clearAllBtn  = document.getElementById('clearAll');



typeItems.forEach(item => {
  item.addEventListener('click', () => {
    const isSelected = item.classList.contains('selected');
    const selectedCount = document.querySelectorAll('.type-item.selected').length;
    if (isSelected && selectedCount === 1) return;
    item.classList.toggle('selected');
    updateState();
  });
});

function getSelectedTypes() {
  return [...document.querySelectorAll('.type-item.selected')].map(el => el.dataset.type);
}



langItems.forEach(item => {
  item.addEventListener('click', () => {
    item.classList.toggle('selected');
    updateState();
  });
});

selectAllBtn.addEventListener('click', () => {
  langItems.forEach(item => item.classList.add('selected'));
  updateState();
});

clearAllBtn.addEventListener('click', () => {
  langItems.forEach(item => item.classList.remove('selected'));
  updateState();
});

function updateState() {
  const count    = document.querySelectorAll('.lang-item.selected').length;
  const hasQuery = queryInput.value.trim().length > 0;

  if (count === 0) {
    hint.innerHTML    = 'Select at least 1 language to search';
    searchBtn.disabled = true;
  } else if (!hasQuery) {
    hint.innerHTML    = `<b>${count}</b> language${count > 1 ? 's' : ''} selected — enter a query above`;
    searchBtn.disabled = true;
  } else {
    hint.innerHTML    = `Ready to search in <b>${count}</b> language${count > 1 ? 's' : ''}`;
    searchBtn.disabled = false;
  }
}

queryInput.addEventListener('input', updateState);
queryInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !searchBtn.disabled) searchBtn.click();
});

searchBtn.addEventListener('click', () => {
  const query  = queryInput.value.trim();
  const langs  = [...document.querySelectorAll('.lang-item.selected')].map(el => el.dataset.lang);
  const types  = getSelectedTypes();

  const resultsUrl = `results.html?q=${encodeURIComponent(query)}&langs=${langs.join(',')}&types=${types.join(',')}`;
  chrome.tabs.create({ url: chrome.runtime.getURL(resultsUrl) });
});

updateState();

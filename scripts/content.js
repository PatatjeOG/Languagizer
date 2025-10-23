let alphabetMap = {};

// Load current alphabetMap from storage
chrome.storage.sync.get("alphabetMap", (data) => {
  if (data.alphabetMap) alphabetMap = data.alphabetMap;
});

// Watch for changes in storage to keep alphabetMap up to date
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.alphabetMap) {
    alphabetMap = changes.alphabetMap.newValue || {};
  }
});

// Translate text using alphabetMap
function translate(text) {
  return text
    .split("")
    .map((c) => {
      const entry = alphabetMap[c.toLowerCase()];
      return entry ? entry.value : c;
    })
    .join("");
}

// Handle input events on text fields and textareas
document.addEventListener("input", (event) => {
  const target = event.target;
  if (!target || !("value" in target)) return;

  // Early exit if the trigger sequence isn't present
  if (!target.value.includes("!(")) return;

  const triggerRegex = /!\(([^)]+)\)/g;
  let value = target.value;
  const matches = [...value.matchAll(triggerRegex)];

  matches.forEach((match) => {
    const innerText = match[1];
    const translated = translate(innerText);
    value = value.replace(match[0], translated);
  });

  target.value = value;
});

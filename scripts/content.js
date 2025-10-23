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

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!target) return;

  // Handle standard <input> and <textarea> elements
  if (target.value && target.value.includes("!(")) {
    const originalValue = target.value;
    const triggerRegex = /!\(([^)]+)\)/g;
    const newValue = originalValue.replace(triggerRegex, (match, innerText) => translate(innerText));
    
    if (originalValue !== newValue) {
      target.value = newValue;
    }
    return;
  }

  // Handle modern rich-text editors (contenteditable divs)
  if (target.isContentEditable && target.textContent.includes("!(")) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    // We only act on text nodes
    if (container.nodeType !== Node.TEXT_NODE) return;

    const originalText = container.textContent;
    const triggerRegex = /!\(([^)]+)\)/g;

    // Check if a replacement is needed before modifying the DOM
    if (!triggerRegex.test(originalText)) return;

    // Create a new text node with the translated content
    const newText = originalText.replace(triggerRegex, (match, innerText) => translate(innerText));
    
    // Avoid unnecessary DOM changes
    if (newText === originalText) return;

    const newNode = document.createTextNode(newText);

    // To preserve the cursor position, we need to carefully replace the node
    // and then restore the selection.
    const parent = container.parentNode;
    parent.insertBefore(newNode, container);
    parent.removeChild(container);

    // Restore the cursor to the end of the newly created text node
    const newRange = document.createRange();
    newRange.setStart(newNode, newNode.length);
    newRange.setEnd(newNode, newNode.length);

    selection.removeAllRanges();
    selection.addRange(newRange);
  }
});

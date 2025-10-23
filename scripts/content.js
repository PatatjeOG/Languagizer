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

/**
 * The core handler for the input event.
 * It checks for the trigger pattern `!(...)` and replaces it.
 * @param {Event} event The input event object.
 */
function handleInput(event) {
  const target = event.target;
  if (!target) return;

  const triggerRegex = /!\(([^)]+)\)/g;

  // Handle standard <input> and <textarea> elements
  if (typeof target.value === 'string' && target.value.includes("!(")) {
    const originalValue = target.value;
    const newValue = originalValue.replace(triggerRegex, (match, innerText) => translate(innerText));

    if (originalValue !== newValue) {
      target.value = newValue;
    }
    return;
  }

  // Handle rich-text editors (contenteditable divs)
  if (target.isContentEditable && target.textContent.includes("!(")) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    if (container.nodeType !== Node.TEXT_NODE) return;

    const originalText = container.textContent;
    const newText = originalText.replace(triggerRegex, (match, innerText) => translate(innerText));
    if (newText === originalText) return;

    // To preserve cursor position, we replace the text node and restore the selection.
    const parent = container.parentNode;
    const newNode = document.createTextNode(newText);
    parent.insertBefore(newNode, container);
    parent.removeChild(container);

    const newRange = document.createRange();
    newRange.setStart(newNode, newNode.length);
    newRange.setEnd(newNode, newNode.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
}

/**
 * Attaches the input listener to a given root element (document or shadowRoot).
 * It also uses a MutationObserver to detect new elements being added to the DOM,
 * including web components that might have their own shadow DOM.
 * @param {Node} rootNode The node to attach listeners to.
 */
function attachListeners(rootNode) {
  // Listen for input on the root node itself
  rootNode.addEventListener("input", handleInput, { capture: true });
}

// Attach listeners to the main document to start
attachListeners(document);

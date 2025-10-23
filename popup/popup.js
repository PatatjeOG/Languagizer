// ---------- UTILITY ----------
function showMessage(text, type="info") {
  const el = document.getElementById("message");
  el.textContent = text;
  if (type === "error") {
    el.style.color = "#c62828"; // A high-contrast red for both themes
  } else {
    el.style.color = ""; // Reset color to let CSS handle it
  }
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ---------- DOM ----------
const vaultSelect = document.getElementById("vaultSelect");
const langNameInput = document.getElementById("langName");
const langAuthorInput = document.getElementById("langAuthor");
const importFile = document.getElementById("importFile");
const importVault = document.getElementById("importVault");
const activeLangDisplay = document.getElementById("activeLangDisplay");
const alphabetTable = document.getElementById("alphabetTable");
const decodeInput = document.getElementById("decodeInput");
const decodeOutput = document.getElementById("decodeOutput");

const letters = "abcdefghijklmnopqrstuvwxyz".split("");
let alphabetMap = {};
let types = {};

// ---------- LOAD TYPES DYNAMICALLY ----------
async function loadTypes() {
  types = {};
  const manifestUrl = chrome.runtime.getURL("types/types_manifest.json");
  try {
    const res = await fetch(manifestUrl);
    const typeFiles = await res.json(); // ["emoji","symbols","runes","math","ascii"]
    for (const t of typeFiles) {
      const url = chrome.runtime.getURL(`types/${t}.json`);
      try {
        const r = await fetch(url);
        const arr = await r.json();
        types[t] = { name: t.charAt(0).toUpperCase() + t.slice(1), symbols: arr };
      } catch (e) {
        console.warn(`Failed loading symbol set '${t}'.json:`, e);
        showMessage(`Could not load symbol set: ${t}`, "error");
      }
    }
    types["default"] = { name: "Default", symbols: [] };
  } catch (e) {
    console.error("Failed to load types_manifest.json", e);
    showMessage("Critical: Could not load symbol sets.", "error");
    types["default"] = { name: "Default", symbols: [] };
  }
}

// ---------- BUILD ALPHABET TABLE ----------
function buildAlphabetTable() {
  alphabetTable.innerHTML = "";
  letters.forEach(l => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${l}</td>
      <td>
        <select id="type_${l}"></select>
      </td>
      <td>
        <select id="symbol_${l}"></select>
      </td>
    `;
    alphabetTable.appendChild(tr);

    const typeSelect = document.getElementById(`type_${l}`);
    const symbolTd = document.getElementById(`symbol_${l}`).parentElement;

    // Populate type dropdown
    Object.keys(types).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = types[k].name;
      typeSelect.appendChild(opt);
    });

    const updateSymbolField = () => {
      const t = typeSelect.value;
      // Remove existing symbol input/select
      const old = document.getElementById(`symbol_${l}`);
      if (old) old.remove();
      if (t === "default") {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = `symbol_${l}`;
        inp.maxLength = 3;
        symbolTd.appendChild(inp);
      } else {
        const sel = document.createElement("select");
        sel.id = `symbol_${l}`;
        types[t].symbols.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s;
          sel.appendChild(opt);
        });
        symbolTd.appendChild(sel);
      }

      // Restore previous value if exists
      if (alphabetMap[l]) {
        const field = document.getElementById(`symbol_${l}`);
        field.value = alphabetMap[l].value;
      }
    };

    typeSelect.addEventListener("change", updateSymbolField);
    typeSelect.value = "default";
    updateSymbolField();
  });
}

// ---------- READ TABLE ----------
function saveTableToMap() {
  const map = {};
  letters.forEach(l => {
    const typeSelect = document.getElementById(`type_${l}`);
    const field = document.getElementById(`symbol_${l}`);
    // Sanitize the custom symbol value. If empty, default to the letter itself.
    const sanitizedValue = sanitize(field.value).trim();
    map[l] = { type: typeSelect.value, value: sanitizedValue || l };
  });
  alphabetMap = map;
  return map;
}

// ---------- LOAD TABLE ----------
function loadAlphabetMap(map) {
  letters.forEach(l => {
    if (!map[l]) return;
    const typeSelect = document.getElementById(`type_${l}`);
    typeSelect.value = map[l].type;
    typeSelect.dispatchEvent(new Event("change"));
    const field = document.getElementById(`symbol_${l}`);
    field.value = map[l].value;
  });
}

// ---------- CLEAR FORM ----------
function clearForm(clearAuthor = true) {
  langNameInput.value = "";
  if (clearAuthor) {
    langAuthorInput.value = "";
  }
  buildAlphabetTable(); // This resets the table to its default state
}

// ---------- VAULT ----------
async function getVault() {
  const result = await chrome.storage.local.get("vault");
  return result.vault || {};
}

async function saveVault(vault) {
  await chrome.storage.local.set({ vault });
}

/**
 * Refreshes the vault dropdown, populating it with saved languages.
 * @param {string | null} activeLangName The name of the language to set as active in the dropdown.
 */
async function refreshVaultDropdown(activeLangName = null) {
  vaultSelect.innerHTML = '<option value="">-- Select --</option>';
  const vault = await getVault();
  Object.keys(vault).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `${vault[name].name} (${vault[name].author || "?"})`;
    vaultSelect.appendChild(opt);
  });

  // Set the dropdown to the currently active language
  if (activeLangName && vault[activeLangName]) {
    vaultSelect.value = activeLangName;
  }
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
  await loadTypes();
  buildAlphabetTable();

  const res = await chrome.storage.sync.get(["langName", "langAuthor", "alphabetMap"]);

  // First, refresh the dropdown and set its value.
  await refreshVaultDropdown(res.langName);
  activeLangDisplay.textContent = `Active Language: ${res.langName || "None"}`;

  // Then, load all data into the form fields.
  if (res.langName) langNameInput.value = res.langName;
  if (res.langAuthor) langAuthorInput.value = res.langAuthor;
  if (res.alphabetMap) { alphabetMap = res.alphabetMap; loadAlphabetMap(alphabetMap); }
});

// ---------- SAVE ----------
document.getElementById("saveBtn").addEventListener("click", async () => {
  const name = langNameInput.value.trim();
  if (!name) return showMessage("Enter a language name", "error");
  const author = langAuthorInput.value.trim() || "Anonymous";

  const map = JSON.parse(JSON.stringify(saveTableToMap()));

  const validationResult = validateMapForDuplicates(map);
  if (!validationResult.isValid) {
    return showMessage(validationResult.message, "error");
  }

  const langData = { name, author, alphabetMap: map };

  await chrome.storage.sync.set({ langName: name, langAuthor: author, alphabetMap: map });

  const vault = await getVault();
  vault[name] = langData;
  await saveVault(vault);

  await refreshVaultDropdown(name); // Pass the current name to re-select it
  activeLangDisplay.textContent = `Active Language: ${name}`;
  showMessage(`Saved "${name}" to Vault`);
});

// ---------- DELETE ----------
document.getElementById("deleteBtn").addEventListener("click", async () => {
  const name = langNameInput.value.trim();
  if (!name) return showMessage("No language loaded to delete", "error");

  const vault = await getVault();
  if (!vault[name]) return showMessage(`Language "${name}" not in vault`, "error");

  if (!confirm(`Are you sure you want to delete the language "${name}"? This cannot be undone.`)) {
    return;
  }

  // Delete from vault
  delete vault[name];
  await saveVault(vault);

  // Check if it was the active language and clear sync storage if so
  const syncData = await chrome.storage.sync.get("langName");
  if (syncData.langName === name) {
    await chrome.storage.sync.remove(["langName", "langAuthor", "alphabetMap"]);
    // Ask if they want to clear the author field as well
    if (langAuthorInput.value && confirm(`Do you want to clear the author name "${langAuthorInput.value}" from this session?`)) {
      clearForm(true);
    } else {
      clearForm(false);
    }
  } else {
    clearForm(true); // If it wasn't the active language, just clear the whole form
  }
  activeLangDisplay.textContent = `Active Language: None`;

  await refreshVaultDropdown(null); // Refresh without a selection
  showMessage(`Deleted "${name}" from Vault`);
});

// ---------- LOAD LANGUAGE ----------
vaultSelect.addEventListener("change", async (e) => {
  const sel = e.target.value;
  if (!sel) return;
  const vault = await getVault();
  const lang = vault[sel];
  if (!lang) return;
  langNameInput.value = lang.name;
  langAuthorInput.value = lang.author || "";
  alphabetMap = JSON.parse(JSON.stringify(lang.alphabetMap)); // deep clone
  loadAlphabetMap(alphabetMap);
  await chrome.storage.sync.set({ langName: lang.name, langAuthor: lang.author, alphabetMap: lang.alphabetMap });
  activeLangDisplay.textContent = `Active Language: ${lang.name}`;
  showMessage(`Loaded "${lang.name}"`);
});

// ---------- EXPORT / IMPORT SINGLE ----------
document.getElementById("exportBtn").addEventListener("click", async () => {
  const name = langNameInput.value.trim();
  if (!name) return showMessage("No language selected", "error");
  const vault = await getVault();
  const lang = vault[name];
  if (!lang) return showMessage("Language not found", "error");
  const blob = new Blob([JSON.stringify(lang, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${name}.lngz`; a.click();
  URL.revokeObjectURL(url);
  showMessage(`Exported "${name}.lngz"`);
});

importFile.addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  const lang = JSON.parse(text); // JSON.parse is safe from XSS.
  const vault = await getVault();
  vault[lang.name] = lang;
  await saveVault(vault);
  await chrome.storage.sync.set({ langName: lang.name, langAuthor: lang.author, alphabetMap: lang.alphabetMap }); // Set imported language as active
  await refreshVaultDropdown(lang.name);
  showMessage(`Imported "${lang.name}"`);
});

// ---------- VAULT ZIP ----------
document.getElementById("exportVault").addEventListener("click", async () => {  const vault = await getVault();
  const keys = Object.keys(vault);
  if (!keys.length) return showMessage("Vault is empty", "error");

  const zip = new JSZip();
  for (const [name, lang] of Object.entries(vault)) zip.file(`${name}.lngz`, JSON.stringify(lang, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = "Languagizer_Vault.zip"; a.click(); URL.revokeObjectURL(url);
  showMessage(`Exported ${keys.length} languages to ZIP`);
});

importVault.addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  const zip = await JSZip.loadAsync(file);
  const vault = {};
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".lngz")) continue;
    const content = await zip.files[filename].async("string");
    const lang = JSON.parse(content); // JSON.parse is safe from XSS.
    vault[lang.name] = lang;
  }
  const existing = await getVault();
  await saveVault({ ...existing, ...vault });
  // Note: This does not set any imported language as active in sync storage.
  await refreshVaultDropdown(vaultSelect.value); // Re-select whatever was active before import
  showMessage(`Imported ${Object.keys(vault).length} languages from Vault ZIP`);
});

// ---------- DECODE ----------
document.getElementById("decodeBtn").addEventListener("click", async () => {
  const input = decodeInput.value;
  if (!input.trim()) return showMessage("Enter text to decode", "error");

  const res = await chrome.storage.sync.get(["alphabetMap"]);
  const map = res.alphabetMap || {};

  // Create a reverse map and a regex to find all symbols
  const reverseMap = {};
  const symbols = [];
  for (const [letter, entry] of Object.entries(map)) {
    if (entry.value && entry.value !== letter) {
      reverseMap[entry.value] = letter;
      // Escape special regex characters in the symbol
      symbols.push(entry.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }

  if (symbols.length === 0) {
    decodeOutput.value = input; // No map to decode with
    return showMessage("No active language map to decode with", "error");
  }

  const regex = new RegExp(symbols.join('|'), 'g');
  decodeOutput.value = input.replace(regex, (match) => reverseMap[match] || match);

  showMessage("Decoded successfully!");
});

// ---------- COPY DECODED TEXT ----------
document.getElementById("copyDecodedBtn").addEventListener("click", () => {
  const textToCopy = decodeOutput.value;
  if (!textToCopy) {
    return showMessage("Nothing to copy", "error");
  }

  navigator.clipboard.writeText(textToCopy).then(() => {
    showMessage("Copied to clipboard!");
  }).catch(err => {
    console.error("Clipboard write failed: ", err);
    showMessage("Failed to copy text", "error");
  });
});

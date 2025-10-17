// ---------- UTILITY ----------
function showMessage(text, type="info") {
  const el = document.getElementById("message");
  el.textContent = text;
  el.style.color = type === "error" ? "#b33" : "#333";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ---------- DOM ----------
const vaultSelect = document.getElementById("vaultSelect");
const langNameInput = document.getElementById("langName");
const langAuthorInput = document.getElementById("langAuthor");
const importFile = document.getElementById("importFile");
const importVault = document.getElementById("importVault");
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
        console.warn("Failed loading type", t, e);
      }
    }
    types["default"] = { name: "Default", symbols: [] };
  } catch (e) {
    console.error("Failed to load types_manifest.json", e);
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
    map[l] = { type: typeSelect.value, value: field.value || l };
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

// ---------- VAULT ----------
function refreshVaultDropdown() {
  vaultSelect.innerHTML = '<option value="">-- Select --</option>';
  chrome.storage.local.get("vault", res => {
    const vault = res.vault || {};
    Object.keys(vault).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${vault[name].name} (${vault[name].author || "?"})`;
      vaultSelect.appendChild(opt);
    });
  });
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
  await loadTypes();
  buildAlphabetTable();
  refreshVaultDropdown();
  chrome.storage.sync.get(["langName", "langAuthor", "alphabetMap"], res => {
    if (res.langName) langNameInput.value = res.langName;
    if (res.langAuthor) langAuthorInput.value = res.langAuthor;
    if (res.alphabetMap) { alphabetMap = res.alphabetMap; loadAlphabetMap(alphabetMap); }
  });
});

// ---------- SAVE ----------
document.getElementById("saveBtn").addEventListener("click", () => {
  const name = langNameInput.value.trim();
  if (!name) return showMessage("Enter a language name", "error");
  const author = langAuthorInput.value.trim() || "Anonymous";

  // Deep clone to prevent overwriting previous saved objects
  const map = JSON.parse(JSON.stringify(saveTableToMap()));
  const langData = { name, author, alphabetMap: map };

  chrome.storage.sync.set(langData);

  chrome.storage.local.get("vault", res => {
    const vault = res.vault || {};
    vault[name] = langData; // independent copy for each dictionary
    chrome.storage.local.set({ vault }, () => {
      refreshVaultDropdown();
      showMessage(`Saved "${name}" to Vault`);
    });
  });
});

// ---------- LOAD LANGUAGE ----------
vaultSelect.addEventListener("change", e => {
  const sel = e.target.value;
  if (!sel) return;
  chrome.storage.local.get("vault", res => {
    const vault = res.vault || {};
    const lang = vault[sel];
    if (!lang) return;
    langNameInput.value = lang.name;
    langAuthorInput.value = lang.author || "";
    alphabetMap = JSON.parse(JSON.stringify(lang.alphabetMap)); // deep clone
    loadAlphabetMap(alphabetMap);
    chrome.storage.sync.set(lang);
    showMessage(`Loaded "${lang.name}"`);
  });
});

// ---------- EXPORT / IMPORT SINGLE ----------
document.getElementById("exportBtn").addEventListener("click", () => {
  const name = langNameInput.value.trim();
  if (!name) return showMessage("No language selected", "error");
  chrome.storage.local.get("vault", res => {
    const vault = res.vault || {};
    const lang = vault[name];
    if (!lang) return showMessage("Language not found", "error");
    const blob = new Blob([JSON.stringify(lang, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.lngz`; a.click();
    URL.revokeObjectURL(url);
    showMessage(`Exported "${name}.lngz"`);
  });
});

importFile.addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  const lang = JSON.parse(text);
  chrome.storage.local.get("vault", res => {
    const vault = res.vault || {};
    vault[lang.name] = lang;
    chrome.storage.local.set({ vault }, () => {
      refreshVaultDropdown();
      showMessage(`Imported "${lang.name}"`);
    });
  });
});

// ---------- VAULT ZIP ----------
document.getElementById("exportVault").addEventListener("click", async () => {
  chrome.storage.local.get("vault", async res => {
    const vault = res.vault || {};
    const keys = Object.keys(vault);
    if (!keys.length) return showMessage("Vault is empty", "error");

    const zip = new JSZip();
    for (const [name, lang] of Object.entries(vault)) zip.file(`${name}.lngz`, JSON.stringify(lang, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = "Languagizer_Vault.zip"; a.click(); URL.revokeObjectURL(url);
    showMessage(`Exported ${keys.length} languages to ZIP`);
  });
});

importVault.addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  const zip = await JSZip.loadAsync(file);
  const vault = {};
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".lngz")) continue;
    const content = await zip.files[filename].async("string");
    const lang = JSON.parse(content);
    vault[lang.name] = lang;
  }
  chrome.storage.local.get("vault", res => {
    const existing = res.vault || {};
    chrome.storage.local.set({ vault: { ...existing, ...vault } }, () => {
      refreshVaultDropdown();
      showMessage(`Imported ${Object.keys(vault).length} languages from Vault ZIP`);
    });
  });
});

// ---------- DECODE ----------
document.getElementById("decodeBtn").addEventListener("click", () => {
  const input = decodeInput.value;
  if (!input.trim()) return showMessage("Enter text to decode", "error");
  chrome.storage.sync.get(["alphabetMap"], res => {
    const map = res.alphabetMap || {};
    const reverse = Object.fromEntries(Object.entries(map).map(([k, v]) => [v.value, k]));
    decodeOutput.value = input.split("").map(c => reverse[c] || c).join("");
    showMessage("Decoded successfully!");
  });
});

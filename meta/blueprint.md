# Project Blueprint

This document outlines the structure and purpose of the key files in the Languagizer extension.

## 📂 File Structure

-   **`manifest.json`**: The core configuration file for the browser extension. It defines permissions, scripts, and the popup.
-   **`popup.html`**: The HTML structure for the main user interface that appears when the extension icon is clicked.
-   **`popup.css`**: The stylesheet for `popup.html`, including dark mode support.
-   **`popup.js`**: The main JavaScript logic for the popup. It handles all user interactions, saving/loading languages, and managing the vault.
-   **`content.js`**: A content script that runs on webpages. It listens for the `!(...)` trigger in input fields and performs the translation.
-   **`LICENSE`**: The MIT License file, defining the open-source terms for the project.
-   **`README.md`**: The main documentation file for the GitHub repository.

### `/lib`
-   **`jszip.min.js`**: A third-party library used for creating and reading ZIP files for the vault import/export feature.

### `/meta`
-   **`about.html`**, **`policy.html`**, **`terms.html`**: Static pages providing information about the extension.
-   **`meta.css`**: A shared stylesheet for the static meta pages.

### `/types`
-   **`types_manifest.json`**: A manifest listing all available character type files (e.g., `symbols.json`, `runes.json`).
-   **`*.json`**: JSON files containing arrays of characters for the different alphabet types.
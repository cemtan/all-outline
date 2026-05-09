# 📌 Outline for All Files

**Outline for All Files** is an Obsidian plugin that provides a **single, unified outline panel** for both **Markdown notes and PDF documents**.

Unlike Obsidian’s built‑in Outline (Markdown‑only) or the default PDF outline view, this plugin automatically detects the active file and always shows the **correct outline without extra clicks**.

**Plugin ID:** `all-outline`

---

## ✨ Features

- ✅ One unified outline panel for **Markdown and PDF**
- ✅ Automatically switches outline when changing files
- ✅ **PDF navigation is heading-based**, not page-based
- ✅ PDF headings scroll with the **heading aligned to the top of the page**
- ✅ Nested headings / bookmarks (tree view)
- ✅ Search within outline titles
- ✅ Expand / collapse all sections
- ✅ Optional page number badges for PDF files
- ✅ Remembers expand/collapse state per file
- ✅ Stable behavior when switching between PDF ↔ Markdown (no stale outlines)

---

## 📄 Supported File Types

### Markdown (`.md`)
- Outline is built from real Markdown headings (`#`, `##`, `###`, …)
- Updates dynamically when the note content changes

### PDF (`.pdf`)
- Uses PDF bookmarks / table of contents
- Navigates using **precise PDF offsets**
- When offset information exists, the selected heading appears at the **top of the page**
- Gracefully falls back when a PDF does not provide exact coordinates

---

## 🧭 Navigation Behavior

### Markdown Navigation
- Clicking an outline item moves the cursor to the correct section
- The editor scrolls to the relevant heading for immediate reading

### PDF Navigation
- Clicking an outline item navigates via **Obsidian PDF deep links**
- Uses heading offsets when available instead of only page numbers
- Ensures headings are positioned at the **top of the PDF page**, not centered

---

## 🖥️ User Experience

- Behaves like a native Obsidian side panel
- Instantly refreshes when switching files:
  - PDF → Markdown ✅
  - Markdown → PDF ✅
- No double-click requirement
- No leftover outline from the previously opened file

---

## ⚙️ Settings

The plugin includes the following configuration options:

- **Hide built‑in PDF sidebar**
  Hides the default PDF thumbnails / TOC panel for a cleaner reading area

- **Show PDF page number badges**
  Displays page numbers next to PDF outline items

- **Expand all on file open**
  Automatically expands all outline sections when opening a file

- **Remember expansion state per file**
  Saves expanded / collapsed state individually for each file

- **Offset Top Padding (PDF fine‑tuning)**
  Adds a small adjustment to PDF navigation in case a heading appears slightly lower than desired
  (useful for certain PDFs)

---

## 🧠 Why “Outline for All Files”?

Obsidian currently separates outlines by file type:

- Markdown → Core Outline plugin
- PDFs → Embedded PDF outline inside the viewer

**Outline for All Files** unifies this experience by providing:

- One consistent outline location
- Seamless navigation across file types
- PDF behavior that feels closer to Markdown navigation

---

## 🛠️ Installation

### Manual Installation

1. Download the plugin files
2. Create the following folder:
3. Place these files inside:
- `main.js`
- `manifest.json`
- `styles.css`
4. Enable **Outline for All Files** in Obsidian’s Community Plugins settings

---

## 🚧 Known Limitations

- PDF outlines depend on the quality of bookmarks provided by the PDF
- PDFs without bookmarks cannot generate an outline
- Some PDFs may require adjusting **Offset Top Padding** for perfect alignment

---

## 📦 Plugin Information

- **Name:** Outline for All Files
- **ID:** `all-outline`
- **Category:** Navigation / Productivity
- **Scope:** Markdown + PDF

---

## 🙌 Credits

- Built with the Obsidian Plugin API
- Inspired by Obsidian’s core Outline plugin and community PDF tools
- Designed for users who frequently work with **long documents and mixed file types**

---

## 💬 Feedback & Contributions

Bug reports, feature requests, and contributions are welcome.
Feel free to open an issue or submit a pull request.

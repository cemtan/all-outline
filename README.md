📌 Outline for All Files
======================

**Outline for All Files** is an Obsidian plugin that provides a **single, unified outline panel**
for both **Markdown notes** and **PDF documents**.

Unlike Obsidian’s built-in Outline (Markdown-only) or the default PDF outline view,
this plugin automatically adapts to the active file and always shows the correct outline —
**no extra clicks, no stale state, no confusion**.

---

✨ Features
----------

✅ One unified outline panel for **Markdown + PDF**  
✅ Automatically updates when switching files  
✅ Markdown outline built from real headings (`#`, `##`, `###`, …)  
✅ PDF outline based on bookmarks / table of contents  
✅ Precise PDF navigation using offsets when available  
✅ Selected heading is always **clearly highlighted**  
✅ No selection loss when switching files  
✅ No indentation jump on selection  
✅ Page number badges (optional, right-aligned)  
✅ Expand / collapse all sections  
✅ Search within outline titles  
✅ Remembers expand / collapse state **per file**  
✅ Stable behavior when switching **MD ↔ PDF rapidly**

---

📄 Supported File Types
----------------------

### Markdown (`.md`)
- Outline is built from actual Markdown headings
- Updates dynamically when the note content changes
- Clicking an item moves the cursor and scrolls to the correct heading

### PDF (`.pdf`)
- Uses PDF bookmarks / outline if available
- Navigates with deep links (`#page=&offset=`)
- Headings are aligned to the **top of the page** when possible
- Gracefully falls back when precise offsets are not provided

---

🧭 Navigation Behavior
---------------------

### Markdown
- Jump to heading
- Cursor positioned correctly
- No selection flicker or loss

### PDF
- Jump via Obsidian PDF deep-linking
- Supports page + offset + zoom
- Designed for reading, not thumbnails

---

⚙️ Settings
-----------

- **Hide built-in PDF sidebar**  
  Hides Obsidian’s default PDF TOC / thumbnails panel

- **Show PDF page number badges**  
  Displays page numbers next to PDF outline items (aligned to the right)

- **Expand all on file open**

- **Remember expansion state per file**

- **Offset Top Padding (PDF fine-tuning)**  
  Small vertical adjustment if a PDF heading lands slightly too low

---

🧠 Why “Outline for All Files”?
-------------------------------

Obsidian already has:
- A great Markdown outline ✅
- A separate PDF outline ✅

But switching between them breaks flow.

**Outline for All Files** solves this by behaving like a **native panel** that “just works”
for *whatever file is active* — Markdown or PDF.

---

🛠 Installation
---------------

### Community Plugins (recommended)
1. Open **Settings → Community plugins**
2. Search for **Outline for All Files**
3. Install & enable

### Manual Installation
Copy these files into .vault/.obsidian/plugins/all-outline/
- `main.js`
- `styles.css`
- `manifest.json`

Reload Obsidian.

---

📜 License
----------

MIT License

---

Made with care for people who actually live in their outlines.

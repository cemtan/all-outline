/* eslint-disable no-console */
const { Plugin, ItemView, Setting, setIcon, Notice } = require("obsidian");

const VIEW_TYPE = "unified-outline-view";

const DEFAULT_SETTINGS = {
  hideBuiltinPdfSidebar: true,
  showPageBadges: true,
  expandAllOnLoad: false,
  rememberExpansionPerFile: true,
  offsetTopPadding: 0
};

function isPdfFile(file) {
  return !!file && file.extension && file.extension.toLowerCase() === "pdf";
}
function isMdFile(file) {
  return !!file && file.extension && file.extension.toLowerCase() === "md";
}
function safeText(s) {
  return (s ?? "").toString();
}

/* =========================
   PDF.JS LOADING + PARSING
   ========================= */

async function getPdfJsLib() {
  if (window.pdfjsLib) return window.pdfjsLib;

  try {
    const obs = require("obsidian");
    if (typeof obs.loadPdfJs === "function") {
      const out = await obs.loadPdfJs();
      if (out && out.pdfjsLib) return out.pdfjsLib;
      if (out && out.getDocument) return out;
    }
  } catch (_) {}

  throw new Error("PDF.js (pdfjsLib) not available. Obsidian build may have changed.");
}

async function normalizeDest(pdf, dest) {
  let d = dest;
  if (!d) return null;
  if (typeof d === "string") d = await pdf.getDestination(d);
  if (!d || !Array.isArray(d) || !d.length) return null;
  return d;
}

function extractOffsetFromDestArray(destArray) {
  const type = destArray[1] && destArray[1].name ? destArray[1].name : null;
  let left = null, top = null, zoom = null;

  if (type === "XYZ") {
    left = destArray[2] ?? null;
    top  = destArray[3] ?? null;
    zoom = destArray[4] ?? null;
  } else if (type === "FitH") {
    top = destArray[2] ?? null;
  } else if (type === "FitV") {
    left = destArray[2] ?? null;
  }
  return { left, top, zoom, type };
}

async function resolveDestToTarget(pdf, dest) {
  try {
    const destArray = await normalizeDest(pdf, dest);
    if (!destArray) return { page: null, left: null, top: null, zoom: null };

    const ref = destArray[0];
    if (!ref) return { page: null, left: null, top: null, zoom: null };

    const pageIndex = await pdf.getPageIndex(ref); // 0-based
    const page = pageIndex + 1; // 1-based

    const { left, top, zoom } = extractOffsetFromDestArray(destArray);
    return { page, left, top, zoom };
  } catch (_) {
    return { page: null, left: null, top: null, zoom: null };
  }
}

async function parsePdfOutline(app, file) {
  const pdfjsLib = await getPdfJsLib();
  const data = await app.vault.readBinary(file);
  const uint8 = new Uint8Array(data);

  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;

  const outline = await pdf.getOutline();
  if (!outline || !outline.length) return [];

  function makeId(pathTitles, page) {
    const base = pathTitles.join(" / ").slice(0, 300);
    return `${base}@@${page ?? "?"}`;
  }

  async function convert(items, parentPath) {
    const out = [];
    for (const it of items) {
      const title = safeText(it.title).trim() || "(untitled)";
      const target = await resolveDestToTarget(pdf, it.dest);
      const path = parentPath.concat([title]);

      const node = {
        kind: "pdf",
        title,
        page: target.page,
        left: target.left,
        top: target.top,
        zoom: target.zoom,
        id: makeId(path, target.page),
        children: []
      };

      if (it.items && it.items.length) node.children = await convert(it.items, path);
      out.push(node);
    }
    return out;
  }

  return await convert(outline, []);
}

/* =========================
   MARKDOWN OUTLINE
   ========================= */

function buildMdOutlineFromCache(filePath, cache) {
  const headings = cache?.headings || [];
  if (!headings.length) return [];

  const root = [];
  const stack = [];

  for (const h of headings) {
    const title = safeText(h.heading).trim() || "(untitled)";
    const level = Number(h.level) || 1;

    const node = {
      kind: "md",
      title,
      level,
      id: `${filePath}@@${level}@@${title}@@${h.position?.start?.line ?? "?"}@@${h.position?.start?.col ?? "?"}`,
      pos: h.position || null,
      children: []
    };

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (!stack.length) root.push(node);
    else stack[stack.length - 1].node.children.push(node);

    stack.push({ level, node });
  }
  return root;
}

/* =========================
   LEAF HELPERS
   ========================= */

function findLeafForFile(app, file, preferredLeaf) {
  if (preferredLeaf?.view?.file?.path === file.path) return preferredLeaf;

  let found = null;
  if (typeof app.workspace.iterateAllLeaves === "function") {
    app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      try {
        if (leaf?.view?.file?.path === file.path) found = leaf;
      } catch (_) {}
    });
  }
  return found;
}

/* =========================
   PDF NAVIGATION (YOUR WORKING METHOD)
   ========================= */

async function jumpToPdfTarget(app, file, target, preferredLeaf, offsetTopPadding) {
  const page = target?.page;
  if (!page) return;

  const hasAnyOffset =
    (target.left !== null && target.left !== undefined) ||
    (target.top !== null && target.top !== undefined) ||
    (target.zoom !== null && target.zoom !== undefined);

  let linkText;
  if (hasAnyOffset) {
    const left = (target.left ?? 0);
    const baseTop = (target.top ?? 0);
    const top = baseTop + (Number.isFinite(offsetTopPadding) ? offsetTopPadding : 0);
    const zoom = (target.zoom ?? 0);
    linkText = `${file.path}#page=${page}&offset=${left},${top},${zoom}`;
  } else {
    linkText = `${file.path}#page=${page}`;
  }

  const targetLeaf = findLeafForFile(app, file, preferredLeaf) || app.workspace.getLeaf(false);

  try {
    if (targetLeaf && typeof targetLeaf.openLinkText === "function") {
      await targetLeaf.openLinkText(linkText, file.path, false);
      return;
    }
  } catch (_) {}

  try {
    if (app.workspace && typeof app.workspace.openLinkText === "function") {
      await app.workspace.openLinkText(linkText, file.path, false);
      return;
    }
  } catch (_) {}

  new Notice("PDF konumuna gidilemedi (offset/deep-link).");
}

/* =========================
   MD NAVIGATION (simple)
   ========================= */

async function jumpToMdInPlace(app, file, node, preferredLeaf) {
  const leaf = findLeafForFile(app, file, preferredLeaf) || app.workspace.getLeaf(false);

  try {
    if (leaf?.view?.file?.path !== file.path && typeof leaf.openFile === "function") {
      await leaf.openFile(file, { active: false });
    }
  } catch (_) {}

  const editor = leaf?.view?.editor;
  const pos = node?.pos?.start;
  if (!editor || !pos) return;

  editor.setCursor({ line: pos.line, ch: pos.col ?? 0 });
  if (typeof editor.scrollIntoView === "function") {
    const cur = editor.getCursor();
    editor.scrollIntoView({ from: cur, to: cur }, true);
  }
  editor.focus?.();
}

/* =========================
   UNIFIED OUTLINE VIEW
   ========================= */

class UnifiedOutlineView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.kind = null;
    this.outline = [];
    this.expanded = new Set();
    this.activeId = null;
    this.filterText = "";
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Outline"; }
  getIcon() { return "list-tree"; }

  async onOpen() { this.render(); }

  setData(file, kind, outline) {
    this.file = file;
    this.kind = kind;
    this.outline = outline || [];

    this.expanded = new Set();
    if (this.plugin.settings.rememberExpansionPerFile && file) {
      const saved = this.plugin.expansionState[file.path];
      if (Array.isArray(saved)) for (const id of saved) this.expanded.add(id);
    }

    if (this.plugin.settings.expandAllOnLoad) this.expandAll();

    this.activeId = null;
    this.renderBody();
  }

  persistExpansion() {
    if (!this.file) return;
    if (!this.plugin.settings.rememberExpansionPerFile) return;
    this.plugin.expansionState[this.file.path] = Array.from(this.expanded);
    this.plugin.saveExpansionStateDebounced();
  }

  expandAll() {
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.children?.length) {
          this.expanded.add(n.id);
          walk(n.children);
        }
      }
    };
    walk(this.outline);
  }

  collapseAll() { this.expanded.clear(); }

  render() {
    this.contentEl.empty();
    this.rootEl = this.contentEl.createDiv({ cls: "pdf-outline-right-view" });

    const header = this.rootEl.createDiv({ cls: "pdf-outline-right-header" });
    header.createDiv({ cls: "pdf-outline-right-title", text: "Outline" });

    const searchWrap = header.createDiv({ cls: "outline-search-wrap" });
    this.searchEl = searchWrap.createEl("input", { type: "search", placeholder: "Başlık ara…" });
    this.searchEl.className = "outline-search";
    this.searchEl.addEventListener("input", () => {
      this.filterText = (this.searchEl.value || "").toLowerCase();
      this.renderBody();
    });

    const actions = header.createDiv({ cls: "pdf-outline-right-actions" });

    const btnExpand = actions.createEl("button", { text: "Hepsini Aç" });
    btnExpand.classList.add("mod-cta");
    btnExpand.addEventListener("click", () => {
      this.expandAll(); this.persistExpansion(); this.renderBody();
    });

    const btnCollapse = actions.createEl("button", { text: "Hepsini Kapat" });
    btnCollapse.addEventListener("click", () => {
      this.collapseAll(); this.persistExpansion(); this.renderBody();
    });

    this.bodyEl = this.rootEl.createDiv({ cls: "pdf-outline-right-body" });
    this.renderBody();
  }

  renderBody() {
    if (!this.bodyEl) return;
    this.bodyEl.empty();

    if (!this.file) {
      this.bodyEl.createDiv({ cls: "setting-item-description", text: "Bir dosya açıldığında outline burada görünecek." });
      return;
    }
    if (!this.outline?.length) {
      this.bodyEl.createDiv({ cls: "setting-item-description", text: "Bu dosyada başlık/outline bulunamadı." });
      return;
    }

    const filterLower = (this.filterText || "").trim().toLowerCase();
    const matches = (node) => {
      if (!filterLower) return true;
      if (node.title.toLowerCase().includes(filterLower)) return true;
      return (node.children || []).some(matches);
    };

    const tree = this.bodyEl.createDiv({ cls: "tree-item-children" });

    const renderNodes = (parentEl, nodes) => {
      for (const node of nodes) {
        if (!matches(node)) continue;

        const hasChildren = node.children && node.children.length;
        const isExpanded = this.expanded.has(node.id) || (!!filterLower && hasChildren);

        const itemEl = parentEl.createDiv({ cls: "tree-item" });
        const selfEl = itemEl.createDiv({ cls: "tree-item-self is-clickable" });
        if (this.activeId === node.id) selfEl.classList.add("is-active");

        const iconEl = selfEl.createDiv({ cls: "tree-item-icon" });
        if (hasChildren) {
          setIcon(iconEl, "chevron-right");
          iconEl.style.transform = isExpanded ? "rotate(90deg)" : "rotate(0deg)";
          iconEl.style.transition = "transform 120ms ease";
          iconEl.addEventListener("click", (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            if (this.expanded.has(node.id)) this.expanded.delete(node.id);
            else this.expanded.add(node.id);
            this.persistExpansion();
            this.renderBody();
          });
        } else {
          iconEl.style.width = "18px";
          iconEl.style.opacity = "0.25";
        }

        const innerEl = selfEl.createDiv({ cls: "tree-item-inner" });
        innerEl.setText(node.title);

        if (this.plugin.settings.showPageBadges && node.kind === "pdf" && node.page) {
          const badge = selfEl.createSpan({ cls: "pdf-outline-page tag" });
          badge.setText(String(node.page));
        }

        selfEl.addEventListener("click", async () => {
          this.activeId = node.id;
          this.renderBody();

          const contentLeaf = this.plugin.lastContentLeaf || findLeafForFile(this.app, this.file);
          if (node.kind === "pdf") {
            await jumpToPdfTarget(
              this.app,
              this.file,
              { page: node.page, left: node.left, top: node.top, zoom: node.zoom },
              contentLeaf,
              this.plugin.settings.offsetTopPadding
            );
          } else if (node.kind === "md") {
            await jumpToMdInPlace(this.app, this.file, node, contentLeaf);
          }
        });

        if (hasChildren && isExpanded) {
          const childrenEl = itemEl.createDiv({ cls: "tree-item-children" });
          renderNodes(childrenEl, node.children);
        }
      }
    };

    renderNodes(tree, this.outline);
  }
}

/* =========================
   SETTINGS TAB
   ========================= */

class UnifiedOutlineSettingTab {
  constructor(app, plugin) { this.app = app; this.plugin = plugin; }

  display(containerEl) {
    containerEl.empty();
    containerEl.createEl("h3", { text: "Unified Outline (MD + PDF)" });

    new Setting(containerEl)
      .setName("PDF'in sol TOC/Sidebar alanını gizle")
      .addToggle((t) => {
        t.setValue(this.plugin.settings.hideBuiltinPdfSidebar);
        t.onChange(async (v) => {
          this.plugin.settings.hideBuiltinPdfSidebar = v;
          this.plugin.applyBodyClass();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Sayfa numarası rozetini göster")
      .addToggle((t) => {
        t.setValue(this.plugin.settings.showPageBadges);
        t.onChange(async (v) => {
          this.plugin.settings.showPageBadges = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Offset Top Padding (ince ayar)")
      .addText((t) => {
        t.setPlaceholder("0")
          .setValue(String(this.plugin.settings.offsetTopPadding ?? 0))
          .onChange(async (val) => {
            const n = Number(val);
            this.plugin.settings.offsetTopPadding = Number.isFinite(n) ? n : 0;
            await this.plugin.saveSettings();
          });
      });
  }
}

/* =========================
   PLUGIN
   ========================= */

module.exports = class UnifiedOutlinePlugin extends Plugin {
  async onload() {
    const loaded = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    this.expansionState = loaded._expansionState ? loaded._expansionState : {};
    this.lastContentLeaf = null;

    // race guards
    this._updateToken = 0;
    this._lastRequestedPath = null;

    this._saveTimer = null;
    this.saveExpansionStateDebounced = () => {
      window.clearTimeout(this._saveTimer);
      this._saveTimer = window.setTimeout(() => this.saveSettings(), 400);
    };

    this.registerView(VIEW_TYPE, (leaf) => new UnifiedOutlineView(leaf, this));
    this.addSettingTab(new UnifiedOutlineSettingTab(this.app, this));

    // active leaf change (ignore our view)
    this.registerEvent(this.app.workspace.on("active-leaf-change", async (leaf) => {
      const vt = leaf?.view?.getViewType?.();
      if (vt === VIEW_TYPE) return;

      if (leaf?.view?.file) this.lastContentLeaf = leaf;

      // pass leaf file explicitly
      const file = leaf?.view?.file || null;
      if (file) await this.requestUpdate(file, leaf);
    }));

    // file-open: schedule to next tick to avoid timing issues 【2-dd7497】【1-e4a638】
    this.registerEvent(this.app.workspace.on("file-open", async (file) => {
      if (!file) return;

      const leaf = (this.app.workspace.activeLeaf?.view?.getViewType?.() !== VIEW_TYPE)
        ? this.app.workspace.activeLeaf
        : this.lastContentLeaf;

      window.setTimeout(() => {
        this.requestUpdate(file, leaf);
      }, 0);
    }));

    // metadata changed: refresh md when active md changes
    this.registerEvent(this.app.metadataCache.on("changed", async (file) => {
      const active = this.app.workspace.getActiveFile?.();
      if (active && file && active.path === file.path && isMdFile(active)) {
        const leaf = (this.app.workspace.activeLeaf?.view?.getViewType?.() !== VIEW_TYPE)
          ? this.app.workspace.activeLeaf
          : this.lastContentLeaf;

        window.setTimeout(() => this.requestUpdate(active, leaf), 0);
      }
    }));

    this.app.workspace.onLayoutReady(async () => {
      await this.activateView();
      this.applyBodyClass();

      const leaf = this.app.workspace.activeLeaf;
      const vt = leaf?.view?.getViewType?.();
      if (leaf?.view?.file && vt !== VIEW_TYPE) this.lastContentLeaf = leaf;

      const f = this.app.workspace.getActiveFile?.();
      if (f) await this.requestUpdate(f, leaf);
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    this.removeBodyClass();
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      try { leaf = this.app.workspace.getRightLeaf(false); } catch (_) { leaf = null; }
    }
    if (!leaf) leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: false });
  }

  // Only return our real view instance (prevents setData errors)
  async getView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (!leaves || !leaves.length) return null;

    for (const leaf of leaves) {
      const v = leaf.view;
      if (
        v &&
        typeof v.getViewType === "function" &&
        v.getViewType() === VIEW_TYPE &&
        typeof v.setData === "function"
      ) return v;
    }
    return null;
  }

  async ensureView() {
    let view = await this.getView();
    if (view) return view;
    await this.activateView();
    return await this.getView();
  }

  // “last request wins” wrapper (prevents PDF parse finishing late and overwriting MD)
  async requestUpdate(file, leaf) {
    if (!file?.path) return;

    this._updateToken += 1;
    const token = this._updateToken;
    this._lastRequestedPath = file.path;

    await this.updateForFile(file, leaf, token);
  }

  async updateForFile(file, leaf, token) {
    const view = await this.ensureView();
    if (!view) return;

    // if a newer request came in, stop
    if (token !== this._updateToken) return;
    if (file.path !== this._lastRequestedPath) return;

    if (isMdFile(file)) {
      const cache = this.app.metadataCache.getFileCache(file);
      const outline = buildMdOutlineFromCache(file.path, cache);

      if (token !== this._updateToken) return;
      if (file.path !== this._lastRequestedPath) return;

      view.setData(file, "md", outline);
      return;
    }

    if (isPdfFile(file)) {
      try {
        const outline = await parsePdfOutline(this.app, file);

        if (token !== this._updateToken) return;
        if (file.path !== this._lastRequestedPath) return;

        view.setData(file, "pdf", outline);
      } catch (e) {
        console.error("[unified-outline] pdf outline parse failed:", e);
        if (token !== this._updateToken) return;
        if (file.path !== this._lastRequestedPath) return;
        view.setData(file, "pdf", []);
      }
      return;
    }

    view.setData(file, "other", []);
  }

  applyBodyClass() {
    const cls = "pdf-outline-right-hide";
    if (this.settings.hideBuiltinPdfSidebar) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
  }

  removeBodyClass() {
    document.body.classList.remove("pdf-outline-right-hide");
  }

  async saveSettings() {
    const payload = Object.assign({}, this.settings, { _expansionState: this.expansionState });
    await this.saveData(payload);
  }
};

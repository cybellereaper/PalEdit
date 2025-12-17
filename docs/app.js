const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const editor = document.getElementById("editor");
const lineNumbers = document.getElementById("line-numbers");
const statusEl = document.getElementById("status");
const formatBtn = document.getElementById("format-btn");
const minifyBtn = document.getElementById("minify-btn");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const clearBtn = document.getElementById("clear-btn");

const STORAGE_KEY = "paledit-pages-json";
const FILENAME_KEY = "paledit-pages-filename";
const FALLBACK_FILENAME = "paledit-save.json";

const SAMPLE_JSON = `{
  "metadata": {
    "note": "Sample PalEdit export for GitHub Pages",
    "updatedAt": "2024-01-01T12:00:00Z",
    "version": 1
  },
  "player": {
    "name": "Explorer",
    "level": 12,
    "location": {
      "x": 120.4,
      "y": 87.6,
      "z": -32.1
    }
  },
  "pals": [
    {
      "id": "pal-001",
      "species": "Lamball",
      "nickname": "Lucky",
      "level": 5,
      "gender": "Female"
    },
    {
      "id": "pal-002",
      "species": "Foxparks",
      "nickname": "Ember",
      "level": 7,
      "gender": "Male"
    }
  ]
}`;

const state = {
  filename: FALLBACK_FILENAME,
};

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function lineCount(text) {
  return Math.max(1, text.split(/\r?\n/).length);
}

function renderLines(text) {
  const lines = lineCount(text);
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => `${i + 1}`.padStart(3, " ")).join("\n");
  lineNumbers.style.height = `${editor.scrollHeight}px`;
  lineNumbers.scrollTop = editor.scrollTop;
}

function lintJSON(raw, { compact = false } = {}) {
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed, compact ? null : 2);
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, editor.value);
    localStorage.setItem(FILENAME_KEY, state.filename);
  } catch (err) {
    // Ignore storage issues (private mode, disabled storage, etc.)
  }
}

function applyText(text, sourceLabel = "editor") {
  editor.value = text;
  renderLines(text);
  persistState();
  const lines = lineCount(text);
  setStatus(`${sourceLabel}: ${lines} lines ready`, "success");
}

function restoreFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedName = localStorage.getItem(FILENAME_KEY);
    if (storedName) {
      state.filename = storedName;
    }
    if (stored) {
      applyText(stored, "Restored previous session");
      return;
    }
  } catch (err) {
    // Continue with sample data
  }
  state.filename = FALLBACK_FILENAME;
  applyText(SAMPLE_JSON, "Loaded starter save");
  setStatus("Drop a Palworld JSON export to begin", "info");
}

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".json")) {
    setStatus("Only .json save exports are supported on Pages", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const formatted = lintJSON(String(reader.result));
      state.filename = file.name.replace(/\s+/g, "_") || FALLBACK_FILENAME;
      applyText(formatted, `Loaded ${state.filename}`);
    } catch (err) {
      setStatus(`Invalid JSON: ${err.message}`, "error");
    }
  };
  reader.readAsText(file);
}

function downloadFile() {
  try {
    const validated = lintJSON(editor.value || "{}");
    const blob = new Blob([validated], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = state.filename.toLowerCase().endsWith(".json")
      ? state.filename
      : `${state.filename.replace(/\s+/g, "_") || "paledit-save"}.json`;
    link.href = url;
    link.download = safeName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${safeName}`, "success");
  } catch (err) {
    setStatus(`Cannot download: ${err.message}`, "error");
  }
}

function copyToClipboard() {
  const text = editor.value || "";
  if (!navigator.clipboard) {
    setStatus("Clipboard access is not available in this browser", "error");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => setStatus("Copied JSON to clipboard", "success"))
    .catch(() => setStatus("Clipboard copy failed", "error"));
}

function wireDropzone() {
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("active");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("active");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("active");
    const [file] = event.dataTransfer.files;
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) handleFile(file);
  });
}

function wireEditor() {
  editor.addEventListener("input", () => {
    renderLines(editor.value);
    persistState();
  });

  editor.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });

  document.addEventListener("keydown", (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      try {
        applyText(lintJSON(editor.value), "Formatted JSON");
      } catch (err) {
        setStatus(err.message, "error");
      }
    }

    if (meta && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      downloadFile();
    }
  });
}

function wireButtons() {
  formatBtn.addEventListener("click", () => {
    try {
      applyText(lintJSON(editor.value), "Formatted JSON");
    } catch (err) {
      setStatus(err.message, "error");
    }
  });

  minifyBtn.addEventListener("click", () => {
    try {
      applyText(lintJSON(editor.value, { compact: true }), "Minified JSON");
    } catch (err) {
      setStatus(err.message, "error");
    }
  });

  copyBtn.addEventListener("click", copyToClipboard);
  downloadBtn.addEventListener("click", downloadFile);
  clearBtn.addEventListener("click", () => {
    state.filename = FALLBACK_FILENAME;
    applyText(SAMPLE_JSON, "Reset to starter save");
  });
}

function boot() {
  renderLines("");
  wireDropzone();
  wireEditor();
  wireButtons();
  restoreFromStorage();
}

boot();

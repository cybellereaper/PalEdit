const fileInput = document.getElementById("file");
const textArea = document.getElementById("editor");
const lineNumbers = document.getElementById("line-numbers");
const statusEl = document.getElementById("status");
const statusText = statusEl?.querySelector(".status-text");
const statusSpinner = statusEl?.querySelector(".spinner");
const downloadBtn = document.getElementById("download");
const resetBtn = document.getElementById("reset");
const formatSelect = document.getElementById("download-format");

let originalText = "";
let activeFileName = "paledit-save";
let pyodideReady = null;

function renderLines(text) {
  const lines = text.split(/\r?\n/).length || 1;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => String(i + 1).padStart(3, " ")).join("\n");
}

function setStatus(message, kind = "info") {
  if (statusEl) {
    statusEl.dataset.kind = kind;
  }
  if (statusText) {
    statusText.textContent = message;
  }
  if (statusSpinner) {
    statusSpinner.style.display = kind === "loading" ? "inline-block" : "none";
  }
}

function prettyPrintJSON(raw) {
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed, null, 2);
}

async function bootstrapPyodide() {
  if (typeof loadPyodide !== "function") {
    throw new Error("Pyodide failed to load from CDN");
  }

  setStatus("Loading Pyodide runtime…", "loading");
  const pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(
    """
import micropip
await micropip.install('palworld-save-tools==0.24.0')

from palworld_save_tools.gvas import GvasFile
from palworld_save_tools.json_tools import CustomEncoder
from palworld_save_tools.palsav import compress_gvas_to_sav, decompress_sav_to_gvas
from palworld_save_tools.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS
import json


def _sav_bytes_to_json_text(raw_bytes, minify=False):
    raw_gvas, _ = decompress_sav_to_gvas(bytes(raw_bytes))
    gvas_file = GvasFile.read(raw_gvas, PALWORLD_TYPE_HINTS, PALWORLD_CUSTOM_PROPERTIES)
    return json.dumps(gvas_file.dump(), indent=None if minify else 2, cls=CustomEncoder, ensure_ascii=False)


def _json_text_to_sav_bytes(json_text):
    data = json.loads(json_text)
    gvas_file = GvasFile.load(data)
    save_type = 0x32 if ("Pal.PalWorldSaveGame" in gvas_file.header.save_game_class_name or "Pal.PalLocalWorldSaveGame" in gvas_file.header.save_game_class_name) else 0x31
    return compress_gvas_to_sav(gvas_file.write(PALWORLD_CUSTOM_PROPERTIES), save_type)
    """
  );

  setStatus("Pyodide ready for .sav and .json editing", "success");
  return pyodide;
}

async function ensurePyodideReady() {
  if (!pyodideReady) {
    pyodideReady = bootstrapPyodide();
  }
  return pyodideReady;
}

async function convertSavToJson(file) {
  const pyodide = await ensurePyodideReady();
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  pyodide.globals.set("raw_bytes", rawBytes);
  const text = pyodide.runPython("_sav_bytes_to_json_text(raw_bytes)");
  pyodide.globals.del("raw_bytes");
  return text;
}

async function convertJsonToSav(jsonText) {
  const pyodide = await ensurePyodideReady();
  pyodide.globals.set("json_text", jsonText);
  const savBytes = pyodide.runPython("_json_text_to_sav_bytes(json_text)");
  const jsBytes = savBytes.toJs({ create_proxies: false });
  savBytes.destroy?.();
  pyodide.globals.del("json_text");
  return jsBytes;
}

function downloadBlob(data, name, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  activeFileName = file.name.replace(/\.(sav|json)$/i, "") || "paledit-save";
  setStatus(`Reading ${file.name}…`, "loading");

  try {
    if (file.name.endsWith(".sav")) {
      const pretty = await convertSavToJson(file);
      textArea.value = pretty;
      originalText = pretty;
      renderLines(pretty);
      setStatus(`Converted ${file.name} to JSON in-browser`, "success");
    } else {
      const pretty = prettyPrintJSON(await file.text());
      textArea.value = pretty;
      originalText = pretty;
      renderLines(pretty);
      setStatus(`Loaded ${file.name} (${pretty.split("\n").length} lines)`, "success");
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Failed to load file", "error");
  }
});

textArea.addEventListener("input", () => {
  renderLines(textArea.value || "");
});

downloadBtn.addEventListener("click", async () => {
  try {
    const pretty = prettyPrintJSON(textArea.value || "{}");
    const format = formatSelect.value;

    if (format === "json") {
      downloadBlob(pretty, `${activeFileName}.json`, "application/json");
      setStatus("Validated and downloaded JSON", "success");
      return;
    }

    setStatus("Packaging save bytes in-browser…", "loading");
    const savBytes = await convertJsonToSav(pretty);
    downloadBlob(savBytes, `${activeFileName}.sav`, "application/octet-stream");
    setStatus("Validated JSON and built a .sav", "success");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Failed to download", "error");
  }
});

resetBtn.addEventListener("click", () => {
  textArea.value = originalText;
  renderLines(textArea.value || "");
  setStatus("Reverted changes");
});

renderLines("");
setStatus("Loading Pyodide…", "loading");
ensurePyodideReady().catch((err) => {
  console.error(err);
  setStatus("Pyodide failed to load. Check your connection and refresh.", "error");
});

const fileInput = document.getElementById("file");
const textArea = document.getElementById("editor");
const lineNumbers = document.getElementById("line-numbers");
const statusEl = document.getElementById("status");
const downloadBtn = document.getElementById("download");
const resetBtn = document.getElementById("reset");

let originalText = "";

function renderLines(text) {
  const lines = text.split(/\r?\n/).length || 1;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => String(i + 1).padStart(3, " ")).join("\n");
}

function setStatus(message, kind = "info") {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function prettyPrintJSON(raw) {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const pretty = prettyPrintJSON(String(reader.result));
      textArea.value = pretty;
      originalText = pretty;
      renderLines(pretty);
      setStatus(`Loaded ${file.name} (${pretty.split("\\n").length} lines)`, "success");
    } catch (err) {
      setStatus(err.message, "error");
    }
  };
  reader.readAsText(file);
});

textArea.addEventListener("input", () => {
  renderLines(textArea.value || "");
});

downloadBtn.addEventListener("click", () => {
  try {
    const pretty = prettyPrintJSON(textArea.value || "");
    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paledit-save.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Validated and downloaded JSON", "success");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

resetBtn.addEventListener("click", () => {
  textArea.value = originalText;
  renderLines(textArea.value || "");
  setStatus("Reverted changes");
});

renderLines("");
setStatus("Upload a JSON save to start");

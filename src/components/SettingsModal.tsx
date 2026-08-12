import { useState } from "react";
import { Key, Globe, Eye, EyeOff, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  geminiKey: string;
  setGeminiKey: (key: string) => void;
  hfToken: string;
  setHfToken: (token: string) => void;
}

export default function SettingsModal({
  isOpen, onClose, backendUrl, setBackendUrl, geminiKey, setGeminiKey, hfToken, setHfToken,
}: SettingsModalProps) {
  const [showGemini, setShowGemini] = useState(false);
  const [showHf, setShowHf] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  if (!isOpen) return null;

  const testConnection = async () => {
    setTestStatus("testing");
    setStatusMessage("Connecting...");
    try {
      const response = await fetch(`${backendUrl}/documents`, { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        setTestStatus("success");
        setStatusMessage(`Connected. ${data.length} documents in ChromaDB.`);
      } else {
        setTestStatus("failed");
        setStatusMessage(`Backend returned ${response.status}.`);
      }
    } catch {
      setTestStatus("failed");
      setStatusMessage("Could not connect. Make sure the backend is running.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glassmorphism animate-fade-in">
        <div className="modal-header">
          <h2 className="text-sm font-bold">Settings</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-body space-y-5">
          <p className="text-[11px] text-neutral-400">
            Configure API keys for translation (NLLB) and response generation (Gemini).
          </p>

          {/* Backend URL */}
          <div className="input-group">
            <label className="label-text">
              <Globe className="w-3.5 h-3.5" /> Backend URL
            </label>
            <input type="text" className="text-input" value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} placeholder="http://127.0.0.1:8000" />
          </div>

          {/* Gemini Key */}
          <div className="input-group">
            <label className="label-text flex items-center justify-between w-full">
              <span className="flex items-center gap-1">
                <Key className="w-3.5 h-3.5" /> Gemini API Key
              </span>
              <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-[10px] text-neutral-400 hover:text-black underline">Get Key</a>
            </label>
            <div className="relative">
              <input type={showGemini ? "text" : "password"} className="text-input pr-10" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIzaSy..." />
              <button type="button" onClick={() => setShowGemini(!showGemini)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black">
                {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* HuggingFace Token */}
          <div className="input-group">
            <label className="label-text flex items-center justify-between w-full">
              <span className="flex items-center gap-1">
                <Key className="w-3.5 h-3.5" /> HuggingFace Token
              </span>
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-[10px] text-neutral-400 hover:text-black underline">Get Token</a>
            </label>
            <div className="relative">
              <input type={showHf ? "text" : "password"} className="text-input pr-10" value={hfToken} onChange={(e) => setHfToken(e.target.value)} placeholder="hf_..." />
              <button type="button" onClick={() => setShowHf(!showHf)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black">
                {showHf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">Optional. Prevents rate-limit errors on NLLB calls.</p>
          </div>

          {/* Connection Test */}
          <div className="pt-2">
            <button onClick={testConnection} disabled={testStatus === "testing"} className="btn btn-secondary w-full text-xs">
              {testStatus === "testing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Test Connection"}
            </button>

            {testStatus !== "idle" && (
              <div className={`mt-3 p-3 flex items-start gap-2 text-xs border ${
                testStatus === "success" ? "border-neutral-300 bg-neutral-50" : testStatus === "testing" ? "border-neutral-200 bg-neutral-50" : "border-neutral-300 bg-neutral-50"
              }`}>
                {testStatus === "success" && <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {testStatus === "failed" && <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {testStatus === "testing" && <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin mt-0.5" />}
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary px-6 text-xs">Save & Close</button>
        </div>
      </div>
    </div>
  );
}

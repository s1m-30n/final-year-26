import { useState } from "react";
import { Globe, CheckCircle, XCircle, RefreshCw, Cpu, Server } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
}

export default function SettingsModal({
  isOpen, onClose, backendUrl, setBackendUrl
}: SettingsModalProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  if (!isOpen) return null;

  const testConnection = async () => {
    setTestStatus("testing");
    setStatusMessage("Connecting to Agricultural Extension Backend...");
    try {
      const response = await fetch(`${backendUrl}/documents`, { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        setTestStatus("success");
        setStatusMessage(`Connected successfully! Server online with ${data.length} documents indexed in ChromaDB.`);
      } else {
        setTestStatus("failed");
        setStatusMessage(`Backend returned status ${response.status}. Please check server logs.`);
      }
    } catch {
      setTestStatus("failed");
      setStatusMessage("Could not connect to backend. Make sure the FastAPI server is running.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glassmorphism animate-fade-in">
        <div className="modal-header">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" /> Server & System Settings
          </h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-body space-y-5">
          <p className="text-xs text-slate-500 leading-relaxed">
            Configure system backend endpoints and connection settings. All LLM and translation API credentials are securely managed server-side.
          </p>

          {/* Backend URL */}
          <div className="input-group">
            <label className="label-text flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Globe className="w-3.5 h-3.5 text-slate-500" /> Backend API Server URL
            </label>
            <input
              type="text"
              className="text-input"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000"
            />
            <p className="text-[11px] text-slate-400">
              Point to your local or deployed FastAPI server instance.
            </p>
          </div>

          {/* Security Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Cpu className="w-4 h-4 text-indigo-600" /> Server-Side Key Management Active
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Gemini LLM and HuggingFace NLLB translation keys are securely configured in your backend environment (<code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">.env</code>).
            </p>
          </div>

          {/* Connection Test */}
          <div className="pt-2">
            <button onClick={testConnection} disabled={testStatus === "testing"} className="btn btn-secondary w-full text-xs py-2.5">
              {testStatus === "testing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Test Server Connection"}
            </button>

            {testStatus !== "idle" && (
              <div className={`mt-3 p-3 flex items-start gap-2.5 text-xs rounded-xl border ${
                testStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : testStatus === "testing" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-rose-200 bg-rose-50 text-rose-900"
              }`}>
                {testStatus === "success" && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />}
                {testStatus === "failed" && <XCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />}
                {testStatus === "testing" && <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-slate-500 mt-0.5" />}
                <span className="leading-snug">{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer border-t border-slate-100 pt-4 flex justify-end">
          <button onClick={onClose} className="btn btn-primary px-6 text-xs">Save & Close</button>
        </div>
      </div>
    </div>
  );
}


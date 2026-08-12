import { useState, useEffect } from "react";
import { MessageSquare, Database, Cpu, Settings, Leaf, Camera, Globe, CloudSun, Bell, X, AlertTriangle } from "lucide-react";
import ChatAssistant from "./components/ChatAssistant";
import VectorDBExplorer from "./components/VectorDBExplorer";
import PipelineVisualizer from "./components/PipelineVisualizer";
import LiveCameraScanner from "./components/LiveCameraScanner";
import InternationalOrgsExplorer from "./components/InternationalOrgsExplorer";
import AgroWeatherAlerts from "./components/AgroWeatherAlerts";
import SettingsModal from "./components/SettingsModal";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "database" | "pipeline" | "scanner" | "partners" | "weather">("chat");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [pipelineMode, setPipelineMode] = useState<"pivot" | "direct">("pivot");

  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem("rag_backend_url") || "http://127.0.0.1:8000";
  });
  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem("rag_gemini_key") || "";
  });
  const [hfToken, setHfToken] = useState(() => {
    return localStorage.getItem("rag_hf_token") || "";
  });

  useEffect(() => { localStorage.setItem("rag_backend_url", backendUrl); }, [backendUrl]);
  useEffect(() => { localStorage.setItem("rag_gemini_key", geminiKey); }, [geminiKey]);
  useEffect(() => { localStorage.setItem("rag_hf_token", hfToken); }, [hfToken]);

  useEffect(() => {
    if (!geminiKey) setIsSettingsOpen(true);
  }, []);

  const [pipelineLogs, setPipelineLogs] = useState<{ stage: string; message: string }[]>([]);
  const [pipelineData, setPipelineData] = useState({
    originalQuery: "",
    translatedQuery: "",
    englishResponse: "",
    finalResponse: "",
    retrievedDocs: [] as { title: string; score: number; content: string }[],
  });
  const [currentLanguage, setCurrentLanguage] = useState("Nigerian Pidgin");

  const handleNewLog = (stage: string, message: string) => {
    setPipelineLogs((prev) => [...prev, { stage, message }]);
  };

  const handleClearLogs = () => setPipelineLogs([]);

  const handleSetPipelineData = (data: typeof pipelineData) => setPipelineData(data);

  const tabs = [
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
    { id: "weather" as const, label: "Agro-Weather & Alerts", icon: CloudSun },
    { id: "database" as const, label: "Database", icon: Database },
    { id: "partners" as const, label: "Partners", icon: Globe },
    { id: "pipeline" as const, label: "Pipeline", icon: Cpu },
    { id: "scanner" as const, label: "Scanner", icon: Camera },
  ];

  const pageTitles: Record<string, string> = {
    chat: "RAG Diagnostic Agent",
    weather: "Agro-Weather & Emergency Push Alerts",
    database: "Vector Knowledge Store",
    partners: "Global Partners",
    pipeline: "Pipeline Tracer",
    scanner: "Live Scanner",
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <div className="logo-badge">
              <Leaf className="w-4 h-4" />
            </div>
            <h1>AgriRAG</h1>
          </div>
          <nav className="sidebar-nav">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`sidebar-item ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="sidebar-item"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-navbar">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
              {pageTitles[activeTab]}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 relative">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-medium text-zinc-600">
              <span className={`w-1.5 h-1.5 rounded-full ${geminiKey ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
              <span>{geminiKey ? "Gemini Connected" : "Key Required"}</span>
            </div>

            {/* Notifications Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsAlertsDrawerOpen(!isAlertsDrawerOpen)}
                className="p-1.5 rounded-md hover:bg-zinc-100 border border-zinc-200 transition text-zinc-600 hover:text-zinc-900 relative"
                title="Field Push Alerts"
              >
                <Bell className="w-4 h-4 text-zinc-700" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                  3
                </span>
              </button>

              {/* Sleek Notifications Popover Drawer */}
              {isAlertsDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Active Emergency Alerts
                    </h4>
                    <button
                      onClick={() => setIsAlertsDrawerOpen(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1">
                      <span className="text-[9px] font-bold text-rose-700 uppercase">Heavy Rain Warning</span>
                      <p className="text-[11px] text-slate-700 font-medium">Torrential rain expected over next 48 hrs in South-West belt.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                      <span className="text-[9px] font-bold text-amber-700 uppercase">Fall Armyworm Alert</span>
                      <p className="text-[11px] text-slate-700 font-medium">Inspect maize leaves for armyworm whorl damage.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs space-y-1">
                      <span className="text-[9px] font-bold text-sky-700 uppercase">Market Price Up</span>
                      <p className="text-[11px] text-slate-700 font-medium">Cassava farmgate prices increased by 14% at Bodija.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab("weather");
                      setIsAlertsDrawerOpen(false);
                    }}
                    className="w-full btn btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
                  >
                    Open Agro-Weather & Alerts Hub
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-md hover:bg-zinc-100 border border-zinc-200 transition text-zinc-600 hover:text-zinc-900"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <section className="page-wrapper">
          {activeTab === "chat" && (
            <ChatAssistant
              backendUrl={backendUrl}
              geminiKey={geminiKey}
              hfToken={hfToken}
              onNewLog={handleNewLog}
              onClearLogs={handleClearLogs}
              onSetPipelineData={handleSetPipelineData}
              selectedLanguage={currentLanguage}
              setSelectedLanguage={setCurrentLanguage}
              pipelineMode={pipelineMode}
              setPipelineMode={setPipelineMode}
            />
          )}

          {activeTab === "weather" && (
            <AgroWeatherAlerts backendUrl={backendUrl} />
          )}

          {activeTab === "database" && (
            <VectorDBExplorer backendUrl={backendUrl} />
          )}

          {activeTab === "partners" && (
            <InternationalOrgsExplorer backendUrl={backendUrl} />
          )}

          {activeTab === "pipeline" && (
            <PipelineVisualizer
              logs={pipelineLogs}
              originalQuery={pipelineData.originalQuery}
              translatedQuery={pipelineData.translatedQuery}
              englishResponse={pipelineData.englishResponse}
              finalResponse={pipelineData.finalResponse}
              retrievedDocs={pipelineData.retrievedDocs}
              currentLanguage={currentLanguage}
              pipelineMode={pipelineMode}
            />
          )}

          {activeTab === "scanner" && (
            <LiveCameraScanner
              backendUrl={backendUrl}
              geminiKey={geminiKey}
              hfToken={hfToken}
              onNewLog={handleNewLog}
              onClearLogs={handleClearLogs}
            />
          )}
        </section>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backendUrl={backendUrl}
        setBackendUrl={setBackendUrl}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        hfToken={hfToken}
        setHfToken={setHfToken}
      />
    </div>
  );
}

export default App;

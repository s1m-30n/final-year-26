import { useState } from "react";
import { Languages, Database, Cpu, Hourglass, Wifi } from "lucide-react";

interface PipelineVisualizerProps {
  logs: { stage: string; message: string }[];
  originalQuery: string;
  translatedQuery: string;
  englishResponse: string;
  finalResponse: string;
  retrievedDocs: { title: string; score: number; content: string }[];
  currentLanguage: string;
  pipelineMode: "pivot" | "direct";
}

export default function PipelineVisualizer({
  logs, originalQuery, translatedQuery, englishResponse, finalResponse, retrievedDocs, currentLanguage, pipelineMode,
}: PipelineVisualizerProps) {
  const [networkProfile, setNetworkProfile] = useState<"2g" | "3g" | "4g">("2g");

  const networkStats = {
    "2g": { name: "2G EDGE (Rural Nigeria)", speed: "50 kbps", rtt: "1,200 ms", payloadCompression: "78% Gzip + 384px Canvas", estLatency: pipelineMode === "direct" ? "2.1s" : "4.4s" },
    "3g": { name: "3G HSPA (Suburban)", speed: "1.5 Mbps", rtt: "300 ms", payloadCompression: "65% Gzip + 512px Canvas", estLatency: pipelineMode === "direct" ? "1.2s" : "2.5s" },
    "4g": { name: "4G LTE (Urban)", speed: "25 Mbps", rtt: "40 ms", payloadCompression: "Standard JSON Gzip", estLatency: "0.6s" },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-slate-700" /> Pipeline Trace & 2G Field Simulator
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Real-time translation, vector lookup, low-bandwidth metrics, and LLM telemetry log.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-2xs">
            <Languages className="w-4 h-4 inline mr-2 text-slate-500" />
            {currentLanguage} ⇄ English
          </span>
        </div>
      </div>

      {/* 2G / 3G / 4G Field Network Simulator Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                Field Network Bandwidth Profile Simulator
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Simulate rural 2G EDGE connectivity performance.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setNetworkProfile("2g")}
              className={`text-xs font-bold px-3.5 py-2 rounded-lg transition-all ${
                networkProfile === "2g" ? "bg-emerald-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              2G EDGE (50 kbps)
            </button>
            <button
              onClick={() => setNetworkProfile("3g")}
              className={`text-xs font-bold px-3.5 py-2 rounded-lg transition-all ${
                networkProfile === "3g" ? "bg-emerald-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              3G (1.5 Mbps)
            </button>
            <button
              onClick={() => setNetworkProfile("4g")}
              className={`text-xs font-bold px-3.5 py-2 rounded-lg transition-all ${
                networkProfile === "4g" ? "bg-emerald-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              4G LTE
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bandwidth Speed</span>
            <span className="font-mono font-bold text-emerald-400 text-sm block">{networkStats[networkProfile].speed}</span>
          </div>
          <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RTT Network Latency</span>
            <span className="font-mono font-bold text-amber-400 text-sm block">{networkStats[networkProfile].rtt}</span>
          </div>
          <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payload Compression</span>
            <span className="font-mono font-bold text-slate-200 text-xs truncate block">{networkStats[networkProfile].payloadCompression}</span>
          </div>
          <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Est. Response Latency</span>
            <span className="font-mono font-bold text-sky-400 text-sm block">{networkStats[networkProfile].estLatency}</span>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 shadow-xs space-y-3">
          <Hourglass className="w-8 h-8 mx-auto text-slate-300 animate-pulse" />
          <h3 className="font-semibold text-sm text-slate-700">No active trace log</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">Submit a query in the Chat Assistant tab to inspect pipeline stages live.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7 space-y-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Pipeline Stages</h3>

            {/* Stage 1 */}
            <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all ${pipelineMode === "direct" ? "opacity-50" : ""}`}>
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center justify-between text-slate-900">
                <span className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-slate-600" /> 1 · Input Translation (NLLB)
                </span>
                {pipelineMode === "direct" && <span className="text-[10px] text-slate-400 uppercase font-mono">Bypassed</span>}
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Source ({currentLanguage})</span>
                  <p className="text-slate-800 italic font-medium leading-relaxed">
                    {originalQuery ? `"${originalQuery}"` : <span className="text-slate-400 not-italic">Awaiting query input...</span>}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    {pipelineMode === "direct" ? "Matching Key" : "Target (English)"}
                  </span>
                  <p className="text-slate-800 italic font-medium leading-relaxed">
                    {translatedQuery ? `"${translatedQuery}"` : <span className="text-slate-400 not-italic">Awaiting translation...</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center gap-2 text-slate-900">
                <Database className="w-4 h-4 text-slate-600" /> 2 · ChromaDB Vector Search
              </div>
              <div className="p-5 space-y-3.5 text-xs">
                {retrievedDocs.length === 0 ? (
                  <p className="text-slate-400 italic">No matching vectors retrieved yet.</p>
                ) : (
                  retrievedDocs.map((doc, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">{doc.title}</span>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">{doc.score}% match</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-xs">{doc.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stage 3 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center gap-2 text-slate-900">
                <Cpu className="w-4 h-4 text-slate-600" /> 3 · LLM Generation (Gemini API)
              </div>
              <div className="p-5 space-y-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Constructed System Prompt</span>
                  <pre className="text-[11px] text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                    {pipelineMode === "direct"
                      ? `[Context vectors loaded...]\nUser Query (${currentLanguage}): "${originalQuery || '...'}"\nInstruction: Respond directly in ${currentLanguage}.`
                      : `[Context vectors loaded...]\nUser Query: "${translatedQuery || '...'}"\nInstruction: Respond in English.`}
                  </pre>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    {pipelineMode === "direct" ? `LLM Output (${currentLanguage})` : "LLM Output (English)"}
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {(pipelineMode === "direct" ? finalResponse : englishResponse) || <span className="text-slate-400 font-normal italic">Awaiting LLM response...</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Stage 4 */}
            <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all ${pipelineMode === "direct" ? "opacity-50" : ""}`}>
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center justify-between text-slate-900">
                <span className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-slate-600" /> 4 · Output Translation (NLLB)
                </span>
                {pipelineMode === "direct" && <span className="text-[10px] text-slate-400 uppercase font-mono">Bypassed</span>}
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">English Baseline</span>
                  <p className="text-slate-600 leading-relaxed">
                    {englishResponse || <span className="text-slate-400 italic">Awaiting response...</span>}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Final Localized Response ({currentLanguage})</span>
                  <p className="text-slate-900 font-semibold leading-relaxed">
                    {finalResponse || <span className="text-slate-400 font-normal italic">Awaiting localized translation...</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Execution Terminal Logs */}
          <div className="xl:col-span-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Execution Terminal Log</h3>
            <div className="bg-slate-950 text-slate-300 p-5 rounded-2xl font-mono text-xs overflow-y-auto h-[600px] space-y-3 border border-slate-800 shadow-md">
              <div className="text-slate-500 font-bold border-b border-slate-800/80 pb-3 flex items-center justify-between">
                <span>$ trace --live --verbose</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              {logs.map((log, i) => (
                <div key={i} className="py-2 border-b border-slate-800/40 last:border-0 space-y-1">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">[{log.stage}]</div>
                  <div className="text-slate-300 leading-relaxed">{log.message}</div>
                </div>
              ))}
              <div className="text-slate-500 text-[10px] pt-3 italic border-t border-slate-800/60">--- End of execution trace ---</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


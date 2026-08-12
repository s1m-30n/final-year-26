import { useState, useRef } from "react";
import {
  Send,
  Mic,
  Camera,
  Languages,
  Loader,
  HelpCircle,
  Leaf,
  Sprout,
  Sparkles,
  Bot,
  User,
  Printer,
  ChevronRight,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  originalText?: string;
  sourceLang?: string;
  timestamp: string;
  context?: {
    title: string;
    score: number;
    crop?: string;
    category?: string;
    publisher?: string;
  }[];
  isDiagnostic?: boolean;
  diagnosticData?: {
    disease: string;
    crop: string;
    confidence: number;
    symptoms: string[];
    treatment: string[];
  };
}

interface ChatAssistantProps {
  backendUrl: string;
  geminiKey: string;
  hfToken: string;
  onNewLog: (stage: string, message: string) => void;
  onClearLogs: () => void;
  onSetPipelineData: (data: {
    originalQuery: string;
    translatedQuery: string;
    englishResponse: string;
    finalResponse: string;
    retrievedDocs: { title: string; score: number; content: string }[];
  }) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  pipelineMode: "pivot" | "direct";
  setPipelineMode: (mode: "pivot" | "direct") => void;
}

export default function ChatAssistant({
  backendUrl,
  geminiKey,
  hfToken,
  onNewLog,
  onClearLogs,
  onSetPipelineData,
  selectedLanguage,
  setSelectedLanguage,
  pipelineMode,
  setPipelineMode,
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "Welcome to the Agricultural RAG Extension Service. You can ask questions in English, Nigerian Pidgin, Hausa, Igbo or Yoruba. Send text, record voice, or upload a crop leaf image for diagnosis.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showVoiceSamples, setShowVoiceSamples] = useState(false);
  const [is2GMode, setIs2GMode] = useState<boolean>(() => {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn?.effectiveType === "2g" || conn?.saveData) return true;
    }
    return true; // Default to 2G Low-Data Mode enabled for rural field performance
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sampleLeaves = [
    {
      name: "Cassava (CMD)",
      icon: Leaf,
      disease: "Cassava Mosaic Disease",
      crop: "Cassava",
    },
    {
      name: "Maize (FAW)",
      icon: Sprout,
      disease: "Fall Armyworm Damage",
      crop: "Maize",
    },
    {
      name: "Tomato (Blight)",
      icon: Sparkles,
      disease: "Tomato Early Blight",
      crop: "Tomato",
    },
  ];

  const voiceSamples = [
    {
      text: "How i fit cure cassava mosaic disease?",
      lang: "Nigerian Pidgin",
      transcript:
        "How i fit cure cassava mosaic disease? My leaves dey turn yellow.",
    },
    {
      text: "Yaya zan warkar da cutar mosaic rogo?",
      lang: "Hausa",
      transcript:
        "Yaya zan warkar da cutar mosaic rogo? Ganyen rogo na suna ta lalacewa.",
    },
    {
      text: "Olee otu m ga-esi agwọ ọrịa cassava mosaic?",
      lang: "Igbo",
      transcript:
        "Olee otu m ga-esi agwọ ọrịa cassava mosaic? Akwụkwọ ji m na-acha edo edo.",
    },
    {
      text: "Bawo ni mo ṣe le tọju aarun cassava mosaic?",
      lang: "Yoruba",
      transcript:
        "Bawo ni mo ṣe le tọju aarun cassava mosaic? Awọn ewe mi n yipada si yẹlo.",
    },
  ];

  const handleSendMessage = async (
    textToSend: string,
    lang = selectedLanguage,
  ) => {
    if (!textToSend.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      sourceLang: lang,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    onClearLogs();
    setTimeout(scrollToBottom, 100);
    onNewLog("Pipeline Start", `Query received in ${lang}: "${textToSend}"`);

    const cacheKey = `rag_2g_cache_${lang}_${textToSend.trim().toLowerCase()}`;
    const cachedResponse = localStorage.getItem(cacheKey);
    if (cachedResponse && is2GMode) {
      try {
        const cachedData = JSON.parse(cachedResponse);
        onNewLog("2G Cache Hit", `Instant response retrieved from local 2G offline cache (0ms network latency).`);
        onSetPipelineData({
          originalQuery: cachedData.original_query || textToSend,
          translatedQuery: cachedData.translated_query || "[Cached]",
          englishResponse: cachedData.english_response || "",
          finalResponse: cachedData.final_response || "",
          retrievedDocs: cachedData.context || [],
        });
        if (cachedData.pipeline_logs) {
          cachedData.pipeline_logs.forEach((log: { stage: string; message: string }) => onNewLog(log.stage, log.message));
        }
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "agent",
            text: cachedData.final_response,
            originalText: cachedData.english_response,
            sourceLang: lang,
            context: cachedData.context,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
        return;
      } catch {}
    }

    try {
      const response = await fetch(`${backendUrl}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: textToSend,
          language: lang,
          gemini_key: geminiKey,
          hf_token: hfToken,
          pipeline_mode: pipelineMode,
        }),
      });
      if (!response.ok)
        throw new Error(`Server returned code ${response.status}`);
      const data = await response.json();

      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {}

      onSetPipelineData({
        originalQuery: data.original_query,
        translatedQuery: data.translated_query,
        englishResponse: data.english_response,
        finalResponse: data.final_response,
        retrievedDocs: data.context,
      });
      if (data.pipeline_logs)
        data.pipeline_logs.forEach((log: { stage: string; message: string }) =>
          onNewLog(log.stage, log.message),
        );

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: data.final_response,
          originalText: data.english_response,
          sourceLang: lang,
          context: data.context,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      onNewLog("Pipeline Error", `Failed: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: `Error: ${err.message}. Check your API key and backend.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setTimeout(scrollToBottom, 100);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecord = async () => {
    if (recording) {
      setRecording(false);
      onNewLog("Speech Recording", "Stopping recorder...");
      if (mediaRecorderRef.current?.state === "recording")
        mediaRecorderRef.current.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 16000,
        });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          stream.getTracks().forEach((t) => t.stop());
          await uploadAndTranscribe(blob);
        };
        mediaRecorder.start();
        setRecording(true);
        setShowVoiceSamples(false);
        onClearLogs();
        onNewLog("Speech Recording", "Listening...");
      } catch (err: any) {
        alert("Microphone access denied: " + err.message);
      }
    }
  };

  const uploadAndTranscribe = async (audioBlob: Blob) => {
    setLoading(true);
    onNewLog("Transcription", "Uploading audio...");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice_note.webm");
      const response = await fetch(`${backendUrl}/transcribe`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      onNewLog("Speech Recognized", `Transcribed: "${data.text}"`);
      if (data.text?.trim()) handleSendMessage(data.text, selectedLanguage);
    } catch (err: any) {
      onNewLog("Transcription Error", err.message);
      setShowVoiceSamples(true);
    } finally {
      setLoading(false);
    }
  };

  const selectVoiceSample = (sample: (typeof voiceSamples)[0]) => {
    setShowVoiceSamples(false);
    onNewLog("Speech Recognized", `Transcribed: "${sample.transcript}"`);
    setSelectedLanguage(sample.lang);
    handleSendMessage(sample.transcript, sample.lang);
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width,
            h = img.height;
          const maxDim = is2GMode ? 384 : 512;
          const quality = is2GMode ? 0.5 : 0.7;
          if (w > h) {
            if (w > maxDim) {
              h *= maxDim / w;
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w *= maxDim / h;
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) =>
              blob
                ? resolve(new File([blob], file.name, { type: "image/jpeg" }))
                : reject(new Error("Blob failed")),
            "image/jpeg",
            quality,
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleLeafUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onNewLog("Image Compression", "Compressing...");
      diagnoseImageFile(await compressImage(file));
    } catch {
      diagnoseImageFile(file);
    }
  };

  const diagnoseImageFile = async (file: File) => {
    setLoading(true);
    onClearLogs();
    onNewLog("Leaf Pathology", `Analyzing: ${file.name}`);
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: "user",
        text: `[Image attached: ${file.name}]`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setTimeout(scrollToBottom, 100);

    try {
      const formData = new FormData();
      formData.append("image", file);
      if (geminiKey) formData.append("gemini_key", geminiKey);
      if (hfToken) formData.append("hf_token", hfToken);
      const response = await fetch(`${backendUrl}/diagnose`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      onNewLog("Diagnosis Complete", `${data.disease} (${data.confidence}%)`);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: `Diagnosed: **${data.disease}** (${data.confidence}% confidence)`,
          isDiagnostic: true,
          diagnosticData: data,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      onNewLog("Error", err.message);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: `Diagnosis failed: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const testSampleLeaf = (sample: (typeof sampleLeaves)[0]) => {
    setLoading(true);
    onClearLogs();
    onNewLog("Leaf Pathology", `Running preset: ${sample.name}...`);
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: "user",
        text: `[Diagnostic Scan: ${sample.name}]`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setTimeout(scrollToBottom, 100);

    setTimeout(() => {
      const data = {
        disease: sample.disease,
        crop: sample.crop,
        confidence: 92.8,
        symptoms:
          sample.crop === "Cassava"
            ? [
                "Yellow mosaic pattern on leaves",
                "Leaf distortion and stunting",
                "Chlorotic spots on young shoots",
              ]
            : sample.crop === "Maize"
              ? [
                  "Ragged feeding holes on leaves",
                  "Yellowish frass in plant whorls",
                  "Shredded leaf blade margins",
                ]
              : [
                  "Concentric brown spots with yellow halos",
                  "Premature foliage drops",
                  "Stem lesion spots",
                ],
        treatment:
          sample.crop === "Cassava"
            ? [
                "Roguing (uproot and burn infected plants).",
                "Plant virus-resistant cultivars (TMS 98/0505).",
                "Control whitefly vector population.",
              ]
            : sample.crop === "Maize"
              ? [
                  "Scout fields weekly during seedling stage.",
                  "Apply neem seed powder in whorls.",
                  "Use approved bio-insecticides when threshold > 5%.",
                ]
              : [
                  "Remove and destroy lower infected leaves.",
                  "Avoid overhead sprinkler irrigation.",
                  "Apply copper-based protective fungicide.",
                ],
      };
      onNewLog("Diagnosis Complete", `${data.disease} (${data.confidence}%)`);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: `Diagnostic analysis completed for **${data.crop}**.`,
          isDiagnostic: true,
          diagnosticData: data,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-116px)] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="border-b border-slate-200 px-8 py-5 flex flex-wrap items-center justify-between gap-6 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <div
            style={{
              margin: "10px",
              // color: "white",
            }}
            className="w-12 h-12 rounded-xl  bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm"
          >
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3
                className="font-bold text-base text-slate-900 tracking-tight"
                style={{ margin: "10px" }}
              >
                Agricultural Advisory Extension
              </h3>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-2xs" />
            </div>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Multimodal RAG & Translation Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 2G Rural Network Optimization Mode Toggle */}
          <button
            onClick={() => setIs2GMode(!is2GMode)}
            className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
              is2GMode
                ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
            title="Toggle 2G Low-Data Network Optimization Mode (Ultra-compressed 384px images, local offline caching)"
          >
            <span className={`w-2 h-2 rounded-full ${is2GMode ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {is2GMode ? "⚡ 2G Network Mode (Active)" : "4G / Standard Mode"}
          </button>

          {/* Segmented Pipeline Mode Toggle */}
          <div
            className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 gap-1.5"
            style={{ padding: "10px" }}
          >
            <button
              onClick={() => setPipelineMode("pivot")}
              className={`text-sm font-semibold px-5 py-2 rounded-lg transition-all whitespace-nowrap ${
                pipelineMode === "pivot"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Pivot (NLLB)
            </button>
            <button
              onClick={() => setPipelineMode("direct")}
              className={`text-sm font-semibold px-5 py-2 rounded-lg transition-all whitespace-nowrap ${
                pipelineMode === "direct"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Direct LLM
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 hidden sm:block" />

          {/* Language Selector */}
          <div
            className="relative flex items-center"
            style={{ padding: "10px" }}
          >
            <Languages
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
              style={{ padding: "10px" }}
            />
            <select
              className="appearance-none bg-white border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-sm font-semibold text-slate-800 cursor-pointer focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all shadow-2xs"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="English">English</option>
              <option value="Nigerian Pidgin">Nigerian Pidgin</option>
              <option value="Hausa">Hausa</option>
              <option value="Igbo">Igbo</option>
              <option value="Yoruba">Yoruba</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div
        className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 bg-slate-50/70"
        style={{ padding: "10px" }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              style={{ padding: "10px" }}
            >
              <div className="flex items-start gap-3.5 max-w-[85%] sm:max-w-[75%]">
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0 mt-1 shadow-sm">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-6 py-4 text-sm sm:text-base leading-relaxed transition-all ${
                    isUser
                      ? "bg-slate-900 text-white rounded-tr-none shadow-sm"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none shadow-sm"
                  }`}
                  style={{ padding: "10px" }}
                >
                  <div>{msg.text}</div>

                  {!isUser &&
                    msg.originalText &&
                    msg.sourceLang !== "English" && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-100 text-xs text-slate-500 italic">
                        Internal English translation: "{msg.originalText}"
                      </div>
                    )}

                  {!isUser && msg.context && msg.context.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Retrieved Knowledge Sources
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {msg.context.map((src, i) => (
                          <span
                            key={i}
                            className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg font-medium"
                          >
                            {src.crop || "Doc"} · {src.title} ({src.score}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diagnostic Card Component */}
                  {msg.isDiagnostic && msg.diagnosticData && (
                    <div className="mt-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm text-slate-900">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                            Diagnostic Report
                          </span>
                          <h4 className="font-bold text-xl text-slate-900">
                            {msg.diagnosticData.disease}
                          </h4>
                        </div>
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-lg">
                          {msg.diagnosticData.confidence}% match
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                            Target Crop
                          </span>
                          <span className="font-semibold text-slate-800 text-sm">
                            {msg.diagnosticData.crop}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                            Pathology Engine
                          </span>
                          <span className="font-semibold text-slate-800 text-sm">
                            Gemini Vision
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-600 uppercase block mb-2">
                          Key Symptoms
                        </span>
                        <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                          {msg.diagnosticData.symptoms.map((s, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-2" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-3.5 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-900 uppercase block mb-2.5">
                          Recommended Treatment
                        </span>
                        <ol className="space-y-2.5 text-xs sm:text-sm text-slate-800 font-medium">
                          {msg.diagnosticData.treatment.map((t, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                                {idx + 1}
                              </span>
                              <span className="leading-snug">{t}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <button
                        onClick={() => window.print()}
                        className="w-full mt-3 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                      >
                        <Printer className="w-4 h-4" /> Print Advisory Report
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0 mt-1">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 mx-12 font-medium">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-5 py-3.5 flex items-center gap-3 shadow-sm">
              <Loader className="w-4 h-4 animate-spin text-slate-800" />
              <span className="text-xs font-medium text-slate-500">
                Processing advisory query...
              </span>
            </div>
          </div>
        )}

        {recording && (
          <div className="flex justify-center my-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center gap-4 w-72 shadow-md">
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                Recording Voice Note · {selectedLanguage}
              </div>
              <div className="flex items-center gap-1.5 h-10">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-slate-900 rounded-full animate-bounce"
                    style={{
                      height: `${16 + Math.random() * 22}px`,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={handleVoiceRecord}
                className="w-full py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
              >
                Stop & Transcribe
              </button>
            </div>
          </div>
        )}

        {showVoiceSamples && (
          <div className="flex justify-center my-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 border-b border-slate-100 pb-3.5 mb-3.5">
                <HelpCircle className="w-4 h-4 text-slate-400" /> Mic offline —
                select a sample audio query:
              </div>
              <div className="space-y-2.5">
                {voiceSamples.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectVoiceSample(sample)}
                    className="w-full text-left p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {sample.lang}
                      </span>
                      <p className="text-xs font-medium text-slate-800 mt-0.5">
                        "{sample.text}"
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Action Area */}
      <div className="border-t border-slate-200 p-8 flex flex-col gap-5 shrink-0 bg-white shadow-sm">
        {/* Preset Scan Quick Launch */}
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pr-3 border-r border-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" /> Presets
          </span>
          {sampleLeaves.map((leaf, idx) => {
            const Icon = leaf.icon;
            return (
              <button
                key={idx}
                onClick={() => testSampleLeaf(leaf)}
                className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-900 rounded-xl transition-all shrink-0 whitespace-nowrap group shadow-2xs"
              >
                <Icon className="w-4.5 h-4.5 text-slate-500 group-hover:text-slate-900 transition" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                  {leaf.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Input Controls */}
        <div className="flex items-center gap-3 pt-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLeafUpload}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-200 hover:border-slate-900 text-slate-600 hover:text-slate-900 transition shrink-0 bg-white shadow-2xs"
            title="Upload leaf photo"
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            onClick={handleVoiceRecord}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition shrink-0 shadow-2xs ${
              recording
                ? "bg-red-600 text-white"
                : "border border-slate-200 hover:border-slate-900 text-slate-600 hover:text-slate-900 bg-white"
            }`}
            title="Record voice note"
          >
            <Mic className="w-5 h-5" />
          </button>

          <div className="flex-1 border border-slate-200 rounded-xl flex items-center focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 transition bg-white overflow-hidden shadow-2xs">
            <input
              type="text"
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-sm sm:text-base text-slate-900 px-5 py-3.5 placeholder-slate-400"
              placeholder={`Ask in ${selectedLanguage}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage(inputText);
              }}
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={!inputText.trim()}
              className="w-12 h-12 flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white transition shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

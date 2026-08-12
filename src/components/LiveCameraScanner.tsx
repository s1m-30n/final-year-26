import { useState, useRef, useEffect } from "react";
import { Camera, CameraOff, RefreshCw, Download, AlertCircle, Play, Sparkles } from "lucide-react";

interface LiveCameraScannerProps {
  backendUrl: string; geminiKey: string; hfToken: string;
  onNewLog: (stage: string, message: string) => void; onClearLogs: () => void;
}

interface DiagnosisResult { disease: string; crop: string; confidence: number; symptoms: string[]; treatment: string[]; }

export default function LiveCameraScanner({ backendUrl, geminiKey, hfToken, onNewLog, onClearLogs }: LiveCameraScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [scanActive, setScanActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const getDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const video = all.filter((d) => d.kind === "videoinput");
      setDevices(video);
      if (video.length > 0 && !selectedDeviceId) setSelectedDeviceId(video[0].deviceId);
    } catch {}
  };

  useEffect(() => { getDevices(); return () => { stopCamera(); }; }, []);

  const startCamera = async () => {
    setError(""); setResult(null); onClearLogs();
    onNewLog("Webcam", "Requesting camera...");
    try {
      if (stream) stopCamera();
      const s = await navigator.mediaDevices.getUserMedia({
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "environment" }
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCameraActive(true);
      onNewLog("Webcam", "Camera active.");
      getDevices();
    } catch (err: any) {
      setError("Camera access denied.");
      onNewLog("Webcam Error", err.message);
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null); setCameraActive(false); setScanActive(false);
    onNewLog("Webcam", "Camera stopped.");
  };

  const handleFallbackCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setResult(null); onClearLogs();
    onNewLog("Capture", "Processing photo...");
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (geminiKey) formData.append("gemini_key", geminiKey);
      if (hfToken) formData.append("hf_token", hfToken);
      const res = await fetch(`${backendUrl}/diagnose`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setResult(data);
      onNewLog("Diagnosis", `${data.disease} (${data.confidence}%)`);
    } catch (err: any) { onNewLog("Error", err.message); }
    finally { setLoading(false); }
  };

  const captureFrameAndDiagnose = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true); setResult(null); setScanActive(true); onClearLogs();
    onNewLog("Scanner", "Capturing frame...");
    try {
      const v = videoRef.current, c = canvasRef.current, ctx = c.getContext("2d");
      if (ctx) {
        c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        onNewLog("Scanner", "Analyzing...");
        c.toBlob(async (blob) => {
          ctx.clearRect(0, 0, c.width, c.height); c.width = 0; c.height = 0;
          if (!blob) { setLoading(false); setScanActive(false); return; }
          const formData = new FormData();
          formData.append("image", new File([blob], "scan.jpg", { type: "image/jpeg" }));
          if (geminiKey) formData.append("gemini_key", geminiKey);
          if (hfToken) formData.append("hf_token", hfToken);
          try {
            const res = await fetch(`${backendUrl}/diagnose`, { method: "POST", body: formData });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            setResult(data); setScanActive(false);
            onNewLog("Diagnosis", `${data.disease} (${data.confidence}%)`);
          } catch (err: any) { onNewLog("Error", err.message); setScanActive(false); }
          finally { setLoading(false); }
        }, "image/jpeg");
      }
    } catch (err: any) { setLoading(false); setScanActive(false); onNewLog("Error", err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Camera className="w-6 h-6 text-slate-700" /> Live AI Leaf Scanner
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Real-time crop leaf pathology diagnostics powered by Gemini 2.5 Flash Vision API.
          </p>
        </div>
        {cameraActive && devices.length > 1 && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Camera:</span>
            <select
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
              value={selectedDeviceId}
              onChange={(e) => { setSelectedDeviceId(e.target.value); startCamera(); }}
            >
              {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Camera Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-md flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`} />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive && !result && (
              <div className="absolute inset-0 border-[24px] border-slate-950/40 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-white/60 rounded-2xl relative flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 -translate-x-1 -translate-y-1" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 translate-x-1 -translate-y-1" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 -translate-x-1 translate-y-1" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 translate-x-1 translate-y-1" />
                  <span className="text-[10px] font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">Align Crop Leaf</span>
                </div>
              </div>
            )}

            {scanActive && <div className="absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-scanner-laser top-0 pointer-events-none" />}

            {!cameraActive && (
              <div className="text-center p-8 text-slate-400 max-w-sm space-y-4">
                <CameraOff className="w-10 h-10 mx-auto text-slate-600" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-200 text-sm">Webcam Reticle Scanner Offline</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Start the webcam to perform live pathology diagnostics on plant leaves.</p>
                </div>
                <button onClick={startCamera} className="btn btn-primary w-full py-3 text-xs flex items-center justify-center gap-2 rounded-xl shadow-xs">
                  <Play className="w-4 h-4 fill-white" /> Start Live Reticle Camera
                </button>
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Or upload a field leaf photo:</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" ref={fallbackInputRef} onChange={handleFallbackCapture} />
                  <button onClick={() => fallbackInputRef.current?.click()} className="w-full btn btn-secondary text-slate-300 border-slate-700 hover:bg-slate-800 text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Select Leaf Image File
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3">
                <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm">Analyzing Leaf Telemetry...</h4>
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Gemini 2.5 Flash Multimodal Vision</p>
                </div>
              </div>
            )}

            {result && cameraActive && (
              <div className="absolute inset-0 border-[24px] border-slate-950/50 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl relative flex items-center justify-center">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 px-3.5 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-md whitespace-nowrap">
                    <Sparkles className="w-3.5 h-3.5" /> {result.disease} ({result.confidence}%)
                  </div>
                </div>
              </div>
            )}
          </div>

          {cameraActive && (
            <div className="flex gap-3">
              <button onClick={stopCamera} className="btn btn-secondary flex-1 py-3 text-xs flex items-center justify-center gap-2 rounded-xl">
                <CameraOff className="w-4 h-4" /> Stop Camera
              </button>
              <button onClick={captureFrameAndDiagnose} disabled={loading} className="btn btn-primary flex-[2] py-3 text-xs flex items-center justify-center gap-2 rounded-xl shadow-xs">
                <Sparkles className="w-4 h-4" /> Capture & Diagnose Leaf
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 border border-rose-200 bg-rose-50 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" /> {error}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Diagnostic Pathology Report Card */}
        <div className="lg:col-span-5">
          {!result ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl h-full min-h-[420px] flex flex-col justify-center items-center space-y-3 shadow-xs">
              <Camera className="w-10 h-10 text-slate-300 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-800">Diagnostic Pathology Report</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Capture a crop leaf image via webcam or upload to generate a real-time diagnostic report.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">DIAGNOSIS PATHOLOGY</span>
                  <h3 className="font-black text-xl text-slate-900 mt-1">{result.disease}</h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-2xs">
                  {result.confidence}% Match
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Target Crop</span>
                  <span className="font-bold text-slate-900 text-sm block">{result.crop}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Vision Engine</span>
                  <span className="font-bold text-slate-900 text-xs block">Gemini 2.5 Flash</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Observed Symptoms</h4>
                <ul className="list-disc list-inside space-y-1.5 text-slate-700 text-xs pl-1 leading-relaxed font-medium">
                  {result.symptoms.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommended Treatment</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-800 text-xs pl-1 font-semibold leading-relaxed">
                  {result.treatment.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </div>

              <button onClick={() => window.print()} className="w-full btn btn-secondary text-xs py-3 rounded-xl flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Print Diagnostic Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

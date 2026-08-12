import React, { useState, useEffect } from "react";
import { Database, Plus, Search, Check, FileText, Tag, RefreshCw } from "lucide-react";

interface VectorDBExplorerProps { backendUrl: string; }

interface DocumentItem {
  id: string;
  content: string;
  metadata: { title: string; crop: string; category: string; keywords: string; };
}

export default function VectorDBExplorer({ backendUrl }: VectorDBExplorerProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCrop, setNewCrop] = useState("Cassava");
  const [newCategory, setNewCategory] = useState("Root Crops");
  const [newContent, setNewContent] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "adding" | "success" | "failed">("idle");

  const fetchDocuments = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${backendUrl}/documents`);
      if (response.ok) setDocuments(await response.json());
      else setError("Failed to fetch documents.");
    } catch { setError("Unable to connect to backend."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocuments(); }, [backendUrl]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;
    setAddStatus("adding");
    try {
      const response = await fetch(`${backendUrl}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, crop: newCrop, category: newCategory, content: newContent, keywords: newKeywords }),
      });
      if (response.ok) {
        setAddStatus("success"); setNewTitle(""); setNewContent(""); setNewKeywords("");
        fetchDocuments();
        setTimeout(() => { setAddStatus("idle"); setShowAddForm(false); }, 1500);
      } else setAddStatus("failed");
    } catch { setAddStatus("failed"); }
  };

  const filteredDocs = documents.filter((doc) => {
    const t = searchTerm.toLowerCase();
    return doc.metadata.title.toLowerCase().includes(t) || doc.content.toLowerCase().includes(t) || doc.metadata.crop.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Database className="w-6 h-6 text-slate-700" /> ChromaDB Vector Knowledge Base
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Search, inspect, and manage agricultural advisory vector embeddings in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocuments}
            className="p-2.5 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-600 hover:text-slate-900 transition bg-slate-50"
            title="Refresh Store"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary flex items-center gap-2 px-4 py-2.5 text-xs rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Document
          </button>
        </div>
      </div>

      {/* Add Document Form */}
      {showAddForm && (
        <form onSubmit={handleAddDocument} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm animate-slide-down">
          <h3 className="font-bold text-sm text-slate-900">New Agricultural Advisory Document</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="input-group">
              <label className="label-text text-slate-600">Document Title</label>
              <input type="text" required className="text-input rounded-xl border-slate-200" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Mosaic Disease Control" />
            </div>
            <div className="input-group">
              <label className="label-text text-slate-600">Crop Focus</label>
              <select className="text-input rounded-xl border-slate-200" value={newCrop} onChange={(e) => setNewCrop(e.target.value)}>
                <option value="Cassava">Cassava</option><option value="Maize">Maize</option><option value="Yam">Yam</option><option value="Tomato">Tomato</option><option value="General">General</option>
              </select>
            </div>
            <div className="input-group">
              <label className="label-text text-slate-600">Domain Category</label>
              <select className="text-input rounded-xl border-slate-200" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                <option value="Root Crops">Root & Tuber Crops</option><option value="Cereals">Cereals & Grains</option><option value="Pest Control">Pest Control</option><option value="Soil & Land Management">Soil & Land</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="label-text text-slate-600">Advisory Content</label>
            <textarea required rows={3} className="text-input rounded-xl border-slate-200" value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Advisory bulletin text to embed into ChromaDB..." />
          </div>
          <div className="input-group">
            <label className="label-text text-slate-600">Keywords (Comma Separated)</label>
            <input type="text" className="text-input rounded-xl border-slate-200" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="cassava, mosaic, leaf spot, advisory" />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary px-4 py-2 text-xs rounded-xl">Cancel</button>
            <button type="submit" disabled={addStatus === "adding"} className="btn btn-primary px-4 py-2 text-xs rounded-xl flex items-center gap-1.5">
              {addStatus === "adding" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : addStatus === "success" ? <Check className="w-3.5 h-3.5" /> : "Index Vector"}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar + Vector List */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-900 transition"
            placeholder="Search knowledge documents by title, crop, or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 shadow-xs space-y-2">
            <RefreshCw className="w-7 h-7 text-slate-900 mx-auto animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-600">Loading vector embeddings...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center border border-rose-200 bg-rose-50 rounded-2xl text-xs text-rose-800 space-y-1">
            <p className="font-bold">Vector Store Error</p>
            <p className="text-slate-600">{error}</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 shadow-xs space-y-2">
            <Database className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">No matching advisory vectors found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">{doc.metadata.title}</h4>
                    <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      #agri_doc
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                      <Tag className="w-3 h-3 text-emerald-600" /> {doc.metadata.crop}
                    </span>
                    <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-500" /> {doc.metadata.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{doc.content}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate max-w-[180px] text-slate-500 font-mono">{doc.metadata.keywords || "—"}</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Vector indexed
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

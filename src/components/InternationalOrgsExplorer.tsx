import { useState, useEffect } from "react";
import { Globe, ExternalLink, Search, Building2, BookOpen, Layers } from "lucide-react";

interface IntlOrg {
  id: string; acronym: string; name: string; headquarters: string; regional_office?: string;
  website_url: string; repository_url: string; key_crop_domains: string[]; description: string;
}

interface Props { backendUrl: string; }

export default function InternationalOrgsExplorer({ backendUrl }: Props) {
  const [organizations, setOrganizations] = useState<IntlOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");

  useEffect(() => {
    fetch(`${backendUrl}/international-organizations`)
      .then((res) => { if (!res.ok) throw new Error("Failed to load"); return res.json(); })
      .then((data) => { setOrganizations(data.organizations || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [backendUrl]);

  const allDomains = Array.from(new Set(organizations.flatMap((org) => org.key_crop_domains || [])));

  const filteredOrgs = organizations.filter((org) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = org.name.toLowerCase().includes(s) || org.acronym.toLowerCase().includes(s) || org.description.toLowerCase().includes(s);
    const matchDomain = selectedDomain === "All" || org.key_crop_domains?.includes(selectedDomain);
    return matchSearch && matchDomain;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <Globe className="w-6 h-6 text-slate-700" /> International Agriculture Organizations
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              CGIAR centers, UN agencies, and global development partners indexed in the RAG vector store.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
            <Layers className="w-4 h-4 text-slate-500" /> {organizations.length} Partners Indexed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search organizations by name, acronym, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900 transition"
            />
          </div>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-900 cursor-pointer"
          >
            <option value="All">All Agricultural Domains</option>
            {allDomains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-xs font-semibold">Loading partner registry...</p>
        </div>
      )}

      {error && (
        <div className="border border-rose-200 bg-rose-50 rounded-2xl p-5 text-xs text-rose-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrgs.map((org) => (
            <div key={org.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block bg-slate-900 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider mb-2">
                      {org.acronym}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{org.name}</h3>
                  </div>
                  <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{org.description}</p>

                <div className="space-y-1.5 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5"><span className="font-bold text-slate-700">HQ:</span> {org.headquarters}</div>
                  {org.regional_office && <div className="flex items-center gap-1.5"><span className="font-bold text-slate-700">Regional:</span> {org.regional_office}</div>}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {org.key_crop_domains?.map((domain, idx) => (
                    <span key={idx} className="bg-slate-100 border border-slate-200/80 text-slate-700 text-[10px] font-medium px-2.5 py-1 rounded-md">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <a href={org.website_url} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 transition">
                  Website <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href={org.repository_url} target="_blank" rel="noreferrer" className="btn btn-primary text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Repository
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

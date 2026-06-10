import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, Search, X, Download, RotateCcw, Settings2,
  User, Package, Calendar, FileText, CheckCircle, Clock, Upload, LayoutTemplate,
  ChevronLeft, ChevronRight, Filter, FileSpreadsheet, Trash2, Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { attributionService, materielService, employeeService, templateService } from "@/services/api";
import type { Attribution, Materiel, Employee } from "@/types";

// ── Carte statistique ─────────────────────────────────────────────────────────
function StatCard({
  label, value, color, onClick, active,
}: { label: string; value: number | string; color: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[120px] rounded-2xl border p-4 flex flex-col items-center justify-center gap-0.5 transition select-none
        ${active ? `${color} border-transparent shadow-md scale-[1.03]` : "bg-white border-gray-100 hover:shadow-sm hover:border-gray-200"}
        ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <p className={`text-3xl font-black leading-none ${active ? "text-white" : "text-gray-800"}`}>{value}</p>
      <p className={`text-xs font-semibold mt-1 ${active ? "text-white/80" : "text-gray-400"}`}>{label}</p>
    </button>
  );
}

// ── Badge statut ──────────────────────────────────────────────────────────────
function StatutBadge({ statut }: { statut: string }) {
  if (statut === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle size={9} /> Active
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      <Clock size={9} /> Clôturée
    </span>
  );
}

const MOTIF_LABELS: Record<string, string> = {
  DEPART: "Départ", CHANGEMENT: "Changement", PANNE: "Panne",
  FIN_CONTRAT: "Fin contrat", AUTRE: "Autre",
};

// ── Groupement des attributions par employé ───────────────────────────────────
interface EmployeeGroup {
  employee_id:        number;
  employee_nom:       string;
  employee_prenom:    string | null;
  employee_matricule: string | null;
  employee_service:   string | null;
  employee_poste:     string | null;
  attributions:       Attribution[];
}

function groupByEmployee(attributions: Attribution[]): EmployeeGroup[] {
  const map = new Map<number, EmployeeGroup>();
  for (const a of attributions) {
    if (!map.has(a.employee_id)) {
      map.set(a.employee_id, {
        employee_id:        a.employee_id,
        employee_nom:       a.employee_nom,
        employee_prenom:    a.employee_prenom,
        employee_matricule: a.employee_matricule,
        employee_service:   a.employee_service,
        employee_poste:     a.employee_poste,
        attributions:       [],
      });
    }
    map.get(a.employee_id)!.attributions.push(a);
  }
  return Array.from(map.values());
}

const PAGE_SIZE = 10;

export function AttributionsContent() {
  const { isViewer } = useAuth();
  const [items,   setItems]   = useState<Attribution[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [filtre,      setFiltre]      = useState<"" | "ACTIVE" | "CLOTUREE">("");
  const [serviceFilter, setServiceFilter] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Pagination ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // Modal export Excel
  const ATTR_COLS = [
    { key: "id",          label: "ID" },
    { key: "employe",     label: "Employé" },
    { key: "matricule",   label: "Matricule" },
    { key: "service",     label: "Service" },
    { key: "poste",       label: "Poste" },
    { key: "materiel",    label: "Matériel" },
    { key: "type",        label: "Type" },
    { key: "serie",       label: "N° Série" },
    { key: "mac",         label: "Adresse MAC" },
    { key: "date_attr",   label: "Date Attribution" },
    { key: "date_rest",   label: "Date Restitution" },
    { key: "statut",      label: "Statut" },
    { key: "motif",       label: "Motif" },
    { key: "etat_remise", label: "État Remise" },
    { key: "notes",       label: "Notes" },
  ] as const;
  type AttrColKey = (typeof ATTR_COLS)[number]["key"];

  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportDebut,   setExportDebut]   = useState("");
  const [exportFin,     setExportFin]     = useState("");
  const [exportStatut,  setExportStatut]  = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportCols,    setExportCols]    = useState<Set<AttrColKey>>(
    new Set(ATTR_COLS.map(c => c.key))
  );
  const toggleAttrCol = (k: AttrColKey) =>
    setExportCols(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  // Modal modèle Word
  const [modeleOpen,    setModeleOpen]    = useState(false);
  const [templatesInfo, setTemplatesInfo] = useState<Record<string, { uploaded: boolean; size_kb?: number; placeholders: string[] }>>({});
  const [attFile,       setAttFile]       = useState<File | null>(null);
  const [decFile,       setDecFile]       = useState<File | null>(null);
  const [attLoading,    setAttLoading]    = useState(false);
  const [decLoading,    setDecLoading]    = useState(false);

  const loadTemplatesInfo = () =>
    templateService.getInfo().then(setTemplatesInfo).catch(() => {});

  useEffect(() => { if (modeleOpen) loadTemplatesInfo(); }, [modeleOpen]);

  // Modal nouvelle attribution
  const [modal, setModal] = useState<"attribution" | null>(null);
  const [lastEmployeeId, setLastEmployeeId] = useState<number | null>(null);

  // Modal Détail (clic sur ligne)
  const [detailGroup, setDetailGroup] = useState<EmployeeGroup | null>(null);

  // Modal Gérer
  const [gererGroup,    setGererGroup]    = useState<EmployeeGroup | null>(null);
  const [gererMode,     setGererMode]     = useState<"menu" | "attestation" | "rest_select" | "restituer" | "post_restitution" | "maj_select" | "maj">("menu");
  const [restituerAttr, setRestituerAttr] = useState<Attribution | null>(null);
  const [majAttr,         setMajAttr]         = useState<Attribution | null>(null);
  const [majForm,         setMajForm]         = useState<any>({ etat_remise: "", notes: "" });
  const [restitutedGroup, setRestitutedGroup] = useState<Attribution[]>([]);
  const [dechargeSelect,  setDechargeSelect]  = useState<number[]>([]);

  // Formulaire nouvelle attribution
  const [multiMode,        setMultiMode]        = useState(false);
  const [materiels,        setMateriels]        = useState<Materiel[]>([]);
  const [form, setForm] = useState<any>({
    materiel_id: "", date_attribution: new Date().toISOString().split("T")[0],
    etat_remise: "BON", notes: "",
  });
  const [selectedMaterielIds, setSelectedMaterielIds] = useState<number[]>([]);

  // Formulaire restitution
  const [restForm, setRestForm] = useState<any>({
    date_restitution: new Date().toISOString().split("T")[0],
    motif_restitution: "DEPART", notes_restitution: "",
  });

  // Recherche employé
  const [empQuery,    setEmpQuery]    = useState("");
  const [empResults,  setEmpResults]  = useState<Employee[]>([]);
  const [empSelected, setEmpSelected] = useState<Employee | null>(null);
  const [empLoading,  setEmpLoading]  = useState(false);
  const [empOpen,     setEmpOpen]     = useState(false);
  const empRef   = useRef<HTMLDivElement>(null);
  const empTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () => {
    setLoading(true);
    attributionService.getAll()
      .then(setItems).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filtre, serviceFilter]);

  useEffect(() => {
    if (modal === "attribution")
      materielService.getAll({ statut: "DISPONIBLE" }).then(setMateriels).catch(() => {});
  }, [modal]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchEmployees = useCallback((q: string) => {
    if (empTimer.current) clearTimeout(empTimer.current);
    if (!q.trim()) { setEmpResults([]); setEmpOpen(false); return; }
    empTimer.current = setTimeout(async () => {
      setEmpLoading(true);
      try {
        const res = await employeeService.search(q);
        setEmpResults(res.slice(0, 8));
        setEmpOpen(true);
      } catch { toast.error("Impossible de joindre l'API eRh"); }
      finally { setEmpLoading(false); }
    }, 350);
  }, []);

  const selectEmployee = (emp: Employee) => {
    setEmpSelected(emp);
    setEmpQuery(`${emp.prenom} ${emp.nom}`);
    setEmpOpen(false); setEmpResults([]);
  };

  const clearEmployee = () => { setEmpSelected(null); setEmpQuery(""); setEmpResults([]); };

  const openAttribution = () => {
    setForm({ materiel_id: "", date_attribution: new Date().toISOString().split("T")[0], etat_remise: "BON", notes: "" });
    setSelectedMaterielIds([]);
    setMultiMode(false);
    clearEmployee();
    setModal("attribution");
  };

  const openGerer = (group: EmployeeGroup) => {
    setGererGroup(group);
    setGererMode("menu");
    setRestituerAttr(null);
  };

  const closeGerer = () => {
    setGererGroup(null); setGererMode("menu");
    setRestituerAttr(null); setMajAttr(null);
    setRestitutedGroup([]); setDechargeSelect([]);
  };

  const downloadSelected = (ids: number[]) => {
    ids.forEach((id, i) => setTimeout(() => window.open(attributionService.dechargeUrl(id), "_blank"), i * 350));
  };

  const openRestituer = (attr: Attribution) => {
    setRestituerAttr(attr);
    setRestForm({ date_restitution: new Date().toISOString().split("T")[0], motif_restitution: "DEPART", notes_restitution: "" });
    setGererMode("restituer");
  };

  const startRestitution = () => {
    const active = gererGroup!.attributions.filter(a => a.statut === "ACTIVE");
    if (active.length === 1) openRestituer(active[0]);
    else setGererMode("rest_select");
  };

  const openMaj = (attr: Attribution) => {
    setMajAttr(attr);
    setMajForm({ etat_remise: attr.etat_remise ?? "BON", notes: attr.notes ?? "" });
    setGererMode("maj");
  };

  const startMaj = () => {
    if (gererGroup!.attributions.length === 1) openMaj(gererGroup!.attributions[0]);
    else setGererMode("maj_select");
  };

  const handleMaj = async () => {
    if (!majAttr) return;
    try {
      await attributionService.update(majAttr.id, majForm);
      toast.success("Mise à jour enregistrée");
      const updated = await attributionService.getAll({ employee_id: majAttr.employee_id });
      setItems(prev => [...prev.filter(a => a.employee_id !== majAttr.employee_id), ...updated]);
      setGererGroup({ ...gererGroup!, attributions: updated });
      setGererMode("menu");
      setMajAttr(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur");
    }
  };

  const toggleMaterielId = (id: number) => {
    setSelectedMaterielIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAttribution = async () => {
    if (!empSelected) { toast.error("Veuillez sélectionner un employé"); return; }

    if (multiMode) {
      if (selectedMaterielIds.length === 0) { toast.error("Veuillez sélectionner au moins un matériel"); return; }
      try {
        await Promise.all(
          selectedMaterielIds.map(materielId =>
            attributionService.create({
              materiel_id:        materielId,
              employee_id:        empSelected.id,
              employee_nom:       empSelected.nom,
              employee_prenom:    empSelected.prenom,
              employee_matricule: empSelected.matricule,
              employee_service:   empSelected.service ?? "",
              employee_poste:     empSelected.fonction ?? "",
              date_attribution:   form.date_attribution,
              etat_remise:        form.etat_remise,
              notes:              form.notes || null,
            })
          )
        );
        toast.success(`${selectedMaterielIds.length} attribution(s) créée(s)`);
        setLastEmployeeId(empSelected.id);
        setModal(null);
        load();
      } catch (e: any) {
        toast.error(e?.response?.data?.detail ?? "Erreur lors de la création");
      }
    } else {
      if (!form.materiel_id) { toast.error("Veuillez sélectionner un matériel"); return; }
      try {
        await attributionService.create({
          materiel_id:        Number(form.materiel_id),
          employee_id:        empSelected.id,
          employee_nom:       empSelected.nom,
          employee_prenom:    empSelected.prenom,
          employee_matricule: empSelected.matricule,
          employee_service:   empSelected.service ?? "",
          employee_poste:     empSelected.fonction ?? "",
          date_attribution:   form.date_attribution,
          etat_remise:        form.etat_remise,
          notes:              form.notes || null,
        });
        toast.success("Attribution créée");
        setLastEmployeeId(empSelected.id);
        setModal(null);
        load();
      } catch (e: any) {
        toast.error(e?.response?.data?.detail ?? "Erreur lors de la création");
      }
    }
  };

  const handleRestitution = async () => {
    if (!restituerAttr) return;
    try {
      await attributionService.restituer(restituerAttr.id, restForm);
      toast.success("Restitution enregistrée");
      const updated = await attributionService.getAll({ employee_id: restituerAttr.employee_id });
      setItems(prev => [...prev.filter(a => a.employee_id !== restituerAttr.employee_id), ...updated]);
      setGererGroup({ ...gererGroup!, attributions: updated });
      // Passer en mode post-restitution avec toutes les attributions du groupe
      setRestitutedGroup(updated);
      setDechargeSelect([restituerAttr.id]); // pré-cocher le matériel restitué
      setRestituerAttr(null);
      setGererMode("post_restitution");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur");
    }
  };

  // ── Debounce recherche ────────────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) {
      setSearch(""); setSuggestions([]); setShowSuggest(false); return;
    }
    const lower = val.toLowerCase();
    const sugg = Array.from(new Set(
      items.flatMap(a => [
        a.employee_nom, a.employee_prenom,
        a.employee_matricule, a.employee_service,
        a.materiel?.marque,
      ].filter(Boolean) as string[])
        .filter(s => s.toLowerCase().includes(lower))
    )).slice(0, 6);
    setSuggestions(sugg);
    setShowSuggest(sugg.length > 0);
    searchTimer.current = setTimeout(() => { setSearch(val); setShowSuggest(false); }, 300);
  };

  // ── Dérivations ──────────────────────────────────────────────────────────────
  const activeCount    = items.filter(a => a.statut === "ACTIVE").length;
  const closedCount    = items.filter(a => a.statut === "CLOTUREE").length;
  const employesActifs = new Set(items.filter(a => a.statut === "ACTIVE").map(a => a.employee_id)).size;
  const services       = Array.from(new Set(items.map(a => a.employee_service).filter(Boolean) as string[])).sort();

  const filtered = items.filter(a => {
    if (filtre         && a.statut           !== filtre)         return false;
    if (serviceFilter  && a.employee_service !== serviceFilter)  return false;
    if (!search) return true;
    return `${a.employee_nom} ${a.employee_prenom} ${a.employee_matricule} ${a.employee_service} ${a.materiel?.marque}`
      .toLowerCase().includes(search.toLowerCase());
  });

  const grouped       = groupByEmployee(filtered);
  const totalPages    = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE));
  const paginatedGroups = grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Attributions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? "Chargement…" : `${grouped.length} employé(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isViewer && (
          <button onClick={() => setModeleOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <LayoutTemplate size={15} /> Modèle
          </button>
          )}
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} />
            <span>Exporter</span>
            <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.xlsx</span>
          </button>
          {!isViewer && (
          <button onClick={openAttribution}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Nouvelle attribution
          </button>
          )}
        </div>
      </div>

      {/* ── Cartes statistiques ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Total" value={items.length} color="bg-camublue-900"
          onClick={() => { setFiltre(""); setServiceFilter(""); setSearchInput(""); setSearch(""); }}
          active={!filtre && !serviceFilter && !search} />
        <StatCard label="Actives" value={activeCount} color="bg-emerald-500"
          onClick={() => setFiltre(filtre === "ACTIVE" ? "" : "ACTIVE")}
          active={filtre === "ACTIVE"} />
        <StatCard label="Clôturées" value={closedCount} color="bg-gray-500"
          onClick={() => setFiltre(filtre === "CLOTUREE" ? "" : "CLOTUREE")}
          active={filtre === "CLOTUREE"} />
        <StatCard label="Employés actifs" value={employesActifs} color="bg-blue-500"
          onClick={() => setFiltre(filtre === "ACTIVE" ? "" : "ACTIVE")}
          active={false} />
      </div>

      {/* ── Bannière attestation post-création ── */}
      {lastEmployeeId && (
        <div className="flex items-center gap-3 mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 flex-1">
            Attribution enregistrée. Téléchargez l'attestation de mise à disposition.
          </p>
          <a href={attributionService.attestationUrl(lastEmployeeId)} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shrink-0">
            <FileText size={12} /> Attestation
          </a>
          <button onClick={() => setLastEmployeeId(null)} className="text-emerald-400 hover:text-emerald-700 transition">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
        <div className="flex gap-3 flex-wrap items-center">

          {/* Recherche avec suggestions */}
          <div ref={searchRef} className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {searchInput ? (
              <button onClick={() => { setSearchInput(""); setSearch(""); setSuggestions([]); setShowSuggest(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                <X size={14} />
              </button>
            ) : null}
            <input value={searchInput} onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              placeholder="Rechercher employé, service, matériel…"
              className="input-base pl-9 pr-8" />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} type="button"
                    onMouseDown={() => { setSearchInput(s); setSearch(s); setShowSuggest(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-camublue-900/5 text-left text-sm text-gray-700 border-b border-gray-50 last:border-0 transition">
                    <Search size={12} className="text-gray-300 shrink-0" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          {/* Filtre Statut */}
          <div className="flex gap-1.5">
            {(["", "ACTIVE", "CLOTUREE"] as const).map(v => (
              <button key={v} onClick={() => setFiltre(v)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                  filtre === v
                    ? "bg-camublue-900 text-white border-camublue-900"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}>
                {v === "" ? "Toutes" : v === "ACTIVE" ? "Actives" : "Clôturées"}
              </button>
            ))}
          </div>

          {/* Filtre Service */}
          {services.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-gray-400 shrink-0" />
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
                className="input-base py-2 text-sm">
                <option value="">Tous les services</option>
                {services.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Tableau groupé par employé ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Employé</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[13%]">Service</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[30%]">Matériels</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[15%]">Depuis le</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[10%]">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[10%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : grouped.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Aucune attribution</td></tr>
            ) : paginatedGroups.map(g => {
              const hasActive  = g.attributions.some(a => a.statut === "ACTIVE");
              const earliest   = g.attributions.reduce((min, a) =>
                a.date_attribution < min ? a.date_attribution : min,
                g.attributions[0].date_attribution
              );
              return (
                <tr
                  key={g.employee_id}
                  onClick={() => setDetailGroup(g)}
                  className="hover:bg-gray-50/60 transition cursor-pointer"
                >
                  {/* Employé */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-camublue-900">{g.employee_nom.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{g.employee_prenom} {g.employee_nom}</p>
                        <p className="text-xs text-gray-400 font-mono">{g.employee_matricule}</p>
                      </div>
                    </div>
                  </td>
                  {/* Service */}
                  <td className="px-4 py-3 text-xs text-gray-500">{g.employee_service ?? "—"}</td>
                  {/* Matériels — chips */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {g.attributions.map(a => (
                        <span
                          key={a.id}
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            a.statut === "ACTIVE"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-100 text-gray-400 border-gray-200"
                          }`}
                        >
                          <Package size={8} />
                          {a.materiel?.marque ?? "—"}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Date la plus ancienne */}
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {new Date(earliest).toLocaleDateString("fr-FR")}
                  </td>
                  {/* Statut global */}
                  <td className="px-4 py-3">
                    <StatutBadge statut={hasActive ? "ACTIVE" : "CLOTUREE"} />
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); openGerer(g); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                    >
                      <Settings2 size={12} /> Gérer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            {grouped.length === 0
              ? "Aucun résultat"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, grouped.length)} sur ${grouped.length} employé(s)`}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={14} />
            </button>
            {(() => {
              const w = 2;
              const start = Math.max(1, page - w);
              const end   = Math.min(totalPages, page + w);
              return (
                <>
                  {start > 1 && <span className="px-1 text-gray-300 text-xs">…</span>}
                  {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                        n === page ? "bg-camublue-900 text-white shadow-sm" : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}>{n}</button>
                  ))}
                  {end < totalPages && <span className="px-1 text-gray-300 text-xs">…</span>}
                </>
              );
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">»</button>
          </div>
          <p className="text-xs text-gray-400">
            Page <strong className="text-gray-700">{totalPages > 0 ? page : 0}</strong> / {totalPages}
          </p>
        </div>
      )}

      {/* ══ Modal Détail (clic ligne) ══════════════════════════════════════════ */}
      {detailGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailGroup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Header employé */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-camublue-900/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-camublue-900">{detailGroup.employee_nom.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-base truncate">
                    {detailGroup.employee_prenom} {detailGroup.employee_nom}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{detailGroup.employee_matricule ?? "—"}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {detailGroup.employee_service && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {detailGroup.employee_service}
                      </span>
                    )}
                    {detailGroup.employee_poste && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {detailGroup.employee_poste}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setDetailGroup(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition shrink-0">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Liste des matériels */}
            <div className="px-6 py-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Matériels attribués · {detailGroup.attributions.length}
              </p>
              {detailGroup.attributions.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    a.statut === "ACTIVE" ? "bg-blue-100" : "bg-gray-200"
                  }`}>
                    <Package size={14} className={a.statut === "ACTIVE" ? "text-blue-600" : "text-gray-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {a.materiel?.marque} {a.materiel?.modele}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {a.materiel?.numero_serie ?? a.materiel?.adresse_mac ?? "—"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Attribué le {new Date(a.date_attribution).toLocaleDateString("fr-FR")}
                      {a.statut === "CLOTUREE" && a.date_restitution &&
                        ` → restitué le ${new Date(a.date_restitution).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  <StatutBadge statut={a.statut} />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setDetailGroup(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                Fermer
              </button>
              <button
                onClick={() => { openGerer(detailGroup); setDetailGroup(null); }}
                className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <Settings2 size={14} /> Gérer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Gérer ════════════════════════════════════════════════════════ */}
      {gererGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeGerer}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">
                    {gererGroup.employee_prenom} {gererGroup.employee_nom}
                  </p>
                  <p className="text-white/60 text-xs">
                    {gererGroup.employee_matricule}
                    {gererGroup.employee_service ? ` · ${gererGroup.employee_service}` : ""}
                  </p>
                </div>
              </div>
              <button onClick={closeGerer}
                className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* ── MENU principal : 3 actions ── */}
              {gererMode === "menu" && (
                <div className="px-6 py-5 space-y-2.5">

                  {/* Attestation */}
                  {gererGroup.attributions.some(a => a.statut === "ACTIVE") ? (
                    <button
                      onClick={() => setGererMode("attestation")}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 transition group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center shrink-0 transition">
                        <FileText size={16} className="text-emerald-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-800">Attestation de mise à disposition</p>
                        <p className="text-xs text-gray-400">
                          {gererGroup.attributions.filter(a => a.statut === "ACTIVE").length} matériel(s) actif(s)
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 opacity-40 cursor-not-allowed">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-500">Attestation de mise à disposition</p>
                        <p className="text-xs text-gray-400">Aucun matériel actif</p>
                      </div>
                    </div>
                  )}

                  {/* Mise à jour */}
                  {!isViewer && (
                  <button
                    onClick={startMaj}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition">
                      <Settings2 size={16} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Mise à jour</p>
                      <p className="text-xs text-gray-400">Modifier état ou notes d'un matériel</p>
                    </div>
                  </button>
                  )}

                  {/* Restitution */}
                  {!isViewer && (gererGroup.attributions.some(a => a.statut === "ACTIVE") ? (
                    <button
                      onClick={startRestitution}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-amber-50 hover:border-amber-300 transition group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center shrink-0 transition">
                        <RotateCcw size={16} className="text-amber-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-800">Restitution</p>
                        <p className="text-xs text-gray-400">Clôturer l'attribution d'un matériel</p>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 opacity-40 cursor-not-allowed">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <RotateCcw size={16} className="text-gray-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-500">Restitution</p>
                        <p className="text-xs text-gray-400">Tous les matériels sont clôturés</p>
                      </div>
                    </div>
                  ))}

                  <button onClick={closeGerer}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition mt-1">
                    Fermer
                  </button>
                </div>
              )}

              {/* ── Attestation : visualiser ou télécharger ── */}
              {gererMode === "attestation" && (
                <div className="px-6 py-5 space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Attestation de mise à disposition</p>
                      <p className="text-xs text-gray-400">
                        {gererGroup.attributions.filter(a => a.statut === "ACTIVE").length} matériel(s) actif(s) ·{" "}
                        {gererGroup.employee_prenom} {gererGroup.employee_nom}
                      </p>
                    </div>
                  </div>

                  <a
                    href={attributionService.attestationUrl(gererGroup.employee_id)}
                    target="_blank" rel="noreferrer"
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Visualiser</p>
                      <p className="text-xs text-gray-400">Ouvrir le PDF dans un nouvel onglet</p>
                    </div>
                  </a>

                  <a
                    href={attributionService.attestationUrl(gererGroup.employee_id)}
                    download={`attestation_${gererGroup.employee_nom}.pdf`}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 transition group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center shrink-0 transition">
                      <Download size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Télécharger</p>
                      <p className="text-xs text-gray-400">Sauvegarder le PDF sur l'appareil</p>
                    </div>
                  </a>

                  <button onClick={() => setGererMode("menu")}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition mt-1">
                    Retour
                  </button>
                </div>
              )}

              {/* ── Post-restitution : téléchargement des décharges ── */}
              {gererMode === "post_restitution" && (
                <div className="px-6 py-5 space-y-4">
                  {/* Bannière succès */}
                  <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                    <p className="text-sm font-semibold text-emerald-800">Restitution enregistrée avec succès</p>
                  </div>

                  {/* Sélection des décharges */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Sélectionner les décharges à télécharger
                    </p>
                    <div className="space-y-2">
                      {restitutedGroup.map(a => {
                        const checked = dechargeSelect.includes(a.id);
                        return (
                          <label
                            key={a.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                              checked ? "bg-blue-50 border-blue-200" : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setDechargeSelect(prev =>
                                  prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                                )
                              }
                              className="accent-camublue-900 w-4 h-4 shrink-0"
                            />
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              a.statut === "CLOTUREE" ? "bg-gray-200" : "bg-blue-100"
                            }`}>
                              <Package size={13} className={a.statut === "CLOTUREE" ? "text-gray-500" : "text-blue-600"} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {a.materiel?.marque} {a.materiel?.modele}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                {a.materiel?.numero_serie ?? a.materiel?.adresse_mac ?? "—"}
                              </p>
                            </div>
                            <StatutBadge statut={a.statut} />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setGererMode("menu"); setRestitutedGroup([]); setDechargeSelect([]); }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
                    >
                      Fermer
                    </button>
                    <button
                      onClick={() => downloadSelected(dechargeSelect)}
                      disabled={dechargeSelect.length === 0}
                      className="flex-[2] flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition"
                    >
                      <Download size={14} />
                      {dechargeSelect.length > 1
                        ? `Télécharger ${dechargeSelect.length} décharges`
                        : "Télécharger la décharge"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Sélection matériel pour Mise à jour ── */}
              {gererMode === "maj_select" && (
                <div className="px-6 py-5 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quel matériel mettre à jour ?</p>
                  {gererGroup.attributions.map(a => (
                    <button key={a.id} onClick={() => openMaj(a)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition text-left group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.statut === "ACTIVE" ? "bg-blue-100" : "bg-gray-100"}`}>
                        <Package size={14} className={a.statut === "ACTIVE" ? "text-blue-600" : "text-gray-400"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{a.materiel?.marque} {a.materiel?.modele}</p>
                        <p className="text-xs text-gray-400 font-mono">{a.materiel?.numero_serie ?? a.materiel?.adresse_mac ?? "—"}</p>
                      </div>
                      <StatutBadge statut={a.statut} />
                    </button>
                  ))}
                  <button onClick={() => setGererMode("menu")}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition">
                    Retour
                  </button>
                </div>
              )}

              {/* ── Formulaire Mise à jour ── */}
              {gererMode === "maj" && majAttr && (
                <div className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <Package size={14} className="text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-700">Matériel sélectionné</p>
                      <p className="text-sm font-bold text-blue-900 truncate">{majAttr.materiel?.marque} {majAttr.materiel?.modele}</p>
                      <p className="text-xs text-blue-500 font-mono">{majAttr.materiel?.numero_serie ?? majAttr.materiel?.adresse_mac ?? "—"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">État actuel</label>
                    <select value={majForm.etat_remise}
                      onChange={e => setMajForm((p: any) => ({ ...p, etat_remise: e.target.value }))}
                      className="input-base">
                      {["NEUF", "BON", "USAGE"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
                    <textarea value={majForm.notes}
                      onChange={e => setMajForm((p: any) => ({ ...p, notes: e.target.value }))}
                      rows={3} className="input-base resize-none" placeholder="Informations complémentaires…" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGererMode(gererGroup!.attributions.length > 1 ? "maj_select" : "menu")}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Retour
                    </button>
                    <button onClick={handleMaj}
                      className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {/* ── Sélection matériel pour Restitution ── */}
              {gererMode === "rest_select" && (
                <div className="px-6 py-5 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quel matériel restituer ?</p>
                  {gererGroup.attributions.filter(a => a.statut === "ACTIVE").map(a => (
                    <button key={a.id} onClick={() => openRestituer(a)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-amber-50 hover:border-amber-200 transition text-left group">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <Package size={14} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{a.materiel?.marque} {a.materiel?.modele}</p>
                        <p className="text-xs text-gray-400 font-mono">{a.materiel?.numero_serie ?? a.materiel?.adresse_mac ?? "—"}</p>
                      </div>
                    </button>
                  ))}
                  <button onClick={() => setGererMode("menu")}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition">
                    Retour
                  </button>
                </div>
              )}

              {/* ── Formulaire Restitution ── */}
              {gererMode === "restituer" && restituerAttr && (
                <div className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Package size={14} className="text-amber-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-700">Matériel à restituer</p>
                      <p className="text-sm font-bold text-amber-900 truncate">
                        {restituerAttr.materiel?.marque} {restituerAttr.materiel?.modele}
                      </p>
                      <p className="text-xs text-amber-600 font-mono">
                        {restituerAttr.materiel?.numero_serie ?? restituerAttr.materiel?.adresse_mac ?? "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-amber-600">Depuis le</p>
                      <p className="text-xs font-semibold text-amber-800">
                        {new Date(restituerAttr.date_attribution).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        <Calendar size={10} className="inline mr-1" />Date de restitution
                      </label>
                      <input type="date" value={restForm.date_restitution}
                        onChange={e => setRestForm((p: any) => ({ ...p, date_restitution: e.target.value }))}
                        className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motif</label>
                      <select value={restForm.motif_restitution}
                        onChange={e => setRestForm((p: any) => ({ ...p, motif_restitution: e.target.value }))}
                        className="input-base">
                        {[["DEPART","Départ"],["CHANGEMENT","Changement"],["PANNE","Panne"],
                          ["FIN_CONTRAT","Fin contrat"],["AUTRE","Autre"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optionnel)</label>
                    <textarea value={restForm.notes_restitution}
                      onChange={e => setRestForm((p: any) => ({ ...p, notes_restitution: e.target.value }))}
                      rows={2} className="input-base resize-none" placeholder="Informations complémentaires…" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => {
                      const active = gererGroup!.attributions.filter(a => a.statut === "ACTIVE");
                      setGererMode(active.length > 1 ? "rest_select" : "menu");
                      setRestituerAttr(null);
                    }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Retour
                    </button>
                    <button onClick={handleRestitution}
                      className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                      Confirmer la restitution
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Nouvelle Attribution ══════════════════════════════════════════ */}
      {modal === "attribution" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Nouvelle attribution</h2>
                <p className="text-xs text-gray-400 mt-0.5">Assigner un ou plusieurs matériels à un employé</p>
              </div>
              <button onClick={() => setModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Toggle un / plusieurs matériels */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setMultiMode(false); setSelectedMaterielIds([]); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                    !multiMode ? "bg-camublue-900 text-white border-camublue-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Un matériel
                </button>
                <button
                  onClick={() => { setMultiMode(true); setForm((p: any) => ({ ...p, materiel_id: "" })); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                    multiMode ? "bg-camublue-900 text-white border-camublue-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Plusieurs matériels
                </button>
              </div>

              {/* Employé */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employé</label>
                <div ref={empRef} className="relative">
                  {empSelected ? (
                    <div className="flex items-center gap-3 p-3 bg-camublue-900/5 border border-camublue-900/20 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                        <span className="font-bold text-camublue-900">
                          {(empSelected.prenom || empSelected.nom).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{empSelected.prenom} {empSelected.nom}</p>
                        <p className="text-xs text-gray-500">
                          {empSelected.matricule}
                          {empSelected.service ? ` · ${empSelected.service}` : ""}
                          {empSelected.fonction ? ` · ${empSelected.fonction}` : ""}
                        </p>
                      </div>
                      <button onClick={clearEmployee}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={empQuery}
                        onChange={e => { setEmpQuery(e.target.value); searchEmployees(e.target.value); }}
                        onFocus={() => empResults.length > 0 && setEmpOpen(true)}
                        placeholder="Tapez un nom, prénom ou matricule…"
                        className="input-base pl-9 pr-8" autoFocus />
                      {empLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
                      )}
                    </div>
                  )}
                  {empOpen && empResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {empResults.map(emp => (
                        <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-camublue-900/5 transition text-left border-b border-gray-50 last:border-0">
                          <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-camublue-900">
                              {(emp.prenom || emp.nom).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{emp.prenom} {emp.nom}</p>
                            <p className="text-xs text-gray-400">
                              {emp.matricule}{emp.service ? ` · ${emp.service}` : ""}
                              {emp.type_contrat ? ` · ${emp.type_contrat}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Matériel — mode simple */}
              {!multiMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Matériel</label>
                  <select value={form.materiel_id}
                    onChange={e => setForm((p: any) => ({ ...p, materiel_id: e.target.value }))}
                    className="input-base">
                    <option value="">Sélectionner un matériel disponible…</option>
                    {materiels.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.marque} {m.modele || ""} — {m.numero_serie ?? m.adresse_mac ?? "sans identifiant"}
                      </option>
                    ))}
                  </select>
                  {materiels.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1.5">Aucun matériel disponible actuellement.</p>
                  )}
                </div>
              )}

              {/* Matériels — mode multi */}
              {multiMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Matériels disponibles
                    {selectedMaterielIds.length > 0 && (
                      <span className="ml-2 text-camublue-900">({selectedMaterielIds.length} sélectionné(s))</span>
                    )}
                  </label>
                  {materiels.length === 0 ? (
                    <p className="text-xs text-amber-600">Aucun matériel disponible actuellement.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {materiels.map(m => {
                        const checked = selectedMaterielIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition ${
                              checked ? "bg-camublue-900/5" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMaterielId(m.id)}
                              className="accent-camublue-900 w-4 h-4 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {m.marque} {m.modele || ""}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                {m.numero_serie ?? m.adresse_mac ?? "sans identifiant"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Détails communs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date d'attribution</label>
                  <input type="date" value={form.date_attribution}
                    onChange={e => setForm((p: any) => ({ ...p, date_attribution: e.target.value }))}
                    className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">État à la remise</label>
                  <select value={form.etat_remise}
                    onChange={e => setForm((p: any) => ({ ...p, etat_remise: e.target.value }))}
                    className="input-base">
                    {["NEUF", "BON", "USAGE"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
                <textarea value={form.notes}
                  onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                  rows={2} placeholder="Informations complémentaires…" className="input-base resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button onClick={handleAttribution}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                  {multiMode && selectedMaterielIds.length > 1
                    ? `Attribuer ${selectedMaterielIds.length} matériels`
                    : "Attribuer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ══ Modal Export Excel ════════════════════════════════════════════════ */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Exporter les attributions</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fichier Excel (.xlsx) mis en forme · {items.length} attribution(s) chargées
                </p>
              </div>
              <button onClick={() => setExportOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Période */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Période (date d'attribution)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Du</label>
                    <input type="date" value={exportDebut} onChange={e => setExportDebut(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Au</label>
                    <input type="date" value={exportFin} onChange={e => setExportFin(e.target.value)} className="input-base" />
                  </div>
                </div>
              </div>

              {/* Statut */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Statut</p>
                <select value={exportStatut} onChange={e => setExportStatut(e.target.value)} className="input-base">
                  <option value="">Tous</option>
                  <option value="ACTIVE">Actives</option>
                  <option value="CLOTUREE">Clôturées</option>
                </select>
              </div>

              {/* Colonnes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Colonnes à inclure</p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols(new Set(ATTR_COLS.map(c => c.key)))}
                      className="text-xs text-camublue-900 font-semibold hover:underline">Tout</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setExportCols(new Set())}
                      className="text-xs text-gray-400 hover:underline">Aucun</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ATTR_COLS.map(({ key, label }) => (
                    <label key={key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition text-sm
                        ${exportCols.has(key)
                          ? "bg-camublue-900/5 border-camublue-900/20 text-camublue-900 font-semibold"
                          : "border-gray-100 text-gray-400 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={exportCols.has(key)}
                        onChange={() => toggleAttrCol(key)}
                        className="accent-camublue-900 w-3.5 h-3.5 shrink-0" />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{exportCols.size} colonne(s) sélectionnée(s)</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setExportOpen(false)} disabled={exportLoading}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
                  Annuler
                </button>
                <button
                  disabled={exportCols.size === 0 || exportLoading}
                  onClick={async () => {
                    setExportLoading(true);
                    try {
                      await attributionService.exportExcel({
                        date_debut: exportDebut  || undefined,
                        date_fin:   exportFin    || undefined,
                        statut:     exportStatut || undefined,
                        cols:       exportCols.size > 0 ? Array.from(exportCols).join(",") : undefined,
                      });
                      toast.success("Fichier Excel généré avec succès");
                      setExportOpen(false);
                    } catch {
                      toast.error("Erreur lors de la génération");
                    } finally {
                      setExportLoading(false);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  {exportLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération…</>
                    : <><Download size={14} /> Télécharger .xlsx</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Modèle Word ════════════════════════════════════════════════ */}
      {modeleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Templates de documents</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Uploadez vos modèles Word (.docx) — les champs sont remplis automatiquement
                </p>
              </div>
              <button onClick={() => setModeleOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* Info générale */}
              <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                <Info size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Comment ça marche ?</p>
                  <p>Créez un document Word (.docx) avec des balises <code className="bg-blue-100 px-1 rounded font-mono">{"{{NOM}}"}</code> là où vous voulez les données. Le système détecte automatiquement toutes les balises et les remplace lors de la génération.</p>
                </div>
              </div>

              {/* ── Section Attestation ── */}
              {(["attestation", "decharge"] as const).map(docType => {
                const info   = templatesInfo[docType];
                const isAtt  = docType === "attestation";
                const file   = isAtt ? attFile : decFile;
                const setFile = isAtt ? setAttFile : setDecFile;
                const loading = isAtt ? attLoading : decLoading;
                const setLoading = isAtt ? setAttLoading : setDecLoading;
                const title  = isAtt ? "Attestation de mise à disposition" : "Décharge";
                const PLACEHOLDERS = isAtt
                  ? ["NOM","PRENOM","MATRICULE","SERVICE","POSTE","DATE_JOUR","DATE_ATTRIBUTION","NB_MATERIELS","MATERIEL_1","MARQUE_1","MODELE_1","TYPE_1","SERIE_1","MAC_1","ETAT_1","DATE_ATTR_1"]
                  : ["NOM","PRENOM","MATRICULE","SERVICE","POSTE","DATE_JOUR","MATERIEL","MARQUE","MODELE","TYPE","SERIE","MAC","ETAT_REMISE","DATE_ATTRIBUTION","DATE_RESTITUTION","MOTIF","NOTES"];

                return (
                  <div key={docType} className="border border-gray-100 rounded-2xl overflow-hidden">
                    {/* Header section */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="text-camublue-900" />
                        <p className="text-sm font-bold text-gray-700">{title}</p>
                      </div>
                      {info?.uploaded && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Template actif · {info.size_kb} ko
                          </span>
                          <button
                            onClick={async () => {
                              try {
                                await templateService.delete(docType);
                                toast.success("Template supprimé");
                                loadTemplatesInfo();
                              } catch { toast.error("Erreur"); }
                            }}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Balises disponibles */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">Balises disponibles dans votre template :</p>
                        <div className="flex flex-wrap gap-1">
                          {PLACEHOLDERS.map(p => (
                            <code key={p} className="text-[10px] bg-camublue-900/5 text-camublue-900 px-1.5 py-0.5 rounded font-mono border border-camublue-900/10">
                              {`{{${p}}}`}
                            </code>
                          ))}
                          {isAtt && <code className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">…_2, …_3 etc.</code>}
                        </div>
                      </div>

                      {/* Balises détectées dans le template uploadé */}
                      {info?.uploaded && info.placeholders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 mb-1">Balises détectées dans votre fichier :</p>
                          <div className="flex flex-wrap gap-1">
                            {info.placeholders.map(p => (
                              <code key={p} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono border border-emerald-200">
                                {`{{${p}}}`}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upload */}
                      <div>
                        <label className={`flex items-center gap-3 w-full px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition
                          ${file ? "border-camublue-900/40 bg-camublue-900/5" : "border-gray-200 hover:border-camublue-900/30 hover:bg-gray-50"}`}>
                          <Upload size={16} className={file ? "text-camublue-900" : "text-gray-300"} />
                          <div className="flex-1 min-w-0">
                            {file
                              ? <span className="text-sm font-semibold text-camublue-900 truncate">{file.name}</span>
                              : <span className="text-sm text-gray-400">{info?.uploaded ? "Remplacer le template…" : "Choisir un fichier .docx…"}</span>}
                          </div>
                          <input type="file" accept=".docx" className="hidden"
                            onChange={e => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>

                      {/* Bouton upload */}
                      <button
                        disabled={!file || loading}
                        onClick={async () => {
                          if (!file) return;
                          setLoading(true);
                          try {
                            const res = await templateService.upload(docType, file);
                            toast.success(`Template "${title}" enregistré · ${res.placeholders.length} balise(s) détectée(s)`);
                            setFile(null);
                            loadTemplatesInfo();
                          } catch (e: any) {
                            toast.error(e?.response?.data?.detail ?? "Erreur lors de l'upload");
                          } finally { setLoading(false); }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                      >
                        {loading
                          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Upload…</>
                          : <><Upload size={14} /> Enregistrer ce template</>}
                      </button>
                    </div>
                  </div>
                );
              })}

              <button onClick={() => setModeleOpen(false)}
                className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

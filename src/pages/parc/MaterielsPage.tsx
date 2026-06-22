import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, X, Download, Upload, ChevronLeft, ChevronRight, History, Filter, AlertTriangle, FileSpreadsheet, User } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { materielService, attributionService, employeeService } from "@/services/api";
import type { Materiel } from "@/types";

const STATUT_COLORS: Record<string, string> = {
  DISPONIBLE:  "bg-emerald-100 text-emerald-700",
  ATTRIBUE:    "bg-blue-100 text-blue-700",
  MAINTENANCE: "bg-amber-100 text-amber-700",
  EN_PANNE:    "bg-orange-100 text-orange-700",
  REFORME:     "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  ORDINATEUR_PORTABLE: "PC Portable", ORDINATEUR_FIXE: "PC Fixe",
  ECRAN: "Écran", SOURIS: "Souris", CLAVIER: "Clavier",
  TELEPHONE: "Téléphone", TABLETTE: "Tablette", IMPRIMANTE: "Imprimante",
  SWITCH: "Switch", ROUTEUR: "Routeur", ONDULEUR: "Onduleur", AUTRE: "Autre",
};

const TYPES_WITH_IP = ["ORDINATEUR_PORTABLE", "ORDINATEUR_FIXE", "SWITCH", "ROUTEUR"];

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  type_materiel:    "ORDINATEUR_PORTABLE",
  marque:           "",
  modele:           "",
  numero_serie:     "",
  adresse_mac:      "",
  numero_bon_cmd:   "",
  projet:           "",
  beneficiaire_matricule: "",
  beneficiaire_nom:       "",
  beneficiaire_prenom:    "",
  etat:             "BON",
  date_acquisition: "",
};

// ── Carte statistique ─────────────────────────────────────────────────────────
function StatCard({
  label, value, color, onClick, active,
}: { label: string; value: number | string; color: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[110px] rounded-2xl border p-4 flex flex-col items-center justify-center gap-0.5 transition select-none
        ${active ? `${color} border-transparent shadow-md scale-[1.03]` : "bg-white border-gray-100 hover:shadow-sm hover:border-gray-200"}
        ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <p className={`text-3xl font-black leading-none ${active ? "text-white" : "text-gray-800"}`}>{value}</p>
      <p className={`text-xs font-semibold mt-1 ${active ? "text-white/80" : "text-gray-400"}`}>{label}</p>
    </button>
  );
}

export function MaterielsContent() {
  const { isViewer } = useAuth();
  const [items,    setItems]    = useState<Materiel[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(""); // valeur brute du champ
  const [search,      setSearch]      = useState(""); // valeur debounced envoyée à l'API
  const [statut,      setStatut]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState("");
  const [etatFilter,  setEtatFilter]  = useState("");
  const [projetFilter,  setProjetFilter]  = useState("");
  const [assigneFilter, setAssigneFilter] = useState("");
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [projets, setProjets] = useState<{ projet: string; count: number }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<Record<string, number>>({});
  const loadStats = useCallback(() => {
    materielService.stats().then(setStats).catch(() => {});
  }, []);

  // ── Suggestions de recherche ─────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // modal formulaire (ajout / modification)
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<number | null>(null);
  const [form,     setForm]     = useState<any>(EMPTY_FORM);

  // modal Gérer
  const [gererItem,   setGererItem]   = useState<Materiel | null>(null);
  const [gererMode,   setGererMode]   = useState<"menu" | "recuperer" | "assigner">("menu");
  // formulaire d'assignation (matériel disponible -> employé)
  const [assignForm, setAssignForm] = useState<any>({
    employee_id: "", employee_nom: "", employee_prenom: "",
    employee_matricule: "", employee_service: "", employee_poste: "",
    date_attribution: new Date().toISOString().split("T")[0],
    etat_remise: "BON", notes: "",
  });
  const [assignEmpQuery,   setAssignEmpQuery]   = useState("");
  const [assignEmpResults, setAssignEmpResults] = useState<any[]>([]);
  const [assignEmpOpen,    setAssignEmpOpen]    = useState(false);
  const [assignEmpLoading, setAssignEmpLoading] = useState(false);
  const [assignLoading,    setAssignLoading]    = useState(false);
  const assignTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // modal Détails
  const [detailItem,  setDetailItem]  = useState<Materiel | null>(null);
  // modal Parcours
  const [parcoursItem,    setParcoursItem]    = useState<Materiel | null>(null);
  const [parcoursHistory, setParcoursHistory] = useState<any[]>([]);
  const [parcoursLoading, setParcoursLoading] = useState(false);
  // formulaire récupération dans le parcours
  const [recupererAttr,   setRecupererAttr]   = useState<any | null>(null);
  const [recupForm,       setRecupForm]       = useState<any>({
    date_restitution:  new Date().toISOString().split("T")[0],
    motif_restitution: "CHANGEMENT",
    notes_restitution: "",
    employee_id: "", employee_nom: "", employee_prenom: "",
    employee_matricule: "", employee_service: "", employee_poste: "",
    date_attribution: new Date().toISOString().split("T")[0],
    etat_remise: "BON", notes: "",
  });
  const [recupEmpQuery,   setRecupEmpQuery]   = useState("");
  const [recupEmpResults, setRecupEmpResults] = useState<any[]>([]);
  const [recupEmpOpen,    setRecupEmpOpen]    = useState(false);
  const [recupEmpLoading, setRecupEmpLoading] = useState(false);
  const [recupLoading,    setRecupLoading]    = useState(false);
  const recupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // modal Import
  const [importOpen,    setImportOpen]    = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult,  setImportResult]  = useState<{ created: number; errors: { ligne: number; message: string }[] } | null>(null);

  const [exportLoading, setExportLoading] = useState(false);

  // modal Export personnalisé
  const ALL_COLS = [
    { key: "id",          label: "ID" },
    { key: "type",        label: "Type" },
    { key: "marque",      label: "Marque" },
    { key: "modele",      label: "Modèle" },
    { key: "serie",       label: "N° Série" },
    { key: "mac",         label: "Adresse MAC" },
    { key: "po",          label: "N° PO" },
    { key: "etat",        label: "État" },
    { key: "statut",      label: "Statut" },
    { key: "acquisition", label: "Date Acquisition" },
    { key: "assigne",     label: "Assigné à" },
  ] as const;
  type ColKey = (typeof ALL_COLS)[number]["key"];

  const [exportOpen,      setExportOpen]      = useState(false);
  const [exportDateDebut, setExportDateDebut] = useState("");
  const [exportDateFin,   setExportDateFin]   = useState("");
  const [exportCols,      setExportCols]      = useState<Set<ColKey>>(
    new Set(ALL_COLS.map(c => c.key))
  );
  const toggleCol = (k: ColKey) =>
    setExportCols(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  // pagination
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    materielService.getAll({
      search:        search        || undefined,
      statut:        statut        || undefined,
      type_materiel: typeFilter    || undefined,
      etat:          etatFilter    || undefined,
      projet:        projetFilter  || undefined,
      assigne:       assigneFilter || undefined,
    })
      .then(data => { setItems(data); })
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => { setLoading(false); loadStats(); });
  }, [search, statut, typeFilter, etatFilter, projetFilter, assigneFilter]);

  useEffect(() => { load(); setPage(1); }, [search, statut, typeFilter, etatFilter, projetFilter, assigneFilter]);
  useEffect(() => { loadStats(); }, []);
  useEffect(() => { materielService.statsByProjet().then(setProjets).catch(() => {}); }, []);

  // Debounce de la saisie dans le champ recherche
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) {
      setSearch("");
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    // Suggestions locales immédiates (depuis items déjà chargés)
    const lower = val.toLowerCase();
    const sugg = Array.from(new Set(
      items
        .flatMap(m => [m.marque, m.modele, m.numero_serie].filter(Boolean) as string[])
        .filter(s => s.toLowerCase().includes(lower))
    )).slice(0, 6);
    setSuggestions(sugg);
    setShowSuggest(sugg.length > 0);
    // Appel API debounced (300 ms)
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setShowSuggest(false);
    }, 300);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (m: Materiel) => {
    setGererItem(null);
    setForm({
      type_materiel:    m.type_materiel,
      marque:           m.marque,
      modele:           m.modele           ?? "",
      numero_serie:     m.numero_serie     ?? "",
      adresse_mac:      m.adresse_mac      ?? "",
      numero_bon_cmd:   m.numero_bon_cmd   ?? "",
      projet:           m.projet           ?? "",
      beneficiaire_matricule: m.beneficiaire_matricule ?? "",
      beneficiaire_nom:       m.beneficiaire_nom       ?? "",
      beneficiaire_prenom:    m.beneficiaire_prenom    ?? "",
      etat:             m.etat,
      statut:           m.statut,
      date_acquisition: m.date_acquisition ?? "",
    });
    setEditing(m.id);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.marque.trim()) { toast.error("La marque est obligatoire"); return; }
    const showMac = TYPES_WITH_IP.includes(form.type_materiel);
    const payload: any = {
      type_materiel:    form.type_materiel,
      marque:           form.marque.trim(),
      modele:           form.modele?.trim() || "",
      numero_serie:     !showMac ? (form.numero_serie || null) : null,
      adresse_mac:      showMac  ? (form.adresse_mac  || null) : null,
      numero_bon_cmd:   form.numero_bon_cmd || null,
      projet:           form.projet || null,
      beneficiaire_matricule: form.beneficiaire_matricule || null,
      beneficiaire_nom:       form.beneficiaire_nom       || null,
      beneficiaire_prenom:    form.beneficiaire_prenom    || null,
      etat:             form.etat,
      date_acquisition: form.date_acquisition || null,
    };
    if (editing && form.statut) payload.statut = form.statut;
    try {
      if (editing) await materielService.update(editing, payload);
      else         await materielService.create(payload);
      toast.success(editing ? "Matériel mis à jour" : "Matériel créé");
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Erreur lors de la sauvegarde");
    }
  };

  const handleDelete = async (m: Materiel) => {
    if (!confirm(`Supprimer ${m.marque} ?`)) return;
    try {
      await materielService.delete(m.id);
      toast.success("Matériel supprimé");
      setGererItem(null);
      load();
    } catch {
      toast.error("Impossible de supprimer");
    }
  };

  const searchRecupEmp = (q: string) => {
    if (recupTimer.current) clearTimeout(recupTimer.current);
    if (!q.trim()) { setRecupEmpResults([]); setRecupEmpOpen(false); return; }
    recupTimer.current = setTimeout(async () => {
      setRecupEmpLoading(true);
      try {
        const res = await employeeService.search(q);
        setRecupEmpResults(res.slice(0, 8));
        setRecupEmpOpen(true);
      } catch { toast.error("Impossible de joindre l'API eRh"); }
      finally { setRecupEmpLoading(false); }
    }, 350);
  };

  const selectRecupEmp = (emp: any) => {
    setRecupForm((p: any) => ({
      ...p,
      employee_id:        emp.id,
      employee_nom:       emp.nom,
      employee_prenom:    emp.prenom,
      employee_matricule: emp.matricule,
      employee_service:   emp.service ?? "",
      employee_poste:     emp.fonction ?? "",
    }));
    setRecupEmpQuery(`${emp.prenom} ${emp.nom}`);
    setRecupEmpOpen(false);
    setRecupEmpResults([]);
  };

  const handleRecuperer = async () => {
    if (!recupererAttr || !gererItem) return;
    setRecupLoading(true);
    try {
      if (recupererAttr.simple) {
        // Matériel attribué via import (sans fiche d'attribution formelle) :
        // on le repasse simplement à Disponible et on efface le bénéficiaire.
        await materielService.update(gererItem.id, {
          statut: "DISPONIBLE",
          beneficiaire_matricule: null,
          beneficiaire_nom: null,
          beneficiaire_prenom: null,
        });
      } else {
        await attributionService.restituer(recupererAttr.id, {
          date_restitution:  recupForm.date_restitution,
          motif_restitution: recupForm.motif_restitution,
          notes_restitution: null,
        });
      }
      toast.success("Matériel récupéré — statut repassé à Disponible");
      setRecupererAttr(null);
      setGererItem(null);
      setGererMode("menu");
      if (parcoursItem) {
        const hist = await attributionService.getByMateriel(parcoursItem.id);
        setParcoursHistory(hist);
      }
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors de la récupération");
    } finally {
      setRecupLoading(false);
    }
  };

  const openRecuperer = async (m: Materiel) => {
    try {
      const hist = await attributionService.getByMateriel(m.id);
      const active = hist.find((a: any) => a.statut === "ACTIVE");
      if (!active) {
        // Pas de fiche d'attribution formelle : matériel issu d'un import,
        // attribué via les champs Matricule/Nom/Prénom du fichier.
        if (m.beneficiaire_nom || m.beneficiaire_prenom) {
          setRecupererAttr({
            simple: true,
            employee_nom:       m.beneficiaire_nom,
            employee_prenom:    m.beneficiaire_prenom,
            employee_matricule: m.beneficiaire_matricule,
          });
        } else {
          toast.error("Aucune attribution active trouvée");
          return;
        }
      } else {
        setRecupererAttr(active);
      }
      setRecupForm({
        date_restitution:  new Date().toISOString().split("T")[0],
        motif_restitution: "CHANGEMENT", notes_restitution: "",
        employee_id: "", employee_nom: "", employee_prenom: "",
        employee_matricule: "", employee_service: "", employee_poste: "",
        date_attribution: new Date().toISOString().split("T")[0],
        etat_remise: "BON", notes: "",
      });
      setRecupEmpQuery("");
      setGererMode("recuperer");
    } catch {
      toast.error("Impossible de charger l'attribution active");
    }
  };

  const searchAssignEmp = (q: string) => {
    if (assignTimer.current) clearTimeout(assignTimer.current);
    if (!q.trim()) { setAssignEmpResults([]); setAssignEmpOpen(false); return; }
    assignTimer.current = setTimeout(async () => {
      setAssignEmpLoading(true);
      try {
        const res = await employeeService.search(q);
        setAssignEmpResults(res.slice(0, 8));
        setAssignEmpOpen(true);
      } catch { toast.error("Impossible de joindre l'API eRh"); }
      finally { setAssignEmpLoading(false); }
    }, 350);
  };

  const selectAssignEmp = (emp: any) => {
    setAssignForm((p: any) => ({
      ...p,
      employee_id:        emp.id,
      employee_nom:       emp.nom,
      employee_prenom:    emp.prenom,
      employee_matricule: emp.matricule,
      employee_service:   emp.service ?? "",
      employee_poste:     emp.fonction ?? "",
    }));
    setAssignEmpQuery(`${emp.prenom} ${emp.nom}`);
    setAssignEmpOpen(false);
    setAssignEmpResults([]);
  };

  const openAssigner = (m: Materiel) => {
    setAssignForm({
      employee_id: "", employee_nom: "", employee_prenom: "",
      employee_matricule: "", employee_service: "", employee_poste: "",
      date_attribution: new Date().toISOString().split("T")[0],
      etat_remise: "BON", notes: "",
    });
    setAssignEmpQuery("");
    setAssignEmpResults([]);
    setAssignEmpOpen(false);
    setGererMode("assigner");
  };

  const handleAssigner = async () => {
    if (!gererItem) return;
    if (!assignForm.employee_id) { toast.error("Veuillez sélectionner un employé"); return; }
    setAssignLoading(true);
    try {
      await attributionService.create({
        materiel_id:        gererItem.id,
        employee_id:        assignForm.employee_id,
        employee_nom:       assignForm.employee_nom,
        employee_prenom:    assignForm.employee_prenom,
        employee_matricule: assignForm.employee_matricule,
        employee_service:   assignForm.employee_service,
        employee_poste:     assignForm.employee_poste,
        date_attribution:   assignForm.date_attribution,
        etat_remise:        assignForm.etat_remise,
        notes:              assignForm.notes || null,
      });
      toast.success("Matériel assigné avec succès");
      setGererItem(null);
      setGererMode("menu");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors de l'assignation");
    } finally {
      setAssignLoading(false);
    }
  };

  const openParcours = async (m: Materiel) => {
    setGererItem(null);
    setParcoursItem(m);
    setParcoursLoading(true);
    try {
      const hist = await attributionService.getByMateriel(m.id);
      setParcoursHistory(hist);
    } catch {
      toast.error("Impossible de charger l'historique");
    } finally {
      setParcoursLoading(false);
    }
  };

  const showMacField = TYPES_WITH_IP.includes(form.type_materiel);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginated   = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Export Excel stylisé (backend) ─────────────────────────────────────────
  const runExport = async () => {
    setExportLoading(true);
    try {
      await materielService.exportExcel({
        statut:        statut        || undefined,
        type_materiel: typeFilter    || undefined,
        etat:          etatFilter    || undefined,
        search:        search        || undefined,
        date_debut:    exportDateDebut || undefined,
        date_fin:      exportDateFin   || undefined,
        cols:          exportCols.size > 0 ? Array.from(exportCols).join(",") : undefined,
      });
      toast.success("Fichier Excel généré avec succès");
      setExportOpen(false);
    } catch {
      toast.error("Erreur lors de la génération du fichier");
    } finally {
      setExportLoading(false);
    }
  };


  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Gestion des matériels</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? "Chargement…" : `${items.length} équipement(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} />
            <span>Exporter</span>
            <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.xlsx</span>
          </button>
          {!isViewer && (
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} />
            <span>Importer</span>
            <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.csv</span>
          </button>
          )}
          {!isViewer && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Ajouter Matériel
          </button>
          )}
        </div>
      </div>

      {/* ── Cartes statistiques ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Total" value={stats.total ?? "—"} color="bg-camublue-900"
          onClick={() => { setStatut(""); setTypeFilter(""); setEtatFilter(""); setProjetFilter(""); setAssigneFilter(""); setSearchInput(""); setSearch(""); }}
          active={!statut && !typeFilter && !etatFilter && !projetFilter && !assigneFilter && !search} />
        <StatCard label="Disponibles" value={stats.disponible ?? "—"} color="bg-emerald-500"
          onClick={() => setStatut(statut === "DISPONIBLE" ? "" : "DISPONIBLE")}
          active={statut === "DISPONIBLE"} />
        <StatCard label="Attribués" value={stats.attribue ?? "—"} color="bg-blue-500"
          onClick={() => setStatut(statut === "ATTRIBUE" ? "" : "ATTRIBUE")}
          active={statut === "ATTRIBUE"} />
        <StatCard label="Pannes" value={stats.en_panne ?? "—"} color="bg-orange-500"
          onClick={() => setStatut(statut === "EN_PANNE" ? "" : "EN_PANNE")}
          active={statut === "EN_PANNE"} />
        <StatCard label="Maintenance" value={stats.maintenance ?? "—"} color="bg-amber-500"
          onClick={() => setStatut(statut === "MAINTENANCE" ? "" : "MAINTENANCE")}
          active={statut === "MAINTENANCE"} />
      </div>

      {/* ── Filtres avancés ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
        <div className="flex gap-3 flex-wrap items-center">

          {/* Barre de recherche avec suggestions */}
          <div ref={searchRef} className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {loading && searchInput ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
            ) : searchInput ? (
              <button onClick={() => { setSearchInput(""); setSearch(""); setSuggestions([]); setShowSuggest(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                <X size={14} />
              </button>
            ) : null}
            <input
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              placeholder="Rechercher marque, modèle, n° série…"
              className="input-base pl-9 pr-8"
            />
            {/* Suggestions dropdown */}
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

          {/* Séparateur */}
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          {/* Filtre Type */}
          <div className="flex items-center gap-1.5 min-w-[160px]">
            <Filter size={13} className="text-gray-400 shrink-0" />
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="input-base py-2 flex-1 text-sm">
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Filtre État */}
          <select value={etatFilter} onChange={e => { setEtatFilter(e.target.value); setPage(1); }}
            className="input-base py-2 w-auto text-sm">
            <option value="">Tous les états</option>
            <option value="NEUF">Neuf</option>
            <option value="BON">Bon</option>
            <option value="USAGE">Usagé</option>
            <option value="DEFECTUEUX">Défectueux</option>
          </select>

          {/* Bouton filtres personnalisés */}
          <button onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition ${
              showAdvanced || projetFilter || assigneFilter
                ? "bg-camublue-900 text-white border-camublue-900"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            <Filter size={13} /> Filtres personnalisés
            {(projetFilter || assigneFilter) && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold">
                {[projetFilter, assigneFilter].filter(Boolean).length}
              </span>
            )}
          </button>

        </div>

        {/* ── Filtres personnalisés (repliables) ── */}
        {showAdvanced && (
          <div className="flex gap-3 flex-wrap items-center mt-3 pt-3 border-t border-gray-100">
            {/* Filtre Projet */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <span className="text-xs font-semibold text-gray-500 shrink-0">Projet</span>
              <select value={projetFilter} onChange={e => { setProjetFilter(e.target.value); setPage(1); }}
                className="input-base py-2 flex-1 text-sm">
                <option value="">Tous les projets</option>
                {projets.map(p => (
                  <option key={p.projet} value={p.projet}>{p.projet} ({p.count})</option>
                ))}
              </select>
            </div>

            {/* Filtre Assignation */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <span className="text-xs font-semibold text-gray-500 shrink-0">Assignation</span>
              <select value={assigneFilter} onChange={e => { setAssigneFilter(e.target.value); setPage(1); }}
                className="input-base py-2 flex-1 text-sm">
                <option value="">Tous</option>
                <option value="OUI">Assignés</option>
                <option value="NON">Non assignés</option>
              </select>
            </div>

            {/* Réinitialiser */}
            {(projetFilter || assigneFilter) && (
              <button onClick={() => { setProjetFilter(""); setAssigneFilter(""); setPage(1); }}
                className="flex items-center gap-1 text-xs font-semibold text-camublue-900 hover:underline">
                <X size={12} /> Réinitialiser les filtres personnalisés
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Type","Marque / Modèle","N° Série / MAC","Projet","État","Statut","Assigné à","Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">Aucun matériel</td></tr>
            ) : paginated.map(m => (
              <tr key={m.id} onClick={() => setDetailItem(m)}
                className="hover:bg-gray-50/50 transition cursor-pointer">
                <td className="px-4 py-3 font-medium text-gray-700">{TYPE_LABELS[m.type_materiel] ?? m.type_materiel}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-800">{m.marque}</p>
                  {m.modele && <p className="text-xs text-gray-400">{m.modele}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {m.adresse_mac
                    ? <span className="text-blue-600">{m.adresse_mac}</span>
                    : m.numero_serie
                    ? <span className="text-gray-500">{m.numero_serie}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {m.projet ? <span className="px-2 py-0.5 bg-camublue-900/5 text-camublue-900 rounded-lg font-semibold">{m.projet}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{m.etat}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUT_COLORS[m.statut]}`}>
                    {m.statut === "EN_PANNE" && <AlertTriangle size={10} />}
                    {m.statut === "DISPONIBLE" ? "Disponible"
                      : m.statut === "ATTRIBUE"    ? "Attribué"
                      : m.statut === "MAINTENANCE" ? "Maintenance"
                      : m.statut === "EN_PANNE"    ? "En panne"
                      : m.statut === "REFORME"     ? "Réformé"
                      : m.statut}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.attribution_active ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {m.attribution_active.employee_prenom} {m.attribution_active.employee_nom}
                      </p>
                      {m.attribution_active.employee_service && (
                        <p className="text-xs text-gray-400">{m.attribution_active.employee_service}</p>
                      )}
                    </div>
                  ) : (m.beneficiaire_nom || m.beneficiaire_prenom) ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {[m.beneficiaire_prenom, m.beneficiaire_nom].filter(Boolean).join(" ")}
                      </p>
                      {m.beneficiaire_matricule && (
                        <p className="text-xs text-gray-400">Mat. {m.beneficiaire_matricule}</p>
                      )}
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setGererItem(m)}
                    className="px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white text-xs font-semibold rounded-lg transition">
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && (
        <div className="flex items-center justify-between mt-4 px-1">
          {/* Infos */}
          <p className="text-xs text-gray-400">
            {items.length === 0
              ? "Aucun résultat"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, items.length)} sur ${items.length} matériel(s)`}
          </p>

          {/* Contrôles */}
          <div className="flex items-center gap-1">
            {/* Première page */}
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">
              «
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={14} />
            </button>

            {/* Numéros de page (fenêtre glissante de 5) */}
            {(() => {
              const window = 2;
              const start  = Math.max(1, page - window);
              const end    = Math.min(totalPages, page + window);
              const pages  = Array.from({ length: end - start + 1 }, (_, i) => start + i);
              return (
                <>
                  {start > 1 && <span className="px-1 text-gray-300 text-xs">…</span>}
                  {pages.map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                        n === page
                          ? "bg-camublue-900 text-white shadow-sm"
                          : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}>
                      {n}
                    </button>
                  ))}
                  {end < totalPages && <span className="px-1 text-gray-300 text-xs">…</span>}
                </>
              );
            })()}

            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight size={14} />
            </button>
            {/* Dernière page */}
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">
              »
            </button>
          </div>

          {/* Page X / N */}
          <p className="text-xs text-gray-400">
            Page <strong className="text-gray-700">{totalPages > 0 ? page : 0}</strong> / {totalPages}
          </p>
        </div>
      )}

      {/* ── Modal Détails ─────────────────────────────────────────────────── */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-black text-camublue-900">
                    {detailItem.marque.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-camublue-900">{detailItem.marque}</p>
                  <p className="text-xs text-gray-400">{TYPE_LABELS[detailItem.type_materiel]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUT_COLORS[detailItem.statut]}`}>
                  {detailItem.statut}
                </span>
                <button onClick={() => setDetailItem(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Infos */}
            <div className="px-6 py-5 space-y-0 divide-y divide-gray-50">

              {/* Identification */}
              <div className="pb-4 space-y-2.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Identification</p>
                {[
                  { label: "Type",        value: TYPE_LABELS[detailItem.type_materiel] },
                  { label: "Marque",      value: detailItem.marque },
                  { label: "Modèle",      value: detailItem.modele },
                  { label: "N° Série",    value: detailItem.numero_serie },
                  { label: "Adresse MAC", value: detailItem.adresse_mac },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{row.label}</span>
                    <span className="text-xs font-semibold text-gray-700 font-mono">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Acquisition */}
              <div className="py-4 space-y-2.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Acquisition</p>
                {[
                  { label: "N° PO",       value: detailItem.numero_bon_cmd },
                  { label: "Projet",      value: detailItem.projet },
                  { label: "Date",        value: detailItem.date_acquisition
                      ? new Date(detailItem.date_acquisition).toLocaleDateString("fr-FR")
                      : null },
                  { label: "État",        value: detailItem.etat },
                  { label: "Enregistré",  value: new Date(detailItem.created_at).toLocaleDateString("fr-FR") },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{row.label}</span>
                    <span className="text-xs font-semibold text-gray-700">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Description */}
              {detailItem.description && (
                <div className="py-4 space-y-1.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Description</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{detailItem.description}</p>
                </div>
              )}

              {/* Attribution */}
              {detailItem.attribution_active ? (
                <div className="pt-4 space-y-2.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Assigné à</p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-camublue-900">
                        {detailItem.attribution_active.employee_nom.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {detailItem.attribution_active.employee_prenom} {detailItem.attribution_active.employee_nom}
                      </p>
                      <p className="text-xs text-gray-400">
                        {detailItem.attribution_active.employee_matricule}
                        {detailItem.attribution_active.employee_service ? ` · ${detailItem.attribution_active.employee_service}` : ""}
                        {detailItem.attribution_active.employee_poste ? ` · ${detailItem.attribution_active.employee_poste}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (detailItem.beneficiaire_nom || detailItem.beneficiaire_prenom) ? (
                <div className="pt-4 space-y-2.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Assigné à</p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-camublue-900">
                        {(detailItem.beneficiaire_nom ?? detailItem.beneficiaire_prenom ?? "?").charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {[detailItem.beneficiaire_prenom, detailItem.beneficiaire_nom].filter(Boolean).join(" ")}
                      </p>
                      {detailItem.beneficiaire_matricule && (
                        <p className="text-xs text-gray-400">Matricule {detailItem.beneficiaire_matricule}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  <span className="text-xs text-gray-300">Non assigné</span>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Modal Parcours ────────────────────────────────────────────────── */}
      {parcoursItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Parcours matériel</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {parcoursItem.marque} {parcoursItem.modele || ""} — {TYPE_LABELS[parcoursItem.type_materiel]}
                </p>
              </div>
              <button onClick={() => { setParcoursItem(null); setParcoursHistory([]); setRecupererAttr(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* Timeline ou Formulaire récupération */}
            <div className="overflow-y-auto px-6 py-5 flex-1">
              {parcoursLoading ? (
                <p className="text-center text-gray-400 py-10">Chargement…</p>

              ) : recupererAttr ? (
                /* ── Formulaire Récupérer ── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => { setRecupererAttr(null); setRecupEmpQuery(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition">← Retour</button>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    Récupéré de <strong>{recupererAttr.employee_prenom} {recupererAttr.employee_nom}</strong> — saisir la date de récupération puis désigner le prochain utilisateur.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de récupération</label>
                      <input type="date" value={recupForm.date_restitution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, date_restitution: e.target.value }))}
                        className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motif</label>
                      <select value={recupForm.motif_restitution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, motif_restitution: e.target.value }))}
                        className="input-base">
                        {[["CHANGEMENT","Changement"],["DEPART","Départ"],["PANNE","Panne"],["FIN_CONTRAT","Fin contrat"],["AUTRE","Autre"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note de récupération</label>
                    <input type="text" value={recupForm.notes_restitution}
                      onChange={e => setRecupForm((p: any) => ({ ...p, notes_restitution: e.target.value }))}
                      placeholder="Optionnel…" className="input-base" />
                  </div>

                  <hr className="border-gray-100" />
                  <p className="text-xs font-bold text-camublue-900 uppercase tracking-wide">Nouvel utilisateur</p>

                  {/* Recherche employé */}
                  <div className="relative">
                    {recupForm.employee_id ? (
                      <div className="flex items-center gap-3 p-3 bg-camublue-900/5 border border-camublue-900/20 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-camublue-900">
                            {(recupForm.employee_prenom || recupForm.employee_nom || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{recupForm.employee_prenom} {recupForm.employee_nom}</p>
                          <p className="text-xs text-gray-400">{recupForm.employee_matricule}{recupForm.employee_service ? ` · ${recupForm.employee_service}` : ""}</p>
                        </div>
                        <button onClick={() => { setRecupForm((p: any) => ({ ...p, employee_id: "" })); setRecupEmpQuery(""); }}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={recupEmpQuery}
                          onChange={e => { setRecupEmpQuery(e.target.value); searchRecupEmp(e.target.value); }}
                          onFocus={() => recupEmpResults.length > 0 && setRecupEmpOpen(true)}
                          placeholder="Rechercher le nouvel employé…"
                          className="input-base pl-8 pr-7" autoFocus />
                        {recupEmpLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
                        )}
                      </div>
                    )}
                    {recupEmpOpen && recupEmpResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {recupEmpResults.map(emp => (
                          <button key={emp.id} type="button" onClick={() => selectRecupEmp(emp)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-camublue-900/5 transition text-left border-b border-gray-50 last:border-0">
                            <div className="w-7 h-7 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-camublue-900">{(emp.prenom || emp.nom).charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{emp.prenom} {emp.nom}</p>
                              <p className="text-xs text-gray-400">{emp.matricule}{emp.service ? ` · ${emp.service}` : ""}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date d'attribution</label>
                      <input type="date" value={recupForm.date_attribution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, date_attribution: e.target.value }))}
                        className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">État à la remise</label>
                      <select value={recupForm.etat_remise}
                        onChange={e => setRecupForm((p: any) => ({ ...p, etat_remise: e.target.value }))}
                        className="input-base">
                        {["NEUF","BON","USAGE"].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setRecupererAttr(null); setRecupEmpQuery(""); }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={handleRecuperer} disabled={recupLoading}
                      className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {recupLoading
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours…</>
                        : "Confirmer la récupération"}
                    </button>
                  </div>
                </div>

              ) : parcoursHistory.length === 0 ? (
                <div className="text-center py-10">
                  <History size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucune attribution enregistrée pour ce matériel.</p>
                </div>

              ) : (
                /* ── Timeline ── */
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
                  <div className="space-y-3">
                    {parcoursHistory.map((a, idx) => {
                      const isActive  = a.statut === "ACTIVE";
                      const dateDebut = new Date(a.date_attribution).toLocaleDateString("fr-FR");
                      const dateFin   = a.date_restitution
                        ? new Date(a.date_restitution).toLocaleDateString("fr-FR") : null;
                      const duree = (() => {
                        const start = new Date(a.date_attribution);
                        const end   = a.date_restitution ? new Date(a.date_restitution) : new Date();
                        const j = Math.round((end.getTime() - start.getTime()) / 86400000);
                        if (j < 30)  return `${j}j`;
                        if (j < 365) return `${Math.round(j / 30)} mois`;
                        return `${(j / 365).toFixed(1)} an(s)`;
                      })();
                      const MOTIF: Record<string, string> = {
                        DEPART: "Départ", CHANGEMENT: "Changement", PANNE: "Panne",
                        FIN_CONTRAT: "Fin contrat", AUTRE: "Autre",
                      };
                      // Transition entre cette entrée et la suivante
                      const next = parcoursHistory[idx + 1];
                      const gapJours = (!isActive && next)
                        ? Math.round((new Date(next.date_attribution).getTime() - new Date(a.date_restitution).getTime()) / 86400000)
                        : null;

                      return (
                        <div key={a.id}>
                          <div className="relative pl-10">
                            {/* Pastille */}
                            <div className={`absolute left-0 top-2 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10
                              ${isActive ? "bg-emerald-400" : "bg-gray-300"}`}>
                              <span className="text-xs font-black text-white">
                                {(a.employee_prenom || a.employee_nom || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>

                            {/* Carte */}
                            <div className={`rounded-xl border p-3.5 ${isActive
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-gray-100 bg-white"}`}>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div>
                                  <p className="font-semibold text-gray-800 text-sm">
                                    {a.employee_prenom} {a.employee_nom}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {a.employee_matricule}
                                    {a.employee_service ? ` · ${a.employee_service}` : ""}
                                    {a.employee_poste   ? ` · ${a.employee_poste}`   : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                                    ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                    {isActive ? "En cours" : "Clôturé"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                                <span>Du <strong className="text-gray-700">{dateDebut}</strong>
                                  {dateFin
                                    ? <> → Récupéré le <strong className="text-amber-700">{dateFin}</strong></>
                                    : <> → <strong className="text-emerald-600">aujourd'hui</strong></>}
                                </span>
                                <span className="text-gray-400">({duree})</span>
                                {a.motif_restitution && <span>· Motif : <strong>{MOTIF[a.motif_restitution]}</strong></span>}
                              </div>
                              {(a.notes || a.notes_restitution) && (
                                <p className="mt-1.5 text-xs text-gray-400 italic">
                                  {a.notes_restitution || a.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Connecteur entre deux attributions */}
                          {gapJours !== null && (
                            <div className="pl-10 py-1.5 flex items-center gap-2">
                              <div className="flex-1 h-px bg-dashed border-t border-dashed border-gray-200" />
                              <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-50 rounded-full shrink-0">
                                {gapJours <= 0 ? "Réattribué le même jour" : `${gapJours}j en stock`}
                              </span>
                              <div className="flex-1 h-px border-t border-dashed border-gray-200" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer stats */}
            {!parcoursLoading && !recupererAttr && parcoursHistory.length > 0 && (
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0 flex gap-6 text-xs text-gray-500">
                <span><strong className="text-gray-700">{parcoursHistory.length}</strong> utilisateur(s)</span>
                <span><strong className="text-gray-700">{parcoursHistory.filter(a => a.statut === "CLOTUREE").length}</strong> récupération(s)</span>
                {parcoursHistory.some(a => a.statut === "ACTIVE") && (
                  <span className="text-emerald-600 font-semibold">Attribution active</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Gérer ───────────────────────────────────────────────────── */}
      {gererItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`bg-white rounded-2xl shadow-2xl w-full ${gererMode === "assigner" ? "max-w-sm" : "max-w-xs"}`}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {(gererMode === "recuperer" || gererMode === "assigner") && (
                  <button onClick={() => { setGererMode("menu"); setRecupererAttr(null); setRecupEmpQuery(""); setAssignEmpQuery(""); }}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <div>
                  <p className="font-bold text-camublue-900">
                    {gererMode === "recuperer" ? "Récupérer le matériel"
                      : gererMode === "assigner" ? "Assigner le matériel"
                      : gererItem.marque}
                  </p>
                  <p className="text-xs text-gray-400">
                    {gererMode === "recuperer" || gererMode === "assigner"
                      ? `${gererItem.marque} — ${TYPE_LABELS[gererItem.type_materiel]}`
                      : TYPE_LABELS[gererItem.type_materiel]}
                  </p>
                </div>
              </div>
              <button onClick={() => { setGererItem(null); setGererMode("menu"); setRecupererAttr(null); setRecupEmpQuery(""); setAssignEmpQuery(""); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={16} />
              </button>
            </div>

            {/* ── Menu principal ── */}
            {gererMode === "menu" && (
              <div className="p-3 space-y-1.5">
                {!isViewer && (
                <button onClick={() => openEdit(gererItem)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left">
                  <div className="w-8 h-8 rounded-lg bg-camublue-900/10 flex items-center justify-center shrink-0">
                    <Pencil size={14} className="text-camublue-900" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Modifier</p>
                    <p className="text-xs text-gray-400">Éditer les informations</p>
                  </div>
                </button>
                )}

                {!isViewer && gererItem.statut === "DISPONIBLE" && (
                  <button onClick={() => openAssigner(gererItem)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-50 transition text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <User size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Assigner</p>
                      <p className="text-xs text-gray-400">Attribuer à un employé</p>
                    </div>
                  </button>
                )}

                {!isViewer && gererItem.statut === "ATTRIBUE" && (
                  <button onClick={() => openRecuperer(gererItem)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-amber-50 transition text-left">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <History size={14} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Récupérer</p>
                      <p className="text-xs text-gray-400">Reprendre & réattribuer à un autre</p>
                    </div>
                  </button>
                )}

                <button onClick={() => openParcours(gererItem)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <History size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Parcours matériel</p>
                    <p className="text-xs text-gray-400">Historique des utilisateurs</p>
                  </div>
                </button>

                {!isViewer && (
                <button onClick={() => handleDelete(gererItem)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition text-left">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-600">Supprimer</p>
                    <p className="text-xs text-gray-400">Retirer définitivement</p>
                  </div>
                </button>
                )}
              </div>
            )}

            {/* ── Formulaire récupération ── */}
            {gererMode === "recuperer" && recupererAttr && (
              <div className="px-5 py-4 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  Actuellement attribué à <strong>{recupererAttr.employee_prenom} {recupererAttr.employee_nom}</strong>
                  {recupererAttr.employee_service ? ` · ${recupererAttr.employee_service}` : ""}
                  {recupererAttr.employee_matricule ? ` (${recupererAttr.employee_matricule})` : ""}
                </div>

                {recupererAttr.simple ? (
                  <p className="text-xs text-gray-500">
                    Ce matériel a été importé avec un bénéficiaire renseigné mais sans fiche d'attribution.
                    La récupération va le repasser au statut <strong>Disponible</strong> et effacer le bénéficiaire.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de récupération</label>
                      <input type="date" value={recupForm.date_restitution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, date_restitution: e.target.value }))}
                        className="input-base" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motif</label>
                      <select value={recupForm.motif_restitution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, motif_restitution: e.target.value }))}
                        className="input-base">
                        {[["CHANGEMENT","Changement"],["DEPART","Départ"],["PANNE","Panne"],["FIN_CONTRAT","Fin contrat"],["AUTRE","Autre"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setGererMode("menu"); setRecupererAttr(null); }}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleRecuperer} disabled={recupLoading}
                    className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                    {recupLoading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours…</>
                      : "Récupérer"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Formulaire assignation ── */}
            {gererMode === "assigner" && (
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employé</label>
                  {assignForm.employee_id ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-gray-200 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-camublue-900">
                          {(assignForm.employee_prenom || assignForm.employee_nom || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{assignForm.employee_prenom} {assignForm.employee_nom}</p>
                        <p className="text-xs text-gray-400 truncate">{assignForm.employee_matricule}{assignForm.employee_service ? ` · ${assignForm.employee_service}` : ""}</p>
                      </div>
                      <button onClick={() => { setAssignForm((p: any) => ({ ...p, employee_id: "" })); setAssignEmpQuery(""); }}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={assignEmpQuery}
                        onChange={e => { setAssignEmpQuery(e.target.value); searchAssignEmp(e.target.value); }}
                        onFocus={() => assignEmpResults.length > 0 && setAssignEmpOpen(true)}
                        placeholder="Rechercher un employé…"
                        className="input-base pl-8" />
                      {assignEmpLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
                      )}
                      {assignEmpOpen && assignEmpResults.length > 0 && (
                        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                          {assignEmpResults.map(emp => (
                            <button key={emp.id} type="button" onClick={() => selectAssignEmp(emp)}
                              className="w-full flex flex-col items-start px-3 py-2 hover:bg-camublue-900/5 text-left border-b border-gray-50 last:border-0 transition">
                              <span className="text-sm font-semibold text-gray-800">{emp.prenom} {emp.nom}</span>
                              <span className="text-xs text-gray-400">{emp.matricule}{emp.service ? ` · ${emp.service}` : ""}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date d'attribution</label>
                    <input type="date" value={assignForm.date_attribution}
                      onChange={e => setAssignForm((p: any) => ({ ...p, date_attribution: e.target.value }))}
                      className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">État remise</label>
                    <select value={assignForm.etat_remise}
                      onChange={e => setAssignForm((p: any) => ({ ...p, etat_remise: e.target.value }))}
                      className="input-base">
                      <option value="NEUF">Neuf</option>
                      <option value="BON">Bon</option>
                      <option value="USAGE">Usagé</option>
                      <option value="DEFECTUEUX">Défectueux</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
                  <input type="text" value={assignForm.notes}
                    onChange={e => setAssignForm((p: any) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optionnel" className="input-base" />
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setGererMode("menu")}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleAssigner} disabled={assignLoading}
                    className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                    {assignLoading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours…</>
                      : "Assigner"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Formulaire (ajout / modification) ───────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-camublue-900">
                {editing ? "Modifier le matériel" : "Nouveau matériel"}
              </h2>
              <button onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
                  <select value={form.type_materiel}
                    onChange={e => setForm((p: any) => ({ ...p, type_materiel: e.target.value }))}
                    className="input-base">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Marque <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.marque}
                    onChange={e => setForm((p: any) => ({ ...p, marque: e.target.value }))}
                    placeholder="Dell, HP…" className="input-base" autoFocus />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Modèle</label>
                <input type="text" value={form.modele}
                  onChange={e => setForm((p: any) => ({ ...p, modele: e.target.value }))}
                  placeholder="Latitude 5420, EliteBook 840…" className="input-base" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {showMacField ? "Adresse MAC" : "N° Série"}
                </label>
                {showMacField ? (
                  <input type="text" value={form.adresse_mac}
                    onChange={e => setForm((p: any) => ({ ...p, adresse_mac: e.target.value }))}
                    placeholder="AA:BB:CC:DD:EE:FF" className="input-base" />
                ) : (
                  <input type="text" value={form.numero_serie}
                    onChange={e => setForm((p: any) => ({ ...p, numero_serie: e.target.value }))}
                    placeholder="SN-XXXXXXXX" className="input-base" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">N° PO</label>
                  <input type="text" value={form.numero_bon_cmd}
                    onChange={e => setForm((p: any) => ({ ...p, numero_bon_cmd: e.target.value }))}
                    placeholder="PO-2025-XXXX" className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Projet</label>
                  <input type="text" value={form.projet ?? ""}
                    onChange={e => setForm((p: any) => ({ ...p, projet: e.target.value }))}
                    placeholder="FO, ESCO, BTS…" className="input-base" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">État</label>
                  <select value={form.etat}
                    onChange={e => setForm((p: any) => ({ ...p, etat: e.target.value }))}
                    className="input-base">
                    <option value="NEUF">Neuf</option>
                    <option value="BON">Bon</option>
                    <option value="USAGE">Usagé</option>
                    <option value="DEFECTUEUX">Défectueux</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Acquisition</label>
                  <input type="date" value={form.date_acquisition}
                    onChange={e => setForm((p: any) => ({ ...p, date_acquisition: e.target.value }))}
                    className="input-base" />
                </div>
              </div>

              {/* Statut — uniquement en mode édition */}
              {editing && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Statut</label>
                  <select value={form.statut ?? ""}
                    onChange={e => setForm((p: any) => ({ ...p, statut: e.target.value || undefined }))}
                    className="input-base">
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="EN_PANNE">En panne</option>
                    <option value="REFORME">Réformé</option>
                  </select>
                  {form.statut === "EN_PANNE" && (
                    <p className="mt-1.5 text-xs text-orange-600 flex items-center gap-1">
                      <AlertTriangle size={11} /> Ce matériel ne pourra plus être attribué tant qu'il est en panne.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setFormOpen(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Export personnalisé ─────────────────────────────────────── */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Exporter les matériels</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fichier Excel (.xlsx) mis en forme · {items.length} matériel(s) chargés
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
                  Période (date d'acquisition)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Du</label>
                    <input type="date" value={exportDateDebut}
                      onChange={e => setExportDateDebut(e.target.value)}
                      className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Au</label>
                    <input type="date" value={exportDateFin}
                      onChange={e => setExportDateFin(e.target.value)}
                      className="input-base" />
                  </div>
                </div>
                {(exportDateDebut || exportDateFin) && (() => {
                  const n = items.filter(m =>
                    (!exportDateDebut || (m.date_acquisition && m.date_acquisition >= exportDateDebut)) &&
                    (!exportDateFin   || (m.date_acquisition && m.date_acquisition <= exportDateFin))
                  ).length;
                  return (
                    <p className="text-xs text-camublue-900 font-semibold mt-1.5">
                      → {n} matériel(s) correspondant à cette période
                    </p>
                  );
                })()}
              </div>

              {/* Colonnes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Colonnes à inclure</p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols(new Set(ALL_COLS.map(c => c.key)))}
                      className="text-xs text-camublue-900 font-semibold hover:underline">Tout</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setExportCols(new Set())}
                      className="text-xs text-gray-400 hover:underline">Aucun</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_COLS.map(({ key, label }) => (
                    <label key={key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition text-sm
                        ${exportCols.has(key)
                          ? "bg-camublue-900/5 border-camublue-900/20 text-camublue-900 font-semibold"
                          : "border-gray-100 text-gray-400 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={exportCols.has(key)}
                        onChange={() => toggleCol(key)}
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
                  onClick={runExport}
                  className="flex-1 flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                  {exportLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération…</>
                    : <><Download size={14} /> Télécharger .xlsx</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Import ──────────────────────────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Importer des matériels</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fichier CSV avec séparateur point-virgule</p>
              </div>
              <button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Résultat après import */}
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-emerald-600 font-bold text-sm">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">{importResult.created} matériel(s) importé(s)</p>
                      {importResult.errors.length > 0 && (
                        <p className="text-xs text-emerald-600">{importResult.errors.length} ligne(s) ignorée(s)</p>
                      )}
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1 max-h-36 overflow-y-auto">
                      <p className="text-xs font-semibold text-amber-700 mb-1.5">Lignes ignorées :</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-amber-600">Ligne {e.ligne} — {e.message}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
                    className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  <label className={`flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition
                    ${importFile ? "border-camublue-900/40 bg-camublue-900/5" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"}`}>
                    <Upload size={22} className={importFile ? "text-camublue-900" : "text-gray-300"} />
                    {importFile
                      ? <span className="text-sm font-semibold text-camublue-900">{importFile.name}</span>
                      : <span className="text-sm text-gray-400">Cliquer pour choisir un fichier .csv ou .xlsx</span>
                    }
                    <input type="file" accept=".csv,.xlsx" className="hidden"
                      onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
                  </label>
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                    <p className="font-semibold text-gray-600">Fichier .csv — colonnes attendues :</p>
                    <p className="font-mono">Type ; Marque ; Modèle ; N° Série ; Adresse MAC ; N° PO ; État ; Acquisition</p>
                    <p className="font-semibold text-gray-600 pt-1">Fichier .xlsx « Suivi Parc » — toutes les colonnes sont récupérées :</p>
                    <p className="font-mono">Matricule ; Nom ; Prenom ; Projet ; Nature ; Désignation Equipement ; Ref Carte Réseau ; N° Serie ; PO ; Date d'attribution ; Statut</p>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button
                      disabled={!importFile || importLoading}
                      onClick={async () => {
                        if (!importFile) return;
                        setImportLoading(true);
                        try {
                          const res = await materielService.import(importFile);
                          setImportResult(res);
                          load();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.detail ?? "Erreur lors de l'import");
                        } finally {
                          setImportLoading(false);
                        }
                      }}
                      className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {importLoading
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Import…</>
                        : "Importer"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

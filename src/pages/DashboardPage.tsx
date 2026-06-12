import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Monitor, CheckCircle, Wrench, Archive, Smartphone,
  ClipboardList, AlertTriangle, AlertCircle, Info, Users, BarChart2,
  Receipt, Wallet, TrendingUp, TrendingDown, Phone, MapPin, X, ArrowRight,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { materielService, simService, attributionService, factureService, siteService } from "@/services/api";
import type { FactureTelecom, NumeroSIM, Materiel, Attribution, SiteGSM } from "@/types";

interface Stats       { total: number; disponible: number; attribue: number; maintenance: number; reforme: number; }
interface TypeRow     { type: string; count: number; }
interface BrandRow    { marque: string; count: number; }
interface AttrStats   { active: number; cloturee: number; employees_actifs: number; par_service: { service: string; count: number }[]; }

const MOIS_COURTS = ["","Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
const MOIS_LABELS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

type Section = "factures" | "materiels" | "telephonie" | "attributions";

// ── Libellés type matériel ────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  ORDINATEUR_PORTABLE: "PC Portable",
  ORDINATEUR_FIXE:     "PC Bureau",
  ECRAN:               "Écran",
  SOURIS:              "Souris",
  CLAVIER:             "Clavier",
  TELEPHONE:           "Téléphone",
  IMPRIMANTE:          "Imprimante",
  SWITCH:              "Switch",
  ROUTEUR:             "Routeur",
  ONDULEUR:            "Onduleur",
  AUTRE:               "Autre",
};

const TYPE_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444",
  "#06b6d4","#f97316","#84cc16","#ec4899","#6366f1","#14b8a6",
];

// ── Donut chart SVG ───────────────────────────────────────────────────────────
function DonutChart({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const R = 48, C = 2 * Math.PI * R;
  let cumul = 0;
  const arcs = segments.map(s => {
    const len = total > 0 ? (s.value / total) * C : 0;
    const arc = { ...s, dasharray: `${len} ${C - len}`, dashoffset: C / 4 - cumul };
    cumul += len;
    return arc;
  });
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="w-40 h-40">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {arcs.map(a => (
          <circle key={a.label} cx="60" cy="60" r={R} fill="none"
            stroke={a.color} strokeWidth="16"
            strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute text-center pointer-events-none">
        <p className="text-2xl font-black text-gray-800">{total}</p>
        <p className="text-[10px] text-gray-400">total</p>
      </div>
    </div>
  );
}

// ── Barre horizontale ─────────────────────────────────────────────────────────
function BarRow({ label, value, max, colorHex, colorTw }: {
  label: string; value: number; max: number; colorHex?: string; colorTw?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 truncate max-w-[140px]">{label}</span>
        <span className="font-bold text-gray-700 shrink-0 ml-2">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {colorHex ? (
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: colorHex }} />
        ) : (
          <div className={`h-full rounded-full transition-all duration-700 ${colorTw}`} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

// ── Courbe d'évolution ────────────────────────────────────────────────────────
function LineChart({ data, colorHex = "#1e3a5f", onPointClick }: { data: { label: string; value: number }[]; colorHex?: string; onPointClick?: (index: number) => void }) {
  const W = 600, H = 220, padX = 24, padY = 24;
  const max = Math.max(1, ...data.map(d => d.value));
  const min = Math.min(0, ...data.map(d => d.value));
  const range = max - min || 1;
  const stepX = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (d.value - min) / range) * (H - padY * 2);
    return { x, y, ...d };
  });

  // Courbe lissée (interpolation Catmull-Rom → Bézier cubique)
  const smoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padX} ${H - padY} L ${points[0]?.x ?? padX} ${H - padY} Z`;
  const gradId = `lineChartGradient-${colorHex.replace("#", "")}`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" style={{ minWidth: 480 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorHex} stopOpacity="0.25" />
            <stop offset="100%" stopColor={colorHex} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* lignes de grille horizontales */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={padX} x2={W - padX} y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {/* zone sous la courbe */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {/* courbe */}
        <path d={linePath} fill="none" stroke={colorHex} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {/* points */}
        {points.map((p, i) => (
          <g key={p.label} onClick={() => onPointClick?.(i)} style={onPointClick ? { cursor: "pointer" } : undefined}>
            {onPointClick && <circle cx={p.x} cy={p.y} r="10" fill="transparent" />}
            <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={colorHex} strokeWidth="2.5" />
            {p.value > 0 && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
                {Math.round(p.value / 1000).toLocaleString("fr-FR")}k
              </text>
            )}
          </g>
        ))}
        {/* labels mois */}
        {points.map(p => (
          <text key={p.label} x={p.x} y={H + 16} textAnchor="middle" fontSize="11" fill="#9ca3af">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, bg, text }: { label: string; value: number; icon: React.ReactNode; bg: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex flex-col items-center text-center gap-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <span className={text}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-gray-800">{value.toLocaleString("fr-FR")}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Mini stat inline ──────────────────────────────────────────────────────────
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 text-center mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

// ── Stat tile (texte centré, bordure épaisse) ──────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white border-2 border-camublue-900/15 rounded-xl px-3 py-3.5 shadow-sm text-center">
      <p className="text-camublue-900/50 uppercase tracking-wide text-[10px] font-semibold">{label}</p>
      <p className={`font-bold mt-1 text-sm ${accent ?? "text-camublue-900"}`}>{value}</p>
    </div>
  );
}

// ── Alerte ────────────────────────────────────────────────────────────────────
type AlertLevel = "danger" | "warning" | "info";
function AlertCard({ level, message }: { level: AlertLevel; message: string }) {
  const cfg = {
    danger:  { bg: "bg-red-50 border-red-200",    text: "text-red-700",   icon: <AlertCircle   size={14} className="text-red-500"   /> },
    warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: <AlertTriangle size={14} className="text-amber-500" /> },
    info:    { bg: "bg-blue-50 border-blue-200",   text: "text-blue-700",  icon: <Info          size={14} className="text-blue-500"  /> },
  }[level];
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${cfg.bg}`}>
      <span className="mt-0.5 shrink-0">{cfg.icon}</span>
      <p className={`text-xs font-medium ${cfg.text}`}>{message}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [section,    setSection]    = useState<Section>("factures");
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [byType,     setByType]     = useState<TypeRow[]>([]);
  const [byBrand,    setByBrand]    = useState<BrandRow[]>([]);
  const [attrStats,  setAttrStats]  = useState<AttrStats | null>(null);
  const [sims,       setSims]       = useState<NumeroSIM[]>([]);
  const [factures,   setFactures]   = useState<FactureTelecom[]>([]);
  const [factLoading, setFactLoading] = useState(true);
  const [materiels,    setMateriels]    = useState<Materiel[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [monthModal, setMonthModal] = useState<number | null>(null);
  const [sitesRMS,    setSitesRMS]    = useState<SiteGSM[]>([]);
  const [rmsPeriodeIdx, setRmsPeriodeIdx] = useState<number | null>(null);
  const [telSubSection, setTelSubSection] = useState<"sims" | "rms" | "sims-cout" | "vehicules-cout">("sims");
  const [sitesEvolution, setSitesEvolution] = useState<{
    mois: number; annee: number; total: number; nombre_numeros: number;
    ecart: number | null; ecart_pct: number | null;
  }[]>([]);
  const [simsCoutEvolution, setSimsCoutEvolution] = useState<{
    mois: number; annee: number; total: number; nombre_numeros: number;
    ecart: number | null; ecart_pct: number | null;
  }[]>([]);
  const [simsCoutPeriodeIdx, setSimsCoutPeriodeIdx] = useState<number | null>(null);
  const [vehiculesCoutEvolution, setVehiculesCoutEvolution] = useState<{
    mois: number; annee: number; total: number; nombre_numeros: number;
    ecart: number | null; ecart_pct: number | null;
  }[]>([]);
  const [vehiculesCoutPeriodeIdx, setVehiculesCoutPeriodeIdx] = useState<number | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    materielService.stats().then(setStats).catch(() => {});
    materielService.statsByType().then(setByType).catch(() => {});
    materielService.statsByBrand().then(setByBrand).catch(() => {});
    materielService.getAll().then(setMateriels).catch(() => {});
    attributionService.stats().then(setAttrStats).catch(() => {});
    attributionService.getAll().then(setAttributions).catch(() => {});
    simService.getAll().then(setSims).catch(() => {});
    factureService.getAll({ annee: currentYear })
      .then(setFactures).catch(() => {}).finally(() => setFactLoading(false));
    siteService.getAll().then(setSitesRMS).catch(() => {});
    siteService.statsEvolution().then(setSitesEvolution).catch(() => {});
    simService.statsEvolution("EMPLOYE").then(setSimsCoutEvolution).catch(() => {});
    simService.statsEvolution("M2M_VEHICULE").then(setVehiculesCoutEvolution).catch(() => {});
  }, []);

  // Alertes
  const alerts: { level: AlertLevel; message: string }[] = [];
  if (stats) {
    const maintenancePct = stats.total > 0 ? stats.maintenance / stats.total : 0;
    const disponiblePct  = stats.total > 0 ? stats.disponible  / stats.total : 1;
    if (stats.reforme > 0)
      alerts.push({ level: "danger",  message: `${stats.reforme} matériel(s) réformé(s) — à retirer du parc` });
    if (maintenancePct > 0.15)
      alerts.push({ level: "danger",  message: `Taux maintenance élevé : ${(maintenancePct*100).toFixed(0)}% (${stats.maintenance} mat.)` });
    else if (stats.maintenance > 0)
      alerts.push({ level: "warning", message: `${stats.maintenance} matériel(s) en cours de maintenance` });
    if (stats.total > 0 && disponiblePct < 0.2)
      alerts.push({ level: "warning", message: `Seulement ${stats.disponible} matériel(s) disponibles (${(disponiblePct*100).toFixed(0)}%)` });
    if (alerts.length === 0)
      alerts.push({ level: "info", message: "Aucun écart détecté — le parc est en bon état." });
  }

  const donutSegments = stats ? [
    { label: "Disponible",  value: stats.disponible,  color: "#10b981" },
    { label: "Attribué",    value: stats.attribue,    color: "#3b82f6" },
    { label: "Maintenance", value: stats.maintenance, color: "#f59e0b" },
    { label: "Réformé",     value: stats.reforme,     color: "#ef4444" },
  ] : [];

  const maxType  = byType[0]?.count  ?? 1;
  const maxBrand = byBrand[0]?.count ?? 1;
  const maxSvc   = attrStats?.par_service[0]?.count ?? 1;

  // ── Statistiques Factures ──────────────────────────────────────────────────
  const factureTotal = (f: FactureTelecom) =>
    f.montant_ttc != null
      ? parseFloat(f.montant_ttc)
      : f.lignes.reduce((s, l) => s + parseFloat(l.montant || "0"), 0);

  const totalFactures   = factures.reduce((s, f) => s + factureTotal(f), 0);
  const nbFactures      = factures.length;
  const moyenneFacture  = nbFactures > 0 ? totalFactures / nbFactures : 0;
  const sortedFactures  = [...factures].sort((a, b) => a.mois - b.mois);
  const dernierEcart    = sortedFactures.length > 0 ? sortedFactures[sortedFactures.length - 1].ecart : null;
  const dernierEcartVal = dernierEcart != null ? parseFloat(dernierEcart) : null;

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1;
    const f = factures.find(x => x.mois === mois);
    return { label: MOIS_COURTS[mois], value: f ? factureTotal(f) : 0 };
  });

  const modalFacture  = monthModal != null ? factures.find(f => f.mois === monthModal) ?? null : null;

  const operateurMap = new Map<string, number>();
  factures.forEach(f => {
    const key = f.operateur ?? "Inconnu";
    operateurMap.set(key, (operateurMap.get(key) ?? 0) + factureTotal(f));
  });
  const operateurRows = Array.from(operateurMap.entries())
    .map(([operateur, total]) => ({ operateur, total }))
    .sort((a, b) => b.total - a.total);
  const maxOperateur = operateurRows[0]?.total ?? 1;

  // ── Statistiques SIM / Téléphonie ──────────────────────────────────────────
  const simByCategorie = new Map<string, number>();
  const simByStatut    = new Map<string, number>();
  sims.forEach(s => {
    simByCategorie.set(s.categorie, (simByCategorie.get(s.categorie) ?? 0) + 1);
    simByStatut.set(s.statut, (simByStatut.get(s.statut) ?? 0) + 1);
  });
  const CATEGORIE_LABELS: Record<string, string> = {
    EMPLOYE: "Employé", M2M_SITE: "Site M2M", M2M_VEHICULE: "Véhicule M2M",
  };
  const STATUT_LABELS: Record<string, string> = {
    ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDUE: "Suspendue", RESILIE: "Résiliée", CEDE: "Cédée",
  };
  const maxSimCategorie = Math.max(1, ...Array.from(simByCategorie.values()));
  const simActives = simByStatut.get("ACTIVE") ?? 0;

  // ── Statistiques Sites RMS ──────────────────────────────────────────────────
  const sitesOrange = sitesRMS.filter(s => (s.sim_operateur ?? "Orange") === "Orange").length;
  const sitesFree   = sitesRMS.filter(s => s.sim_operateur === "Free").length;
  const sitesAvecSim = sitesRMS.filter(s => s.sim_numero).length;
  const sitesSansSim = sitesRMS.length - sitesAvecSim;

  const sortedEvolution = [...sitesEvolution].sort((a, b) => (a.annee * 100 + a.mois) - (b.annee * 100 + b.mois));
  const rmsCoutData = sortedEvolution.map(p => ({ label: `${MOIS_COURTS[p.mois]} ${p.annee}`, value: p.total }));
  const dernierRmsPeriode = sortedEvolution[sortedEvolution.length - 1] ?? null;
  const rmsRepartitionSegments = [
    { label: "RMS_Orange", value: sitesOrange, color: "#f97316" },
    { label: "RMS_Free",   value: sitesFree,   color: "#ef4444" },
  ];

  // ── Statistiques SIM Employés — Coûts ──────────────────────────────────────
  const sortedSimsCoutEvolution = [...simsCoutEvolution].sort((a, b) => (a.annee * 100 + a.mois) - (b.annee * 100 + b.mois));
  const simsCoutData = sortedSimsCoutEvolution.map(p => ({ label: `${MOIS_COURTS[p.mois]} ${p.annee}`, value: p.total }));
  const dernierSimsCoutPeriode = sortedSimsCoutEvolution[sortedSimsCoutEvolution.length - 1] ?? null;

  // ── Statistiques Véhicules M2M — Coûts ─────────────────────────────────────
  const sortedVehiculesCoutEvolution = [...vehiculesCoutEvolution].sort((a, b) => (a.annee * 100 + a.mois) - (b.annee * 100 + b.mois));
  const vehiculesCoutData = sortedVehiculesCoutEvolution.map(p => ({ label: `${MOIS_COURTS[p.mois]} ${p.annee}`, value: p.total }));
  const dernierVehiculesCoutPeriode = sortedVehiculesCoutEvolution[sortedVehiculesCoutEvolution.length - 1] ?? null;

  // ── Évolutions mensuelles (année courante) ─────────────────────────────────
  const monthOf = (d: string | null) => {
    if (!d) return null;
    const dt = new Date(d);
    return dt.getFullYear() === currentYear ? dt.getMonth() + 1 : null;
  };
  const countByMonth = (dates: (string | null)[]) =>
    Array.from({ length: 12 }, (_, i) => {
      const mois = i + 1;
      const value = dates.filter(d => monthOf(d) === mois).length;
      return { label: MOIS_COURTS[mois], value };
    });

  const materielMonthly    = countByMonth(materiels.map(m => m.date_acquisition ?? m.created_at));
  const simMonthly         = countByMonth(sims.map(s => s.created_at));
  const attributionMonthly = countByMonth(attributions.map(a => a.date_attribution));

  const hasMaterielData    = materielMonthly.some(d => d.value > 0);
  const hasSimMonthlyData  = simMonthly.some(d => d.value > 0);
  const hasAttrMonthlyData = attributionMonthly.some(d => d.value > 0);

  const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "factures",     label: "Factures",     icon: <Receipt size={14} /> },
    { key: "materiels",    label: "Matériel",      icon: <Monitor size={14} /> },
    { key: "telephonie",   label: "Téléphonie",   icon: <Phone size={14} /> },
    { key: "attributions", label: "Attributions", icon: <Users size={14} /> },
  ];

  return (
    <AppLayout>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900 mb-1">Tableau de bord</h1>
          <p className="text-gray-500 text-sm">
            Bienvenue{user?.full_name ? `, ${user.full_name}` : ""} — Vue d'ensemble du parc informatique & téléphonie
          </p>
        </div>

        {/* ══ Filtres de section ══════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-center gap-2">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                section === s.key
                  ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════ FACTURES ═══════════════════════════════ */}
      {section === "factures" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Factures"          value={nbFactures}                      icon={<Receipt size={20}/>}      bg="bg-camublue-900/10" text="text-camublue-900" />
            <KpiCard label={`Total ${currentYear}`} value={Math.round(totalFactures)}  icon={<Wallet size={20}/>}        bg="bg-emerald-100"     text="text-emerald-600"  />
            <KpiCard label="Moyenne / facture" value={Math.round(moyenneFacture)}      icon={<BarChart2 size={20}/>}    bg="bg-blue-100"        text="text-blue-600"     />
            <KpiCard
              label="Dernier écart"
              value={dernierEcartVal != null ? Math.round(Math.abs(dernierEcartVal)) : 0}
              icon={dernierEcartVal != null && dernierEcartVal < 0 ? <TrendingDown size={20}/> : <TrendingUp size={20}/>}
              bg={dernierEcartVal != null && dernierEcartVal < 0 ? "bg-emerald-100" : "bg-red-100"}
              text={dernierEcartVal != null && dernierEcartVal < 0 ? "text-emerald-600" : "text-red-500"}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Histogramme mensuel */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Montant TTC par mois — {currentYear}</h2>
              </div>
              {factLoading ? (
                <p className="text-gray-400 text-sm">Chargement…</p>
              ) : nbFactures > 0 ? (
                <>
                  <LineChart data={monthlyData} onPointClick={(i) => {
                    const mois = i + 1;
                    if (factures.some(f => f.mois === mois)) setMonthModal(mois);
                  }} />
                  <p className="text-[11px] text-gray-400 text-center mt-1">Cliquez sur un point de la courbe pour voir le détail du mois</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm">Aucune facture pour {currentYear}</p>
              )}
            </div>

            {/* Répartition par opérateur */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Phone size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Répartition par opérateur</h2>
              </div>
              {operateurRows.length > 0 ? (
                <div className="space-y-3">
                  {operateurRows.map((r, i) => (
                    <BarRow
                      key={r.operateur}
                      label={r.operateur}
                      value={Math.round(r.total)}
                      max={Math.round(maxOperateur)}
                      colorHex={TYPE_COLORS[i % TYPE_COLORS.length]}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">{factLoading ? "Chargement…" : "Aucune donnée"}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════ TÉLÉPHONIE ══════════════════════════════ */}
      {section === "telephonie" && (
        <>
          {/* Sous-onglets Téléphonie */}
          <div className="flex items-center gap-2 mb-5">
            <button onClick={() => setTelSubSection("sims")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                telSubSection === "sims"
                  ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>
              Vue d'ensemble SIM
            </button>
            <button onClick={() => setTelSubSection("rms")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                telSubSection === "rms"
                  ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>
              Sites RMS — Coûts &amp; répartition
            </button>
            <button onClick={() => setTelSubSection("sims-cout")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                telSubSection === "sims-cout"
                  ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>
              SIM Employés — Coûts
            </button>
            <button onClick={() => setTelSubSection("vehicules-cout")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                telSubSection === "vehicules-cout"
                  ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>
              Véhicules M2M — Coûts
            </button>
          </div>

          {telSubSection === "sims" && (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Cartes SIM"  value={sims.length} icon={<Smartphone size={20}/>} bg="bg-purple-100"  text="text-purple-600"  />
            <KpiCard label="Actives"     value={simActives}  icon={<CheckCircle size={20}/>} bg="bg-emerald-100" text="text-emerald-600" />
            <KpiCard label="Sites GSM"   value={simByCategorie.get("M2M_SITE") ?? 0}     icon={<MapPin size={20}/>} bg="bg-blue-100" text="text-blue-600" />
            <KpiCard label="Véhicules"   value={simByCategorie.get("M2M_VEHICULE") ?? 0} icon={<Phone size={20}/>} bg="bg-amber-100" text="text-amber-600" />
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Courbe d'évolution */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Nouvelles SIM par mois — {currentYear}</h2>
              </div>
              {hasSimMonthlyData ? (
                <LineChart data={simMonthly} colorHex="#8b5cf6" />
              ) : (
                <p className="text-gray-400 text-sm">Aucune donnée pour {currentYear}</p>
              )}
            </div>

            {/* SIM par statut */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">SIM par statut</h2>
              </div>
              {sims.length > 0 ? (
                <div className="space-y-3">
                  {Array.from(simByStatut.entries()).map(([st, count], i) => (
                    <BarRow
                      key={st}
                      label={STATUT_LABELS[st] ?? st}
                      value={count}
                      max={sims.length}
                      colorHex={TYPE_COLORS[(i + 4) % TYPE_COLORS.length]}
                    />
                  ))}
                </div>
              ) : <p className="text-gray-400 text-sm">Aucune SIM enregistrée</p>}
            </div>
          </div>

          {/* SIM par catégorie */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone size={15} className="text-camublue-900" />
              <h2 className="font-bold text-gray-700 text-sm">SIM par catégorie</h2>
            </div>
            {sims.length > 0 ? (
              <div className="grid sm:grid-cols-3 gap-x-8 gap-y-3">
                {Array.from(simByCategorie.entries()).map(([cat, count], i) => (
                  <BarRow
                    key={cat}
                    label={CATEGORIE_LABELS[cat] ?? cat}
                    value={count}
                    max={maxSimCategorie}
                    colorHex={TYPE_COLORS[i % TYPE_COLORS.length]}
                  />
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">Aucune SIM enregistrée</p>}
          </div>

          {/* Bouton Suivant ── vers Sites RMS */}
          <div className="flex justify-end mb-5">
            <button onClick={() => setTelSubSection("rms")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
              <span>Suivant : Sites RMS</span><ArrowRight size={15} />
            </button>
          </div>
          </>
          )}

          {telSubSection === "rms" && (
          <>
          {/* ══ Sites RMS ════════════════════════════════════════════════════════ */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-camublue-900" />
              <h2 className="font-bold text-camublue-900 text-base">Sites RMS — Coûts &amp; répartition</h2>
            </div>
            <button onClick={() => setTelSubSection("sims")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900/5 hover:bg-camublue-900/10 text-camublue-900 border border-camublue-900/15 rounded-xl text-sm font-semibold transition shadow-sm">
              <ArrowRight size={15} className="rotate-180" /><span>Retour : Vue d'ensemble SIM</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Sites RMS"       value={sitesRMS.length} icon={<MapPin size={20}/>}    bg="bg-blue-100"   text="text-blue-600"   />
            <KpiCard label="RMS_Orange"      value={sitesOrange}     icon={<Smartphone size={20}/>} bg="bg-orange-100" text="text-orange-600" />
            <KpiCard label="RMS_Free"        value={sitesFree}       icon={<Smartphone size={20}/>} bg="bg-red-100"    text="text-red-600"    />
            <KpiCard label="Sites sans SIM"  value={sitesSansSim}    icon={<AlertTriangle size={20}/>} bg="bg-amber-100" text="text-amber-600" />
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Courbe d'évolution du coût total */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <BarChart2 size={15} className="text-camublue-900" />
                  <h2 className="font-bold text-gray-700 text-sm">Coût total facturé — Sites RMS</h2>
                </div>
                {dernierRmsPeriode && dernierRmsPeriode.ecart != null && (
                  <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                    dernierRmsPeriode.ecart > 0 ? "bg-red-50 text-red-600" :
                    dernierRmsPeriode.ecart < 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"
                  }`}>
                    {dernierRmsPeriode.ecart > 0 ? <TrendingUp size={12}/> : dernierRmsPeriode.ecart < 0 ? <TrendingDown size={12}/> : null}
                    {dernierRmsPeriode.ecart > 0 ? "+" : ""}{Math.round(dernierRmsPeriode.ecart).toLocaleString("fr-FR")} F
                    {dernierRmsPeriode.ecart_pct != null && ` (${dernierRmsPeriode.ecart_pct > 0 ? "+" : ""}${dernierRmsPeriode.ecart_pct.toFixed(1)}%)`}
                  </span>
                )}
              </div>
              {rmsCoutData.length > 0 ? (
                <>
                  <LineChart data={rmsCoutData} colorHex="#06b6d4"
                    onPointClick={(i) => setRmsPeriodeIdx(prev => prev === i ? null : i)} />
                  <p className="text-[11px] text-gray-400 mt-1 text-center">Cliquez sur un point pour afficher le détail du mois</p>
                  {rmsPeriodeIdx != null && sortedEvolution[rmsPeriodeIdx] && (() => {
                    const p = sortedEvolution[rmsPeriodeIdx];
                    return (
                      <div className="mt-3 p-4 bg-cyan-50 border border-cyan-100 rounded-xl flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-cyan-600 font-semibold uppercase tracking-wide">{MOIS_LABELS[p.mois]} {p.annee}</p>
                          <p className="text-xl font-black text-gray-800 mt-0.5">{Math.round(p.total).toLocaleString("fr-FR")} <span className="text-sm font-semibold text-gray-400">FCFA</span></p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.nombre_numeros.toLocaleString("fr-FR")} numéro(s) facturé(s)</p>
                        </div>
                        {p.ecart != null && (
                          <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1.5 rounded-lg ${
                            p.ecart > 0 ? "bg-red-50 text-red-600" : p.ecart < 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"
                          }`}>
                            {p.ecart > 0 ? <TrendingUp size={14}/> : p.ecart < 0 ? <TrendingDown size={14}/> : null}
                            {p.ecart > 0 ? "+" : ""}{Math.round(p.ecart).toLocaleString("fr-FR")} F
                            {p.ecart_pct != null && ` (${p.ecart_pct > 0 ? "+" : ""}${p.ecart_pct.toFixed(1)}%)`}
                          </span>
                        )}
                        <button onClick={() => setRmsPeriodeIdx(null)} className="text-gray-300 hover:text-gray-500 transition">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-gray-400 text-sm">Aucune facture associée aux sites RMS pour le moment</p>
              )}
            </div>

            {/* Répartition Orange / Free */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Répartition par opérateur</h2>
              </div>
              {sitesRMS.length > 0 ? (
                <>
                  <DonutChart segments={rmsRepartitionSegments} total={sitesOrange + sitesFree} />
                  <div className="flex justify-center gap-4 mt-4">
                    {rmsRepartitionSegments.map(s => (
                      <div key={s.label} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-500">{s.label}</span>
                        <span className="font-bold text-gray-700">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-gray-400 text-sm">Aucun site enregistré</p>}
            </div>
          </div>

          {/* Détail mensuel des coûts */}
          {sortedEvolution.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Détail mensuel — Sites RMS</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="py-2 font-semibold">Période</th>
                      <th className="py-2 font-semibold text-right">Numéros facturés</th>
                      <th className="py-2 font-semibold text-right">Total (FCFA)</th>
                      <th className="py-2 font-semibold text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedEvolution.map((p, i) => (
                      <tr key={`${p.annee}-${p.mois}`}
                        onClick={() => setRmsPeriodeIdx(prev => prev === i ? null : i)}
                        className={`cursor-pointer transition ${rmsPeriodeIdx === i ? "bg-cyan-50" : "hover:bg-gray-50"}`}>
                        <td className="py-2 text-gray-700">{MOIS_LABELS[p.mois]} {p.annee}</td>
                        <td className="py-2 text-right text-gray-500">{p.nombre_numeros.toLocaleString("fr-FR")}</td>
                        <td className="py-2 text-right font-bold text-gray-800">{Math.round(p.total).toLocaleString("fr-FR")}</td>
                        <td className={`py-2 text-right font-semibold ${
                          (p.ecart ?? 0) > 0 ? "text-red-600" : (p.ecart ?? 0) < 0 ? "text-emerald-600" : "text-gray-400"
                        }`}>
                          {p.ecart == null ? "—" : `${p.ecart > 0 ? "+" : ""}${Math.round(p.ecart).toLocaleString("fr-FR")} F${p.ecart_pct != null ? ` (${p.ecart_pct > 0 ? "+" : ""}${p.ecart_pct.toFixed(1)}%)` : ""}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bouton Suivant ── vers SIM Employés - Coûts */}
          <div className="flex justify-end mb-5">
            <button onClick={() => setTelSubSection("sims-cout")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
              <span>Suivant : SIM Employés — Coûts</span><ArrowRight size={15} />
            </button>
          </div>
          </>
          )}

          {telSubSection === "sims-cout" && (
          <>
          {/* ══ SIM Employés — Coûts ════════════════════════════════════════════ */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-camublue-900" />
              <h2 className="font-bold text-camublue-900 text-base">SIM Employés — Coûts</h2>
            </div>
            <button onClick={() => setTelSubSection("rms")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900/5 hover:bg-camublue-900/10 text-camublue-900 border border-camublue-900/15 rounded-xl text-sm font-semibold transition shadow-sm">
              <ArrowRight size={15} className="rotate-180" /><span>Retour : Sites RMS</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <KpiCard label="SIM Employés"     value={simByCategorie.get("EMPLOYE") ?? 0} icon={<Smartphone size={20}/>} bg="bg-purple-100" text="text-purple-600" />
            <KpiCard label="Périodes facturées" value={sortedSimsCoutEvolution.length}    icon={<Receipt size={20}/>}   bg="bg-blue-100"   text="text-blue-600"   />
            <KpiCard label="Dernier total"
              value={dernierSimsCoutPeriode ? Math.round(dernierSimsCoutPeriode.total) : 0}
              icon={<Wallet size={20}/>} bg="bg-emerald-100" text="text-emerald-600" />
            <KpiCard label="Numéros facturés (dernier mois)"
              value={dernierSimsCoutPeriode ? dernierSimsCoutPeriode.nombre_numeros : 0}
              icon={<Phone size={20}/>} bg="bg-amber-100" text="text-amber-600" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart2 size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Coût total facturé — SIM Employés</h2>
              </div>
              {dernierSimsCoutPeriode && dernierSimsCoutPeriode.ecart != null && (
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                  dernierSimsCoutPeriode.ecart > 0 ? "bg-red-50 text-red-600" :
                  dernierSimsCoutPeriode.ecart < 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"
                }`}>
                  {dernierSimsCoutPeriode.ecart > 0 ? <TrendingUp size={12}/> : dernierSimsCoutPeriode.ecart < 0 ? <TrendingDown size={12}/> : null}
                  {dernierSimsCoutPeriode.ecart > 0 ? "+" : ""}{Math.round(dernierSimsCoutPeriode.ecart).toLocaleString("fr-FR")} F
                  {dernierSimsCoutPeriode.ecart_pct != null && ` (${dernierSimsCoutPeriode.ecart_pct > 0 ? "+" : ""}${dernierSimsCoutPeriode.ecart_pct.toFixed(1)}%)`}
                </span>
              )}
            </div>
            {simsCoutData.length > 0 ? (
              <>
                <LineChart data={simsCoutData} colorHex="#8b5cf6"
                  onPointClick={(i) => setSimsCoutPeriodeIdx(prev => prev === i ? null : i)} />
                <p className="text-[11px] text-gray-400 mt-1 text-center">Cliquez sur un point pour afficher le détail du mois</p>
                {simsCoutPeriodeIdx != null && sortedSimsCoutEvolution[simsCoutPeriodeIdx] && (() => {
                  const p = sortedSimsCoutEvolution[simsCoutPeriodeIdx];
                  return (
                    <div className="mt-3 p-4 bg-purple-50 border border-purple-100 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">{MOIS_LABELS[p.mois]} {p.annee}</p>
                        <p className="text-xl font-black text-gray-800 mt-0.5">{Math.round(p.total).toLocaleString("fr-FR")} <span className="text-sm font-semibold text-gray-400">FCFA</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.nombre_numeros.toLocaleString("fr-FR")} numéro(s) facturé(s)</p>
                      </div>
                      {p.ecart != null && (
                        <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1.5 rounded-lg ${
                          p.ecart > 0 ? "bg-red-50 text-red-600" : p.ecart < 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"
                        }`}>
                          {p.ecart > 0 ? <TrendingUp size={14}/> : p.ecart < 0 ? <TrendingDown size={14}/> : null}
                          {p.ecart > 0 ? "+" : ""}{Math.round(p.ecart).toLocaleString("fr-FR")} F
                          {p.ecart_pct != null && ` (${p.ecart_pct > 0 ? "+" : ""}${p.ecart_pct.toFixed(1)}%)`}
                        </span>
                      )}
                      <button onClick={() => setSimsCoutPeriodeIdx(null)} className="text-gray-300 hover:text-gray-500 transition">
                        <X size={14} />
                      </button>
                    </div>
                  );
                })()}
              </>
            ) : (
              <p className="text-gray-400 text-sm">Aucune facture associée aux SIM Employés pour le moment</p>
            )}
          </div>

          {/* Détail mensuel des coûts */}
          {sortedSimsCoutEvolution.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Détail mensuel — SIM Employés</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="py-2 font-semibold">Période</th>
                      <th className="py-2 font-semibold text-right">Numéros facturés</th>
                      <th className="py-2 font-semibold text-right">Total (FCFA)</th>
                      <th className="py-2 font-semibold text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedSimsCoutEvolution.map((p, i) => (
                      <tr key={`${p.annee}-${p.mois}`}
                        onClick={() => setSimsCoutPeriodeIdx(prev => prev === i ? null : i)}
                        className={`cursor-pointer transition ${simsCoutPeriodeIdx === i ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                        <td className="py-2 text-gray-700">{MOIS_LABELS[p.mois]} {p.annee}</td>
                        <td className="py-2 text-right text-gray-500">{p.nombre_numeros.toLocaleString("fr-FR")}</td>
                        <td className="py-2 text-right font-bold text-gray-800">{Math.round(p.total).toLocaleString("fr-FR")}</td>
                        <td className={`py-2 text-right font-semibold ${
                          (p.ecart ?? 0) > 0 ? "text-red-600" : (p.ecart ?? 0) < 0 ? "text-emerald-600" : "text-gray-400"
                        }`}>
                          {p.ecart == null ? "—" : `${p.ecart > 0 ? "+" : ""}${Math.round(p.ecart).toLocaleString("fr-FR")} F${p.ecart_pct != null ? ` (${p.ecart_pct > 0 ? "+" : ""}${p.ecart_pct.toFixed(1)}%)` : ""}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bouton Suivant ── vers Véhicules M2M - Coûts */}
          <div className="flex justify-end mb-5">
            <button onClick={() => setTelSubSection("vehicules-cout")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
              <span>Suivant : Véhicules M2M — Coûts</span><ArrowRight size={15} />
            </button>
          </div>
          </>
          )}

          {telSubSection === "vehicules-cout" && (
          <>
          {/* ══ Véhicules M2M — Coûts ════════════════════════════════════════════ */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-camublue-900" />
              <h2 className="font-bold text-camublue-900 text-base">Véhicules M2M — Coûts</h2>
            </div>
            <button onClick={() => setTelSubSection("sims-cout")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900/5 hover:bg-camublue-900/10 text-camublue-900 border border-camublue-900/15 rounded-xl text-sm font-semibold transition shadow-sm">
              <ArrowRight size={15} className="rotate-180" /><span>Retour : SIM Employés</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <KpiCard label="SIM Véhicules M2M" value={simByCategorie.get("M2M_VEHICULE") ?? 0} icon={<Smartphone size={20}/>} bg="bg-purple-100" text="text-purple-600" />
            <KpiCard label="Périodes facturées" value={sortedVehiculesCoutEvolution.length}    icon={<Receipt size={20}/>}   bg="bg-blue-100"   text="text-blue-600"   />
            <KpiCard label="Dernier total"
              value={dernierVehiculesCoutPeriode ? Math.round(dernierVehiculesCoutPeriode.total) : 0}
              icon={<Wallet size={20}/>} bg="bg-emerald-100" text="text-emerald-600" />
            <KpiCard label="Numéros facturés (dernier mois)"
              value={dernierVehiculesCoutPeriode ? dernierVehiculesCoutPeriode.nombre_numeros : 0}
              icon={<Phone size={20}/>} bg="bg-amber-100" text="text-amber-600" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart2 size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Coût total facturé — Véhicules M2M</h2>
              </div>
              {dernierVehiculesCoutPeriode && dernierVehiculesCoutPeriode.ecart != null && (
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                  dernierVehiculesCoutPeriode.ecart > 0 ? "bg-red-50 text-red-600" :
                  dernierVehiculesCoutPeriode.ecart < 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"
                }`}>
                  {dernierVehiculesCoutPeriode.ecart > 0 ? <TrendingUp size={12}/> : dernierVehiculesCoutPeriode.ecart < 0 ? <TrendingDown size={12}/> : null}
                  {dernierVehiculesCoutPeriode.ecart > 0 ? "+" : ""}{Math.round(dernierVehiculesCoutPeriode.ecart).toLocaleString("fr-FR")} F
                  {dernierVehiculesCoutPeriode.ecart_pct != null && ` (${dernierVehiculesCoutPeriode.ecart_pct > 0 ? "+" : ""}${dernierVehiculesCoutPeriode.ecart_pct.toFixed(1)}%)`}
                </span>
              )}
            </div>
            {vehiculesCoutData.length > 0 ? (
              <>
                <LineChart data={vehiculesCoutData} colorHex="#0ea5e9"
                  onPointClick={(i) => setVehiculesCoutPeriodeIdx(prev => prev === i ? null : i)} />
                <p className="text-[11px] text-gray-400 mt-1 text-center">Cliquez sur un point pour afficher le détail du mois</p>
                {vehiculesCoutPeriodeIdx != null && sortedVehiculesCoutEvolution[vehiculesCoutPeriodeIdx] && (() => {
                  const p = sortedVehiculesCoutEvolution[vehiculesCoutPeriodeIdx];
                  return (
                    <div className="mt-3 p-4 bg-sky-50 border border-sky-100 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-sky-600 font-semibold uppercase tracking-wide">{MOIS_LABELS[p.mois]} {p.annee}</p>
                        <p className="text-xl font-black text-gray-800 mt-0.5">{Math.round(p.total).toLocaleString("fr-FR")} <span className="text-sm font-semibold text-gray-400">FCFA</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.nombre_numeros.toLocaleString("fr-FR")} numéro(s) facturé(s)</p>
                      </div>
                      {p.ecart != null && (
                        <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1.5 rounded-lg ${
                          p.ecart > 0 ? "bg-red-50 text-red-600" : p.ecart < 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"
                        }`}>
                          {p.ecart > 0 ? <TrendingUp size={14}/> : p.ecart < 0 ? <TrendingDown size={14}/> : null}
                          {p.ecart > 0 ? "+" : ""}{Math.round(p.ecart).toLocaleString("fr-FR")} F
                          {p.ecart_pct != null && ` (${p.ecart_pct > 0 ? "+" : ""}${p.ecart_pct.toFixed(1)}%)`}
                        </span>
                      )}
                      <button onClick={() => setVehiculesCoutPeriodeIdx(null)} className="text-gray-300 hover:text-gray-500 transition">
                        <X size={14} />
                      </button>
                    </div>
                  );
                })()}
              </>
            ) : (
              <p className="text-gray-400 text-sm">Aucune facture associée aux SIM Véhicules M2M pour le moment</p>
            )}
          </div>

          {/* Détail mensuel des coûts */}
          {sortedVehiculesCoutEvolution.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={15} className="text-camublue-900" />
                <h2 className="font-bold text-gray-700 text-sm">Détail mensuel — Véhicules M2M</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="py-2 font-semibold">Période</th>
                      <th className="py-2 font-semibold text-right">Numéros facturés</th>
                      <th className="py-2 font-semibold text-right">Total (FCFA)</th>
                      <th className="py-2 font-semibold text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedVehiculesCoutEvolution.map((p, i) => (
                      <tr key={`${p.annee}-${p.mois}`}
                        onClick={() => setVehiculesCoutPeriodeIdx(prev => prev === i ? null : i)}
                        className={`cursor-pointer transition ${vehiculesCoutPeriodeIdx === i ? "bg-sky-50" : "hover:bg-gray-50"}`}>
                        <td className="py-2 text-gray-700">{MOIS_LABELS[p.mois]} {p.annee}</td>
                        <td className="py-2 text-right text-gray-500">{p.nombre_numeros.toLocaleString("fr-FR")}</td>
                        <td className="py-2 text-right font-bold text-gray-800">{Math.round(p.total).toLocaleString("fr-FR")}</td>
                        <td className={`py-2 text-right font-semibold ${
                          (p.ecart ?? 0) > 0 ? "text-red-600" : (p.ecart ?? 0) < 0 ? "text-emerald-600" : "text-gray-400"
                        }`}>
                          {p.ecart == null ? "—" : `${p.ecart > 0 ? "+" : ""}${Math.round(p.ecart).toLocaleString("fr-FR")} F${p.ecart_pct != null ? ` (${p.ecart_pct > 0 ? "+" : ""}${p.ecart_pct.toFixed(1)}%)` : ""}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bouton Retour ── vers Vue d'ensemble SIM */}
          <div className="flex justify-end mb-5">
            <button onClick={() => setTelSubSection("sims")}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
              <span>Retour : Vue d'ensemble SIM</span><ArrowRight size={15} />
            </button>
          </div>
          </>
          )}
        </>
      )}

      {/* ══════════════════════════════ MATÉRIEL ════════════════════════════════ */}
      {section === "materiels" && (
      <>
      {/* ══ KPIs matériels ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total matériels"  value={stats?.total       ?? 0} icon={<Monitor       size={20}/>} bg="bg-slate-100"   text="text-slate-600"   />
        <KpiCard label="Disponibles"      value={stats?.disponible  ?? 0} icon={<CheckCircle   size={20}/>} bg="bg-emerald-100" text="text-emerald-600" />
        <KpiCard label="Attribués"        value={stats?.attribue    ?? 0} icon={<ClipboardList size={20}/>} bg="bg-blue-100"    text="text-blue-600"    />
        <KpiCard label="En maintenance"   value={stats?.maintenance ?? 0} icon={<Wrench        size={20}/>} bg="bg-amber-100"   text="text-amber-600"   />
        <KpiCard label="Réformés"         value={stats?.reforme     ?? 0} icon={<Archive       size={20}/>} bg="bg-red-100"     text="text-red-500"     />
      </div>

      {/* ══ Courbe d'évolution + alertes ═══════════════════════════════════════ */}
      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-camublue-900" />
            <h2 className="font-bold text-gray-700 text-sm">Matériels acquis par mois — {currentYear}</h2>
          </div>
          {hasMaterielData ? (
            <LineChart data={materielMonthly} colorHex="#f59e0b" />
          ) : (
            <p className="text-gray-400 text-sm">Aucune donnée pour {currentYear}</p>
          )}
        </div>

        {/* Alertes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <h2 className="font-bold text-gray-700 text-sm mb-4">Écarts & Alertes</h2>
          <div className="space-y-2.5">
            {stats ? alerts.map((a, i) => (
              <AlertCard key={i} level={a.level} message={a.message} />
            )) : <p className="text-gray-400 text-sm">Chargement…</p>}
          </div>
        </div>
      </div>

      {/* ══ Ligne 1 : répartition + barres statut ═══════════════════════════════ */}
      <div className="grid md:grid-cols-2 gap-5 mb-5">

        {/* Donut statut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex flex-col items-center gap-4">
          <h2 className="font-bold text-gray-700 text-sm self-start">Répartition statut</h2>
          {stats ? (
            <>
              <DonutChart segments={donutSegments} total={stats.total} />
              <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5">
                {[
                  { label: "Disponible",  color: "bg-emerald-400" },
                  { label: "Attribué",    color: "bg-blue-400"    },
                  { label: "Maintenance", color: "bg-amber-400"   },
                  { label: "Réformé",     color: "bg-red-400"     },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-gray-400 text-sm">Chargement…</p>}
        </div>

        {/* Barres statut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <h2 className="font-bold text-gray-700 text-sm mb-4">Détail du parc</h2>
          {stats ? (
            <div className="space-y-3.5">
              <BarRow label="Disponible"  value={stats.disponible}  max={stats.total} colorTw="bg-emerald-400" />
              <BarRow label="Attribué"    value={stats.attribue}    max={stats.total} colorTw="bg-blue-400"    />
              <BarRow label="Maintenance" value={stats.maintenance} max={stats.total} colorTw="bg-amber-400"   />
              <BarRow label="Réformé"     value={stats.reforme}     max={stats.total} colorTw="bg-red-400"     />
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-gray-500"><Smartphone size={12}/> SIMs enregistrées</span>
                <span className="font-bold text-purple-600">{sims.length}</span>
              </div>
            </div>
          ) : <p className="text-gray-400 text-sm">Chargement…</p>}
        </div>
      </div>

      {/* ══ Ligne 2 : par type + par marque ════════════════════════════════════ */}
      <div className="grid md:grid-cols-2 gap-5 mb-5">

        {/* Par type */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-camublue-900" />
            <h2 className="font-bold text-gray-700 text-sm">Matériels par catégorie</h2>
          </div>
          {byType.length > 0 ? (
            <div className="space-y-3">
              {byType.map((r, i) => (
                <BarRow
                  key={r.type}
                  label={TYPE_LABELS[r.type] ?? r.type}
                  value={r.count}
                  max={maxType}
                  colorHex={TYPE_COLORS[i % TYPE_COLORS.length]}
                />
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm">Chargement…</p>}
        </div>

        {/* Par marque */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={15} className="text-camublue-900" />
            <h2 className="font-bold text-gray-700 text-sm">Top marques</h2>
          </div>
          {byBrand.length > 0 ? (
            <div className="space-y-3">
              {byBrand.map((r, i) => (
                <BarRow
                  key={r.marque}
                  label={r.marque}
                  value={r.count}
                  max={maxBrand}
                  colorHex={TYPE_COLORS[(i + 3) % TYPE_COLORS.length]}
                />
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm">Chargement…</p>}
        </div>
      </div>
      </>
      )}

      {/* ══════════════════════════════ ATTRIBUTIONS ════════════════════════════ */}
      {section === "attributions" && (
      <>
      <div className="grid md:grid-cols-3 gap-5 mb-5">

        {/* Courbe d'évolution */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-camublue-900" />
            <h2 className="font-bold text-gray-700 text-sm">Attributions par mois — {currentYear}</h2>
          </div>
          {hasAttrMonthlyData ? (
            <LineChart data={attributionMonthly} colorHex="#3b82f6" />
          ) : (
            <p className="text-gray-400 text-sm">Aucune donnée pour {currentYear}</p>
          )}
        </div>

        {/* KPIs attributions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={15} className="text-camublue-900" />
            <h2 className="font-bold text-gray-700 text-sm">Attributions</h2>
          </div>
          {attrStats ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <MiniStat label="Actives"   value={attrStats.active}           color="text-emerald-600" />
                <MiniStat label="Clôturées" value={attrStats.cloturee}         color="text-gray-500"    />
                <MiniStat label="Employés"  value={attrStats.employees_actifs} color="text-blue-600"    />
              </div>
              <div className="pt-3 border-t border-gray-100">
                <BarRow
                  label="Taux d'attribution"
                  value={attrStats.active}
                  max={attrStats.active + attrStats.cloturee || 1}
                  colorTw="bg-emerald-400"
                />
                <p className="text-[10px] text-gray-400 mt-1.5 text-right">
                  {attrStats.active + attrStats.cloturee} attribution(s) au total
                </p>
              </div>
            </>
          ) : <p className="text-gray-400 text-sm">Chargement…</p>}
        </div>
      </div>

      {/* Par service */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={15} className="text-camublue-900" />
          <h2 className="font-bold text-gray-700 text-sm">Attributions actives par service</h2>
        </div>
        {attrStats && attrStats.par_service.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {attrStats.par_service.map((r, i) => (
              <BarRow
                key={r.service}
                label={r.service}
                value={r.count}
                max={maxSvc}
                colorHex={TYPE_COLORS[i % TYPE_COLORS.length]}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            {attrStats ? "Aucune attribution active" : "Chargement…"}
          </p>
        )}
      </div>
      </>
      )}

      {/* ── Modal détail du mois (Factures) ── */}
      {monthModal != null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setMonthModal(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-camublue-900">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Receipt size={15} /> {MOIS_LABELS[monthModal]} {currentYear}
                {modalFacture?.operateur ? ` — ${modalFacture.operateur}` : ""}
              </h3>
              <button onClick={() => setMonthModal(null)} className="text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {modalFacture ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile label="Numéro" value={modalFacture.numero_compte ?? "—"} />
                    <StatTile
                      label="Montant TTC"
                      value={`${factureTotal(modalFacture).toLocaleString("fr-FR")} FCFA`}
                    />
                    <StatTile
                      label="Solde Facture"
                      value={modalFacture.solde_facture != null
                        ? `${parseFloat(modalFacture.solde_facture).toLocaleString("fr-FR")} FCFA`
                        : "—"}
                    />
                  </div>
                  <Link
                    to={`/factures/${modalFacture.id}`}
                    className="mt-5 flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Voir la facture <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center py-2">Aucune facture pour {MOIS_LABELS[monthModal]} {currentYear}.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

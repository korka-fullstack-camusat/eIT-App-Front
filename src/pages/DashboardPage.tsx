import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone, Monitor, Receipt, ClipboardList, Wallet,
  TrendingUp, TrendingDown, MapPin, Smartphone,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { materielService, simService, attributionService, factureService, siteService } from "@/services/api";
import type { FactureTelecom, NumeroSIM, Materiel, Attribution, SiteGSM } from "@/types";

interface Stats     { total: number; disponible: number; attribue: number; maintenance: number; reforme: number; }
interface TypeRow   { type: string; count: number; }
interface AttrStats { active: number; cloturee: number; employees_actifs: number; par_service: { service: string; count: number }[]; }

const MOIS_LABELS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MOIS_COURTS = ["","Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];

const TYPE_LABELS: Record<string, string> = {
  ORDINATEUR_PORTABLE:"PC Portable", ORDINATEUR_FIXE:"PC Bureau", ECRAN:"Écran",
  SOURIS:"Souris", CLAVIER:"Clavier", TELEPHONE:"Téléphone", IMPRIMANTE:"Imprimante",
  SWITCH:"Switch", ROUTEUR:"Routeur", ONDULEUR:"Onduleur", AUTRE:"Autre",
};

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ segments, total, size = 160 }: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  size?: number;
}) {
  const R = 44, C = 2 * Math.PI * R;
  let cumul = 0;
  const arcs = segments.map(s => {
    const len = total > 0 ? (s.value / total) * C : 0;
    const arc = { ...s, dasharray: `${len} ${C - len}`, dashoffset: C / 4 - cumul };
    cumul += len;
    return arc;
  });
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {arcs.map(a => (
          <circle key={a.label} cx="60" cy="60" r={R} fill="none"
            stroke={a.color} strokeWidth="14"
            strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset} />
        ))}
      </svg>
      <div className="absolute text-center pointer-events-none">
        <p className="text-2xl font-black text-gray-800 leading-none">{total}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">total</p>
      </div>
    </div>
  );
}

// ── Courbe mini ───────────────────────────────────────────────────────────────
function MiniLine({ data, colorHex }: { data: { label: string; value: number }[]; colorHex: string }) {
  const W = 300, H = 60, padX = 4, padY = 6;
  const max = Math.max(1, ...data.map(d => d.value));
  const pts = data.map((d, i) => ({
    x: padX + (i / Math.max(1, data.length - 1)) * (W - padX * 2),
    y: padY + (1 - d.value / max) * (H - padY * 2),
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${pts[pts.length-1]?.x ?? padX} ${H - padY} L ${pts[0]?.x ?? padX} ${H - padY} Z`;
  const gradId = `mg${colorHex.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorHex} stopOpacity="0.18" />
          <stop offset="100%" stopColor={colorHex} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={colorHex} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI inline ────────────────────────────────────────────────────────────────
function KpiRow({ label, value, sub, colorDot }: { label: string; value: string | number; sub?: string; colorDot?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        {colorDot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />}
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-xs font-bold text-gray-800">{value}</span>
        {sub && <span className="text-[10px] text-gray-400 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

// ── Badge tendance ─────────────────────────────────────────────────────────────
function Trend({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  if (pct === 0) return <span className="text-[10px] text-gray-400 font-semibold">=</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${pct > 0 ? "text-red-500" : "text-emerald-600"}`}>
      {pct > 0 ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

// ── Carte de section ──────────────────────────────────────────────────────────
function SCard({ icon, title, badge, accent, children, flex }: {
  icon: React.ReactNode; title: string; badge?: string;
  accent: string; children: React.ReactNode; flex?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden ${flex ? "flex flex-col" : ""}`}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 shrink-0">
        <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>{icon}</span>
        <span className="font-bold text-camublue-900 text-sm">{title}</span>
        {badge && <span className="ml-auto text-[11px] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-lg">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

// ══ PAGE ══════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user } = useAuth();
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear());
  const [filterMois,  setFilterMois]  = useState(0);

  const [stats,      setStats]      = useState<Stats | null>(null);
  const [byType,     setByType]     = useState<TypeRow[]>([]);
  const [attrStats,  setAttrStats]  = useState<AttrStats | null>(null);
  const [sims,       setSims]       = useState<NumeroSIM[]>([]);
  const [factures,   setFactures]   = useState<FactureTelecom[]>([]);
  const [factLoading, setFactLoading] = useState(true);
  const [materiels,   setMateriels]   = useState<Materiel[]>([]);
  const [attributions,setAttributions] = useState<Attribution[]>([]);
  const [sitesRMS,   setSitesRMS]   = useState<SiteGSM[]>([]);
  const [sitesEvolution, setSitesEvolution] = useState<{
    mois: number; annee: number; total: number; nombre_numeros: number;
    ecart: number | null; ecart_pct: number | null;
  }[]>([]);
  const [simsCoutEvolution,      setSimsCoutEvolution]      = useState<typeof sitesEvolution>([]);
  const [vehiculesCoutEvolution, setVehiculesCoutEvolution] = useState<typeof sitesEvolution>([]);

  useEffect(() => {
    materielService.stats().then(setStats).catch(() => {});
    materielService.statsByType().then(setByType).catch(() => {});
    materielService.getAll().then(setMateriels).catch(() => {});
    attributionService.stats().then(setAttrStats).catch(() => {});
    attributionService.getAll().then(setAttributions).catch(() => {});
    simService.getAll().then(setSims).catch(() => {});
    siteService.getAll().then(setSitesRMS).catch(() => {});
    siteService.statsEvolution().then(setSitesEvolution).catch(() => {});
    simService.statsEvolution("EMPLOYE").then(setSimsCoutEvolution).catch(() => {});
    simService.statsEvolution("M2M_VEHICULE").then(setVehiculesCoutEvolution).catch(() => {});
  }, []);

  useEffect(() => {
    setFactLoading(true);
    setFilterMois(0);
    factureService.getAll({ annee: filterAnnee })
      .then(setFactures).catch(() => {}).finally(() => setFactLoading(false));
  }, [filterAnnee]);

  // ── Années disponibles ─────────────────────────────────────────────────────
  const availableYears = Array.from(new Set([
    ...simsCoutEvolution.map(p => p.annee),
    ...sitesEvolution.map(p => p.annee),
    new Date().getFullYear(),
  ])).sort((a, b) => b - a);

  // ── Mois avec données ──────────────────────────────────────────────────────
  const availableMonths = Array.from(new Set([
    ...simsCoutEvolution.filter(p => p.annee === filterAnnee).map(p => p.mois),
    ...sitesEvolution.filter(p => p.annee === filterAnnee).map(p => p.mois),
    ...vehiculesCoutEvolution.filter(p => p.annee === filterAnnee).map(p => p.mois),
    ...factures.map(f => f.mois),
  ])).sort((a, b) => a - b);

  const periodeLabel = filterMois > 0
    ? `${MOIS_LABELS[filterMois]} ${filterAnnee}`
    : `${filterAnnee}`;

  // ── Factures ───────────────────────────────────────────────────────────────
  const filteredFactures = factures.filter(f => filterMois === 0 || f.mois === filterMois);
  const factureTotal = (f: FactureTelecom) => f.solde_facture != null ? parseFloat(f.solde_facture) : 0;
  const totalFactures  = filteredFactures.reduce((s, f) => s + factureTotal(f), 0);
  const nbFactures     = filteredFactures.length;
  const moyenneFacture = nbFactures > 0 ? totalFactures / nbFactures : 0;

  const sortedFact = [...filteredFactures].sort((a, b) =>
    a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);
  const dernierEcartPct = sortedFact[sortedFact.length - 1]?.ecart_pct ?? null;

  const monthlyFact = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const f = factures.find(x => x.mois === m);
    return { label: MOIS_COURTS[m], value: f ? factureTotal(f) : 0 };
  });

  // ── SIM ────────────────────────────────────────────────────────────────────
  const simByStatut    = new Map<string, number>();
  const simByCategorie = new Map<string, number>();
  sims.forEach(s => {
    simByStatut.set(s.statut, (simByStatut.get(s.statut) ?? 0) + 1);
    simByCategorie.set(s.categorie, (simByCategorie.get(s.categorie) ?? 0) + 1);
  });
  const simActives   = simByStatut.get("ACTIVE") ?? 0;
  const simInactives = (simByStatut.get("INACTIVE") ?? 0) + (simByStatut.get("SUSPENDUE") ?? 0);

  // ── Sites RMS ──────────────────────────────────────────────────────────────
  const sitesOrange  = sitesRMS.filter(s => (s.sim_operateur ?? "Orange") === "Orange").length;
  const sitesFree    = sitesRMS.filter(s => s.sim_operateur === "Free").length;
  const sitesAvecSim = sitesRMS.filter(s => s.sim_numero).length;

  // ── Coûts téléphonie filtrés ───────────────────────────────────────────────
  const filteredSims = simsCoutEvolution.filter(p => p.annee === filterAnnee && (filterMois === 0 || p.mois === filterMois));
  const filteredVeh  = vehiculesCoutEvolution.filter(p => p.annee === filterAnnee && (filterMois === 0 || p.mois === filterMois));
  const filteredRms  = sitesEvolution.filter(p => p.annee === filterAnnee && (filterMois === 0 || p.mois === filterMois));
  const coutSims = filteredSims.reduce((s, p) => s + p.total, 0);
  const coutVeh  = filteredVeh.reduce((s, p) => s + p.total, 0);
  const coutRms  = filteredRms.reduce((s, p) => s + p.total, 0);
  const coutTelTotal = coutSims + coutVeh + coutRms;

  // Dernière évolution connue (pour tendance)
  const lastSimEvol = simsCoutEvolution.filter(p => p.annee === filterAnnee).sort((a,b) => b.mois - a.mois)[0];
  const lastRmsEvol = sitesEvolution.filter(p => p.annee === filterAnnee).sort((a,b) => b.mois - a.mois)[0];
  const lastVehEvol = vehiculesCoutEvolution.filter(p => p.annee === filterAnnee).sort((a,b) => b.mois - a.mois)[0];

  // Courbes
  const evolToChart = (arr: typeof sitesEvolution) =>
    arr.filter(p => p.annee === filterAnnee)
      .sort((a, b) => a.mois - b.mois)
      .map(p => ({ label: MOIS_COURTS[p.mois], value: p.total }));

  const rmsChart  = evolToChart(sitesEvolution);
  const simsChart = evolToChart(simsCoutEvolution);
  const vehChart  = evolToChart(vehiculesCoutEvolution);

  // ── Matériels ──────────────────────────────────────────────────────────────
  const donutEtat = stats ? [
    { label:"Disponible",  value:stats.disponible,  color:"#003c71" },
    { label:"Attribué",    value:stats.attribue,    color:"#1e6091" },
    { label:"Maintenance", value:stats.maintenance, color:"#64748b" },
    { label:"Réformé",     value:stats.reforme,     color:"#94a3b8" },
  ] : [];

  const donutType = byType.slice(0, 5).map((r, i) => ({
    label: TYPE_LABELS[r.type] ?? r.type,
    value: r.count,
    color: ["#003c71","#1e6091","#2d9cdb","#64748b","#94a3b8"][i],
  }));

  // ── Attributions ───────────────────────────────────────────────────────────
  const monthOf = (d: string | null) => {
    if (!d) return null;
    const dt = new Date(d);
    return dt.getFullYear() === filterAnnee ? dt.getMonth() + 1 : null;
  };
  const attrByMonth = Array.from({ length: 12 }, (_, i) => ({
    label: MOIS_COURTS[i + 1],
    value: attributions.filter(a => monthOf(a.date_attribution) === i + 1).length,
  }));

  // ── Opérateurs factures ────────────────────────────────────────────────────
  const operateurMap = new Map<string, number>();
  filteredFactures.forEach(f => {
    const k = f.operateur ?? "Inconnu";
    operateurMap.set(k, (operateurMap.get(k) ?? 0) + factureTotal(f));
  });

  return (
    <AppLayout>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-camublue-900">Tableau de bord</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {user?.full_name ? `${user.full_name} · ` : ""}Vue d'ensemble · {periodeLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterAnnee} onChange={e => setFilterAnnee(Number(e.target.value))}
              className="input-base w-auto px-3 py-2 text-sm font-semibold">
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Chips mois */}
        {availableMonths.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterMois(0)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                filterMois === 0
                  ? "bg-camublue-900 text-white border-camublue-900"
                  : "bg-white border-gray-200 text-gray-600 hover:border-camublue-900/30"
              }`}>Annuel</button>
            {availableMonths.map(m => (
              <button key={m} onClick={() => setFilterMois(filterMois === m ? 0 : m)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  filterMois === m
                    ? "bg-camublue-900 text-white border-camublue-900"
                    : "bg-white border-gray-200 text-gray-600 hover:border-camublue-900/30"
                }`}>{MOIS_LABELS[m]}</button>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          GRILLE PRINCIPALE
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-5">
      {/* ── Ligne 1 : Téléphonie + Ventilation ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* ════ 1. TÉLÉPHONIE ══════════════════════════════════════════════════ */}
        <SCard icon={<Phone size={12} className="text-white"/>} title="Téléphonie"
          badge={periodeLabel} accent="bg-camublue-900">
          <div className="p-4 space-y-4">

            {/* Ligne 1 : 3 donuts avec compteurs actifs/inactifs */}
            <div className="grid grid-cols-3 gap-3">
              {/* SIM Employés */}
              <div className="flex flex-col items-center gap-2">
                <DonutChart size={100}
                  segments={[
                    { label:"Actives",    value:simByStatut.get("ACTIVE")??0,    color:"#003c71" },
                    { label:"Inactives",  value:simByStatut.get("INACTIVE")??0,  color:"#94a3b8" },
                    { label:"Suspendues", value:simByStatut.get("SUSPENDUE")??0, color:"#64748b" },
                  ].filter(s=>s.value>0)}
                  total={simByCategorie.get("EMPLOYE") ?? 0}
                />
                <div className="text-center">
                  <p className="text-[11px] font-bold text-gray-700">SIM Employés</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      {sims.filter(s=>s.categorie==="EMPLOYE"&&s.statut==="ACTIVE").length} actives
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {sims.filter(s=>s.categorie==="EMPLOYE"&&s.statut!=="ACTIVE").length} inact.
                    </span>
                  </div>
                  {lastSimEvol?.ecart_pct != null && <Trend pct={lastSimEvol.ecart_pct} />}
                </div>
              </div>

              {/* Sites RMS */}
              <div className="flex flex-col items-center gap-2">
                <DonutChart size={100}
                  segments={[
                    { label:"Orange", value:sitesOrange,                              color:"#1e6091" },
                    { label:"Free",   value:sitesFree,                                color:"#2d9cdb" },
                    { label:"Autres", value:sitesRMS.length-sitesOrange-sitesFree,    color:"#94a3b8" },
                  ].filter(s=>s.value>0)}
                  total={sitesRMS.length}
                />
                <div className="text-center">
                  <p className="text-[11px] font-bold text-gray-700">Sites RMS</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      {sitesAvecSim} avec SIM
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {sitesRMS.length - sitesAvecSim} sans
                    </span>
                  </div>
                  {lastRmsEvol?.ecart_pct != null && <Trend pct={lastRmsEvol.ecart_pct} />}
                </div>
              </div>

              {/* Véhicules M2M */}
              <div className="flex flex-col items-center gap-2">
                <DonutChart size={100}
                  segments={[
                    { label:"SIM M2M", value:simByCategorie.get("M2M_VEHICULE")??0, color:"#2d9cdb" },
                    { label:"Sans",    value:Math.max(0,(simByCategorie.get("M2M_VEHICULE")??0)===0?1:0), color:"#e2e8f0" },
                  ].filter(s=>s.value>0)}
                  total={simByCategorie.get("M2M_VEHICULE") ?? 0}
                />
                <div className="text-center">
                  <p className="text-[11px] font-bold text-gray-700">Véhicules M2M</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      {sims.filter(s=>s.categorie==="M2M_VEHICULE"&&s.statut==="ACTIVE").length} actives
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {sims.filter(s=>s.categorie==="M2M_VEHICULE"&&s.statut!=="ACTIVE").length} inact.
                    </span>
                  </div>
                  {lastVehEvol?.ecart_pct != null && <Trend pct={lastVehEvol.ecart_pct} />}
                </div>
              </div>
            </div>

            {/* Ligne 2 : détail KPIs */}
            <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-0">
              <KpiRow label="Total SIM"         value={sims.length} />
              <KpiRow label="Actives"           value={simActives}    colorDot="#10b981" />
              <KpiRow label="Inactives / Susp." value={simInactives}  colorDot="#94a3b8" />
              <KpiRow label="Sites RMS"         value={sitesRMS.length} />
              <KpiRow label="Sites avec SIM"    value={sitesAvecSim}  colorDot="#f97316" />
              <KpiRow label="Sites Orange"      value={sitesOrange}   colorDot="#f97316" />
              <KpiRow label="Sites Free"        value={sitesFree}     colorDot="#ef4444" />
              {coutTelTotal > 0 && (
                <KpiRow label="Coût total" value={`${Math.round(coutTelTotal).toLocaleString("fr-FR")} FCFA`} />
              )}
            </div>

            {/* Ligne 3 : mini courbes */}
            {(simsChart.length > 0 || rmsChart.length > 0 || vehChart.length > 0) && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { chart:simsChart, color:"#003c71", label:"SIM emp." },
                  { chart:rmsChart,  color:"#1e6091", label:"RMS"      },
                  { chart:vehChart,  color:"#2d9cdb", label:"Véh."     },
                ].map(c => c.chart.length > 0 && (
                  <div key={c.label}>
                    <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{c.label}</p>
                    <MiniLine data={c.chart} colorHex={c.color} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </SCard>

        {/* ════ 2. VENTILATION BUDGET TÉLÉPHONIE ═══════════════════════════════ */}
        <SCard icon={<Wallet size={12} className="text-white"/>} title="Ventilation du budget téléphonie"
          badge={periodeLabel} accent="bg-[#003c71]" flex>
          <div className="flex flex-col flex-1">
            {coutTelTotal === 0 ? (
              <p className="text-gray-400 text-xs text-center py-8">Aucune donnée de coût pour {periodeLabel}</p>
            ) : (
              <>
                {/* Donut + légende */}
                <div className="flex items-center justify-center gap-8 py-6 px-4 border-b border-gray-50 shrink-0">
                  <DonutChart size={160}
                    segments={[
                      { label:"SIM Employés",  value:Math.round(coutSims), color:"#003c71" },
                      { label:"Sites RMS",     value:Math.round(coutRms),  color:"#1e6091" },
                      { label:"Véhicules M2M", value:Math.round(coutVeh),  color:"#2d9cdb" },
                    ].filter(s => s.value > 0)}
                    total={Math.round(coutTelTotal)}
                  />
                  <div className="space-y-2 min-w-[160px]">
                    {[
                      { label:"SIM Employés",  value:coutSims, color:"#003c71" },
                      { label:"Sites RMS",     value:coutRms,  color:"#1e6091" },
                      { label:"Véhicules M2M", value:coutVeh,  color:"#2d9cdb" },
                    ].filter(c => c.value > 0).map(c => (
                      <div key={c.label} className="flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor:c.color }}/>
                          <span className="text-gray-600 font-medium">{c.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800">{Math.round(c.value/1000)}k</span>
                          <span className="text-[10px] text-gray-400">
                            {coutTelTotal > 0 ? `${Math.round((c.value/coutTelTotal)*100)}%` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-bold">
                      <span className="text-gray-500">Total</span>
                      <span className="text-camublue-900">{Math.round(coutTelTotal).toLocaleString("fr-FR")} F</span>
                    </div>
                  </div>
                </div>

                {/* Tableau */}
                <div className="overflow-x-auto flex-1">
              <table className="w-full h-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Poste</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Éléments</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Montant (FCFA)</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Coût unitaire</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">% budget</th>
                    <th className="px-4 py-2.5 w-32 font-semibold text-gray-500">Répartition</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Tendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label:"SIM Employés",  value:coutSims, color:"#003c71", nb:simByCategorie.get("EMPLOYE")??0,      unite:"SIM",   trend:lastSimEvol?.ecart_pct??null },
                    { label:"Sites RMS",     value:coutRms,  color:"#1e6091", nb:sitesRMS.length,                        unite:"site",  trend:lastRmsEvol?.ecart_pct??null },
                    { label:"Véhicules M2M", value:coutVeh,  color:"#2d9cdb", nb:simByCategorie.get("M2M_VEHICULE")??0, unite:"SIM",   trend:lastVehEvol?.ecart_pct??null },
                  ].map(c => {
                    const pct = coutTelTotal > 0 ? (c.value / coutTelTotal) * 100 : 0;
                    const pu  = c.nb > 0 ? c.value / c.nb : 0;
                    return (
                      <tr key={c.label} className="hover:bg-gray-50/60 transition h-16">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor:c.color }}/>
                            <span className="font-semibold text-gray-800">{c.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-gray-600">{c.nb} {c.unite}{c.nb > 1 && c.unite !== "SIM" ? "s" : ""}</td>
                        <td className="px-4 py-4 text-right font-bold text-gray-800">{Math.round(c.value).toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-4 text-right text-gray-500">{pu > 0 ? Math.round(pu).toLocaleString("fr-FR") : "—"}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-700">{Math.round(pct)}%</td>
                        <td className="px-4 py-4">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor:c.color }} />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {c.trend != null ? <Trend pct={c.trend} /> : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#003c71]/5 border-t border-[#003c71]/10">
                    <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-600 text-[11px]">Total</td>
                    <td className="px-4 py-2.5 text-right font-black text-camublue-900 text-[11px]">
                      {Math.round(coutTelTotal).toLocaleString("fr-FR")}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
                </div>{/* fin overflow-x-auto */}
              </>
            )}
          </div>
        </SCard>

      </div>{/* fin grille ligne 1 */}

      {/* ── Ligne 2 : Top 10 lignes téléphoniques ── */}
      {(() => {
        type TopLigne = { numero: string; montant: number; mois: number; annee: number; operateur: string };
        const top10: TopLigne[] = filteredFactures
          .flatMap(f => f.lignes.map(l => ({
            numero:    l.numero_raw,
            montant:   l.solde_facture != null ? parseFloat(l.solde_facture)
                     : l.montant_ttc  != null ? parseFloat(l.montant_ttc)
                     : parseFloat(l.montant),
            mois:      f.mois,
            annee:     f.annee,
            operateur: f.operateur ?? "—",
          })))
          .filter(l => !isNaN(l.montant) && l.montant > 0)
          .sort((a, b) => b.montant - a.montant)
          .slice(0, 10);

        if (top10.length === 0) return null;
        return (
          <SCard icon={<Receipt size={12} className="text-white"/>}
            title="Top 10 — Lignes téléphoniques les plus coûteuses"
            badge={periodeLabel} accent="bg-camublue-900">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-400 w-8">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Numéro</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Opérateur</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Période</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Montant (FCFA)</th>
                    <th className="px-3 py-2.5 w-36">
                      <span className="text-gray-400 font-semibold">Part du total</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {top10.map((l, i) => {
                    const pct = totalFactures > 0 ? (l.montant / totalFactures) * 100 : 0;
                    const heat = i < 3 ? "#003c71" : i < 6 ? "#1e6091" : "#2d9cdb";
                    return (
                      <tr key={`${l.numero}-${l.mois}`} className="hover:bg-gray-50/60 transition">
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black text-white`}
                            style={{ backgroundColor: heat }}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-gray-800">{l.numero}</td>
                        <td className="px-3 py-2 text-gray-500">{l.operateur}</td>
                        <td className="px-3 py-2 text-gray-500">{MOIS_LABELS[l.mois]} {l.annee}</td>
                        <td className="px-3 py-2 text-right font-black text-gray-800">
                          {Math.round(l.montant).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor:heat }} />
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0 w-7 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#003c71]/5 border-t border-[#003c71]/10">
                    <td colSpan={4} className="px-3 py-2 font-bold text-gray-500 text-[11px]">Cumul Top 10</td>
                    <td className="px-3 py-2 text-right font-black text-camublue-900 text-[11px]">
                      {Math.round(top10.reduce((s,l)=>s+l.montant,0)).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-400 text-right">
                      {totalFactures > 0
                        ? `${((top10.reduce((s,l)=>s+l.montant,0)/totalFactures)*100).toFixed(1)}% du total`
                        : ""}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SCard>
        );
      })()}

      {/* ── Ligne 3 : Parc Informatique + Factures ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* ════ 3. PARC INFORMATIQUE ═══════════════════════════════════════════ */}
        <SCard icon={<Monitor size={12} className="text-white"/>} title="Parc Informatique"
          accent="bg-camublue-900">
          <div className="p-4 space-y-4">

            {/* 2 donuts côte à côte */}
            <div className="flex gap-8 justify-center flex-wrap">
              {/* État */}
              <div className="flex flex-col items-center gap-2">
                <DonutChart size={110} segments={donutEtat} total={stats?.total ?? 0} />
                <div className="space-y-1 min-w-[110px]">
                  {[
                    { label:"Disponible",  color:"#003c71", val:stats?.disponible  ?? 0 },
                    { label:"Attribué",    color:"#1e6091", val:stats?.attribue    ?? 0 },
                    { label:"Maintenance", color:"#64748b", val:stats?.maintenance ?? 0 },
                    { label:"Réformé",     color:"#94a3b8", val:stats?.reforme     ?? 0 },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between text-[11px] gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }}/>
                        {r.label}
                      </div>
                      <span className="font-bold text-gray-700">{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Séparateur vertical */}
              {donutType.length > 0 && <div className="hidden sm:block w-px bg-gray-100 self-stretch mx-2" />}

              {/* Par type */}
              {donutType.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <DonutChart size={110} segments={donutType} total={stats?.total ?? 0} />
                  <div className="space-y-1 min-w-[110px]">
                    {donutType.map(r => (
                      <div key={r.label} className="flex items-center justify-between text-[11px] gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }}/>
                          {r.label}
                        </div>
                        <span className="font-bold text-gray-700">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* KPIs complémentaires */}
            <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-0">
              <KpiRow label="Total équipements" value={stats?.total ?? 0} />
              <KpiRow label="Taux d'attribution"
                value={stats && stats.total > 0
                  ? `${Math.round((stats.attribue / stats.total) * 100)}%`
                  : "—"} />
              <KpiRow label="En maintenance"    value={stats?.maintenance ?? 0} colorDot="#f59e0b" />
              <KpiRow label="Réformés"          value={stats?.reforme     ?? 0} colorDot="#ef4444" />
            </div>
          </div>
        </SCard>

        {/* ════ 4. FACTURES ════════════════════════════════════════════════════ */}
        <SCard icon={<Receipt size={12} className="text-white"/>} title="Factures"
          badge={periodeLabel} accent="bg-camublue-900">
          <div className="p-4 space-y-4">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Factures",   value:nbFactures,                                          color:"text-camublue-900" },
                { label:"Total FCFA", value:Math.round(totalFactures).toLocaleString("fr-FR"),   color:"text-camublue-900" },
                { label:"Moyenne",    value:Math.round(moyenneFacture).toLocaleString("fr-FR"),  color:"text-camublue-900" },
              ].map(k => (
                <div key={k.label} className="rounded-xl bg-gray-50 p-3 text-center">
                  <p className={`text-base font-black leading-none ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">{k.label}</p>
                  {k.label === "Factures" && dernierEcartPct != null && (
                    <div className="mt-1 flex justify-center"><Trend pct={dernierEcartPct} /></div>
                  )}
                </div>
              ))}
            </div>

            {/* Mini courbe mensuelle */}
            {!factLoading && nbFactures > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 font-semibold mb-1">Évolution mensuelle {filterAnnee}</p>
                <MiniLine data={monthlyFact} colorHex="#003c71" />
              </div>
            )}

            {/* Tableau résumé */}
            {!factLoading && nbFactures > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Mois</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Opérateur</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Lignes</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Montant</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Évol.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...filteredFactures]
                      .sort((a, b) => b.mois - a.mois)
                      .map(f => (
                        <tr key={f.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-3 py-2 font-semibold text-gray-700">
                            {MOIS_LABELS[f.mois]}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{f.operateur ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{f.lignes.length}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-800">
                            {factureTotal(f).toLocaleString("fr-FR")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {f.ecart_pct != null
                              ? <Trend pct={f.ecart_pct} />
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#003c71]/5 border-t border-[#003c71]/10">
                      <td colSpan={3} className="px-3 py-2 font-bold text-gray-600 text-[11px]">Total</td>
                      <td className="px-3 py-2 text-right font-black text-camublue-900 text-[11px]">
                        {Math.round(totalFactures).toLocaleString("fr-FR")}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : factLoading ? (
              <p className="text-gray-400 text-xs text-center py-4">Chargement…</p>
            ) : (
              <p className="text-gray-400 text-xs text-center py-4">Aucune facture pour {periodeLabel}</p>
            )}
          </div>
        </SCard>

      </div>{/* fin grille ligne 3 */}

      {/* ── Ligne 4 : Attributions ── */}
      {/* ════ 5. ATTRIBUTIONS ════════════════════════════════════════════════ */}
      <SCard icon={<ClipboardList size={12} className="text-white"/>} title="Attributions"
        badge={String(filterAnnee)} accent="bg-camublue-900">
        <div className="p-4 space-y-4">

          {/* Donut + top services */}
          <div className="flex gap-4 items-start flex-wrap">
            {attrStats && (
              <div className="flex flex-col items-center gap-2 shrink-0">
                <DonutChart size={110}
                  segments={[
                    { label:"Actives",   value:attrStats.active,   color:"#10b981" },
                    { label:"Clôturées", value:attrStats.cloturee, color:"#94a3b8" },
                  ].filter(s => s.value > 0)}
                  total={attrStats.active + attrStats.cloturee}
                />
                <div className="space-y-1 min-w-[110px]">
                  <KpiRow label="Actives"        value={attrStats.active}           colorDot="#003c71" />
                  <KpiRow label="Clôturées"      value={attrStats.cloturee}         colorDot="#94a3b8" />
                  <KpiRow label="Employés actifs" value={attrStats.employees_actifs} colorDot="#1e6091" />
                </div>
              </div>
            )}

            {/* Top services + courbe */}
            <div className="flex-1 min-w-[140px] space-y-3">
              {attrStats && attrStats.par_service.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Top services</p>
                  {attrStats.par_service.slice(0, 5).map((r, i) => {
                    const max = attrStats.par_service[0]?.count ?? 1;
                    const pct = (r.count / max) * 100;
                    const colors = ["#003c71","#1e6091","#2d9cdb","#64748b","#94a3b8"];
                    return (
                      <div key={r.service}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-gray-600 truncate max-w-[110px]">{r.service}</span>
                          <span className="font-bold text-gray-700 ml-2">{r.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor:colors[i] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {attrByMonth.some(d => d.value > 0) && (
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Attributions {filterAnnee}</p>
                  <MiniLine data={attrByMonth} colorHex="#1e6091" />
                </div>
              )}
            </div>
          </div>
        </div>
      </SCard>

      </div>{/* fin space-y-5 */}
    </AppLayout>
  );
}

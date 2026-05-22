import { useEffect, useState } from "react";
import {
  Monitor, CheckCircle, Wrench, Archive, Smartphone,
  ClipboardList, AlertTriangle, AlertCircle, Info, Users, BarChart2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { materielService, simService, attributionService } from "@/services/api";

interface Stats       { total: number; disponible: number; attribue: number; maintenance: number; reforme: number; }
interface TypeRow     { type: string; count: number; }
interface BrandRow    { marque: string; count: number; }
interface AttrStats   { active: number; cloturee: number; employees_actifs: number; par_service: { service: string; count: number }[]; }

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

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, bg, text }: { label: string; value: number; icon: React.ReactNode; bg: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <span className={text}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-gray-800">{value}</p>
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
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [byType,     setByType]     = useState<TypeRow[]>([]);
  const [byBrand,    setByBrand]    = useState<BrandRow[]>([]);
  const [attrStats,  setAttrStats]  = useState<AttrStats | null>(null);
  const [simCount,   setSimCount]   = useState(0);

  useEffect(() => {
    materielService.stats().then(setStats).catch(() => {});
    materielService.statsByType().then(setByType).catch(() => {});
    materielService.statsByBrand().then(setByBrand).catch(() => {});
    attributionService.stats().then(setAttrStats).catch(() => {});
    simService.getAll().then(d => setSimCount(d.length)).catch(() => {});
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

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-camublue-900 mb-1">Tableau de bord</h1>
      <p className="text-gray-500 text-sm mb-8">
        Bienvenue{user?.full_name ? `, ${user.full_name}` : ""} — Vue d'ensemble du parc informatique & téléphonie
      </p>

      {/* ══ KPIs matériels ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total matériels"  value={stats?.total       ?? 0} icon={<Monitor       size={20}/>} bg="bg-slate-100"   text="text-slate-600"   />
        <KpiCard label="Disponibles"      value={stats?.disponible  ?? 0} icon={<CheckCircle   size={20}/>} bg="bg-emerald-100" text="text-emerald-600" />
        <KpiCard label="Attribués"        value={stats?.attribue    ?? 0} icon={<ClipboardList size={20}/>} bg="bg-blue-100"    text="text-blue-600"    />
        <KpiCard label="En maintenance"   value={stats?.maintenance ?? 0} icon={<Wrench        size={20}/>} bg="bg-amber-100"   text="text-amber-600"   />
        <KpiCard label="Réformés"         value={stats?.reforme     ?? 0} icon={<Archive       size={20}/>} bg="bg-red-100"     text="text-red-500"     />
      </div>

      {/* ══ Ligne 1 : répartition + barres statut + alertes ═════════════════════ */}
      <div className="grid md:grid-cols-3 gap-5 mb-5">

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
                <span className="font-bold text-purple-600">{simCount}</span>
              </div>
            </div>
          ) : <p className="text-gray-400 text-sm">Chargement…</p>}
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

      {/* ══ Ligne 3 : attributions ══════════════════════════════════════════════ */}
      <div className="grid md:grid-cols-3 gap-5">

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

        {/* Par service */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
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
      </div>
    </AppLayout>
  );
}

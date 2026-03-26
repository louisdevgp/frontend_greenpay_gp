import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { getDashboardStats } from "../../services/stats.service";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import DatePicker from "../../components/form/date-picker";
import { formatMoney } from "../../utils/formatUtils";

type MoneyCount = { count?: number; montant?: number };
type ByStatutRow = { statut: string; count?: number; montant?: number };
type ByProfilRow = { role: string; count?: number; montant?: number };
type ByMoyenRow = { moyen_paiement?: string; moyen?: string; count?: number; montant?: number };
type TopBeneficiaireRow = { beneficiaire?: string; count?: number; montant?: number };
type DirectionItem = { id: number; nom: string };

type DashboardData = {
  period?: { from?: string; to?: string };
  role?: string;
  direction?: DirectionItem | null;
  directions?: DirectionItem[] | null;
  global?: {
    demandes?: MoneyCount;
    validationsPending?: MoneyCount;
    demandesByStatut?: ByStatutRow[];
  };
  admin?: { demandesByProfil?: ByProfilRow[] };
  demandeur?: { total?: MoneyCount; demandesByStatut?: ByStatutRow[] };
  validator?: { pending?: MoneyCount & { aging?: Record<string, number> } };
  compta?: {
    payable?: MoneyCount;
    exceptions?: { payeSansReception?: number; receptionSansPaiement?: number };
    paiementsByMoyen?: ByMoyenRow[];
  };
  exec?: { demandes?: MoneyCount; paiements?: MoneyCount; topBeneficiaires?: TopBeneficiaireRow[] };
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Erreur inconnue";
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [directionId, setDirectionId] = useState("");

  const [month, setMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`; // YYYY-MM
  });

  const buildPeriodParams = (yyyyMm: string) => {
    const [yRaw, mRaw] = String(yyyyMm || "").split("-");
    const y = Number(yRaw);
    const m = Number(mRaw);
    const now = new Date();

    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return {};

    const from = new Date(y, m - 1, 1, 0, 0, 0, 0);

    // si mois courant -> to = maintenant, sinon fin du mois
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
    const to = isCurrentMonth ? now : new Date(y, m, 0, 23, 59, 59, 999);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  };

  const fetchData = async (yyyyMm = month, dirId = directionId) => {
    setLoading(true);
    setError("");
    try {
      const params = { ...buildPeriodParams(yyyyMm) } as Record<string, unknown>;
      if (dirId) params.direction_id = dirId;
      const res = await getDashboardStats(params);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement dashboard");
      setData((res.data || null) as DashboardData | null);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(month, directionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, directionId]);

  const periodLabel = useMemo(() => {
    const fromIso = data?.period?.from;
    const toIso = data?.period?.to;
    if (!fromIso || !toIso) return "";
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
    return `${from.toLocaleDateString("fr-FR")} → ${to.toLocaleDateString("fr-FR")}`;
  }, [data?.period?.from, data?.period?.to]);

  const directionBadge = useMemo(() => {
    if (data?.direction?.nom) return `Direction: ${data.direction.nom}`;
    if (Array.isArray(data?.directions)) return "Direction: Toutes";
    return "";
  }, [data?.direction?.nom, data?.directions]);

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const CHART_COLORS = useMemo(
    () => [
      "var(--color-brand-500)",
      "var(--color-brand-300)",
      "var(--color-blue-light-500)",
      "var(--color-success-500)",
      "var(--color-warning-500)",
      "var(--color-error-500)",
      "var(--color-gray-500)",
    ],
    []
  );

  const axisLabelStyle = {
    colors: "var(--color-gray-500)",
    fontSize: "11px",
    fontWeight: 500,
  };

  const baseChartOptions: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      foreColor: "var(--color-gray-500)",
    },
    theme: { mode: isDark ? "dark" : "light" },
    grid: { borderColor: "var(--color-gray-200)", strokeDashArray: 4 },
    dataLabels: { style: { fontSize: "11px", fontWeight: 600 } },
    legend: { labels: { colors: "var(--color-gray-500)" } },
    tooltip: { theme: isDark ? "dark" : "light" },
  };

  const fadeIn = (delay = 0): CSSProperties => ({
    animation: `dash-fade 0.6s ease-out ${delay}ms both`,
  });

  type Tone = "brand" | "info" | "success" | "warning" | "error" | "neutral";

  const toneMap: Record<Tone, { bar: string; glow: string; chip: string }> = {
    brand: {
      bar: "from-brand-500 to-brand-300",
      glow: "bg-[radial-gradient(120%_120%_at_90%_0%,rgba(70,95,255,0.18)_0%,transparent_60%)]",
      chip: "bg-brand-50 text-brand-700",
    },
    info: {
      bar: "from-blue-light-500 to-blue-light-300",
      glow: "bg-[radial-gradient(120%_120%_at_90%_0%,rgba(11,165,236,0.18)_0%,transparent_60%)]",
      chip: "bg-blue-light-50 text-blue-light-700",
    },
    success: {
      bar: "from-success-500 to-success-300",
      glow: "bg-[radial-gradient(120%_120%_at_90%_0%,rgba(18,183,106,0.18)_0%,transparent_60%)]",
      chip: "bg-success-50 text-success-700",
    },
    warning: {
      bar: "from-orange-500 to-orange-300",
      glow: "bg-[radial-gradient(120%_120%_at_90%_0%,rgba(251,101,20,0.18)_0%,transparent_60%)]",
      chip: "bg-orange-50 text-orange-700",
    },
    error: {
      bar: "from-error-500 to-error-300",
      glow: "bg-[radial-gradient(120%_120%_at_90%_0%,rgba(240,68,56,0.18)_0%,transparent_60%)]",
      chip: "bg-error-50 text-error-700",
    },
    neutral: {
      bar: "from-gray-500 to-gray-300",
      glow: "bg-[radial-gradient(120%_120%_at_90%_0%,rgba(102,112,133,0.16)_0%,transparent_60%)]",
      chip: "bg-gray-100 text-gray-700",
    },
  };

  const SectionHeader = ({
    title,
    subtitle,
    badge,
  }: {
    title: string;
    subtitle?: string;
    badge?: string;
  }) => (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          {badge}
        </span>
      ) : null}
    </div>
  );

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
      {label}
    </div>
  );

  const StatCard = ({
    title,
    value,
    subtitle,
    tone = "brand",
  }: {
    title: string;
    value: string;
    subtitle?: string;
    tone?: Tone;
  }) => {
    const toneCfg = toneMap[tone];
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_12px_30px_rgba(16,24,40,0.06)] dark:border-gray-800 dark:bg-gray-900/70">
        <div className={`pointer-events-none absolute inset-0 ${toneCfg.glow}`} />
        <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${toneCfg.bar}`} />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneCfg.chip}`}>KPI</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
      </div>
    );
  };

  const ChartCard = ({
    title,
    subtitle,
    children,
    tone = "brand",
  }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    tone?: Tone;
  }) => {
    const toneCfg = toneMap[tone];
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 shadow-[0_10px_26px_rgba(16,24,40,0.05)] dark:border-gray-800 dark:bg-gray-900/70 sm:px-6 sm:pt-6">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneCfg.bar}`} />
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    );
  };

  return (
    <>
      <PageMeta
        title="Dashboard | GreenPay Achats"
        description="Dashboard par profil (montant + created_at)"
      />

      <FullscreenLoader show={loading} label="Chargement du dashboard..." />

      <div className="space-y-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white px-5 py-6 shadow-[0_18px_40px_rgba(16,24,40,0.08)] dark:border-gray-800 dark:bg-gray-900/70 sm:px-8 sm:py-7"
          style={fadeIn(0)}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(70,95,255,0.18)_0%,transparent_60%)]" />
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-success-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-400">
                GREENPAY E-DEPENSES
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90 sm:text-3xl">
                Dashboard
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="rounded-full border border-gray-200 bg-white/80 px-3 py-1 font-medium dark:border-gray-800 dark:bg-gray-900/70">
                  {periodLabel ? `Période: ${periodLabel}` : "Période: mois en cours"}
                </span>
                {directionBadge ? (
                  <span className="rounded-full border border-gray-200 bg-white/80 px-3 py-1 font-medium dark:border-gray-800 dark:bg-gray-900/70">
                    {directionBadge}
                  </span>
                ) : null}
                {data?.role ? (
                  <span className="rounded-full bg-gray-900 px-3 py-1 font-medium text-white dark:bg-white/10 dark:text-white/80">
                    Profil: {data.role}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-end gap-3">
              {Array.isArray(data?.directions) && data.directions.length ? (
                <div className="relative z-10 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    Direction
                  </label>
                  <div className="mt-2 w-[200px] sm:w-[220px]">
                    <select
                      id="dashboard-direction"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-brand-400"
                      value={directionId}
                      onChange={(event) => setDirectionId(event.target.value)}
                    >
                      <option value="">Toutes directions</option>
                      {data.directions.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
              <div className="relative z-10 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Mois
                </label>
                <div className="mt-2 w-[170px] sm:w-[190px]">
                  <DatePicker
                    id="dashboard-month"
                    placeholder="YYYY-MM"
                    dateFormat="Y-m"
                    defaultDate={`${month}-01`}
                    options={{ static: false }}
                    onChange={(_date: Date | null, dateStr?: string) => {
                      if (dateStr) setMonth(dateStr);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[0_10px_24px_rgba(240,68,56,0.12)] dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
            style={fadeIn(80)}
          >
            {error}
          </div>
        ) : null}

        {/* GLOBAL (tous profils) */}
        {data?.global ? (
          <section className="space-y-4" style={fadeIn(120)}>
            <SectionHeader
              title="Vue globale"
              subtitle="Indicateurs consolidés sur la période sélectionnée."
              badge="Tous profils"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Demandes (global)"
                value={String(data.global?.demandes?.count ?? 0)}
                subtitle="Nb demandes (période)"
                tone="brand"
              />
              <StatCard
                title="Montant (global)"
                value={`${formatMoney(data.global?.demandes?.montant ?? 0)} FCFA`}
                subtitle="Total demandes (période)"
                tone="info"
              />
              <StatCard
                title="Validations en attente"
                value={String(data.global?.validationsPending?.count ?? 0)}
                subtitle="Global (période)"
                tone="warning"
              />
              <StatCard
                title="Montant en attente"
                value={`${formatMoney(data.global?.validationsPending?.montant ?? 0)} FCFA`}
                subtitle="Global (période)"
                tone="error"
              />
            </div>

            {Array.isArray(data.global?.demandesByStatut) && data.global.demandesByStatut.length ? (
              <ChartCard title="Demandes par statut" subtitle="Nombre de demandes (période)" tone="info">
                {(() => {
                  const rows = data.global?.demandesByStatut || [];
                  const labels = rows.map((r: ByStatutRow) => String(r.statut));
                  const series = rows.map((r: ByStatutRow) => Number(r.count || 0));

                  const options: ApexOptions = {
                    ...baseChartOptions,
                    chart: { ...(baseChartOptions.chart || {}), type: "donut" },
                    labels,
                    colors: CHART_COLORS,
                    legend: { ...(baseChartOptions.legend || {}), position: "bottom" },
                    stroke: { width: 2, colors: ["transparent"] },
                    dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: true },
                    tooltip: {
                      ...(baseChartOptions.tooltip || {}),
                      y: { formatter: (val: number) => `${val} demande(s)` },
                    },
                    plotOptions: {
                      pie: {
                        donut: {
                          size: "70%",
                          labels: {
                            show: true,
                            total: {
                              show: true,
                              label: "Total",
                              formatter: () => String(data.global?.demandes?.count ?? 0),
                            },
                          },
                        },
                      },
                    },
                  };

                  if (!series.some((x: number) => x > 0)) {
                    return <EmptyState label="Aucune donnée sur la période." />;
                  }

                  return <Chart options={options} series={series} type="donut" height={280} />;
                })()}
              </ChartCard>
            ) : null}
          </section>
        ) : null}

        {/* ADMIN breakdown */}
        {data?.role === "ADMIN" && Array.isArray(data?.admin?.demandesByProfil) ? (
          <section className="space-y-4" style={fadeIn(180)}>
            <SectionHeader
              title="Demandes par profil"
              subtitle="Répartition des demandes (période) par rôle du demandeur."
              badge="Admin"
            />

            <ChartCard title="Demandes par profil" subtitle="Nombre de demandes (période)" tone="brand">
              {(() => {
                const rows = data.admin?.demandesByProfil || [];
                const categories = rows.map((r: ByProfilRow) => String(r.role));
                const seriesData = rows.map((r: ByProfilRow) => Number(r.count || 0));

                const options: ApexOptions = {
                  ...baseChartOptions,
                  chart: { ...(baseChartOptions.chart || {}), type: "bar", height: 280 },
                  colors: ["var(--color-brand-500)"],
                  plotOptions: { bar: { borderRadius: 10, columnWidth: "45%" } },
                  dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: true, offsetY: -4 },
                  xaxis: {
                    categories,
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { style: axisLabelStyle },
                  },
                  yaxis: { labels: { style: axisLabelStyle } },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <EmptyState label="Aucune donnée sur la période." />;
                }

                return <Chart options={options} series={[{ name: "Demandes", data: seriesData }]} type="bar" height={280} />;
              })()}
            </ChartCard>
          </section>
        ) : null}

        {/* DEMANDEUR */}
        {data?.demandeur ? (
          <section className="space-y-4" style={fadeIn(220)}>
            <SectionHeader
              title="Mes demandes"
              subtitle="Suivi personnel des demandes sur la période."
              badge="Demandeur"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Mes demandes (période)"
                value={String(data.demandeur?.total?.count ?? 0)}
                tone="brand"
              />
              <StatCard
                title="Montant total (période)"
                value={`${formatMoney(data.demandeur?.total?.montant ?? 0)} FCFA`}
                tone="info"
              />
              <StatCard
                title="Statuts"
                value={String((data.demandeur?.demandesByStatut || []).length)}
                subtitle="Nb statuts dans la période"
                tone="neutral"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartCard title="Répartition des statuts" subtitle="Nombre de demandes par statut" tone="brand">
                {(() => {
                  const rows = data.demandeur?.demandesByStatut || [];
                  const labels = rows.map((r: ByStatutRow) => String(r.statut));
                  const series = rows.map((r: ByStatutRow) => Number(r.count || 0));

                  const options: ApexOptions = {
                    ...baseChartOptions,
                    chart: { ...(baseChartOptions.chart || {}), type: "donut" },
                    labels,
                    colors: CHART_COLORS,
                    legend: { ...(baseChartOptions.legend || {}), position: "bottom" },
                    stroke: { width: 2, colors: ["transparent"] },
                    dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: true },
                    tooltip: {
                      ...(baseChartOptions.tooltip || {}),
                      y: { formatter: (val: number) => `${val} demande(s)` },
                    },
                    plotOptions: {
                      pie: {
                        donut: {
                          size: "70%",
                          labels: {
                            show: true,
                            total: {
                              show: true,
                              label: "Total",
                              formatter: () => String(data.demandeur?.total?.count ?? 0),
                            },
                          },
                        },
                      },
                    },
                  };

                  if (!series.some((x: number) => x > 0)) {
                    return <EmptyState label="Aucune donnée sur la période." />;
                  }

                  return <Chart options={options} series={series} type="donut" height={280} />;
                })()}
              </ChartCard>

              <ChartCard title="Montant total" subtitle="Montant par statut (FCFA)" tone="info">
                {(() => {
                  const rows = data.demandeur?.demandesByStatut || [];
                  const categories = rows.map((r: ByStatutRow) => String(r.statut));
                  const seriesData = rows.map((r: ByStatutRow) => Number(r.montant || 0));

                  const options: ApexOptions = {
                    ...baseChartOptions,
                    chart: { ...(baseChartOptions.chart || {}), type: "bar", height: 280 },
                    colors: ["var(--color-brand-500)"],
                    plotOptions: {
                      bar: { columnWidth: "45%", borderRadius: 8, distributed: false },
                    },
                    dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: false },
                    xaxis: {
                      categories,
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                      labels: { style: axisLabelStyle },
                    },
                    yaxis: {
                      labels: {
                        formatter: (v: string | number) => formatMoney(Number(v)),
                        style: axisLabelStyle,
                      },
                    },
                    tooltip: { ...(baseChartOptions.tooltip || {}), y: { formatter: (v: number) => `${formatMoney(v)} FCFA` } },
                  };

                  if (!seriesData.some((x: number) => x > 0)) {
                    return <EmptyState label="Aucune donnée sur la période." />;
                  }

                  return (
                    <Chart
                      options={options}
                      series={[{ name: "Montant", data: seriesData }]}
                      type="bar"
                      height={280}
                    />
                  );
                })()}
              </ChartCard>
            </div>
          </section>
        ) : null}

        {/* VALIDATEUR */}
        {data?.validator?.pending ? (
          <section className="space-y-4" style={fadeIn(260)}>
            <SectionHeader
              title="Validation"
              subtitle="Demandes en attente de votre validation."
              badge="Validateur"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Validations en attente"
                value={String(data.validator.pending.count ?? 0)}
                tone="warning"
              />
              <StatCard
                title="Montant en attente"
                value={`${formatMoney(data.validator?.pending?.montant ?? 0)} FCFA`}
                tone="error"
              />
              <StatCard
                title="Vieillissement"
                value={`${data.validator.pending.aging?.["0_2"] ?? 0} / ${data.validator.pending.aging?.["3_7"] ?? 0} / ${data.validator.pending.aging?.["8_plus"] ?? 0}`}
                subtitle="0-2j / 3-7j / 8j+"
                tone="neutral"
              />
            </div>

            <ChartCard title="Vieillissement des demandes" subtitle="Nombre de demandes en attente par tranche" tone="warning">
              {(() => {
                const a = data.validator.pending.aging || {};
                const seriesData = [Number(a["0_2"] || 0), Number(a["3_7"] || 0), Number(a["8_plus"] || 0)];
                const options: ApexOptions = {
                  ...baseChartOptions,
                  chart: { ...(baseChartOptions.chart || {}), type: "bar", height: 260 },
                  colors: [
                    "var(--color-success-500)",
                    "var(--color-warning-500)",
                    "var(--color-error-500)",
                  ],
                  plotOptions: {
                    bar: { distributed: true, borderRadius: 10, columnWidth: "45%" },
                  },
                  dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: true, offsetY: -4 },
                  xaxis: {
                    categories: ["0-2j", "3-7j", "8j+"],
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { style: axisLabelStyle },
                  },
                  yaxis: { labels: { style: axisLabelStyle } },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <EmptyState label="Aucune validation en attente." />;
                }

                return <Chart options={options} series={[{ name: "Demandes", data: seriesData }]} type="bar" height={260} />;
              })()}
            </ChartCard>
          </section>
        ) : null}

        {/* COMPTA */}
        {data?.compta ? (
          <section className="space-y-4" style={fadeIn(300)}>
            <SectionHeader
              title="Comptabilité"
              subtitle="Suivi des paiements et des exceptions."
              badge="Compta"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard title="Demandes payables" value={String(data.compta.payable?.count ?? 0)} tone="success" />
              <StatCard
                title="Montant payable"
                value={`${formatMoney(data.compta?.payable?.montant ?? 0)} FCFA`}
                tone="info"
              />
              <StatCard
                title="Exceptions"
                value={`${data.compta.exceptions?.payeSansReception ?? 0} / ${data.compta.exceptions?.receptionSansPaiement ?? 0}`}
                subtitle="payé sans réception / réception sans paiement"
                tone="warning"
              />
            </div>

            <ChartCard title="Paiements par moyen" subtitle="Montant total par moyen de paiement (période)" tone="info">
              {(() => {
                const rows = data.compta?.paiementsByMoyen || [];
                const categories = rows.map((r: ByMoyenRow) => String(r.moyen_paiement || r.moyen));
                const seriesData = rows.map((r: ByMoyenRow) => Number(r.montant || 0));

                const options: ApexOptions = {
                  ...baseChartOptions,
                  chart: { ...(baseChartOptions.chart || {}), type: "bar", height: 280 },
                  colors: ["var(--color-brand-500)"],
                  plotOptions: { bar: { borderRadius: 10, columnWidth: "45%" } },
                  dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: false },
                  xaxis: {
                    categories,
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { style: axisLabelStyle },
                  },
                  yaxis: {
                    labels: {
                      formatter: (v: string | number) => formatMoney(Number(v)),
                      style: axisLabelStyle,
                    },
                  },
                  tooltip: { ...(baseChartOptions.tooltip || {}), y: { formatter: (v: number) => `${formatMoney(v)} FCFA` } },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <EmptyState label="Aucun paiement sur la période." />;
                }

                return <Chart options={options} series={[{ name: "Montant", data: seriesData }]} type="bar" height={280} />;
              })()}
            </ChartCard>
          </section>
        ) : null}

        {/* EXEC */}
        {data?.exec ? (
          <section className="space-y-4" style={fadeIn(340)}>
            <SectionHeader
              title="Pilotage"
              subtitle="Synthèse direction sur la période."
              badge="Exécutif"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard title="Demandes créées (période)" value={String(data.exec.demandes?.count ?? 0)} tone="brand" />
              <StatCard
                title="Montant demandes (période)"
                value={`${formatMoney(data.exec?.demandes?.montant ?? 0)} FCFA`}
                tone="info"
              />
              <StatCard
                title="Paiements (période)"
                value={`${formatMoney(data.exec?.paiements?.montant ?? 0)} FCFA`}
                subtitle={`# ${data.exec?.paiements?.count ?? 0}`}
                tone="success"
              />
            </div>

            <ChartCard title="Top bénéficiaires" subtitle="Top 10 par montant (période)" tone="brand">
              {(() => {
                const rows = data.exec?.topBeneficiaires || [];
                const categories = rows.map((r: TopBeneficiaireRow) => String(r.beneficiaire));
                const seriesData = rows.map((r: TopBeneficiaireRow) => Number(r.montant || 0));

                const options: ApexOptions = {
                  ...baseChartOptions,
                  chart: { ...(baseChartOptions.chart || {}), type: "bar", height: 340 },
                  colors: ["var(--color-brand-500)"],
                  plotOptions: {
                    bar: {
                      horizontal: true,
                      borderRadius: 10,
                      barHeight: "70%",
                    },
                  },
                  dataLabels: { ...(baseChartOptions.dataLabels || {}), enabled: false },
                  xaxis: {
                    categories,
                    labels: {
                      formatter: (v: string | number) => formatMoney(Number(v)),
                      style: axisLabelStyle,
                    },
                  },
                  yaxis: {
                    labels: { style: axisLabelStyle },
                  },
                  tooltip: { ...(baseChartOptions.tooltip || {}), y: { formatter: (v: number) => `${formatMoney(v)} FCFA` } },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <EmptyState label="Aucune donnée sur la période." />;
                }

                return <Chart options={options} series={[{ name: "Montant", data: seriesData }]} type="bar" height={340} />;
              })()}
            </ChartCard>
          </section>
        ) : null}
      </div>
    </>
  );
}

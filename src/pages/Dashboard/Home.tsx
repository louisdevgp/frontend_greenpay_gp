import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { getDashboardStats } from "../../services/stats.service";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import DatePicker from "../../components/form/date-picker";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";
import { formatMoney } from "../../utils/formatUtils";
import { labelDemandeStatut } from "../../utils/statusLabels";

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

  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });

  const toDateString = (d: Date | null) => {
    if (!d) return "";
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const fetchData = async (dirId = directionId) => {
    setLoading(true);
    setError("");
    try {
      const params = {} as Record<string, unknown>;
      const fromDate = parseDateOnlyStart(periodStart);
      const toDate = parseDateOnlyEnd(periodEnd);
      if (fromDate) params.from = fromDate.toISOString();
      if (toDate) params.to = toDate.toISOString();
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
    fetchData(directionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd, directionId]);

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
    grid: { borderColor: "var(--color-gray-200)", strokeDashArray: 0 },
    dataLabels: { style: { fontSize: "11px", fontWeight: 600 } },
    legend: { labels: { colors: "var(--color-gray-500)" } },
    tooltip: { theme: isDark ? "dark" : "light" },
  };

  const fadeIn = (delay = 0): CSSProperties => ({
    animation: `dash-fade 0.4s ease-out ${delay}ms both`,
  });

  type Tone = "brand" | "info" | "success" | "warning" | "error" | "neutral";

  const toneMap: Record<Tone, { accent: string; value: string; chip: string }> = {
    brand: {
      accent: "bg-brand-500",
      value: "text-brand-700 dark:text-brand-300",
      chip: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300",
    },
    info: {
      accent: "bg-blue-light-500",
      value: "text-blue-light-700 dark:text-blue-light-300",
      chip: "border-blue-light-200 bg-blue-light-50 text-blue-light-700 dark:border-blue-light-500/30 dark:bg-blue-light-500/10 dark:text-blue-light-300",
    },
    success: {
      accent: "bg-success-500",
      value: "text-success-700 dark:text-success-300",
      chip: "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300",
    },
    warning: {
      accent: "bg-warning-500",
      value: "text-warning-700 dark:text-warning-300",
      chip: "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300",
    },
    error: {
      accent: "bg-error-500",
      value: "text-error-700 dark:text-error-300",
      chip: "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300",
    },
    neutral: {
      accent: "bg-gray-500",
      value: "text-gray-800 dark:text-gray-200",
      chip: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
      <div>
        <h2 className="text-[15px] font-medium text-gray-800 dark:text-white/90">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-[3px] border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {badge}
        </span>
      ) : null}
    </div>
  );

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex min-h-[220px] items-center justify-center border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400">
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
      <div className="relative min-h-[116px] border border-gray-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-gray-800 dark:bg-gray-900">
        <div className={`absolute inset-x-0 top-0 h-0.5 ${toneCfg.accent}`} />
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="flex w-full items-center justify-between gap-3">
            <span className={`h-1.5 w-1.5 rounded-full ${toneCfg.accent}`} />
            <span className={`rounded-[3px] border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${toneCfg.chip}`}>
              Période
            </span>
          </div>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${toneCfg.value}`}>{value}</p>
          <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-200">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</p> : null}
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
      <div className="border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 ${toneCfg.accent}`} />
          <div>
            <h3 className="text-sm font-medium text-gray-800 dark:text-white/90">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
          </div>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
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

      <div className="-m-4 min-h-[calc(100vh-80px)] space-y-5 bg-[#f4f6fa] p-4 dark:bg-gray-950 md:-m-6 md:p-6">
        <div
          className="space-y-4"
          style={fadeIn(0)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-medium text-gray-800 dark:text-white/90">Dashboard</h1>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Vue synthétique du circuit des dépenses et des validations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {data?.role ? (
                <span className="border border-brand-200 bg-brand-50 px-2 py-1 font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                  Profil : {data.role}
                </span>
              ) : null}
              {directionBadge ? (
                <span className="border border-gray-200 bg-white px-2 py-1 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  {directionBadge}
                </span>
              ) : null}
              <span className="border border-gray-200 bg-white px-2 py-1 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {periodLabel || "Période personnalisée"}
              </span>
            </div>
          </div>

          <div className="border border-gray-200 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              {Array.isArray(data?.directions) && data.directions.length ? (
                <div className="w-full lg:w-[240px]">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    Direction
                  </label>
                  <select
                    id="dashboard-direction"
                    className="h-10 w-full truncate border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
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
              ) : null}
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-[430px]">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    Du
                  </label>
                  <DatePicker
                    id="dashboard-from"
                    placeholder="YYYY-MM-DD"
                    dateFormat="Y-m-d"
                    defaultDate={periodStart || undefined}
                    options={{ static: false }}
                    className="!h-10 !rounded-none !shadow-none focus:!ring-1"
                    onChange={(d: Date | null) => setPeriodStart(toDateString(d))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    Au
                  </label>
                  <DatePicker
                    id="dashboard-to"
                    placeholder="YYYY-MM-DD"
                    dateFormat="Y-m-d"
                    defaultDate={periodEnd || undefined}
                    options={{ static: false }}
                    className="!h-10 !rounded-none !shadow-none focus:!ring-1"
                    onChange={(d: Date | null) => setPeriodEnd(toDateString(d))}
                  />
                </div>
              </div>
              <div className="flex min-h-10 flex-1 items-center border-l-0 border-gray-200 px-0 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500 lg:border-l lg:px-4">
                Les indicateurs sont recalculés automatiquement lorsque les filtres changent.
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div
            className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
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
                  const labels = rows.map((r: ByStatutRow) => labelDemandeStatut(r.statut));
                  const series = rows.map((r: ByStatutRow) => Number(r.count || 0));

                  const options: ApexOptions = {
                    ...baseChartOptions,
                    chart: { ...(baseChartOptions.chart || {}), type: "donut" },
                    labels,
                    colors: CHART_COLORS,
                    legend: { ...(baseChartOptions.legend || {}), show: false },
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

                  return (
                    <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
                      <Chart options={options} series={series} type="donut" height={280} />
                      <div className="border border-gray-200 dark:border-gray-800">
                        <div className="grid grid-cols-[minmax(0,1fr)_70px_120px] border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-950/60">
                          <span>Statut</span>
                          <span className="text-right">Nombre</span>
                          <span className="text-right">Montant</span>
                        </div>
                        {rows.map((row, index) => (
                          <div
                            key={`${row.statut}-${index}`}
                            className="grid grid-cols-[minmax(0,1fr)_70px_120px] items-center border-b border-gray-100 px-3 py-2.5 text-xs last:border-b-0 dark:border-gray-800"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-gray-600 dark:text-gray-300">
                              <span
                                className="h-2 w-2 shrink-0"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                              <span className="truncate">{labelDemandeStatut(row.statut)}</span>
                            </span>
                            <span className="text-right font-medium text-gray-700 dark:text-gray-200">
                              {row.count ?? 0}
                            </span>
                            <span className="text-right text-gray-500 dark:text-gray-400">
                              {formatMoney(row.montant ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
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
                  plotOptions: { bar: { borderRadius: 2, columnWidth: "45%" } },
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
                  const labels = rows.map((r: ByStatutRow) => labelDemandeStatut(r.statut));
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
                  const categories = rows.map((r: ByStatutRow) => labelDemandeStatut(r.statut));
                  const seriesData = rows.map((r: ByStatutRow) => Number(r.montant || 0));

                  const options: ApexOptions = {
                    ...baseChartOptions,
                    chart: { ...(baseChartOptions.chart || {}), type: "bar", height: 280 },
                    colors: ["var(--color-brand-500)"],
                    plotOptions: {
                      bar: { columnWidth: "45%", borderRadius: 2, distributed: false },
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
                    bar: { distributed: true, borderRadius: 2, columnWidth: "45%" },
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
                  plotOptions: { bar: { borderRadius: 2, columnWidth: "45%" } },
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
                      borderRadius: 2,
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

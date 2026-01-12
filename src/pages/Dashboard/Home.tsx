import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { getDashboardStats } from "../../services/stats.service";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import DatePicker from "../../components/form/date-picker";

type MoneyCount = { count?: number; montant?: number };
type ByStatutRow = { statut: string; count?: number; montant?: number };
type ByProfilRow = { role: string; count?: number; montant?: number };
type ByMoyenRow = { moyen_paiement?: string; moyen?: string; count?: number; montant?: number };
type TopBeneficiaireRow = { beneficiaire?: string; count?: number; montant?: number };

type DashboardData = {
  period?: { from?: string; to?: string };
  role?: string;
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

  const fetchData = async (yyyyMm = month) => {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboardStats(buildPeriodParams(yyyyMm));
      if (!res?.success) throw new Error(res?.message || "Erreur chargement dashboard");
      setData((res.data || null) as DashboardData | null);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const periodLabel = useMemo(() => {
    const fromIso = data?.period?.from;
    const toIso = data?.period?.to;
    if (!fromIso || !toIso) return "";
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
    return `${from.toLocaleDateString("fr-FR")} → ${to.toLocaleDateString("fr-FR")}`;
  }, [data?.period?.from, data?.period?.to]);

  const formatMoney = (v: unknown) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return String(v ?? "");
    return new Intl.NumberFormat("fr-FR").format(n);
  };

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

  const StatCard = ({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) => (
    <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
    </div>
  );

  const ChartCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );

  return (
    <>
      <PageMeta
        title="Dashboard | GreenPay Achats"
        description="Dashboard par profil (montant + created_at)"
      />

      <FullscreenLoader show={loading} label="Chargement du dashboard..." />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {periodLabel ? `Période (stats): ${periodLabel}` : "Période (stats): mois en cours"}
              {data?.role ? ` • Profil: ${data.role}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Mois</label>
              <div className="mt-1">
                <DatePicker
                  id="dashboard-month"
                  placeholder="YYYY-MM"
                  dateFormat="Y-m"
                  defaultDate={`${month}-01`}
                  onChange={(_, dateStr) => {
                    if (dateStr) setMonth(dateStr);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {/* GLOBAL (tous profils) */}
        {data?.global ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <StatCard title="Demandes (global)" value={String(data.global?.demandes?.count ?? 0)} subtitle="Nb demandes (période)" />
              <StatCard title="Montant (global)" value={`${formatMoney(data.global?.demandes?.montant)} FCFA`} subtitle="Total demandes (période)" />
              <StatCard title="Validations en attente" value={String(data.global?.validationsPending?.count ?? 0)} subtitle="Global (période)" />
              <StatCard title="Montant en attente" value={`${formatMoney(data.global?.validationsPending?.montant)} FCFA`} subtitle="Global (période)" />
            </div>

            {Array.isArray(data.global?.demandesByStatut) && data.global.demandesByStatut.length ? (
              <div className="overflow-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Nb</th>
                      <th className="px-4 py-3">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.global.demandesByStatut.map((r: ByStatutRow) => (
                      <tr key={String(r.statut)} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3">{String(r.statut)}</td>
                        <td className="px-4 py-3">{String(r.count ?? 0)}</td>
                        <td className="px-4 py-3">{formatMoney(r.montant)} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ADMIN breakdown */}
        {data?.role === "ADMIN" && Array.isArray(data?.admin?.demandesByProfil) ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Demandes par profil</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Répartition des demandes (période) par rôle du demandeur.</p>
            </div>

            <div className="overflow-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-3">Profil</th>
                    <th className="px-4 py-3">Nb demandes</th>
                    <th className="px-4 py-3">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {data.admin.demandesByProfil.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={3}>
                        Aucune donnée sur la période.
                      </td>
                    </tr>
                  ) : (
                    data.admin.demandesByProfil.map((r: ByProfilRow) => (
                      <tr key={String(r.role)} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3">{String(r.role)}</td>
                        <td className="px-4 py-3">{String(r.count ?? 0)}</td>
                        <td className="px-4 py-3">{formatMoney(r.montant)} FCFA</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* DEMANDEUR */}
        {data?.demandeur ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard title="Mes demandes (période)" value={String(data.demandeur?.total?.count ?? 0)} />
              <StatCard title="Montant total (période)" value={`${formatMoney(data.demandeur?.total?.montant)} FCFA`} />
              <StatCard title="Statuts" value={String((data.demandeur?.demandesByStatut || []).length)} subtitle="Nb statuts dans la période" />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartCard title="Répartition des statuts" subtitle="Nombre de demandes par statut">
                {(() => {
                  const rows = data.demandeur?.demandesByStatut || [];
                  const labels = rows.map((r: ByStatutRow) => String(r.statut));
                  const series = rows.map((r: ByStatutRow) => Number(r.count || 0));

                  const options: ApexOptions = {
                    chart: { type: "donut", fontFamily: "Outfit, sans-serif" },
                    labels,
                    colors: CHART_COLORS,
                    legend: {
                      position: "bottom",
                      labels: { colors: "var(--color-gray-500)" },
                    },
                    stroke: { width: 2, colors: ["transparent"] },
                    dataLabels: { enabled: true },
                    tooltip: {
                      y: { formatter: (val: number) => `${val} demande(s)` },
                    },
                    theme: { mode: isDark ? "dark" : "light" },
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
                    return <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée sur la période.</p>;
                  }

                  return <Chart options={options} series={series} type="donut" height={280} />;
                })()}
              </ChartCard>

              <ChartCard title="Montant total" subtitle="Montant par statut (FCFA)">
                {(() => {
                  const rows = data.demandeur?.demandesByStatut || [];
                  const categories = rows.map((r: ByStatutRow) => String(r.statut));
                  const seriesData = rows.map((r: ByStatutRow) => Number(r.montant || 0));

                  const options: ApexOptions = {
                    chart: { type: "bar", height: 280, fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
                    colors: ["var(--color-brand-500)"],
                    theme: { mode: isDark ? "dark" : "light" },
                    plotOptions: {
                      bar: { columnWidth: "45%", borderRadius: 8, distributed: false },
                    },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories,
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                      labels: { style: { colors: "var(--color-gray-500)" } },
                    },
                    yaxis: {
                      labels: {
                        formatter: (v: string | number) => formatMoney(Number(v)),
                        style: { colors: "var(--color-gray-500)" },
                      },
                    },
                    grid: { borderColor: "var(--color-gray-200)" },
                    tooltip: { y: { formatter: (v: number) => `${formatMoney(v)} FCFA` } },
                  };

                  if (!seriesData.some((x: number) => x > 0)) {
                    return <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée sur la période.</p>;
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

            <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Répartition par statut</h2>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-2">Statut</th>
                      <th className="py-2">#</th>
                      <th className="py-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.demandeur?.demandesByStatut || []).map((r: ByStatutRow) => (
                      <tr key={String(r.statut)} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-2">{r.statut}</td>
                        <td className="py-2">{r.count}</td>
                        <td className="py-2">{formatMoney(r.montant)} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {/* VALIDATEUR */}
        {data?.validator?.pending ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard title="Validations en attente" value={String(data.validator.pending.count ?? 0)} />
              <StatCard title="Montant en attente" value={`${formatMoney(data.validator.pending.montant)} FCFA`} />
              <StatCard
                title="Vieillissement"
                value={`${data.validator.pending.aging?.["0_2"] ?? 0} / ${data.validator.pending.aging?.["3_7"] ?? 0} / ${data.validator.pending.aging?.["8_plus"] ?? 0}`}
                subtitle="0-2j / 3-7j / 8j+"
              />
            </div>

            <ChartCard title="Vieillissement des demandes" subtitle="Nombre de demandes en attente par tranche">
              {(() => {
                const a = data.validator.pending.aging || {};
                const seriesData = [Number(a["0_2"] || 0), Number(a["3_7"] || 0), Number(a["8_plus"] || 0)];
                const options: ApexOptions = {
                  chart: { type: "bar", height: 260, fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
                  theme: { mode: isDark ? "dark" : "light" },
                  colors: [
                    "var(--color-success-500)",
                    "var(--color-warning-500)",
                    "var(--color-error-500)",
                  ],
                  plotOptions: {
                    bar: { distributed: true, borderRadius: 10, columnWidth: "45%" },
                  },
                  dataLabels: { enabled: true },
                  xaxis: {
                    categories: ["0-2j", "3-7j", "8j+"],
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { style: { colors: "var(--color-gray-500)" } },
                  },
                  yaxis: { labels: { style: { colors: "var(--color-gray-500)" } } },
                  grid: { borderColor: "var(--color-gray-200)" },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <p className="text-sm text-gray-500 dark:text-gray-400">Aucune validation en attente.</p>;
                }

                return <Chart options={options} series={[{ name: "Demandes", data: seriesData }]} type="bar" height={260} />;
              })()}
            </ChartCard>
          </div>
        ) : null}

        {/* COMPTA */}
        {data?.compta ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard title="Demandes payables" value={String(data.compta.payable?.count ?? 0)} />
              <StatCard title="Montant payable" value={`${formatMoney(data.compta.payable?.montant)} FCFA`} />
              <StatCard
                title="Exceptions"
                value={`${data.compta.exceptions?.payeSansReception ?? 0} / ${data.compta.exceptions?.receptionSansPaiement ?? 0}`}
                subtitle="payé sans réception / réception sans paiement"
              />
            </div>

            <ChartCard title="Paiements par moyen" subtitle="Montant total par moyen de paiement (période)">
              {(() => {
                const rows = data.compta?.paiementsByMoyen || [];
                const categories = rows.map((r: ByMoyenRow) => String(r.moyen_paiement || r.moyen));
                const seriesData = rows.map((r: ByMoyenRow) => Number(r.montant || 0));

                const options: ApexOptions = {
                  chart: { type: "bar", height: 280, fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
                  theme: { mode: isDark ? "dark" : "light" },
                  colors: ["var(--color-brand-500)"],
                  plotOptions: { bar: { borderRadius: 10, columnWidth: "45%" } },
                  dataLabels: { enabled: false },
                  xaxis: {
                    categories,
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { style: { colors: "var(--color-gray-500)" } },
                  },
                  yaxis: {
                    labels: {
                      formatter: (v: string | number) => formatMoney(Number(v)),
                      style: { colors: "var(--color-gray-500)" },
                    },
                  },
                  grid: { borderColor: "var(--color-gray-200)" },
                  tooltip: { y: { formatter: (v: number) => `${formatMoney(v)} FCFA` } },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <p className="text-sm text-gray-500 dark:text-gray-400">Aucun paiement sur la période.</p>;
                }

                return <Chart options={options} series={[{ name: "Montant", data: seriesData }]} type="bar" height={280} />;
              })()}
            </ChartCard>

            <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Paiements par moyen (période)</h2>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-2">Moyen</th>
                      <th className="py-2">#</th>
                      <th className="py-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.compta?.paiementsByMoyen || []).map((r: ByMoyenRow) => (
                      <tr key={String(r.moyen_paiement || r.moyen)} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-2">{String(r.moyen_paiement || r.moyen)}</td>
                        <td className="py-2">{String(r.count ?? 0)}</td>
                        <td className="py-2">{formatMoney(r.montant)} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {/* EXEC */}
        {data?.exec ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard title="Demandes créées (période)" value={String(data.exec.demandes?.count ?? 0)} />
              <StatCard title="Montant demandes (période)" value={`${formatMoney(data.exec.demandes?.montant)} FCFA`} />
              <StatCard title="Paiements (période)" value={`${formatMoney(data.exec.paiements?.montant)} FCFA`} subtitle={`# ${data.exec.paiements?.count ?? 0}`} />
            </div>

            <ChartCard title="Top bénéficiaires" subtitle="Top 10 par montant (période)">
              {(() => {
                const rows = data.exec?.topBeneficiaires || [];
                const categories = rows.map((r: TopBeneficiaireRow) => String(r.beneficiaire));
                const seriesData = rows.map((r: TopBeneficiaireRow) => Number(r.montant || 0));

                const options: ApexOptions = {
                  chart: { type: "bar", height: 340, fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
                  theme: { mode: isDark ? "dark" : "light" },
                  colors: ["var(--color-brand-500)"],
                  plotOptions: {
                    bar: {
                      horizontal: true,
                      borderRadius: 10,
                      barHeight: "70%",
                    },
                  },
                  dataLabels: { enabled: false },
                  xaxis: {
                    categories,
                    labels: {
                      formatter: (v: string | number) => formatMoney(Number(v)),
                      style: { colors: "var(--color-gray-500)" },
                    },
                  },
                  yaxis: {
                    labels: { style: { colors: "var(--color-gray-500)" } },
                  },
                  grid: { borderColor: "var(--color-gray-200)" },
                  tooltip: { y: { formatter: (v: number) => `${formatMoney(v)} FCFA` } },
                };

                if (!seriesData.some((x: number) => x > 0)) {
                  return <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée sur la période.</p>;
                }

                return <Chart options={options} series={[{ name: "Montant", data: seriesData }]} type="bar" height={340} />;
              })()}
            </ChartCard>

            <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Top bénéficiaires (période)</h2>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-2">Bénéficiaire</th>
                      <th className="py-2">#</th>
                      <th className="py-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.exec?.topBeneficiaires || []).map((r: TopBeneficiaireRow) => (
                      <tr key={String(r.beneficiaire)} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-2">{String(r.beneficiaire)}</td>
                        <td className="py-2">{String(r.count ?? 0)}</td>
                        <td className="py-2">{formatMoney(r.montant)} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import ExportButton from "../../components/common/ExportButton";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { emitToast } from "../../services/toastBus";
import { listAgents, setAgentManager } from "../../services/agents.admin.service";
import { exportRowsToExcel } from "../../utils/excelExport";

export default function HierarchyAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [managerId, setManagerId] = useState("");

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listAgents({ limit: 200 });
      if (!res?.success) throw new Error(res?.message || "Erreur chargement agents");
      setAgents(res?.items || res?.data?.items || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((a) => String(a.id) === String(agentId)) || null,
    [agents, agentId]
  );

  useEffect(() => {
    if (!selectedAgent) {
      setManagerId("");
      return;
    }
    setManagerId(selectedAgent?.agents?.id ? String(selectedAgent.agents.id) : "");
  }, [selectedAgent]);

  const exportColumns = [
    { header: "Agent", value: (a) => `${a?.nom || ""} ${a?.prenom || ""}`.trim() || "-" },
    { header: "Rôle", value: (a) => a?.roles?.name || "-" },
    { header: "Manager", value: (a) => (a?.agents ? `${a.agents.nom} ${a.agents.prenom}` : "-") },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows: agents,
      columns: exportColumns,
      filename: `hierarchie_${dateTag}.xlsx`,
      sheetName: "Hierarchie",
    });
  };

  const save = async () => {
    if (!agentId) return;
    setSaving(true);
    try {
      const res = await setAgentManager(agentId, { manager_id: managerId ? Number(managerId) : null });
      if (!res?.success) throw new Error(res?.message || "Erreur changement manager");
      emitToast({ variant: "success", message: "Hiérarchie mise à jour" });
      await fetchAgents();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Administration - Hiérarchie" description="Gestion des hiérarchies" />
      <FullscreenLoader show={loading || saving} label={saving ? "Enregistrement..." : "Chargement..."} />

      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Hiérarchie</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Définir le manager actuel d’un agent.</p>
        </div>

        <div className="flex justify-end">
                    <ExportButton
            onExport={handleExport}
            disabled={!agents.length}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60"
          />        </div>

        {error ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Choisir...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} {a.prenom} {a.roles?.name ? `(${a.roles.name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Manager</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={!agentId}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none disabled:opacity-50 dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Aucun</option>
                {agents
                  .filter((x) => String(x.id) !== String(agentId))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nom} {x.prenom} {x.roles?.name ? `(${x.roles.name})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={save}
                disabled={!agentId}
                className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Manager</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={3}>
                    Aucun agent.
                  </td>
                </tr>
              ) : (
                agents.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{a.nom} {a.prenom}</td>
                    <td className="px-4 py-3">{a.roles?.name || "-"}</td>
                    <td className="px-4 py-3">{a.agents ? `${a.agents.nom} ${a.agents.prenom}` : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}




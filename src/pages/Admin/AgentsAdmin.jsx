import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { Modal } from "../../components/ui/modal";
import { emitToast } from "../../services/toastBus";
import { listAgents, setAgentManager } from "../../services/agents.admin.service";

export default function AgentsAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [agents, setAgents] = useState([]);

  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [managerId, setManagerId] = useState("");

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listAgents({ limit: 100 });
      if (!res?.success) throw new Error(res?.message || "Erreur chargement agents");
      setAgents(res.items || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const openManager = (a) => {
    setSelected(a);
    setManagerId(a?.agents?.id ? String(a.agents.id) : "");
    setManagerModalOpen(true);
  };

  const saveManager = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const res = await setAgentManager(selected.id, { manager_id: managerId ? Number(managerId) : null });
      if (!res?.success) throw new Error(res?.message || "Erreur changement manager");
      emitToast({ variant: "success", message: "Manager mis à jour" });
      setManagerModalOpen(false);
      setSelected(null);
      await fetchAgents();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Administration - Agents" description="Gestion des agents" />
      <FullscreenLoader show={loading || saving} label={saving ? "Enregistrement..." : "Chargement..."} />

      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Agents</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestion des agents et manager actuel.</p>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="overflow-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={5}>
                    Aucun agent.
                  </td>
                </tr>
              ) : (
                agents.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{a.nom} {a.prenom}</td>
                    <td className="px-4 py-3">{a.users?.email || "-"}</td>
                    <td className="px-4 py-3">{a.roles?.name || "-"}</td>
                    <td className="px-4 py-3">{a.agents ? `${a.agents.nom} ${a.agents.prenom}` : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openManager(a)}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                      >
                        Changer manager
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={managerModalOpen}
        onClose={() => {
          if (saving) return;
          setManagerModalOpen(false);
          setSelected(null);
        }}
        title="Changer manager"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Agent: <b>{selected ? `${selected.nom} ${selected.prenom}` : ""}</b>
          </p>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Manager</label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Aucun</option>
              {agents
                .filter((x) => x.id !== selected?.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom} {x.prenom} {x.roles?.name ? `(${x.roles.name})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setManagerModalOpen(false);
                setSelected(null);
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={saveManager}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

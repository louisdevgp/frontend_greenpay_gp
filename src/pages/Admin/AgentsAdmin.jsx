import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { Modal } from "../../components/ui/modal";
import { emitToast } from "../../services/toastBus";
import { createAgent, listAgents, setAgentManager, softDeleteAgent, updateAgent } from "../../services/agents.admin.service";
import { listUsers } from "../../services/users.admin.service";
import { listRoles } from "../../services/roles.service";
import { listDirections } from "../../services/directions.service";
import { listDepartements } from "../../services/departements.service";
import { listServices } from "../../services/services.service";

export default function AgentsAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [agents, setAgents] = useState([]);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [directions, setDirections] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [services, setServices] = useState([]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState({
    user_id: "",
    nom: "",
    prenom: "",
    matricule: "",
    direction_id: "",
    departement_id: "",
    service_id: "",
    role_id: "",
  });

  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [managerId, setManagerId] = useState("");

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, uRes, rRes, dirRes, depRes, srvRes] = await Promise.all([
        listAgents({ limit: 200 }),
        listUsers({ limit: 200 }),
        listRoles(),
        listDirections(),
        listDepartements(),
        listServices(),
      ]);

      if (!aRes?.success) throw new Error(aRes?.message || "Erreur chargement agents");
      if (!uRes?.success) throw new Error(uRes?.message || "Erreur chargement users");
      if (!rRes?.success) throw new Error(rRes?.message || "Erreur chargement rôles");
      if (!dirRes?.success) throw new Error(dirRes?.message || "Erreur chargement directions");
      if (!depRes?.success) throw new Error(depRes?.message || "Erreur chargement départements");
      if (!srvRes?.success) throw new Error(srvRes?.message || "Erreur chargement services");

      setAgents(aRes.items || []);
      setUsers(uRes?.data?.items || uRes?.items || []);
      setRoles(rRes.data || rRes.items || []);
      setDirections(dirRes.data || dirRes.items || []);
      setDepartements(depRes.data || depRes.items || []);
      setServices(srvRes.data || srvRes.items || []);
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

  const openCreate = () => {
    setEditingAgent(null);
    setForm({
      user_id: "",
      nom: "",
      prenom: "",
      matricule: "",
      direction_id: "",
      departement_id: "",
      service_id: "",
      role_id: "",
    });
    setEditModalOpen(true);
  };

  const openEdit = (a) => {
    setEditingAgent(a);
    setForm({
      user_id: a?.users?.id ? String(a.users.id) : "",
      nom: a?.nom || "",
      prenom: a?.prenom || "",
      matricule: a?.matricule || "",
      direction_id: a?.direction_id ? String(a.direction_id) : "",
      departement_id: a?.departement_id ? String(a.departement_id) : "",
      service_id: a?.service_id ? String(a.service_id) : "",
      role_id: a?.role_id ? String(a.role_id) : "",
    });
    setEditModalOpen(true);
  };

  const saveAgent = async () => {
    const payload = {
      user_id: form.user_id ? Number(form.user_id) : null,
      nom: String(form.nom || "").trim(),
      prenom: String(form.prenom || "").trim(),
      matricule: String(form.matricule || "").trim() || null,
      direction_id: form.direction_id ? Number(form.direction_id) : null,
      departement_id: form.departement_id ? Number(form.departement_id) : null,
      service_id: form.service_id ? Number(form.service_id) : null,
      role_id: form.role_id ? Number(form.role_id) : null,
    };

    if (!payload.user_id) return emitToast({ variant: "error", message: "Utilisateur obligatoire" });
    if (!payload.nom) return emitToast({ variant: "error", message: "Nom obligatoire" });
    if (!payload.prenom) return emitToast({ variant: "error", message: "Prénom obligatoire" });

    setSaving(true);
    try {
      if (editingAgent?.id) {
        const res = await updateAgent(editingAgent.id, payload);
        if (!res?.success) throw new Error(res?.message || "Erreur update agent");
        emitToast({ variant: "success", message: "Agent mis à jour" });
      } else {
        const res = await createAgent(payload);
        if (!res?.success) throw new Error(res?.message || "Erreur création agent");
        emitToast({ variant: "success", message: "Agent créé" });
      }
      setEditModalOpen(false);
      setEditingAgent(null);
      await fetchAgents();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const removeAgent = async (a) => {
    if (!a?.id) return;
    setSaving(true);
    try {
      const res = await softDeleteAgent(a.id);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression agent");
      emitToast({ variant: "success", message: "Agent supprimé" });
      await fetchAgents();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
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

        <div className="flex items-center justify-end">
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
          >
            Nouveau
          </button>
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
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(a)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => openManager(a)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                        >
                          Manager
                        </button>
                        <button
                          onClick={() => removeAgent(a)}
                          className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg dark:border-red-900/40 dark:text-red-300"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          if (saving) return;
          setEditModalOpen(false);
          setEditingAgent(null);
        }}
        title={editingAgent ? "Modifier agent" : "Créer agent"}
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
          <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Utilisateur (email)</label>
            <select
              value={form.user_id}
              onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
              disabled={!!editingAgent}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none disabled:opacity-50 dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Choisir...</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Nom</label>
              <input
                value={form.nom}
                onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Prénom</label>
              <input
                value={form.prenom}
                onChange={(e) => setForm((p) => ({ ...p, prenom: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Matricule</label>
            <input
              value={form.matricule}
              onChange={(e) => setForm((p) => ({ ...p, matricule: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Direction</label>
              <select
                value={form.direction_id}
                onChange={(e) => setForm((p) => ({ ...p, direction_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">-</option>
                {directions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Département</label>
              <select
                value={form.departement_id}
                onChange={(e) => setForm((p) => ({ ...p, departement_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">-</option>
                {departements.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.nom} {d.directions?.nom ? `(${d.directions.nom})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Service</label>
              <select
                value={form.service_id}
                onChange={(e) => setForm((p) => ({ ...p, service_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">-</option>
                {services.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Rôle (agent)</label>
              <select
                value={form.role_id}
                onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">-</option>
                {roles.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEditModalOpen(false);
                setEditingAgent(null);
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={saveAgent}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
            </button>
          </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={managerModalOpen}
        onClose={() => {
          if (saving) return;
          setManagerModalOpen(false);
          setSelected(null);
        }}
        title="Changer manager"
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
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
        </div>
      </Modal>
    </>
  );
}

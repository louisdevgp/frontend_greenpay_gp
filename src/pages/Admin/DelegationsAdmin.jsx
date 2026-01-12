import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { Modal } from "../../components/ui/modal";
import DatePicker from "../../components/form/date-picker";
import { emitToast } from "../../services/toastBus";
import { useAuth } from "../../context/AuthContext";
import {
  createDelegation,
  deleteDelegation,
  listDelegationAgents,
  listDelegations,
  toggleDelegation,
  updateDelegation,
} from "../../services/delegations.admin.service";

export default function DelegationsAdmin() {
  const { user, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["ADMIN"]);
  const myAgentId = user?.agent?.id ? String(user.agent.id) : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [agents, setAgents] = useState([]);
  const [rows, setRows] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    principal_id: "",
    delegate_id: "",
    role_name: "",
    scope: "",
    start_at: "",
    end_at: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ start_at: "", end_at: "" });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, dRes] = await Promise.all([
        listDelegationAgents({ limit: 200 }),
        listDelegations({})
      ]);
      if (!aRes?.success) throw new Error(aRes?.message || "Erreur chargement agents");
      if (!dRes?.success) throw new Error(dRes?.message || "Erreur chargement délégations");

      setAgents(aRes.data || aRes.items || []);
      setRows(dRes.data || dRes.items || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Côté user (non-admin): le principal est toujours soi
  useEffect(() => {
    if (isAdmin) return;
    if (!myAgentId) return;
    setForm((p) => ({ ...p, principal_id: p.principal_id || myAgentId }));
  }, [isAdmin, myAgentId]);

  const principalRoleName = useMemo(() => {
    const a = (agents || []).find((x) => String(x.id) === String(form.principal_id));
    return (a?.roles?.name || "").toString();
  }, [agents, form.principal_id]);

  const principalAgent = useMemo(() => {
    return (agents || []).find((x) => String(x.id) === String(form.principal_id)) || null;
  }, [agents, form.principal_id]);

  const scopeOptions = useMemo(() => {
    const opts = [{ value: "", label: "Auto (recommandé)" }, { value: "GLOBAL", label: "Global" }];
    const dir = principalAgent?.direction_id;
    const dep = principalAgent?.departement_id;
    const svc = principalAgent?.service_id;
    if (dir) opts.push({ value: `DIRECTION:${dir}`, label: "Direction" });
    if (dep) opts.push({ value: `DEPARTEMENT:${dep}`, label: "Département" });
    if (svc) opts.push({ value: `SERVICE:${svc}`, label: "Service" });
    return opts;
  }, [principalAgent]);

  useEffect(() => {
    if (!form.principal_id) {
      setForm((p) => ({ ...p, role_name: "", scope: "" }));
      return;
    }

    const role = principalRoleName ? String(principalRoleName).toUpperCase() : "";

    // ADMIN is explicitly forbidden to delegate
    if (role === "ADMIN") {
      setForm((p) => ({ ...p, role_name: "" }));
      return;
    }

    setForm((p) => ({ ...p, role_name: role }));
  }, [form.principal_id, principalRoleName]);

  const agentLabel = useMemo(() => {
    const map = new Map();
    (agents || []).forEach((a) => {
      map.set(a.id, `${a.nom} ${a.prenom}`);
    });
    return map;
  }, [agents]);

  const save = async () => {
    if (!form.principal_id || !form.delegate_id || !form.role_name || !form.end_at) {
      emitToast({ variant: "error", message: "Principal, délégué, rôle et fin sont obligatoires" });
      return;
    }

    setSaving(true);
    try {
      const startIso = form.start_at ? new Date(form.start_at).toISOString() : new Date().toISOString();
      const endIso = new Date(form.end_at).toISOString();

      const payload = {
        principalIdOrUuid: String(form.principal_id),
        delegateIdOrUuid: String(form.delegate_id),
        role_name: String(form.role_name),
        ...(form.scope ? { scope: String(form.scope) } : {}),
        start_at: startIso,
        end_at: endIso,
      };

      const res = await createDelegation(payload);
      if (!res?.success) throw new Error(res?.message || "Erreur création délégation");

      emitToast({ variant: "success", message: "Délégation créée" });
      setCreateOpen(false);
      setForm({ principal_id: isAdmin ? "" : myAgentId || "", delegate_id: "", role_name: "", scope: "", start_at: "", end_at: "" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (idOrUuid) => {
    setSaving(true);
    try {
      const res = await toggleDelegation(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur toggle");
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    const start = row?.start_at ? new Date(row.start_at) : null;
    const end = row?.end_at ? new Date(row.end_at) : null;
    const toLocalInput = (d) => {
      if (!d || Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditForm({ start_at: toLocalInput(start), end_at: toLocalInput(end) });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!editForm.end_at) {
      emitToast({ variant: "error", message: "Fin obligatoire" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        start_at: editForm.start_at ? new Date(editForm.start_at).toISOString() : undefined,
        end_at: new Date(editForm.end_at).toISOString(),
      };

      const res = await updateDelegation(editRow.uuid || editRow.id, payload);
      if (!res?.success) throw new Error(res?.message || "Erreur modification");
      emitToast({ variant: "success", message: "Période modifiée" });
      setEditOpen(false);
      setEditRow(null);
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const askRemove = (row) => {
    setConfirmRow(row);
    setConfirmOpen(true);
  };

  const confirmRemove = async () => {
    if (!confirmRow) return;
    setSaving(true);
    try {
      const idOrUuid = confirmRow.uuid || confirmRow.id;
      const res = await deleteDelegation(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression");
      setConfirmOpen(false);
      setConfirmRow(null);
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Administration - Délégations" description="Gestion des délégations" />
      <FullscreenLoader show={loading || saving} label={saving ? "Enregistrement..." : "Chargement..."} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Délégations</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Définir qui valide à la place de qui.</p>
          </div>
          <button
            onClick={() => {
              if (!isAdmin && myAgentId) {
                setForm((p) => ({ ...p, principal_id: myAgentId }));
              }
              setCreateOpen(true);
            }}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
          >
            Nouvelle délégation
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
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Délégué</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Portée</th>
                <th className="px-4 py-3">Actif</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={6}>
                    Aucune délégation.
                  </td>
                </tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id || d.uuid} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{agentLabel.get(d.principal_id) || d.principal_id}</td>
                    <td className="px-4 py-3">{agentLabel.get(d.delegate_id) || d.delegate_id}</td>
                    <td className="px-4 py-3">{d.role_name}</td>
                    <td className="px-4 py-3">{d.scope || "GLOBAL"}</td>
                    <td className="px-4 py-3">{d.is_active ? "Oui" : "Non"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(d)}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                      >
                        Modifier période
                      </button>
                      <button
                        onClick={() => toggle(d.uuid || d.id)}
                        className="ml-2 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                      >
                        Activer/Désactiver
                      </button>
                      <button
                        onClick={() => askRemove(d)}
                        className="ml-2 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                      >
                        Supprimer
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
        isOpen={createOpen}
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
        }}
        showCloseButton={false}
        className="w-full max-w-xl rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nouvelle délégation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Définir qui valide à la place de qui.</p>
          </div>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            disabled={saving}
            onClick={() => setCreateOpen(false)}
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {form.principal_id && String(principalRoleName).toUpperCase() === "ADMIN" ? (
            <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
              Le rôle ADMIN ne peut pas être délégué.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Principal</label>
              <select
                value={form.principal_id}
                onChange={(e) => setForm((p) => ({ ...p, principal_id: e.target.value }))}
                disabled={!isAdmin}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Choisir...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} {a.prenom} {a.roles?.name ? `(${a.roles.name})` : ""}
                  </option>
                ))}
              </select>
              {!isAdmin ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  En mode utilisateur, le principal est votre profil.
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Délégué</label>
              <select
                value={form.delegate_id}
                onChange={(e) => setForm((p) => ({ ...p, delegate_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Choisir...</option>
                {agents
                  .filter((a) => String(a.id) !== String(form.principal_id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom} {a.prenom} {a.roles?.name ? `(${a.roles.name})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Rôle</label>
              <select
                value={form.role_name}
                disabled
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Sélectionnez un principal</option>
                {form.role_name ? <option value={form.role_name}>{form.role_name}</option> : null}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Portée</label>
              <select
                value={form.scope}
                onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
                disabled={!form.principal_id}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                {scopeOptions.map((o) => (
                  <option key={o.value || "__auto"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Début</label>
              <DatePicker
                id="delegations-create-start"
                placeholder="YYYY-MM-DDTHH:mm"
                dateFormat="Y-m-d\\TH:i"
                defaultDate={form.start_at || undefined}
                options={{ enableTime: true, time_24hr: true }}
                onChange={(_, dateStr) => setForm((p) => ({ ...p, start_at: dateStr }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Fin</label>
              <DatePicker
                id="delegations-create-end"
                placeholder="YYYY-MM-DDTHH:mm"
                dateFormat="Y-m-d\\TH:i"
                defaultDate={form.end_at || undefined}
                options={{ enableTime: true, time_24hr: true }}
                onChange={(_, dateStr) => setForm((p) => ({ ...p, end_at: dateStr }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving || !form.principal_id || !form.delegate_id || !form.role_name || !form.end_at}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? <Loader inline size="sm" label="Traitement..." /> : "Créer"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={() => {
          if (saving) return;
          setEditOpen(false);
          setEditRow(null);
        }}
        showCloseButton={false}
        className="w-full max-w-xl rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Modifier la période</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ajuster les dates de validité de la délégation.</p>
          </div>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            disabled={saving}
            onClick={() => {
              setEditOpen(false);
              setEditRow(null);
            }}
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Début</label>
              <DatePicker
                id="delegations-edit-start"
                placeholder="YYYY-MM-DDTHH:mm"
                dateFormat="Y-m-d\\TH:i"
                defaultDate={editForm.start_at || undefined}
                options={{ enableTime: true, time_24hr: true }}
                onChange={(_, dateStr) => setEditForm((p) => ({ ...p, start_at: dateStr }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Fin *</label>
              <DatePicker
                id="delegations-edit-end"
                placeholder="YYYY-MM-DDTHH:mm"
                dateFormat="Y-m-d\\TH:i"
                defaultDate={editForm.end_at || undefined}
                options={{ enableTime: true, time_24hr: true }}
                onChange={(_, dateStr) => setEditForm((p) => ({ ...p, end_at: dateStr }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEditOpen(false);
                setEditRow(null);
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
          setConfirmRow(null);
        }}
        showCloseButton={false}
        className="w-full max-w-md rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Confirmer la suppression</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cette action est définitive.</p>
          </div>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            onClick={() => {
              setConfirmOpen(false);
              setConfirmRow(null);
            }}
            disabled={saving}
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-700 dark:text-gray-200">
          Supprimer la délégation de <span className="font-medium">{agentLabel.get(confirmRow?.principal_id) || confirmRow?.principal_id}</span>
          {" "}→{" "}
          <span className="font-medium">{agentLabel.get(confirmRow?.delegate_id) || confirmRow?.delegate_id}</span>
          {confirmRow?.role_name ? ` (${confirmRow.role_name})` : ""} ?
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={() => {
              setConfirmOpen(false);
              setConfirmRow(null);
            }}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
          >
            Annuler
          </button>
          <button
            onClick={confirmRemove}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-600 hover:bg-red-700"
          >
            {saving ? <Loader inline size="sm" label="Traitement..." /> : "Supprimer"}
          </button>
        </div>
      </Modal>
    </>
  );
}

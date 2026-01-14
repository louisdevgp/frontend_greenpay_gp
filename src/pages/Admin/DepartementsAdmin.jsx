import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { Modal } from "../../components/ui/modal";
import { emitToast } from "../../services/toastBus";
import { listDirections } from "../../services/directions.service";
import { createDepartement, deleteDepartement, listDepartements, updateDepartement } from "../../services/departements.service";

export default function DepartementsAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [directions, setDirections] = useState([]);
  const [rows, setRows] = useState([]);

  const [directionFilter, setDirectionFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nom: "", code: "", directionIdOrUuid: "" });

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [dRes, depRes] = await Promise.all([
        listDirections(),
        listDepartements({ directionIdOrUuid: directionFilter || undefined }),
      ]);
      if (!dRes?.success) throw new Error(dRes?.message || "Erreur chargement directions");
      if (!depRes?.success) throw new Error(depRes?.message || "Erreur chargement départements");
      setDirections(dRes.data || []);
      setRows(depRes.data || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionFilter]);

  const directionOptions = useMemo(() => directions || [], [directions]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: "", code: "", directionIdOrUuid: directionFilter || "" });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      nom: row?.nom || "",
      code: row?.code || "",
      directionIdOrUuid: row?.direction_id ? String(row.direction_id) : "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    const nom = String(form.nom || "").trim();
    const code = String(form.code || "").trim();
    const directionIdOrUuid = String(form.directionIdOrUuid || "").trim();
    if (!nom) return emitToast({ variant: "error", message: "Nom obligatoire" });
    if (!directionIdOrUuid) return emitToast({ variant: "error", message: "Direction obligatoire" });

    setSaving(true);
    try {
      if (editing?.id || editing?.uuid) {
        const idOrUuid = editing.uuid || editing.id;
        const res = await updateDepartement(idOrUuid, { nom, code: code || null, directionIdOrUuid });
        if (!res?.success) throw new Error(res?.message || "Erreur update département");
        emitToast({ variant: "success", message: "Département mis à jour" });
      } else {
        const res = await createDepartement({ nom, code: code || null, directionIdOrUuid });
        if (!res?.success) throw new Error(res?.message || "Erreur création département");
        emitToast({ variant: "success", message: "Département créé" });
      }
      setModalOpen(false);
      setEditing(null);
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!row?.id && !row?.uuid) return;
    setSaving(true);
    try {
      const idOrUuid = row.uuid || row.id;
      const res = await deleteDepartement(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression département");
      emitToast({ variant: "success", message: "Département supprimé" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Administration - Départements" description="Gestion des départements" />
      <FullscreenLoader show={loading || saving} label={saving ? "Traitement..." : "Chargement..."} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Départements</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Créer, modifier, supprimer des départements.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Direction</label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Toutes</option>
                {directionOptions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={openCreate}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              Nouveau
            </button>
          </div>
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
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={4}>
                    Aucun département.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{r.nom}</td>
                    <td className="px-4 py-3">{r.code || "-"}</td>
                    <td className="px-4 py-3">{r.directions?.nom || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => remove(r)}
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
        isOpen={modalOpen}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? "Modifier département" : "Nouveau département"}
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
          <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Nom</label>
            <input
              value={form.nom}
              onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Direction</label>
            <select
              value={form.directionIdOrUuid}
              onChange={(e) => setForm((p) => ({ ...p, directionIdOrUuid: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Choisir...</option>
              {directionOptions.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={save}
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

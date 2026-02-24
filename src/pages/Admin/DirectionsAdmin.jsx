import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import ExportButton from "../../components/common/ExportButton";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { Modal } from "../../components/ui/modal";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";
import { emitToast } from "../../services/toastBus";
import { createDirection, deleteDirection, listDirections, updateDirection } from "../../services/directions.service";
import { exportRowsToExcel } from "../../utils/excelExport";

export default function DirectionsAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nom: "", code: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listDirections();
      if (!res?.success) throw new Error(res?.message || "Erreur chargement directions");
      setRows(res.data || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };
  const exportColumns = [
    { header: "Nom", value: (r) => r?.nom || "-" },
    { header: "Code", value: (r) => r?.code || "-" },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows,
      columns: exportColumns,
      filename: `directions_${dateTag}.xlsx`,
      sheetName: "Directions",
    });
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: "", code: "" });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ nom: row?.nom || "", code: row?.code || "" });
    setModalOpen(true);
  };

  const save = async () => {
    const nom = String(form.nom || "").trim();
    const code = String(form.code || "").trim();
    if (!nom) {
      emitToast({ variant: "error", message: "Nom obligatoire" });
      return;
    }
    setSaving(true);
    try {
      if (editing?.id || editing?.uuid) {
        const idOrUuid = editing.uuid || editing.id;
        const res = await updateDirection(idOrUuid, { nom, code: code || null });
        if (!res?.success) throw new Error(res?.message || "Erreur update direction");
        emitToast({ variant: "success", message: "Direction mise à jour" });
      } else {
        const res = await createDirection({ nom, code: code || null });
        if (!res?.success) throw new Error(res?.message || "Erreur création direction");
        emitToast({ variant: "success", message: "Direction créée" });
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

  const requestDelete = (row) => {
    setDeleteTarget(row || null);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id && !deleteTarget?.uuid) return;
    setSaving(true);
    try {
      const idOrUuid = deleteTarget.uuid || deleteTarget.id;
      const res = await deleteDirection(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression direction");
      emitToast({ variant: "success", message: "Direction supprimée" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <PageMeta title="Administration - Directions" description="Gestion des directions" />
      <FullscreenLoader show={loading || saving} label={saving ? "Traitement..." : "Chargement..."} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Directions</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Créer, modifier, supprimer des directions.</p>
          </div>
          <div className="flex items-center gap-2">
                        <ExportButton
              onExport={handleExport}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60"
            />            <button
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={3}>
                    Aucune direction.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{r.nom}</td>
                    <td className="px-4 py-3">{r.code || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => requestDelete(r)}
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
        title={editing ? "Modifier direction" : "Nouvelle direction"}
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

      <ConfirmActionModal
        open={deleteOpen}
        title="Supprimer la direction"
        message={deleteTarget?.nom ? `Confirmer la suppression de la direction "${deleteTarget.nom}" ?` : "Confirmer la suppression de la direction ?"}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        loading={saving}
        onClose={() => {
          if (saving) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}


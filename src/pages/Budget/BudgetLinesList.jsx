import { useEffect, useMemo, useState } from "react";
import { FiCopy, FiEdit2, FiPlus, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import PageMeta from "../../components/common/PageMeta";
import ExportButton from "../../components/common/ExportButton";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";
import Pagination from "../../components/common/Pagination";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { emitToast } from "../../services/toastBus";
import { listDirections } from "../../services/directions.service";
import { listDepartements } from "../../services/departements.service";
import { listServices } from "../../services/services.service";
import {
  createBudgetLine,
  deleteBudgetLine,
  listBudgetLines,
  renewBudgetLine,
  updateBudgetLine,
} from "../../services/budgetLines.service";
import { exportRowsToExcel } from "../../utils/excelExport";
import { formatDateTime, formatMoney } from "../../utils/formatUtils";
import { BUDGET_MONTHS, budgetLineSolde, budgetMonthLabel, budgetPeriodLabel } from "../../utils/budgetLines";
import { clearPersistedState, loadPersistedState, savePersistedState } from "../../utils/persistedFilters";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const EXERCICE_OPTIONS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR + 2 - index);
const STORAGE_KEY = "filters:budget:lignes";
const INITIAL_FILTERS = { q: "", exercice: String(CURRENT_YEAR), mois: "", statut: "" };
const INITIAL_PAGE_SIZE = 10;

function initialForm() {
  return {
    code: "",
    libelle: "",
    description: "",
    exercice: String(CURRENT_YEAR),
    mois: String(CURRENT_MONTH),
    devise: "FCFA",
    montant_initial: "",
    controle_mode: "SOUPLE",
    statut: "active",
    scope_type: "GLOBAL",
    scope_id: "",
  };
}

export default function BudgetLinesList() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("BUDGET_LINE_CREATE");
  const canUpdate = hasPermission("BUDGET_LINE_UPDATE");
  const canDelete = hasPermission("BUDGET_LINE_DELETE");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY, { filters: INITIAL_FILTERS });
    return { ...INITIAL_FILTERS, ...(saved?.filters || {}) };
  });
  const [page, setPage] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY, { page: 1 });
    return Math.max(1, Number(saved?.page || 1));
  });
  const [pageSize, setPageSize] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY, { pageSize: INITIAL_PAGE_SIZE });
    return Math.max(1, Number(saved?.pageSize || INITIAL_PAGE_SIZE));
  });
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [scopeOptions, setScopeOptions] = useState({ directions: [], departements: [], services: [] });
  const [scopeLoading, setScopeLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState(null);

  const buildFilterParams = () => {
    const params = {};
    if (filters.q) params.q = filters.q;
    if (filters.exercice) params.exercice = filters.exercice;
    if (filters.mois) params.mois = filters.mois;
    if (filters.statut) params.statut = filters.statut;
    return params;
  };

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { ...buildFilterParams(), page, limit: pageSize };
      const res = await listBudgetLines(params);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement lignes budgetaires");
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list);
      setTotal(Number(res.total ?? list.length));
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e?.message || "Erreur chargement lignes budgetaires");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [filters, page, pageSize]);

  useEffect(() => {
    let active = true;
    const loadScopes = async () => {
      setScopeLoading(true);
      try {
        const [dirRes, depRes, srvRes] = await Promise.allSettled([
          listDirections(),
          listDepartements(),
          listServices(),
        ]);
        if (!active) return;
        setScopeOptions({
          directions:
            dirRes.status === "fulfilled" && dirRes.value?.success && Array.isArray(dirRes.value.data)
              ? dirRes.value.data
              : [],
          departements:
            depRes.status === "fulfilled" && depRes.value?.success && Array.isArray(depRes.value.data)
              ? depRes.value.data
              : [],
          services:
            srvRes.status === "fulfilled" && srvRes.value?.success && Array.isArray(srvRes.value.data)
              ? srvRes.value.data
              : [],
        });
      } finally {
        if (active) setScopeLoading(false);
      }
    };
    loadScopes();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.initial += Number(row?.montant_initial || 0);
        acc.engage += Number(row?.montant_engage || 0);
        acc.paye += Number(row?.montant_paye || 0);
        acc.solde += budgetLineSolde(row);
        return acc;
      },
      { initial: 0, engage: 0, paye: 0, solde: 0 }
    );
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm());
    setModalOpen(true);
  };

  const updateFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setPage(1);
    savePersistedState(STORAGE_KEY, { filters: nextFilters, page: 1, pageSize });
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
    savePersistedState(STORAGE_KEY, { filters: INITIAL_FILTERS, page: 1, pageSize });
  };

  const clearSavedFilters = () => {
    clearPersistedState(STORAGE_KEY);
    setFilters(INITIAL_FILTERS);
    setPage(1);
    setPageSize(INITIAL_PAGE_SIZE);
  };

  const updatePagination = (nextPage, nextPageSize) => {
    const safePage = Math.max(1, Number(nextPage || 1));
    const safePageSize = Math.max(1, Number(nextPageSize || INITIAL_PAGE_SIZE));
    setPage(safePage);
    setPageSize(safePageSize);
    savePersistedState(STORAGE_KEY, { filters, page: safePage, pageSize: safePageSize });
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      code: row?.code || "",
      libelle: row?.libelle || "",
      description: row?.description || "",
      exercice: String(row?.exercice || CURRENT_YEAR),
      mois: String(row?.mois || CURRENT_MONTH),
      devise: row?.devise || "FCFA",
      montant_initial: row?.montant_initial != null ? String(row.montant_initial) : "",
      controle_mode: row?.controle_mode || "SOUPLE",
      statut: row?.statut || "active",
      scope_type: row?.scope_type || "GLOBAL",
      scope_id: row?.scope_id != null ? String(row.scope_id) : "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(initialForm());
  };

  const save = async () => {
    const libelle = String(form.libelle || "").trim();
    const montantInitial = Number(form.montant_initial);
    if (!libelle) {
      emitToast({ variant: "error", message: "Libelle obligatoire" });
      return;
    }
    if (!Number.isFinite(montantInitial) || montantInitial < 0) {
      emitToast({ variant: "error", message: "Montant initial invalide" });
      return;
    }
    if (form.scope_type !== "GLOBAL" && !form.scope_id) {
      emitToast({ variant: "error", message: "Selectionnez le perimetre associe" });
      return;
    }

    const payload = {
      code: String(form.code || "").trim() || undefined,
      libelle,
      description: String(form.description || "").trim() || null,
      exercice: Number(form.exercice || CURRENT_YEAR),
      mois: Number(form.mois || CURRENT_MONTH),
      devise: String(form.devise || "FCFA").trim().toUpperCase(),
      montant_initial: montantInitial,
      controle_mode: form.controle_mode,
      statut: form.statut,
      scope_type: form.scope_type || "GLOBAL",
      scope_id: form.scope_id ? Number(form.scope_id) : null,
    };

    setSaving(true);
    try {
      if (editing?.id || editing?.uuid) {
        const res = await updateBudgetLine(editing.uuid || editing.id, payload);
        if (!res?.success) throw new Error(res?.message || "Erreur mise a jour ligne budgetaire");
        emitToast({ variant: "success", message: "Ligne budgetaire mise a jour" });
      } else {
        const res = await createBudgetLine(payload);
        if (!res?.success) throw new Error(res?.message || "Erreur creation ligne budgetaire");
        emitToast({ variant: "success", message: "Ligne budgetaire creee" });
      }
      setModalOpen(false);
      setEditing(null);
      setForm(initialForm());
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
      const res = await deleteBudgetLine(deleteTarget.uuid || deleteTarget.id);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression ligne budgetaire");
      emitToast({ variant: "success", message: "Ligne budgetaire supprimee" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const requestRenew = (row) => {
    setRenewTarget(row || null);
    setRenewOpen(true);
  };

  const confirmRenew = async () => {
    if (!renewTarget?.id && !renewTarget?.uuid) return;
    setSaving(true);
    try {
      const res = await renewBudgetLine(renewTarget.uuid || renewTarget.id);
      if (!res?.success) throw new Error(res?.message || "Erreur reconduction ligne budgetaire");
      emitToast({ variant: "success", message: "Ligne budgetaire reconduite" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur reconduction ligne budgetaire" });
    } finally {
      setSaving(false);
      setRenewOpen(false);
      setRenewTarget(null);
    }
  };

  const handleExport = async () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    const res = await listBudgetLines(buildFilterParams());
    if (!res?.success) throw new Error(res?.message || "Erreur export lignes budgetaires");
    const exportRows = Array.isArray(res.data) ? res.data : [];
    exportRowsToExcel({
      rows: exportRows,
      filename: `lignes_budgetaires_${dateTag}.xlsx`,
      sheetName: "Budget",
      columns: [
        { header: "Code", value: (r) => r?.code || "-" },
        { header: "Libelle", value: (r) => r?.libelle || "-" },
        { header: "Exercice", value: (r) => r?.exercice || "-" },
        { header: "Mois", value: (r) => budgetMonthLabel(r?.mois || 1) },
        { header: "Montant initial", value: (r) => Number(r?.montant_initial || 0) },
        { header: "Engage", value: (r) => Number(r?.montant_engage || 0) },
        { header: "Paye", value: (r) => Number(r?.montant_paye || 0) },
        { header: "Solde", value: (r) => budgetLineSolde(r) },
        { header: "Mode controle", value: (r) => r?.controle_mode || "-" },
        { header: "Statut", value: (r) => r?.statut || "-" },
      ],
    });
  };

  return (
    <>
      <PageMeta title="Budget - Lignes budgetaires" description="Gestion des lignes budgetaires" />
      <FullscreenLoader show={loading || saving} label={saving ? "Traitement..." : "Chargement..."} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Lignes budgetaires</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Referentiel global utilise lors de la validation DAF et du paiement.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              onExport={handleExport}
              disabled={!total}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={fetchAll}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
              title="Rafraichir"
              aria-label="Rafraichir"
            >
              <FiRefreshCw />
            </button>
            {canCreate ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
              >
                <FiPlus />
                Nouveau
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Metric label="Budget initial" value={`${formatMoney(totals.initial)} FCFA`} />
          <Metric label="Engage" value={`${formatMoney(totals.engage)} FCFA`} />
          <Metric label="Paye" value={`${formatMoney(totals.paye)} FCFA`} />
          <Metric label="Solde" value={`${formatMoney(totals.solde)} FCFA`} tone={totals.solde < 0 ? "danger" : "default"} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
              placeholder="Recherche code ou libelle"
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
            <select
              value={filters.exercice}
              onChange={(e) => updateFilter("exercice", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous exercices</option>
              {buildExerciceOptions(filters.exercice).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={filters.mois}
              onChange={(e) => updateFilter("mois", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous mois</option>
              {BUDGET_MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <select
              value={filters.statut}
              onChange={(e) => updateFilter("statut", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous statuts</option>
              <option value="active">Active</option>
              <option value="suspendue">Suspendue</option>
              <option value="cloturee">Cloturee</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            >
              Reinitialiser
            </button>
            <button
              type="button"
              onClick={clearSavedFilters}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            >
              Effacer filtres
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="overflow-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Ligne</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3 text-right">Initial</th>
                <th className="px-4 py-3 text-right">Engage</th>
                <th className="px-4 py-3 text-right">Paye</th>
                <th className="px-4 py-3 text-right">Solde</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">MAJ</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={10}>
                    Aucune ligne budgetaire.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const solde = budgetLineSolde(row);
                  return (
                    <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white/90">{row.code}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{row.libelle}</div>
                      </td>
                      <td className="px-4 py-3">{budgetPeriodLabel(row)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(row.montant_initial)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(row.montant_engage)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(row.montant_paye)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${solde < 0 ? "text-red-600 dark:text-red-300" : ""}`}>
                        {formatMoney(solde)}
                      </td>
                      <td className="px-4 py-3">{row.controle_mode || "SOUPLE"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs ${statusClass(row.statut)}`}>
                          {statusLabel(row.statut)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDateTime(row.updated_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canCreate ? (
                            <button
                              type="button"
                              onClick={() => requestRenew(row)}
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                              title="Reconduire au mois suivant"
                              aria-label="Reconduire au mois suivant"
                            >
                              <FiCopy />
                            </button>
                          ) : null}
                          {canUpdate ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                              title="Modifier"
                              aria-label="Modifier"
                            >
                              <FiEdit2 />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => requestDelete(row)}
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-red-200 text-red-600 dark:border-red-900/40 dark:text-red-300"
                              title="Supprimer"
                              aria-label="Supprimer"
                            >
                              <FiTrash2 />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(nextPage) => updatePagination(nextPage, pageSize)}
          onPageSizeChange={(nextPageSize) => updatePagination(1, nextPageSize)}
          isLoading={loading}
        />
      </div>

      <BudgetLineModal
        open={modalOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        scopeOptions={scopeOptions}
        scopeLoading={scopeLoading}
        saving={saving}
        onClose={closeModal}
        onSave={save}
      />

      <ConfirmActionModal
        open={deleteOpen}
        title="Supprimer la ligne budgetaire"
        message={
          deleteTarget?.code
            ? `Confirmer la suppression de la ligne "${deleteTarget.code}" ?`
            : "Confirmer la suppression de cette ligne budgetaire ?"
        }
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

      <ConfirmActionModal
        open={renewOpen}
        title="Reconduire la ligne budgetaire"
        message={
          renewTarget?.code
            ? `Creer une nouvelle ligne pour le mois suivant a partir de "${renewTarget.code}" ? Le budget initial sera repris, sans reporter le solde restant.`
            : "Creer une nouvelle ligne pour le mois suivant ? Le budget initial sera repris, sans reporter le solde restant."
        }
        confirmLabel="Reconduire"
        loading={saving}
        onClose={() => {
          if (saving) return;
          setRenewOpen(false);
          setRenewTarget(null);
        }}
        onConfirm={confirmRenew}
      />
    </>
  );
}

function BudgetLineModal({ open, editing, form, setForm, scopeOptions, scopeLoading, saving, onClose, onSave }) {
  const selectedScopeType = String(form.scope_type || "GLOBAL").toUpperCase();
  const options = useMemo(() => {
    if (selectedScopeType === "DIRECTION") return scopeOptions?.directions || [];
    if (selectedScopeType === "DEPARTEMENT") return scopeOptions?.departements || [];
    if (selectedScopeType === "SERVICE") return scopeOptions?.services || [];
    return [];
  }, [selectedScopeType, scopeOptions]);
  const scopeLabel =
    selectedScopeType === "DIRECTION"
      ? "Direction"
      : selectedScopeType === "DEPARTEMENT"
        ? "Departement"
        : selectedScopeType === "SERVICE"
          ? "Service"
          : "Perimetre associe";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editing ? "Modifier ligne budgetaire" : "Nouvelle ligne budgetaire"}
      className="max-w-[820px] m-4"
    >
      <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Code">
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Ex: IT-2026"
            />
          </Field>
          <Field label="Libelle">
            <input
              value={form.libelle}
              onChange={(e) => setForm((p) => ({ ...p, libelle: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Ex: Materiel informatique"
            />
          </Field>
          <Field label="Exercice">
            <select
              value={form.exercice}
              onChange={(e) => setForm((p) => ({ ...p, exercice: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              {buildExerciceOptions(form.exercice).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mois">
            <select
              value={form.mois}
              onChange={(e) => setForm((p) => ({ ...p, mois: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              {BUDGET_MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Montant initial">
            <input
              type="number"
              step="any"
              value={form.montant_initial}
              onChange={(e) => setForm((p) => ({ ...p, montant_initial: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="0"
            />
          </Field>
          <Field label="Devise">
            <input
              value={form.devise}
              onChange={(e) => setForm((p) => ({ ...p, devise: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </Field>
          <Field label="Controle">
            <select
              value={form.controle_mode}
              onChange={(e) => setForm((p) => ({ ...p, controle_mode: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="SOUPLE">Souple - avertissement seulement</option>
              <option value="STRICT">Strict - bloquant</option>
            </select>
          </Field>
          <Field label="Statut">
            <select
              value={form.statut}
              onChange={(e) => setForm((p) => ({ ...p, statut: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="active">Active</option>
              <option value="suspendue">Suspendue</option>
              <option value="cloturee">Cloturee</option>
            </select>
          </Field>
          <Field label="Perimetre">
            <select
              value={form.scope_type}
              onChange={(e) => setForm((p) => ({ ...p, scope_type: e.target.value, scope_id: "" }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="GLOBAL">Global entreprise</option>
              <option value="DIRECTION">Direction</option>
              <option value="DEPARTEMENT">Departement</option>
              <option value="SERVICE">Service</option>
            </select>
          </Field>
          <Field label={scopeLabel}>
            <select
              value={form.scope_id}
              onChange={(e) => setForm((p) => ({ ...p, scope_id: e.target.value }))}
              disabled={selectedScopeType === "GLOBAL" || scopeLoading}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none disabled:bg-gray-100 dark:bg-gray-950 dark:border-gray-800 dark:disabled:bg-gray-800"
            >
              <option value="">
                {selectedScopeType === "GLOBAL"
                  ? "Non requis"
                  : scopeLoading
                    ? "Chargement..."
                    : `Selectionnez un ${scopeLabel.toLowerCase()}`}
              </option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {scopeOptionLabel(item, selectedScopeType)}
                </option>
              ))}
            </select>
            {selectedScopeType !== "GLOBAL" && !scopeLoading && !options.length ? (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Aucun referentiel disponible pour ce perimetre.
              </div>
            ) : null}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Metric({ label, value, tone = "default" }) {
  const toneClass = tone === "danger" ? "text-red-600 dark:text-red-300" : "text-gray-900 dark:text-white/90";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function statusLabel(value) {
  const v = String(value || "").toLowerCase();
  if (v === "active") return "Active";
  if (v === "suspendue") return "Suspendue";
  if (v === "cloturee") return "Cloturee";
  return value || "-";
}

function statusClass(value) {
  const v = String(value || "").toLowerCase();
  if (v === "active") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (v === "suspendue") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function scopeOptionLabel(item, scopeType) {
  if (!item) return "-";
  const code = item.code ? `${item.code} - ` : "";
  const name = item.nom || item.name || item.libelle || `#${item.id}`;
  if (scopeType === "SERVICE") {
    const dep = item.departements?.nom ? ` (${item.departements.nom})` : "";
    return `${code}${name}${dep}`;
  }
  if (scopeType === "DEPARTEMENT") {
    const direction = item.directions?.nom ? ` (${item.directions.nom})` : "";
    return `${code}${name}${direction}`;
  }
  return `${code}${name}`;
}

function buildExerciceOptions(selectedValue) {
  const selected = Number(selectedValue);
  const options = [...EXERCICE_OPTIONS];
  if (Number.isFinite(selected) && selected > 0 && !options.includes(selected)) {
    options.push(selected);
  }
  return Array.from(new Set(options)).sort((a, b) => b - a);
}

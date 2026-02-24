import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { Modal } from "../../components/ui/modal";
import ExportButton from "../../components/common/ExportButton";
import { emitToast } from "../../services/toastBus";
import { adminResetUserPassword, createUser, listUsers, softDeleteUser, updateUser } from "../../services/users.admin.service";
import { listRoles } from "../../services/roles.service";
import { setUserRoles } from "../../services/userRoles.service";
import { exportRowsToExcel } from "../../utils/excelExport";

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normalizeRoleName(role) {
  return String(role || "").trim().toUpperCase();
}

function getPrimaryRole(user) {
  const raw = user?.primaryRole || user?.agent?.roles?.name || "";
  const normalized = normalizeRoleName(raw);
  return normalized || "";
}

function getSecondaryRoles(user) {
  const primary = getPrimaryRole(user);
  const source =
    Array.isArray(user?.secondaryRoles) && user.secondaryRoles.length
      ? user.secondaryRoles
      : user?.roles || [];
  const filtered = source.filter((r) => normalizeRoleName(r) !== primary);
  return uniq(filtered);
}

export default function UsersAdmin({ embedded = false } = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [isActive, setIsActive] = useState("");

  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ nom: "", prenom: "", is_active: true, roles: [] });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", nom: "", prenom: "", is_active: true, roles: [] });
  const [createdPassword, setCreatedPassword] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, rRes] = await Promise.all([
        listUsers({ q: q || undefined, is_active: isActive || undefined, limit: 50 }),
        listRoles(),
      ]);

      if (!uRes?.success) throw new Error(uRes?.message || "Erreur chargement users");
      if (!rRes?.success) throw new Error(rRes?.message || "Erreur chargement rôles");

      setRows(uRes?.data?.items || uRes?.items || []);
      setRoles(rRes.data || rRes.items || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const TitleTag = embedded ? "h2" : "h1";
  const titleClass = embedded ? "text-lg font-semibold text-gray-900 dark:text-white/90" : "text-xl font-semibold text-gray-900 dark:text-white/90";
  const descClass = embedded ? "mt-1 text-xs text-gray-500 dark:text-gray-400" : "mt-1 text-sm text-gray-500 dark:text-gray-400";

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      nom: u?.nom || "",
      prenom: u?.prenom || "",
      is_active: !!u?.is_active,
      roles: getSecondaryRoles(u),
    });
    setEditOpen(true);
  };

  const roleNames = useMemo(() => {
    return (roles || []).map((r) => r?.name).filter(Boolean);
  }, [roles]);
  const exportColumns = [
    { header: "Email", value: (u) => u?.email || "-" },
    { header: "Nom", value: (u) => u?.nom || "-" },
    { header: "Prénom", value: (u) => u?.prenom || "-" },
    { header: "Rôle principal", value: (u) => getPrimaryRole(u) || "-" },
    { header: "Rôles secondaires", value: (u) => getSecondaryRoles(u).join(", ") || "-" },
    { header: "Actif", value: (u) => (u?.is_active ? "Oui" : "Non") },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows,
      columns: exportColumns,
      filename: `utilisateurs_${dateTag}.xlsx`,
      sheetName: "Utilisateurs",
    });
  };

  const save = async () => {
    if (!editUser?.id && !editUser?.uuid) return;
    const idOrUuid = editUser?.uuid || editUser?.id;

    setSaving(true);
    try {
      const uRes = await updateUser(idOrUuid, {
        nom: form.nom,
        prenom: form.prenom,
        is_active: !!form.is_active,
      });
      if (!uRes?.success) throw new Error(uRes?.message || "Erreur update user");

      const primary = getPrimaryRole(editUser);
      const secondaryOnly = primary
        ? uniq((form.roles || []).filter((r) => normalizeRoleName(r) !== primary))
        : uniq(form.roles);
      const rolesRes = await setUserRoles(idOrUuid, secondaryOnly);
      if (!rolesRes?.success) throw new Error(rolesRes?.message || "Erreur update rôles");

      emitToast({ variant: "success", message: "Utilisateur mis à jour" });
      setEditOpen(false);
      setEditUser(null);
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setCreatedPassword("");
    setCreateForm({ email: "", nom: "", prenom: "", is_active: true, roles: [] });
    setCreateOpen(true);
  };

  const create = async () => {
    const email = String(createForm.email || "").trim();
    const nom = String(createForm.nom || "").trim();
    const prenom = String(createForm.prenom || "").trim();
    if (!email) return emitToast({ variant: "error", message: "Email obligatoire" });
    if (!nom) return emitToast({ variant: "error", message: "Nom obligatoire" });
    if (!prenom) return emitToast({ variant: "error", message: "Prénom obligatoire" });

    setSaving(true);
    try {
      const res = await createUser({ email, nom, prenom, is_active: !!createForm.is_active });
      if (!res?.success) throw new Error(res?.message || "Erreur création user");

      const idOrUuid = res?.data?.uuid || res?.data?.id;
      if (idOrUuid && (createForm.roles || []).length) {
        const rolesRes = await setUserRoles(idOrUuid, uniq(createForm.roles));
        if (!rolesRes?.success) throw new Error(rolesRes?.message || "Erreur update rôles");
      }

      setCreatedPassword(res?.data?.temporaryPassword || "");
      emitToast({ variant: "success", message: "Utilisateur créé" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (u) => {
    if (!u?.id && !u?.uuid) return;
    setSaving(true);
    try {
      const idOrUuid = u.uuid || u.id;
      const res = await softDeleteUser(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression utilisateur");
      emitToast({ variant: "success", message: "Utilisateur supprimé" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const openReset = (u) => {
    setResetUser(u);
    setResetPasswordValue("");
    setResetOpen(true);
  };

  const doReset = async () => {
    if (!resetUser?.id && !resetUser?.uuid) return;
    setSaving(true);
    try {
      const idOrUuid = resetUser.uuid || resetUser.id;
      const res = await adminResetUserPassword(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur reset mot de passe");
      setResetPasswordValue(res?.data?.temporaryPassword || "");
      emitToast({ variant: "success", message: "Mot de passe réinitialisé" });
      await fetchAll();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!embedded && <PageMeta title="Administration - Utilisateurs" description="Gestion des utilisateurs" />}
      {!embedded && <FullscreenLoader show={loading || saving} label={saving ? "Enregistrement..." : "Chargement..."} />}

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <TitleTag className={titleClass}>Utilisateurs</TitleTag>
            <p className={descClass}>Liste et gestion des utilisateurs.</p>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Recherche</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                placeholder="email, nom, prénom"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Actif</label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value)}
                className="mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="">Tous</option>
                <option value="true">Actifs</option>
                <option value="false">Inactifs</option>
              </select>
            </div>
            <button
              onClick={fetchAll}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              Filtrer
            </button>

            <ExportButton
              onExport={handleExport}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60"
            />
            <button
              onClick={openCreate}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-800"
            >
              Nouveau
            </button>
          </div>
        </div>

        {embedded && (loading || saving) ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-gray-50 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
            {saving ? "Enregistrement..." : "Chargement..."}
          </div>
        ) : null}

        {error ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="overflow-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Rôle principal</th>
                <th className="px-4 py-3">Rôles secondaires</th>
                <th className="px-4 py-3">Actif</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={7}>
                    Aucun utilisateur.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.nom || "-"}</td>
                    <td className="px-4 py-3">{u.prenom || "-"}</td>
                    <td className="px-4 py-3">{getPrimaryRole(u) || "-"}</td>
                    <td className="px-4 py-3">{getSecondaryRoles(u).join(", ") || "-"}</td>
                    <td className="px-4 py-3">{u.is_active ? "Oui" : "Non"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => openReset(u)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                        >
                          Reset MDP
                        </button>
                        <button
                          onClick={() => confirmDelete(u)}
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
        isOpen={createOpen}
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
          setCreatedPassword("");
        }}
        title="Créer utilisateur"
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
          <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Email</label>
            <input
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Nom</label>
              <input
                value={createForm.nom}
                onChange={(e) => setCreateForm((p) => ({ ...p, nom: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Prénom</label>
              <input
                value={createForm.prenom}
                onChange={(e) => setCreateForm((p) => ({ ...p, prenom: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={!!createForm.is_active}
              onChange={(e) => setCreateForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            Compte actif
          </label>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Rôles secondaires</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Le rôle principal est défini dans la fiche Agent.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {roleNames.map((rn) => {
                const checked = (createForm.roles || []).includes(rn);
                return (
                  <label key={rn} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? uniq([...(createForm.roles || []), rn])
                          : (createForm.roles || []).filter((x) => x !== rn);
                        setCreateForm((p) => ({ ...p, roles: next }));
                      }}
                    />
                    {rn}
                  </label>
                );
              })}
            </div>
          </div>

          {createdPassword ? (
            <div className="px-4 py-3 text-sm rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              Mot de passe temporaire: <span className="font-mono">{createdPassword}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setCreateOpen(false);
                setCreatedPassword("");
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Fermer
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              {saving ? <Loader inline size="sm" label="Traitement..." /> : "Créer"}
            </button>
          </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={resetOpen}
        onClose={() => {
          if (saving) return;
          setResetOpen(false);
          setResetUser(null);
          setResetPasswordValue("");
        }}
        title="Réinitialiser mot de passe"
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
          <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Utilisateur: <b>{resetUser?.email || ""}</b>
          </p>

          {resetPasswordValue ? (
            <div className="px-4 py-3 text-sm rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              Nouveau mot de passe temporaire: <span className="font-mono">{resetPasswordValue}</span>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">Un mot de passe temporaire sera généré.</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setResetOpen(false);
                setResetUser(null);
                setResetPasswordValue("");
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
            >
              Fermer
            </button>
            <button
              onClick={doReset}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
            >
              {saving ? <Loader inline size="sm" label="Traitement..." /> : "Réinitialiser"}
            </button>
          </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={() => {
          if (saving) return;
          setEditOpen(false);
          setEditUser(null);
        }}
        title="Modifier utilisateur"
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
          <div className="space-y-3">
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

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            Compte actif
          </label>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Rôle principal (agent)</p>
            <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">
              {getPrimaryRole(editUser) || "-"}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Rôles secondaires</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {roleNames.map((rn) => {
                const checked = (form.roles || []).includes(rn);
                return (
                  <label key={rn} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? uniq([...(form.roles || []), rn])
                          : (form.roles || []).filter((x) => x !== rn);
                        setForm((p) => ({ ...p, roles: next }));
                      }}
                    />
                    {rn}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEditOpen(false);
                setEditUser(null);
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





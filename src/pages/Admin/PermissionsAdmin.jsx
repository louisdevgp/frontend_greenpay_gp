import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import { emitToast } from "../../services/toastBus";
import { listRoles } from "../../services/roles.service";
import { getRolePermissions, listPermissions, setRolePermissions } from "../../services/permissions.admin.service";

function uniq(arr) {
  return Array.from(new Set(arr));
}

export default function PermissionsAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [roleId, setRoleId] = useState("");
  const [checkedCodes, setCheckedCodes] = useState([]);

  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === String(roleId)) || null,
    [roles, roleId]
  );

  const fetchInit = async () => {
    setLoading(true);
    setError("");
    try {
      const [rRes, pRes] = await Promise.all([listRoles(), listPermissions()]);
      if (!rRes?.success) throw new Error(rRes?.message || "Erreur chargement rôles");
      if (!pRes?.success) throw new Error(pRes?.message || "Erreur chargement permissions");

      const r = rRes.data || rRes.items || [];
      const p = pRes.data || pRes.items || [];
      setRoles(r);
      setPermissions(p);

      if (r.length && !roleId) setRoleId(String(r[0].id));
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePerms = async (rid) => {
    if (!rid) return;
    setLoading(true);
    setError("");
    try {
      const res = await getRolePermissions(rid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement permissions rôle");
      const codes = res?.data?.permissionCodes || [];
      setCheckedCodes(uniq(codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)));
    } catch (e) {
      setError(e?.message || "Erreur");
      setCheckedCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roleId) fetchRolePerms(roleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const toggle = (code, checked) => {
    const c = String(code || "").trim().toUpperCase();
    if (!c) return;
    setCheckedCodes((prev) => {
      if (checked) return uniq([...prev, c]);
      return prev.filter((x) => x !== c);
    });
  };

  const checkAll = () => {
    setCheckedCodes(
      uniq(
        (permissions || [])
          .map((p) => String(p.code || "").trim().toUpperCase())
          .filter(Boolean)
      )
    );
  };

  const uncheckAll = () => setCheckedCodes([]);

  const save = async () => {
    if (!roleId) return;
    setSaving(true);
    try {
      const res = await setRolePermissions(roleId, checkedCodes);
      if (!res?.success) throw new Error(res?.message || "Erreur enregistrement");
      emitToast({ variant: "success", message: "Permissions enregistrées" });
      await fetchRolePerms(roleId);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Administration - Permissions" description="Gestion des permissions" />
      <FullscreenLoader show={loading || saving} label={saving ? "Enregistrement..." : "Chargement..."} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Permissions</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Assigner les permissions à chaque rôle.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkAll}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
              disabled={saving || loading || !permissions.length}
            >
              Tout cocher
            </button>
            <button
              type="button"
              onClick={uncheckAll}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
              disabled={saving || loading}
            >
              Tout décocher
            </button>
            <button
              type="button"
              onClick={save}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
              disabled={saving || loading || !roleId}
            >
              {saving ? <Loader inline size="sm" label="Enregistrement..." /> : "Enregistrer"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Rôle</p>
              <select
                className="w-full px-3 py-2 mt-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 dark:bg-gray-950"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={loading || saving}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.label}
                  </option>
                ))}
              </select>
              {selectedRole ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {checkedCodes.length} permission(s) activée(s)
                </p>
              ) : null}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p className="text-xs text-gray-500 dark:text-gray-400">Conseil</p>
              <p className="mt-2">
                Après modification, les nouvelles règles s’appliquent immédiatement (API). Pour éviter de vous bloquer,
                gardez toujours le rôle ADMIN attribué au moins à un utilisateur.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white/90">Permissions disponibles</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(permissions || []).map((perm) => {
              const code = String(perm.code || "").trim().toUpperCase();
              const label = String(perm.label || "").trim() || code;
              const checked = checkedCodes.includes(code);
              return (
                <label
                  key={code}
                  className="flex items-start gap-2 p-3 border border-gray-100 rounded-lg dark:border-gray-800"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(e) => toggle(code, e.target.checked)}
                    disabled={loading || saving}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-800 dark:text-gray-100 truncate">{label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{code}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

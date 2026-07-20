import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { Modal } from "../../components/ui/modal";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";
import Loader from "../../components/common/Loader";
import { emitToast } from "../../services/toastBus";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  adminResetUserPassword,
  createUser,
  getUser,
  listUsers,
  softDeleteUser,
  updateUser,
} from "../../services/users.admin.service";
import { listRoles } from "../../services/roles.service";
import { setUserRoles } from "../../services/userRoles.service";
import { getUserPermissions, listPermissions, setUserPermissions } from "../../services/permissions.admin.service";
import {
  createAgent,
  listAgents,
  setAgentManager,
  updateAgent,
} from "../../services/agents.admin.service";
import { listDirections } from "../../services/directions.service";
import { listDepartements } from "../../services/departements.service";
import { listServices } from "../../services/services.service";
import {
  normalizePermissionCode,
  normalizeScopeType,
  normalizeScopeId,
  normalizeScope,
  scopeKey,
  scopeTypeLabel,
} from "../../utils/permissionScopes";

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

function normalizeScopeList(list = []) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const scope = normalizeScope(raw);
    const key = scopeKey(scope);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(scope);
  }
  return out;
}

function buildScopeLabel(scope, { directionsById, departementsById, servicesById }) {
  const type = normalizeScopeType(scope?.type);
  const id = normalizeScopeId(scope?.id);
  if (!type || type === "GLOBAL") return "Global";
  if (type === "DIRECTION") {
    const dir = directionsById.get(String(id));
    return dir ? `Direction: ${dir.nom}` : `Direction #${id ?? "-"}`;
  }
  if (type === "DEPARTEMENT") {
    const dep = departementsById.get(String(id));
    return dep ? `Departement: ${dep.nom}` : `Departement #${id ?? "-"}`;
  }
  if (type === "SERVICE") {
    const srv = servicesById.get(String(id));
    return srv ? `Service: ${srv.nom}` : `Service #${id ?? "-"}`;
  }
  return scopeTypeLabel(type);
}

function PermissionScopeEditor({
  scopes,
  onChange,
  directions = [],
  departements = [],
  services = [],
  disabled,
  defaultDirectionId = null,
  defaultDepartementId = null,
  defaultServiceId = null,
}) {
  const [draftType, setDraftType] = useState("GLOBAL");
  const [draftId, setDraftId] = useState("");

  const directionsById = useMemo(
    () => new Map((directions || []).map((d) => [String(d.id), d])),
    [directions]
  );
  const departementsById = useMemo(
    () => new Map((departements || []).map((d) => [String(d.id), d])),
    [departements]
  );
  const servicesById = useMemo(
    () => new Map((services || []).map((s) => [String(s.id), s])),
    [services]
  );

  const normalized = useMemo(() => normalizeScopeList(scopes), [scopes]);
  const showDefaultHint = normalized.length === 0;

  const defaultIdForType = (type) => {
    if (type === "DIRECTION") return normalizeScopeId(defaultDirectionId);
    if (type === "DEPARTEMENT") return normalizeScopeId(defaultDepartementId);
    if (type === "SERVICE") return normalizeScopeId(defaultServiceId);
    return null;
  };

  const applyScope = (typeRaw, idRaw) => {
    const type = normalizeScopeType(typeRaw) || "GLOBAL";
    const id = type === "GLOBAL" ? null : normalizeScopeId(idRaw);
    if (type !== "GLOBAL" && id == null) return;

    if (type === "GLOBAL") {
      onChange([{ type: "GLOBAL", id: null }]);
      return;
    }

    const next = normalized.filter((s) => normalizeScopeType(s.type) !== "GLOBAL");
    const key = scopeKey({ type, id });
    if (!next.some((s) => scopeKey(s) === key)) {
      next.push({ type, id });
    }
    onChange(next);
  };

  const addScope = () => {
    applyScope(draftType, draftId);
  };

  const clearGlobalScope = () => {
    onChange(normalized.filter((s) => normalizeScopeType(s.type) !== "GLOBAL"));
  };

  const removeScope = (idx) => {
    const next = normalized.filter((_, i) => i !== idx);
    onChange(next);
  };

  const scopeOptions = [
    { value: "GLOBAL", label: "Global" },
    { value: "DIRECTION", label: "Direction" },
    { value: "DEPARTEMENT", label: "Departement" },
    { value: "SERVICE", label: "Service" },
  ];

  const idOptions = (() => {
    if (draftType === "DIRECTION") return directions;
    if (draftType === "DEPARTEMENT") return departements;
    if (draftType === "SERVICE") return services;
    return [];
  })();

  return (
    <div className="mt-2 space-y-2">
      {normalized.length ? (
        <div className="flex flex-wrap gap-1">
          {normalized.map((s, idx) => (
            <span
              key={`${scopeKey(s)}-${idx}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {buildScopeLabel(s, { directionsById, departementsById, servicesById })}
              <button
                type="button"
                onClick={() => removeScope(idx)}
                disabled={disabled}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-gray-400 dark:text-gray-500">Par defaut: portee de l'agent si disponible</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800 dark:bg-gray-950"
          value={draftType}
          onChange={(e) => {
            const nextType = normalizeScopeType(e.target.value) || "GLOBAL";
            const nextId = defaultIdForType(nextType);
            setDraftType(nextType);
            setDraftId(nextId != null ? String(nextId) : "");
            if (nextType === "GLOBAL" || nextId != null) {
              applyScope(nextType, nextId);
            } else {
              clearGlobalScope();
            }
          }}
          disabled={disabled}
        >
          {scopeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {draftType !== "GLOBAL" ? (
          <select
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800 dark:bg-gray-950"
            value={draftId}
            onChange={(e) => {
              setDraftId(e.target.value);
              applyScope(draftType, e.target.value);
            }}
            disabled={disabled}
          >
            <option value="">Choisir...</option>
            {idOptions.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.nom}
              </option>
            ))}
          </select>
        ) : null}

        <button
          type="button"
          onClick={addScope}
          disabled={disabled || (draftType !== "GLOBAL" && !draftId)}
          className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
        >
          Ajouter
        </button>
      </div>

      {showDefaultHint && (
        <div className="text-[11px] text-gray-400 dark:text-gray-500">
          Sans scope explicite, la portee de l'agent est utilisee si disponible.
        </div>
      )}
    </div>
  );
}

export default function PeopleAdmin() {
  const { hasAnyPermission } = useAuth();
  const canUsers = hasAnyPermission(["USERS_MANAGE"]);
  const canAgents = hasAnyPermission(["AGENTS_MANAGE"]);
  const canPerms = hasAnyPermission(["PERMISSIONS_MANAGE"]);
  const canRoles = hasAnyPermission(["ROLES_MANAGE"]);
  const canUserRoles = hasAnyPermission(["USER_ROLES_MANAGE"]);

  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [isActive, setIsActive] = useState("");

  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [directions, setDirections] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [services, setServices] = useState([]);

  const [selectedId, setSelectedId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const [userForm, setUserForm] = useState({ nom: "", prenom: "", is_active: true });
  const [secondaryRoles, setSecondaryRoles] = useState([]);
  const [userPerms, setUserPerms] = useState({ allow: [], deny: [], scopes: {} });
  const [userPermsLoading, setUserPermsLoading] = useState(false);

  const [agentForm, setAgentForm] = useState({
    user_id: "",
    nom: "",
    prenom: "",
    matricule: "",
    direction_id: "",
    departement_id: "",
    service_id: "",
    role_id: "",
  });
  const [managerId, setManagerId] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    nom: "",
    prenom: "",
    is_active: true,
    roles: [],
  });
  const [createdPassword, setCreatedPassword] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isBusy = loading || metaLoading || detailLoading || saving;

  const roleNames = useMemo(() => {
    return (roles || []).map((r) => r?.name).filter(Boolean);
  }, [roles]);

  const selectedAgent = useMemo(() => {
    if (!selectedUser) return null;
    const fromList = agents.find((a) => String(a?.users?.id) === String(selectedUser.id));
    return fromList || selectedUser?.agent || null;
  }, [agents, selectedUser]);

  const managerOptions = useMemo(() => {
    if (!agents?.length) return [];
    return agents.filter((a) => String(a.id) !== String(selectedAgent?.id));
  }, [agents, selectedAgent]);

  const defaultPermissionScopes = useCallback(() => {
    const directionId = normalizeScopeId(selectedAgent?.direction_id || agentForm.direction_id);
    if (directionId != null) return [{ type: "DIRECTION", id: directionId }];
    const departementId = normalizeScopeId(selectedAgent?.departement_id || agentForm.departement_id);
    if (departementId != null) return [{ type: "DEPARTEMENT", id: departementId }];
    const serviceId = normalizeScopeId(selectedAgent?.service_id || agentForm.service_id);
    if (serviceId != null) return [{ type: "SERVICE", id: serviceId }];
    return [{ type: "GLOBAL", id: null }];
  }, [agentForm.departement_id, agentForm.direction_id, agentForm.service_id, selectedAgent]);

  const fetchMeta = async () => {
    setMetaLoading(true);
    setError("");
    try {
      const canLoadOrgMeta = canAgents || canPerms;
      const [rRes, aRes, dirRes, depRes, srvRes, pRes] = await Promise.all([
        canRoles ? listRoles() : Promise.resolve({ success: true, data: [] }),
        canLoadOrgMeta ? listAgents({ limit: 500 }) : Promise.resolve({ success: true, items: [] }),
        canLoadOrgMeta ? listDirections() : Promise.resolve({ success: true, data: [] }),
        canLoadOrgMeta ? listDepartements() : Promise.resolve({ success: true, data: [] }),
        canLoadOrgMeta ? listServices() : Promise.resolve({ success: true, data: [] }),
        canPerms ? listPermissions() : Promise.resolve({ success: true, data: [] }),
      ]);

      if (canRoles && !rRes?.success) throw new Error(rRes?.message || "Erreur chargement rôles");
      if (canLoadOrgMeta && !aRes?.success) throw new Error(aRes?.message || "Erreur chargement agents");
      if (canLoadOrgMeta && !dirRes?.success) throw new Error(dirRes?.message || "Erreur chargement directions");
      if (canLoadOrgMeta && !depRes?.success) throw new Error(depRes?.message || "Erreur chargement départements");
      if (canLoadOrgMeta && !srvRes?.success) throw new Error(srvRes?.message || "Erreur chargement services");
      if (canPerms && !pRes?.success) throw new Error(pRes?.message || "Erreur chargement permissions");

      setRoles(canRoles ? (rRes?.data || rRes?.items || []) : []);
      setAgents(aRes?.items || aRes?.data?.items || []);
      setDirections(dirRes?.data || dirRes?.items || []);
      setDepartements(depRes?.data || depRes?.items || []);
      setServices(srvRes?.data || srvRes?.items || []);
      setPermissions(pRes?.data || pRes?.items || []);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!canUsers) {
      setRows([]);
      setSelectedId("");
      setSelectedUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const uRes = await listUsers({
        q: q || undefined,
        is_active: isActive || undefined,
        limit: 100,
      });

      if (!uRes?.success) throw new Error(uRes?.message || "Erreur chargement users");

      const items = uRes?.data?.items || uRes?.items || [];
      setRows(items);

      setSelectedId((current) => {
        const stillThere = current && items.some((u) => String(u.id) === String(current) || String(u.uuid) === String(current));
        if (stillThere) return current;
        const next = items[0]?.uuid || items[0]?.id || "";
        return next ? String(next) : "";
      });
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async (idOrUuid) => {
    if (!canUsers || !idOrUuid) return;
    setDetailLoading(true);
    setError("");
    try {
      const res = await getUser(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement utilisateur");
      setSelectedUser(res?.data || null);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAgents, canPerms]);

  useEffect(() => {
    if (!canUsers) {
      setError("Permission USERS_MANAGE requise pour accéder à la liste.");
      setLoading(false);
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsers]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedUser(null);
      return;
    }
    loadUser(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selectedUser) {
      setUserForm({ nom: "", prenom: "", is_active: true });
      setSecondaryRoles([]);
      setUserPerms({ allow: [], deny: [], scopes: {} });
      setUserPermsLoading(false);
      return;
    }
    setUserForm({
      nom: selectedUser?.nom || "",
      prenom: selectedUser?.prenom || "",
      is_active: !!selectedUser?.is_active,
    });
    setSecondaryRoles(getSecondaryRoles(selectedUser));
  }, [selectedUser]);

  const fetchUserOverrides = async (u) => {
    const userId = u?.id;
    if (!userId || !canPerms) return;
    setUserPermsLoading(true);
    try {
      const res = await getUserPermissions(userId);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement permissions utilisateur");
      const scopeMap = {};
      const rawScopes = res?.data?.scopes || {};
      for (const [rawCode, rawList] of Object.entries(rawScopes)) {
        const code = normalizePermissionCode(rawCode);
        if (!code) continue;
        scopeMap[code] = normalizeScopeList(rawList);
      }
      setUserPerms({
        allow: uniq((res?.data?.allowCodes || []).map(normalizePermissionCode)),
        deny: uniq((res?.data?.denyCodes || []).map(normalizePermissionCode)),
        scopes: scopeMap,
      });
    } catch (e) {
      setUserPerms({ allow: [], deny: [], scopes: {} });
      emitToast({ variant: "error", message: e?.message || "Erreur permissions utilisateur" });
    } finally {
      setUserPermsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedUser || !canPerms) {
      setUserPerms({ allow: [], deny: [], scopes: {} });
      setUserPermsLoading(false);
      return;
    }
    fetchUserOverrides(selectedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, canPerms]);

  useEffect(() => {
    if (!selectedUser) {
      setAgentForm({
        user_id: "",
        nom: "",
        prenom: "",
        matricule: "",
        direction_id: "",
        departement_id: "",
        service_id: "",
        role_id: "",
      });
      setManagerId("");
      return;
    }

    if (!selectedAgent) {
      setAgentForm({
        user_id: selectedUser?.id ? String(selectedUser.id) : "",
        nom: selectedUser?.nom || "",
        prenom: selectedUser?.prenom || "",
        matricule: "",
        direction_id: "",
        departement_id: "",
        service_id: "",
        role_id: "",
      });
      setManagerId("");
      return;
    }

    setAgentForm({
      user_id: selectedAgent?.users?.id ? String(selectedAgent.users.id) : selectedUser?.id ? String(selectedUser.id) : "",
      nom: selectedAgent?.nom || selectedUser?.nom || "",
      prenom: selectedAgent?.prenom || selectedUser?.prenom || "",
      matricule: selectedAgent?.matricule || "",
      direction_id: selectedAgent?.direction_id ? String(selectedAgent.direction_id) : "",
      departement_id: selectedAgent?.departement_id ? String(selectedAgent.departement_id) : "",
      service_id: selectedAgent?.service_id ? String(selectedAgent.service_id) : "",
      role_id: selectedAgent?.role_id ? String(selectedAgent.role_id) : "",
    });
    setManagerId(selectedAgent?.agents?.id ? String(selectedAgent.agents.id) : "");
  }, [selectedAgent, selectedUser]);

  const saveUserInfo = async () => {
    if (!selectedUser?.id && !selectedUser?.uuid) return;
    const idOrUuid = selectedUser?.uuid || selectedUser?.id;
    setSaving(true);
    try {
      const res = await updateUser(idOrUuid, {
        nom: userForm.nom,
        prenom: userForm.prenom,
        is_active: !!userForm.is_active,
      });
      if (!res?.success) throw new Error(res?.message || "Erreur update user");
      emitToast({ variant: "success", message: "Utilisateur mis à jour" });
      await fetchUsers();
      await loadUser(idOrUuid);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const saveSecondaryRoles = async () => {
    if (!selectedUser?.id && !selectedUser?.uuid) return;
    if (!canUserRoles) {
      emitToast({ variant: "error", message: "Permission USER_ROLES_MANAGE requise." });
      return;
    }
    const idOrUuid = selectedUser?.uuid || selectedUser?.id;
    setSaving(true);
    try {
      const primary = getPrimaryRole(selectedUser);
      const secondaryOnly = primary
        ? uniq((secondaryRoles || []).filter((r) => normalizeRoleName(r) !== primary))
        : uniq(secondaryRoles || []);
      const res = await setUserRoles(idOrUuid, secondaryOnly);
      if (!res?.success) throw new Error(res?.message || "Erreur update rôles");
      emitToast({ variant: "success", message: "Rôles mis à jour" });
      await fetchUsers();
      await loadUser(idOrUuid);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const saveUserPermissions = async () => {
    if (!canPerms || !selectedUser?.id) return;
    setSaving(true);
    try {
      const allowSet = new Set((userPerms.allow || []).map(normalizePermissionCode));
      const scopesPayload = {};
      for (const [rawCode, rawList] of Object.entries(userPerms.scopes || {})) {
        const code = normalizePermissionCode(rawCode);
        if (!code || !allowSet.has(code)) continue;
        if (Array.isArray(rawList) && rawList.length) {
          scopesPayload[code] = normalizeScopeList(rawList);
        }
      }
      const res = await setUserPermissions(selectedUser.id, {
        allowCodes: userPerms.allow || [],
        denyCodes: userPerms.deny || [],
        scopes: scopesPayload,
      });
      if (!res?.success) throw new Error(res?.message || "Erreur update permissions utilisateur");
      emitToast({ variant: "success", message: "Permissions utilisateur mises à jour" });
      await fetchUserOverrides(selectedUser);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur permissions utilisateur" });
    } finally {
      setSaving(false);
    }
  };

  const saveAgent = async () => {
    if (!canAgents || !selectedUser) return;
    const basePayload = {
      nom: String(agentForm.nom || "").trim(),
      prenom: String(agentForm.prenom || "").trim(),
      matricule: String(agentForm.matricule || "").trim() || null,
      direction_id: agentForm.direction_id ? Number(agentForm.direction_id) : null,
      departement_id: agentForm.departement_id ? Number(agentForm.departement_id) : null,
      service_id: agentForm.service_id ? Number(agentForm.service_id) : null,
      role_id: agentForm.role_id ? Number(agentForm.role_id) : null,
    };

    if (!selectedUser?.id) return emitToast({ variant: "error", message: "Utilisateur invalide" });
    if (!basePayload.nom) return emitToast({ variant: "error", message: "Nom obligatoire" });
    if (!basePayload.prenom) return emitToast({ variant: "error", message: "Prénom obligatoire" });

    setSaving(true);
    try {
      if (selectedAgent?.id) {
        const res = await updateAgent(selectedAgent.id, basePayload);
        if (!res?.success) throw new Error(res?.message || "Erreur update agent");
        emitToast({ variant: "success", message: "Agent mis à jour" });
      } else {
        const res = await createAgent({ ...basePayload, user_id: Number(selectedUser.id) });
        if (!res?.success) throw new Error(res?.message || "Erreur création agent");
        emitToast({ variant: "success", message: "Agent créé" });
      }
      await fetchMeta();
      await loadUser(selectedUser?.uuid || selectedUser?.id);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const saveHierarchy = async () => {
    if (!canAgents || !selectedAgent?.id) return;
    setSaving(true);
    try {
      const res = await setAgentManager(selectedAgent.id, {
        manager_id: managerId ? Number(managerId) : null,
      });
      if (!res?.success) throw new Error(res?.message || "Erreur changement manager");
      emitToast({ variant: "success", message: "Hiérarchie mise à jour" });
      await fetchMeta();
      await loadUser(selectedUser?.uuid || selectedUser?.id);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const doResetPassword = async () => {
    if (!selectedUser?.id && !selectedUser?.uuid) return;
    setSaving(true);
    try {
      const idOrUuid = selectedUser?.uuid || selectedUser?.id;
      const res = await adminResetUserPassword(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur reset mot de passe");
      setResetPasswordValue(res?.data?.temporaryPassword || "");
      emitToast({ variant: "success", message: "Mot de passe réinitialisé" });
      await fetchUsers();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const doDeleteUser = async () => {
    if (!selectedUser?.id && !selectedUser?.uuid) return;
    setSaving(true);
    try {
      const idOrUuid = selectedUser?.uuid || selectedUser?.id;
      const res = await softDeleteUser(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur suppression utilisateur");
      emitToast({ variant: "success", message: "Utilisateur supprimé" });
      setSelectedUser(null);
      setSelectedId("");
      await fetchUsers();
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
        if (!canUserRoles) {
          emitToast({ variant: "error", message: "Permission USER_ROLES_MANAGE requise pour définir les rôles." });
        } else {
          const rolesRes = await setUserRoles(idOrUuid, uniq(createForm.roles));
          if (!rolesRes?.success) throw new Error(rolesRes?.message || "Erreur update rôles");
        }
      }

      setCreatedPassword(res?.data?.temporaryPassword || "");
      emitToast({ variant: "success", message: "Utilisateur créé" });
      await fetchUsers();
      if (idOrUuid) setSelectedId(String(idOrUuid));
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const primaryRole = getPrimaryRole(selectedUser);
  const secondaryOptions = roleNames.filter((rn) => normalizeRoleName(rn) !== primaryRole);

  return (
    <>
      <PageMeta title="Administration - Utilisateurs & Hiérarchie" description="Gestion utilisateurs, agents et hiérarchies" />
      <FullscreenLoader show={isBusy} label={saving ? "Enregistrement..." : "Chargement..."} />
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Utilisateurs & Hiérarchie</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Une seule liste, une fiche complète par utilisateur.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-800"
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-3">
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="sm:col-span-2 xl:col-span-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Recherche</label>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                    placeholder="email, nom, prénom"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Actif</label>
                  <select
                    value={isActive}
                    onChange={(e) => setIsActive(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="">Tous</option>
                    <option value="true">Actifs</option>
                    <option value="false">Inactifs</option>
                  </select>
                </div>
                <div className="sm:col-span-3 xl:col-span-1">
                  <button
                    onClick={fetchUsers}
                    className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                  >
                    Filtrer
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    Aucun utilisateur.
                  </div>
                ) : (
                  rows.map((u, idx) => {
                    const isSelected = String(u.id) === String(selectedId) || String(u.uuid) === String(selectedId);
                    return (
                      <button
                        key={u.id || u.uuid || idx}
                        onClick={() => setSelectedId(String(u.uuid || u.id))}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 ${
                          isSelected ? "bg-gray-50 dark:bg-gray-800/60" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white/90">
                              {u.nom || "-"} {u.prenom || ""}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{getPrimaryRole(u) || "-"}</div>
                            <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                              {u.is_active ? "Actif" : "Inactif"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4 xl:col-span-2">
            {!selectedUser ? (
              <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sélectionnez un utilisateur pour afficher ses informations.
                </p>
              </div>
            ) : (
              <>
                <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Utilisateur</h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Informations du compte et statut.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setResetOpen(true);
                          setResetPasswordValue("");
                        }}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg dark:border-gray-700"
                      >
                        Reset MDP
                      </button>
                      <button
                        onClick={() => setDeleteOpen(true)}
                        className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg dark:border-red-900/40 dark:text-red-300"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Email</label>
                      <div className="mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-950/60 dark:border-gray-800">
                        {selectedUser?.email || "-"}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={!!userForm.is_active}
                          onChange={(e) => setUserForm((p) => ({ ...p, is_active: e.target.checked }))}
                        />
                        Compte actif
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Nom</label>
                      <input
                        value={userForm.nom}
                        onChange={(e) => setUserForm((p) => ({ ...p, nom: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Prénom</label>
                      <input
                        value={userForm.prenom}
                        onChange={(e) => setUserForm((p) => ({ ...p, prenom: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      onClick={saveUserInfo}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                    >
                      {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
                    </button>
                  </div>
                </div>
                <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Rôles</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Rôle principal défini par l’agent, rôles secondaires modifiables.
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Rôle principal</p>
                    <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{primaryRole || "-"}</div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Rôles secondaires</p>
                    {!canRoles ? (
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Permission ROLES_MANAGE requise.
                      </div>
                    ) : secondaryOptions.length === 0 ? (
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">Aucun rôle disponible.</div>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {secondaryOptions.map((rn) => {
                          const checked = (secondaryRoles || []).includes(rn);
                          return (
                            <label key={rn} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canUserRoles}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? uniq([...(secondaryRoles || []), rn])
                                    : (secondaryRoles || []).filter((x) => x !== rn);
                                  setSecondaryRoles(next);
                                }}
                              />
                              {rn}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {canRoles && !canUserRoles ? (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Permission USER_ROLES_MANAGE requise pour modifier.
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      onClick={saveSecondaryRoles}
                      disabled={saving || !canUserRoles}
                      className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                    >
                      {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
                    </button>
                  </div>
                </div>
                <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Permissions individuelles</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Héritées des rôles sauf override explicite (autoriser ou refuser).
                    </p>
                  </div>

                  {!canPerms ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Permission PERMISSIONS_MANAGE requise.
                    </div>
                  ) : userPermsLoading ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Chargement des permissions...
                    </div>
                  ) : (permissions || []).length === 0 ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Aucune permission disponible.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(() => {
                          const allowSet = new Set((userPerms.allow || []).map(normalizePermissionCode));
                          const denySet = new Set((userPerms.deny || []).map(normalizePermissionCode));
                          return (permissions || []).map((perm) => {
                            const code = normalizePermissionCode(perm.code);
                            if (!code) return null;
                            const label = String(perm.label || perm.code || "").trim();
                            const status = allowSet.has(code) ? "allow" : denySet.has(code) ? "deny" : "inherit";
                            const scopesForCode = userPerms.scopes?.[code] || [];
                            return (
                              <div
                                key={code}
                                className="p-2 border border-gray-100 rounded-lg dark:border-gray-800"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs text-gray-800 dark:text-gray-200 truncate">{label}</div>
                                    <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{code}</div>
                                  </div>
                                  <select
                                    className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800 dark:bg-gray-950"
                                    value={status}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setUserPerms((prev) => {
                                        const allow = new Set((prev.allow || []).map(normalizePermissionCode));
                                        const deny = new Set((prev.deny || []).map(normalizePermissionCode));
                                        const scopes = { ...(prev.scopes || {}) };
                                        if (next === "allow") {
                                          allow.add(code);
                                          deny.delete(code);
                                          if (!scopes[code] || !scopes[code].length) scopes[code] = defaultPermissionScopes();
                                        } else if (next === "deny") {
                                          deny.add(code);
                                          allow.delete(code);
                                          delete scopes[code];
                                        } else {
                                          allow.delete(code);
                                          deny.delete(code);
                                          delete scopes[code];
                                        }
                                        return { allow: Array.from(allow), deny: Array.from(deny), scopes };
                                      });
                                    }}
                                    disabled={saving}
                                  >
                                    <option value="inherit">Hériter</option>
                                    <option value="allow">Autoriser</option>
                                    <option value="deny">Refuser</option>
                                  </select>
                                </div>

                                {status === "allow" ? (
                                  <PermissionScopeEditor
                                    scopes={scopesForCode}
                                    onChange={(nextScopes) => {
                                      setUserPerms((prev) => ({
                                        ...prev,
                                        scopes: {
                                          ...(prev.scopes || {}),
                                          [code]: normalizeScopeList(nextScopes),
                                        },
                                      }));
                                    }}
                                    directions={directions}
                                    departements={departements}
                                    services={services}
                                    defaultDirectionId={selectedAgent?.direction_id}
                                    defaultDepartementId={selectedAgent?.departement_id}
                                    defaultServiceId={selectedAgent?.service_id}
                                    disabled={saving}
                                  />
                                ) : null}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      <div className="flex justify-end gap-2 pt-3">
                        <button
                          onClick={saveUserPermissions}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                        >
                          {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Agent</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Profil agent, direction et rôle principal.
                    </p>
                  </div>

                  {!canAgents ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Permission AGENTS_MANAGE requise.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Utilisateur</label>
                          <div className="mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-950/60 dark:border-gray-800">
                            {selectedUser?.email || "-"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Matricule</label>
                          <input
                            value={agentForm.matricule}
                            onChange={(e) => setAgentForm((p) => ({ ...p, matricule: e.target.value }))}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Nom</label>
                          <input
                            value={agentForm.nom}
                            onChange={(e) => setAgentForm((p) => ({ ...p, nom: e.target.value }))}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Prénom</label>
                          <input
                            value={agentForm.prenom}
                            onChange={(e) => setAgentForm((p) => ({ ...p, prenom: e.target.value }))}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Direction</label>
                          <select
                            value={agentForm.direction_id}
                            onChange={(e) => setAgentForm((p) => ({ ...p, direction_id: e.target.value }))}
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
                            value={agentForm.departement_id}
                            onChange={(e) => setAgentForm((p) => ({ ...p, departement_id: e.target.value }))}
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

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Service</label>
                          <select
                            value={agentForm.service_id}
                            onChange={(e) => setAgentForm((p) => ({ ...p, service_id: e.target.value }))}
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
                            value={agentForm.role_id}
                            onChange={(e) => setAgentForm((p) => ({ ...p, role_id: e.target.value }))}
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

                      <div className="flex justify-end gap-2 pt-3">
                        <button
                          onClick={saveAgent}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                        >
                          {saving ? <Loader inline size="sm" label="Traitement..." /> : selectedAgent ? "Enregistrer" : "Créer agent"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Hiérarchie</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Définir le manager direct de l’agent.
                    </p>
                  </div>

                  {!canAgents ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Permission AGENTS_MANAGE requise.
                    </div>
                  ) : !selectedAgent ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Aucun agent associé à cet utilisateur.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                        Manager actuel: {selectedAgent?.agents ? `${selectedAgent.agents.nom} ${selectedAgent.agents.prenom}` : "Aucun"}
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-500 dark:text-gray-400">Manager</label>
                        <select
                          value={managerId}
                          onChange={(e) => setManagerId(e.target.value)}
                          className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        >
                          <option value="">Aucun</option>
                          {managerOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nom} {a.prenom} {a.roles?.name ? `(${a.roles.name})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-3">
                        <button
                          onClick={saveHierarchy}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                        >
                          {saving ? <Loader inline size="sm" label="Traitement..." /> : "Enregistrer"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
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
              {!canRoles ? (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Permission ROLES_MANAGE requise.
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {roleNames.map((rn) => {
                    const checked = (createForm.roles || []).includes(rn);
                    return (
                      <label key={rn} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canUserRoles}
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
              )}
              {canRoles && !canUserRoles ? (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Permission USER_ROLES_MANAGE requise pour modifier.
                </div>
              ) : null}
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
          setResetPasswordValue("");
        }}
        title="Réinitialiser mot de passe"
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Utilisateur: <b>{selectedUser?.email || ""}</b>
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
                  setResetPasswordValue("");
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
              >
                Fermer
              </button>
              <button
                onClick={doResetPassword}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
              >
                {saving ? <Loader inline size="sm" label="Traitement..." /> : "Réinitialiser"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmActionModal
        open={deleteOpen}
        title="Supprimer l'utilisateur"
        message={selectedUser?.email ? `Confirmer la suppression de l'utilisateur ${selectedUser.email} ?` : "Confirmer la suppression de l'utilisateur ?"}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        loading={saving}
        onClose={() => {
          if (saving) return;
          setDeleteOpen(false);
        }}
        onConfirm={async () => {
          await doDeleteUser();
          setDeleteOpen(false);
        }}
      />
    </>
  );
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  GridIcon,
  PageIcon,
  ChevronDownIcon,
  BoxCubeIcon,
  TableIcon,
  ListIcon,
  UserCircleIcon,
  UserIcon,
  GroupIcon,
  FileIcon,
  PlusIcon,
  CheckCircleIcon,
  TimeIcon,
  FolderIcon,
  BoxIconLine,
  PlugInIcon,
  HorizontaLDots,
} from "../icons";

import { useSidebar } from "../context/sidebar";
import SidebarWidget from "./SidebarWidget";
import { useAuth } from "../context/AuthContext.jsx";
import { listPermissions } from "../services/permissions.admin.service";
import { useRealtime } from "../context/RealtimeContext.tsx";

type PermissionSpec = {
  permission?: string;
  permissions?: string[];
  permissionsAll?: string[];
};

type SubItem = PermissionSpec & {
  name: string;
  path: string;
  icon?: ReactNode;
  new?: boolean;
};

type MenuItem = PermissionSpec & {
  section?: "main" | "others" | string;
  icon: ReactNode;
  name: string;
  path?: string;
  subItems?: SubItem[];
  new?: boolean;
};

type AuthUser = {
  permissions?: string[];
};

type PermissionDefinition = {
  code?: string;
  appliesTo?: string[];
};

const ADMIN_SUBITEMS: SubItem[] = [
  {
    name: "Utilisateurs & Hiérarchie",
    path: "/admin/people",
    icon: <UserIcon />,
    permissions: ["USERS_MANAGE", "AGENTS_MANAGE"],
  },
  { name: "Directions", path: "/admin/directions", icon: <FolderIcon />, permission: "DIRECTIONS_MANAGE" },
  { name: "Départements", path: "/admin/departements", icon: <BoxIconLine />, permission: "DEPARTEMENTS_MANAGE" },
  { name: "Services", path: "/admin/services", icon: <PlugInIcon />, permission: "SERVICES_MANAGE" },
];

const MENU_ITEMS: MenuItem[] = [
  {
    section: "main",
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
    permissions: ["DASHBOARD_VIEW_SELF", "DASHBOARD_VIEW_ALL"],
  },
  {
    section: "main",
    icon: <PageIcon />,
    name: "Demandes",
    subItems: [
      { name: "Mes demandes", path: "/demandes/my", icon: <FileIcon />, permission: "DEMANDE_LIST_SELF" },
      {
        name: "Toutes les demandes",
        path: "/demandes/all",
        icon: <FileIcon />,
        permissions: ["DEMANDE_LIST", "DEMANDE_LIST_ALL", "DEMANDE_LIST_ASSIGNED_ACHETEUR"],
      },
      {
        name: "Archives V1",
        path: "/archives-v1/demandes",
        icon: <FolderIcon />,
        permission: "ARCHIVES_V1_VIEW",
      },
      { name: "Nouvelle demande", path: "/demandes/create", icon: <PlusIcon />, permission: "DEMANDE_CREATE", new: true },
    ],
  },
  {
    section: "main",
    icon: <ListIcon />,
    name: "Validations",
    subItems: [
      { name: "En attente", path: "/validations/pending", icon: <TimeIcon />, permission: "VALIDATION_LIST_PENDING" },
      { name: "Historique", path: "/validations/done", icon: <CheckCircleIcon />, permission: "VALIDATION_LIST_DONE" },
      { name: "Délégations", path: "/delegations", icon: <GroupIcon />, permission: "DELEGATIONS_MANAGE" },
    ],
  },
  {
    section: "main",
    icon: <TableIcon />,
    name: "Réceptions",
    subItems: [
      { name: "Réceptions", path: "/receptions", icon: <FileIcon />, permissions: ["RECEPTION_LIST_SELF", "RECEPTION_LIST_ALL", "RECEPTION_LIST"] },
      { name: "En attente", path: "/receptions/pending", icon: <TimeIcon />, permissions: ["RECEPTION_VISA_DIRECTEUR", "RECEPTION_VISA_DAF"] },
      { name: "Effectuées", path: "/receptions/done", icon: <CheckCircleIcon />, permissions: ["RECEPTION_VISA_DIRECTEUR", "RECEPTION_VISA_DAF"] },
    ],
  },
  {
    section: "main",
    icon: <TableIcon />,
    name: "Paiements",
    subItems: [
      { name: "En attente", path: "/paiements/pending", icon: <TimeIcon />, permission: "PAIEMENT_LIST" },
      { name: "Effectuées", path: "/paiements/done", icon: <CheckCircleIcon />, permission: "PAIEMENT_LIST" },
    ],
  },
  {
    section: "main",
    icon: <BoxCubeIcon />,
    name: "Budget",
    subItems: [
      { name: "Lignes budgetaires", path: "/budget/lignes", icon: <TableIcon />, permission: "BUDGET_LINE_LIST" },
    ],
  },
  {
    section: "main",
    icon: <TableIcon />,
    name: "Achats",
    subItems: [
      { name: "Mes achats", path: "/achats", icon: <FileIcon />, permission: "DEMANDE_LIST_ASSIGNED_ACHETEUR" },
      { name: "En attente", path: "/achats/pending", icon: <TimeIcon />, permission: "DEMANDE_LIST_ASSIGNED_ACHETEUR" },
      { name: "Traités", path: "/achats/done", icon: <CheckCircleIcon />, permission: "DEMANDE_LIST_ASSIGNED_ACHETEUR" },
    ],
  },
  {
    section: "main",
    icon: <BoxCubeIcon />,
    name: "Administration",
    subItems: ADMIN_SUBITEMS,
  },
  { section: "others", icon: <UserCircleIcon />, name: "Profil", path: "/profile" },
];

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeAppliesTo(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean)));
}

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const { user } = useAuth() as { user?: AuthUser };
  const { pendingValidationsCount, pendingPaiementsCount, pendingReceptionsCount, pendingAchatsCount } = useRealtime();

  const [permissionDefs, setPermissionDefs] = useState<PermissionDefinition[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await listPermissions();
        if (!active) return;
        if (res?.success) {
          const items = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.items)
              ? res.items
              : [];
          setPermissionDefs(items);
        }
      } catch {
        if (active) setPermissionDefs([]);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const userPermissions = useMemo(
    () => (user?.permissions || []).map((p) => normalizeCode(p)).filter(Boolean),
    [user?.permissions]
  );

  const userPermissionSet = useMemo(() => new Set(userPermissions), [userPermissions]);

  const permissionMetaMap = useMemo(() => {
    const map = new Map<string, string[]>();
    (permissionDefs || []).forEach((p) => {
      const code = normalizeCode(p?.code);
      if (!code) return;
      const appliesTo = normalizeAppliesTo(p?.appliesTo);
      map.set(code, appliesTo);
    });
    return map;
  }, [permissionDefs]);

  const hasMenuPermission = useCallback(
    (code: string) => {
      const c = normalizeCode(code);
      if (!c) return false;
      if (!userPermissionSet.has(c)) return false;
      if (!permissionMetaMap.size) return true; // fallback: allow if meta not loaded
      const appliesTo = permissionMetaMap.get(c);
      if (!appliesTo || !appliesTo.length) return true;
      return appliesTo.includes("menu");
    },
    [permissionMetaMap, userPermissionSet]
  );

  const canAccess = useCallback(
    (item: PermissionSpec) => {
      if (item.permission) return hasMenuPermission(item.permission);
      if (Array.isArray(item.permissions)) return item.permissions.some((c) => hasMenuPermission(c));
      if (Array.isArray(item.permissionsAll)) return item.permissionsAll.every((c) => hasMenuPermission(c));
      return true;
    },
    [hasMenuPermission]
  );

  const computedMenu = useMemo(() => {
    const filterSubItems = (subItems: SubItem[]) => subItems.filter((s) => canAccess(s));

    const filterMenuItems = (items: MenuItem[]) =>
      items.reduce((acc: MenuItem[], item) => {
        const subItems = item.subItems ? filterSubItems(item.subItems) : undefined;
        if (subItems && subItems.length === 0) return acc;
        if (!subItems && !canAccess(item)) return acc;
        acc.push({ ...item, subItems });
        return acc;
      }, []);

    return filterMenuItems(MENU_ITEMS);
  }, [canAccess]);

  const navItems = useMemo(
    () => computedMenu.filter((x) => (x.section ?? "main") === "main"),
    [computedMenu]
  );

  const othersItems = useMemo(
    () => computedMenu.filter((x) => (x.section ?? "main") === "others"),
    [computedMenu]
  );

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const handleSubmenuToggle = (key: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ? auto-open si route active (submenu)
  useEffect(() => {
    const active: Record<string, boolean> = {};

    const scan = (items: MenuItem[], type: string) => {
      items.forEach((nav, index) => {
        const key = `${type}-${index}`;
        if (Array.isArray(nav.subItems)) {
          for (const s of nav.subItems) {
            if (isActive(s.path)) {
              active[key] = true;
              break;
            }
          }
        }
      });
    };

    scan(navItems, "main");
    scan(othersItems, "others");

    setOpenSubmenus((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(active);

      if (prevKeys.length === nextKeys.length) {
        let same = true;
        for (const k of nextKeys) {
          if (prev[k] !== active[k]) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return active;
    });
  }, [location.pathname, navItems, othersItems]);

  const renderItems = (items: MenuItem[], type: string) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => {
        const key = `${type}-${index}`;
        const isOpen = !!openSubmenus[key];
        let pendingCount = 0;
        if (nav.name === "Validations") pendingCount = pendingValidationsCount;
        if (nav.name === "Paiements") pendingCount = pendingPaiementsCount;
        if (nav.name === "Réceptions") pendingCount = pendingReceptionsCount;
        if (nav.name === "Achats") pendingCount = pendingAchatsCount;
        const hasPending = pendingCount > 0;
        const pendingBadgeLabel = pendingCount > 99 ? "99+" : String(pendingCount);

        return (
          <li key={key}>
            {Array.isArray(nav.subItems) ? (
              <button
                type="button"
                onClick={() => handleSubmenuToggle(key)}
                className={`menu-item group ${
                  isOpen ? "menu-item-active" : "menu-item-inactive"
                } cursor-pointer ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isOpen ? "menu-item-icon-active" : "menu-item-icon-inactive"
                  } relative`}
                >
                  {nav.icon}
                  {hasPending ? (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500"></span>
                  ) : null}
                </span>

                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">
                    {nav.name}
                    {hasPending ? (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        {pendingBadgeLabel}
                      </span>
                    ) : null}
                  </span>
                )}

                {(isExpanded || isHovered || isMobileOpen) && (
                  <ChevronDownIcon
                    className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-brand-500" : ""
                    }`}
                  />
                )}
              </button>
            ) : (
              <Link
                to={nav.path ?? "#"}
                className={`menu-item group ${
                  nav.path && isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    nav.path && isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )}

            {Array.isArray(nav.subItems) &&
              (isExpanded || isHovered || isMobileOpen) &&
              isOpen && (
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((sub) => (
                    <li key={sub.path}>
                      <Link
                        to={sub.path}
                        className={`menu-dropdown-item ${
                          isActive(sub.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
                        <span className="[&_svg]:size-4">{sub.icon}</span>
                        <span>{sub.name}</span>
                        {sub.path === "/validations/pending" && pendingValidationsCount > 0 ? (
                          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            {pendingBadgeLabel}
                          </span>
                        ) : sub.path === "/paiements/pending" && pendingPaiementsCount > 0 ? (
                          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            {pendingBadgeLabel}
                          </span>
                        ) : sub.path === "/receptions/pending" && pendingReceptionsCount > 0 ? (
                          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            {pendingBadgeLabel}
                          </span>
                        ) : sub.path === "/achats/pending" && pendingAchatsCount > 0 ? (
                          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            {pendingBadgeLabel}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </li>
        );
      })}
    </ul>
  );

  const showFullLogo = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link to="/">
          {showFullLogo ? (
            <>
              <img className="dark:hidden" src="/logo.png" alt="Logo" width={150} height={40} />
              <img className="hidden dark:block" src="/logo.png" alt="Logo" width={150} height={40} />
            </>
          ) : (
            <img src="/favicon.png" alt="Logo" width={36} height={36} />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots className="size-6" />}
              </h2>
              {renderItems(navItems, "main")}
            </div>

            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Others" : <HorizontaLDots />}
              </h2>
              {renderItems(othersItems, "others")}
            </div>
          </div>
        </nav>

        {(isExpanded || isHovered || isMobileOpen) && <SidebarWidget />}
      </div>
    </aside>
  );
}


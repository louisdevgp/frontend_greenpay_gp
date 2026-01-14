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
  HorizontaLDots,
} from "../icons";

import { useSidebar } from "../context/sidebar";
import SidebarWidget from "./SidebarWidget";
import { useAuth } from "../context/AuthContext.jsx";

// ✅ Roles supportés (tu peux en ajouter)
const ROLES = [
  "ADMIN",
  "DEMANDEUR",
  "RESPONSABLE",
  "DIRECTEUR",
  "DAF",
  "DGA",
  "DG",
  "COMPTABLE",
  ] as const;

type Role = (typeof ROLES)[number];

type SubItem = {
  name: string;
  path: string;
  new?: boolean;
};

type MenuItem = {
  section?: "main" | "others" | string;
  icon: ReactNode;
  name: string;
  path?: string;
  subItems?: SubItem[];
  new?: boolean;
};

// ✅ Menus par rôle (paths à adapter à tes routes réelles)
const MENUS_BY_ROLE: Record<Role, MenuItem[]> = {
  DEMANDEUR: [
    { section: "main", icon: <GridIcon />, name: "Dashboard", path: "/" },
    {
      section: "main",
      icon: <PageIcon />,
      name: "Mes demandes",
      subItems: [
        { name: "Mes demandes", path: "/demandes/my" },
        { name: "Toutes les demandes", path: "/demandes/all" },
        { name: "Nouvelle demande", path: "/demandes/create", new: true },
      ],
    },
    { section: "others", icon: <UserCircleIcon />, name: "Profil", path: "/profile" },
  ],

  RESPONSABLE: [
    { section: "main", icon: <GridIcon />, name: "Dashboard", path: "/" },
    {
      section: "main",
      icon: <PageIcon />,
      name: "Mes demandes",
      subItems: [
        { name: "Liste", path: "/demandes/my" },
        { name: "Nouvelle demande", path: "/demandes/create", new: true },
      ],
    },
    {
      section: "main",
      icon: <ListIcon />,
      name: "Mes validations",
      subItems: [
        { name: "En attente", path: "/validations/pending" },
        { name: "Historique", path: "/validations/done" },
        { name: "Délégations", path: "/delegations" },
      ],
    },
    { section: "others", icon: <UserCircleIcon />, name: "Profil", path: "/profile" },
  ],

  DIRECTEUR: [
    {
      section: "main",
      icon: <ListIcon />,
      name: "Validations",
      subItems: [
        { name: "En attente", path: "/validations/pending" },
        { name: "Historique", path: "/validations/done" },
        { name: "Délégations", path: "/delegations" },
      ],
    },
    { section: "main", icon: <TableIcon />, name: "Réceptions", path: "/receptions" },
  ],

  DAF: [
    {
      section: "main",
      icon: <ListIcon />,
      name: "Validations",
      subItems: [
        { name: "En attente", path: "/validations/pending" },
        { name: "Historique", path: "/validations/done" },
        { name: "Délégations", path: "/delegations" },
      ],
    },
    { section: "main", icon: <TableIcon />, name: "Paiements", subItems: [
      { name: "Mes paiements", path: "/paiements" },
    ]},
    { section: "main", icon: <TableIcon />, name: "Réceptions", subItems: [
      { name: "Mes receptions", path: "/receptions" },
    ]},
  ],

  COMPTABLE: [
    { section: "main", icon: <TableIcon />, name: "Paiements", path: "/paiements" },
  ],

  DG: [
    {
      section: "main",
      icon: <ListIcon />,
      name: "Validations",
      subItems: [
        { name: "En attente", path: "/validations/pending" },
        { name: "Historique", path: "/validations/done" },
        { name: "Délégations", path: "/delegations" },
      ],
    },
  ],

  DGA: [
    {
      section: "main",
      icon: <ListIcon />,
      name: "Validations",
      subItems: [
        { name: "En attente", path: "/validations/pending" },
        { name: "Historique", path: "/validations/done" },
        { name: "Délégations", path: "/delegations" },
      ],
    },
  ],

  ADMIN: [
    {
      section: "main",
      icon: <BoxCubeIcon />,
      name: "Administration",
      subItems: [
        { name: "Utilisateurs", path: "/admin/users" },
        { name: "Hiérarchie", path: "/admin/hierarchy" },
        { name: "Directions", path: "/admin/directions" },
        { name: "Départements", path: "/admin/departements" },
        { name: "Services", path: "/admin/services" },
        { name: "Agents", path: "/admin/agents" },
        { name: "Délégations", path: "/admin/delegations" },
      ],
    },
    { section: "main", icon: <PageIcon />, name: "Demandes", path: "/demandes/all" },
  ],
};

type AuthUser = {
  roles?: string[];
  agent?: {
    delegations?: Array<{ role_name?: string | null }>;
  };
};

function normalizeRole(x: unknown): Role | null {
  if (!x) return null;
  const s = String(x).trim().toUpperCase();
  return (ROLES as readonly string[]).includes(s) ? (s as Role) : null;
}

function mergeSubItems(a: SubItem[] = [], b: SubItem[] = []): SubItem[] {
  const map = new Map();
  a.forEach((x) => map.set(x.path, x));
  b.forEach((x) => map.set(x.path, x));
  return Array.from(map.values());
}

function mergeMenus(a: MenuItem[] = [], b: MenuItem[] = []): MenuItem[] {
  const map = new Map();

  const add = (items: MenuItem[]) => {
    items.forEach((it) => {
      const key = it.name;
      if (!map.has(key)) {
        map.set(key, { ...it, subItems: it.subItems ? [...it.subItems] : undefined });
      } else {
        const ex = map.get(key) as MenuItem | undefined;
        if (!ex) return;
        ex.section = ex.section ?? it.section ?? "main";
        ex.path = ex.path ?? it.path;
        ex.icon = ex.icon ?? it.icon;
        if (it.subItems?.length) ex.subItems = mergeSubItems(ex.subItems ?? [], it.subItems);
      }
    });
  };

  add(a);
  add(b);

  return Array.from(map.values());
}

/**
 * Règle métier :
 * - base_role = DEMANDEUR (toujours)
 * - dedicated_role = user.roles[0] (si existe)
 * - + rôles délégués = user.agent.delegations[].role_name (si existe)
 */
function buildMenu(dedicated: Role | null, delegated: Role[] = []): MenuItem[] {
  let menu: MenuItem[] = MENUS_BY_ROLE.DEMANDEUR;

  if (dedicated && dedicated !== "DEMANDEUR") {
    menu = mergeMenus(menu, MENUS_BY_ROLE[dedicated] ?? []);
  }

  delegated.forEach((r) => {
    if (r && r !== "DEMANDEUR") {
      menu = mergeMenus(menu, MENUS_BY_ROLE[r] ?? []);
    }
  });

  return menu;
}

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const { user } = useAuth() as { user?: AuthUser };

  // ✅ user.roles ex: ["COMPTABLE"]
  const dedicatedRole = useMemo(() => normalizeRole(user?.roles?.[0]) ?? null, [user?.roles]);

  // ✅ compat délégations (si tu ajoutes plus tard)
  const delegatedRoles = useMemo(() => {
    const raw = user?.agent?.delegations ?? [];
    return raw
      .map((d) => normalizeRole(d?.role_name))
      .filter((x): x is Role => Boolean(x));
  }, [user?.agent?.delegations]);

  const computedMenu = useMemo(
    () => buildMenu(dedicatedRole, delegatedRoles),
    [dedicatedRole, delegatedRoles]
  );

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

  // ✅ auto-open si route active (submenu)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const renderItems = (items: MenuItem[], type: string) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => {
        const key = `${type}-${index}`;
        const isOpen = !!openSubmenus[key];

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
                  }`}
                >
                  {nav.icon}
                </span>

                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
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
                        {sub.name}
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
          <img className="dark:hidden" src="/images/logo/logo.svg" alt="Logo" width={150} height={40} />
          <img className="hidden dark:block" src="/images/logo/logo-dark.svg" alt="Logo" width={150} height={40} />
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

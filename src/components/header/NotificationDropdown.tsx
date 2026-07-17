import { useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Link } from "react-router";
import { useRealtime, type NotificationItem } from "../../context/RealtimeContext.tsx";

function resolveNotificationLink(n: NotificationItem) {
  const type = String(n?.type || "").toLowerCase();

  if (n?.meta && typeof n.meta === "object") {
    if (type === "validation_pending" && n.meta.demandeUuid) {
      return `/demandes/${n.meta.demandeUuid}`;
    }
    if (n.meta.paiementUuid) return `/paiements/${n.meta.paiementUuid}`;
    if (n.meta.receptionUuid) return `/receptions/${n.meta.receptionUuid}`;
    if (n.meta.validationUuid) return `/validations/uuid/${n.meta.validationUuid}`;
    if (n.meta.demandeUuid) return `/demandes/${n.meta.demandeUuid}`;
  }

  if (type === "validation_pending") return "/validations/pending";
  if (type.startsWith("delegation_")) return "/delegations";
  return "/";
}

function formatWhen(dt: string | number | Date | null | undefined) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const {
    notifications,
    unreadCount,
    loadingNotifications,
    refreshNotifications,
    markAsRead,
    markManyAsRead,
    markAllAsRead,
  } = useRealtime();

  const visibleNotifications = notifications.slice(0, 30);
  const selectedCount = selectedIds.length;

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
    setSelectionMode(false);
    setSelectedIds([]);
  }

  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  const handleClick = () => {
    toggleDropdown();
  };

  const onRead = async (notif: NotificationItem) => {
    await markAsRead(notif);
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => !current);
    setSelectedIds([]);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const selectAllVisible = () => {
    setSelectedIds(visibleNotifications.map((n) => Number(n.id)).filter(Boolean));
  };

  const markSelectedRead = async () => {
    if (!selectedIds.length) return;
    setBulkLoading(true);
    try {
      await markManyAsRead(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
    } finally {
      setBulkLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    setBulkLoading(true);
    try {
      await markAllAsRead();
      setSelectedIds([]);
      setSelectionMode(false);
    } finally {
      setBulkLoading(false);
    }
  };

  function renderNotificationContent(n: NotificationItem) {
    return (
      <>
        {selectionMode ? (
          <span
            aria-hidden="true"
            className={`mt-3 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              selectedIds.includes(Number(n.id))
                ? "border-brand-600 bg-brand-600"
                : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"
            }`}
          />
        ) : null}
        <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {String(n.type || "NOTIF").slice(0, 4).toUpperCase()}
          </span>
          <span
            className={`absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900 ${
              n.read_at ? "bg-gray-300 dark:bg-gray-700" : "bg-orange-400"
            }`}
          ></span>
        </span>

        <span className="block">
          <span className="mb-1.5 block text-theme-sm text-gray-700 dark:text-gray-200">
            {n.message}
          </span>

          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
            <span>{String(n.type || "")}</span>
            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
            <span>{formatWhen(n.created_at)}</span>
          </span>
        </span>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
            unreadCount > 0 ? "flex" : "hidden"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notifications
          </h5>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount || bulkLoading}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Tout lu
            </button>
            <button
              type="button"
              onClick={toggleSelectionMode}
              disabled={!notifications.length || bulkLoading}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              {selectionMode ? "Annuler" : "Selectionner"}
            </button>
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <svg
                className="fill-current"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        {selectionMode ? (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/5">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={!visibleNotifications.length || bulkLoading}
              className="font-medium text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400"
            >
              Tout selectionner
            </button>
            <button
              type="button"
              onClick={markSelectedRead}
              disabled={!selectedCount || bulkLoading}
              className="rounded-md bg-brand-600 px-2.5 py-1 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkLoading ? "Traitement..." : `Marquer lu (${selectedCount})`}
            </button>
          </div>
        ) : null}
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loadingNotifications ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              Chargement...
            </li>
          ) : notifications.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              Aucune notification.
            </li>
          ) : (
            visibleNotifications.map((n) => (
              <li key={n.id}>
                {selectionMode ? (
                  <button
                    type="button"
                    onClick={() => toggleSelected(Number(n.id))}
                    className={`flex w-full gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 text-left hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                      n.read_at ? "opacity-80" : ""
                    }`}
                  >
                    {renderNotificationContent(n)}
                  </button>
                ) : (
                  <DropdownItem
                    tag="a"
                    to={resolveNotificationLink(n)}
                    onItemClick={() => {
                      onRead(n);
                      closeDropdown();
                    }}
                    className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                      n.read_at ? "opacity-80" : ""
                    }`}
                  >
                    {renderNotificationContent(n)}
                  </DropdownItem>
                )}
              </li>
            ))
          )}
        </ul>
        <Link
          to="/"
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Voir toutes les notifications
        </Link>
      </Dropdown>
    </div>
  );
}

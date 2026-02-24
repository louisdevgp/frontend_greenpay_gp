import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function UserProfiles() {
  const { user, roles } = useAuth();
  const fullName = [user?.prenom, user?.nom].filter(Boolean).join(" ") || "-";
  const roleLabel = Array.isArray(roles) && roles.length ? roles.join(", ") : "-";

  return (
    <>
      <PageMeta
        title="Profil"
        description="Profil utilisateur"
      />
      <PageBreadcrumb pageTitle="Profile" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Profile
        </h3>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
                  <img src="/images/user/user-01.jpg" alt="User" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {fullName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.email || "-"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {roleLabel}
                  </div>
                </div>
              </div>

              <Link
                to="/change-password"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Changer mot de passe
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Informations
            </h4>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
              <div>
                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Nom complet</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{fullName}</p>
              </div>

              <div>
                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.email || "-"}</p>
              </div>

              <div>
                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Rôles</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{roleLabel}</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Vos informations personnelles ne sont pas modifiables ici. Seul un administrateur peut modifier un utilisateur.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

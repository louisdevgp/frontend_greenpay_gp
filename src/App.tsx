import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import ChangePassword from "./pages/AuthPages/ChangePassword";
import ForgotPassword from "./pages/AuthPages/ForgotPassword";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import NotFound from "./pages/OtherPage/NotFound";

import ScanPage from "./pages/Scan/ScanPage";

import UserProfiles from "./pages/UserProfiles";
import Calendar from "./pages/Calendar";
import Blank from "./pages/Blank";
import FormElements from "./pages/Forms/FormElements";
import BasicTables from "./pages/Tables/BasicTables";
import Alerts from "./pages/UiElements/Alerts";
import Avatars from "./pages/UiElements/Avatars";
import Badges from "./pages/UiElements/Badges";
import Buttons from "./pages/UiElements/Buttons";
import Images from "./pages/UiElements/Images";
import Videos from "./pages/UiElements/Videos";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";

import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

// guards (JSX)
import AuthGuard from "./guards/AuthGuard.jsx";
import GuestGuard from "./guards/GuestGuard.jsx";
import RoleGuard from "./guards/RoleGuard.jsx";
import PermissionGuard from "./guards/PermissionGuard.jsx";
import ForcePasswordChangeGuard from "./guards/ForcePasswordChangeGuard.jsx";

// modules metier
import PaiementsList from "./pages/Paiements/PaiementsList";
import PaiementDetail from "./pages/Paiements/PaiementDetail";
import PaiementsPending from "./pages/Paiements/PaiementsPending";
import DemandesAllList from "./pages/Demandes/DemandesAllList";
import DemandesMyList from "./pages/Demandes/DemandesMyList";
import DemandeDetail from "./pages/Demandes/DemandeDetail";
import CreateDemande from "./pages/Demandes/CreateDemande";
import ValidationsDone from "./pages/Validations/ValidationsDone";
import ValidationsPending from "./pages/Validations/ValidationsPending";
import ValidationDetail from "./pages/Validations/ValidationDetail";
import ReceptionsList from "./pages/Receptions/ReceptionsList";
import ReceptionDetail from "./pages/Receptions/ReceptionDetail";
import SignatureTest from "./pages/Tests/SignatureTest";

// admin
import PeopleAdmin from "./pages/Admin/PeopleAdmin";
import DelegationsAdmin from "./pages/Admin/DelegationsAdmin";
import DirectionsAdmin from "./pages/Admin/DirectionsAdmin";
import DepartementsAdmin from "./pages/Admin/DepartementsAdmin";
import ServicesAdmin from "./pages/Admin/ServicesAdmin";


// (optionnel) page 403
const Forbidden = () => (
  <div className="p-6">
    <h1 className="text-xl font-semibold">403 - Acces refuse</h1>
    <p className="text-sm text-gray-500 mt-2">Vous n'avez pas les droits pour acceder a cette page.</p>
  </div>
);

export default function App() {
  return (
    <Router>
      <ScrollToTop />

      <Routes>
        {/* ---------------- PUBLIC SCAN (QR) ---------------- */}
        <Route path="/scan" element={<ScanPage />} />

        {/* ---------------- AUTH (guest only) ---------------- */}
        <Route element={<GuestGuard />}>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* ---------------- APP (auth required) ---------------- */}
        <Route element={<AuthGuard />}>
          <Route element={<ForcePasswordChangeGuard />}>
            <Route element={<AppLayout />}>
              {/* Home accessible a tous les connectes */}
              <Route index path="/" element={<Home />} />

              <Route path="/change-password" element={<ChangePassword />} />

              {/* Exemple pages communes */}
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/blank" element={<Blank />} />

              {/* ---------------- MODULES METIER PROTEGES PAR PERMISSIONS ---------------- */}

              {/* Paiements */}
              <Route element={<PermissionGuard allow={["PAIEMENT_LIST"]} />}>
                <Route path="/paiements" element={<PaiementsList />} />
                <Route path="/paiements/done" element={<PaiementsList />} />
                <Route path="/paiements/pending" element={<PaiementsPending />} />
              </Route>
              <Route element={<PermissionGuard allow={["PAIEMENT_GET"]} />}>
                <Route path="/paiements/:uuid" element={<PaiementDetail />} />
              </Route>

              {/* Receptions */}
              <Route element={<PermissionGuard allow={["RECEPTION_LIST_SELF", "RECEPTION_LIST_ALL", "RECEPTION_LIST"]} />}>
                <Route path="/receptions" element={<ReceptionsList mode="all" />} />
                <Route path="/receptions/done" element={<ReceptionsList mode="done" />} />
                <Route path="/receptions/pending" element={<ReceptionsList mode="pending" />} />
                <Route path="/receptions/:uuid" element={<ReceptionDetail />} />
              </Route>

              {/* Demandes */}
              <Route element={<PermissionGuard allow={["DEMANDE_LIST", "DEMANDE_LIST_ALL"]} />}>
                <Route path="/demandes/all" element={<DemandesAllList />} />
              </Route>
              <Route element={<PermissionGuard allow={["DEMANDE_LIST_SELF"]} />}>
                <Route path="/demandes/my" element={<DemandesMyList />} />
              </Route>
              <Route element={<PermissionGuard allow={["DEMANDE_LIST", "DEMANDE_LIST_ALL", "DEMANDE_LIST_SELF", "VALIDATION_LIST_PENDING", "VALIDATION_LIST_DONE"]} />}>
                <Route path="/demandes/:uuid" element={<DemandeDetail />} />
              </Route>
              <Route element={<PermissionGuard allow={["DEMANDE_CREATE"]} />}>
                <Route path="/demandes/create" element={<CreateDemande />} />
              </Route>

              {/* Validations */}
              <Route element={<PermissionGuard allow={["VALIDATION_LIST_PENDING"]} />}>
                <Route path="/validations/pending" element={<ValidationsPending />} />
              </Route>
              <Route element={<PermissionGuard allow={["VALIDATION_LIST_DONE"]} />}>
                <Route path="/validations/done" element={<ValidationsDone />} />
              </Route>
              <Route element={<PermissionGuard allow={["VALIDATION_GET"]} />}>
                <Route path="/validations/:uuid" element={<ValidationDetail />} />
                <Route path="/validations/uuid/:uuid" element={<ValidationDetail />} />
              </Route>

              {/* Tests */}
              <Route element={<PermissionGuard allow={["VALIDATION_APPROVE", "DEMANDE_CREATE"]} />}>
                <Route path="/tests/signature" element={<SignatureTest />} />
              </Route>

              {/* Delegations (non-admin autorise, mais controle cote API) */}
              <Route element={<PermissionGuard allow={["DELEGATIONS_MANAGE"]} />}>
                <Route path="/delegations" element={<DelegationsAdmin />} />
              </Route>
              {/* Admin : pilote par permissions (DB) */}
              <Route element={<PermissionGuard allow={["USERS_MANAGE", "AGENTS_MANAGE"]} />}>
                <Route path="/admin/people" element={<PeopleAdmin />} />
                <Route path="/admin/users" element={<PeopleAdmin />} />
                <Route path="/admin/agents" element={<PeopleAdmin />} />
                <Route path="/admin/hierarchy" element={<PeopleAdmin />} />
              </Route>

              {/* anciennes pages dediees supprimees au profit de la vue unique */}

              <Route element={<PermissionGuard allow={["DIRECTIONS_MANAGE"]} />}>
                <Route path="/admin/directions" element={<DirectionsAdmin />} />
              </Route>

              <Route element={<PermissionGuard allow={["DEPARTEMENTS_MANAGE"]} />}>
                <Route path="/admin/departements" element={<DepartementsAdmin />} />
              </Route>

              <Route element={<PermissionGuard allow={["SERVICES_MANAGE"]} />}>
                <Route path="/admin/services" element={<ServicesAdmin />} />
              </Route>

              {/* Delegations admin screen stays role-based for now */}
              <Route element={<RoleGuard allow={["ADMIN"]} />}>
                <Route path="/admin/delegations" element={<DelegationsAdmin />} />
              </Route>

              {/* ---------------- UI/Template routes (optionnel) ---------------- */}
              <Route path="/form-elements" element={<FormElements />} />
              <Route path="/basic-tables" element={<BasicTables />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/avatars" element={<Avatars />} />
              <Route path="/badge" element={<Badges />} />
              <Route path="/buttons" element={<Buttons />} />
              <Route path="/images" element={<Images />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/line-chart" element={<LineChart />} />
              <Route path="/bar-chart" element={<BarChart />} />

              {/* 403 page (optionnel) */}
              <Route path="/403" element={<Forbidden />} />
            </Route>
          </Route>
        </Route>

        {/* ---------------- fallback ---------------- */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}


import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import ChangePassword from "./pages/AuthPages/ChangePassword";
import ForgotPassword from "./pages/AuthPages/ForgotPassword";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import NotFound from "./pages/OtherPage/NotFound";

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
import ForcePasswordChangeGuard from "./guards/ForcePasswordChangeGuard.jsx";

// modules métier
import PaiementsList from "./pages/Paiements/PaiementsList";
import PaiementDetail from "./pages/Paiements/PaiementDetail";
import DemandesAllList from "./pages/Demandes/DemandesAllList";
import DemandesMyList from "./pages/Demandes/DemandesMyList";
import DemandeDetail from "./pages/Demandes/DemandeDetail";
import CreateDemande from "./pages/Demandes/CreateDemande";
import ValidationsDone from "./pages/Validations/ValidationsDone";
import ValidationsPending from "./pages/Validations/ValidationsPending";
import ValidationDetail from "./pages/Validations/ValidationDetail";
import ReceptionsList from "./pages/Receptions/ReceptionsList";
import ReceptionDetail from "./pages/Receptions/ReceptionDetail";
import BonCommandeDetail from "./pages/BonsCommande/BonCommandeDetail";

// admin
import UsersAdmin from "./pages/Admin/UsersAdmin";
import AgentsAdmin from "./pages/Admin/AgentsAdmin";
import HierarchyAdmin from "./pages/Admin/HierarchyAdmin";
import DelegationsAdmin from "./pages/Admin/DelegationsAdmin";


// (optionnel) page 403
const Forbidden = () => (
  <div className="p-6">
    <h1 className="text-xl font-semibold">403 - Accès refusé</h1>
    <p className="text-sm text-gray-500 mt-2">Vous n’avez pas les droits pour accéder à cette page.</p>
  </div>
);

export default function App() {
  return (
    <Router>
      <ScrollToTop />

      <Routes>
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
              {/* Home accessible à tous les connectés */}
              <Route index path="/" element={<Home />} />

              <Route path="/change-password" element={<ChangePassword />} />

              {/* Exemple pages communes */}
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/blank" element={<Blank />} />

            {/* ---------------- MODULES METIER PROTEGES PAR ROLES ---------------- */}

              {/* Paiements/Réceptions : COMPTABLE + DAF + DIRECTEUR + ADMIN */}
              <Route element={<RoleGuard allow={["COMPTABLE", "DAF", "DIRECTEUR", "ADMIN"]} />}>
                <Route path="/paiements" element={<PaiementsList />} />
                <Route path="/paiements/:uuid" element={<PaiementDetail />} />
                <Route path="/receptions" element={<ReceptionsList />} />
                <Route path="/receptions/:uuid" element={<ReceptionDetail />} />
              </Route>

              {/* Demandes (toutes) : DIRECTEUR + DG + DGA + DAF + ADMIN */}
              <Route element={<RoleGuard allow={["RESPONSABLE","DEMANDEUR", "DIRECTEUR", "DG", "DGA", "DAF", "ADMIN", "COMPTABLE"]} />}>
                <Route path="/demandes/all" element={<DemandesAllList />} />
                <Route path="/demandes/my" element={<DemandesMyList />} />
                <Route path="/demandes/:uuid" element={<DemandeDetail />} />
                <Route path="/demandes/create" element={<CreateDemande />} />
              </Route>

              {/* Bons de commande : DEMANDEUR/RESPONSABLE/... */}
              <Route element={<RoleGuard allow={["DEMANDEUR", "RESPONSABLE", "DIRECTEUR", "DAF", "DGA", "DG", "ADMIN"]} />}>
                <Route path="/bons-commande/:uuid" element={<BonCommandeDetail />} />
              </Route>

              {/* Validations : RESPONSABLE + DIRECTEUR + DG + DGA + DAF + ADMIN */}
              <Route element={<RoleGuard allow={["RESPONSABLE", "DIRECTEUR", "DG", "DGA", "DAF", "ADMIN"]} />}>
                <Route path="/validations/pending" element={<ValidationsPending />} />
                <Route path="/validations/done" element={<ValidationsDone />} />
                <Route path="/validations/uuid/:uuid" element={<ValidationDetail />} />
              </Route>

              {/* Délégations (non-admin autorisé, mais contrôlé côté API) */}
              <Route element={<RoleGuard allow={["RESPONSABLE", "DIRECTEUR", "DG", "DGA", "DAF", "ADMIN"]} />}>
                <Route path="/delegations" element={<DelegationsAdmin />} />
              </Route>

              {/* Admin : ADMIN only */}
              <Route element={<RoleGuard allow={["ADMIN"]} />}>
                <Route path="/admin/users" element={<UsersAdmin />} />
                <Route path="/admin/hierarchy" element={<HierarchyAdmin />} />
                <Route path="/admin/agents" element={<AgentsAdmin />} />
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

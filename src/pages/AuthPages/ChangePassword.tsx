import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

import { changePassword as apiChangePassword } from "../../services/auth.service";
import { useAuth } from "../../context/AuthContext.jsx";
import { setAuth } from "../../services/auth.service";
import { consumePostLoginRedirect, getRedirectFromSearch, setPostLoginRedirect } from "../../utils/postLoginRedirect";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
  }
  return fallback;
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, refreshMe } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!oldPassword || !newPassword) {
      setErrorMsg("Veuillez renseigner l'ancien et le nouveau mot de passe.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirm) {
      setErrorMsg("La confirmation ne correspond pas.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiChangePassword({ oldPassword, newPassword });
      if (!res?.success) throw new Error(res?.message || "Erreur changement mot de passe");

      const payload = res.data;
      const next = {
        ...(auth || {}),
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
        mustChangePassword: false,
      };

      setAuth(next);
      await refreshMe();

      const redirectFromQuery = getRedirectFromSearch(location.search);
      if (redirectFromQuery) {
        setPostLoginRedirect(redirectFromQuery);
      }
      const redirectTarget = consumePostLoginRedirect("/");
      navigate(redirectTarget, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, "Impossible de changer le mot de passe."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="Changer mot de passe" description="Changer votre mot de passe" />
      <PageBreadcrumb pageTitle="Changer mot de passe" />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Changer mot de passe
        </h3>

        {auth?.mustChangePassword ? (
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Première connexion : vous devez changer votre mot de passe.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="max-w-xl space-y-5">
          {errorMsg ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {errorMsg}
            </div>
          ) : null}

          <div>
            <Label>Ancien mot de passe</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div>
            <Label>Nouveau mot de passe</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <Label>Confirmer le nouveau mot de passe</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="pt-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

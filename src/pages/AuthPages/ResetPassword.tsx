import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { resetPassword } from "../../services/auth.service";
import { emitToast } from "../../services/toastBus";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
  }
  return fallback;
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!token || token.length < 10) {
      setErrorMsg("Lien invalide ou expiré.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setErrorMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirm) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setSubmitting(true);
      await resetPassword({ token, newPassword });
      emitToast({
        variant: "success",
        title: "Mot de passe mis à jour",
        message: "Vous pouvez maintenant vous connecter.",
      });
      navigate("/signin", { replace: true });
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, "Impossible de réinitialiser le mot de passe."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="Réinitialiser le mot de passe" description="Réinitialisation mot de passe" />
      <AuthLayout>
        <div className="flex flex-col flex-1">
          <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
            <div>
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                  Réinitialiser le mot de passe
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choisissez un nouveau mot de passe.
                </p>
              </div>

              <form onSubmit={onSubmit}>
                <div className="space-y-6">
                  {errorMsg ? (
                    <div className="px-4 py-3 text-sm rounded-lg bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-200">
                      {errorMsg}
                    </div>
                  ) : null}

                  <div>
                    <Label>
                      Nouveau mot de passe <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="password"
                      placeholder="Au moins 8 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <Label>
                      Confirmer <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="password"
                      placeholder="Répétez le mot de passe"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <Button className="w-full" size="sm" disabled={submitting} type="submit">
                      {submitting ? "Mise à jour..." : "Mettre à jour"}
                    </Button>
                  </div>

                  <div className="text-center">
                    <Link
                      to="/signin"
                      className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      Retour à la connexion
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}

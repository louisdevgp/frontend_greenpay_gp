import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { forgotPassword } from "../../services/auth.service";
import { emitToast } from "../../services/toastBus";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
  }
  return fallback;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim()) {
      setErrorMsg("Veuillez renseigner votre email.");
      return;
    }

    try {
      setSubmitting(true);
      await forgotPassword({ email: email.trim() });
      emitToast({
        variant: "success",
        title: "Email envoyé",
        message: "Si un compte existe, vous recevrez un lien de réinitialisation.",
      });
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, "Impossible d'envoyer l'email."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="Mot de passe oublié" description="Réinitialisation mot de passe" />
      <AuthLayout>
        <div className="flex flex-col flex-1">
          <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
            <div>
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                  Mot de passe oublié
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Saisissez votre email pour recevoir un lien de réinitialisation.
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
                      Email <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      placeholder="nom.prenom@entreprise.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <Button className="w-full" size="sm" disabled={submitting} type="submit">
                      {submitting ? "Envoi..." : "Envoyer le lien"}
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

import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";

import { useAuth } from "../../context/AuthContext.jsx";
import {
  buildChangePasswordRedirectUrl,
  consumePostLoginRedirect,
  getRedirectFromSearch,
} from "../../utils/postLoginRedirect";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
  }
  return fallback;
}

export default function SignInForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth() as {
    login: (args: { email: string; password: string; persist: boolean }) => Promise<{ mustChangePassword?: boolean }>;
  };

  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Veuillez renseigner le login et le mot de passe.");
      return;
    }

    try {
      setSubmitting(true);
      const next = await login({
        email: email.trim(),
        password,
        persist: false,
      });
      const storedRedirect = consumePostLoginRedirect("/");
      const redirectTo = getRedirectFromSearch(location.search) || storedRedirect;

      if (next?.mustChangePassword) {
        navigate(buildChangePasswordRedirectUrl(redirectTo), { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err: unknown) {
      setErrorMsg(
        getErrorMessage(
          err,
          "Connexion impossible. Vérifiez vos identifiants et réessayez.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Connexion
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Saisissez votre login et votre mot de passe.
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
                  Login <span className="text-error-500">*</span>
                </Label>
                <Input
                  placeholder="ex: nom.prenom@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <Label>
                  Mot de passe <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    role="button"
                    tabIndex={0}
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <div>
                <Button className="w-full" size="sm" disabled={submitting} type="submit">
                  {submitting ? "Connexion..." : "Connexion"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

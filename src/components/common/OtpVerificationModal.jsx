import React, { useEffect, useState } from "react";
import { OTP_GATE_EVENT, otpVerified, otpCancelled } from "../../services/otpGate";
import { requestOtp, verifyOtp } from "../../services/otp.service";

export default function OtpVerificationModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = async () => {
      setCode("");
      setError(null);
      setSent(false);
      setOpen(true);
      // Envoi automatique du code à l'ouverture
      setLoading(true);
      try {
        await requestOtp();
        setSent(true);
      } catch (err) {
        setError(err.message || "Impossible d'envoyer le code");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener(OTP_GATE_EVENT, handler);
    return () => window.removeEventListener(OTP_GATE_EVENT, handler);
  }, []);

  async function handleResend() {
    setLoading(true);
    setError(null);
    try {
      await requestOtp();
      setSent(true);
      setCode("");
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(code);
      otpVerified();
      setOpen(false);
    } catch (err) {
      setError(err.message || "Code incorrect");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    otpCancelled();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        {/* En-tête */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Vérification de sécurité
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sent
              ? "Un code à 6 chiffres a été envoyé à votre adresse email."
              : "Envoi du code en cours…"}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Requis une fois par semaine avant toute signature.
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Saisie du code */}
        <div className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && !loading && code.length === 6 && handleVerify()}
            disabled={loading || !sent}
            autoFocus
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Vérification…" : "Valider le code"}
          </button>
        </div>

        {/* Renvoyer */}
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <button
            onClick={handleResend}
            disabled={loading}
            className="hover:text-gray-600 dark:hover:text-gray-300 underline disabled:opacity-50"
          >
            Renvoyer le code
          </button>
          <button
            onClick={handleCancel}
            className="hover:text-gray-600 dark:hover:text-gray-300"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

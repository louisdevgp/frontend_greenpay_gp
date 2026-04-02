import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyQrToken } from "../../services/qr.service";
import { useAuth } from "../../context/AuthContext.jsx";

function Pill({ children, variant = "gray" }) {
  const cls =
    variant === "green"
      ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-200"
      : variant === "red"
        ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-200"
        : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/80";

  return <span className={`inline-flex px-2 py-1 text-xs rounded-md ${cls}`}>{children}</span>;
}

function formatIso(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function ScanPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const hasToken = useMemo(() => !!String(token).trim(), [token]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!hasToken) return;
      setLoading(true);
      setError("");
      try {
        const res = await verifyQrToken(token);
        if (!alive) return;
        if (!res?.success) throw new Error(res?.message || "Vérification impossible");
        setResult(res.data);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Erreur réseau");
        setResult(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [token, hasToken]);

  const type = result?.type;
  const uuid = result?.uuid;
  const valid = result?.valid;

  const detailHref =
    type === "demande"
      ? `/demandes/${uuid}`
      : type === "reception"
        ? `/receptions/${uuid}`
        : type === "validation"
          ? `/validations/${uuid}`
          : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl px-4 py-10 mx-auto">
        <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Vérification QR</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Ce QR code correspond à un document GreenPay (Demande, Réception ou Validation).
              </p>
            </div>
            <Link
              to={isAuthenticated ? "/" : "/signin"}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              {isAuthenticated ? "Retour" : "Se connecter"}
            </Link>
          </div>

          {!hasToken ? (
            <div className="mt-6 px-4 py-3 text-sm rounded-lg bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-200">
              Token manquant dans l’URL. Ouvrez le lien complet issu du QR code.
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-gray-600 dark:text-gray-300">Vérification en cours…</div>
          ) : null}

          {error ? (
            <div className="mt-6 px-4 py-3 text-sm rounded-lg bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-200">
              {error}
            </div>
          ) : null}

          {result && !loading ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {valid ? <Pill variant="green">QR valide</Pill> : <Pill variant="red">QR invalide</Pill>}
                {type ? <Pill>{String(type).toUpperCase()}</Pill> : null}
                {result?.scope ? <Pill>{result.scope}</Pill> : null}
              </div>

              {valid ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">UUID</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white break-all">{uuid}</div>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Réf signature</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{result?.ref || "-"}</div>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {type === "validation" ? "Signé le" : "Finalisé le"}
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {formatIso(result?.validatedAt || result?.finalizedAt)}
                    </div>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Statut</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {type === "validation"
                        ? `${result?.role || "-"} — ${result?.status || "-"}`
                        : result?.document?.statut || (result?.isFinal ? "final" : "non-final")}
                    </div>
                  </div>
                  {type === "validation" ? (
                    <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID signature</div>
                      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white break-all">
                        {result?.signature_id || "-"}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Raison</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{result?.reason || "-"}</div>
                </div>
              )}

              {valid && type === "demande" ? (
                <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Validations</div>
                  <div className="mt-3 space-y-2">
                    {(result?.approvals || []).length ? (
                      result.approvals.map((a, idx) => (
                        <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <div className="text-gray-900 dark:text-white">
                            {a?.role || "-"} — <span className="text-gray-500 dark:text-gray-400">{a?.status || "-"}</span>
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">{formatIso(a?.validated_at)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">Aucune validation trouvée.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {valid && type === "reception" ? (
                <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Visas</div>
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-200">
                    <div>Visa Directeur: {result?.visas?.visa_directeur ? "OK" : "-"}</div>
                    <div>Visa DAF: {result?.visas?.visa_daf ? "OK" : "-"}</div>
                  </div>
                </div>
              ) : null}

              {valid && detailHref ? (
                <div className="flex flex-wrap items-center gap-3">
                  {isAuthenticated ? (
                    <Link
                      to={detailHref}
                      className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700"
                    >
                      Ouvrir dans l’application
                    </Link>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Connectez-vous pour accéder au détail du document.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}



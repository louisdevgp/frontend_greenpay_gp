import { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import Button from "../../components/ui/button/Button";
import { emitToast } from "../../services/toastBus";
import { useAuth } from "../../context/AuthContext";
import { listFirmaWebhookEvents } from "../../services/firmaWebhooks.service";

const DEFAULT_VALIDATORS = [
  { role: "RESPONSABLE", label: "Responsable" },
  { role: "DIRECTEUR", label: "Directeur" },
  { role: "DAF", label: "DAF" },
  { role: "DG", label: "DG" },
];

function makeUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso || "-";
  }
}

function buildDefaultSignature(user, validatorLabel) {
  const agent = user?.agent || null;
  return {
    nom: user?.nom || "",
    prenom: user?.prenom || "",
    email: user?.email || "",
    fonction: validatorLabel || user?.primaryRole || agent?.roles?.name || "",
    direction: agent?.directions?.nom || "",
    departement: agent?.departements?.nom || "",
    service: agent?.services?.nom || "",
  };
}

export default function SignatureTest() {
  const { user } = useAuth();
  const { isOpen, openModal, closeModal } = useModal(false);
  const [activeIndex, setActiveIndex] = useState(null);

  const [demande, setDemande] = useState(null);
  const [validators, setValidators] = useState(
    DEFAULT_VALIDATORS.map((v) => ({
      ...v,
      status: "pending",
      signedAt: null,
      signature: null,
    }))
  );
  const [signatureDraft, setSignatureDraft] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const signerDefaults = useMemo(() => buildDefaultSignature(user, ""), [user]);

  const loadWebhookEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await listFirmaWebhookEvents();
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      emitToast({
        variant: "error",
        title: "Webhooks",
        message: e?.message || "Impossible de charger les webhooks.",
      });
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    loadWebhookEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSimulation = () => {
    setDemande(null);
    setValidators(
      DEFAULT_VALIDATORS.map((v) => ({
        ...v,
        status: "pending",
        signedAt: null,
        signature: null,
      }))
    );
    setEvents([]);
  };

  const simulateDemande = () => {
    const now = new Date().toISOString();
    setDemande({
      uuid: makeUuid(),
      objet: "Demande test - Fournitures",
      montant: "1 250 000",
      devise: "XOF",
      createdAt: now,
      demandeur: "Demandeur Test",
    });
  };

  const openSignatureFor = (index) => {
    if (!demande) {
      emitToast({
        variant: "warning",
        title: "Demande manquante",
        message: "Simulez d'abord une demande avant de valider.",
      });
      return;
    }
    const validator = validators[index];
    setActiveIndex(index);
    setSignatureDraft({
      ...signerDefaults,
      fonction: validator?.label || signerDefaults.fonction,
    });
    openModal();
  };

  const closeSignatureModal = () => {
    setActiveIndex(null);
    setSignatureDraft(null);
    closeModal();
  };

  const handleValidateSignature = () => {
    if (activeIndex == null || !signatureDraft) return;
    const required = ["nom", "prenom", "email", "fonction"];
    const missing = required.filter((k) => !String(signatureDraft?.[k] || "").trim());
    if (missing.length) {
      emitToast({
        variant: "warning",
        title: "Champs manquants",
        message: "Nom, prénom, email et fonction sont requis.",
      });
      return;
    }

    setValidators((prev) =>
      prev.map((v, idx) =>
        idx === activeIndex
          ? {
              ...v,
              status: "signed",
              signedAt: new Date().toISOString(),
              signature: { ...signatureDraft },
            }
          : v
      )
    );

    emitToast({
      variant: "success",
      title: "Validation enregistrée",
      message: `${validators[activeIndex]?.label || "Validateur"} a validé.`,
    });

    closeSignatureModal();
  };

  return (
    <div>
      <PageMeta title="Test signatures électroniques" description="Page de test validation interne" />
      <PageBreadcrumb pageTitle="Test signature électronique" />

      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Validation = signature (sans canvas)
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ici, la signature est composée des informations du validateur (nom, email, fonction,
            direction, département, service). La validation constitue la signature.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Demande simulée</h4>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={resetSimulation}>
                  Réinitialiser
                </Button>
                <Button size="sm" onClick={simulateDemande}>
                  Simuler une demande
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              {demande ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">UUID</span>
                    <span className="font-mono text-xs">{demande.uuid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Objet</span>
                    <span>{demande.objet}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Montant</span>
                    <span>
                      {demande.montant} {demande.devise}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Demandeur</span>
                    <span>{demande.demandeur}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Créée le</span>
                    <span>{formatDate(demande.createdAt)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  Cliquez sur “Simuler une demande” pour démarrer.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Circuit de validation</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              La validation enregistre l’identité du signataire (pas de canvas).
            </p>

            <div className="mt-4 space-y-3">
              {validators.map((v, idx) => {
                const statusClass =
                  v.status === "signed"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";

                return (
                  <div key={v.role} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-white/90">{v.label}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`rounded-full px-2 py-0.5 ${statusClass}`}>
                            {v.status === "signed" ? "Signé" : "En attente"}
                          </span>
                          {v.signedAt ? <span>le {formatDate(v.signedAt)}</span> : null}
                        </div>
                      </div>
                      <Button size="sm" variant={v.status === "signed" ? "outline" : "primary"} onClick={() => openSignatureFor(idx)}>
                        {v.status === "signed" ? "Modifier" : "Valider"}
                      </Button>
                    </div>

                    {v.signature ? (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        <div className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <span className="text-gray-400">Nom:</span> {v.signature.prenom} {v.signature.nom}
                          </div>
                          <div>
                            <span className="text-gray-400">Email:</span> {v.signature.email}
                          </div>
                          <div>
                            <span className="text-gray-400">Fonction:</span> {v.signature.fonction}
                          </div>
                          <div>
                            <span className="text-gray-400">Direction:</span> {v.signature.direction || "-"}
                          </div>
                          <div>
                            <span className="text-gray-400">Département:</span> {v.signature.departement || "-"}
                          </div>
                          <div>
                            <span className="text-gray-400">Service:</span> {v.signature.service || "-"}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Derniers webhooks Firma
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Liste en mémoire (session backend). Rafraîchir pour voir les nouveaux événements.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={loadWebhookEvents} disabled={eventsLoading}>
              {eventsLoading ? "Chargement..." : "Rafraîchir"}
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                Aucun webhook reçu pour le moment.
              </div>
            ) : (
              events.map((evt, idx) => (
                <div key={`${evt.event_id || idx}`} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {evt.event_type || "event"}
                    </span>
                    <span>{evt.received_at ? formatDate(evt.received_at) : "-"}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                    <div>
                      <span className="text-gray-400">Event ID:</span> {evt.event_id || "-"}
                    </div>
                    <div>
                      <span className="text-gray-400">Delivery:</span> {evt.delivery_id || "-"}
                    </div>
                    <div>
                      <span className="text-gray-400">Request ID:</span> {evt.signing_request_id || "-"}
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span> {evt.status || "-"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeSignatureModal} className="max-w-[720px] m-4">
        <div className="p-6">
          <div className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Validation {activeIndex != null ? `- ${validators[activeIndex]?.label}` : ""}
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Renseignez l’identité du signataire. La validation fait foi.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Nom
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.nom || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, nom: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Prénom
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.prenom || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, prenom: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Email
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.email || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, email: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Fonction
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.fonction || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, fonction: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Direction
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.direction || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, direction: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Département
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.departement || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, departement: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Service
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                value={signatureDraft?.service || ""}
                onChange={(e) => setSignatureDraft((s) => ({ ...s, service: e.target.value }))}
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={closeSignatureModal}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleValidateSignature}>
              Valider
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

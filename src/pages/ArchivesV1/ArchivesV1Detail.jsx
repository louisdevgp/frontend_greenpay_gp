import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import Loader from "../../components/common/Loader";
import DocumentFileIcon from "../../components/common/DocumentFileIcon";
import { getArchivesV1Demande } from "../../services/archivesV1.service";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import {
  demandeStatusBadgeClass,
  labelDemandeStatut,
  labelValidationStepStatus,
} from "../../utils/statusLabels";

function fileNameFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || raw);
  } catch {
    return raw.split(/[\\/]/).pop() || raw;
  }
}

function normalizeDoc(doc, fallbackType = "document") {
  const url = doc?.url || doc?.fichier || doc?.demande_physique_signee_url || doc?.fichiers_paiement || "";
  const name = doc?.nom_fichier || fileNameFromUrl(url) || fallbackType;
  return {
    id: doc?.id || `${fallbackType}-${url || name}`,
    type: doc?.type || doc?.type_document || fallbackType,
    url,
    name,
    date: doc?.date_ajout || doc?.date_creation || doc?.date_paiement,
  };
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value || "-"}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DocumentsGrid({ documents, emptyLabel = "Aucun document." }) {
  if (!documents?.length) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {documents.map((doc) => (
        <a
          key={`${doc.id}-${doc.url || doc.name}`}
          href={doc.url || "#"}
          target={doc.url ? "_blank" : undefined}
          rel={doc.url ? "noreferrer" : undefined}
          onClick={(e) => {
            if (!doc.url) e.preventDefault();
          }}
          className="flex min-w-[240px] max-w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
        >
          <DocumentFileIcon fileName={doc.name} url={doc.url} format={doc.type} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{doc.name}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{doc.type || "document"}</span>
            {doc.date ? (
              <span className="block text-xs text-gray-500 dark:text-gray-400">{formatDateTime(doc.date)}</span>
            ) : null}
          </span>
          {doc.url ? <FiExternalLink className="shrink-0 text-gray-400" /> : null}
        </a>
      ))}
    </div>
  );
}

export default function ArchivesV1Detail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getArchivesV1Demande(id);
        if (!active) return;
        if (!res?.success) throw new Error(res?.message || "Erreur chargement archive V1");
        setData(res.data || null);
      } catch (e) {
        if (active) {
          setError(e?.message || "Erreur inconnue");
          setData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [id]);

  const demande = data?.demande;

  const proformas = useMemo(
    () => (data?.proformas || []).map((doc) => normalizeDoc(doc, "proforma")),
    [data?.proformas]
  );

  const paiementDocuments = useMemo(() => {
    const docs = [];
    (data?.paiements || []).forEach((paiement) => {
      if (paiement.fichiers_paiement) {
        docs.push(normalizeDoc({ ...paiement, url: paiement.fichiers_paiement }, "paiement"));
      }
      (paiement.documents || []).forEach((doc) => docs.push(normalizeDoc(doc, doc?.type || "paiement")));
    });
    return docs;
  }, [data?.paiements]);

  const demandeDocuments = useMemo(() => {
    if (!demande?.demande_physique_signee_url) return [];
    return [
      normalizeDoc(
        {
          id: "fiche-signee",
          url: demande.demande_physique_signee_url,
          nom_fichier: "Demande physique signee",
          date_ajout: demande.date_creation,
        },
        "fiche signee"
      ),
    ];
  }, [demande]);

  const preuvesAchat = useMemo(
    () => (data?.achat?.preuves || []).map((doc) => normalizeDoc(doc, doc?.type || "preuve achat")),
    [data?.achat]
  );

  if (loading) {
    return (
      <div className="p-4">
        <Loader label="Chargement de l'archive..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/archives-v1/demandes" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <FiArrowLeft />
          Retour aux archives
        </Link>
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!demande) {
    return (
      <div className="space-y-4">
        <Link to="/archives-v1/demandes" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <FiArrowLeft />
          Retour aux archives
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Demande V1 introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/archives-v1/demandes" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <FiArrowLeft />
            Retour aux archives
          </Link>
          <div className="mt-3 inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Archive V1 - lecture seule
          </div>
          <h1 className="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">
            Demande V1 #{demande.id}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{demande.motif || "-"}</p>
        </div>
        <span className={`whitespace-nowrap rounded px-3 py-1 text-xs ${demandeStatusBadgeClass(demande.statut)}`}>
          {labelDemandeStatut(demande.statut)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <InfoCard label="Montant" value={`${formatMoney(demande.montant)} FCFA`} />
        <InfoCard label="Beneficiaire" value={demande.beneficiaire} />
        <InfoCard label="Date creation" value={formatDateTime(demande.date_creation)} />
        <InfoCard label="Proforma requise" value={demande.requiert_proforma ? "Oui" : "Non"} />
      </div>

      <Section title="Informations demandeur">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoCard label="Demandeur V1" value={demande.agent_nom} />
          <InfoCard label="Fonction" value={demande.agent_fonction} />
          <InfoCard label="Superieur" value={demande.superieur_nom} />
          <InfoCard label="Entite" value={demande.entite_nom} />
          <InfoCard label="Section" value={demande.section_nom} />
          <InfoCard label="ID agent V1" value={demande.agent_id ? `#${demande.agent_id}` : "-"} />
        </div>
        {demande.note ? (
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Note</div>
            {demande.note}
          </div>
        ) : null}
      </Section>

      <Section title="Documents de la demande">
        <DocumentsGrid documents={[...demandeDocuments, ...proformas]} emptyLabel="Aucune piece de demande dans l'archive." />
      </Section>

      <Section title="Parcours de validation V1">
        {!data.validations?.length ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Aucune validation V1 trouvee.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Valideur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Fonction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {data.validations.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{v.valideur_nom || `Agent #${v.valideur_id}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{v.valideur_fonction || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{labelValidationStepStatus(v.statut)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(v.date_validation)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{v.commentaire || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Paiements V1">
        {!data.paiements?.length ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Aucun paiement V1 trouve.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Moyen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {data.paiements.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-white/90">#{p.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{p.moyen_paiement || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(p.date_paiement)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{p.documents?.length || (p.fichiers_paiement ? 1 : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4">
          <DocumentsGrid documents={paiementDocuments} emptyLabel="Aucun document de paiement archive." />
        </div>
      </Section>

      <Section title="Achat V1">
        {!data.achat ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Aucun achat V1 trouve.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoCard label="Acheteur" value={data.achat.acheteur_nom || `Agent #${data.achat.acheteur_id}`} />
              <InfoCard label="Fonction" value={data.achat.acheteur_fonction} />
              <InfoCard label="Date achat" value={formatDateTime(data.achat.date_achat)} />
            </div>
            {data.achat.commentaire ? (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">
                {data.achat.commentaire}
              </div>
            ) : null}
            <DocumentsGrid documents={preuvesAchat} emptyLabel="Aucune preuve d'achat archivee." />
          </div>
        )}
      </Section>
    </div>
  );
}

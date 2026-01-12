import { api } from "./api";

/**
 * Upload 1 document (backend attend multer.array("files"))
 * body:
 * - type_document (required)
 * - demande_id (optional)
 * - reception_id (optional)
 * - paiement_id (optional)
 * - bon_commande_id (optional)
 */
export async function uploadOneDocument({ file, type_document, demande_id, reception_id, paiement_id, bon_commande_id }) {
  const form = new FormData();
  form.append("files", file);
  form.append("type_document", type_document);

  if (demande_id != null) form.append("demande_id", String(demande_id));
  if (reception_id != null) form.append("reception_id", String(reception_id));
  if (paiement_id != null) form.append("paiement_id", String(paiement_id));
  if (bon_commande_id != null) form.append("bon_commande_id", String(bon_commande_id));

  // ⚠️ adapte le path exact selon ta route Express
  const res = await api.post("/documents/upload", form);
  return res.data; // { success, data: document }
}

/**
 * Upload multiple documents (boucle car backend 1 fichier par call)
 */
export async function uploadManyDocuments({ files = [], type_document, demande_id, reception_id, paiement_id, bon_commande_id }) {
  const uploaded = [];
  for (const f of files) {
    const r = await uploadOneDocument({
      file: f,
      type_document,
      demande_id,
      reception_id,
      paiement_id,
      bon_commande_id,
    });
    if (!r?.success) throw new Error(r?.message || "Upload document échoué");
    uploaded.push(r.data);
  }
  return { success: true, data: uploaded };
}

/**
 * Liste documents (filtres optionnels)
 */
export async function listDocuments(filters = {}) {
  // exemple: /documents?demande_id=1&paiement_id=2&type_document=preuve_paiement
  const res = await api.get("/documents", { params: filters });
  return res.data;
}

/**
 * Supprimer un document (hard delete côté backend)
 */
export async function deleteDocument(id) {
  const res = await api.delete(`/documents/${id}`);
  return res.data;
}

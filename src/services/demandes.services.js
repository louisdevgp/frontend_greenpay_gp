import { api } from "./api";

// Mes demandes (demandeur)
export async function listMyDemandes(params = {}) {
  const res = await api.get("/demandes/my", { params });
  return res.data; // { success, data: [...] }
}

// Toutes les demandes (directeur/dg/daf/comptable)
export async function listAllDemandes(params = {}) {
  const res = await api.get("/demandes", { params });
  return res.data;
}

// Détail par UUID (tu as déjà ce format dans ton paiement detail)
export async function getDemande(uuid) {
  const res = await api.get(`/demandes/${uuid}`);
  return res.data; // { success, data: {...} }
}

// Create demande (sans documents ici; proforma/devis via documents API)
export async function createDemande(payload) {
  const res = await api.post("/demandes", payload);
  return res.data;
}

// Update demande
export async function updateDemande(uuid, payload) {
  const res = await api.put(`/demandes/${uuid}`, payload);
  return res.data;
}

// Soft delete (si ton backend fait delete logique)
export async function deleteDemande(uuid) {
  const res = await api.delete(`/demandes/${uuid}`);
  return res.data;
}

// GET /documents?demande_id=1&type_document=proforma
export async function listDocuments(params = {}) {
  const res = await api.get("/documents", { params });
  return res.data; // { success, data: [...] }
}

// POST /documents/upload (multipart)
export async function uploadDocument({ file, demande_id, paiement_id, reception_id, bon_commande_id, type_document }) {
  const formData = new FormData();
  formData.append("file", file);
  if (demande_id != null) formData.append("demande_id", String(demande_id));
  if (paiement_id != null) formData.append("paiement_id", String(paiement_id));
  if (reception_id != null) formData.append("reception_id", String(reception_id));
  if (bon_commande_id != null) formData.append("bon_commande_id", String(bon_commande_id));
  formData.append("type_document", type_document);

  const res = await api.post("/documents/upload", formData); // ⚠️ adapte si ton endpoint diffère
  return res.data; // { success, data: doc }
}

// Upload plusieurs fichiers (même type)
export async function uploadManyDocuments({ files = [], demande_id, type_document }) {
  const results = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    const r = await uploadDocument({ file: f, demande_id, type_document });
    results.push(r);
  }
  return results;
}

export async function updateDemande(id, payload) {
  const res = await api.put(`/demandes/${id}`, payload);
  return res.data;
}

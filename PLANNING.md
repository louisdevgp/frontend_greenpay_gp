# Planning FRONT (Dashboard)

Objectif: refléter fidèlement la procédure d’achat (Demande → Validations → BC → Réception → Paiement) avec paiement possible **avant** ou **après** réception.

## 0) Baseline (config & auth)
- [x] Vérifier `VITE_API_URL` et accès à `/api/health`
- [x] Vérifier login + persistance du token + `/me`
- [x] Centraliser la gestion des erreurs API (401/403/500) et afficher des messages propres

Note emails:
- Les emails envoyés par le back contiennent des liens profonds vers les pages du dashboard (Demandes/Paiements/Réceptions/Validations/BC).
- Le back utilise `FRONTEND_URL` pour générer ces liens.

## 1) Alignement endpoints (priorité)
- [x] Aligner les endpoints de lecture Paiements/Réceptions sur `/uuid/:uuid` quand l’identifiant n’est pas numérique
- [x] Vérifier que tous les autres services appellent les bons endpoints (documents, BC, validations)
- [x] Uniformiser les réponses attendues `{ success, data, message }`
- [x] Ajouter une gestion cohérente des erreurs (toast/alert + fallback UI)

## 2) Parcours Demande (expression du besoin)
- [x] Écran création: champs + lignes d’items + fournisseur/bénéficiaire
- [x] Règle UI: si fournisseur choisi ⇒ bénéficiaire automatique (champ désactivé)
- [x] Upload pièces à la demande (devis/proforma) via documents API
- [x] Détail demande: afficher `validation_steps` (timeline) + statut courant
- [x] Édition: autoriser seulement tant que la demande n’est pas “engagée” (selon règle back)

## 3) Parcours Validations (RESPONSABLE → DIRECTEUR → DAF → DGA → DG)
- [x] Liste “En attente”: uniquement les étapes assignées à l’utilisateur (validator)
- [x] Délégations: un délégué voit/agit sur les validations dans la période
- [x] Délégations: création/modif/toggle avec notifications email
- [x] Action valider/rejeter: commentaire obligatoire au rejet
- [x] Historique “Validations effectuées”
- [x] Contrôle d’accès: pages/actions selon rôles (RoleGuard + masquage actions)

Note flows (sélectionnés côté back selon le rôle du demandeur):
- DEMANDEUR/COMPTABLE: `FLOW_DEMANDEUR_LAMBDA` (RESPONSABLE → DIRECTEUR → DAF → DGA → DG)
- RESPONSABLE: `FLOW_RESPONSABLE` (DIRECTEUR → DAF → DGA → DG)
- DIRECTEUR: `FLOW_DIRECTEUR` (DAF → DGA → DG)
- DAF: `FLOW_DAF` (DGA → DG)
- DGA: `FLOW_DGA` (DG)
- DG: `FLOW_DG` (DGA)

## 3bis) Délégations (UI)
- [x] Page `/delegations` accessible aux validateurs (contrôlée côté API)
- [x] Page admin `/admin/delegations`
- [x] Interdire la délégation du rôle ADMIN (front + back)

## 4) Parcours Bon de Commande (commande)
- [x] Rendre “Créer BC” disponible seulement si la demande est approuvée
- [x] Gestion des items BC + affichage numéro/statut (minimum via modal + liste dans Détail Demande)
- [x] Lier/afficher les documents BC (si requis)

## 5) Parcours Réception (avant ou après paiement)
- [x] Support optionnel: créer réception depuis un paiement (si paiement avant)
- [x] Permettre la création de réception depuis une Demande/BC (le modal supporte `demande_id` ou `paiement_id`)
- [x] Écran détail réception: conformité + observations + pièces (BL, facture définitive)
- [x] Visas: bouton “Visa Directeur”/“Visa DAF” selon rôles et état

## 6) Parcours Paiement (avant ou après réception)
- [x] Créer paiement depuis une demande (après validations)
- [x] Attacher pièces de paiement (reçu, ordre de virement, etc.)
- [x] Historique + détail paiement + documents

## 7) Génération PDF (Demande / BC / Réception)
- [x] Ajouter des boutons “Télécharger PDF” sur:
	- [x] Détail Demande
	- [x] Détail Bon de commande
	- [x] Détail Réception
- [x] Appeler les endpoints PDF du back et gérer le téléchargement (Blob) + nommage fichier
- [x] Contrôle d’accès UI: masquer le bouton si l’utilisateur n’a pas les droits
- [x] Option: prévisualisation dans un nouvel onglet (selon préférence)

## 8) Robustesse UI (best practices)
- [ ] Retirer logs console inutiles, améliorer loading states
- [x] Normaliser les libellés statuts (soumise, validation_x, approuvee, paye, receptionnee, cloture, rejete)
- [ ] Vérifier navigation/403/404 et protection des routes

## 9) UX Dates
- [x] Remplacer tous les filtres date (listes) par un DatePicker
- [x] Remplacer le filtre mois du dashboard par un DatePicker (format `YYYY-MM`)
- [x] Remplacer les champs date/heure des modals (Paiement/Réception/Délégation/BC) par un DatePicker
- [x] Remplacer les champs date du calendrier par un DatePicker

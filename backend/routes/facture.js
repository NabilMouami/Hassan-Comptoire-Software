// routes/facture.js
const express = require("express");
const router = express.Router();

const {
  getAllFactures,
  getFactureById,
  createFacture,
  createFactureFromBonLivraison,
  updateFacture,
  addPaymentToFacture,
  cancelFacture,
  deleteFacture,
  getFactureStats,
} = require("../controllers/factureController");

// const authMiddleware = require("../middleware/authMiddleware");

// // Appliquer l'authentification à toutes les routes
// router.use(authMiddleware);

// Routes pour les factures
router.get("/", getAllFactures); // Récupérer toutes les factures
router.get("/stats", getFactureStats); // Récupérer les statistiques
router.get("/:id", getFactureById); // Récupérer une facture spécifique

router.post("/", createFacture); // Créer une nouvelle facture
router.post("/from-bonlivraison", createFactureFromBonLivraison); // Créer une facture à partir d'un bon de livraison

router.put("/:id", updateFacture); // Mettre à jour une facture
router.patch("/:id/payment", addPaymentToFacture); // Ajouter un paiement à une facture
router.patch("/:id/cancel", cancelFacture); // Annuler une facture

router.delete("/:id", deleteFacture); // Supprimer une facture

module.exports = router;

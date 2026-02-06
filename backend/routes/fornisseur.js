const express = require("express");
const router = express.Router();
const {
  createFornisseur,
  getAllFornisseurs,
  getFornisseurById,
  updateFornisseur,
  deleteFornisseur,
  searchFornisseurs,
  getFornisseurStats,
  getFornisseurBonAchats, // Add this
  getFornisseurBonAchatsStats, // Add this
  getFornisseurRecentBonAchats,
  getFornisseurProductHistoryByReference,
  getFornisseurPurchasedProductsSummary,
} = require("../controllers/fornisseurController");
// const { authenticateToken } = require("../middleware/authMiddleware");

// // All fornisseur routes require authentication
// router.use(authenticateToken);

// Basic CRUD routes
router.post("/", createFornisseur);
router.get("/", getAllFornisseurs);
router.get("/search", searchFornisseurs);
router.get("/stats", getFornisseurStats);
router.get("/:id", getFornisseurById);
router.put("/:id", updateFornisseur);
router.delete("/:id", deleteFornisseur);
// New routes for BonAchats
router.get("/:id/bon-achats", getFornisseurBonAchats);
router.get("/:id/bon-achats/stats", getFornisseurBonAchatsStats);
router.get("/:id/bon-achats/recent", getFornisseurRecentBonAchats);
router.get("/:id/product-history", getFornisseurProductHistoryByReference);
router.get("/:id/products-summary", getFornisseurPurchasedProductsSummary);
module.exports = router;

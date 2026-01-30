// routes/devis.js
const express = require("express");
const router = express.Router();

const {
  getAllDevis,
  getDevisById,
  createDevis,
  updateDevis,
  updateStatus,
  deleteDevis,
  getStats,
  convertToBonLivraison,
} = require("../controllers/devisController");

// const authMiddleware = require("../middleware/authMiddleware");

// // Appliquer l'authentification à toutes les routes
// router.use(authMiddleware);

// Routes pour les devis
router.get("/", getAllDevis);
router.get("/stats", getStats);
router.get("/:id", getDevisById);
router.post("/", createDevis);
router.put("/:id", updateDevis);
router.patch("/:id/status", updateStatus);
router.post("/:id/convert-to-bl", convertToBonLivraison);
router.delete("/:id", deleteDevis);

module.exports = router;

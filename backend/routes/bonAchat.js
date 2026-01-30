// routes/bonAchatRoutes.js
const express = require("express");
const {
  getAllBonsAchat,
  getStatsAchats,
  getBonsEnAttenteReception,
  getBonAchatById,
  createBonAchat,
  updateBonAchat,
  enregistrerReception,
  marquerPaye,
  annulerBonAchat,
  deleteBonAchat,
} = require("../controllers/bonAchatController");
const router = express.Router();

// Routes pour les bons d'achat
router.get("/", getAllBonsAchat);
router.get("/stats", getStatsAchats);
router.get("/en-attente", getBonsEnAttenteReception);
router.get("/:id", getBonAchatById);
router.post("/", createBonAchat);
router.put("/:id", updateBonAchat);
router.put("/:id/reception", enregistrerReception);
router.put("/:id/paye", marquerPaye);
router.put("/:id/annuler", annulerBonAchat);
router.delete("/:id", deleteBonAchat);

module.exports = router;

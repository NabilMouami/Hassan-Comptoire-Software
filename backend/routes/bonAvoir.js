// routes/bonAvoirRoutes.js
const express = require("express");
const router = express.Router();
const bonAvoirController = require("../controllers/bonAvoirController");

// Routes pour les bons d'avoir
router.get("/", bonAvoirController.getAllBonsAvoir);
router.get("/stats", bonAvoirController.getStatsBonAvoir);
router.get(
  "/disponibles/:clientId",
  bonAvoirController.getBonsAvoirDisponibles,
);
router.get("/:id", bonAvoirController.getBonAvoirById);
router.post("/", bonAvoirController.createBonAvoir);
router.put("/:id/valider", bonAvoirController.validerBonAvoir);
router.put("/:id/utiliser", bonAvoirController.utiliserBonAvoir);
router.put("/:id/annuler", bonAvoirController.annulerBonAvoir);

module.exports = router;

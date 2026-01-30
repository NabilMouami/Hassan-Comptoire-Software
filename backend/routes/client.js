const express = require("express");
const router = express.Router();
const {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  searchClients,
  getClientStats,
} = require("../controllers/clientController");
// const { authenticateToken } = require("../middleware/authMiddleware");

// // All client routes require authentication
// router.use(authenticateToken);

// Client routes
router.post("/", createClient); // Create new client
router.get("/", getAllClients); // Get all clients
router.get("/search", searchClients); // Search clients (optional)
router.get("/stats", getClientStats); // Get client statistics (optional)
router.get("/:id", getClientById); // Get client by ID
router.put("/:id", updateClient); // Update client by ID
router.delete("/:id", deleteClient); // Delete client by ID

module.exports = router;

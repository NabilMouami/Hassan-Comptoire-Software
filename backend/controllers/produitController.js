const { Produit, Fornisseur } = require("../models");
const { Op } = require("sequelize");

// Create a new produit
const createProduit = async (req, res) => {
  try {
    const { reference, designation, observation, qty, prix_achat, prix_vente } =
      req.body;

    // Validation
    if (
      !reference ||
      !designation ||
      prix_achat === undefined ||
      prix_vente === undefined
    ) {
      return res.status(400).json({
        message:
          "Reference, designation, prix_achat and prix_vente are required",
      });
    }

    // Validate prix_vente > prix_achat (optional business rule)
    if (parseFloat(prix_vente) <= parseFloat(prix_achat)) {
      return res.status(400).json({
        message: "Le prix de vente doit être supérieur au prix d'achat",
      });
    }

    // Check if reference already exists
    const existingReference = await Produit.findOne({ where: { reference } });
    if (existingReference) {
      return res.status(409).json({
        message: "Reference already in use",
      });
    }

    // Create produit
    const produit = await Produit.create({
      reference,
      designation,
      observation,
      qty: qty || 0,
      prix_achat: parseFloat(prix_achat),
      prix_vente: parseFloat(prix_vente),
    });

    // Load with fornisseur info

    return res.status(201).json({
      message: "Produit created successfully",
      produit: produit,
    });
  } catch (err) {
    console.error(err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => ({
        field: error.path,
        message: error.message,
      }));
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    // Handle unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate reference. This reference already exists.",
        field: "reference",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get all produits with optional filters
const getAllProduits = async (req, res) => {
  try {
    const { search, minPrice, maxPrice, minStock, fornisseurId } = req.query;

    // Build where clause
    const whereCondition = {};

    // Search in reference and designation
    if (search) {
      whereCondition[Op.or] = [
        {
          reference: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          designation: {
            [Op.like]: `%${search}%`,
          },
        },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      whereCondition.prix_vente = {};
      if (minPrice) whereCondition.prix_vente[Op.gte] = parseFloat(minPrice);
      if (maxPrice) whereCondition.prix_vente[Op.lte] = parseFloat(maxPrice);
    }

    // Stock filter
    if (minStock !== undefined) {
      whereCondition.qty = {
        [Op.gte]: parseInt(minStock),
      };
    }

    // Fornisseur filter
    if (fornisseurId) {
      whereCondition.fornisseurId = parseInt(fornisseurId);
    }

    // Get all produits with fornisseur info
    const produits = await Produit.findAll({
      where: whereCondition,
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate total value
    const totalValue = produits.reduce((sum, produit) => {
      return sum + produit.qty * produit.prix_achat;
    }, 0);

    return res.json({
      message: "Produits retrieved successfully",
      produits,
      count: produits.length,
      totalValue: parseFloat(totalValue.toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Enhanced getFornisseurStats function
const getFornisseurStats = async (req, res) => {
  try {
    const sequelize = require("../config/db");
    const { Produit } = require("../models");

    // Count total fornisseurs
    const totalFornisseurs = await Fornisseur.count();

    // Count fornisseurs with reference
    const withReference = await Fornisseur.count({
      where: {
        reference: {
          [Op.ne]: null,
        },
      },
    });

    // Count fornisseurs with address
    const withAddress = await Fornisseur.count({
      where: {
        address: {
          [Op.ne]: null,
          [Op.ne]: "",
        },
      },
    });

    // Count products per fornisseur
    const produitsByFornisseur = await Produit.findAll({
      attributes: [
        "fornisseurId",
        [sequelize.fn("COUNT", sequelize.col("fornisseurId")), "produitCount"],
      ],
      group: ["fornisseurId"],
      raw: true,
    });

    const totalProducts = produitsByFornisseur.reduce(
      (sum, item) => sum + parseInt(item.produitCount),
      0,
    );

    // Fornisseurs with most products
    const topFornisseurs = await Fornisseur.findAll({
      attributes: [
        "id",
        "nom_complete",
        "reference",
        [
          sequelize.literal(`(
          SELECT COUNT(*) 
          FROM produits 
          WHERE produits.fornisseurId = Fornisseur.id
        )`),
          "produitCount",
        ],
      ],
      order: [[sequelize.literal("produitCount"), "DESC"]],
      limit: 5,
    });

    return res.json({
      message: "Fornisseur statistics",
      statistics: {
        totalFornisseurs,
        withReference,
        withAddress,
        totalProducts,
        topFornisseurs,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
// Get produit by ID
const getProduitById = async (req, res) => {
  try {
    const { id } = req.params;

    const produit = await Produit.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "ville", "address"],
        },
      ],
    });

    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    return res.json({
      message: "Produit retrieved successfully",
      produit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update produit
const updateProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reference,
      designation,
      observation,
      qty,
      prix_achat,
      prix_vente,
      fornisseurId,
    } = req.body;

    // Check if produit exists
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    // Check if reference is being changed and if it's already in use
    if (reference && reference !== produit.reference) {
      const existingReference = await Produit.findOne({ where: { reference } });
      if (existingReference && existingReference.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Reference already in use",
        });
      }
    }

    // Validate prix_vente > prix_achat (if both are being updated)
    if (prix_achat !== undefined && prix_vente !== undefined) {
      if (parseFloat(prix_vente) <= parseFloat(prix_achat)) {
        return res.status(400).json({
          message: "Le prix de vente doit être supérieur au prix d'achat",
        });
      }
    } else if (
      prix_vente !== undefined &&
      parseFloat(prix_vente) <= produit.prix_achat
    ) {
      return res.status(400).json({
        message: "Le prix de vente doit être supérieur au prix d'achat",
      });
    } else if (
      prix_achat !== undefined &&
      produit.prix_vente <= parseFloat(prix_achat)
    ) {
      return res.status(400).json({
        message: "Le prix de vente doit être supérieur au prix d'achat",
      });
    }

    // Check if fornisseur exists (if fornisseurId is provided)
    if (fornisseurId !== undefined) {
      if (fornisseurId) {
        const fornisseur = await Fornisseur.findByPk(fornisseurId);
        if (!fornisseur) {
          return res.status(404).json({
            message: "Fornisseur not found",
          });
        }
      }
    }

    // Prepare update data
    const updateData = {};
    if (reference) updateData.reference = reference;
    if (designation) updateData.designation = designation;
    if (observation !== undefined) updateData.observation = observation;
    if (qty !== undefined) updateData.qty = parseInt(qty);
    if (prix_achat !== undefined)
      updateData.prix_achat = parseFloat(prix_achat);
    if (prix_vente !== undefined)
      updateData.prix_vente = parseFloat(prix_vente);
    if (fornisseurId !== undefined)
      updateData.fornisseurId = fornisseurId || null;

    // Update produit
    await produit.update(updateData);

    // Load updated produit with fornisseur info
    const updatedProduit = await Produit.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone"],
        },
      ],
    });

    return res.json({
      message: "Produit updated successfully",
      produit: updatedProduit,
    });
  } catch (err) {
    console.error(err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => ({
        field: error.path,
        message: error.message,
      }));
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    // Handle unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate reference. This reference already exists.",
        field: "reference",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Delete produit
const deleteProduit = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if produit exists
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    // Check if produit has stock
    if (produit.qty > 0) {
      return res.status(400).json({
        message:
          "Cannot delete produit with existing stock. Please clear stock first.",
      });
    }

    // Delete produit
    await produit.destroy();

    return res.json({
      message: "Produit deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update stock quantity
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { qty, operation } = req.body; // operation: 'add', 'subtract', 'set'

    if (qty === undefined || qty < 0) {
      return res.status(400).json({
        message: "Valid quantity is required",
      });
    }

    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    let newQty;
    switch (operation) {
      case "add":
        newQty = produit.qty + parseInt(qty);
        break;
      case "subtract":
        newQty = produit.qty - parseInt(qty);
        if (newQty < 0) {
          return res.status(400).json({
            message: "Insufficient stock",
          });
        }
        break;
      case "set":
        newQty = parseInt(qty);
        break;
      default:
        return res.status(400).json({
          message: "Invalid operation. Use 'add', 'subtract', or 'set'",
        });
    }

    await produit.update({ qty: newQty });

    return res.json({
      message: "Stock updated successfully",
      produit: {
        id: produit.id,
        reference: produit.reference,
        oldQty: produit.qty,
        newQty,
        operation,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Search produits
const searchProduits = async (req, res) => {
  try {
    const { q } = req.query;

    console.log("Query: " + q);

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const produits = await Produit.findAll({
      where: {
        [Op.or]: [
          {
            reference: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            designation: {
              [Op.like]: `%${q}%`,
            },
          },
        ],
      },
      order: [["reference", "ASC"]],
      limit: 50,
    });

    return res.json({
      message: "Search results",
      produits,
      count: produits.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get produit statistics
const getProduitStats = async (req, res) => {
  try {
    const sequelize = require("../config/db");

    // Count total produits
    const totalProduits = await Produit.count();

    // Count low stock (less than 10)
    const lowStock = await Produit.count({
      where: {
        qty: {
          [Op.lt]: 10,
        },
      },
    });

    // Count out of stock
    const outOfStock = await Produit.count({
      where: {
        qty: 0,
      },
    });

    // Calculate total inventory value
    const result = await Produit.findAll({
      attributes: [
        [
          sequelize.fn("SUM", sequelize.literal("qty * prix_achat")),
          "totalValue",
        ],
      ],
      raw: true,
    });

    const totalValue = result[0]?.totalValue || 0;

    // Products by fornisseur
    const produitsByFornisseur = await Produit.findAll({
      attributes: [
        "fornisseurId",
        [sequelize.fn("COUNT", sequelize.col("fornisseurId")), "count"],
      ],
      group: ["fornisseurId"],
      order: [[sequelize.fn("COUNT", sequelize.col("fornisseurId")), "DESC"]],
      where: {
        fornisseurId: {
          [Op.ne]: null,
        },
      },
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["nom_complete"],
        },
      ],
      limit: 10,
    });

    // Average margin
    const marginResult = await Produit.findAll({
      attributes: [
        [
          sequelize.fn("AVG", sequelize.literal("prix_vente - prix_achat")),
          "avgMargin",
        ],
        [
          sequelize.fn(
            "AVG",
            sequelize.literal("(prix_vente - prix_achat) / prix_achat * 100"),
          ),
          "avgMarginPercentage",
        ],
      ],
      raw: true,
    });

    return res.json({
      message: "Produit statistics",
      statistics: {
        totalProduits,
        lowStock,
        outOfStock,
        inStock: totalProduits - outOfStock,
        totalValue: parseFloat(totalValue).toFixed(2),
        avgMargin: parseFloat(marginResult[0]?.avgMargin || 0).toFixed(2),
        avgMarginPercentage: parseFloat(
          marginResult[0]?.avgMarginPercentage || 0,
        ).toFixed(2),
        produitsByFornisseur,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get produits by fornisseur
const getProduitsByFornisseur = async (req, res) => {
  try {
    const { fornisseurId } = req.params;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(fornisseurId);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    const produits = await Produit.findAll({
      where: { fornisseurId },
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete"],
        },
      ],
      order: [["reference", "ASC"]],
    });

    // Calculate total value for this fornisseur
    const totalValue = produits.reduce((sum, produit) => {
      return sum + produit.qty * produit.prix_achat;
    }, 0);

    return res.json({
      message: "Produits retrieved successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
        telephone: fornisseur.telephone,
      },
      produits,
      count: produits.length,
      totalValue: parseFloat(totalValue.toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

module.exports = {
  createProduit,
  getAllProduits,
  getFornisseurStats,
  getProduitById,
  updateProduit,
  deleteProduit,
  updateStock,
  searchProduits,
  getProduitStats,
  getProduitsByFornisseur,
};

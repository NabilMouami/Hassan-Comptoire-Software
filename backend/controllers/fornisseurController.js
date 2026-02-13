const { Fornisseur, BonAchat, BonAchatProduit, Produit } = require("../models");

const { Op } = require("sequelize");
const sequelize = require("../config/db");

// Create a new fornisseur
const createFornisseur = async (req, res) => {
  try {
    const { nom_complete, ville, address, telephone, reference } = req.body;

    // Validation
    if (!nom_complete || !telephone) {
      return res.status(400).json({
        message: "Nom complet and telephone are required",
      });
    }

    // Check if telephone already exists
    const existingTelephone = await Fornisseur.findOne({
      where: { telephone },
    });
    if (existingTelephone) {
      return res.status(409).json({
        message: "Telephone number already in use",
      });
    }

    // Check if reference already exists (if provided)
    if (reference) {
      const existingReference = await Fornisseur.findOne({
        where: { reference },
      });
      if (existingReference) {
        return res.status(409).json({
          message: "Reference already in use",
        });
      }
    }

    // Create fornisseur
    const fornisseur = await Fornisseur.create({
      nom_complete,
      ville,
      address,
      telephone,
      reference,
    });

    return res.status(201).json({
      message: "Fornisseur created successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
        ville: fornisseur.ville,
        address: fornisseur.address,
        telephone: fornisseur.telephone,
        reference: fornisseur.reference,
        createdAt: fornisseur.createdAt,
        updatedAt: fornisseur.updatedAt,
      },
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
        message: "Duplicate value. Telephone or reference already exists.",
        field: err.errors[0].path,
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get all fornisseurs
const getAllFornisseurs = async (req, res) => {
  try {
    const { search } = req.query;

    // Build where clause for search
    const whereCondition = {};
    if (search) {
      whereCondition[Op.or] = [
        {
          nom_complete: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          telephone: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          reference: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          ville: {
            [Op.like]: `%${search}%`,
          },
        },
      ];
    }

    // Get all fornisseurs
    const fornisseurs = await Fornisseur.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      message: "Fornisseurs retrieved successfully",
      fornisseurs,
      count: fornisseurs.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get fornisseur by ID
const getFornisseurById = async (req, res) => {
  try {
    const { id } = req.params;

    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    return res.json({
      message: "Fornisseur retrieved successfully",
      fornisseur,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update fornisseur
const updateFornisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom_complete, ville, address, telephone, reference } = req.body;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Check if telephone is being changed and if it's already in use
    if (telephone && telephone !== fornisseur.telephone) {
      const existingTelephone = await Fornisseur.findOne({
        where: { telephone },
      });
      if (existingTelephone && existingTelephone.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Telephone number already in use",
        });
      }
    }

    // Check if reference is being changed and if it's already in use
    if (reference && reference !== fornisseur.reference) {
      const existingReference = await Fornisseur.findOne({
        where: { reference },
      });
      if (existingReference && existingReference.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Reference already in use",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (nom_complete) updateData.nom_complete = nom_complete;
    if (ville !== undefined) updateData.ville = ville;
    if (address !== undefined) updateData.address = address;
    if (telephone) updateData.telephone = telephone;
    if (reference !== undefined) updateData.reference = reference;

    // Update fornisseur
    await fornisseur.update(updateData);

    // Refresh to get updated data
    await fornisseur.reload();

    return res.json({
      message: "Fornisseur updated successfully",
      fornisseur,
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
        message: "Duplicate value. Telephone or reference already exists.",
        field: err.errors[0].path,
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Delete fornisseur
const deleteFornisseur = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Delete fornisseur
    await fornisseur.destroy();

    return res.json({
      message: "Fornisseur deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Search fornisseurs
const searchFornisseurs = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const fornisseurs = await Fornisseur.findAll({
      where: {
        [Op.or]: [
          {
            nom_complete: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            telephone: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            reference: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            ville: {
              [Op.like]: `%${q}%`,
            },
          },
        ],
      },
      order: [["nom_complete", "ASC"]],
      limit: 50,
    });

    return res.json({
      message: "Search results",
      fornisseurs,
      count: fornisseurs.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get fornisseur statistics
const getFornisseurStats = async (req, res) => {
  try {
    const sequelize = require("../config/db");

    // Count total fornisseurs
    const totalFornisseurs = await Fornisseur.count();

    // Count fornisseurs by city
    const fornisseursByCity = await Fornisseur.findAll({
      attributes: [
        "ville",
        [sequelize.fn("COUNT", sequelize.col("ville")), "count"],
      ],
      group: ["ville"],
      order: [[sequelize.fn("COUNT", sequelize.col("ville")), "DESC"]],
      where: {
        ville: {
          [Op.ne]: null,
        },
      },
      limit: 10,
    });

    // Count fornisseurs created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newFornisseursThisMonth = await Fornisseur.count({
      where: {
        createdAt: {
          [Op.gte]: startOfMonth,
        },
      },
    });

    // Count fornisseurs with reference
    const withReference = await Fornisseur.count({
      where: {
        reference: {
          [Op.ne]: null,
        },
      },
    });

    return res.json({
      message: "Fornisseur statistics",
      statistics: {
        totalFornisseurs,
        newFornisseursThisMonth,
        withReference,
        withoutReference: totalFornisseurs - withReference,
        fornisseursByCity,
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

// Get all BonAchats related to a specific Fornisseur
const getFornisseurBonAchats = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      status,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20,
      includeProducts = false,
    } = req.query;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Build where condition for BonAchats
    const whereCondition = {
      fornisseur_id: id,
    };

    // Filter by date range
    if (startDate || endDate) {
      whereCondition.date_creation = {};
      if (startDate) {
        whereCondition.date_creation[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereCondition.date_creation[Op.lte] = new Date(endDate);
      }
    }

    // Filter by status
    if (status) {
      whereCondition.status = status;
    }

    // Filter by amount range
    if (minAmount || maxAmount) {
      whereCondition.montant_ttc = {};
      if (minAmount) {
        whereCondition.montant_ttc[Op.gte] = parseFloat(minAmount);
      }
      if (maxAmount) {
        whereCondition.montant_ttc[Op.lte] = parseFloat(maxAmount);
      }
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Prepare include options
    const includeOptions = [];

    if (includeProducts === "true") {
      includeOptions.push({
        model: BonAchatProduit,
        as: "lignes",
        include: [
          {
            model: Produit,
            as: "produit",
            attributes: ["id", "nom", "reference", "code_barre"],
          },
        ],
      });
    }

    // Get total count for pagination
    const totalBonAchats = await BonAchat.count({ where: whereCondition });

    // Get BonAchats with pagination and filters
    const bonsAchat = await BonAchat.findAll({
      where: whereCondition,
      include: includeOptions,
      order: [["date_creation", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    // Calculate statistics
    const stats = {
      totalCount: totalBonAchats,
      totalAmountTTC: 0,
      averageAmountTTC: 0,
      statusCounts: {},
      paymentMethodCounts: {},
    };

    if (bonsAchat.length > 0) {
      // Calculate total amount
      const totalAmount = bonsAchat.reduce((sum, bon) => {
        return sum + parseFloat(bon.montant_ttc);
      }, 0);

      stats.totalAmountTTC = totalAmount;
      stats.averageAmountTTC = totalAmount / bonsAchat.length;

      // Count by status
      bonsAchat.forEach((bon) => {
        stats.statusCounts[bon.status] =
          (stats.statusCounts[bon.status] || 0) + 1;
        stats.paymentMethodCounts[bon.mode_reglement] =
          (stats.paymentMethodCounts[bon.mode_reglement] || 0) + 1;
      });
    }

    return res.json({
      message: "BonAchats retrieved successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
        telephone: fornisseur.telephone,
        reference: fornisseur.reference,
      },
      bonsAchat,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalBonAchats / parseInt(limit)),
        totalItems: totalBonAchats,
        itemsPerPage: parseInt(limit),
      },
      filters: {
        startDate,
        endDate,
        status,
        minAmount,
        maxAmount,
      },
      statistics: stats,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get BonAchats statistics for a specific Fornisseur
const getFornisseurBonAchatsStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = "all" } = req.query; // 'all', 'month', 'year'

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Build date filter based on period
    const dateFilter = {};
    const now = new Date();

    if (period === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter[Op.gte] = startOfMonth;
    } else if (period === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter[Op.gte] = startOfYear;
    }

    const whereCondition = {
      fornisseur_id: id,
    };

    if (Object.keys(dateFilter).length > 0) {
      whereCondition.date_creation = dateFilter;
    }

    // Get all BonAchats for statistics
    const bonsAchat = await BonAchat.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "num_bon_achat",
        "date_creation",
        "status",
        "montant_ht",
        "montant_ttc",
        "mode_reglement",
        "remise",
      ],
      order: [["date_creation", "DESC"]],
    });

    // Calculate comprehensive statistics
    const stats = {
      period: period,
      totalBonAchats: bonsAchat.length,
      totalAmountHT: 0,
      totalAmountTTC: 0,
      totalDiscount: 0,
      statusBreakdown: {},
      paymentMethodBreakdown: {},
      monthlyTrend: {},
      statusTotals: {},
      averageBonAchatAmount: 0,
      largestBonAchat: null,
      smallestBonAchat: null,
    };

    if (bonsAchat.length > 0) {
      let minAmount = Infinity;
      let maxAmount = 0;
      let minBonAchat = null;
      let maxBonAchat = null;

      bonsAchat.forEach((bon) => {
        const amountHT = parseFloat(bon.montant_ht) || 0;
        const amountTTC = parseFloat(bon.montant_ttc) || 0;
        const discount = parseFloat(bon.remise) || 0;

        // Sum totals
        stats.totalAmountHT += amountHT;
        stats.totalAmountTTC += amountTTC;
        stats.totalDiscount += discount;

        // Status breakdown
        stats.statusBreakdown[bon.status] =
          (stats.statusBreakdown[bon.status] || 0) + 1;

        // Status totals (amount per status)
        if (!stats.statusTotals[bon.status]) {
          stats.statusTotals[bon.status] = {
            count: 0,
            totalAmountTTC: 0,
            totalAmountHT: 0,
          };
        }
        stats.statusTotals[bon.status].count++;
        stats.statusTotals[bon.status].totalAmountTTC += amountTTC;
        stats.statusTotals[bon.status].totalAmountHT += amountHT;

        // Payment method breakdown
        stats.paymentMethodBreakdown[bon.mode_reglement] =
          (stats.paymentMethodBreakdown[bon.mode_reglement] || 0) + 1;

        // Monthly trend
        const monthYear = bon.date_creation.toISOString().substring(0, 7); // YYYY-MM
        if (!stats.monthlyTrend[monthYear]) {
          stats.monthlyTrend[monthYear] = {
            count: 0,
            totalAmountTTC: 0,
          };
        }
        stats.monthlyTrend[monthYear].count++;
        stats.monthlyTrend[monthYear].totalAmountTTC += amountTTC;

        // Find min/max BonAchat
        if (amountTTC < minAmount) {
          minAmount = amountTTC;
          minBonAchat = {
            id: bon.id,
            num_bon_achat: bon.num_bon_achat,
            date_creation: bon.date_creation,
            amount: amountTTC,
          };
        }
        if (amountTTC > maxAmount) {
          maxAmount = amountTTC;
          maxBonAchat = {
            id: bon.id,
            num_bon_achat: bon.num_bon_achat,
            date_creation: bon.date_creation,
            amount: amountTTC,
          };
        }
      });

      // Calculate averages
      stats.averageBonAchatAmount = stats.totalAmountTTC / stats.totalBonAchats;
      stats.largestBonAchat = maxBonAchat;
      stats.smallestBonAchat = minBonAchat;

      // Convert monthly trend object to array for easier consumption
      stats.monthlyTrendArray = Object.entries(stats.monthlyTrend)
        .map(([month, data]) => ({
          month,
          ...data,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Convert other breakdowns to arrays
      stats.statusBreakdownArray = Object.entries(stats.statusBreakdown)
        .map(([status, count]) => ({
          status,
          count,
          percentage: ((count / stats.totalBonAchats) * 100).toFixed(1),
        }))
        .sort((a, b) => b.count - a.count);

      stats.paymentMethodArray = Object.entries(stats.paymentMethodBreakdown)
        .map(([method, count]) => ({
          method,
          count,
          percentage: ((count / stats.totalBonAchats) * 100).toFixed(1),
        }))
        .sort((a, b) => b.count - a.count);

      stats.statusTotalsArray = Object.entries(stats.statusTotals)
        .map(([status, data]) => ({
          status,
          count: data.count,
          totalAmountHT: data.totalAmountHT,
          totalAmountTTC: data.totalAmountTTC,
          avgAmountTTC: data.totalAmountTTC / data.count,
        }))
        .sort((a, b) => b.totalAmountTTC - a.totalAmountTTC);
    }

    return res.json({
      message: "BonAchats statistics retrieved successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
        telephone: fornisseur.telephone,
        reference: fornisseur.reference,
      },
      period: period,
      statistics: stats,
      summary: {
        totalBonAchats: stats.totalBonAchats,
        totalAmountTTC: stats.totalAmountTTC,
        averageBonAchatAmount: stats.averageBonAchatAmount,
        totalDiscount: stats.totalDiscount,
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

// Get recent BonAchats for a Fornisseur
const getFornisseurRecentBonAchats = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    const recentBonAchats = await BonAchat.findAll({
      where: {
        fornisseur_id: id,
      },
      order: [["date_creation", "DESC"]],
      limit: parseInt(limit),
    });

    return res.json({
      message: "Recent BonAchats retrieved successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
      },
      recentBonAchats,
      count: recentBonAchats.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getFornisseurProductHistoryByReference = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reference,
      exactMatch = false,
      startDate,
      endDate,
      sortBy = "date_creation",
      sortOrder = "DESC",
      limit = 50,
      page = 1,
      includeBonAchatDetails = false,
      minQuantity,
      maxQuantity,
      minUnitPrice,
      maxUnitPrice,
      productId,
    } = req.query;

    console.log("Reference:", reference);
    console.log("Fornisseur ID:", id);

    // Validation
    if (!reference) {
      return res.status(400).json({
        message: "Product reference search term is required",
      });
    }

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id, {
      attributes: [
        "id",
        "nom_complete",
        "reference",
        "telephone",
        "ville",
        "address",
      ],
    });

    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    // Parse exactMatch
    const isExactMatch = exactMatch === true || exactMatch === "true";

    // Reference condition - IMPORTANT: Use Op.substring for case-insensitive search
    const referenceCondition = isExactMatch
      ? { reference: reference }
      : { reference: { [Op.substring]: reference } }; // Changed from Op.like to Op.substring

    console.log("Reference condition:", referenceCondition);

    // Build product where condition
    const produitWhere = { ...referenceCondition };

    // Filter by product ID if provided
    if (productId) {
      produitWhere.id = parseInt(productId);
    }

    // Build BonAchatProduit where condition for quantity and price filters
    const bonAchatProduitWhere = {};
    if (minQuantity)
      bonAchatProduitWhere.quantite = { [Op.gte]: parseFloat(minQuantity) };
    if (maxQuantity)
      bonAchatProduitWhere.quantite = {
        ...bonAchatProduitWhere.quantite,
        [Op.lte]: parseFloat(maxQuantity),
      };
    if (minUnitPrice)
      bonAchatProduitWhere.prix_unitaire = {
        [Op.gte]: parseFloat(minUnitPrice),
      };
    if (maxUnitPrice)
      bonAchatProduitWhere.prix_unitaire = {
        ...bonAchatProduitWhere.prix_unitaire,
        [Op.lte]: parseFloat(maxUnitPrice),
      };

    // Build BonAchat where condition
    const bonAchatWhere = { fornisseur_id: id };
    if (Object.keys(dateFilter).length > 0) {
      bonAchatWhere.date_creation = dateFilter;
    }

    console.log("BonAchat where condition:", bonAchatWhere);
    console.log("Produit where condition:", produitWhere);

    // DEBUG: First, let's check if there are any produits with this reference
    const produitsWithReference = await Produit.findAll({
      where: produitWhere,
      attributes: ["id", "reference", "designation"],
    });

    console.log(
      "Produits found with reference:",
      produitsWithReference.map((p) => ({
        id: p.id,
        reference: p.reference,
        designation: p.designation,
      })),
    );

    // DEBUG: Check if there are any BonAchats for this fornisseur
    const bonAchatsCount = await BonAchat.count({
      where: bonAchatWhere,
    });

    console.log("BonAchats count for fornisseur:", bonAchatsCount);

    // Try different alias configurations - let's test them one by one
    // First, check what associations are defined by logging the models
    console.log(
      "BonAchatProduit associations:",
      Object.keys(BonAchatProduit.associations || {}),
    );
    console.log(
      "BonAchat associations:",
      Object.keys(BonAchat.associations || {}),
    );
    console.log(
      "Produit associations:",
      Object.keys(Produit.associations || {}),
    );

    // Try without aliases first
    const testQuery = await BonAchatProduit.findAll({
      include: [
        {
          model: BonAchat,
          where: bonAchatWhere,
          attributes: ["id", "num_bon_achat", "date_creation", "status"],
          required: true,
        },
        {
          model: Produit,
          where: produitWhere,
          attributes: ["id", "reference", "designation", "prix_achat"],
          required: true,
        },
      ],
      attributes: ["id", "quantite", "prix_unitaire", "total_ligne"],
      limit: 5,
    });

    console.log("Test query results count:", testQuery.length);
    if (testQuery.length > 0) {
      console.log(
        "Test query first result:",
        JSON.stringify(testQuery[0], null, 2),
      );
    }

    // Now try the full query without aliases
    const bonAchatProducts = await BonAchatProduit.findAll({
      include: [
        {
          model: BonAchat,
          where: bonAchatWhere,
          attributes: [
            "id",
            "num_bon_achat",
            "date_creation",
            "status",
            "montant_ht",
            "montant_ttc",
            "mode_reglement",
            "remise",
            "createdAt",
            "updatedAt",
          ],
          required: true,
        },
        {
          model: Produit,
          where: produitWhere,
          attributes: [
            "id",
            "designation",
            "reference",
            "prix_achat",
            "prix_vente",
            "fornisseurId",
          ],
          required: true,
        },
      ],
      where:
        Object.keys(bonAchatProduitWhere).length > 0
          ? bonAchatProduitWhere
          : undefined,
      attributes: [
        "id",
        "quantite",
        "prix_unitaire",
        "remise_ligne",
        "total_ligne",
        "createdAt",
        "updatedAt",
      ],
      order: [[BonAchat, "date_creation", sortOrder]],
    });

    console.log("BonAchatProducts found:", bonAchatProducts.length);

    if (bonAchatProducts.length === 0) {
      // Let's do a more detailed debug
      console.log("No results found. Let's debug step by step:");

      // 1. Check if BonAchatProduit has any records
      const totalBonAchatProduitCount = await BonAchatProduit.count();
      console.log("Total BonAchatProduit records:", totalBonAchatProduitCount);

      // 2. Check if there are any BonAchats for this fornisseur
      const fornisseurBonAchats = await BonAchat.findAll({
        where: { fornisseur_id: id },
        attributes: ["id", "num_bon_achat"],
        limit: 5,
      });
      console.log("Fornisseur BonAchats:", fornisseurBonAchats);

      // 3. Check if any BonAchatProduit exists for these BonAchats
      if (fornisseurBonAchats.length > 0) {
        const bonAchatIds = fornisseurBonAchats.map((ba) => ba.id);
        const bonAchatProduitsCount = await BonAchatProduit.count({
          where: { bon_achat_id: { [Op.in]: bonAchatIds } },
        });
        console.log(
          "BonAchatProduits for this fornisseur:",
          bonAchatProduitsCount,
        );
      }

      // 4. Check the SQL query being generated
      const sqlQuery = BonAchatProduit.findAll({
        include: [
          {
            model: BonAchat,
            where: bonAchatWhere,
            attributes: ["id"],
            required: true,
          },
          {
            model: Produit,
            where: produitWhere,
            attributes: ["id"],
            required: true,
          },
        ],
        attributes: ["id"],
        limit: 1,
      });

      console.log("Generated SQL (to see):", sqlQuery.toString());
    }

    // Format the results
    const formatProduct = (item) => {
      return {
        id: item.id,
        document_type: "bon-achat",
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        remise_ligne: item.remise_ligne,
        total_ligne: item.total_ligne,
        document: {
          id: item.BonAchat.id,
          num: item.BonAchat.num_bon_achat,
          date: item.BonAchat.date_creation,
          status: item.BonAchat.status,
          montant_ht: item.BonAchat.montant_ht,
          montant_ttc: item.BonAchat.montant_ttc,
          mode_reglement: item.BonAchat.mode_reglement,
          remise: item.BonAchat.remise,
          createdAt: item.BonAchat.createdAt,
        },
        produit: item.Produit,
        date_creation: item.BonAchat.date_creation,
      };
    };

    const allHistory = bonAchatProducts.map(formatProduct);

    // Calculate product statistics
    const productStats = {};
    allHistory.forEach((item) => {
      const productId = item.produit.id;
      if (!productStats[productId]) {
        productStats[productId] = {
          product: item.produit,
          totalQuantity: 0,
          totalAmount: 0,
          totalLineDiscount: 0,
          appearances: 0,
          firstSeen: item.date_creation,
          lastSeen: item.date_creation,
          averageUnitPrice: 0,
          minUnitPrice: Infinity,
          maxUnitPrice: 0,
          unitPrices: [],
          byBonAchatStatus: {},
          byPaymentMethod: {},
        };
      }

      const stats = productStats[productId];
      const quantity = parseFloat(item.quantite || 0);
      const unitPrice = parseFloat(item.prix_unitaire || 0);
      const lineAmount = parseFloat(item.total_ligne || 0);
      const lineDiscount = parseFloat(item.remise_ligne || 0);

      stats.totalQuantity += quantity;
      stats.totalAmount += lineAmount;
      stats.totalLineDiscount += lineDiscount;
      stats.appearances += 1;
      stats.unitPrices.push(unitPrice);

      if (unitPrice < stats.minUnitPrice) stats.minUnitPrice = unitPrice;
      if (unitPrice > stats.maxUnitPrice) stats.maxUnitPrice = unitPrice;

      // Group by BonAchat status
      const status = item.document.status;
      if (!stats.byBonAchatStatus[status]) {
        stats.byBonAchatStatus[status] = {
          count: 0,
          totalQuantity: 0,
          totalAmount: 0,
        };
      }
      stats.byBonAchatStatus[status].count += 1;
      stats.byBonAchatStatus[status].totalQuantity += quantity;
      stats.byBonAchatStatus[status].totalAmount += lineAmount;

      // Group by payment method
      const paymentMethod = item.document.mode_reglement;
      if (!stats.byPaymentMethod[paymentMethod]) {
        stats.byPaymentMethod[paymentMethod] = {
          count: 0,
          totalQuantity: 0,
          totalAmount: 0,
        };
      }
      stats.byPaymentMethod[paymentMethod].count += 1;
      stats.byPaymentMethod[paymentMethod].totalQuantity += quantity;
      stats.byPaymentMethod[paymentMethod].totalAmount += lineAmount;

      if (new Date(item.date_creation) < new Date(stats.firstSeen)) {
        stats.firstSeen = item.date_creation;
      }
      if (new Date(item.date_creation) > new Date(stats.lastSeen)) {
        stats.lastSeen = item.date_creation;
      }
    });

    // Calculate averages and format statistics
    Object.values(productStats).forEach((stats) => {
      stats.averageUnitPrice =
        stats.unitPrices.length > 0
          ? stats.unitPrices.reduce((a, b) => a + b, 0) /
            stats.unitPrices.length
          : 0;

      // Convert objects to arrays for easier frontend consumption
      stats.byBonAchatStatusArray = Object.entries(stats.byBonAchatStatus)
        .map(([status, data]) => ({
          status,
          ...data,
          avgQuantity: data.totalQuantity / data.count,
          avgAmount: data.totalAmount / data.count,
        }))
        .sort((a, b) => b.count - a.count);

      stats.byPaymentMethodArray = Object.entries(stats.byPaymentMethod)
        .map(([method, data]) => ({
          method,
          ...data,
          avgQuantity: data.totalQuantity / data.count,
          avgAmount: data.totalAmount / data.count,
        }))
        .sort((a, b) => b.count - a.count);

      delete stats.unitPrices;
    });

    // Calculate summary statistics
    const uniqueProducts = Object.values(productStats);
    const summary = {
      totalEntries: allHistory.length,
      totalUniqueProducts: uniqueProducts.length,
      totalQuantity: uniqueProducts.reduce(
        (sum, p) => sum + p.totalQuantity,
        0,
      ),
      totalAmount: uniqueProducts.reduce((sum, p) => sum + p.totalAmount, 0),
      totalLineDiscount: uniqueProducts.reduce(
        (sum, p) => sum + p.totalLineDiscount,
        0,
      ),
      byStatus: {},
      byPaymentMethod: {},
    };

    // Calculate summary by status and payment method
    allHistory.forEach((item) => {
      const status = item.document.status;
      const paymentMethod = item.document.mode_reglement;

      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      summary.byPaymentMethod[paymentMethod] =
        (summary.byPaymentMethod[paymentMethod] || 0) + 1;
    });

    // Convert summary objects to arrays
    summary.byStatusArray = Object.entries(summary.byStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    summary.byPaymentMethodArray = Object.entries(summary.byPaymentMethod)
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);

    // Paginate results
    const paginatedHistory = allHistory.slice(offset, offset + parseInt(limit));

    // Get BonAchat details if requested
    let bonAchatDetails = null;
    if (includeBonAchatDetails === "true" && allHistory.length > 0) {
      const bonAchatIds = [
        ...new Set(allHistory.map((item) => item.document.id)),
      ];

      const bonAchats = await BonAchat.findAll({
        where: {
          id: { [Op.in]: bonAchatIds },
        },
        include: [
          {
            model: BonAchatProduit,
            as: "lignes",
            include: [
              {
                model: Produit,
                where: produitWhere,
                attributes: ["id", "designation", "reference", "prix_achat"],
                required: true,
              },
            ],
            required: false,
          },
        ],
        order: [["date_creation", sortOrder]],
      });

      bonAchatDetails = bonAchats
        .map((ba) => ({
          id: ba.id,
          num_bon_achat: ba.num_bon_achat,
          date_creation: ba.date_creation,
          status: ba.status,
          montant_ht: ba.montant_ht,
          montant_ttc: ba.montant_ttc,
          mode_reglement: ba.mode_reglement,
          remise: ba.remise,
          lignes: ba.lignes ? ba.lignes.filter((line) => line.Produit) : [],
          lignesCount: ba.lignes ? ba.lignes.length : 0,
        }))
        .filter((ba) => ba.lignes.length > 0);
    }

    // Build response
    const response = {
      message: "Fornisseur product history by reference retrieved successfully",
      fornisseur: fornisseur.toJSON(),
      searchCriteria: {
        reference,
        exactMatch: isExactMatch,
        startDate,
        endDate,
        filters: {
          minQuantity,
          maxQuantity,
          minUnitPrice,
          maxUnitPrice,
          productId,
        },
      },
      summary,
      productStatistics: uniqueProducts,
      history: paginatedHistory,
      pagination: {
        total: allHistory.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allHistory.length / parseInt(limit)),
      },
      filters: {
        startDate,
        endDate,
        sortBy,
        sortOrder,
      },
    };

    // Add BonAchat details if requested
    if (bonAchatDetails) {
      response.bonAchatDetails = bonAchatDetails;
      response.bonAchatDetailsCount = bonAchatDetails.length;
    }

    // Add debug info
    response.debug = {
      queryConditions: {
        fornisseurId: id,
        reference: reference,
        referenceCondition: referenceCondition,
        bonAchatWhere: bonAchatWhere,
        produitWhere: produitWhere,
      },
      counts: {
        allHistory: allHistory.length,
        uniqueProducts: uniqueProducts.length,
      },
    };

    return res.json(response);
  } catch (err) {
    console.error("Error in getFornisseurProductHistoryByReference:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get Fornisseur's purchased products summary (aggregated view)
const getFornisseurPurchasedProductsSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      groupBy = "product", // product, month, status, payment_method
      sortBy = "totalQuantity",
      sortOrder = "DESC",
      limit = 20,
      minTotalQuantity,
      minTotalAmount,
    } = req.query;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id, {
      attributes: ["id", "nom_complete", "reference", "telephone"],
    });

    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    // Build BonAchat where condition
    const bonAchatWhere = { fornisseur_id: id };
    if (Object.keys(dateFilter).length > 0) {
      bonAchatWhere.date_creation = dateFilter;
    }

    // Query data based on grouping
    let summaryData = [];

    if (groupBy === "product") {
      // Group by product
      const result = await BonAchatProduit.findAll({
        include: [
          {
            model: BonAchat,
            as: "bonAchat",
            where: bonAchatWhere,
            attributes: [],
            required: true,
          },
          {
            model: Produit,
            as: "produit",
            attributes: [
              "id",
              "nom",
              "reference",
              "code_barre",
              "prix_achat",
              "unite_mesure",
              "categorie",
            ],
            required: true,
          },
        ],
        attributes: [
          "produit_id",
          [sequelize.fn("SUM", sequelize.col("quantite")), "totalQuantity"],
          [sequelize.fn("SUM", sequelize.col("total_ligne")), "totalAmount"],
          [
            sequelize.fn("COUNT", sequelize.col("BonAchatProduit.id")),
            "orderCount",
          ],
          [sequelize.fn("AVG", sequelize.col("prix_unitaire")), "avgUnitPrice"],
          [sequelize.fn("MIN", sequelize.col("prix_unitaire")), "minUnitPrice"],
          [sequelize.fn("MAX", sequelize.col("prix_unitaire")), "maxUnitPrice"],
        ],
        group: ["produit_id", "produit.id", "produit.nom", "produit.reference"],
        raw: true,
        nest: true,
      });

      summaryData = result.map((item) => ({
        product: item.produit,
        totalQuantity: parseFloat(item.totalQuantity) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0,
        orderCount: parseInt(item.orderCount) || 0,
        avgUnitPrice: parseFloat(item.avgUnitPrice) || 0,
        minUnitPrice: parseFloat(item.minUnitPrice) || 0,
        maxUnitPrice: parseFloat(item.maxUnitPrice) || 0,
      }));
    } else if (groupBy === "month") {
      // Group by month
      const result = await BonAchatProduit.findAll({
        include: [
          {
            model: BonAchat,
            as: "bonAchat",
            where: bonAchatWhere,
            attributes: [],
            required: true,
          },
        ],
        attributes: [
          [
            sequelize.fn(
              "DATE_FORMAT",
              sequelize.col("bonAchat.date_creation"),
              "%Y-%m",
            ),
            "month",
          ],
          [sequelize.fn("SUM", sequelize.col("quantite")), "totalQuantity"],
          [sequelize.fn("SUM", sequelize.col("total_ligne")), "totalAmount"],
          [
            sequelize.fn(
              "COUNT",
              sequelize.fn("DISTINCT", sequelize.col("bon_achat_id")),
            ),
            "bonAchatCount",
          ],
          [
            sequelize.fn("COUNT", sequelize.col("BonAchatProduit.id")),
            "itemCount",
          ],
        ],
        group: [
          sequelize.fn(
            "DATE_FORMAT",
            sequelize.col("bonAchat.date_creation"),
            "%Y-%m",
          ),
        ],
        raw: true,
      });

      summaryData = result.map((item) => ({
        month: item.month,
        totalQuantity: parseFloat(item.totalQuantity) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0,
        bonAchatCount: parseInt(item.bonAchatCount) || 0,
        itemCount: parseInt(item.itemCount) || 0,
      }));
    } else if (groupBy === "status") {
      // Group by BonAchat status
      const result = await BonAchatProduit.findAll({
        include: [
          {
            model: BonAchat,
            as: "bonAchat",
            where: bonAchatWhere,
            attributes: ["status"],
            required: true,
          },
        ],
        attributes: [
          [sequelize.col("bonAchat.status"), "status"],
          [sequelize.fn("SUM", sequelize.col("quantite")), "totalQuantity"],
          [sequelize.fn("SUM", sequelize.col("total_ligne")), "totalAmount"],
          [
            sequelize.fn(
              "COUNT",
              sequelize.fn("DISTINCT", sequelize.col("bon_achat_id")),
            ),
            "bonAchatCount",
          ],
        ],
        group: ["bonAchat.status"],
        raw: true,
      });

      summaryData = result.map((item) => ({
        status: item.status,
        totalQuantity: parseFloat(item.totalQuantity) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0,
        bonAchatCount: parseInt(item.bonAchatCount) || 0,
      }));
    } else if (groupBy === "payment_method") {
      // Group by payment method
      const result = await BonAchatProduit.findAll({
        include: [
          {
            model: BonAchat,
            as: "bonAchat",
            where: bonAchatWhere,
            attributes: ["mode_reglement"],
            required: true,
          },
        ],
        attributes: [
          [sequelize.col("bonAchat.mode_reglement"), "paymentMethod"],
          [sequelize.fn("SUM", sequelize.col("quantite")), "totalQuantity"],
          [sequelize.fn("SUM", sequelize.col("total_ligne")), "totalAmount"],
          [
            sequelize.fn(
              "COUNT",
              sequelize.fn("DISTINCT", sequelize.col("bon_achat_id")),
            ),
            "bonAchatCount",
          ],
        ],
        group: ["bonAchat.mode_reglement"],
        raw: true,
      });

      summaryData = result.map((item) => ({
        paymentMethod: item.paymentMethod,
        totalQuantity: parseFloat(item.totalQuantity) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0,
        bonAchatCount: parseInt(item.bonAchatCount) || 0,
      }));
    }

    // Apply filters
    if (minTotalQuantity) {
      summaryData = summaryData.filter(
        (item) => item.totalQuantity >= parseFloat(minTotalQuantity),
      );
    }
    if (minTotalAmount) {
      summaryData = summaryData.filter(
        (item) => item.totalAmount >= parseFloat(minTotalAmount),
      );
    }

    // Sort data
    const sortField =
      sortBy === "totalAmount"
        ? "totalAmount"
        : sortBy === "orderCount"
          ? "orderCount"
          : sortBy === "bonAchatCount"
            ? "bonAchatCount"
            : "totalQuantity";

    summaryData.sort((a, b) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      return sortOrder === "DESC" ? bValue - aValue : aValue - bValue;
    });

    // Apply limit
    summaryData = summaryData.slice(0, parseInt(limit));

    // Calculate totals
    const totals = {
      totalQuantity: summaryData.reduce(
        (sum, item) => sum + (item.totalQuantity || 0),
        0,
      ),
      totalAmount: summaryData.reduce(
        (sum, item) => sum + (item.totalAmount || 0),
        0,
      ),
      totalBonAchats: summaryData.reduce(
        (sum, item) => sum + (item.bonAchatCount || item.orderCount || 0),
        0,
      ),
    };

    return res.json({
      message: "Fornisseur purchased products summary retrieved successfully",
      fornisseur: fornisseur.toJSON(),
      groupBy,
      summary: summaryData,
      totals,
      filters: {
        startDate,
        endDate,
        minTotalQuantity,
        minTotalAmount,
        sortBy,
        sortOrder,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error in getFornisseurPurchasedProductsSummary:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get all products purchased from fornisseur with date range filter
const getFornisseurProductsByDateRange = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      sortBy = "date_creation",
      sortOrder = "DESC",
      page = 1,
      limit = 100,
    } = req.query;

    console.log("=== GET FORNISSEUR PRODUCTS BY DATE RANGE ===");
    console.log("Fornisseur ID:", id);
    console.log("Raw Date Range:", { startDate, endDate });

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id, {
      attributes: ["id", "nom_complete", "reference", "telephone", "ville"],
    });

    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Build date filter - FIXED with proper Symbol detection
    const buildDateFilter = () => {
      // If no dates provided, return empty filter
      if (!startDate && !endDate) {
        console.log("No date filters provided");
        return {};
      }

      const filter = {};

      if (startDate) {
        // Create date at start of day in local time
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter[Op.gte] = start;
        console.log("Start date:", start.toString());
      }

      if (endDate) {
        // Create date at end of day in local time
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter[Op.lte] = end;
        console.log("End date:", end.toString());
      }

      console.log("Date Filter built:", filter);
      return filter;
    };

    const dateFilter = buildDateFilter();

    // Check if dateFilter has any properties (including Symbol keys)
    const hasDateFilter = Object.getOwnPropertySymbols(dateFilter).length > 0;
    console.log("Has date filter:", hasDateFilter);
    console.log(
      "Date filter symbols:",
      Object.getOwnPropertySymbols(dateFilter).map((sym) => sym.toString()),
    );

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build BonAchat where condition
    const bonAchatWhere = { fornisseur_id: id };

    // Apply date filter if it has values - FIXED: use hasDateFilter
    if (hasDateFilter) {
      bonAchatWhere.date_creation = dateFilter;
      console.log("Applying date filter to BonAchat");
    }

    console.log(
      "BonAchat where condition:",
      JSON.stringify(
        bonAchatWhere,
        (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        },
        2,
      ),
    );

    /* ===================== FETCH BON ACHAT PRODUCTS ===================== */
    const bonAchatProducts = await BonAchatProduit.findAll({
      include: [
        {
          model: BonAchat,
          where: bonAchatWhere,
          attributes: [
            "id",
            "num_bon_achat",
            "date_creation",
            "status",
            "montant_ht",
            "montant_ttc",
            "mode_reglement",
            "remise",
          ],
          required: true,
        },
        {
          model: Produit,
          attributes: [
            "id",
            "designation",
            "reference",
            "prix_achat",
            "prix_vente",
          ],
          required: true,
        },
      ],
      attributes: [
        "id",
        "quantite",
        "prix_unitaire",
        "remise_ligne",
        "total_ligne",
      ],
    });

    console.log(`Found ${bonAchatProducts.length} bon achat products`);

    // Log sample dates for debugging
    if (bonAchatProducts.length > 0) {
      console.log(
        "Sample bon achat dates:",
        bonAchatProducts.slice(0, 3).map((p) => ({
          date: p.BonAchat.date_creation,
          formattedDate: new Date(p.BonAchat.date_creation).toLocaleString(),
          num: p.BonAchat.num_bon_achat,
        })),
      );
    }

    /* ===================== FORMAT RESULTS ===================== */
    const formatProduct = (item) => {
      // Access models correctly
      const produit = item.Produit;
      const bonAchat = item.BonAchat;

      if (!produit || !bonAchat) {
        console.warn("Missing produit or bonAchat in item:", item.id);
        return null;
      }

      return {
        id: item.id,
        document_type: "bon-achat",
        quantite: parseFloat(item.quantite || 0),
        prix_unitaire: parseFloat(item.prix_unitaire || 0),
        remise_ligne: parseFloat(item.remise_ligne || 0),
        total_ligne: parseFloat(item.total_ligne || 0),
        produit: {
          id: produit.id,
          designation: produit.designation,
          reference: produit.reference,
          prix_achat: produit.prix_achat,
          prix_vente: produit.prix_vente,
        },
        document: {
          id: bonAchat.id,
          num: bonAchat.num_bon_achat,
          status: bonAchat.status,
          montant_ht: bonAchat.montant_ht,
          montant_ttc: bonAchat.montant_ttc,
          mode_reglement: bonAchat.mode_reglement,
          remise: bonAchat.remise,
        },
        date_creation: bonAchat.date_creation,
      };
    };

    // Combine all results and filter out nulls
    let allProducts = bonAchatProducts
      .map(formatProduct)
      .filter((p) => p !== null);

    console.log(`Total combined products: ${allProducts.length}`);

    // Sort combined results by date
    allProducts.sort((a, b) => {
      const dateA = new Date(a.date_creation);
      const dateB = new Date(b.date_creation);
      return sortOrder === "DESC" ? dateB - dateA : dateA - dateB;
    });

    /* ===================== CALCULATE STATISTICS ===================== */
    const productMap = {};

    allProducts.forEach((item) => {
      const productId = item.produit.id;

      if (!productMap[productId]) {
        productMap[productId] = {
          product: item.produit,
          totalQuantity: 0,
          totalAmount: 0,
          totalLineDiscount: 0,
          appearances: 0,
          firstSeen: item.date_creation,
          lastSeen: item.date_creation,
          averageUnitPrice: 0,
          minUnitPrice: Infinity,
          maxUnitPrice: -Infinity,
          unitPrices: [],
          byStatus: {},
          byPaymentMethod: {},
        };
      }

      const stats = productMap[productId];
      const quantity = item.quantite;
      const unitPrice = item.prix_unitaire;
      const lineAmount = item.total_ligne;
      const lineDiscount = item.remise_ligne;

      stats.totalQuantity += quantity;
      stats.totalAmount += lineAmount;
      stats.totalLineDiscount += lineDiscount;
      stats.appearances += 1;
      stats.unitPrices.push(unitPrice);

      if (unitPrice < stats.minUnitPrice) stats.minUnitPrice = unitPrice;
      if (unitPrice > stats.maxUnitPrice) stats.maxUnitPrice = unitPrice;

      // Group by status
      const status = item.document.status;
      if (!stats.byStatus[status]) {
        stats.byStatus[status] = { count: 0, totalQuantity: 0, totalAmount: 0 };
      }
      stats.byStatus[status].count += 1;
      stats.byStatus[status].totalQuantity += quantity;
      stats.byStatus[status].totalAmount += lineAmount;

      // Group by payment method
      const paymentMethod = item.document.mode_reglement || "non_spécifié";
      if (!stats.byPaymentMethod[paymentMethod]) {
        stats.byPaymentMethod[paymentMethod] = {
          count: 0,
          totalQuantity: 0,
          totalAmount: 0,
        };
      }
      stats.byPaymentMethod[paymentMethod].count += 1;
      stats.byPaymentMethod[paymentMethod].totalQuantity += quantity;
      stats.byPaymentMethod[paymentMethod].totalAmount += lineAmount;

      if (new Date(item.date_creation) < new Date(stats.firstSeen)) {
        stats.firstSeen = item.date_creation;
      }
      if (new Date(item.date_creation) > new Date(stats.lastSeen)) {
        stats.lastSeen = item.date_creation;
      }
    });

    // Calculate averages and format statistics
    const uniqueProducts = Object.values(productMap).map((stats) => {
      // Fix minUnitPrice if it's still Infinity
      if (stats.minUnitPrice === Infinity) stats.minUnitPrice = 0;
      if (stats.maxUnitPrice === -Infinity) stats.maxUnitPrice = 0;

      // Calculate average
      stats.averageUnitPrice =
        stats.unitPrices.length > 0
          ? stats.unitPrices.reduce((a, b) => a + b, 0) /
            stats.unitPrices.length
          : 0;

      // Convert byStatus to array
      stats.byStatusArray = Object.entries(stats.byStatus)
        .filter(([_, data]) => data.count > 0)
        .map(([status, data]) => ({
          status,
          ...data,
          avgQuantity: data.count > 0 ? data.totalQuantity / data.count : 0,
          avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Convert byPaymentMethod to array
      stats.byPaymentMethodArray = Object.entries(stats.byPaymentMethod)
        .map(([method, data]) => ({
          method,
          ...data,
          avgQuantity: data.count > 0 ? data.totalQuantity / data.count : 0,
          avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Clean up temporary properties
      delete stats.unitPrices;
      delete stats.byStatus;
      delete stats.byPaymentMethod;

      return stats;
    });

    // Paginate the detail results
    const paginatedProducts = allProducts.slice(
      offset,
      offset + parseInt(limit),
    );

    /* ===================== CALCULATE SUMMARY ===================== */
    const summary = {
      totalEntries: allProducts.length,
      totalUniqueProducts: uniqueProducts.length,
      totalQuantity: uniqueProducts.reduce(
        (sum, p) => sum + p.totalQuantity,
        0,
      ),
      totalAmount: uniqueProducts.reduce((sum, p) => sum + p.totalAmount, 0),
      totalLineDiscount: uniqueProducts.reduce(
        (sum, p) => sum + p.totalLineDiscount,
        0,
      ),
      dateRange: {
        from: startDate || "Tous",
        to: endDate || "Aujourd'hui",
      },
    };

    console.log("Summary:", summary);
    console.log("=== END OF REQUEST ===");

    return res.json({
      message: "Fornisseur products retrieved successfully",
      fornisseur: fornisseur.toJSON(),
      summary,
      productStatistics: uniqueProducts,
      products: paginatedProducts,
      pagination: {
        total: allProducts.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allProducts.length / limit),
      },
      filters: {
        startDate,
        endDate,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Error in getFornisseurProductsByDateRange:", err);
    console.error("Stack:", err.stack);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Don't forget to export the new function
module.exports = {
  createFornisseur,
  getAllFornisseurs,
  getFornisseurById,
  updateFornisseur,
  deleteFornisseur,
  searchFornisseurs,
  getFornisseurStats,
  getFornisseurBonAchats,
  getFornisseurBonAchatsStats,
  getFornisseurRecentBonAchats,
  getFornisseurProductHistoryByReference,
  getFornisseurPurchasedProductsSummary,
  getFornisseurProductsByDateRange, // ADD THIS NEW EXPORT
};

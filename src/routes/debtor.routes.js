const express = require('express');
const Debtor = require('../models/debtor.model');
const Debt = require('../models/debt.model');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// Get all debtors with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      isBlacklisted,
      creditRating,
      businessType
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (isBlacklisted !== undefined) {
      where.isBlacklisted = isBlacklisted === 'true';
    }

    if (creditRating) {
      where.creditRating = creditRating;
    }

    if (businessType) {
      where.businessType = businessType;
    }

    const { count, rows } = await Debtor.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      debtors: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching debtors:', error);
    res.status(500).json({ error: 'Failed to fetch debtors' });
  }
});

// Get debtor by ID
router.get('/:id', async (req, res) => {
  try {
    const debtor = await Debtor.findByPk(req.params.id);
    
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

    // Get debtor's debts
    const debts = await Debt.findAll({
      where: { debtorId: debtor.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      debtor,
      debts,
      summary: {
        totalDebts: debts.length,
        totalAmount: debts.reduce((sum, debt) => sum + parseFloat(debt.amount), 0),
        paidDebts: debts.filter(debt => debt.status === 'paid').length,
        overdueDebts: debts.filter(debt => debt.status === 'overdue').length
      }
    });
  } catch (error) {
    logger.error('Error fetching debtor:', error);
    res.status(500).json({ error: 'Failed to fetch debtor' });
  }
});

// Create new debtor
router.post('/', async (req, res) => {
  try {
    const debtorData = req.body;
    
    // Check if debtor with same phone already exists
    const existingDebtor = await Debtor.findByPhone(debtorData.phone);
    if (existingDebtor) {
      return res.status(400).json({ error: 'Debtor with this phone number already exists' });
    }

    const debtor = await Debtor.create(debtorData);
    
    logger.info(`New debtor created: ${debtor.id}`);
    res.status(201).json(debtor);
  } catch (error) {
    logger.error('Error creating debtor:', error);
    res.status(400).json({ error: error.message || 'Failed to create debtor' });
  }
});

// Update debtor
router.put('/:id', async (req, res) => {
  try {
    const debtor = await Debtor.findByPk(req.params.id);
    
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

    await debtor.update(req.body);
    
    logger.info(`Debtor updated: ${debtor.id}`);
    res.json(debtor);
  } catch (error) {
    logger.error('Error updating debtor:', error);
    res.status(400).json({ error: error.message || 'Failed to update debtor' });
  }
});

// Delete debtor (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const debtor = await Debtor.findByPk(req.params.id);
    
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

    await debtor.update({ isActive: false });
    
    logger.info(`Debtor deactivated: ${debtor.id}`);
    res.json({ message: 'Debtor deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating debtor:', error);
    res.status(500).json({ error: 'Failed to deactivate debtor' });
  }
});

// Blacklist/unblacklist debtor
router.patch('/:id/blacklist', async (req, res) => {
  try {
    const { isBlacklisted } = req.body;
    const debtor = await Debtor.findByPk(req.params.id);
    
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

    await debtor.update({ isBlacklisted });
    
    logger.info(`Debtor ${isBlacklisted ? 'blacklisted' : 'unblacklisted'}: ${debtor.id}`);
    res.json(debtor);
  } catch (error) {
    logger.error('Error updating debtor blacklist status:', error);
    res.status(500).json({ error: 'Failed to update blacklist status' });
  }
});

// Get debtor statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Debtor.getDebtorStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching debtor statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Search debtors by phone
router.get('/search/phone/:phone', async (req, res) => {
  try {
    const debtor = await Debtor.findByPhone(req.params.phone);
    
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

    res.json(debtor);
  } catch (error) {
    logger.error('Error searching debtor by phone:', error);
    res.status(500).json({ error: 'Failed to search debtor' });
  }
});

// Get active debtors
router.get('/filter/active', async (req, res) => {
  try {
    const debtors = await Debtor.getActiveDebtors();
    res.json(debtors);
  } catch (error) {
    logger.error('Error fetching active debtors:', error);
    res.status(500).json({ error: 'Failed to fetch active debtors' });
  }
});

module.exports = router;
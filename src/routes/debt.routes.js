const express = require('express');
const Debt = require('../models/debt.model');
const Debtor = require('../models/debtor.model');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// Get all debts with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      debtorId,
      overdue,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (debtorId) {
      where.debtorId = debtorId;
    }

    if (overdue === 'true') {
      where.dueDate = { [Op.lt]: new Date() };
      where.status = { [Op.in]: ['pending', 'overdue', 'partially_paid'] };
    }

    if (search) {
      where[Op.or] = [
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Debt.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [{
        model: Debtor,
        as: 'Debtor',
        attributes: ['id', 'name', 'phone', 'email', 'company']
      }]
    });

    res.json({
      debts: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching debts:', error);
    res.status(500).json({ error: 'Failed to fetch debts' });
  }
});

// Get debt by ID
router.get('/:id', async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id, {
      include: [{
        model: Debtor,
        as: 'Debtor'
      }]
    });
    
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    res.json(debt);
  } catch (error) {
    logger.error('Error fetching debt:', error);
    res.status(500).json({ error: 'Failed to fetch debt' });
  }
});

// Create new debt
router.post('/', async (req, res) => {
  try {
    const debtData = req.body;
    
    // Verify debtor exists
    const debtor = await Debtor.findByPk(debtData.debtorId);
    if (!debtor) {
      return res.status(400).json({ error: 'Debtor not found' });
    }

    // Check if invoice number already exists
    const existingDebt = await Debt.findOne({
      where: { invoiceNumber: debtData.invoiceNumber }
    });
    if (existingDebt) {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }

    const debt = await Debt.create(debtData);
    
    logger.info(`New debt created: ${debt.id} for debtor: ${debtor.name}`);
    res.status(201).json(debt);
  } catch (error) {
    logger.error('Error creating debt:', error);
    res.status(400).json({ error: error.message || 'Failed to create debt' });
  }
});

// Update debt
router.put('/:id', async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id);
    
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    await debt.update(req.body);
    
    logger.info(`Debt updated: ${debt.id}`);
    res.json(debt);
  } catch (error) {
    logger.error('Error updating debt:', error);
    res.status(400).json({ error: error.message || 'Failed to update debt' });
  }
});

// Delete debt (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id);
    
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    await debt.update({ isActive: false });
    
    logger.info(`Debt deactivated: ${debt.id}`);
    res.json({ message: 'Debt deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating debt:', error);
    res.status(500).json({ error: 'Failed to deactivate debt' });
  }
});

// Add payment to debt
router.post('/:id/payments', async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id);
    
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    const paymentData = req.body;
    const payment = await debt.addPayment(paymentData, req.user?.id);
    
    logger.info(`Payment added to debt ${debt.id}: ${payment.amount}`);
    res.status(201).json(payment);
  } catch (error) {
    logger.error('Error adding payment:', error);
    res.status(400).json({ error: error.message || 'Failed to add payment' });
  }
});

// Update debt status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const debt = await Debt.findByPk(req.params.id);
    
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    await debt.update({ status });
    
    logger.info(`Debt status updated: ${debt.id} -> ${status}`);
    res.json(debt);
  } catch (error) {
    logger.error('Error updating debt status:', error);
    res.status(500).json({ error: 'Failed to update debt status' });
  }
});

// Get overdue debts
router.get('/filter/overdue', async (req, res) => {
  try {
    const debts = await Debt.findOverdue();
    res.json(debts);
  } catch (error) {
    logger.error('Error fetching overdue debts:', error);
    res.status(500).json({ error: 'Failed to fetch overdue debts' });
  }
});

// Get debts due for reminder
router.get('/filter/reminder-due', async (req, res) => {
  try {
    const debts = await Debt.findDueForReminder();
    res.json(debts);
  } catch (error) {
    logger.error('Error fetching debts due for reminder:', error);
    res.status(500).json({ error: 'Failed to fetch debts due for reminder' });
  }
});

// Get debts due for escalation
router.get('/filter/escalation-due', async (req, res) => {
  try {
    const debts = await Debt.findDueForEscalation();
    res.json(debts);
  } catch (error) {
    logger.error('Error fetching debts due for escalation:', error);
    res.status(500).json({ error: 'Failed to fetch debts due for escalation' });
  }
});

// Get debt statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Debt.getDebtStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching debt statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get collection efficiency report
router.get('/reports/efficiency', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const efficiency = await Debt.getCollectionEfficiency(
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json(efficiency);
  } catch (error) {
    logger.error('Error fetching collection efficiency:', error);
    res.status(500).json({ error: 'Failed to fetch collection efficiency' });
  }
});

// Escalate debt
router.post('/:id/escalate', async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id);
    
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    if (!debt.shouldEscalate()) {
      return res.status(400).json({ error: 'Debt does not meet escalation criteria' });
    }

    await debt.update({
      status: 'escalated',
      escalationDate: new Date(),
      escalationType: req.body.escalationType || 'management'
    });
    
    logger.info(`Debt escalated: ${debt.id}`);
    res.json(debt);
  } catch (error) {
    logger.error('Error escalating debt:', error);
    res.status(500).json({ error: 'Failed to escalate debt' });
  }
});

module.exports = router;
const express = require('express');
const { Debt } = require('../models/debt.model');
const { Debtor } = require('../models/debtor.model');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// Get dashboard overview statistics
router.get('/overview', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total statistics
    const [totalDebts, totalDebtors, activeDebts, overdueDebts] = await Promise.all([
      Debt.count({ where: { isActive: true } }),
      Debtor.count({ where: { isActive: true } }),
      Debt.count({ where: { isActive: true, status: { [Op.in]: ['pending', 'partial'] } } }),
      Debt.count({ 
        where: { 
          isActive: true, 
          status: { [Op.in]: ['pending', 'partial'] },
          dueDate: { [Op.lt]: new Date() }
        } 
      })
    ]);

    // Get financial statistics
    const financialStats = await Debt.findAll({
      where: { isActive: true },
      attributes: [
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('amount')), 'totalAmount'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('paidAmount')), 'totalPaid'],
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Calculate totals
    let totalAmount = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    financialStats.forEach(stat => {
      totalAmount += parseFloat(stat.totalAmount || 0);
      totalPaid += parseFloat(stat.totalPaid || 0);
    });
    totalOutstanding = totalAmount - totalPaid;

    // Get recent activity (last 7 days)
    const recentActivity = await Debt.findAll({
      where: {
        updatedAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      include: [{
        model: Debtor,
        as: 'debtor',
        attributes: ['name', 'phone']
      }],
      order: [['updatedAt', 'DESC']],
      limit: 10
    });

    // Get collection efficiency for the period
    const collectionEfficiency = await Debt.findAll({
      where: {
        updatedAt: { [Op.gte]: startDate },
        status: 'paid'
      },
      attributes: [
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'paidCount'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('amount')), 'paidAmount']
      ],
      raw: true
    });

    const efficiency = collectionEfficiency[0] || { paidCount: 0, paidAmount: 0 };
    const collectionRate = activeDebts > 0 ? (efficiency.paidCount / activeDebts * 100) : 0;

    res.json({
      overview: {
        totalDebts,
        totalDebtors,
        activeDebts,
        overdueDebts,
        collectionRate: Math.round(collectionRate * 100) / 100
      },
      financial: {
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        collectionPercentage: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 10000) / 100 : 0
      },
      recentActivity: recentActivity.map(debt => ({
        id: debt.id,
        invoiceNumber: debt.invoiceNumber,
        debtorName: debt.debtor?.name,
        amount: debt.amount,
        status: debt.status,
        updatedAt: debt.updatedAt
      })),
      period: days
    });
  } catch (error) {
    logger.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// Get debt status distribution
router.get('/debt-status-distribution', async (req, res) => {
  try {
    const distribution = await Debt.findAll({
      where: { isActive: true },
      attributes: [
        'status',
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'count'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('amount')), 'totalAmount']
      ],
      group: ['status'],
      raw: true
    });

    res.json(distribution.map(item => ({
      status: item.status,
      count: parseInt(item.count),
      totalAmount: Math.round(parseFloat(item.totalAmount || 0) * 100) / 100
    })));
  } catch (error) {
    logger.error('Error fetching debt status distribution:', error);
    res.status(500).json({ error: 'Failed to fetch debt status distribution' });
  }
});

// Get monthly collection trends
router.get('/collection-trends', async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const monthsBack = parseInt(months);
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const trends = await Debt.findAll({
      where: {
        updatedAt: { [Op.gte]: startDate },
        status: 'paid'
      },
      attributes: [
        [Debt.sequelize.fn('DATE_FORMAT', Debt.sequelize.col('updatedAt'), '%Y-%m'), 'month'],
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'count'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('amount')), 'totalAmount']
      ],
      group: [Debt.sequelize.fn('DATE_FORMAT', Debt.sequelize.col('updatedAt'), '%Y-%m')],
      order: [[Debt.sequelize.fn('DATE_FORMAT', Debt.sequelize.col('updatedAt'), '%Y-%m'), 'ASC']],
      raw: true
    });

    res.json(trends.map(trend => ({
      month: trend.month,
      count: parseInt(trend.count),
      totalAmount: Math.round(parseFloat(trend.totalAmount || 0) * 100) / 100
    })));
  } catch (error) {
    logger.error('Error fetching collection trends:', error);
    res.status(500).json({ error: 'Failed to fetch collection trends' });
  }
});

// Get overdue debts summary
router.get('/overdue-summary', async (req, res) => {
  try {
    const now = new Date();
    
    // Define overdue periods
    const periods = [
      { name: '1-30 days', min: 1, max: 30 },
      { name: '31-60 days', min: 31, max: 60 },
      { name: '61-90 days', min: 61, max: 90 },
      { name: '90+ days', min: 91, max: null }
    ];

    const overdueSummary = [];

    for (const period of periods) {
      const minDate = new Date(now);
      minDate.setDate(minDate.getDate() - period.max || 365); // Use 365 for 90+ days
      
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() - period.min);

      const whereClause = {
        isActive: true,
        status: { [Op.in]: ['pending', 'partial'] },
        dueDate: {
          [Op.lte]: period.max ? maxDate : minDate
        }
      };

      if (period.max) {
        whereClause.dueDate[Op.gte] = minDate;
      }

      const result = await Debt.findAll({
        where: whereClause,
        attributes: [
          [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'count'],
          [Debt.sequelize.fn('SUM', Debt.sequelize.col('amount')), 'totalAmount'],
          [Debt.sequelize.fn('SUM', Debt.sequelize.col('paidAmount')), 'totalPaid']
        ],
        raw: true
      });

      const data = result[0] || { count: 0, totalAmount: 0, totalPaid: 0 };
      const outstanding = parseFloat(data.totalAmount || 0) - parseFloat(data.totalPaid || 0);

      overdueSummary.push({
        period: period.name,
        count: parseInt(data.count),
        totalAmount: Math.round(parseFloat(data.totalAmount || 0) * 100) / 100,
        totalPaid: Math.round(parseFloat(data.totalPaid || 0) * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100
      });
    }

    res.json(overdueSummary);
  } catch (error) {
    logger.error('Error fetching overdue summary:', error);
    res.status(500).json({ error: 'Failed to fetch overdue summary' });
  }
});

// Get top debtors by outstanding amount
router.get('/top-debtors', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const topDebtors = await Debtor.findAll({
      where: { isActive: true },
      include: [{
        model: Debt,
        as: 'debts',
        where: { 
          isActive: true,
          status: { [Op.in]: ['pending', 'partial'] }
        },
        attributes: []
      }],
      attributes: [
        'id',
        'name',
        'phone',
        'businessType',
        'creditRating',
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('debts.id')), 'debtCount'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('debts.amount')), 'totalAmount'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('debts.paidAmount')), 'totalPaid']
      ],
      group: ['Debtor.id'],
      order: [[Debt.sequelize.fn('SUM', Debt.sequelize.literal('debts.amount - debts.paidAmount')), 'DESC']],
      limit: parseInt(limit),
      subQuery: false
    });

    const formattedDebtors = topDebtors.map(debtor => {
      const totalAmount = parseFloat(debtor.dataValues.totalAmount || 0);
      const totalPaid = parseFloat(debtor.dataValues.totalPaid || 0);
      const outstanding = totalAmount - totalPaid;

      return {
        id: debtor.id,
        name: debtor.name,
        phone: debtor.phone,
        businessType: debtor.businessType,
        creditRating: debtor.creditRating,
        debtCount: parseInt(debtor.dataValues.debtCount),
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100
      };
    });

    res.json(formattedDebtors);
  } catch (error) {
    logger.error('Error fetching top debtors:', error);
    res.status(500).json({ error: 'Failed to fetch top debtors' });
  }
});

// Get reminder statistics
router.get('/reminder-stats', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get debts that need reminders
    const needReminder = await Debt.count({
      where: {
        isActive: true,
        status: { [Op.in]: ['pending', 'partial'] },
        nextReminderDate: { [Op.lte]: new Date() }
      }
    });

    // Get debts that need escalation
    const needEscalation = await Debt.count({
      where: {
        isActive: true,
        status: { [Op.in]: ['pending', 'partial'] },
        dueDate: { [Op.lt]: new Date() },
        reminderCount: { [Op.gte]: 3 }
      }
    });

    // Get reminder frequency distribution
    const reminderDistribution = await Debt.findAll({
      where: {
        isActive: true,
        updatedAt: { [Op.gte]: startDate }
      },
      attributes: [
        'reminderCount',
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'count']
      ],
      group: ['reminderCount'],
      order: [['reminderCount', 'ASC']],
      raw: true
    });

    res.json({
      needReminder,
      needEscalation,
      reminderDistribution: reminderDistribution.map(item => ({
        reminderCount: item.reminderCount,
        count: parseInt(item.count)
      })),
      period: days
    });
  } catch (error) {
    logger.error('Error fetching reminder statistics:', error);
    res.status(500).json({ error: 'Failed to fetch reminder statistics' });
  }
});

// Get payment trends
router.get('/payment-trends', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily payment trends
    const paymentTrends = await Debt.findAll({
      where: {
        updatedAt: { [Op.gte]: startDate },
        paidAmount: { [Op.gt]: 0 }
      },
      attributes: [
        [Debt.sequelize.fn('DATE', Debt.sequelize.col('updatedAt')), 'date'],
        [Debt.sequelize.fn('COUNT', Debt.sequelize.col('id')), 'paymentCount'],
        [Debt.sequelize.fn('SUM', Debt.sequelize.col('paidAmount')), 'totalPaid']
      ],
      group: [Debt.sequelize.fn('DATE', Debt.sequelize.col('updatedAt'))],
      order: [[Debt.sequelize.fn('DATE', Debt.sequelize.col('updatedAt')), 'ASC']],
      raw: true
    });

    res.json(paymentTrends.map(trend => ({
      date: trend.date,
      paymentCount: parseInt(trend.paymentCount),
      totalPaid: Math.round(parseFloat(trend.totalPaid || 0) * 100) / 100
    })));
  } catch (error) {
    logger.error('Error fetching payment trends:', error);
    res.status(500).json({ error: 'Failed to fetch payment trends' });
  }
});

module.exports = router;
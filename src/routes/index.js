const express = require('express');
const { router: authRoutes } = require('./auth.routes');
const debtorRoutes = require('./debtor.routes');
const debtRoutes = require('./debt.routes');
const whatsappRoutes = require('./whatsapp.routes');
const dashboardRoutes = require('./dashboard.routes');
const logger = require('../utils/logger');

const router = express.Router();

// API version info
router.get('/', (req, res) => {
  res.json({
    message: 'Debt Collection API',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/debtors', debtorRoutes);
router.use('/debts', debtRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/dashboard', dashboardRoutes);

// API error handler
router.use((error, req, res, next) => {
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });
  
  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Internal server error',
      status: error.status || 500,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
const express = require('express');
const WhatsAppService = require('../services/whatsapp.service');
const DebtCollectionService = require('../services/debt-collection.service');
const logger = require('../utils/logger');

const router = express.Router();

// Get WhatsApp connection status
router.get('/status', (req, res) => {
  try {
    const whatsappService = req.app.locals.whatsappService;
    
    if (!whatsappService) {
      return res.status(503).json({ 
        error: 'WhatsApp service not initialized',
        connected: false 
      });
    }

    const status = {
      connected: whatsappService.isConnected(),
      connectionState: whatsappService.getConnectionState(),
      lastConnected: whatsappService.getLastConnectedTime(),
      phoneNumber: whatsappService.getPhoneNumber()
    };

    res.json(status);
  } catch (error) {
    logger.error('Error getting WhatsApp status:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp status' });
  }
});

// Get QR code for WhatsApp connection
router.get('/qr', (req, res) => {
  try {
    const whatsappService = req.app.locals.whatsappService;
    
    if (!whatsappService) {
      return res.status(503).json({ error: 'WhatsApp service not initialized' });
    }

    const qrCode = whatsappService.getQRCode();
    
    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not available' });
    }

    res.json({ qrCode });
  } catch (error) {
    logger.error('Error getting QR code:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

// Send test message
router.post('/send-test', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    const whatsappService = req.app.locals.whatsappService;
    
    if (!whatsappService || !whatsappService.isConnected()) {
      return res.status(503).json({ error: 'WhatsApp service not connected' });
    }

    const result = await whatsappService.sendMessage(phone, message);
    
    logger.info(`Test message sent to ${phone}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// Send reminder to specific debt
router.post('/send-reminder/:debtId', async (req, res) => {
  try {
    const { debtId } = req.params;
    const { customMessage } = req.body;
    
    const debtCollectionService = req.app.locals.debtCollectionService;
    
    if (!debtCollectionService) {
      return res.status(503).json({ error: 'Debt collection service not initialized' });
    }

    const result = await debtCollectionService.sendReminder(debtId, customMessage);
    
    logger.info(`Manual reminder sent for debt ${debtId}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error sending reminder:', error);
    res.status(500).json({ error: error.message || 'Failed to send reminder' });
  }
});

// Send payment confirmation
router.post('/send-payment-confirmation/:debtId', async (req, res) => {
  try {
    const { debtId } = req.params;
    const { paymentAmount, paymentDate } = req.body;
    
    const debtCollectionService = req.app.locals.debtCollectionService;
    
    if (!debtCollectionService) {
      return res.status(503).json({ error: 'Debt collection service not initialized' });
    }

    const result = await debtCollectionService.sendPaymentConfirmation(
      debtId, 
      paymentAmount, 
      paymentDate
    );
    
    logger.info(`Payment confirmation sent for debt ${debtId}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error sending payment confirmation:', error);
    res.status(500).json({ error: error.message || 'Failed to send payment confirmation' });
  }
});

// Send escalation notice
router.post('/send-escalation/:debtId', async (req, res) => {
  try {
    const { debtId } = req.params;
    const { escalationType } = req.body;
    
    const debtCollectionService = req.app.locals.debtCollectionService;
    
    if (!debtCollectionService) {
      return res.status(503).json({ error: 'Debt collection service not initialized' });
    }

    const result = await debtCollectionService.escalateDebt(debtId, escalationType);
    
    logger.info(`Escalation notice sent for debt ${debtId}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error sending escalation notice:', error);
    res.status(500).json({ error: error.message || 'Failed to send escalation notice' });
  }
});

// Get message history for a debtor
router.get('/messages/:debtorId', async (req, res) => {
  try {
    const { debtorId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // This would typically fetch from a message history database
    // For now, return a placeholder response
    res.json({
      messages: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        totalPages: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// Restart WhatsApp connection
router.post('/restart', async (req, res) => {
  try {
    const whatsappService = req.app.locals.whatsappService;
    
    if (!whatsappService) {
      return res.status(503).json({ error: 'WhatsApp service not initialized' });
    }

    await whatsappService.disconnect();
    await whatsappService.initialize();
    
    logger.info('WhatsApp service restarted');
    res.json({ success: true, message: 'WhatsApp service restarted' });
  } catch (error) {
    logger.error('Error restarting WhatsApp service:', error);
    res.status(500).json({ error: 'Failed to restart WhatsApp service' });
  }
});

// Get WhatsApp service statistics
router.get('/stats', (req, res) => {
  try {
    const whatsappService = req.app.locals.whatsappService;
    
    if (!whatsappService) {
      return res.status(503).json({ error: 'WhatsApp service not initialized' });
    }

    const stats = whatsappService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting WhatsApp statistics:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp statistics' });
  }
});

// Validate phone number
router.post('/validate-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const whatsappService = req.app.locals.whatsappService;
    
    if (!whatsappService || !whatsappService.isConnected()) {
      return res.status(503).json({ error: 'WhatsApp service not connected' });
    }

    const isValid = await whatsappService.isValidWhatsAppNumber(phone);
    
    res.json({ 
      phone, 
      isValid,
      formattedPhone: whatsappService.formatPhoneNumber(phone)
    });
  } catch (error) {
    logger.error('Error validating phone number:', error);
    res.status(500).json({ error: 'Failed to validate phone number' });
  }
});

// Send bulk reminders
router.post('/send-bulk-reminders', async (req, res) => {
  try {
    const { debtIds, customMessage } = req.body;
    
    if (!debtIds || !Array.isArray(debtIds) || debtIds.length === 0) {
      return res.status(400).json({ error: 'Debt IDs array is required' });
    }

    const debtCollectionService = req.app.locals.debtCollectionService;
    
    if (!debtCollectionService) {
      return res.status(503).json({ error: 'Debt collection service not initialized' });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const debtId of debtIds) {
      try {
        const result = await debtCollectionService.sendReminder(debtId, customMessage);
        results.push({ debtId, success: true, result });
        successCount++;
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        results.push({ debtId, success: false, error: error.message });
        failureCount++;
      }
    }
    
    logger.info(`Bulk reminders sent: ${successCount} success, ${failureCount} failed`);
    res.json({ 
      success: true, 
      results,
      summary: {
        total: debtIds.length,
        success: successCount,
        failed: failureCount
      }
    });
  } catch (error) {
    logger.error('Error sending bulk reminders:', error);
    res.status(500).json({ error: 'Failed to send bulk reminders' });
  }
});

module.exports = router;
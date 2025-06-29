const GeminiService = require('./gemini.service');
const logger = require('../utils/logger');
const Debt = require('../models/debt.model');
const DebtorResponse = require('../models/debtor-response.model');
const ReminderLog = require('../models/reminder-log.model');
const moment = require('moment');

class DebtCollectionService {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.geminiService = new GeminiService();
    this.setupMessageHandler();
  }

  setupMessageHandler() {
    // Register handler for incoming WhatsApp messages
    this.whatsappService.registerMessageHandler('debt-collection', async (phoneNumber, message, rawMessage) => {
      await this.handleDebtorResponse(phoneNumber, message, rawMessage);
    });
  }

  async sendDebtReminder(debtId, reminderLevel = 1) {
    try {
      const debt = await Debt.findById(debtId).populate('debtor');
      if (!debt) {
        throw new Error(`Debt with ID ${debtId} not found`);
      }

      if (debt.status === 'paid' || debt.status === 'cancelled') {
        logger.info(`Skipping reminder for debt ${debtId} - status: ${debt.status}`);
        return { success: false, reason: 'Debt already resolved' };
      }

      const debtorInfo = {
        name: debt.debtor.name,
        phone: debt.debtor.phone,
        company: debt.debtor.company
      };

      const debtDetails = {
        amount: debt.amount,
        dueDate: moment(debt.dueDate).format('DD/MM/YYYY'),
        daysOverdue: moment().diff(moment(debt.dueDate), 'days'),
        invoiceNumber: debt.invoiceNumber,
        description: debt.description,
        previousReminders: debt.reminderCount
      };

      // Generate personalized message using Gemini AI
      const message = await this.geminiService.generateDebtReminderMessage(
        debtorInfo,
        debtDetails,
        reminderLevel
      );

      // Send message via WhatsApp
      const result = await this.whatsappService.sendMessage(debt.debtor.phone, message);

      // Log the reminder
      await this.logReminder(debtId, reminderLevel, message, 'sent');

      // Update debt reminder count and last reminder date
      await Debt.findByIdAndUpdate(debtId, {
        $inc: { reminderCount: 1 },
        lastReminderDate: new Date(),
        lastReminderLevel: reminderLevel
      });

      logger.info(`Debt reminder sent successfully for debt ${debtId}`);
      return { success: true, messageId: result.key.id, message };
    } catch (error) {
      logger.error(`Failed to send debt reminder for debt ${debtId}:`, error);
      await this.logReminder(debtId, reminderLevel, null, 'failed', error.message);
      throw error;
    }
  }

  async sendBulkReminders(criteria = {}, reminderLevel = 1) {
    try {
      const query = {
        status: { $in: ['pending', 'overdue'] },
        ...criteria
      };

      const debts = await Debt.find(query).populate('debtor');
      const results = [];

      for (const debt of debts) {
        try {
          const result = await this.sendDebtReminder(debt._id, reminderLevel);
          results.push({ debtId: debt._id, ...result });
          
          // Add delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          results.push({
            debtId: debt._id,
            success: false,
            error: error.message
          });
        }
      }

      logger.info(`Bulk reminders completed: ${results.length} debts processed`);
      return results;
    } catch (error) {
      logger.error('Failed to send bulk reminders:', error);
      throw error;
    }
  }

  async handleDebtorResponse(phoneNumber, message, rawMessage) {
    try {
      // Find active debts for this phone number
      const debts = await Debt.find({
        'debtor.phone': phoneNumber,
        status: { $in: ['pending', 'overdue'] }
      }).populate('debtor');

      if (debts.length === 0) {
        logger.info(`No active debts found for phone number ${phoneNumber}`);
        return;
      }

      // Analyze the response using Gemini AI
      const analysis = await this.geminiService.analyzeDebtorResponse(message);

      // Log the response
      for (const debt of debts) {
        await this.logDebtorResponse(debt._id, phoneNumber, message, analysis);
      }

      // Handle based on analysis
      await this.processDebtorResponse(debts, phoneNumber, message, analysis);

      logger.info(`Processed debtor response from ${phoneNumber}`);
    } catch (error) {
      logger.error(`Failed to handle debtor response from ${phoneNumber}:`, error);
    }
  }

  async processDebtorResponse(debts, phoneNumber, message, analysis) {
    try {
      const primaryDebt = debts[0]; // Use first debt for response context
      
      const debtorInfo = {
        name: primaryDebt.debtor.name,
        phone: primaryDebt.debtor.phone,
        company: primaryDebt.debtor.company
      };

      const debtDetails = {
        amount: debts.reduce((sum, debt) => sum + debt.amount, 0),
        daysOverdue: Math.max(...debts.map(debt => 
          moment().diff(moment(debt.dueDate), 'days')
        )),
        invoiceNumber: debts.map(debt => debt.invoiceNumber).join(', ')
      };

      let responseMessage = null;

      switch (analysis.intent) {
        case 'payment_promise':
          responseMessage = await this.handlePaymentPromise(debtorInfo, debtDetails, analysis);
          break;
        
        case 'dispute':
          responseMessage = await this.handleDispute(debtorInfo, debtDetails, message);
          break;
        
        case 'financial_hardship':
        case 'payment_plan_request':
          responseMessage = await this.handleNegotiation(debtorInfo, debtDetails, message);
          break;
        
        case 'question':
          responseMessage = await this.handleQuestion(debtorInfo, debtDetails, message);
          break;
        
        case 'acknowledgment':
          responseMessage = await this.handleAcknowledgment(debtorInfo, debtDetails);
          break;
        
        default:
          responseMessage = await this.geminiService.generateNegotiationResponse(
            debtorInfo, debtDetails, message
          );
      }

      if (responseMessage) {
        await this.whatsappService.sendMessage(phoneNumber, responseMessage);
        
        // Log the automated response
        for (const debt of debts) {
          await this.logReminder(debt._id, 0, responseMessage, 'auto_response');
        }
      }

      // Update debt status based on analysis
      if (analysis.suggested_action === 'escalate') {
        await this.scheduleEscalation(debts);
      }
    } catch (error) {
      logger.error('Failed to process debtor response:', error);
    }
  }

  async handlePaymentPromise(debtorInfo, debtDetails, analysis) {
    const message = `Terima kasih ${debtorInfo.name} atas konfirmasi pembayaran Anda. Kami akan memantau pembayaran sesuai dengan komitmen yang Anda berikan. Jika ada kendala, silakan hubungi kami segera.\n\nTotal yang harus dibayar: Rp ${debtDetails.amount.toLocaleString('id-ID')}\n\nTerima kasih atas kerjasamanya.`;
    return message;
  }

  async handleDispute(debtorInfo, debtDetails, originalMessage) {
    return await this.geminiService.generateNegotiationResponse(
      debtorInfo, debtDetails, originalMessage
    );
  }

  async handleNegotiation(debtorInfo, debtDetails, originalMessage) {
    return await this.geminiService.generateNegotiationResponse(
      debtorInfo, debtDetails, originalMessage
    );
  }

  async handleQuestion(debtorInfo, debtDetails, originalMessage) {
    return await this.geminiService.generateNegotiationResponse(
      debtorInfo, debtDetails, originalMessage
    );
  }

  async handleAcknowledgment(debtorInfo, debtDetails) {
    const message = `Terima kasih ${debtorInfo.name} atas tanggapan Anda. Kami menunggu pembayaran segera untuk menyelesaikan kewajiban sebesar Rp ${debtDetails.amount.toLocaleString('id-ID')}.\n\nJika memerlukan bantuan atau informasi lebih lanjut, silakan hubungi kami.`;
    return message;
  }

  async sendPaymentConfirmation(debtId, paymentDetails) {
    try {
      const debt = await Debt.findById(debtId).populate('debtor');
      if (!debt) {
        throw new Error(`Debt with ID ${debtId} not found`);
      }

      const debtorInfo = {
        name: debt.debtor.name,
        company: debt.debtor.company
      };

      const message = await this.geminiService.generatePaymentConfirmationMessage(
        debtorInfo, paymentDetails
      );

      await this.whatsappService.sendMessage(debt.debtor.phone, message);
      
      // Log the confirmation
      await this.logReminder(debtId, 0, message, 'payment_confirmation');

      logger.info(`Payment confirmation sent for debt ${debtId}`);
      return { success: true, message };
    } catch (error) {
      logger.error(`Failed to send payment confirmation for debt ${debtId}:`, error);
      throw error;
    }
  }

  async escalateDebt(debtId, escalationType = 'legal') {
    try {
      const debt = await Debt.findById(debtId).populate('debtor');
      if (!debt) {
        throw new Error(`Debt with ID ${debtId} not found`);
      }

      const debtorInfo = {
        name: debt.debtor.name,
        company: debt.debtor.company
      };

      const debtDetails = {
        amount: debt.amount,
        daysOverdue: moment().diff(moment(debt.dueDate), 'days'),
        previousReminders: debt.reminderCount
      };

      const message = await this.geminiService.generateEscalationMessage(
        debtorInfo, debtDetails, escalationType
      );

      await this.whatsappService.sendMessage(debt.debtor.phone, message);
      
      // Update debt status
      await Debt.findByIdAndUpdate(debtId, {
        status: 'escalated',
        escalationType,
        escalationDate: new Date()
      });

      // Log the escalation
      await this.logReminder(debtId, 99, message, 'escalation');

      logger.info(`Debt ${debtId} escalated successfully`);
      return { success: true, message };
    } catch (error) {
      logger.error(`Failed to escalate debt ${debtId}:`, error);
      throw error;
    }
  }

  async scheduleEscalation(debts) {
    for (const debt of debts) {
      if (debt.reminderCount >= 5 && debt.status !== 'escalated') {
        await this.escalateDebt(debt._id);
      }
    }
  }

  async logReminder(debtId, level, message, status, error = null) {
    try {
      await ReminderLog.create({
        debt: debtId,
        level,
        message,
        status,
        error,
        sentAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to log reminder:', error);
    }
  }

  async logDebtorResponse(debtId, phoneNumber, message, analysis) {
    try {
      await DebtorResponse.create({
        debt: debtId,
        phoneNumber,
        message,
        analysis,
        receivedAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to log debtor response:', error);
    }
  }

  async getDebtStatistics() {
    try {
      const stats = await Debt.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const overdueDebts = await Debt.countDocuments({
        dueDate: { $lt: new Date() },
        status: { $in: ['pending', 'overdue'] }
      });

      return {
        byStatus: stats,
        overdueCount: overdueDebts,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to get debt statistics:', error);
      throw error;
    }
  }
}

module.exports = DebtCollectionService;
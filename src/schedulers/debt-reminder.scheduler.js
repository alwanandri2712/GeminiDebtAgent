const cron = require('node-cron');
const logger = require('../utils/logger');
const Debt = require('../models/debt.model');
const Debtor = require('../models/debtor.model');

class DebtReminderScheduler {
  constructor(debtCollectionService) {
    this.debtCollectionService = debtCollectionService;
    this.tasks = [];
  }

  startScheduledTasks() {
    // Send reminders every hour
    const reminderTask = cron.schedule('0 * * * *', async () => {
      await this.processReminders();
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'Asia/Jakarta'
    });

    // Process escalations every 6 hours
    const escalationTask = cron.schedule('0 */6 * * *', async () => {
      await this.processEscalations();
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'Asia/Jakarta'
    });

    // Daily statistics and cleanup at midnight
    const dailyTask = cron.schedule('0 0 * * *', async () => {
      await this.generateDailyStats();
      await this.cleanupOldData();
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'Asia/Jakarta'
    });

    // Weekly report every Monday at 9 AM
    const weeklyTask = cron.schedule('0 9 * * 1', async () => {
      await this.generateWeeklyReport();
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'Asia/Jakarta'
    });

    this.tasks = [reminderTask, escalationTask, dailyTask, weeklyTask];
    
    // Start all tasks
    this.tasks.forEach(task => task.start());
    
    logger.info('Debt reminder scheduler started with all tasks');
  }

  async processReminders() {
    try {
      logger.info('Starting reminder processing...');
      
      const debtsForReminder = await Debt.findDueForReminder();
      logger.info(`Found ${debtsForReminder.length} debts due for reminder`);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const debt of debtsForReminder) {
        try {
          if (debt.canSendReminder()) {
            await this.debtCollectionService.sendReminder(debt.id);
            successCount++;
            
            // Add delay between messages to avoid rate limiting
            await this.delay(2000);
          }
        } catch (error) {
          logger.error(`Failed to send reminder for debt ${debt.id}:`, error);
          failureCount++;
        }
      }
      
      logger.info(`Reminder processing completed: ${successCount} sent, ${failureCount} failed`);
    } catch (error) {
      logger.error('Error in reminder processing:', error);
    }
  }

  async processEscalations() {
    try {
      logger.info('Starting escalation processing...');
      
      const debtsForEscalation = await Debt.findDueForEscalation();
      logger.info(`Found ${debtsForEscalation.length} debts due for escalation`);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const debt of debtsForEscalation) {
        try {
          if (debt.shouldEscalate()) {
            await this.debtCollectionService.escalateDebt(debt.id);
            successCount++;
          }
        } catch (error) {
          logger.error(`Failed to escalate debt ${debt.id}:`, error);
          failureCount++;
        }
      }
      
      logger.info(`Escalation processing completed: ${successCount} escalated, ${failureCount} failed`);
    } catch (error) {
      logger.error('Error in escalation processing:', error);
    }
  }

  async generateDailyStats() {
    try {
      logger.info('Generating daily statistics...');
      
      const stats = await Debt.getDebtStatistics();
      const debtorStats = await Debtor.getDebtorStats();
      
      logger.info('Daily Statistics:', {
        debts: stats,
        debtors: debtorStats,
        timestamp: new Date().toISOString()
      });
      
      // You can save these stats to database or send to monitoring service
      
    } catch (error) {
      logger.error('Error generating daily statistics:', error);
    }
  }

  async cleanupOldData() {
    try {
      logger.info('Starting data cleanup...');
      
      // Clean up old logs, temporary files, etc.
      // This is a placeholder for cleanup operations
      
      logger.info('Data cleanup completed');
    } catch (error) {
      logger.error('Error in data cleanup:', error);
    }
  }

  async generateWeeklyReport() {
    try {
      logger.info('Generating weekly report...');
      
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const efficiency = await Debt.getCollectionEfficiency(startDate, endDate);
      
      logger.info('Weekly Collection Report:', {
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        efficiency,
        timestamp: new Date().toISOString()
      });
      
      // You can send this report via email or save to database
      
    } catch (error) {
      logger.error('Error generating weekly report:', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stopAllTasks() {
    this.tasks.forEach(task => {
      if (task) {
        task.stop();
      }
    });
    logger.info('All scheduled tasks stopped');
  }

  getTaskStatus() {
    return this.tasks.map((task, index) => ({
      index,
      running: task ? task.running : false
    }));
  }
}

let schedulerInstance = null;

function startScheduledTasks(debtCollectionService) {
  if (!schedulerInstance) {
    schedulerInstance = new DebtReminderScheduler(debtCollectionService);
    schedulerInstance.startScheduledTasks();
  }
  return schedulerInstance;
}

function stopScheduledTasks() {
  if (schedulerInstance) {
    schedulerInstance.stopAllTasks();
    schedulerInstance = null;
  }
}

function getSchedulerStatus() {
  return schedulerInstance ? schedulerInstance.getTaskStatus() : [];
}

module.exports = {
  startScheduledTasks,
  stopScheduledTasks,
  getSchedulerStatus,
  DebtReminderScheduler
};
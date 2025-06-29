const { DataTypes, Model, Op } = require('sequelize');
const moment = require('moment');
const sequelize = require('../config/database');

class Debt extends Model {
  // Instance methods
  updateStatus() {
    const totalPaid = this.totalPaid;
    const isOverdue = moment().isAfter(moment(this.dueDate));
    
    if (totalPaid >= this.amount) {
      this.status = 'paid';
    } else if (totalPaid > 0) {
      this.status = 'partially_paid';
    } else if (isOverdue && this.status === 'pending') {
      this.status = 'overdue';
    }
  }

  calculateNextReminderDate() {
    if (this.status === 'paid' || this.status === 'cancelled' || this.status === 'written_off') {
      this.nextReminderDate = null;
      return;
    }
    
    const intervalHours = parseInt(process.env.DEFAULT_REMINDER_INTERVAL_HOURS) || 24;
    const maxAttempts = parseInt(process.env.MAX_REMINDER_ATTEMPTS) || 5;
    
    if (this.reminderCount >= maxAttempts) {
      this.nextReminderDate = null;
      return;
    }
    
    const baseDate = this.lastReminderDate || this.dueDate;
    this.nextReminderDate = moment(baseDate).add(intervalHours, 'hours').toDate();
  }

  async addPayment(paymentData, verifiedBy = null) {
    const payment = {
      ...paymentData,
      verifiedBy,
      verifiedAt: verifiedBy ? new Date() : null
    };
    
    this.payments = [...(this.payments || []), payment];
    this.updateStatus();
    
    // Update debtor's payment history
    const Debtor = require('./debtor.model');
    const debtor = await Debtor.findByPk(this.debtorId);
    if (debtor) {
      const paymentDays = moment(payment.paymentDate).diff(moment(this.dueDate), 'days');
      const paymentStatus = paymentDays <= 0 ? 'on_time' : 'late';
      await debtor.updatePaymentHistory(paymentStatus, Math.max(0, paymentDays));
    }
    
    await this.save();
    return payment;
  }

  canSendReminder() {
    if (this.status === 'paid' || this.status === 'cancelled' || this.status === 'written_off') {
      return false;
    }
    
    const maxAttempts = parseInt(process.env.MAX_REMINDER_ATTEMPTS) || 5;
    if (this.reminderCount >= maxAttempts) {
      return false;
    }
    
    if (this.nextReminderDate && moment().isBefore(moment(this.nextReminderDate))) {
      return false;
    }
    
    return true;
  }

  shouldEscalate() {
    const escalationThreshold = parseInt(process.env.ESCALATION_THRESHOLD_DAYS) || 7;
    const maxReminders = parseInt(process.env.MAX_REMINDER_ATTEMPTS) || 5;
    
    return (
      this.daysOverdue >= escalationThreshold ||
      this.reminderCount >= maxReminders
    ) && this.status !== 'escalated';
  }

  getReminderLevel() {
    if (this.reminderCount === 0) return 1;
    if (this.reminderCount <= 2) return 2;
    if (this.reminderCount <= 4) return 3;
    if (this.reminderCount <= 6) return 4;
    return 5;
  }

  // Getters for virtual fields
  get daysOverdue() {
    if (this.status === 'paid' || this.status === 'cancelled') {
      return 0;
    }
    const today = moment();
    const due = moment(this.dueDate);
    return Math.max(0, today.diff(due, 'days'));
  }

  get totalPaid() {
    return (this.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
  }

  get remainingBalance() {
    return Math.max(0, this.amount - this.totalPaid);
  }

  get paymentPercentage() {
    if (this.amount === 0) return 0;
    return Math.min(100, (this.totalPaid / this.amount) * 100);
  }

  get formattedAmount() {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: this.currency
    }).format(this.amount);
  }

  get formattedRemainingBalance() {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: this.currency
    }).format(this.remainingBalance);
  }

  get ageInDays() {
    return moment().diff(moment(this.issueDate), 'days');
  }

  // Static methods
  static findOverdue() {
    return this.findAll({
      where: {
        dueDate: { [Op.lt]: new Date() },
        status: { [Op.in]: ['pending', 'overdue', 'partially_paid'] },
        isActive: true
      }
    });
  }

  static findDueForReminder() {
    return this.findAll({
      where: {
        [Op.or]: [
          { nextReminderDate: { [Op.lte]: new Date() } },
          { 
            nextReminderDate: null,
            dueDate: { [Op.lt]: new Date() },
            reminderCount: 0
          }
        ],
        status: { [Op.in]: ['pending', 'overdue', 'partially_paid'] },
        isActive: true
      },
      include: ['Debtor']
    });
  }

  static findDueForEscalation() {
    const escalationThreshold = parseInt(process.env.ESCALATION_THRESHOLD_DAYS) || 7;
    const maxReminders = parseInt(process.env.MAX_REMINDER_ATTEMPTS) || 5;
    
    return this.findAll({
      where: {
        [Op.or]: [
          {
            dueDate: { [Op.lte]: moment().subtract(escalationThreshold, 'days').toDate() },
            status: { [Op.in]: ['overdue', 'partially_paid'] }
          },
          {
            reminderCount: { [Op.gte]: maxReminders },
            status: { [Op.in]: ['pending', 'overdue', 'partially_paid'] }
          }
        ],
        status: { [Op.ne]: 'escalated' },
        isActive: true
      },
      include: ['Debtor']
    });
  }

  static async getDebtStatistics() {
    const stats = await this.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('AVG', sequelize.col('amount')), 'avgAmount']
      ],
      group: ['status']
    });
    
    const overdueStats = await this.findAll({
      where: {
        dueDate: { [Op.lt]: new Date() },
        status: { [Op.in]: ['pending', 'overdue', 'partially_paid'] }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('AVG', sequelize.literal('DATEDIFF(NOW(), dueDate)')), 'avgDaysOverdue']
      ]
    });
    
    return {
      byStatus: stats,
      overdue: overdueStats[0] || { count: 0, totalAmount: 0, avgDaysOverdue: 0 },
      generatedAt: new Date()
    };
  }

  static async getCollectionEfficiency(startDate, endDate) {
    const results = await this.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalDebts'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "paid" THEN 1 ELSE 0 END')), 'paidDebts'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "paid" THEN amount ELSE 0 END')), 'paidAmount']
      ]
    });
    
    const result = results[0] || {
      totalDebts: 0,
      totalAmount: 0,
      paidDebts: 0,
      paidAmount: 0
    };
    
    result.collectionRate = result.totalDebts > 0 ? (result.paidDebts / result.totalDebts) * 100 : 0;
    result.amountCollectionRate = result.totalAmount > 0 ? (result.paidAmount / result.totalAmount) * 100 : 0;
    
    return result;
  }
}

const debtAttributes = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  debtorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'debtors',
      key: 'id'
    }
  },
  invoiceNumber: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.ENUM('IDR', 'USD', 'EUR'),
    defaultValue: 'IDR'
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('service', 'product', 'loan', 'penalty', 'other'),
    defaultValue: 'service'
  },
  issueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'overdue', 'paid', 'partially_paid', 'cancelled', 'escalated', 'written_off'),
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  paymentTerms: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.ENUM('bank_transfer', 'cash', 'check', 'credit_card', 'digital_wallet', 'other'),
    defaultValue: 'bank_transfer'
  },
  bankDetails: {
    type: DataTypes.JSON,
    allowNull: true
  },
  payments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  reminderCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastReminderDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastReminderLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  nextReminderDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  escalationDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  escalationType: {
    type: DataTypes.ENUM('legal', 'collection_agency', 'management', 'write_off'),
    allowNull: true
  },
  assignedToId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updatedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
};

const debtOptions = {
  sequelize,
  modelName: 'Debt',
  tableName: 'debts',
  timestamps: true,
  indexes: [
    { fields: ['debtorId'] },
    { fields: ['invoiceNumber'], unique: true },
    { fields: ['status'] },
    { fields: ['dueDate'] },
    { fields: ['amount'] },
    { fields: ['priority'] },
    { fields: ['assignedToId'] },
    { fields: ['createdAt'] },
    { fields: ['nextReminderDate'] },
    { fields: ['status', 'dueDate'] },
    { fields: ['debtorId', 'status'] },
    { fields: ['assignedToId', 'status'] }
  ]
};

// Initialize the model
Debt.init(debtAttributes, debtOptions);

// Hooks
Debt.addHook('beforeSave', (debt) => {
  // Auto-update status based on payments and due date
  debt.updateStatus();
  
  // Calculate next reminder date
  debt.calculateNextReminderDate();
});

module.exports = Debt;
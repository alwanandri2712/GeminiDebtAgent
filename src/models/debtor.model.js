const { Model, DataTypes } = require('sequelize');
const database = require('../config/database');

class Debtor extends Model {
  // Instance methods
  async updatePaymentHistory(paymentStatus, paymentDays = 0) {
    this.payment_history.total_debts += 1;
    
    switch (paymentStatus) {
      case 'on_time':
        this.payment_history.paid_on_time += 1;
        break;
      case 'late':
        this.payment_history.paid_late += 1;
        break;
      case 'defaulted':
        this.payment_history.defaulted += 1;
        break;
    }
    
    // Update average payment days
    const totalPaid = this.payment_history.paid_on_time + this.payment_history.paid_late;
    if (totalPaid > 0) {
      this.payment_history.average_payment_days = 
        ((this.payment_history.average_payment_days * (totalPaid - 1)) + paymentDays) / totalPaid;
    }
    
    this.last_payment_date = new Date();
    await this.save();
  }

  updateCreditRating() {
    const { paid_on_time, paid_late, defaulted, total_debts } = this.payment_history;
    
    if (total_debts === 0) {
      this.credit_rating = 'unknown';
      return;
    }
    
    const onTimeRate = paid_on_time / total_debts;
    const defaultRate = defaulted / total_debts;
    
    if (defaultRate > 0.3) {
      this.credit_rating = 'poor';
    } else if (defaultRate > 0.1 || onTimeRate < 0.5) {
      this.credit_rating = 'fair';
    } else if (onTimeRate >= 0.8) {
      this.credit_rating = 'excellent';
    } else {
      this.credit_rating = 'good';
    }
  }

  canContact() {
    if (this.is_blacklisted || !this.is_active) {
      return false;
    }
    
    // Check contact time preferences
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(this.preferred_contact_time.start.split(':')[0]);
    const endHour = parseInt(this.preferred_contact_time.end.split(':')[0]);
    
    return currentHour >= startHour && currentHour <= endHour;
  }

  get displayName() {
    return this.company ? `${this.name} (${this.company})` : this.name;
  }

  get formattedPhone() {
    let phone = this.phone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    } else if (!phone.startsWith('62')) {
      phone = '62' + phone;
    }
    return phone;
  }

  // Static methods
  static async findByPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return await this.findOne({ 
      where: { 
        phone: { 
          [database.getSequelize().Op.like]: `%${cleanPhone}%` 
        } 
      } 
    });
  }

  static async getActiveDebtors() {
    return await this.findAll({ 
      where: { 
        is_active: true, 
        is_blacklisted: false 
      } 
    });
  }

  static async getDebtorStats() {
    const sequelize = database.getSequelize();
    const stats = await this.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_active = 1 THEN 1 ELSE 0 END')), 'active'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_blacklisted = 1 THEN 1 ELSE 0 END')), 'blacklisted']
      ],
      raw: true
    });
    
    return stats[0] || {
      total: 0,
      active: 0,
      blacklisted: 0
    };
  }
}



// Define model attributes
const debtorAttributes = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      is: /^[0-9+\-\s()]+$/,
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  company: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  address: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      street: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'Indonesia'
    }
  },
  contact_person: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      name: null,
      position: null,
      phone: null,
      email: null
    }
  },
  business_type: {
    type: DataTypes.ENUM('individual', 'small_business', 'corporation', 'government', 'ngo'),
    defaultValue: 'individual'
  },
  credit_rating: {
    type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'unknown'),
    defaultValue: 'unknown'
  },
  payment_history: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      total_debts: 0,
      paid_on_time: 0,
      paid_late: 0,
      defaulted: 0,
      average_payment_days: 0
    }
  },
  preferred_contact_method: {
    type: DataTypes.ENUM('whatsapp', 'email', 'phone', 'sms'),
    defaultValue: 'whatsapp'
  },
  preferred_contact_time: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      start: '09:00',
      end: '17:00',
      timezone: 'Asia/Jakarta'
    }
  },
  language: {
    type: DataTypes.ENUM('id', 'en'),
    defaultValue: 'id'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  is_blacklisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  blacklist_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_contact_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_payment_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
};

const debtorOptions = {
  sequelize: database.getSequelize(),
  modelName: 'Debtor',
  tableName: 'debtors',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['phone'] },
    { fields: ['email'] },
    { fields: ['company'] },
    { fields: ['is_active'] },
    { fields: ['is_blacklisted'] },
    { fields: ['created_at'] }
  ]
};

// Initialize the model
Debtor.init(debtorAttributes, debtorOptions);

// Hooks
Debtor.addHook('beforeSave', (debtor) => {
  if (debtor.changed('phone')) {
    // Clean and format phone number
    debtor.phone = debtor.phone.replace(/\D/g, '');
  }
});

module.exports = Debtor;
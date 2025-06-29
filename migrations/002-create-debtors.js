'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('debtors', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      company: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      address: {
        type: Sequelize.JSON,
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
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {
          name: null,
          position: null,
          phone: null,
          email: null
        }
      },
      business_type: {
        type: Sequelize.ENUM('individual', 'small_business', 'corporation', 'government', 'ngo'),
        defaultValue: 'individual'
      },
      credit_rating: {
        type: Sequelize.ENUM('excellent', 'good', 'fair', 'poor', 'unknown'),
        defaultValue: 'unknown'
      },
      payment_history: {
        type: Sequelize.JSON,
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
        type: Sequelize.ENUM('whatsapp', 'email', 'phone', 'sms'),
        defaultValue: 'whatsapp'
      },
      preferred_contact_time: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {
          start: '09:00',
          end: '17:00',
          timezone: 'Asia/Jakarta'
        }
      },
      language: {
        type: Sequelize.ENUM('id', 'en'),
        defaultValue: 'id'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      is_blacklisted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      blacklist_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      last_contact_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_payment_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('debtors', ['phone']);
    await queryInterface.addIndex('debtors', ['email']);
    await queryInterface.addIndex('debtors', ['company']);
    await queryInterface.addIndex('debtors', ['is_active']);
    await queryInterface.addIndex('debtors', ['is_blacklisted']);
    await queryInterface.addIndex('debtors', ['created_at']);
    await queryInterface.addIndex('debtors', ['business_type']);
    await queryInterface.addIndex('debtors', ['credit_rating']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('debtors');
  }
};
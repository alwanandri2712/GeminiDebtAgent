'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('debts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      debtor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'debtors',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      original_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      paid_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      outstanding_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'IDR'
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'partial', 'paid', 'overdue', 'written_off'),
        defaultValue: 'pending'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
      },
      payment_terms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Payment terms in days'
      },
      late_fee: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      interest_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0.00,
        comment: 'Annual interest rate percentage'
      },
      payment_history: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      reminder_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      last_reminder_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      next_reminder_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      escalation_level: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: '0=no escalation, 1=first notice, 2=final notice, 3=legal action'
      },
      escalation_type: {
        type: Sequelize.ENUM('none', 'email', 'phone', 'legal', 'collection_agency'),
        defaultValue: 'none'
      },
      assigned_to_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      attachments: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by_id: {
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
    await queryInterface.addIndex('debts', ['debtor_id']);
    await queryInterface.addIndex('debts', ['invoice_number']);
    await queryInterface.addIndex('debts', ['status']);
    await queryInterface.addIndex('debts', ['priority']);
    await queryInterface.addIndex('debts', ['due_date']);
    await queryInterface.addIndex('debts', ['next_reminder_date']);
    await queryInterface.addIndex('debts', ['escalation_level']);
    await queryInterface.addIndex('debts', ['assigned_to_id']);
    await queryInterface.addIndex('debts', ['is_active']);
    await queryInterface.addIndex('debts', ['created_at']);
    await queryInterface.addIndex('debts', ['outstanding_amount']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('debts');
  }
};
'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await queryInterface.bulkInsert('users', [
      {
        username: 'admin',
        email: 'admin@geminiagent.com',
        password: hashedPassword,
        full_name: 'System Administrator',
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'collector1',
        email: 'collector@geminiagent.com',
        password: hashedPassword,
        full_name: 'Debt Collector',
        role: 'collector',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', {
      username: ['admin', 'collector1']
    }, {});
  }
};
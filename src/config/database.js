const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.sequelize = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        database: process.env.DB_NAME || 'gemini_debt_agent',
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: (msg) => logger.debug(msg),
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        define: {
          timestamps: true,
          underscored: true,
          freezeTableName: true
        },
        timezone: '+07:00' // Jakarta timezone
      };

      this.sequelize = new Sequelize(config);

      // Test connection
      await this.sequelize.authenticate();
      this.isConnected = true;
      
      logger.info('MySQL database connected successfully');
      return this.sequelize;
    } catch (error) {
      logger.error('Failed to connect to MySQL database:', error);
      throw error;
    }
  }

  async syncModels(force = false) {
    try {
      if (!this.sequelize) {
        throw new Error('Database not initialized');
      }

      await this.sequelize.sync({ force, alter: !force });
      logger.info(`Database models synchronized ${force ? '(forced)' : '(altered)'}`);
    } catch (error) {
      logger.error('Failed to sync database models:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.sequelize) {
        await this.sequelize.close();
        this.isConnected = false;
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }

  getSequelize() {
    return this.sequelize;
  }

  isReady() {
    return this.isConnected;
  }

  async testConnection() {
    try {
      if (!this.sequelize) {
        return false;
      }
      
      await this.sequelize.authenticate();
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query, options = {}) {
    try {
      if (!this.sequelize) {
        throw new Error('Database not initialized');
      }

      const [results, metadata] = await this.sequelize.query(query, {
        type: Sequelize.QueryTypes.SELECT,
        ...options
      });

      return results;
    } catch (error) {
      logger.error('Failed to execute query:', error);
      throw error;
    }
  }

  async createDatabase() {
    try {
      const tempSequelize = new Sequelize({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: false
      });

      await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'gemini_debt_agent'}\``);
      await tempSequelize.close();
      
      logger.info(`Database '${process.env.DB_NAME || 'gemini_debt_agent'}' created or already exists`);
    } catch (error) {
      logger.error('Failed to create database:', error);
      throw error;
    }
  }
}

// Singleton instance
const database = new Database();

module.exports = database;
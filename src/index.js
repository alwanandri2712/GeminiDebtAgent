const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const database = require('./config/database');
const logger = require('./utils/logger');
const WhatsAppService = require('./services/whatsapp.service');
const DebtCollectionService = require('./services/debt-collection.service');
const routes = require('./routes');
const { startScheduledTasks } = require('./schedulers/debt-reminder.scheduler');

// Load environment variables
dotenv.config();

class GeminiDebtAgent {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.whatsappService = null;
    this.debtCollectionService = null;
  }

  async initialize() {
    try {
      // Connect to database
      await this.connectDatabase();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Initialize services
      await this.initializeServices();
      
      // Start scheduled tasks
      this.startSchedulers();
      
      // Start server
      this.startServer();
      
      logger.info('GeminiDebtAgent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize GeminiDebtAgent:', error);
      process.exit(1);
    }
  }

  async connectDatabase() {
    try {
      await database.initialize();
      logger.info('Connected to MySQL database successfully');
    } catch (error) {
      logger.error('MySQL database connection failed:', error);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    this.app.use('/api', routes);
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        whatsappConnected: this.whatsappService?.isConnected() || false
      });
    });
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
    
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  async initializeServices() {
    // Initialize WhatsApp service
    this.whatsappService = new WhatsAppService();
    await this.whatsappService.initialize();
    
    // Initialize debt collection service
    this.debtCollectionService = new DebtCollectionService(this.whatsappService);
    
    logger.info('All services initialized successfully');
  }

  startSchedulers() {
    startScheduledTasks(this.debtCollectionService);
    logger.info('Scheduled tasks started');
  }

  startServer() {
    this.app.listen(this.port, () => {
      logger.info(`GeminiDebtAgent server running on port ${this.port}`);
    });
  }

  async shutdown() {
    logger.info('Shutting down GeminiDebtAgent...');
    
    if (this.whatsappService) {
      await this.whatsappService.disconnect();
    }
    
    await database.close();
    logger.info('GeminiDebtAgent shutdown complete');
    process.exit(0);
  }
}

// Initialize application
const app = new GeminiDebtAgent();
app.initialize();

// Graceful shutdown handlers
process.on('SIGTERM', () => app.shutdown());
process.on('SIGINT', () => app.shutdown());

module.exports = app;
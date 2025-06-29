const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'gemini-debt-agent'
  },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write debug logs to debug.log in development
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'debug.log'),
        level: 'debug',
        maxsize: 5242880, // 5MB
        maxFiles: 3,
        tailable: true
      })
    ] : [])
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 3
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 3
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'debug'
  }));
}

// Add custom methods for structured logging
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  };
  
  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

logger.logWhatsApp = (action, phoneNumber, message, success = true) => {
  const logData = {
    action,
    phoneNumber: phoneNumber ? phoneNumber.replace(/\d(?=\d{4})/g, '*') : 'unknown', // Mask phone number
    messageLength: message ? message.length : 0,
    success,
    timestamp: new Date().toISOString()
  };
  
  if (success) {
    logger.info('WhatsApp Action', logData);
  } else {
    logger.error('WhatsApp Action Failed', logData);
  }
};

logger.logDebtCollection = (action, debtId, debtorName, amount, success = true, error = null) => {
  const logData = {
    action,
    debtId,
    debtorName,
    amount,
    success,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    logData.error = error.message || error;
  }
  
  if (success) {
    logger.info('Debt Collection Action', logData);
  } else {
    logger.error('Debt Collection Action Failed', logData);
  }
};

logger.logGeminiAI = (action, prompt, response, success = true, error = null) => {
  const logData = {
    action,
    promptLength: prompt ? prompt.length : 0,
    responseLength: response ? response.length : 0,
    success,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    logData.error = error.message || error;
  }
  
  if (success) {
    logger.info('Gemini AI Action', logData);
  } else {
    logger.error('Gemini AI Action Failed', logData);
  }
};

logger.logDatabase = (action, table, recordId, success = true, error = null) => {
  const logData = {
    action,
    table,
    recordId,
    success,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    logData.error = error.message || error;
  }
  
  if (success) {
    logger.debug('Database Action', logData);
  } else {
    logger.error('Database Action Failed', logData);
  }
};

// Performance monitoring
logger.startTimer = (label) => {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      logger.debug('Performance Timer', {
        label,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
      return duration;
    }
  };
};

// Memory usage logging
logger.logMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  const formatBytes = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };
  
  logger.debug('Memory Usage', {
    rss: formatBytes(memUsage.rss),
    heapTotal: formatBytes(memUsage.heapTotal),
    heapUsed: formatBytes(memUsage.heapUsed),
    external: formatBytes(memUsage.external),
    timestamp: new Date().toISOString()
  });
};

// Log memory usage every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    logger.logMemoryUsage();
  }, 5 * 60 * 1000);
}

module.exports = logger;
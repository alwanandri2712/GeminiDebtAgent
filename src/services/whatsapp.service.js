const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
  constructor() {
    this.socket = null;
    this.isReady = false;
    this.authDir = path.join(__dirname, '../../auth_info');
    this.messageHandlers = new Map();
  }

  async initialize() {
    try {
      // Ensure auth directory exists
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: {
          level: 'silent',
          child: () => ({ level: 'silent' })
        },
        browser: ['GeminiDebtAgent', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true
      });

      this.setupEventHandlers(saveCreds);
      
      logger.info('WhatsApp service initialized');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service:', error);
      throw error;
    }
  }

  setupEventHandlers(saveCreds) {
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        logger.info('QR Code generated, scan with WhatsApp');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        logger.info('Connection closed due to:', lastDisconnect?.error);
        
        if (shouldReconnect) {
          logger.info('Reconnecting to WhatsApp...');
          this.initialize();
        } else {
          logger.info('WhatsApp logged out, please scan QR code again');
          this.isReady = false;
        }
      } else if (connection === 'open') {
        logger.info('WhatsApp connected successfully');
        this.isReady = true;
      }
    });

    this.socket.ev.on('creds.update', saveCreds);
    
    this.socket.ev.on('messages.upsert', async (messageUpdate) => {
      const { messages } = messageUpdate;
      
      for (const message of messages) {
        if (!message.key.fromMe && message.message) {
          await this.handleIncomingMessage(message);
        }
      }
    });
  }

  async handleIncomingMessage(message) {
    try {
      const phoneNumber = message.key.remoteJid;
      const messageText = this.extractMessageText(message);
      
      if (messageText) {
        logger.info(`Received message from ${phoneNumber}: ${messageText}`);
        
        // Notify registered handlers
        for (const [handlerName, handler] of this.messageHandlers) {
          try {
            await handler(phoneNumber, messageText, message);
          } catch (error) {
            logger.error(`Error in message handler ${handlerName}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

  extractMessageText(message) {
    if (message.message?.conversation) {
      return message.message.conversation;
    }
    
    if (message.message?.extendedTextMessage?.text) {
      return message.message.extendedTextMessage.text;
    }
    
    return null;
  }

  async sendMessage(phoneNumber, message, options = {}) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp is not connected');
      }

      const jid = this.formatPhoneNumber(phoneNumber);
      
      const messageOptions = {
        text: message,
        ...options
      };

      const result = await this.socket.sendMessage(jid, messageOptions);
      
      logger.info(`Message sent to ${phoneNumber}: ${message}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendTemplateMessage(phoneNumber, template, variables = {}) {
    try {
      let message = template;
      
      // Replace variables in template
      for (const [key, value] of Object.entries(variables)) {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error(`Failed to send template message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendBulkMessages(recipients, message, delay = 1000) {
    const results = [];
    
    for (const phoneNumber of recipients) {
      try {
        const result = await this.sendMessage(phoneNumber, message);
        results.push({ phoneNumber, success: true, result });
        
        // Add delay between messages to avoid rate limiting
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        results.push({ phoneNumber, success: false, error: error.message });
        logger.error(`Failed to send bulk message to ${phoneNumber}:`, error);
      }
    }
    
    return results;
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming Indonesia +62)
    if (!cleaned.startsWith('62')) {
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else {
        cleaned = '62' + cleaned;
      }
    }
    
    return cleaned + '@s.whatsapp.net';
  }

  registerMessageHandler(name, handler) {
    this.messageHandlers.set(name, handler);
    logger.info(`Message handler '${name}' registered`);
  }

  unregisterMessageHandler(name) {
    this.messageHandlers.delete(name);
    logger.info(`Message handler '${name}' unregistered`);
  }

  isConnected() {
    return this.isReady;
  }

  async getProfilePicture(phoneNumber) {
    try {
      const jid = this.formatPhoneNumber(phoneNumber);
      return await this.socket.profilePictureUrl(jid);
    } catch (error) {
      logger.error(`Failed to get profile picture for ${phoneNumber}:`, error);
      return null;
    }
  }

  async checkNumberExists(phoneNumber) {
    try {
      const jid = this.formatPhoneNumber(phoneNumber);
      const [result] = await this.socket.onWhatsApp(jid);
      return result?.exists || false;
    } catch (error) {
      logger.error(`Failed to check if number exists ${phoneNumber}:`, error);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket = null;
        this.isReady = false;
        logger.info('WhatsApp disconnected successfully');
      }
    } catch (error) {
      logger.error('Error disconnecting WhatsApp:', error);
    }
  }
}

module.exports = WhatsAppService;
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialize();
  }

  initialize() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      logger.info('Gemini AI service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini AI service:', error);
      throw error;
    }
  }

  async generateDebtReminderMessage(debtorInfo, debtDetails, reminderLevel = 1) {
    try {
      const prompt = this.buildDebtReminderPrompt(debtorInfo, debtDetails, reminderLevel);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const message = response.text();
      
      logger.info(`Generated debt reminder message for ${debtorInfo.name} (Level ${reminderLevel})`);
      return message.trim();
    } catch (error) {
      logger.error('Failed to generate debt reminder message:', error);
      throw error;
    }
  }

  buildDebtReminderPrompt(debtorInfo, debtDetails, reminderLevel) {
    const toneMap = {
      1: 'friendly and polite',
      2: 'professional but firm',
      3: 'serious and urgent',
      4: 'formal and demanding',
      5: 'final warning tone'
    };

    const tone = toneMap[reminderLevel] || 'professional';

    return `
You are a professional debt collection AI assistant. Generate a ${tone} WhatsApp message in Indonesian language for debt collection.

Debtor Information:
- Name: ${debtorInfo.name}
- Phone: ${debtorInfo.phone}
- Company: ${debtorInfo.company || 'N/A'}

Debt Details:
- Amount: Rp ${debtDetails.amount.toLocaleString('id-ID')}
- Due Date: ${debtDetails.dueDate}
- Days Overdue: ${debtDetails.daysOverdue}
- Invoice Number: ${debtDetails.invoiceNumber || 'N/A'}
- Description: ${debtDetails.description || 'Outstanding payment'}

Reminder Level: ${reminderLevel}/5
Previous Reminders: ${debtDetails.previousReminders || 0}

Guidelines:
1. Use respectful Indonesian language
2. Be clear about the debt amount and due date
3. Include payment instructions if available
4. Adjust tone based on reminder level (1=gentle, 5=final warning)
5. Keep message under 300 words
6. Include company contact information
7. Be professional but human-like
8. For higher reminder levels, mention potential consequences
9. Always provide a way for the debtor to respond or contact

Generate only the message content, no additional formatting or explanations.
`;
  }

  async generatePaymentConfirmationMessage(debtorInfo, paymentDetails) {
    try {
      const prompt = `
Generate a professional payment confirmation message in Indonesian for WhatsApp.

Debtor Information:
- Name: ${debtorInfo.name}
- Company: ${debtorInfo.company || 'N/A'}

Payment Details:
- Amount Paid: Rp ${paymentDetails.amount.toLocaleString('id-ID')}
- Payment Date: ${paymentDetails.date}
- Payment Method: ${paymentDetails.method || 'Transfer'}
- Reference Number: ${paymentDetails.reference || 'N/A'}
- Remaining Balance: Rp ${paymentDetails.remainingBalance.toLocaleString('id-ID')}

Guidelines:
1. Thank the debtor for the payment
2. Confirm the payment details
3. Mention remaining balance if any
4. Be warm and professional
5. Keep message concise
6. Include contact information for questions

Generate only the message content.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const message = response.text();
      
      logger.info(`Generated payment confirmation message for ${debtorInfo.name}`);
      return message.trim();
    } catch (error) {
      logger.error('Failed to generate payment confirmation message:', error);
      throw error;
    }
  }

  async generateNegotiationResponse(debtorInfo, debtDetails, debtorMessage) {
    try {
      const prompt = `
You are a professional debt collection AI. A debtor has sent a message regarding their debt. Generate an appropriate response in Indonesian.

Debtor Information:
- Name: ${debtorInfo.name}
- Company: ${debtorInfo.company || 'N/A'}

Debt Details:
- Amount: Rp ${debtDetails.amount.toLocaleString('id-ID')}
- Days Overdue: ${debtDetails.daysOverdue}
- Invoice Number: ${debtDetails.invoiceNumber || 'N/A'}

Debtor's Message: "${debtorMessage}"

Guidelines:
1. Analyze the debtor's message for:
   - Payment promises
   - Financial difficulties
   - Disputes about the debt
   - Requests for payment plans
   - Questions about the debt
2. Respond professionally and empathetically
3. If they request payment plan, acknowledge and provide next steps
4. If they dispute the debt, ask for clarification
5. If they promise payment, confirm the commitment
6. Always keep the door open for communication
7. Provide contact information for further discussion
8. Be solution-oriented

Generate only the response message content.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const message = response.text();
      
      logger.info(`Generated negotiation response for ${debtorInfo.name}`);
      return message.trim();
    } catch (error) {
      logger.error('Failed to generate negotiation response:', error);
      throw error;
    }
  }

  async analyzeDebtorResponse(debtorMessage) {
    try {
      const prompt = `
Analyze this debtor's WhatsApp message and categorize their intent. Respond with a JSON object.

Debtor Message: "${debtorMessage}"

Analyze for:
1. Intent (payment_promise, dispute, financial_hardship, payment_plan_request, question, acknowledgment, ignore)
2. Sentiment (positive, negative, neutral)
3. Urgency (high, medium, low)
4. Payment commitment (yes, no, maybe)
5. Suggested action (follow_up, escalate, negotiate, close_case, wait)

Respond only with a JSON object in this format:
{
  "intent": "category",
  "sentiment": "sentiment",
  "urgency": "level",
  "payment_commitment": "yes/no/maybe",
  "suggested_action": "action",
  "confidence": 0.95,
  "summary": "Brief summary of the message"
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        logger.info('Analyzed debtor response successfully');
        return analysis;
      } else {
        throw new Error('Failed to parse analysis response');
      }
    } catch (error) {
      logger.error('Failed to analyze debtor response:', error);
      // Return default analysis on error
      return {
        intent: 'unknown',
        sentiment: 'neutral',
        urgency: 'medium',
        payment_commitment: 'maybe',
        suggested_action: 'follow_up',
        confidence: 0.1,
        summary: 'Analysis failed, manual review required'
      };
    }
  }

  async generateEscalationMessage(debtorInfo, debtDetails, escalationType = 'legal') {
    try {
      const prompt = `
Generate a professional escalation message in Indonesian for debt collection.

Debtor Information:
- Name: ${debtorInfo.name}
- Company: ${debtorInfo.company || 'N/A'}

Debt Details:
- Amount: Rp ${debtDetails.amount.toLocaleString('id-ID')}
- Days Overdue: ${debtDetails.daysOverdue}
- Previous Reminders: ${debtDetails.previousReminders}

Escalation Type: ${escalationType}

Guidelines:
1. Maintain professional tone
2. Clearly state the escalation consequences
3. Provide final opportunity to resolve
4. Include specific timeline for response
5. Mention legal implications if applicable
6. Keep message formal but not threatening
7. Include contact information for immediate resolution

Generate only the message content.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const message = response.text();
      
      logger.info(`Generated escalation message for ${debtorInfo.name}`);
      return message.trim();
    } catch (error) {
      logger.error('Failed to generate escalation message:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const result = await this.model.generateContent('Test connection. Respond with "OK" only.');
      const response = await result.response;
      const text = response.text();
      
      return text.includes('OK');
    } catch (error) {
      logger.error('Gemini AI connection test failed:', error);
      return false;
    }
  }
}

module.exports = GeminiService;
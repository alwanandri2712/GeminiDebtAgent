# GeminiDebtAgent

An AI-powered debt collection system using Gemini AI and WhatsApp integration for automated debt management and collection.

## Features

- **AI-Powered Communication**: Uses Google's Gemini AI for intelligent debt collection conversations
- **WhatsApp Integration**: Automated messaging through WhatsApp using Baileys
- **MySQL Database**: Robust data storage with Sequelize ORM
- **RESTful API**: Complete REST API for debt and debtor management
- **Authentication**: JWT-based authentication with role-based access control
- **Dashboard Analytics**: Comprehensive dashboard with debt collection statistics
- **Automated Reminders**: Scheduled debt reminders and escalation system
- **Payment Tracking**: Track payments and update debt status automatically

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MySQL with Sequelize ORM
- **AI**: Google Gemini AI
- **WhatsApp**: Baileys library
- **Authentication**: JWT with bcryptjs
- **Logging**: Winston
- **Scheduling**: node-cron
- **Security**: Helmet, CORS, Rate limiting

## Prerequisites

- Node.js >= 18.0.0
- MySQL database
- Google Gemini AI API key
- WhatsApp account for bot integration

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/GeminiDebtAgent.git
cd GeminiDebtAgent
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=debt_collection
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_DIALECT=mysql

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./whatsapp-session
```

5. Create MySQL database:
```sql
CREATE DATABASE debt_collection;
```

6. Start the application:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Documentation

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### Debtors Management

#### Get All Debtors
```http
GET /api/debtors?page=1&limit=10&search=john
Authorization: Bearer <token>
```

#### Create Debtor
```http
POST /api/debtors
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "address": "123 Main St",
  "businessType": "retail"
}
```

### Debts Management

#### Get All Debts
```http
GET /api/debts?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

#### Create Debt
```http
POST /api/debts
Authorization: Bearer <token>
Content-Type: application/json

{
  "debtorId": 1,
  "amount": 1000.00,
  "description": "Invoice #12345",
  "dueDate": "2024-01-31",
  "priority": "high"
}
```

#### Add Payment
```http
POST /api/debts/:id/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500.00,
  "paymentMethod": "bank_transfer",
  "notes": "Partial payment received"
}
```

### WhatsApp Integration

#### Get WhatsApp Status
```http
GET /api/whatsapp/status
Authorization: Bearer <token>
```

#### Send Test Message
```http
POST /api/whatsapp/send-test
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+1234567890",
  "message": "Hello, this is a test message"
}
```

#### Send Reminder
```http
POST /api/whatsapp/send-reminder/:debtId
Authorization: Bearer <token>
Content-Type: application/json

{
  "customMessage": "Please settle your outstanding payment"
}
```

### Dashboard Analytics

#### Get Overview Statistics
```http
GET /api/dashboard/overview?period=30
Authorization: Bearer <token>
```

#### Get Debt Status Distribution
```http
GET /api/dashboard/debt-status-distribution
Authorization: Bearer <token>
```

## Default Users

The system comes with two default users:

1. **Admin User**
   - Username: `admin`
   - Password: `password`
   - Role: `admin`

2. **Collector User**
   - Username: `collector`
   - Password: `password`
   - Role: `collector`

**Important**: Change these default passwords in production!

## Database Schema

### Debtors Table
- `id` (Primary Key)
- `name` (String, required)
- `phone` (String, required, unique)
- `email` (String)
- `address` (Text)
- `businessType` (Enum)
- `creditRating` (Enum)
- `isActive` (Boolean)
- `isBlacklisted` (Boolean)
- `notes` (Text)
- `paymentHistory` (JSON)
- `timestamps`

### Debts Table
- `id` (Primary Key)
- `debtorId` (Foreign Key)
- `invoiceNumber` (String, unique)
- `amount` (Decimal)
- `paidAmount` (Decimal)
- `description` (Text)
- `dueDate` (Date)
- `status` (Enum)
- `priority` (Enum)
- `reminderCount` (Integer)
- `lastReminderDate` (Date)
- `nextReminderDate` (Date)
- `escalationType` (Enum)
- `assignedToId` (Foreign Key)
- `tags` (JSON)
- `notes` (Text)
- `attachments` (JSON)
- `isActive` (Boolean)
- `timestamps`

## Scheduled Tasks

The system includes automated scheduled tasks:

- **Daily Reminders**: Sends reminders to debtors with overdue payments
- **Escalation Processing**: Escalates debts that haven't been paid after multiple reminders
- **Daily Statistics**: Generates daily collection statistics
- **Weekly Reports**: Creates weekly performance reports
- **Data Cleanup**: Removes old logs and temporary data

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Rate limiting on authentication endpoints
- CORS protection
- Helmet security headers
- Input validation and sanitization
- Role-based access control

## Logging

The system uses Winston for comprehensive logging:

- **Combined logs**: All application logs
- **Error logs**: Error-specific logs
- **Debug logs**: Debug information
- **Exception logs**: Uncaught exceptions
- **Rejection logs**: Unhandled promise rejections

## Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
```

### Project Structure
```
src/
├── config/
│   └── database.js          # Database configuration
├── models/
│   ├── debtor.model.js      # Debtor model
│   └── debt.model.js        # Debt model
├── routes/
│   ├── index.js             # Main router
│   ├── auth.routes.js       # Authentication routes
│   ├── debtor.routes.js     # Debtor management routes
│   ├── debt.routes.js       # Debt management routes
│   ├── whatsapp.routes.js   # WhatsApp integration routes
│   └── dashboard.routes.js  # Dashboard analytics routes
├── services/
│   ├── whatsapp.service.js  # WhatsApp service
│   ├── gemini.service.js    # Gemini AI service
│   └── debt-collection.service.js # Debt collection logic
├── schedulers/
│   └── debt-reminder.scheduler.js # Scheduled tasks
├── utils/
│   └── logger.js            # Logging utility
└── index.js                 # Application entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue on GitHub or contact the development team.

## Changelog

### Version 1.0.0
- Initial release
- Basic debt collection functionality
- WhatsApp integration
- Gemini AI integration
- MySQL database support
- Authentication system
- Dashboard analytics
- Automated reminders
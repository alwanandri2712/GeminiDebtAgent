# Database Migration Guide

Panduan lengkap untuk setup dan mengelola database MySQL menggunakan Sequelize migrations.

## Prerequisites

1. **MySQL Server** harus sudah terinstall dan berjalan
2. **Node.js** dan **npm** sudah terinstall
3. File `.env` sudah dikonfigurasi dengan benar

## Setup Environment

1. Copy file `.env.example` ke `.env`:
```bash
cp .env.example .env
```

2. Edit file `.env` dan sesuaikan konfigurasi database:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gemini_debt_agent
DB_USER=root
DB_PASSWORD=your_password
DB_DIALECT=mysql
```

## Installation

Install dependencies termasuk Sequelize CLI:
```bash
npm install
```

## Database Setup

### 1. Create Database
Buat database baru (opsional, jika belum ada):
```bash
npm run db:create
```

### 2. Run Migrations
Jalankan semua migration untuk membuat tabel:
```bash
npm run db:migrate
```

### 3. Run Seeders
Jalankan seeder untuk data default (user admin):
```bash
npm run db:seed
```

### 4. Setup Lengkap (All-in-One)
Atau jalankan semua sekaligus:
```bash
npm run db:setup
```

## Migration Commands

### Menjalankan Migration
```bash
# Jalankan semua migration yang belum dijalankan
npm run db:migrate

# Undo migration terakhir
npm run db:migrate:undo

# Undo semua migration
npm run db:migrate:undo:all
```

### Mengelola Seeders
```bash
# Jalankan semua seeder
npm run db:seed

# Undo semua seeder
npm run db:seed:undo
```

### Database Management
```bash
# Buat database baru
npm run db:create

# Hapus database
npm run db:drop
```

## Database Schema

### Tables Created:

1. **users** - Tabel pengguna sistem
   - id, username, email, password, full_name, role, is_active, last_login

2. **debtors** - Tabel data debitur
   - id, name, phone, email, company, address, contact_person, business_type, credit_rating, payment_history, preferred_contact_method, preferred_contact_time, language, notes, tags, is_blacklisted, blacklist_reason, is_active, last_contact_date, last_payment_date

3. **debts** - Tabel data hutang
   - id, debtor_id, invoice_number, description, original_amount, paid_amount, outstanding_amount, currency, due_date, status, priority, payment_terms, late_fee, interest_rate, payment_history, reminder_count, last_reminder_date, next_reminder_date, escalation_level, escalation_type, assigned_to_id, tags, notes, attachments, is_active

### Default Users:

Setelah menjalankan seeder, akan tersedia user default:

- **Admin User**:
  - Username: `admin`
  - Email: `admin@geminiagent.com`
  - Password: `admin123`
  - Role: `admin`

- **Collector User**:
  - Username: `collector1`
  - Email: `collector@geminiagent.com`
  - Password: `admin123`
  - Role: `collector`

## Troubleshooting

### Error: Database doesn't exist
```bash
# Buat database manual di MySQL
mysql -u root -p
CREATE DATABASE gemini_debt_agent;

# Atau gunakan command
npm run db:create
```

### Error: Access denied
- Pastikan username dan password MySQL benar di file `.env`
- Pastikan user MySQL memiliki permission untuk membuat database

### Error: Connection refused
- Pastikan MySQL server sudah berjalan
- Periksa host dan port di file `.env`

### Reset Database
Jika ingin reset ulang database:
```bash
npm run db:migrate:undo:all
npm run db:migrate
npm run db:seed
```

## Development Workflow

1. **Membuat Migration Baru**:
```bash
npx sequelize-cli migration:generate --name add-new-column
```

2. **Membuat Seeder Baru**:
```bash
npx sequelize-cli seed:generate --name demo-data
```

3. **Testing Migration**:
```bash
# Test di environment development
npm run db:migrate

# Jika ada masalah, undo
npm run db:migrate:undo
```

## Production Deployment

Untuk production, pastikan:

1. Set environment ke `production` di `.env`:
```env
NODE_ENV=production
```

2. Jalankan migration tanpa seeder:
```bash
npm run db:migrate
```

3. Jangan jalankan seeder di production (kecuali data yang memang diperlukan)

## File Structure

```
├── config/
│   └── config.js          # Konfigurasi database untuk Sequelize CLI
├── migrations/
│   ├── 001-create-users.js
│   ├── 002-create-debtors.js
│   └── 003-create-debts.js
├── seeders/
│   └── 001-default-users.js
├── src/
│   ├── config/
│   │   └── database.js     # Konfigurasi database untuk aplikasi
│   └── models/
│       ├── debtor.model.js
│       └── debt.model.js
└── .sequelizerc           # Konfigurasi path Sequelize CLI
```
# GeminiDebtAgent

Sistem penagihan hutang bertenaga AI menggunakan Gemini AI dan integrasi WhatsApp untuk manajemen dan penagihan hutang otomatis.

## Fitur

- **Komunikasi Bertenaga AI**: Menggunakan Gemini AI Google untuk percakapan penagihan hutang yang cerdas
- **Integrasi WhatsApp**: Pesan otomatis melalui WhatsApp menggunakan Baileys
- **Database MySQL**: Penyimpanan data yang kuat dengan Sequelize ORM
- **RESTful API**: API REST lengkap untuk manajemen hutang dan debitur
- **Autentikasi**: Autentikasi berbasis JWT dengan kontrol akses berbasis peran
- **Analitik Dashboard**: Dashboard komprehensif dengan statistik penagihan hutang
- **Pengingat Otomatis**: Sistem pengingat hutang terjadwal dan eskalasi
- **Pelacakan Pembayaran**: Melacak pembayaran dan memperbarui status hutang secara otomatis

## Stack Teknologi

- **Backend**: Node.js dengan Express.js
- **Database**: MySQL dengan Sequelize ORM
- **AI**: Google Gemini AI
- **WhatsApp**: Library Baileys
- **Autentikasi**: JWT dengan bcryptjs
- **Logging**: Winston
- **Penjadwalan**: node-cron
- **Keamanan**: Helmet, CORS, Rate limiting

## Prasyarat

- Node.js >= 18.0.0
- Database MySQL
- API key Google Gemini AI
- Akun WhatsApp untuk integrasi bot

## Instalasi

1. Clone repository:
```bash
git clone https://github.com/yourusername/GeminiDebtAgent.git
cd GeminiDebtAgent
```

2. Install dependencies:
```bash
npm install
```

3. Buat file environment:
```bash
cp .env.example .env
```

4. Konfigurasi environment variables di `.env`:
```env
# Konfigurasi Server
PORT=3000
NODE_ENV=development

# Konfigurasi Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=debt_collection
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_DIALECT=mysql

# Konfigurasi JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Konfigurasi Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Konfigurasi WhatsApp
WHATSAPP_SESSION_PATH=./whatsapp-session
```

5. Buat database MySQL:
```sql
CREATE DATABASE debt_collection;
```

6. Jalankan aplikasi:
```bash
# Mode development
npm run dev

# Mode production
npm start
```

## Dokumentasi API

### Autentikasi

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

### Manajemen Debitur

#### Dapatkan Semua Debitur
```http
GET /api/debtors?page=1&limit=10&search=john
Authorization: Bearer <token>
```

#### Buat Debitur
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

### Manajemen Hutang

#### Dapatkan Semua Hutang
```http
GET /api/debts?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

#### Buat Hutang
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

#### Tambah Pembayaran
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

### Integrasi WhatsApp

#### Dapatkan Status WhatsApp
```http
GET /api/whatsapp/status
Authorization: Bearer <token>
```

#### Kirim Pesan Test
```http
POST /api/whatsapp/send-test
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+1234567890",
  "message": "Hello, this is a test message"
}
```

#### Kirim Pengingat
```http
POST /api/whatsapp/send-reminder/:debtId
Authorization: Bearer <token>
Content-Type: application/json

{
  "customMessage": "Please settle your outstanding payment"
}
```

### Analitik Dashboard

#### Dapatkan Statistik Overview
```http
GET /api/dashboard/overview?period=30
Authorization: Bearer <token>
```

#### Dapatkan Distribusi Status Hutang
```http
GET /api/dashboard/debt-status-distribution
Authorization: Bearer <token>
```

## User Default

Sistem dilengkapi dengan dua user default:

1. **User Admin**
   - Username: `admin`
   - Password: `password`
   - Role: `admin`

2. **User Collector**
   - Username: `collector`
   - Password: `password`
   - Role: `collector`

**Penting**: Ubah password default ini di production!

## Skema Database

### Tabel Debtors
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

### Tabel Debts
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

## Tugas Terjadwal

Sistem mencakup tugas terjadwal otomatis:

- **Pengingat Harian**: Mengirim pengingat kepada debitur dengan pembayaran yang terlambat
- **Pemrosesan Eskalasi**: Mengeskalasi hutang yang belum dibayar setelah beberapa pengingat
- **Statistik Harian**: Menghasilkan statistik penagihan harian
- **Laporan Mingguan**: Membuat laporan kinerja mingguan
- **Pembersihan Data**: Menghapus log lama dan data sementara

## Fitur Keamanan

- Autentikasi berbasis JWT
- Hashing password dengan bcryptjs
- Rate limiting pada endpoint autentikasi
- Proteksi CORS
- Header keamanan Helmet
- Validasi dan sanitasi input
- Kontrol akses berbasis peran

## Logging

Sistem menggunakan Winston untuk logging komprehensif:

- **Combined logs**: Semua log aplikasi
- **Error logs**: Log khusus error
- **Debug logs**: Informasi debug
- **Exception logs**: Exception yang tidak tertangkap
- **Rejection logs**: Promise rejection yang tidak ditangani

## Development

### Menjalankan dalam Mode Development
```bash
npm run dev
```

### Menjalankan Tests
```bash
npm test
```

### Struktur Proyek
```
src/
├── config/
│   └── database.js          # Konfigurasi database
├── models/
│   ├── debtor.model.js      # Model debitur
│   └── debt.model.js        # Model hutang
├── routes/
│   ├── index.js             # Router utama
│   ├── auth.routes.js       # Routes autentikasi
│   ├── debtor.routes.js     # Routes manajemen debitur
│   ├── debt.routes.js       # Routes manajemen hutang
│   ├── whatsapp.routes.js   # Routes integrasi WhatsApp
│   └── dashboard.routes.js  # Routes analitik dashboard
├── services/
│   ├── whatsapp.service.js  # Service WhatsApp
│   ├── gemini.service.js    # Service Gemini AI
│   └── debt-collection.service.js # Logika penagihan hutang
├── schedulers/
│   └── debt-reminder.scheduler.js # Tugas terjadwal
├── utils/
│   └── logger.js            # Utility logging
└── index.js                 # Entry point aplikasi
```

## Kontribusi

1. Fork repository
2. Buat feature branch
3. Lakukan perubahan
4. Tambahkan test jika diperlukan
5. Submit pull request

## Lisensi

Proyek ini dilisensikan di bawah MIT License - lihat file LICENSE untuk detail.

## Dukungan

Untuk dukungan dan pertanyaan, silakan buka issue di GitHub atau hubungi tim development.

## Changelog

### Versi 1.0.0
- Rilis awal
- Fungsionalitas penagihan hutang dasar
- Integrasi WhatsApp
- Integrasi Gemini AI
- Dukungan database MySQL
- Sistem autentikasi
- Analitik dashboard
- Pengingat otomatis
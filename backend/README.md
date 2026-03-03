# CreditForge Backend

AI-powered Corporate Credit Appraisal System - Production-Ready Backend

## 🚀 Tech Stack

- **Runtime**: Node.js (LTS)
- **Framework**: Express.js
- **Database**: PostgreSQL (NeonDB)
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **File Processing**: Multer, pdf-parse
- **PDF Generation**: pdfkit
- **Validation**: express-validator

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.js                # Seed script
├── src/
│   ├── config/
│   │   └── database.js        # Prisma client setup
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── application.controller.js
│   │   ├── analysis.controller.js
│   │   └── settings.controller.js
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── errorHandler.js    # Global error handler
│   │   └── validate.js        # Input validation
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── application.routes.js
│   │   ├── analysis.routes.js
│   │   └── settings.routes.js
│   ├── services/
│   │   ├── pdf.service.js     # PDF extraction engine
│   │   ├── research.service.js # AI research agent
│   │   ├── risk.service.js    # Risk scoring engine
│   │   └── cam.service.js     # CAM generator
│   ├── utils/
│   │   └── jwt.js             # JWT utilities
│   └── index.js               # Server entry point
├── uploads/                   # File uploads directory
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database (NeonDB PostgreSQL)
DATABASE_URL="postgresql://username:password@your-neon-host.neon.tech/creditforge?sslmode=require"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Set Up Database

**Step 1: Generate Prisma Client**
```bash
npx prisma generate
```

**Step 2: Run Migrations**
```bash
npx prisma migrate dev --name init
```

This will:
- Create all database tables
- Set up relations and indexes
- Apply enum types

**Step 3: Seed Database**
```bash
npm run seed
```

This will create:
- 3 test users (admin, analyst, viewer)
- Default system settings
- 3 sample applications (1 fully analyzed)

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

### 5. Verify Installation

Check health endpoint:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-03T..."
}
```

## 🔑 Test Credentials

After seeding, use these credentials:

| Role    | Email                      | Password    |
|---------|----------------------------|-------------|
| Admin   | admin@creditforge.com      | password123 |
| Analyst | analyst@creditforge.com    | password123 |
| Viewer  | viewer@creditforge.com     | password123 |

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/dashboard/charts` - Get chart data

### Applications
- `POST /api/applications` - Create application
- `GET /api/applications` - List applications (paginated)
- `GET /api/applications/:id` - Get single application
- `POST /api/applications/:id/documents` - Upload documents
- `POST /api/applications/:id/analyze` - Run analysis
- `GET /api/applications/:id/status` - Get status

### Analysis
- `GET /api/applications/:id/company-analysis` - Company analysis
- `GET /api/applications/:id/ai-research` - AI research
- `GET /api/applications/:id/risk-score` - Risk score
- `GET /api/applications/:id/cam-report` - CAM report
- `GET /api/applications/:id/cam-report/pdf` - Download CAM PDF

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings (Admin)
- `POST /api/settings/reset` - Reset to defaults (Admin)

## 🔬 Business Logic

### 1. PDF Extraction Engine

Extracts financial data using regex patterns:
- Revenue, EBITDA, Net Profit
- Total Debt, Net Worth
- Calculates derived ratios

### 2. GST-Bank Reconciliation

- Compares GST revenue vs Bank statement revenue
- Flags mismatch > 15% (configurable)
- Detects potential circular trading risk

### 3. Research Agent (Rule-based NLP)

Analyzes company for:
- Litigation cases
- Regulatory issues
- Director background
- Negative news sentiment

Risk keywords categorized by severity:
- **CRITICAL**: fraud, insolvency, wilful defaulter
- **HIGH**: default, NPA, litigation
- **MEDIUM**: delayed payment, audit qualification
- **LOW**: dispute, claim, warning

### 4. Risk Scoring Engine

**Composite Score Formula:**
```
Score = (Revenue Stability × 0.25) +
        (Debt Ratio × 0.20) +
        (Litigation × 0.20) +
        (Promoter × 0.15) +
        (Sector × 0.20)
```

**Risk Levels:**
- VERY_LOW: 75-100
- LOW: 60-74
- MEDIUM: 40-59
- HIGH: 25-39
- VERY_HIGH: 0-24

**Five C's of Credit:**
- Character (willingness to repay)
- Capacity (ability to repay)
- Capital (financial strength)
- Collateral (asset backing)
- Conditions (sector/economic)

### 5. CAM Generator

Produces structured credit assessment with:
- Executive Summary
- Business Overview
- Financial Assessment
- Strengths/Risks Analysis
- Mitigation Strategy
- Final Recommendation
- Financial/Non-Financial Covenants
- Downloadable PDF report

## 🗄️ Database Models

**Core Models:**
- `User` - System users with roles
- `Application` - Loan applications
- `Document` - Uploaded files with extracted data
- `CompanyAnalysis` - Financial metrics
- `AIResearch` - Research findings
- `RiskScore` - Composite risk assessment
- `CamReport` - Credit Assessment Memorandum
- `Settings` - System configuration

**Enums:**
- `ApplicationStatus`: DRAFT, SUBMITTED, UNDER_REVIEW, etc.
- `RiskLevel`: VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
- `DocumentType`: FINANCIAL_STATEMENT, GST_RETURN, etc.
- `UserRole`: ADMIN, ANALYST, VIEWER

## 🛠️ Development Tools

**Prisma Studio** (Database GUI):
```bash
npm run studio
```

Opens at `http://localhost:5555`

**View Logs:**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 🔐 Security Features

- JWT-based authentication
- bcrypt password hashing (10 rounds)
- Role-based access control (RBAC)
- Input validation with express-validator
- File upload restrictions (type & size)
- CORS protection
- SQL injection prevention (Prisma ORM)

## 📊 Configuration

All risk scoring weights and thresholds are configurable via the Settings API:

- Revenue weight: 0.25
- Debt weight: 0.20
- Litigation weight: 0.20
- Promoter weight: 0.15
- Sector weight: 0.20
- High risk threshold: 60
- Medium risk threshold: 40
- GST-Bank mismatch threshold: 15%
- Auto approval score: 75
- Auto reject score: 30

## 🧪 Testing

**Sample API Call:**

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"analyst@creditforge.com","password":"password123"}'

# Create Application (replace TOKEN)
curl -X POST http://localhost:5000/api/applications \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company Ltd",
    "pan": "AABCT1234D",
    "loanAmount": 50000000,
    "loanPurpose": "Working Capital",
    "sector": "Manufacturing"
  }'
```

## 🚨 Common Issues

**Issue: Prisma Client not found**
```bash
npx prisma generate
```

**Issue: Migration failed**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Then re-seed
npm run seed
```

**Issue: Port already in use**
```bash
# Change PORT in .env file
PORT=5001
```

## 📦 Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use strong `JWT_SECRET`
3. Configure proper DATABASE_URL (NeonDB connection string)
4. Set appropriate CORS_ORIGIN
5. Consider using PM2 for process management:

```bash
npm install -g pm2
pm2 start src/index.js --name creditforge-api
pm2 save
pm2 startup
```

## 🤝 Collaboration Guidelines

- **No hardcoded secrets** - Use environment variables
- **No manual SQL** - Use Prisma migrations only
- **Modular code** - Services separated from controllers
- **Clear comments** - Explain financial logic
- **Error handling** - All routes use try-catch + error middleware

## 📝 License

MIT

## 👥 Support

For hackathon support, contact the team lead.

---

**Built with ❤️ for CreditForge Hackathon 2026**

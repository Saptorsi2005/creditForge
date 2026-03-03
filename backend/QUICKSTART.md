# 🚀 Quick Start Guide - CreditForge Backend

## Prerequisites
- Node.js (LTS version)
- PostgreSQL database (NeonDB recommended)
- npm or yarn

## Setup in 5 Minutes

### 1️⃣ Install Dependencies
```bash
cd backend
npm install
```

### 2️⃣ Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your NeonDB connection string
# DATABASE_URL="postgresql://user:pass@host.neon.tech/creditforge?sslmode=require"
```

### 3️⃣ Initialize Database
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed sample data
npm run seed
```

### 4️⃣ Start Server
```bash
npm run dev
```

## ✅ Verify Installation

Server should be running at: `http://localhost:5000`

Test the health endpoint:
```bash
curl http://localhost:5000/health
```

## 🔑 Login Credentials

```
Admin:   admin@creditforge.com / password123
Analyst: analyst@creditforge.com / password123
Viewer:  viewer@creditforge.com / password123
```

## 📋 Quick Test Flow

1. **Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"analyst@creditforge.com","password":"password123"}'
```

2. **Create Application**
```bash
curl -X POST http://localhost:5000/api/applications \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Sample Corp Ltd",
    "pan": "AABCS1234F",
    "loanAmount": 50000000,
    "loanPurpose": "Working Capital",
    "sector": "Manufacturing"
  }'
```

3. **View Dashboard**
```bash
curl http://localhost:5000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🛠️ Helpful Commands

```bash
# View database in browser
npm run studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Seed database
npm run seed

# Start production server
npm start
```

## 📚 Next Steps

1. Read the full [README.md](README.md) for detailed documentation
2. Explore the Prisma schema at `prisma/schema.prisma`
3. Check the API endpoints in `src/routes/`
4. Test file uploads and PDF generation

## 🆘 Troubleshooting

**Database connection error?**
- Verify DATABASE_URL in .env
- Check NeonDB dashboard for connection string

**Port already in use?**
- Change PORT in .env (default: 5000)

**Prisma errors?**
- Run `npx prisma generate`
- Then `npx prisma migrate reset`

---

**Need Help?** Check the main README.md or contact the team.

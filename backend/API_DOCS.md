# 📡 CreditForge API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔐 Authentication Endpoints

### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "ANALYST"  // Optional: ADMIN, ANALYST, VIEWER
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "ANALYST",
    "createdAt": "2026-03-03T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "analyst@creditforge.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "analyst@creditforge.com",
    "name": "Credit Analyst",
    "role": "ANALYST"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "analyst@creditforge.com",
    "name": "Credit Analyst",
    "role": "ANALYST",
    "isActive": true
  }
}
```

---

## 📊 Dashboard Endpoints

### Get Dashboard Statistics
```http
GET /dashboard/stats
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "totalApplications": 25,
  "applicationsThisMonth": 8,
  "approvedAmount": 250000000,
  "avgProcessingTime": 12,
  "statusBreakdown": {
    "COMPLETED": 10,
    "UNDER_REVIEW": 8,
    "APPROVED": 5,
    "REJECTED": 2
  },
  "riskDistribution": {
    "LOW": 12,
    "MEDIUM": 8,
    "HIGH": 5
  }
}
```

### Get Chart Data
```http
GET /dashboard/charts
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "applicationsTrend": [
    {
      "month": "2026-01",
      "count": 15,
      "approved": 8,
      "rejected": 2,
      "pending": 5,
      "totalAmount": 150000000
    }
  ],
  "sectorDistribution": [
    {
      "sector": "Manufacturing",
      "count": 10,
      "totalAmount": 100000000
    }
  ],
  "riskScoreDistribution": [
    {
      "range": "81-100",
      "count": 5
    }
  ]
}
```

---

## 📝 Application Endpoints

### Create Application
```http
POST /applications
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "companyName": "ABC Manufacturing Pvt Ltd",
  "pan": "AABCA1234B",
  "gstin": "27AABCA1234B1Z5",
  "cin": "U25199MH2015PTC123456",
  "loanAmount": 50000000,
  "loanPurpose": "Working Capital and Machinery Purchase",
  "sector": "Manufacturing"
}
```

**Response (201):**
```json
{
  "message": "Application created successfully",
  "application": {
    "id": "uuid",
    "applicationNo": "CRF2026000004",
    "companyName": "ABC Manufacturing Pvt Ltd",
    "pan": "AABCA1234B",
    "gstin": "27AABCA1234B1Z5",
    "cin": "U25199MH2015PTC123456",
    "loanAmount": 50000000,
    "loanPurpose": "Working Capital and Machinery Purchase",
    "sector": "Manufacturing",
    "status": "DRAFT",
    "userId": "uuid",
    "createdAt": "2026-03-03T..."
  }
}
```

### List Applications (Paginated)
```http
GET /applications?page=1&limit=10&status=COMPLETED&sector=Manufacturing
Authorization: Bearer TOKEN
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status
- `sector` (optional): Filter by sector

**Response (200):**
```json
{
  "applications": [
    {
      "id": "uuid",
      "applicationNo": "CRF2026000001",
      "companyName": "ABC Manufacturing Pvt Ltd",
      "status": "COMPLETED",
      "loanAmount": 50000000,
      "sector": "Manufacturing",
      "user": {
        "id": "uuid",
        "name": "Credit Analyst",
        "email": "analyst@creditforge.com"
      },
      "riskScore": {
        "compositeScore": 78.5,
        "riskLevel": "LOW",
        "recommendation": "APPROVE"
      },
      "createdAt": "2026-02-15T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### Get Single Application
```http
GET /applications/:id
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "application": {
    "id": "uuid",
    "applicationNo": "CRF2026000001",
    "companyName": "ABC Manufacturing Pvt Ltd",
    "pan": "AABCA1234B",
    "status": "COMPLETED",
    "loanAmount": 50000000,
    "documents": [...],
    "companyAnalysis": {...},
    "aiResearch": {...},
    "riskScore": {...},
    "camReport": {...}
  }
}
```

### Upload Documents
```http
POST /applications/:id/documents
Authorization: Bearer TOKEN
Content-Type: multipart/form-data

documents: [file1.pdf, file2.pdf]
documentType: FINANCIAL_STATEMENT
```

**Response (200):**
```json
{
  "message": "Documents uploaded successfully",
  "documents": [
    {
      "id": "uuid",
      "filename": "documents-1234567890.pdf",
      "originalName": "financials.pdf",
      "mimeType": "application/pdf",
      "size": 2048576,
      "documentType": "FINANCIAL_STATEMENT",
      "extractedData": {
        "financialData": {
          "revenue": 250000000,
          "ebitda": 37500000,
          "netProfit": 18750000
        }
      },
      "uploadedAt": "2026-03-03T..."
    }
  ]
}
```

### Analyze Application
```http
POST /applications/:id/analyze
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "message": "Analysis completed successfully",
  "companyAnalysis": {
    "id": "uuid",
    "revenue": 250000000,
    "ebitdaMargin": 15.0,
    "debtToEquity": 0.67,
    "mismatchFlag": false,
    "strengths": [...]
  },
  "aiResearch": {
    "id": "uuid",
    "litigationCount": 1,
    "regulatoryIssues": 0,
    "overallSentiment": "POSITIVE",
    "sentimentScore": 0.45
  },
  "riskScore": {
    "id": "uuid",
    "compositeScore": 78.5,
    "riskLevel": "LOW",
    "recommendation": "APPROVE",
    "factorBreakdown": [...]
  }
}
```

### Get Application Status
```http
GET /applications/:id/status
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "status": {
    "id": "uuid",
    "applicationNo": "CRF2026000001",
    "status": "COMPLETED",
    "submittedAt": "2026-02-15T...",
    "completedAt": "2026-02-25T...",
    "createdAt": "2026-02-15T...",
    "updatedAt": "2026-02-25T..."
  }
}
```

---

## 📈 Analysis Endpoints

### Get Company Analysis
```http
GET /applications/:id/company-analysis
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "analysis": {
    "id": "uuid",
    "revenue": 250000000,
    "revenueGrowth": 15.5,
    "ebitda": 37500000,
    "ebitdaMargin": 15.0,
    "netProfit": 18750000,
    "netProfitMargin": 7.5,
    "totalAssets": 180000000,
    "totalDebt": 60000000,
    "netWorth": 90000000,
    "debtToEquity": 0.67,
    "currentRatio": 1.8,
    "gstRevenue": 250000000,
    "bankRevenue": 245000000,
    "revenueMismatch": 2.0,
    "mismatchFlag": false,
    "strengths": ["Strong revenue growth", "Healthy margins"],
    "weaknesses": ["Geographic concentration"]
  }
}
```

### Get AI Research
```http
GET /applications/:id/ai-research
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "research": {
    "id": "uuid",
    "litigationCount": 1,
    "litigationDetails": [
      {
        "type": "Civil Litigation",
        "status": "Ongoing",
        "amount": 2500000,
        "description": "Contract dispute with supplier"
      }
    ],
    "regulatoryIssues": 0,
    "directorIssues": 0,
    "negativeNews": 0,
    "overallSentiment": "POSITIVE",
    "sentimentScore": 0.45,
    "riskKeywords": [
      {
        "keyword": "litigation",
        "count": 1,
        "severity": "MEDIUM",
        "impact": 4
      }
    ],
    "executiveSummary": "Research conducted reveals...",
    "redFlags": []
  }
}
```

### Get Risk Score
```http
GET /applications/:id/risk-score
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "riskScore": {
    "id": "uuid",
    "compositeScore": 78.5,
    "riskLevel": "LOW",
    "revenueStability": 85.0,
    "debtRatio": 82.0,
    "litigationScore": 70.0,
    "promoterScore": 80.0,
    "sectorScore": 75.0,
    "weights": {
      "revenueWeight": 0.25,
      "debtWeight": 0.20,
      "litigationWeight": 0.20,
      "promoterWeight": 0.15,
      "sectorWeight": 0.20
    },
    "factorBreakdown": [
      {
        "factor": "Revenue Stability",
        "score": 85.0,
        "weight": 0.25,
        "contribution": 21.25,
        "impact": "VERY_POSITIVE"
      }
    ],
    "deductions": [],
    "character": 85.0,
    "capacity": 88.0,
    "capital": 82.0,
    "collateral": 75.0,
    "conditions": 75.0,
    "recommendation": "APPROVE",
    "recommendationReason": "Strong credit profile..."
  }
}
```

### Get CAM Report
```http
GET /applications/:id/cam-report
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "camReport": {
    "id": "uuid",
    "executiveSummary": "Application for ₹5 Cr...",
    "businessOverview": "ABC Manufacturing is...",
    "financialAssessment": "Company demonstrates...",
    "strengthsAnalysis": "Key strengths include...",
    "risksAnalysis": "One ongoing civil litigation...",
    "mitigationStrategy": "Standard monitoring...",
    "recommendation": "APPROVE",
    "recommendedAmount": 50000000,
    "recommendedTenure": 60,
    "recommendedRate": 10.0,
    "conditions": ["Submit quarterly financials"],
    "financialCovenants": ["DSCR ≥ 1.5x"],
    "nonFinancialCovenants": ["Maintain asset insurance"]
  }
}
```

### Download CAM PDF
```http
GET /applications/:id/cam-report/pdf
Authorization: Bearer TOKEN
```

**Response (200):**
- Content-Type: application/pdf
- Downloads PDF file

---

## ⚙️ Settings Endpoints

### Get Settings
```http
GET /settings
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "settings": {
    "id": "uuid",
    "revenueWeight": 0.25,
    "debtWeight": 0.20,
    "litigationWeight": 0.20,
    "promoterWeight": 0.15,
    "sectorWeight": 0.20,
    "highRiskThreshold": 60,
    "mediumRiskThreshold": 40,
    "mismatchThreshold": 15,
    "autoApprovalScore": 75,
    "autoRejectScore": 30,
    "sectorRiskConfig": {...},
    "researchKeywords": [...]
  }
}
```

### Update Settings (Admin Only)
```http
PUT /settings
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "revenueWeight": 0.30,
  "debtWeight": 0.25,
  "litigationWeight": 0.20,
  "promoterWeight": 0.15,
  "sectorWeight": 0.10,
  "highRiskThreshold": 65,
  "mismatchThreshold": 12
}
```

**Response (200):**
```json
{
  "message": "Settings updated successfully",
  "settings": {...}
}
```

### Reset Settings (Admin Only)
```http
POST /settings/reset
Authorization: Bearer TOKEN
```

**Response (200):**
```json
{
  "message": "Settings reset to defaults",
  "settings": {...}
}
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Valid email is required",
      "value": "invalid-email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden: Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Application not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "stack": "..." // Only in development
}
```

---

## 📋 Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔄 Application Status Flow

```
DRAFT → SUBMITTED → DOCUMENTS_UPLOADED → ANALYZING → COMPLETED → APPROVED/REJECTED
```

## 📊 Risk Levels

- `VERY_LOW` - Score: 75-100
- `LOW` - Score: 60-74
- `MEDIUM` - Score: 40-59
- `HIGH` - Score: 25-39
- `VERY_HIGH` - Score: 0-24

## 👤 User Roles

- `ADMIN` - Full access, can modify settings
- `ANALYST` - Can create and analyze applications
- `VIEWER` - Read-only access

---

**For more details, see [README.md](README.md)**

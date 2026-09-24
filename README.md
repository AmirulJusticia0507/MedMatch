# MedMatch

Intelligent referral route recommendation system for Indonesian public health facilities (Faskes) and hospitals. Optimizes patient referrals by integrating with **BPJS Mobile JKN / Applicare APIs** and **Kemenkes SATUSEHAT / SIRANAP** to prevent hospital overcrowding and reduce wait times.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | ASP.NET Core 8/9 Web API |
| Language | C# 12 / .NET Runtime |
| Database | NeonDB (Serverless PostgreSQL) + PostGIS |
| ORM | Entity Framework Core (Npgsql) |
| ML | ML.NET (Matrix Factorization, Time-Series) |
| Background Tasks | IHostedService / Hangfire |

## Architecture

```
[Patient Client] → [ASP.NET Core API Gateway]
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
[Background Worker]  [Recommendation]  [Data Layer]
 (Cron/Sync)          (MCDM/ML.NET)    (NeonDB/PostGIS)
        │
        ├─→ BPJS Applicare & Antrean APIs
        ├─→ Kemenkes SIRANAP & SATUSEHAT
        └─→ OSRM / Spatial Routing
```

## Core Algorithm

Multi-criteria scoring ranks hospitals using:
- **Distance/Travel Time** (30%)
- **Queue Length & Wait Time** (40%)
- **Bed Availability** (20%)
- **Facility Match** (10%)

```
Sᵢ = (w_d·f_d(Dᵢ) + w_q·f_q(Qᵢ) + w_b·f_b(Bᵢ) + w_f·Fᵢ) × 100
```

## Data Sync Strategy

- **Active ingestion**: Background service polls BPJS/SIRANAP every 3-5 min
- **Read optimization**: Patient requests hit local NeonDB cache (sub-second)
- **Fallback**: ML.NET predictions when external APIs are down

## Getting Started

```bash
# Prerequisites: .NET 8/9 SDK, NeonDB account
git clone <repo>
cd MedMatch
dotnet restore
dotnet run
```

## Configuration

`appsettings.json`:
```json
{
  "ConnectionStrings": {
    "NeonDbConnection": "postgresql://neondb_owner:npg_hiBew3vCHb7O@ep-ancient-mud-b4dqrduu-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  },
  "ExternalApis": {
    "BpjsBaseUrl": "https://api.bpjs.go.id",
    "SiranapBaseUrl": "https://siranap.kemkes.go.id",
    "OsrmBaseUrl": "http://router.project-osrm.org"
  }
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommendations` | Get top 5 hospital recommendations |
| GET | `/api/hospitals/{id}` | Get hospital details |
| GET | `/api/hospitals/nearby` | Find facilities by location/specialty |

### Example Request
```http
GET /api/recommendations?lat=-6.2088&lng=106.8456&specialty=PULMONOLOGY&bedClass=KELAS_1
```

### Example Response
```json
[
  {
    "hospitalId": "RSUPN-001",
    "hospitalName": "RSUPN Dr. Cipto Mangunkusumo",
    "estimatedTravelMinutes": 12,
    "currentQueueCount": 8,
    "availableBeds": 3,
    "recommendationScore": 87.5
  }
]
```

## Project Structure

```
src/
├── MedMatch.Api/              # ASP.NET Core Web API
├── MedMatch.Core/             # Domain models, interfaces
├── MedMatch.Infrastructure/   # EF Core, external API clients
├── MedMatch.Recommendation/   # MCDM scoring engine, ML.NET models
└── MedMatch.Worker/           # Background sync services
```

## License

MIT
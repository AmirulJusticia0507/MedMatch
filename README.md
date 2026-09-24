# MedMatch

Intelligent referral route recommendation system for Indonesian public health facilities (Faskes) and hospitals. MedMatch ranks nearby facilities by travel time, queue load, bed availability, and specialty match — integrating **Kemenkes SATUSEHAT (Master Sarana Index)**, **BPJS**, and **Kemenkes SIRANAP** to help patients find the right care faster.

## Features

- **Smart recommendations** — multi-criteria scoring (distance, queue, beds, facility match) with OSRM travel-time routing.
- **Nationwide search** — pick any major Indonesian city or use device geolocation; results on an OpenStreetMap (Leaflet) map.
- **SATUSEHAT MSI integration** — live facility master data via `/api/msi/recommendations`, with automatic fallback to the local recommendation engine (and offline Jakarta demo data if the API is unreachable).
- **Accounts** — signup, login, forgot/reset password (JWT session stored in `sessionStorage`).
- **Biometric login (WebAuthn)** — register device fingerprint/passkey from the account security view and sign in without a password (Fido2NetLib, tested end-to-end with a browser virtual authenticator).
- **AI health assistant** — chat widget backed by an OpenAI-compatible API (BazaarLink, default model `qwen/qwen3.7-flash:free`) with a safety-oriented system prompt and offline fallback reply.
- **Preferences & help center** — search-range settings (stored locally) and searchable FAQ.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | ASP.NET Core 8 minimal APIs (`net8.0`) |
| Language | C# 12 |
| Database | PostgreSQL — local in dev, NeonDB (serverless) in production |
| ORM | EF Core 8 + Npgsql + NetTopologySuite |
| ML | ML.NET (FastTree queue-length prediction) |
| Auth | JWT Bearer + WebAuthn/FIDO2 (`Fido2` 4.1.0) |
| HTTP resilience | Polly retry policies |
| Frontend | React 18 + TypeScript + Vite, Leaflet / react-leaflet, lucide-react |
| API docs | Swagger / Swashbuckle (Development) |

## Architecture

```
[React SPA (Vite)] ── dev proxy /api ──► [ASP.NET Core API :5037]
        │                                     │
        │                          ┌──────────┼──────────────┬──────────────┐
        │                          ▼          ▼              ▼              ▼
        │                    [Auth + JWT]  [Recommender]  [Data Layer]  [AI Chat]
        │                     WebAuthn     ML.NET + OSRM   EF/Postgres   BazaarLink
        │                          │              │              │
        ▼                          └──────────────┴──────────────┘
  sessionStorage                                 │
  theme/preferences                    ┌────────┼─────────┬──────────┐
                                       ▼        ▼         ▼          ▼
                                 SATUSEHAT MSI  BPJS    SIRANAP     OSRM
```

## Core Algorithm

Candidate hospitals are ranked with a weighted composite score (`RecommendationEngine.cs`):

```
finalScore = distance×0.3 + queue×0.4 + beds×0.2 + facility×0.1   → ×100
```

Tiered factor scores:

| Factor | Tiers |
|--------|-------|
| Distance (OSRM travel minutes) | ≤15→1.0, ≤30→0.8, ≤45→0.6, ≤60→0.4, else 0.2 |
| Queue length | ≤5→1.0, ≤15→0.8, ≤30→0.5, ≤50→0.3, else 0.1 |
| Available beds (class) | ≥5→1.0, ≥2→0.7, ≥1→0.4, else 0.0 |
| Facility match | specialty supported→1.0, else 0.0 |

Travel time/distance come from **OSRM** with a haversine ×25 km/h estimate as fallback (used for MSI master-data results, which carry no queue/bed data).

## Getting Started

Prerequisites: **.NET 8 SDK**, **Node.js 18+**, **PostgreSQL** (or a NeonDB account).

```bash
git clone <repo>
cd MedMatch
dotnet restore

# 1) API — schema is auto-created and demo data seeded on first run
dotnet run --project src/MedMatch.Api
# → http://localhost:5037  (Swagger at /swagger)

# 2) Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173  (proxies /api to 127.0.0.1:5037)
```

Open **`http://localhost:5173`** (use `localhost`, not `127.0.0.1` — required for WebAuthn, see below). No manual SQL is needed: `DbSeeder` runs `EnsureCreated` + idempotent `CREATE TABLE IF NOT EXISTS` DDL (also available as [`schemadb.sql`](schemadb.sql)) and seeds 5 demo hospitals with queues/beds. If nothing is seeded you can also run `psql -d medmatch -f schemadb.sql`.

### Database selection

| Environment | Connection string name |
|-------------|------------------------|
| Development | `LocalDbConnection` (default: `localhost:5432`, `postgres`/`postgres`, db `medmatch`) |
| Production | `NeonDbConnection` |

Override via `appsettings.Development.json` or user-secrets. **Npgsql requires the key/value format** (`Host=...;Port=...;Database=...;Username=...;Password=...;SSL Mode=Require`), not a `postgres://` URI.

## Configuration

Secrets never belong in the repo — use [user-secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets) or environment variables:

```bash
cd src/MedMatch.Api
dotnet user-secrets set "ConnectionStrings:NeonDbConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
dotnet user-secrets set "Jwt:Key" "<long random string>"
dotnet user-secrets set "ExternalApis:BazaarLink:ApiKey" "<bazaarlink key>"
dotnet user-secrets set "ExternalApis:SatuSehat:ClientId" "..."
dotnet user-secrets set "ExternalApis:SatuSehat:ClientSecret" "..."
dotnet user-secrets set "ExternalApis:SatuSehat:OrganizationId" "..."
```

Key configuration sections:

| Key | Purpose | Dev default |
|-----|---------|-------------|
| `ConnectionStrings:LocalDbConnection` / `NeonDbConnection` | PostgreSQL (env-selected) | local postgres |
| `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience` | JWT signing/validation | dev-only key in `appsettings.Development.json` |
| `WebAuthn:RPId`, `WebAuthn:RPName`, `WebAuthn:Origins` | FIDO2 relying party | `localhost`, origins `localhost`/`127.0.0.1`:5173/5174 |
| `ExternalApis:BazaarLink:BaseUrl/Model/ApiKey` | AI assistant | `https://api.bazaarlink.ai/v1`, `qwen/qwen3.7-flash:free` |
| `ExternalApis:SatuSehat:*` | SATUSEHAT MSI facility data | unconfigured → MSI returns empty |
| `ExternalApis:Bpjs:*`, `ExternalApis:Siranap:*` | BPJS / SIRANAP sync clients | unconfigured |
| `ExternalApis:Osrm:*` | Routing | public OSRM demo server |

Frontend build-time env (optional; empty in dev → Vite proxy is used):

```bash
# frontend/.env.production
VITE_API_BASE_URL=https://your-api.example.com
```

### Biometric login (WebAuthn)

1. Sign in, open **Akun → Profil dan keamanan**, click **"Aktifkan sidik jari"** and complete the platform authenticator prompt (Touch ID / Windows Hello / phone).
2. On the login screen, click **"Masuk dengan sidik jari"** and enter your email — the authenticator unlocks the stored credential.
3. The UI allows up to 5 credentials per account (enable button disables at 5); delete from the same security view.

Notes:

- **Local dev:** always open the app as `http://localhost:<port>` — Chrome rejects IP addresses (`127.0.0.1`) as a WebAuthn `rpId`. If Vite picks a different port, add it to `WebAuthn:Origins`.
- **Production:** WebAuthn requires **HTTPS**. Set `WebAuthn__RPId` to your frontend domain (no scheme/port, e.g. `medmatch.example.com`) and `WebAuthn__Origins__0` to the full frontend URL; also add that origin to the CORS policy in `Program.cs`.
- The ceremony (register + passwordless login) is covered by an automated browser test using a CDP virtual authenticator.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Email + password → JWT |
| POST | `/api/auth/forgot-password` | — | Create reset token (returned in dev) |
| POST | `/api/auth/reset-password` | — | Consume token, set new password |
| GET | `/api/auth/biometric/status` | ✔ | List registered credentials |
| POST | `/api/auth/biometric/register/options` | ✔ | WebAuthn attestation options |
| POST | `/api/auth/biometric/register` | ✔ | Verify attestation, store credential |
| DELETE | `/api/auth/biometric/{credentialId}` | ✔ | Remove credential |
| POST | `/api/auth/biometric/login/options` | — | WebAuthn assertion options |
| POST | `/api/auth/biometric/login` | — | Verify assertion → JWT |
| GET | `/api/recommendations` | — | Ranked hospitals (local engine) |
| GET | `/api/msi/recommendations` | — | Ranked facilities (SATUSEHAT MSI) |
| GET | `/api/specialties` | — | Specialty list |
| GET | `/api/hospitals` | — | All hospitals |
| GET | `/api/hospitals/nearby` | — | Nearby hospitals by radius |
| GET | `/api/hospitals/{id}` | — | Hospital detail (beds, queue, specialties) |
| POST | `/api/chat` | — | AI assistant message |
| GET | `/api/chat/health` | — | AI provider health |
| GET | `/api/msi/health` | — | SATUSEHAT MSI health |

### Example

```http
GET /api/recommendations?latitude=-6.1754&longitude=106.8272&specialtyCode=CARDIOLOGY&bedClass=KELAS_1&maxDistanceKm=25&maxResults=5
```

```json
[
  {
    "hospitalId": "rsupn-001",
    "hospitalName": "RSUPN Dr. Cipto Mangunkusumo",
    "distanceKm": 3.4,
    "estimatedTravelMinutes": 12,
    "currentQueueCount": 8,
    "estimatedWaitMinutes": 40,
    "availableBeds": 3,
    "recommendationScore": 87.5
  }
]
```

## Project Structure

```
MedMatch.sln
schemadb.sql                       # Idempotent DDL (also run by DbSeeder)
vercel.json                        # Frontend build from repository root
src/
├── MedMatch.Api/                  # Minimal API host, auth, WebAuthn, chat, MSI endpoints
├── MedMatch.Core/                 # Domain models, DTOs, repository interfaces
├── MedMatch.Infrastructure/       # EF Core, repositories, external API clients, sync service
├── MedMatch.Recommendation/       # MCDM scoring engine + ML.NET queue model
└── MedMatch.Worker/               # Background worker scaffold (Hangfire-ready)
frontend/
├── src/api/                       # medmatch.ts (REST) + webauthn.ts (passkeys)
├── src/components/                # Views: overview, recommendations, facilities,
│                                  #        assistant, account, preferences, help
└── src/data/                      # Nationwide city dataset + demo fallback data
```

## Deployment

- **Frontend → Vercel:** [`vercel.json`](vercel.json) installs/builds from `frontend/`. Set build env `VITE_API_BASE_URL` to your deployed API origin.
- **Backend → any .NET 8 host:** provide `ConnectionStrings__NeonDbConnection`, `Jwt__Key`, `WebAuthn__RPId` / `WebAuthn__Origins__0`, and `ExternalApis__*` secrets as environment variables; set `ASPNETCORE_ENVIRONMENT` so `NeonDbConnection` is selected; extend the `MedMatchFrontend` CORS origins to your frontend domain.

## License

MIT

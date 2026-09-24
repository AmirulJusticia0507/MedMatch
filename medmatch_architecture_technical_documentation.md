# MedMatch: Public Health & BPJS Referral Route Recommendation System
**Technical Architecture & System Design Specification**

---

## 1. Executive Summary & Vision

**MedMatch** is an intelligent recommendation engine built to optimize patient referral routes across public health facilities (Faskes) and hospitals in Indonesia. By acting as an analytical middleware layer over official government platforms (**BPJS / Kemenkes SATUSEHAT MSI / SIRANAP**), MedMatch helps patients reach the right facility faster, reduces wait-time surprises, and balances healthcare infrastructure load using multi-criteria decision-making, geospatial routing, and machine learning.

Delivered surface: a React SPA (recommendations, facilities, AI assistant, account/security, preferences, help) backed by an ASP.NET Core 8 minimal API with JWT authentication, WebAuthn biometric login, and OpenAPI (Swagger) docs.

---

## 2. System Architecture

```
                 [ React 18 + Vite SPA ]  (Leaflet / OSM, sessionStorage auth)
                        │   dev: Vite proxy /api  ·  prod: VITE_API_BASE_URL
                        ▼
        ┌───────────────────────────────────────────────┐
        │         ASP.NET Core 8 Minimal API           │
        │  Auth (JWT) · WebAuthn · Chat · MSI · MCDM   │
        └───────┬───────────────┬───────────────┬───────┘
                │               │               │
       ┌────────▼───────┐ ┌─────▼──────┐ ┌──────▼─────────┐
       │  Data Layer    │ │Recommender │ │  External APIs │
       │ EF Core 8      │ │ ML.NET +   │ │ SATUSEHAT MSI  │
       │ PostgreSQL     │ │ OSRM route │ │ BPJS · SIRANAP │
       │ (dev/Neon)     │ │ tiers      │ │ OSRM · BazaarAI│
       └────────────────┘ └────────────┘ └────────────────┘
```

**Request flow (recommendations):** UI filters (city/province → specialty → bed class → radius) → `GET /api/msi/recommendations` when province+city codes are present (live SATUSEHAT master data) → on empty/error fall back to `GET /api/recommendations` (local engine over the Postgres cache) → if the API is unreachable entirely, the SPA shows seeded Jakarta demo data (`Mode demo` badge in the top bar).

---

## 3. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Framework** | ASP.NET Core 8.0 minimal APIs (`net8.0`) |
| **Language** | C# 12 |
| **Database** | PostgreSQL (local dev / NeonDB serverless in production) |
| **Spatial Engine** | NetTopologySuite + `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite` |
| **ORM Framework** | Entity Framework Core 8 |
| **Machine Learning** | ML.NET 3 (FastTree regression for queue-length prediction) |
| **Authentication** | JWT Bearer (`Microsoft.AspNetCore.Authentication.JwtBearer`) + WebAuthn via **Fido2NetLib 4.1** |
| **HTTP Resilience** | Polly (retry with exponential backoff) |
| **API Docs** | Swashbuckle / Swagger (Development environment) |
| **Frontend** | React 18, TypeScript, Vite, Leaflet + react-leaflet, lucide-react |
| **Background Tasks** | `SyncService` on demand; `MedMatch.Worker` scaffold (Hangfire packages, scheduling pending) |

---

## 4. External API Integration Points

MedMatch aggregates data centrally rather than connecting individually to hundreds of local hospital servers:

1. **SATUSEHAT Master Sarana Index (MSI)** — `SatuSehatMsiClient` (`ExternalApis:SatuSehat`): facility master data (type, address, phone, coordinates, operational status) powering `/api/msi/recommendations`. Requires `ClientId`/`ClientSecret`/`OrganizationId`; reports health via `/api/msi/health`.
2. **BPJS** — `BpjsApiClient` (OAuth client-credentials, `ExternalApis:Bpjs`): bed availability by class and live queue counters (`SyncService.SyncBedAvailabilityAsync` / `SyncQueueInfoAsync`).
3. **Kemenkes SIRANAP** — `SiranapApiClient` (X-API-Key, `ExternalApis:Siranap`): facility and specialty master records (`SyncHospitalsAsync` / `SyncSpecialtiesAsync`).
4. **OSRM** — `OsrmRoutingClient` (`ExternalApis:Osrm`, public demo server by default): route distance (km) and travel duration (minutes); straight-line haversine ÷ 25 km/h estimate on failure.
5. **BazaarLink (OpenAI-compatible)** — `BazaarLinkChatClient` (`ExternalApis:BazaarLink`): `/api/chat` completions, default model `qwen/qwen3.7-flash:free`, health probe `/api/chat/health`.

All clients register through `AddInfrastructure` / `AddSatuSehat` / `AddChatAi` with Polly retry (3 attempts, exponential backoff).

---

## 5. Multi-Criteria Scoring Algorithm

The recommendation engine (`MedMatch.Recommendation/RecommendationEngine.cs`) ranks candidate hospitals ($H_i$) with a normalized composite score ($S_i \in [0,100]$):

$$S_i = \left( 0.3 \cdot f_d(D_i) + 0.4 \cdot f_q(Q_i) + 0.2 \cdot f_b(B_i) + 0.1 \cdot F_i \right) \times 100$$

Where:

* $D_i$: OSRM travel duration → tiers: ≤15 min = 1.0, ≤30 = 0.8, ≤45 = 0.6, ≤60 = 0.4, else 0.2
* $Q_i$: current queue length → tiers: ≤5 = 1.0, ≤15 = 0.8, ≤30 = 0.5, ≤50 = 0.3, else 0.1
* $B_i$: available beds for the requested class → ≥5 = 1.0, ≥2 = 0.7, ≥1 = 0.4, else 0.0
* $F_i$: facility supports the requested specialty → 1.0, else 0.0

MSI results bypass the queue/bed factors (master data has none): they are radius-filtered (haversine, default 50 km, max 100), enriched with OSRM travel time when available, and sorted by distance (`IsMasterDataOnly = true` so the UI can label the source).

**ML queue fallback:** `TrainQueuePredictionModel` fits a FastTree regressor on `(hour, dayOfWeek, isWeekend)` → queue length. The model is used only when a prediction engine is trained; the historical-data loader is currently a stub, so live queue rows (seeded/synced) take precedence.

---

## 6. Implementation Example (ASP.NET Core C#)

### 6.1 Service wiring (`Program.cs`, abridged)

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddChatAi(builder.Configuration);     // BazaarLink AI chat
builder.Services.AddSatuSehat(builder.Configuration);  // SATUSEHAT MSI client

var connectionName = builder.Environment.IsDevelopment()
    ? "LocalDbConnection" : "NeonDbConnection";
var connectionString = builder.Configuration.GetConnectionString(connectionName);
if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddInfrastructure(builder.Configuration, connectionString);
    builder.Services.AddRecommendation();
    builder.Services.AddScoped<AuthService>();

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options => { /* issuer/audience/lifetime/signing-key validation */ });
    builder.Services.AddAuthorization();

    builder.Services.AddMemoryCache();
    builder.Services.AddSingleton(_ => new Fido2(new Fido2Configuration
    {
        RPID = builder.Configuration["WebAuthn:RPId"] ?? "localhost",
        RPName = builder.Configuration["WebAuthn:RPName"] ?? "MedMatch",
        Origins = new HashSet<string>(webAuthnOrigins)
    }));
    builder.Services.AddScoped<BiometricService>();
}

var app = builder.Build();
if (hasDatabaseConfiguration) await DbSeeder.InitializeAsync(scope.ServiceProvider ...);
app.MapWebAuthnEndpoints();   // + auth/chat/msi/recommendation minimal endpoints
app.Run();
```

### 6.2 Scoring core (actual weights)

```csharp
var travelMinutes = await _routingClient.GetTravelTimeMinutesAsync(...);
var distanceKm    = await _routingClient.GetDistanceKmAsync(...);

var distanceScore = CalculateDistanceScore(travelMinutes); // tiers 1.0 … 0.2
var queueScore    = CalculateQueueScore(queueInfo.CurrentLength); // tiers 1.0 … 0.1
var bedScore      = CalculateBedScore(hospital, request.BedClass); // 1.0/0.7/0.4/0.0
var facilityScore = hospital.HasSpecialty(request.SpecialtyCode) ? 1.0 : 0.0;

var finalScore = (distanceScore * 0.3) + (queueScore * 0.4)
               + (bedScore * 0.2) + (facilityScore * 0.1);

RecommendationScore = Math.Round(finalScore * 100, 1);
```

---

## 7. Data Syncing & Cache Strategy

To prevent overloading official government endpoints and to ensure sub-second response times:

1. **Schema bootstrap:** `DbSeeder.InitializeAsync` runs `EnsureCreated` + idempotent `CREATE TABLE IF NOT EXISTS` DDL (mirrored in `schemadb.sql`) and seeds 5 demo hospitals with specialties, bed capacities, and queue rows — the API is usable on first run with zero manual setup.
2. **On-demand ingestion:** `ISyncService.SyncService` performs full/incremental syncs (SIRANAP facilities & specialties, BPJS beds & queues) with per-hospital error isolation; periodic scheduling is reserved for the Hangfire-backed `MedMatch.Worker` scaffold.
3. **Read-heavy optimization:** patient-facing requests (`/api/recommendations`, `/api/hospitals*`) read only the local PostgreSQL cache — never government endpoints synchronously.
4. **Fallback logic:** OSRM failure → haversine estimate; MSI unavailable → local engine; whole API down → frontend demo dataset for Jakarta; queue model untrained → live queue rows or neutral zeros.

---

## 8. Authentication & Biometric Login

### 8.1 Account model

`Users` (email unique, `PasswordHash` via ASP.NET `PasswordHasher<UserAccount>`, role, `IsActive`), `PasswordResetTokens` (SHA-256 token hash, expiry, single-use), `BiometricCredentials` (base64url credential id, public key, signature counter, label, FK → user, cascade delete). All three are created by the seeder DDL.

### 8.2 JWT session

`POST /api/auth/login|signup` → HS256 JWT (`sub`, email, name claims; `Jwt:Key` signing; 1-min clock skew). The SPA stores the token + `expiresAt` in `sessionStorage["medmatch-auth"]` and attaches `Authorization: Bearer` via `api/medmatch.ts`. Forgot-password returns a `resetToken` **only in Development** (no SMTP configured); production must add delivery (email/SMS) before enabling the flow.

### 8.3 WebAuthn ceremony (passwordless)

```
REGISTER (authenticated)                         LOGIN (anonymous)
───────────────────────                          ─────────────────
GET  /api/auth/biometric/status                  POST /api/auth/biometric/login/options
POST /api/auth/biometric/register/options ─cache▶  { challenge, rpId, allowCredentials? }
  challenge: webauthn:register:{userId}            challenge: webauthn:login:{email}
  (5 min, IMemoryCache)                            (5 min, keyed by normalized email)
navigator.credentials.create()                    navigator.credentials.get()
POST /api/auth/biometric/register                POST /api/auth/biometric/login
  BiometricService verifies attestation            verifies assertion, updates SignCount,
  stores credential (UI caps at 5 / user)          returns the same JWT payload as login
DELETE /api/auth/biometric/{credentialId}         GET /api/auth/biometric/status (→ enabled flag)
```

Design points:

* **Fido2NetLib 4.1** (`Fido2Configuration`): `RPId`/`Origins` from `WebAuthn:*` config; dev defaults `localhost` + `localhost|127.0.0.1:5173|5174`.
* Challenges are one-shot expectations cached for 5 minutes; assertions enforce `userVerification: required`.
* Labels default to "Sidik jari perangkat"; the security UI lists, adds (up to five), and deletes credentials.
* **Local-dev constraint:** Chrome rejects IP-address `rpId`s (`SecurityError: This is an invalid domain`) — the app must be opened as `http://localhost:<port>`.
* **Production:** HTTPS mandatory; set `WebAuthn__RPId` (bare domain) and `WebAuthn__Origins__n` (full origin URLs) and align the CORS policy.
* Verified end-to-end with an automated browser run using a CDP **virtual authenticator** (register → logout → biometric login → JWT issued).

---

## 9. AI Assistant

`POST /api/chat` accepts `{ message, systemPrompt?, history[] }`, forwards to `IChatAiClient` (BazaarLink `/chat/completions`), and returns `{ reply, model, success, error? }` (502 when the provider fails). The SPA ships a safety-focused Indonesian system prompt (no diagnosis, escalate emergencies to 119/IGD) and a keyword-based offline fallback reply; `GET /api/chat/health` drives the online/offline chip and doubles as the dev environment readiness probe.

---

## 10. Frontend Architecture

| Concern | Implementation |
| :--- | :--- |
| Views (`ViewId`) | `overview`, `recommendations`, `facilities`, `assistant`, `account`, `preferences`, `help` — hash-synced (`#facilities` etc.) |
| API layer | `api/medmatch.ts` (REST + MSI-first fallback) and `api/webauthn.ts` (base64url WebAuthn helpers); base URL from `VITE_API_BASE_URL`/`NEXT_PUBLIC_API_URL`, empty → relative paths via Vite proxy |
| Location | Nationwide city dataset (`data/indonesiaLocations.ts`, lat/lng per city) + "use my location" geolocation; city selection sets `provinceCode`/`cityCode` for MSI |
| Map | `NearbyMap` / `CapacityMap` — react-leaflet, OpenStreetMap raster tiles, patient + facility markers, selection sync with the tables |
| Session | Login/signup/forgot/reset flows in `AccountView`; session in `sessionStorage`; logout wipes it |
| Theme | light/dark persisted in `localStorage["medmatch-theme"]`, system-preference default |
| Degradation | API down → Jakarta mock results + "Mode demo" badge; MSI empty → local engine notice; chat offline → canned replies |

---

## 11. Configuration & Deployment

| Concern | Development | Production |
| :--- | :--- | :--- |
| Database | `LocalDbConnection` (localhost Postgres) | `NeonDbConnection` (Npgsql key/value format — not a URI) |
| Secrets | `appsettings.Development.json` + user-secrets | Environment variables (`Jwt__Key`, `ConnectionStrings__NeonDbConnection`, `ExternalApis__*`) |
| Frontend URL | `http://localhost:5173` (+ :5174 origins) | Deployed domain via `VITE_API_BASE_URL` |
| WebAuthn | `WebAuthn:RPId = localhost` | `WebAuthn__RPId = <domain>`, `WebAuthn__Origins__0 = https://<domain>` (HTTPS required) |
| CORS | `MedMatchFrontend` policy origins in `Program.cs` (localhost:5173) | Extend `WithOrigins(...)` to the production frontend origin |
| Hosting | `dotnet run --project src/MedMatch.Api` (:5037) + `npm run dev` | Any .NET 8 host + Vercel (`vercel.json` builds `frontend/` from repo root) |

Environment readiness probes: `/api/chat/health`, `/api/msi/health`, Swagger UI at `/swagger` (Development only).

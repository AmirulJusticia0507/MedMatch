# MedMatch: Public Health & BPJS Referral Route Recommendation System
**Technical Architecture & System Design Specification**

---

## 1. Executive Summary & Vision

**MedMatch** is an intelligent recommendation engine built to optimize patient referral routes across public health facilities (Faskes) and hospitals in Indonesia. By acting as an analytical middleware layer over official government platforms (**BPJS Mobile JKN / Applicare APIs** and **Kemenkes SATUSEHAT / SIRANAP**), MedMatch prevents hospital overcrowding, reduces patient wait times, and balances healthcare infrastructure load using multi-criteria decision-making algorithms and machine learning.

---

## 2. System Architecture

```
                       [ Patient Mobile / Web Client ]
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │    ASP.NET Core Web API      │
                       │     (API Gateway & Core)     │
                       └──────────────┬───────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               ▼                      ▼                      ▼
    ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
    │  Background Worker │ │ Recommendation Engine│ │   Data Layer       │
    │  (Cron/IHostedSvc) │ │ (MCDM / ML.NET Core)│ │ (NeonDB / PostGIS) │
    └──────────┬─────────┘ └────────────────────┘ └────────────────────┘
               │
    ┌──────────┴────────────────────────┬────────────────────────┐
    ▼                                   ▼                        ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌─────────────────┐
│ BPJS Health API       │   │ Kemenkes SATUSEHAT    │   │ Spatial Routing │
│ (Applicare & Antrean) │   │ (SIRANAP & FHIR)      │   │ (OSRM / Maps)   │
└───────────────────────┘   └───────────────────────┘   └─────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Framework** | ASP.NET Core 8.0/9.0 Web API |
| **Language** | C# 12 / .NET Runtime |
| **Database** | NeonDB (Serverless PostgreSQL) |
| **Spatial Engine** | PostGIS extension |
| **ORM Framework** | Entity Framework Core (via `Npgsql.EntityFrameworkCore.PostgreSQL`) |
| **Machine Learning** | ML.NET (Matrix Factorization & Time-Series Queue Estimation) |
| **Background Tasks** | `IHostedService` / Hangfire for API Syncing & Caching |

---

## 4. External API Integration Points

MedMatch aggregates data centrally rather than connecting individually to hundreds of local hospital servers:

1. **BPJS Applicare API:** Real-time bed availability (Rawat Inap) grouped by room class.
2. **BPJS Antrean Faskes API:** Live queue length, doctor schedule quotas, and current serving velocity.
3. **Kemenkes SIRANAP & SATUSEHAT:** Facility capabilities, active specialist rosters, and emergency capacity.
4. **OSRM / Spatial Service:** Geodesic route calculations and real-time travel duration.

---

## 5. Multi-Criteria Scoring Algorithm

The core recommendation engine ranks candidate hospitals ($H_i$) based on a normalized composite score ($S_i \in [0, 100]$):

$$S_i = \left( w_d \cdot f_d(D_i) + w_q \cdot f_q(Q_i) + w_b \cdot f_b(B_i) + w_f \cdot F_i \right) \times 100$$

Where:
* $D_i$: Distance / Travel Duration from patient location
* $Q_i$: Current Queue Length and estimated wait time
* $B_i$: Bed Availability Index for required class
* $F_i$: Facility matching factor (0 or 1)
* $w_d, w_q, w_b, w_f$: Weights where $\sum w = 1.0$ (Default: $w_q=0.4, w_d=0.3, w_b=0.2, w_f=0.1$)

---

## 6. Implementation Example (ASP.NET Core C#)

### 6.1 Database Configuration (`Program.cs`)

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register NeonDB PostgreSQL Connection
var connectionString = builder.Configuration.GetConnectionString("NeonDbConnection");
builder.Services.AddDbContext<MedMatchDbContext>(options =>
    options.UseNpgsql(connectionString, o => o.UseVector()));

// Register Recommendation Engine & Services
builder.Services.AddScoped<IRecommendationEngine, RecommendationEngine>();
builder.Services.AddHostedService<BpjsSyncBackgroundService>();

var app = builder.Build();
app.MapControllers();
app.Run();
```

### 6.2 Recommendation Engine Scoring Logic

```csharp
public class RecommendationEngine : IRecommendationEngine
{
    public async Task<List<HospitalRecommendationDto>> GetTopRecommendationsAsync(
        double userLat, double userLng, string specialtyCode, string bedClass)
    {
        // 1. Fetch nearby candidate facilities from NeonDB
        var candidates = await _db.Hospitals
            .Where(h => h.HasSpecialty(specialtyCode))
            .ToListAsync();

        var results = new List<HospitalRecommendationDto>();

        foreach (var hospital in candidates)
        {
            // Calculate distance factor (decay curve)
            double travelMinutes = await CalculateTravelTimeMinutes(userLat, userLng, hospital.Lat, hospital.Lng);
            double distanceScore = Math.Max(0, 1.0 - (travelMinutes / 60.0)); // 0 score at 60+ mins

            // Calculate queue score
            double queueScore = Math.Max(0, 1.0 - (hospital.CurrentQueueCount / 50.0)); // 0 score at 50+ queue

            // Calculate bed availability score
            double bedScore = hospital.GetAvailableBeds(bedClass) > 0 ? 1.0 : 0.0;

            // Composite Score Calculation
            double finalScore = (distanceScore * 0.3) + (queueScore * 0.4) + (bedScore * 0.3);

            results.Add(new HospitalRecommendationDto
            {
                HospitalId = hospital.Id,
                HospitalName = hospital.Name,
                EstimatedTravelMinutes = travelMinutes,
                CurrentQueueCount = hospital.CurrentQueueCount,
                AvailableBeds = hospital.GetAvailableBeds(bedClass),
                RecommendationScore = Math.Round(finalScore * 100, 1)
            });
        }

        return results.OrderByDescending(r => r.RecommendationScore).Take(5).ToList();
    }
}
```

---

## 7. Data Syncing & Cache Strategy

To prevent overloading official government endpoints and to ensure sub-second response times:

1. **Active Ingestion:** An `IHostedService` background process polls the BPJS/SIRANAP APIs every 3–5 minutes for active queue counters and bed changes.
2. **Read-Heavy Optimization:** Patient API requests query local **NeonDB** cached state rather than hitting government endpoints synchronously.
3. **Fallback Logic:** If external APIs experience downtime, the system transitions to ML.NET historical prediction models to estimate queue sizes based on the day of the week and time of day.
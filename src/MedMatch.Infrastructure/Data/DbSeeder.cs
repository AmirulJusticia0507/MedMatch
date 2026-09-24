using MedMatch.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace MedMatch.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task InitializeAsync(MedMatchDbContext db)
    {
        await db.Database.EnsureCreatedAsync();

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Users" (
                "Id" uuid PRIMARY KEY,
                "Email" varchar(320) NOT NULL,
                "PasswordHash" text NOT NULL,
                "FullName" varchar(200) NOT NULL,
                "Role" varchar(30) NOT NULL DEFAULT 'USER',
                "IsActive" boolean NOT NULL DEFAULT true,
                "EmailVerifiedAt" timestamp with time zone,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email" ON "Users" ("Email");

            CREATE TABLE IF NOT EXISTS "PasswordResetTokens" (
                "Id" uuid PRIMARY KEY,
                "UserId" uuid NOT NULL REFERENCES "Users" ("Id") ON DELETE CASCADE,
                "TokenHash" char(64) NOT NULL,
                "ExpiresAt" timestamp with time zone NOT NULL,
                "UsedAt" timestamp with time zone,
                "CreatedAt" timestamp with time zone NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PasswordResetTokens_TokenHash"
                ON "PasswordResetTokens" ("TokenHash");
            CREATE INDEX IF NOT EXISTS "IX_PasswordResetTokens_UserId_ExpiresAt"
                ON "PasswordResetTokens" ("UserId", "ExpiresAt");
            """);

        if (await db.Hospitals.AnyAsync())
        {
            return;
        }

        db.Specialties.AddRange(
            new Specialty { Code = "CARDIOLOGY", Name = "Jantung", Description = "Poli jantung dan kardiovaskular", Category = SpecialtyCategory.Cardiology },
            new Specialty { Code = "PULMONOLOGY", Name = "Paru-paru", Description = "Poli paru dan respirasi", Category = SpecialtyCategory.Pulmonology },
            new Specialty { Code = "NEUROLOGY", Name = "Syaraf", Description = "Poli saraf", Category = SpecialtyCategory.Neurology },
            new Specialty { Code = "ORTHOPEDICS", Name = "Bedah Ortopedi", Description = "Poli tulang dan sendi", Category = SpecialtyCategory.Orthopedics },
            new Specialty { Code = "PEDIATRICS", Name = "Anak", Description = "Poli anak", Category = SpecialtyCategory.Pediatrics },
            new Specialty { Code = "INTERNAL_MEDICINE", Name = "Penyakit Dalam", Description = "Poli penyakit dalam", Category = SpecialtyCategory.InternalMedicine },
            new Specialty { Code = "OBSTETRICS_GYNECOLOGY", Name = "Kandungan", Description = "Poli kandungan dan kebidanan", Category = SpecialtyCategory.ObstetricsGynecology },
            new Specialty { Code = "DERMATOLOGY", Name = "Kulit", Description = "Poli kulit dan kelamin", Category = SpecialtyCategory.Dermatology }
        );

        var now = DateTime.UtcNow;

        db.Hospitals.AddRange(
            new Hospital
            {
                Id = "RSCM",
                Code = "3101001",
                Name = "RSUPN Dr. Cipto Mangunkusumo",
                Latitude = -6.1944,
                Longitude = 106.8229,
                Address = "Jl. Diponegoro No.71, Jakarta Pusat",
                Phone = "021-3141608",
                Email = "info@rscm.id",
                Type = HospitalType.RumahSakitUmum,
                Status = HospitalStatus.Active,
                LastUpdated = now,
                Specialties = new List<HospitalSpecialty>
                {
                    new() { SpecialtyCode = "INTERNAL_MEDICINE", Name = "Penyakit Dalam", Category = SpecialtyCategory.InternalMedicine },
                    new() { SpecialtyCode = "CARDIOLOGY", Name = "Jantung", Category = SpecialtyCategory.Cardiology },
                    new() { SpecialtyCode = "NEUROLOGY", Name = "Syaraf", Category = SpecialtyCategory.Neurology }
                },
                BedCapacities = new List<HospitalBedCapacity>
                {
                    new() { Class = BedClasses.Kelas1, Total = 120, Occupied = 95, LastUpdated = now },
                    new() { Class = BedClasses.Kelas2, Total = 80, Occupied = 70, LastUpdated = now },
                    new() { Class = BedClasses.Kelas3, Total = 150, Occupied = 140, LastUpdated = now },
                    new() { Class = BedClasses.ICU, Total = 20, Occupied = 15, LastUpdated = now }
                },
                CurrentQueue = new HospitalQueueInfo
                {
                    SpecialtyCode = "CARDIOLOGY",
                    CurrentLength = 18,
                    CurrentServingNumber = 10,
                    EstimatedWaitMinutes = 45,
                    ServingVelocityPerHour = 12,
                    DoctorQuota = 40,
                    DoctorsOnDuty = 3,
                    LastUpdated = now,
                    Status = QueueStatus.Busy
                }
            },
            new Hospital
            {
                Id = "HK",
                Code = "3101002",
                Name = "RS Jantung Harapan Kita",
                Latitude = -6.1754,
                Longitude = 106.7936,
                Address = "Jl. S. Parman Kav. 87, Jakarta Barat",
                Phone = "021-5683001",
                Type = HospitalType.RumahSakitKhusus,
                Status = HospitalStatus.Active,
                LastUpdated = now,
                Specialties = new List<HospitalSpecialty>
                {
                    new() { SpecialtyCode = "CARDIOLOGY", Name = "Jantung", Category = SpecialtyCategory.Cardiology },
                    new() { SpecialtyCode = "INTERNAL_MEDICINE", Name = "Penyakit Dalam", Category = SpecialtyCategory.InternalMedicine }
                },
                BedCapacities = new List<HospitalBedCapacity>
                {
                    new() { Class = BedClasses.Kelas1, Total = 60, Occupied = 40, LastUpdated = now },
                    new() { Class = BedClasses.ICU, Total = 15, Occupied = 8, LastUpdated = now }
                },
                CurrentQueue = new HospitalQueueInfo
                {
                    SpecialtyCode = "CARDIOLOGY",
                    CurrentLength = 12,
                    CurrentServingNumber = 8,
                    EstimatedWaitMinutes = 30,
                    ServingVelocityPerHour = 16,
                    DoctorQuota = 30,
                    DoctorsOnDuty = 4,
                    LastUpdated = now,
                    Status = QueueStatus.Normal
                }
            },
            new Hospital
            {
                Id = "PIH",
                Code = "3107001",
                Name = "RS Pondok Indah",
                Latitude = -6.2766,
                Longitude = 106.7936,
                Address = "Jl. Metro Pondok Indah Blok IV, Jakarta Selatan",
                Phone = "021-7657525",
                Type = HospitalType.RumahSakitUmum,
                Status = HospitalStatus.Active,
                LastUpdated = now,
                Specialties = new List<HospitalSpecialty>
                {
                    new() { SpecialtyCode = "CARDIOLOGY", Name = "Jantung", Category = SpecialtyCategory.Cardiology },
                    new() { SpecialtyCode = "INTERNAL_MEDICINE", Name = "Penyakit Dalam", Category = SpecialtyCategory.InternalMedicine },
                    new() { SpecialtyCode = "PEDIATRICS", Name = "Anak", Category = SpecialtyCategory.Pediatrics },
                    new() { SpecialtyCode = "OBSTETRICS_GYNECOLOGY", Name = "Kandungan", Category = SpecialtyCategory.ObstetricsGynecology }
                },
                BedCapacities = new List<HospitalBedCapacity>
                {
                    new() { Class = BedClasses.VIP, Total = 30, Occupied = 20, LastUpdated = now },
                    new() { Class = BedClasses.Kelas1, Total = 70, Occupied = 50, LastUpdated = now },
                    new() { Class = BedClasses.Kelas2, Total = 60, Occupied = 55, LastUpdated = now }
                },
                CurrentQueue = new HospitalQueueInfo
                {
                    SpecialtyCode = "CARDIOLOGY",
                    CurrentLength = 8,
                    CurrentServingNumber = 5,
                    EstimatedWaitMinutes = 20,
                    ServingVelocityPerHour = 14,
                    DoctorQuota = 25,
                    DoctorsOnDuty = 2,
                    LastUpdated = now,
                    Status = QueueStatus.Normal
                }
            },
            new Hospital
            {
                Id = "PERSAHABATAN",
                Code = "3105001",
                Name = "RS Persahabatan",
                Latitude = -6.1875,
                Longitude = 106.9061,
                Address = "Jl. Persahabatan Raya, Jakarta Timur",
                Phone = "021-4891708",
                Type = HospitalType.RumahSakitUmum,
                Status = HospitalStatus.Active,
                LastUpdated = now,
                Specialties = new List<HospitalSpecialty>
                {
                    new() { SpecialtyCode = "PULMONOLOGY", Name = "Paru-paru", Category = SpecialtyCategory.Pulmonology },
                    new() { SpecialtyCode = "INTERNAL_MEDICINE", Name = "Penyakit Dalam", Category = SpecialtyCategory.InternalMedicine }
                },
                BedCapacities = new List<HospitalBedCapacity>
                {
                    new() { Class = BedClasses.Kelas1, Total = 40, Occupied = 30, LastUpdated = now },
                    new() { Class = BedClasses.Kelas2, Total = 50, Occupied = 45, LastUpdated = now },
                    new() { Class = BedClasses.Kelas3, Total = 90, Occupied = 88, LastUpdated = now }
                },
                CurrentQueue = new HospitalQueueInfo
                {
                    SpecialtyCode = "PULMONOLOGY",
                    CurrentLength = 22,
                    CurrentServingNumber = 12,
                    EstimatedWaitMinutes = 50,
                    ServingVelocityPerHour = 12,
                    DoctorQuota = 35,
                    DoctorsOnDuty = 3,
                    LastUpdated = now,
                    Status = QueueStatus.Busy
                }
            },
            new Hospital
            {
                Id = "BUNDA",
                Code = "3101003",
                Name = "RSIA Bunda Jakarta",
                Latitude = -6.1951,
                Longitude = 106.823,
                Address = "Jl. Teuku Cik Ditiro No.21, Menteng, Jakarta Pusat",
                Phone = "021-31926666",
                Type = HospitalType.RumahSakitKhusus,
                Status = HospitalStatus.Active,
                LastUpdated = now,
                Specialties = new List<HospitalSpecialty>
                {
                    new() { SpecialtyCode = "OBSTETRICS_GYNECOLOGY", Name = "Kandungan", Category = SpecialtyCategory.ObstetricsGynecology },
                    new() { SpecialtyCode = "PEDIATRICS", Name = "Anak", Category = SpecialtyCategory.Pediatrics },
                    new() { SpecialtyCode = "DERMATOLOGY", Name = "Kulit", Category = SpecialtyCategory.Dermatology }
                },
                BedCapacities = new List<HospitalBedCapacity>
                {
                    new() { Class = BedClasses.VIP, Total = 20, Occupied = 12, LastUpdated = now },
                    new() { Class = BedClasses.Kelas1, Total = 45, Occupied = 30, LastUpdated = now },
                    new() { Class = BedClasses.Kelas2, Total = 40, Occupied = 35, LastUpdated = now }
                },
                CurrentQueue = new HospitalQueueInfo
                {
                    SpecialtyCode = "OBSTETRICS_GYNECOLOGY",
                    CurrentLength = 10,
                    CurrentServingNumber = 6,
                    EstimatedWaitMinutes = 25,
                    ServingVelocityPerHour = 15,
                    DoctorQuota = 30,
                    DoctorsOnDuty = 3,
                    LastUpdated = now,
                    Status = QueueStatus.Normal
                }
            }
        );

        await db.SaveChangesAsync();
    }
}

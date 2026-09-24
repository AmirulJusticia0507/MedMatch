namespace MedMatch.Core.Models;

public class Hospital
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public HospitalType Type { get; set; }
    public HospitalStatus Status { get; set; }
    public List<HospitalSpecialty> Specialties { get; set; } = new();
    public List<HospitalBedCapacity> BedCapacities { get; set; } = new();
    public HospitalQueueInfo? CurrentQueue { get; set; }
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public bool HasSpecialty(string specialtyCode)
        => Specialties.Any(s => s.SpecialtyCode.Equals(specialtyCode, StringComparison.OrdinalIgnoreCase));

    public int GetAvailableBeds(string bedClass)
    {
        var bed = BedCapacities.FirstOrDefault(b => b.Class.Equals(bedClass, StringComparison.OrdinalIgnoreCase));
        return bed?.Available ?? 0;
    }

    public int CurrentQueueCount => CurrentQueue?.CurrentLength ?? 0;
}

public class HospitalSpecialty
{
    public string HospitalId { get; set; } = string.Empty;
    public string SpecialtyCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public SpecialtyCategory Category { get; set; }
}

public class HospitalBedCapacity
{
    public string HospitalId { get; set; } = string.Empty;
    public string Class { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Occupied { get; set; }
    public int Available => Total - Occupied;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}

public class HospitalQueueInfo
{
    public string HospitalId { get; set; } = string.Empty;
    public string SpecialtyCode { get; set; } = string.Empty;
    public int CurrentLength { get; set; }
    public int CurrentServingNumber { get; set; }
    public int EstimatedWaitMinutes { get; set; }
    public double ServingVelocityPerHour { get; set; }
    public int DoctorQuota { get; set; }
    public int DoctorsOnDuty { get; set; }
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public QueueStatus Status { get; set; }
}

public enum HospitalType
{
    RumahSakitUmum = 1,
    RumahSakitKhusus = 2,
    RumahSakitJiwa = 3,
    Puskesmas = 4,
    KlinikPratama = 5,
    KlinikUtama = 6
}

public enum HospitalStatus
{
    Active = 1,
    Maintenance = 2,
    Full = 3,
    Closed = 4
}
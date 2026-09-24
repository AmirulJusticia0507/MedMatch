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
    public List<Specialty> Specialties { get; set; } = new();
    public List<BedCapacity> BedCapacities { get; set; } = new();
    public QueueInfo? CurrentQueue { get; set; }
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public bool HasSpecialty(string specialtyCode)
        => Specialties.Any(s => s.Code.Equals(specialtyCode, StringComparison.OrdinalIgnoreCase));

    public int GetAvailableBeds(string bedClass)
    {
        var bed = BedCapacities.FirstOrDefault(b => b.Class.Equals(bedClass, StringComparison.OrdinalIgnoreCase));
        return bed?.Available ?? 0;
    }

    public int CurrentQueueCount => CurrentQueue?.CurrentLength ?? 0;
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
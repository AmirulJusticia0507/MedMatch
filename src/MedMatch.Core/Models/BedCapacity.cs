namespace MedMatch.Core.Models;

public class BedCapacity
{
    public string Class { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Occupied { get; set; }
    public int Available => Total - Occupied;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}

public static class BedClasses
{
    public const string Kelas1 = "KELAS_1";
    public const string Kelas2 = "KELAS_2";
    public const string Kelas3 = "KELAS_3";
    public const string VIP = "VIP";
    public const string VVIP = "VVIP";
    public const string ICU = "ICU";
    public const string NICU = "NICU";
    public const string PICU = "PICU";
    public const string HCU = "HCU";

    public static readonly string[] All = new[]
    {
        Kelas1, Kelas2, Kelas3, VIP, VVIP, ICU, NICU, PICU, HCU
    };
}
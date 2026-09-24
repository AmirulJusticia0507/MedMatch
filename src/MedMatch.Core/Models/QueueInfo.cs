namespace MedMatch.Core.Models;

public class QueueInfo
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

public enum QueueStatus
{
    Normal = 1,
    Busy = 2,
    Full = 3,
    Closed = 4
}
namespace MedMatch.Core.DTOs;

using MedMatch.Core.Models;

public class HospitalRecommendationDto
{
    public string HospitalId { get; set; } = string.Empty;
    public string HospitalName { get; set; } = string.Empty;
    public double DistanceKm { get; set; }
    public int EstimatedTravelMinutes { get; set; }
    public int CurrentQueueCount { get; set; }
    public int EstimatedWaitMinutes { get; set; }
    public int AvailableBeds { get; set; }
    public string BedClass { get; set; } = string.Empty;
    public double RecommendationScore { get; set; }
    public string SpecialtyCode { get; set; } = string.Empty;
    public string SpecialtyName { get; set; } = string.Empty;
    public HospitalType HospitalType { get; set; }
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class RecommendationRequestDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string SpecialtyCode { get; set; } = string.Empty;
    public string BedClass { get; set; } = BedClasses.Kelas1;
    public int MaxResults { get; set; } = 5;
    public int MaxDistanceKm { get; set; } = 50;
    public bool IncludeQueueEstimation { get; set; } = true;
}

public class NearbyHospitalRequestDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? SpecialtyCode { get; set; }
    public int RadiusKm { get; set; } = 25;
    public int MaxResults { get; set; } = 20;
}

public class HospitalDetailDto
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
    public List<SpecialtyDto> Specialties { get; set; } = new();
    public List<BedCapacityDto> BedCapacities { get; set; } = new();
    public QueueInfoDto? CurrentQueue { get; set; }
    public DateTime LastUpdated { get; set; }
    public double DistanceKm { get; set; }
    public int EstimatedTravelMinutes { get; set; }
}

public class SpecialtyDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public SpecialtyCategory Category { get; set; }
}

public class BedCapacityDto
{
    public string Class { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Occupied { get; set; }
    public int Available { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class QueueInfoDto
{
    public int CurrentLength { get; set; }
    public int CurrentServingNumber { get; set; }
    public int EstimatedWaitMinutes { get; set; }
    public double ServingVelocityPerHour { get; set; }
    public int DoctorQuota { get; set; }
    public int DoctorsOnDuty { get; set; }
    public DateTime LastUpdated { get; set; }
    public QueueStatus Status { get; set; }
}
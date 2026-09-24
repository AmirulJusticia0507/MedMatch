using MedMatch.Core.Models;
using MedMatch.Core.DTOs;

namespace MedMatch.Core.Interfaces;

public interface IBpjsApiClient
{
    Task<List<BedCapacity>> GetBedAvailabilityAsync(string hospitalCode);
    Task<List<QueueInfo>> GetQueueInfoAsync(string hospitalCode, string? specialtyCode = null);
    Task<bool> TestConnectionAsync();
}

public interface ISiranapApiClient
{
    Task<List<Hospital>> GetFacilitiesAsync();
    Task<Hospital?> GetFacilityByCodeAsync(string code);
    Task<List<Specialty>> GetSpecialtiesAsync();
    Task<bool> TestConnectionAsync();
}

public interface ISpatialRoutingClient
{
    Task<int> GetTravelTimeMinutesAsync(double fromLat, double fromLng, double toLat, double toLng);
    Task<double> GetDistanceKmAsync(double fromLat, double fromLng, double toLat, double toLng);
    Task<bool> TestConnectionAsync();
}

public interface IRecommendationEngine
{
    Task<List<HospitalRecommendationDto>> GetRecommendationsAsync(RecommendationRequestDto request);
    Task<List<HospitalRecommendationDto>> GetTopRecommendationsAsync(
        double userLat, double userLng, string specialtyCode, string bedClass, int maxResults = 5);
}
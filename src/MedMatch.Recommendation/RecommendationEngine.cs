using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Core.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.ML;
using Microsoft.ML.Data;

namespace MedMatch.Recommendation;

public class RecommendationEngine : IRecommendationEngine
{
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IBedRepository _bedRepository;
    private readonly IQueueRepository _queueRepository;
    private readonly ISpatialRoutingClient _routingClient;
    private readonly ILogger<RecommendationEngine> _logger;
    private readonly MLContext _mlContext;
    private ITransformer? _queuePredictionModel;
    private PredictionEngine<QueueFeatures, QueuePrediction>? _predictionEngine;

    public RecommendationEngine(
        IHospitalRepository hospitalRepository,
        IBedRepository bedRepository,
        IQueueRepository queueRepository,
        ISpatialRoutingClient routingClient,
        ILogger<RecommendationEngine> logger)
    {
        _hospitalRepository = hospitalRepository;
        _bedRepository = bedRepository;
        _queueRepository = queueRepository;
        _routingClient = routingClient;
        _logger = logger;
        _mlContext = new MLContext(seed: 42);
    }

    public async Task<List<HospitalRecommendationDto>> GetRecommendationsAsync(RecommendationRequestDto request)
    {
        var hospitals = await _hospitalRepository.GetNearbyAsync(
            request.Latitude, request.Longitude, request.MaxDistanceKm,
            request.SpecialtyCode, request.MaxResults * 3);

        if (!hospitals.Any())
        {
            _logger.LogWarning("No hospitals found for specialty {Specialty} within {Distance}km",
                request.SpecialtyCode, request.MaxDistanceKm);
            return new List<HospitalRecommendationDto>();
        }

        var results = new List<HospitalRecommendationDto>();

        foreach (var hospital in hospitals)
        {
            try
            {
                var travelMinutes = await _routingClient.GetTravelTimeMinutesAsync(
                    request.Latitude, request.Longitude, hospital.Latitude, hospital.Longitude);

                var distanceKm = await _routingClient.GetDistanceKmAsync(
                    request.Latitude, request.Longitude, hospital.Latitude, hospital.Longitude);

                var queueInfo = await GetQueueInfo(hospital.Id, request.SpecialtyCode, request.IncludeQueueEstimation);

                var bedScore = CalculateBedScore(hospital, request.BedClass);
                var distanceScore = CalculateDistanceScore(travelMinutes);
                var queueScore = CalculateQueueScore(queueInfo.CurrentLength);
                var facilityScore = CalculateFacilityScore(hospital, request.SpecialtyCode);

                var finalScore = (distanceScore * 0.3) + (queueScore * 0.4) + (bedScore * 0.2) + (facilityScore * 0.1);

                var dto = new HospitalRecommendationDto
                {
                    HospitalId = hospital.Id,
                    HospitalName = hospital.Name,
                    DistanceKm = Math.Round(distanceKm, 1),
                    EstimatedTravelMinutes = travelMinutes,
                    CurrentQueueCount = queueInfo.CurrentLength,
                    EstimatedWaitMinutes = queueInfo.EstimatedWaitMinutes,
                    AvailableBeds = hospital.GetAvailableBeds(request.BedClass),
                    BedClass = request.BedClass,
                    RecommendationScore = Math.Round(finalScore * 100, 1),
                    SpecialtyCode = request.SpecialtyCode,
                    SpecialtyName = hospital.Specialties.FirstOrDefault(s => s.SpecialtyCode == request.SpecialtyCode)?.Name ?? string.Empty,
                    HospitalType = hospital.Type,
                    Address = hospital.Address,
                    Phone = hospital.Phone,
                    Latitude = hospital.Latitude,
                    Longitude = hospital.Longitude,
                    LastUpdated = DateTime.UtcNow
                };

                results.Add(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating recommendation for hospital {HospitalId}", hospital.Id);
            }
        }

        return results
            .OrderByDescending(r => r.RecommendationScore)
            .Take(request.MaxResults)
            .ToList();
    }

    public async Task<List<HospitalRecommendationDto>> GetTopRecommendationsAsync(
        double userLat, double userLng, string specialtyCode, string bedClass, int maxResults = 5)
    {
        var request = new RecommendationRequestDto
        {
            Latitude = userLat,
            Longitude = userLng,
            SpecialtyCode = specialtyCode,
            BedClass = bedClass,
            MaxResults = maxResults
        };

        return await GetRecommendationsAsync(request);
    }

    private async Task<QueueInfo> GetQueueInfo(string hospitalId, string specialtyCode, bool includeQueueEstimation)
    {
        var existing = await _queueRepository.GetLatestAsync(hospitalId, specialtyCode);

        if (existing != null && includeQueueEstimation)
        {
            return existing;
        }

        if (_predictionEngine != null && !includeQueueEstimation)
        {
            return PredictQueue(hospitalId, specialtyCode);
        }

        return new QueueInfo
        {
            HospitalId = hospitalId,
            SpecialtyCode = specialtyCode,
            CurrentLength = 0,
            EstimatedWaitMinutes = 0,
            CurrentServingNumber = 0,
            ServingVelocityPerHour = 10,
            DoctorQuota = 1,
            DoctorsOnDuty = 1,
            LastUpdated = DateTime.UtcNow,
            Status = QueueStatus.Normal
        };
    }

    private QueueInfo PredictQueue(string hospitalId, string specialtyCode)
    {
        var features = new QueueFeatures
        {
            HospitalId = hospitalId,
            SpecialtyCode = specialtyCode,
            HourOfDay = DateTime.Now.Hour,
            DayOfWeek = (int)DateTime.Now.DayOfWeek,
            IsWeekend = DateTime.Now.DayOfWeek == DayOfWeek.Saturday || DateTime.Now.DayOfWeek == DayOfWeek.Sunday
        };

        var prediction = _predictionEngine!.Predict(features);

        return new QueueInfo
        {
            HospitalId = hospitalId,
            SpecialtyCode = specialtyCode,
            CurrentLength = Math.Max(0, (int)Math.Round(prediction.PredictedQueueLength)),
            EstimatedWaitMinutes = Math.Max(0, (int)Math.Round(prediction.PredictedWaitMinutes)),
            CurrentServingNumber = 0,
            ServingVelocityPerHour = 10,
            DoctorQuota = 1,
            DoctorsOnDuty = 1,
            LastUpdated = DateTime.UtcNow,
            Status = prediction.PredictedQueueLength > 20 ? QueueStatus.Busy : QueueStatus.Normal
        };
    }

    private double CalculateDistanceScore(int travelMinutes)
    {
        if (travelMinutes <= 15) return 1.0;
        if (travelMinutes <= 30) return 0.8;
        if (travelMinutes <= 45) return 0.6;
        if (travelMinutes <= 60) return 0.4;
        return 0.2;
    }

    private double CalculateQueueScore(int currentLength)
    {
        if (currentLength <= 5) return 1.0;
        if (currentLength <= 15) return 0.8;
        if (currentLength <= 30) return 0.5;
        if (currentLength <= 50) return 0.3;
        return 0.1;
    }

    private double CalculateBedScore(Hospital hospital, string bedClass)
    {
        var available = hospital.GetAvailableBeds(bedClass);
        if (available >= 5) return 1.0;
        if (available >= 2) return 0.7;
        if (available >= 1) return 0.4;
        return 0.0;
    }

    private double CalculateFacilityScore(Hospital hospital, string specialtyCode)
    {
        return hospital.HasSpecialty(specialtyCode) ? 1.0 : 0.0;
    }

    public void TrainQueuePredictionModel(List<QueueTrainingData> trainingData)
    {
        if (trainingData.Count < 10)
        {
            _logger.LogWarning("Insufficient training data for queue prediction model");
            return;
        }

        var dataView = _mlContext.Data.LoadFromEnumerable(trainingData);

        var pipeline = _mlContext.Transforms.Concatenate("Features",
                nameof(QueueTrainingData.HourOfDay),
                nameof(QueueTrainingData.DayOfWeek),
                nameof(QueueTrainingData.IsWeekend))
            .Append(_mlContext.Transforms.NormalizeMinMax("Features"))
            .Append(_mlContext.Regression.Trainers.FastTree(
                labelColumnName: nameof(QueueTrainingData.QueueLength),
                featureColumnName: "Features"));

        _queuePredictionModel = pipeline.Fit(dataView);
        _predictionEngine = _mlContext.Model.CreatePredictionEngine<QueueFeatures, QueuePrediction>(_queuePredictionModel);

        _logger.LogInformation("Queue prediction model trained with {Count} samples", trainingData.Count);
    }

    public async Task RetrainModelAsync()
    {
        var historicalData = await GetHistoricalQueueData();
        TrainQueuePredictionModel(historicalData);
    }

    private Task<List<QueueTrainingData>> GetHistoricalQueueData()
    {
        return Task.FromResult(new List<QueueTrainingData>());
    }
}

public class QueueFeatures
{
    public string HospitalId { get; set; } = string.Empty;
    public string SpecialtyCode { get; set; } = string.Empty;
    public float HourOfDay { get; set; }
    public float DayOfWeek { get; set; }
    public bool IsWeekend { get; set; }
}

public class QueuePrediction
{
    [ColumnName("Score")]
    public float PredictedQueueLength { get; set; }

    public float PredictedWaitMinutes => PredictedQueueLength * 5f;
}

public class QueueTrainingData
{
    public string HospitalId { get; set; } = string.Empty;
    public string SpecialtyCode { get; set; } = string.Empty;
    public float HourOfDay { get; set; }
    public float DayOfWeek { get; set; }
    public bool IsWeekend { get; set; }
    public float QueueLength { get; set; }
}
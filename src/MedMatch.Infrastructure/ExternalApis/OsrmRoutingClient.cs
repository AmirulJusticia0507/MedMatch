using MedMatch.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace MedMatch.Infrastructure.ExternalApis;

public class OsrmOptions
{
    public string BaseUrl { get; set; } = "http://router.project-osrm.org";
    public int TimeoutSeconds { get; set; } = 10;
}

public class OsrmRoutingClient : ISpatialRoutingClient
{
    private readonly HttpClient _httpClient;
    private readonly OsrmOptions _options;
    private readonly ILogger<OsrmRoutingClient> _logger;

    public OsrmRoutingClient(HttpClient httpClient, IOptions<OsrmOptions> options, ILogger<OsrmRoutingClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
    }

    public async Task<int> GetTravelTimeMinutesAsync(double fromLat, double fromLng, double toLat, double toLng)
    {
        try
        {
            var url = $"/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=false";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<OsrmRouteResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            if (result?.Routes?.Any() == true)
            {
                var durationSeconds = result.Routes.First().Duration;
                return (int)Math.Ceiling(durationSeconds / 60.0);
            }
            
            return EstimateTravelTimeMinutes(fromLat, fromLng, toLat, toLng);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OSRM routing failed, using fallback estimation");
            return EstimateTravelTimeMinutes(fromLat, fromLng, toLat, toLng);
        }
    }

    public async Task<double> GetDistanceKmAsync(double fromLat, double fromLng, double toLat, double toLng)
    {
        try
        {
            var url = $"/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=false";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<OsrmRouteResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            if (result?.Routes?.Any() == true)
            {
                return result.Routes.First().Distance / 1000.0;
            }
            
            return CalculateHaversineDistance(fromLat, fromLng, toLat, toLng);
        }
        catch
        {
            return CalculateHaversineDistance(fromLat, fromLng, toLat, toLng);
        }
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/route/v1/driving/106.8456,-6.2088;106.8272,-6.1754?overview=false");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static int EstimateTravelTimeMinutes(double lat1, double lng1, double lat2, double lng2)
    {
        var distanceKm = CalculateHaversineDistance(lat1, lng1, lat2, lng2);
        var avgSpeedKmh = 25; // Urban average speed
        return (int)Math.Ceiling((distanceKm / avgSpeedKmh) * 60);
    }

    private static double CalculateHaversineDistance(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371;
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;

    private class OsrmRouteResponse
    {
        public List<OsrmRoute>? Routes { get; set; }
    }

    private class OsrmRoute
    {
        public double Distance { get; set; }
        public double Duration { get; set; }
    }
}
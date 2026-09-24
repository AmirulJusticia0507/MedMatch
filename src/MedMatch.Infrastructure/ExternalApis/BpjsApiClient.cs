using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;
using System.Text.Json;

namespace MedMatch.Infrastructure.ExternalApis;

public class BpjsApiOptions
{
    public string BaseUrl { get; set; } = "https://api.bpjs.go.id";
    public string ClientId { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}

public class BpjsApiClient : IBpjsApiClient
{
    private readonly HttpClient _httpClient;
    private readonly BpjsApiOptions _options;
    private readonly ILogger<BpjsApiClient> _logger;
    private string? _accessToken;
    private DateTime _tokenExpiry;

    public BpjsApiClient(HttpClient httpClient, IOptions<BpjsApiOptions> options, ILogger<BpjsApiClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
    }

    public async Task<List<BedCapacity>> GetBedAvailabilityAsync(string hospitalCode)
    {
        try
        {
            await EnsureTokenAsync();
            var response = await _httpClient.GetAsync($"/v1/faskes/{hospitalCode}/bed-availability");
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<BpjsBedResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            return result?.Data?.Select(d => new BedCapacity
            {
                Class = d.Kelas,
                Total = d.Total,
                Occupied = d.Terisi,
                LastUpdated = DateTime.UtcNow
            }).ToList() ?? new List<BedCapacity>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get bed availability for hospital {HospitalCode}", hospitalCode);
            return new List<BedCapacity>();
        }
    }

    public async Task<List<QueueInfo>> GetQueueInfoAsync(string hospitalCode, string? specialtyCode = null)
    {
        try
        {
            await EnsureTokenAsync();
            var url = $"/v1/faskes/{hospitalCode}/queue";
            if (!string.IsNullOrEmpty(specialtyCode))
                url += $"?specialty={specialtyCode}";
            
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<BpjsQueueResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            return result?.Data?.Select(d => new QueueInfo
            {
                HospitalId = hospitalCode,
                SpecialtyCode = d.PoliCode,
                CurrentLength = d.Antrean,
                CurrentServingNumber = d.SedangDilayani,
                EstimatedWaitMinutes = d.EstimasiMenit,
                ServingVelocityPerHour = d.KecepatanLayanan,
                DoctorQuota = d.KuotaDokter,
                DoctorsOnDuty = d.DokterBertugas,
                LastUpdated = DateTime.UtcNow,
                Status = ParseQueueStatus(d.Status)
            }).ToList() ?? new List<QueueInfo>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get queue info for hospital {HospitalCode}", hospitalCode);
            return new List<QueueInfo>();
        }
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            await EnsureTokenAsync();
            var response = await _httpClient.GetAsync("/v1/health");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task EnsureTokenAsync()
    {
        if (_accessToken != null && DateTime.UtcNow < _tokenExpiry.AddMinutes(-5))
            return;

        var tokenRequest = new { client_id = _options.ClientId, client_secret = _options.Secret };
        var response = await _httpClient.PostAsJsonAsync("/v1/oauth/token", tokenRequest);
        response.EnsureSuccessStatusCode();
        
        var tokenResult = JsonSerializer.Deserialize<BpjsTokenResponse>(await response.Content.ReadAsStringAsync());
        _accessToken = tokenResult?.AccessToken;
        _tokenExpiry = DateTime.UtcNow.AddSeconds(tokenResult?.ExpiresIn ?? 3600);
        
        _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
    }

    private static QueueStatus ParseQueueStatus(string? status)
        => status?.ToUpper() switch
        {
            "NORMAL" => QueueStatus.Normal,
            "BUSY" => QueueStatus.Busy,
            "FULL" => QueueStatus.Full,
            "CLOSED" => QueueStatus.Closed,
            _ => QueueStatus.Normal
        };

    private class BpjsTokenResponse { public string? AccessToken { get; set; } public int ExpiresIn { get; set; } }
    private class BpjsBedResponse { public List<BpjsBedData>? Data { get; set; } }
    private class BpjsBedData { public string Kelas { get; set; } = string.Empty; public int Total { get; set; } public int Terisi { get; set; } }
    private class BpjsQueueResponse { public List<BpjsQueueData>? Data { get; set; } }
    private class BpjsQueueData 
    { 
        public string PoliCode { get; set; } = string.Empty; 
        public int Antrean { get; set; }
        public int SedangDilayani { get; set; }
        public int EstimasiMenit { get; set; }
        public double KecepatanLayanan { get; set; }
        public int KuotaDokter { get; set; }
        public int DokterBertugas { get; set; }
        public string? Status { get; set; }
    }
}
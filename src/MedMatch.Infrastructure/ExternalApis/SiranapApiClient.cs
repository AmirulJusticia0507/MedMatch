using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace MedMatch.Infrastructure.ExternalApis;

public class SiranapApiOptions
{
    public string BaseUrl { get; set; } = "https://siranap.kemkes.go.id";
    public string ApiKey { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}

public class SiranapApiClient : ISiranapApiClient
{
    private readonly HttpClient _httpClient;
    private readonly SiranapApiOptions _options;
    private readonly ILogger<SiranapApiClient> _logger;

    public SiranapApiClient(HttpClient httpClient, IOptions<SiranapApiOptions> options, ILogger<SiranapApiClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
        _httpClient.DefaultRequestHeaders.Add("X-API-Key", _options.ApiKey);
    }

    public async Task<List<Hospital>> GetFacilitiesAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/faskes");
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<SiranapFacilityResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            return result?.Data?.Select(MapToHospital).ToList() ?? new List<Hospital>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get facilities from SIRANAP");
            return new List<Hospital>();
        }
    }

    public async Task<Hospital?> GetFacilityByCodeAsync(string code)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/api/faskes/{code}");
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return null;
            
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<SiranapFacilityResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            return result?.Data?.FirstOrDefault() != null ? MapToHospital(result.Data.First()) : null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get facility {Code} from SIRANAP", code);
            return null;
        }
    }

    public async Task<List<Specialty>> GetSpecialtiesAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/master/poli");
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<SiranapSpecialtyResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            return result?.Data?.Select(d => new Specialty
            {
                Code = d.Kode,
                Name = d.Nama,
                Description = d.Deskripsi ?? string.Empty,
                Category = ParseCategory(d.Kategori),
                IsActive = true
            }).ToList() ?? new List<Specialty>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get specialties from SIRANAP");
            return new List<Specialty>();
        }
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/health");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private Hospital MapToHospital(SiranapFacilityData d)
    {
        return new Hospital
        {
            Id = d.Kode,
            Name = d.Nama,
            Code = d.Kode,
            Latitude = d.Latitude ?? 0,
            Longitude = d.Longitude ?? 0,
            Address = d.Alamat ?? string.Empty,
            Phone = d.Telepon ?? string.Empty,
            Email = d.Email,
            Type = ParseHospitalType(d.Jenis),
            Status = ParseHospitalStatus(d.Status),
            Specialties = d.Poli?.Select(p => new HospitalSpecialty
            {
                HospitalId = d.Kode,
                SpecialtyCode = p.Kode,
                Name = p.Nama,
                Category = ParseCategory(p.Kategori)
            }).ToList() ?? new List<HospitalSpecialty>(),
            BedCapacities = d.Kamar?.Select(k => new HospitalBedCapacity
            {
                HospitalId = d.Kode,
                Class = k.Kelas,
                Total = k.Total,
                Occupied = k.Terisi,
                LastUpdated = DateTime.UtcNow
            }).ToList() ?? new List<HospitalBedCapacity>(),
            LastUpdated = DateTime.UtcNow,
            IsActive = true
        };
    }

    private static HospitalType ParseHospitalType(string? jenis)
        => jenis?.ToUpper() switch
        {
            "RSU" => HospitalType.RumahSakitUmum,
            "RSK" => HospitalType.RumahSakitKhusus,
            "RSJ" => HospitalType.RumahSakitJiwa,
            "PUSKESMAS" => HospitalType.Puskesmas,
            "KLINIK_PRATAMA" => HospitalType.KlinikPratama,
            "KLINIK_UTAMA" => HospitalType.KlinikUtama,
            _ => HospitalType.RumahSakitUmum
        };

    private static HospitalStatus ParseHospitalStatus(string? status)
        => status?.ToUpper() switch
        {
            "AKTIF" => HospitalStatus.Active,
            "PERAWATAN" => HospitalStatus.Maintenance,
            "PENUH" => HospitalStatus.Full,
            "TUTUP" => HospitalStatus.Closed,
            _ => HospitalStatus.Active
        };

    private static SpecialtyCategory ParseCategory(string? kategori)
        => kategori?.ToUpper() switch
        {
            "PENYAKIT_DALAM" => SpecialtyCategory.InternalMedicine,
            "BEDAH" => SpecialtyCategory.Surgery,
            "ANAK" => SpecialtyCategory.Pediatrics,
            "KEBIDANAN" => SpecialtyCategory.ObstetricsGynecology,
            "IGD" => SpecialtyCategory.Emergency,
            "JANTUNG" => SpecialtyCategory.Cardiology,
            "SARAF" => SpecialtyCategory.Neurology,
            "ORTOPEDI" => SpecialtyCategory.Orthopedics,
            "KULIT" => SpecialtyCategory.Dermatology,
            "JIWA" => SpecialtyCategory.Psychiatry,
            "RADIOLOGI" => SpecialtyCategory.Radiology,
            "ANESTESI" => SpecialtyCategory.Anesthesiology,
            "ANATOMI_PATOLOGI" => SpecialtyCategory.Pathology,
            "ONKOLOGI" => SpecialtyCategory.Oncology,
            "PARU" => SpecialtyCategory.Pulmonology,
            "GINJAL" => SpecialtyCategory.Nephrology,
            "GASTRO" => SpecialtyCategory.Gastroenterology,
            "ENDOKRIN" => SpecialtyCategory.Endocrinology,
            _ => SpecialtyCategory.Other
        };

    private class SiranapFacilityResponse { public List<SiranapFacilityData>? Data { get; set; } }
    private class SiranapFacilityData 
    { 
        public string Kode { get; set; } = string.Empty;
        public string Nama { get; set; } = string.Empty;
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? Alamat { get; set; }
        public string? Telepon { get; set; }
        public string? Email { get; set; }
        public string? Jenis { get; set; }
        public string? Status { get; set; }
        public List<SiranapFacilityPoli>? Poli { get; set; }
        public List<SiranapFacilityKamar>? Kamar { get; set; }
    }
    private class SiranapFacilityPoli { public string Kode { get; set; } = string.Empty; public string Nama { get; set; } = string.Empty; public string? Kategori { get; set; } }
    private class SiranapFacilityKamar { public string Kelas { get; set; } = string.Empty; public int Total { get; set; } public int Terisi { get; set; } }
    private class SiranapSpecialtyResponse { public List<SiranapSpecialtyData>? Data { get; set; } }
    private class SiranapSpecialtyData { public string Kode { get; set; } = string.Empty; public string Nama { get; set; } = string.Empty; public string? Deskripsi { get; set; } public string? Kategori { get; set; } }
}

using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using MedMatch.Core.DTOs;
using MedMatch.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MedMatch.Infrastructure.ExternalApis;

public sealed class SatuSehatMsiOptions
{
    public string BaseUrl { get; set; } = "https://api-satusehat-stg.dto.kemkes.go.id";
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}

public sealed class SatuSehatMsiClient : ISatuSehatMsiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly SatuSehatMsiOptions _options;
    private readonly ILogger<SatuSehatMsiClient> _logger;
    private static readonly SemaphoreSlim TokenLock = new(1, 1);
    private static string? _accessToken;
    private static DateTimeOffset _tokenExpiresAt = DateTimeOffset.MinValue;

    public SatuSehatMsiClient(
        HttpClient httpClient,
        IOptions<SatuSehatMsiOptions> options,
        ILogger<SatuSehatMsiClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
        _httpClient.Timeout = TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 5, 120));
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ClientId) &&
        !string.IsNullOrWhiteSpace(_options.ClientSecret);

    public async Task<List<SatuSehatFacilityDto>> GetFacilitiesAsync(
        string? provinceCode,
        string? cityCode,
        int limit = 20,
        int page = 1,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return new List<SatuSehatFacilityDto>();
        }

        await EnsureTokenAsync(cancellationToken);

        var query = new List<string>
        {
            $"limit={Math.Clamp(limit, 1, 2000)}",
            $"page={Math.Max(page, 1)}",
            "jenis_sarana=104"
        };

        if (!string.IsNullOrWhiteSpace(provinceCode))
        {
            query.Add($"kode_provinsi={Uri.EscapeDataString(provinceCode)}");
        }

        if (!string.IsNullOrWhiteSpace(cityCode))
        {
            query.Add($"kode_kabkota={Uri.EscapeDataString(cityCode)}");
        }

        var path = $"masterdata/v1/mastersaranaindex/mastersarana?{string.Join('&', query)}";
        using var response = await _httpClient.GetAsync(path, cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _accessToken = null;
            _tokenExpiresAt = DateTimeOffset.MinValue;
            await EnsureTokenAsync(cancellationToken);
            using var retryResponse = await _httpClient.GetAsync(path, cancellationToken);
            retryResponse.EnsureSuccessStatusCode();
            return await ReadFacilitiesAsync(retryResponse, cancellationToken);
        }

        response.EnsureSuccessStatusCode();
        return await ReadFacilitiesAsync(response, cancellationToken);
    }

    public async Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return false;
        }

        try
        {
            await EnsureTokenAsync(cancellationToken);
            using var response = await _httpClient.GetAsync(
                "masterdata/v1/mastersaranaindex/mastersarana?limit=1&page=1&jenis_sarana=104",
                cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SATUSEHAT MSI connection test failed");
            return false;
        }
    }

    private async Task<List<SatuSehatFacilityDto>> ReadFacilitiesAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var payload = JsonSerializer.Deserialize<MsiResponse>(body, JsonOptions);
        return payload?.Data?.Select(MapFacility).ToList() ?? new List<SatuSehatFacilityDto>();
    }

    private async Task EnsureTokenAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(_accessToken) && DateTimeOffset.UtcNow < _tokenExpiresAt)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
            return;
        }

        await TokenLock.WaitAsync(cancellationToken);
        try
        {
            if (!string.IsNullOrWhiteSpace(_accessToken) && DateTimeOffset.UtcNow < _tokenExpiresAt)
            {
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
                return;
            }

            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret
            });

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                "oauth2/v1/accesstoken?grant_type=client_credentials")
            {
                Content = content
            };

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            response.EnsureSuccessStatusCode();

            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (!root.TryGetProperty("access_token", out var tokenElement) ||
                string.IsNullOrWhiteSpace(tokenElement.GetString()))
            {
                throw new InvalidOperationException("SATUSEHAT MSI token response did not contain access_token.");
            }

            _accessToken = tokenElement.GetString();
            _tokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(ReadExpiresIn(root));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        }
        finally
        {
            TokenLock.Release();
        }
    }

    private static int ReadExpiresIn(JsonElement root)
    {
        if (!root.TryGetProperty("expires_in", out var expiresElement))
        {
            return 3600;
        }

        if (expiresElement.ValueKind == JsonValueKind.Number && expiresElement.TryGetInt32(out var seconds))
        {
            return Math.Max(seconds - 60, 60);
        }

        return expiresElement.ValueKind == JsonValueKind.String &&
               int.TryParse(expiresElement.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? Math.Max(parsed - 60, 60)
            : 3540;
    }

    private static SatuSehatFacilityDto MapFacility(MsiFacilityData data) => new()
    {
        KodeSatusehat = data.KodeSatusehat,
        KodeSarana = data.KodeSarana,
        Nama = data.Nama,
        Telepon = data.Telp ?? string.Empty,
        Email = data.Email ?? string.Empty,
        Website = data.Website ?? string.Empty,
        Latitude = ParseCoordinate(data.Latitude),
        Longitude = ParseCoordinate(data.Longitude),
        Operasional = ParseBoolean(data.Operasional),
        Alamat = data.Alamat ?? string.Empty,
        KodeProvinsi = data.Provinsi?.Kode ?? string.Empty,
        NamaProvinsi = data.Provinsi?.Nama ?? string.Empty,
        KodeKabkota = data.Kabkota?.Kode ?? string.Empty,
        NamaKabkota = data.Kabkota?.Nama ?? string.Empty,
        KodeJenisSarana = data.JenisSarana?.Kode ?? string.Empty,
        NamaJenisSarana = data.JenisSarana?.Nama ?? string.Empty,
        KodeSubjenis = data.Subjenis?.Kode ?? string.Empty,
        NamaSubjenis = data.Subjenis?.Nama ?? string.Empty,
        KodeKelasSarana = data.KelasSarana?.Kode ?? string.Empty,
        NamaKelasSarana = data.KelasSarana?.Nama ?? string.Empty,
        StatusSarana = data.StatusSarana ?? string.Empty,
        StatusAktif = ParseBoolean(data.StatusAktif)
    };

    private static double? ParseCoordinate(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number)) return number;
        return value.ValueKind == JsonValueKind.String &&
               double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static bool ParseBoolean(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.String => bool.TryParse(value.GetString(), out var parsed) && parsed,
        _ => false
    };

    private sealed class MsiResponse
    {
        public List<MsiFacilityData>? Data { get; set; }
    }

    private sealed class MsiFacilityData
    {
        [JsonPropertyName("kode_satusehat")]
        [JsonConverter(typeof(FlexibleStringConverter))]
        public string KodeSatusehat { get; set; } = string.Empty;

        [JsonPropertyName("kode_sarana")]
        [JsonConverter(typeof(FlexibleStringConverter))]
        public string KodeSarana { get; set; } = string.Empty;

        [JsonPropertyName("nama")]
        public string Nama { get; set; } = string.Empty;

        [JsonPropertyName("telp")]
        public string? Telp { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("website")]
        public string? Website { get; set; }

        [JsonPropertyName("latitude")]
        public JsonElement Latitude { get; set; }

        [JsonPropertyName("longitude")]
        public JsonElement Longitude { get; set; }

        [JsonPropertyName("operasional")]
        public JsonElement Operasional { get; set; }

        [JsonPropertyName("alamat")]
        public string? Alamat { get; set; }

        [JsonPropertyName("provinsi")]
        public MsiRegion? Provinsi { get; set; }

        [JsonPropertyName("kabkota")]
        public MsiRegion? Kabkota { get; set; }

        [JsonPropertyName("jenis_sarana")]
        public MsiNamedCode? JenisSarana { get; set; }

        [JsonPropertyName("subjenis")]
        public MsiNamedCode? Subjenis { get; set; }

        [JsonPropertyName("kelas_sarana")]
        public MsiNamedCode? KelasSarana { get; set; }

        [JsonPropertyName("status_sarana")]
        public string? StatusSarana { get; set; }

        [JsonPropertyName("status_aktif")]
        public JsonElement StatusAktif { get; set; }
    }

    private sealed class MsiRegion
    {
        [JsonPropertyName("kode")]
        [JsonConverter(typeof(FlexibleStringConverter))]
        public string Kode { get; set; } = string.Empty;

        [JsonPropertyName("nama")]
        public string Nama { get; set; } = string.Empty;
    }

    private sealed class MsiNamedCode
    {
        [JsonPropertyName("kode")]
        [JsonConverter(typeof(FlexibleStringConverter))]
        public string Kode { get; set; } = string.Empty;

        [JsonPropertyName("nama")]
        public string Nama { get; set; } = string.Empty;
    }

    private sealed class FlexibleStringConverter : JsonConverter<string>
    {
        public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType switch
            {
                JsonTokenType.String => reader.GetString(),
                JsonTokenType.Number => reader.GetDouble().ToString(CultureInfo.InvariantCulture),
                JsonTokenType.Null => null,
                _ => throw new JsonException("Expected a string or number value.")
            };

        public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value);
    }
}

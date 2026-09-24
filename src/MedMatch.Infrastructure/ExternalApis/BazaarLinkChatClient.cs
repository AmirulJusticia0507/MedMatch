using MedMatch.Core.DTOs;
using MedMatch.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json;

namespace MedMatch.Infrastructure.ExternalApis;

public class BazaarLinkOptions
{
    public string BaseUrl { get; set; } = "https://api.bazaarlink.ai/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "qwen/qwen3.7-flash:free";
    public int TimeoutSeconds { get; set; } = 60;
}

public class BazaarLinkChatClient : IChatAiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly BazaarLinkOptions _options;
    private readonly ILogger<BazaarLinkChatClient> _logger;

    public BazaarLinkChatClient(HttpClient httpClient, IOptions<BazaarLinkOptions> options, ILogger<BazaarLinkChatClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
        if (!_httpClient.DefaultRequestHeaders.Contains("Authorization"))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _options.ApiKey);
        }
    }

    public async Task<ChatResponseDto> ChatAsync(ChatRequestDto request, CancellationToken cancellationToken = default)
    {
        var messages = new List<object>();
        if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
        {
            messages.Add(new { role = "system", content = request.SystemPrompt });
        }
        if (request.History?.Any() == true)
        {
            foreach (var message in request.History)
            {
                messages.Add(new { role = message.Role, content = message.Content });
            }
        }
        messages.Add(new { role = "user", content = request.Message });

        var payload = new { model = _options.Model, messages };
        var json = JsonSerializer.Serialize(payload);

        try
        {
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("chat/completions", content, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("BazaarLink chat failed: {StatusCode} {Body}", response.StatusCode, body);
                return new ChatResponseDto
                {
                    Success = false,
                    Model = _options.Model,
                    Error = $"Upstream returned {(int)response.StatusCode}: {Truncate(body, 300)}"
                };
            }

            var result = JsonSerializer.Deserialize<ChatCompletionResponse>(body, JsonOptions);
            var reply = result?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;

            return new ChatResponseDto
            {
                Success = !string.IsNullOrEmpty(reply),
                Reply = reply,
                Model = result?.Model ?? _options.Model,
                PromptTokens = result?.Usage?.PromptTokens ?? 0,
                CompletionTokens = result?.Usage?.CompletionTokens ?? 0,
                Error = string.IsNullOrEmpty(reply) ? "Empty reply from model" : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BazaarLink chat request failed");
            return new ChatResponseDto
            {
                Success = false,
                Model = _options.Model,
                Error = ex.Message
            };
        }
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var result = await ChatAsync(new ChatRequestDto { Message = "ping" });
            return result.Success;
        }
        catch
        {
            return false;
        }
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";

    private class ChatCompletionResponse
    {
        public string? Model { get; set; }
        public List<Choice>? Choices { get; set; }
        public Usage? Usage { get; set; }
    }

    private class Choice
    {
        public ChoiceMessage? Message { get; set; }
    }

    private class ChoiceMessage
    {
        public string? Content { get; set; }
    }

    private class Usage
    {
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
    }
}

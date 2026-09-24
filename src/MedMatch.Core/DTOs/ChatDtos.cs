namespace MedMatch.Core.DTOs;

public class ChatRequestDto
{
    public string Message { get; set; } = string.Empty;
    public string? SystemPrompt { get; set; }
    public List<ChatMessageDto>? History { get; set; }
}

public class ChatMessageDto
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
}

public class ChatResponseDto
{
    public bool Success { get; set; }
    public string Reply { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? Error { get; set; }
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
}

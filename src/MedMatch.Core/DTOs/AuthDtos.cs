namespace MedMatch.Core.DTOs;

public record SignUpRequest(string Email, string Password, string FullName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
public record AuthResponse(string Token, DateTime ExpiresAt, Guid UserId, string Email, string FullName, string Role);

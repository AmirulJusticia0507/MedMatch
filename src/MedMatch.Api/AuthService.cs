using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MedMatch.Core.DTOs;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

public class AuthService
{
    private readonly MedMatchDbContext _db;
    private readonly IPasswordHasher<UserAccount> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthService(
        MedMatchDbContext db,
        IPasswordHasher<UserAccount> passwordHasher,
        IConfiguration configuration)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    public async Task<AuthResponse?> SignUpAsync(SignUpRequest request)
    {
        var email = NormalizeEmail(request.Email);
        if (await _db.Users.AnyAsync(user => user.Email == email))
        {
            return null;
        }

        var user = new UserAccount
        {
            Email = email,
            FullName = request.FullName.Trim()
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return CreateAuthResponse(user);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _db.Users.SingleOrDefaultAsync(item => item.Email == email && item.IsActive);
        if (user is null)
        {
            return null;
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return null;
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return CreateAuthResponse(user);
    }

    public async Task<string?> CreatePasswordResetTokenAsync(string rawEmail)
    {
        var email = NormalizeEmail(rawEmail);
        var user = await _db.Users.SingleOrDefaultAsync(item => item.Email == email && item.IsActive);
        if (user is null)
        {
            return null;
        }

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = HashToken(token),
            ExpiresAt = DateTime.UtcNow.AddMinutes(30)
        });
        await _db.SaveChangesAsync();
        return token;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var tokenHash = HashToken(request.Token);
        var resetToken = await _db.PasswordResetTokens
            .Include(item => item.User)
            .SingleOrDefaultAsync(item =>
                item.TokenHash == tokenHash && item.UsedAt == null && item.ExpiresAt > DateTime.UtcNow);

        if (resetToken is null || !resetToken.User.IsActive)
        {
            return false;
        }

        resetToken.User.PasswordHash = _passwordHasher.HashPassword(resetToken.User, request.NewPassword);
        resetToken.User.UpdatedAt = DateTime.UtcNow;
        resetToken.UsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public AuthResponse CreateAuthResponse(UserAccount user)
    {
        var expiresAt = DateTime.UtcNow.AddHours(8);
        var key = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role)
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(jwt),
            expiresAt,
            user.Id,
            user.Email,
            user.FullName,
            user.Role);
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

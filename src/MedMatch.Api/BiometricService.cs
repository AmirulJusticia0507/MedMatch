using System.Text;
using Fido2NetLib;
using Fido2NetLib.Objects;
using MedMatch.Core.DTOs;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

public sealed class BiometricException(string message) : Exception(message);

public record BiometricCredentialInfo(string Id, string Label, DateTime CreatedAt, DateTime? LastUsedAt);
public record BiometricStatusResponse(bool Enabled, IReadOnlyList<BiometricCredentialInfo> Credentials);

public class BiometricService
{
    private static readonly TimeSpan OptionsTtl = TimeSpan.FromMinutes(5);

    private readonly Fido2 _fido2;
    private readonly MedMatchDbContext _db;
    private readonly AuthService _auth;
    private readonly IMemoryCache _cache;

    public BiometricService(Fido2 fido2, MedMatchDbContext db, AuthService auth, IMemoryCache cache)
    {
        _fido2 = fido2;
        _db = db;
        _auth = auth;
        _cache = cache;
    }

    public async Task<BiometricStatusResponse> GetStatusAsync(Guid userId)
    {
        var credentials = await _db.BiometricCredentials
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        return new BiometricStatusResponse(
            credentials.Count > 0,
            credentials
                .Select(item => new BiometricCredentialInfo(item.Id.ToString(), item.Label, item.CreatedAt, item.LastUsedAt))
                .ToList());
    }

    public async Task<CredentialCreateOptions> CreateRegistrationOptionsAsync(Guid userId)
    {
        var user = await _db.Users.SingleOrDefaultAsync(item => item.Id == userId && item.IsActive)
            ?? throw new BiometricException("Akun tidak ditemukan.");

        var excludeCredentials = await _db.BiometricCredentials
            .Where(item => item.UserId == userId)
            .Select(item => item.CredentialId)
            .ToListAsync();

        var options = _fido2.RequestNewCredential(new RequestNewCredentialParams
        {
            User = new Fido2User
            {
                Id = Encoding.UTF8.GetBytes(user.Id.ToString()),
                Name = user.Email,
                DisplayName = user.FullName
            },
            ExcludeCredentials = excludeCredentials
                .Select(id => new PublicKeyCredentialDescriptor(WebEncoders.Base64UrlDecode(id)))
                .ToList(),
            AuthenticatorSelection = new AuthenticatorSelection
            {
                AuthenticatorAttachment = AuthenticatorAttachment.Platform,
                ResidentKey = ResidentKeyRequirement.Preferred,
                UserVerification = UserVerificationRequirement.Required
            },
            AttestationPreference = AttestationConveyancePreference.None
        });

        _cache.Set(RegistrationCacheKey(userId), options.ToJson(), OptionsTtl);
        return options;
    }

    public async Task<BiometricCredential> VerifyRegistrationAsync(
        Guid userId,
        AuthenticatorAttestationRawResponse attestation,
        CancellationToken cancellationToken)
    {
        var cacheKey = RegistrationCacheKey(userId);
        var json = _cache.Get<string>(cacheKey)
            ?? throw new BiometricException("Sesi pendaftaran sidik jari sudah kedaluwarsa. Silakan coba lagi.");
        _cache.Remove(cacheKey);

        var options = CredentialCreateOptions.FromJson(json);

        IsCredentialIdUniqueToUserAsyncDelegate isUnique = async (args, token) =>
        {
            var credentialId = WebEncoders.Base64UrlEncode(args.CredentialId);
            return !await _db.BiometricCredentials.AnyAsync(item => item.CredentialId == credentialId, token);
        };

        var credential = await _fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
        {
            AttestationResponse = attestation,
            OriginalOptions = options,
            IsCredentialIdUniqueToUserCallback = isUnique
        }, cancellationToken);

        var entity = new BiometricCredential
        {
            UserId = userId,
            CredentialId = WebEncoders.Base64UrlEncode(credential.Id),
            PublicKey = credential.PublicKey,
            SignCount = credential.SignCount,
            Label = "Sidik jari perangkat"
        };

        _db.BiometricCredentials.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return entity;
    }

    public async Task<AssertionOptions> CreateLoginOptionsAsync(string rawEmail)
    {
        var email = NormalizeEmail(rawEmail);
        var user = await _db.Users.SingleOrDefaultAsync(item => item.Email == email && item.IsActive)
            ?? throw new BiometricException("Email atau sidik jari tidak valid.");

        var credentialIds = await _db.BiometricCredentials
            .Where(item => item.UserId == user.Id)
            .Select(item => item.CredentialId)
            .ToListAsync();

        if (credentialIds.Count == 0)
        {
            throw new BiometricException("Login sidik jari belum diaktifkan untuk akun ini.");
        }

        var options = _fido2.GetAssertionOptions(new GetAssertionOptionsParams
        {
            AllowedCredentials = credentialIds
                .Select(id => new PublicKeyCredentialDescriptor(WebEncoders.Base64UrlDecode(id)))
                .ToList(),
            UserVerification = UserVerificationRequirement.Required
        });

        _cache.Set(LoginCacheKey(email), options.ToJson(), OptionsTtl);
        return options;
    }

    public async Task<AuthResponse> VerifyLoginAsync(
        string rawEmail,
        AuthenticatorAssertionRawResponse assertion,
        CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(rawEmail);
        var cacheKey = LoginCacheKey(email);
        var json = _cache.Get<string>(cacheKey)
            ?? throw new BiometricException("Sesi login sidik jari sudah kedaluwarsa. Silakan coba lagi.");
        _cache.Remove(cacheKey);

        var options = AssertionOptions.FromJson(json);

        if (assertion.RawId is null || assertion.RawId.Length == 0)
        {
            throw new BiometricException("Respons sidik jari tidak valid.");
        }

        var credentialId = WebEncoders.Base64UrlEncode(assertion.RawId);
        var credential = await _db.BiometricCredentials
            .Include(item => item.User)
            .SingleOrDefaultAsync(
                item => item.CredentialId == credentialId && item.User!.IsActive,
                cancellationToken)
            ?? throw new BiometricException("Email atau sidik jari tidak valid.");

        var expectedUserHandle = Encoding.UTF8.GetBytes(credential.User!.Id.ToString());

        IsUserHandleOwnerOfCredentialIdAsync isOwner = (args, _) =>
        {
            var userHandle = args.UserHandle;
            var owned = userHandle is null || userHandle.Length == 0 || userHandle.SequenceEqual(expectedUserHandle);
            return Task.FromResult(owned);
        };

        var result = await _fido2.MakeAssertionAsync(new MakeAssertionParams
        {
            AssertionResponse = assertion,
            OriginalOptions = options,
            StoredPublicKey = credential.PublicKey,
            StoredSignatureCounter = credential.SignCount,
            IsUserHandleOwnerOfCredentialIdCallback = isOwner
        }, cancellationToken);

        credential.SignCount = result.SignCount;
        credential.LastUsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return _auth.CreateAuthResponse(credential.User);
    }

    public async Task<bool> DeleteAsync(Guid userId, string credentialId)
    {
        var credential = await _db.BiometricCredentials
            .SingleOrDefaultAsync(item => item.UserId == userId && item.CredentialId == credentialId);
        if (credential is null)
        {
            return false;
        }

        _db.BiometricCredentials.Remove(credential);
        await _db.SaveChangesAsync();
        return true;
    }

    private static string RegistrationCacheKey(Guid userId) => $"webauthn:register:{userId}";
    private static string LoginCacheKey(string email) => $"webauthn:login:{email}";
    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}

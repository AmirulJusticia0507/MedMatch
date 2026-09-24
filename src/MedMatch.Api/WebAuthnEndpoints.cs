using System.Security.Claims;
using Fido2NetLib;

public record RegisterBiometricRequest(AuthenticatorAttestationRawResponse Credential);
public record BiometricLoginOptionsRequest(string Email);
public record BiometricLoginRequest(string Email, AuthenticatorAssertionRawResponse Credential);

public static class WebAuthnEndpoints
{
    public static void MapWebAuthnEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth/biometric");

        group.MapGet("/status", async (ClaimsPrincipal principal, BiometricService service) =>
        {
            var userId = GetUserId(principal);
            return userId is null
                ? Results.Unauthorized()
                : Results.Ok(await service.GetStatusAsync(userId.Value));
        })
        .RequireAuthorization()
        .WithName("BiometricStatus")
        .WithOpenApi();

        group.MapPost("/register/options", async (ClaimsPrincipal principal, BiometricService service) =>
        {
            var userId = GetUserId(principal);
            if (userId is null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var options = await service.CreateRegistrationOptionsAsync(userId.Value);
                return Results.Text(options.ToJson(), "application/json");
            }
            catch (Exception exception)
            {
                return MapError(exception);
            }
        })
        .RequireAuthorization()
        .WithName("BiometricRegisterOptions")
        .WithOpenApi();

        group.MapPost("/register", async (
            ClaimsPrincipal principal,
            RegisterBiometricRequest request,
            BiometricService service,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserId(principal);
            if (userId is null)
            {
                return Results.Unauthorized();
            }

            if (request?.Credential is null)
            {
                return Results.BadRequest(new { error = "Credential is required." });
            }

            try
            {
                var credential = await service.VerifyRegistrationAsync(userId.Value, request.Credential, cancellationToken);
                return Results.Ok(new
                {
                    id = credential.Id,
                    label = credential.Label,
                    createdAt = credential.CreatedAt
                });
            }
            catch (Exception exception)
            {
                return MapError(exception);
            }
        })
        .RequireAuthorization()
        .WithName("BiometricRegister")
        .WithOpenApi();

        group.MapDelete("/{credentialId}", async (
            string credentialId,
            ClaimsPrincipal principal,
            BiometricService service) =>
        {
            var userId = GetUserId(principal);
            if (userId is null)
            {
                return Results.Unauthorized();
            }

            return await service.DeleteAsync(userId.Value, credentialId)
                ? Results.Ok(new { message = "Sidik jari dihapus." })
                : Results.NotFound(new { error = "Credential not found." });
        })
        .RequireAuthorization()
        .WithName("BiometricDelete")
        .WithOpenApi();

        group.MapPost("/login/options", async (BiometricLoginOptionsRequest? request, BiometricService service) =>
        {
            if (string.IsNullOrWhiteSpace(request?.Email))
            {
                return Results.BadRequest(new { error = "Email is required." });
            }

            try
            {
                var options = await service.CreateLoginOptionsAsync(request.Email);
                return Results.Text(options.ToJson(), "application/json");
            }
            catch (Exception exception)
            {
                return MapError(exception);
            }
        })
        .WithName("BiometricLoginOptions")
        .WithOpenApi();

        group.MapPost("/login", async (
            BiometricLoginRequest? request,
            BiometricService service,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request?.Email) || request.Credential is null)
            {
                return Results.BadRequest(new { error = "Email and credential are required." });
            }

            try
            {
                var result = await service.VerifyLoginAsync(request.Email, request.Credential, cancellationToken);
                return Results.Ok(result);
            }
            catch (Exception exception)
            {
                return MapError(exception);
            }
        })
        .WithName("BiometricLogin")
        .WithOpenApi();
    }

    private static Guid? GetUserId(ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue("sub")
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    private static IResult MapError(Exception exception) => exception switch
    {
        BiometricException => Results.BadRequest(new { error = exception.Message }),
        Fido2VerificationException => Results.BadRequest(new { error = "Verifikasi sidik jari gagal. Silakan coba lagi." }),
        _ => Results.Json(
            new { error = "Terjadi kesalahan saat memproses sidik jari." },
            statusCode: StatusCodes.Status500InternalServerError)
    };
}

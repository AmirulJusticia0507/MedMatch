using System.Text;
using Fido2NetLib;
using MedMatch.Core.DTOs;
using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Infrastructure;
using MedMatch.Infrastructure.Data;
using MedMatch.Recommendation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddChatAi(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("MedMatchFrontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var databaseConnectionName = builder.Environment.IsDevelopment() ? "LocalDbConnection" : "NeonDbConnection";
var databaseConnectionString = builder.Configuration.GetConnectionString(databaseConnectionName);
var hasDatabaseConfiguration = !string.IsNullOrWhiteSpace(databaseConnectionString);
if (hasDatabaseConfiguration)
{
    builder.Services.AddInfrastructure(builder.Configuration, databaseConnectionString!);
    builder.Services.AddRecommendation();
    builder.Services.AddScoped<AuthService>();
    builder.Services.AddScoped<IPasswordHasher<UserAccount>, PasswordHasher<UserAccount>>();

    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Jwt:Key is required when the database is configured.");
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidAudience = builder.Configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };
        });
    builder.Services.AddAuthorization();

    builder.Services.AddMemoryCache();
    var webAuthnOrigins = builder.Configuration.GetSection("WebAuthn:Origins").Get<string[]>()
        ?? new[]
        {
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174"
        };
    var webAuthnConfiguration = new Fido2Configuration
    {
        RPID = builder.Configuration["WebAuthn:RPId"] ?? "localhost",
        RPName = builder.Configuration["WebAuthn:RPName"] ?? "MedMatch",
        Origins = new HashSet<string>(webAuthnOrigins)
    };

    builder.Services.AddSingleton(webAuthnConfiguration);
    builder.Services.AddSingleton(_ => new Fido2(webAuthnConfiguration));
    builder.Services.AddScoped<BiometricService>();
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("MedMatchFrontend");
if (hasDatabaseConfiguration)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapPost("/api/chat", async (ChatRequestDto request, IChatAiClient chatClient, CancellationToken cancellationToken) =>
{
    if (request is null || string.IsNullOrWhiteSpace(request.Message))
    {
        return Results.BadRequest(new { error = "Message is required." });
    }

    var result = await chatClient.ChatAsync(request, cancellationToken);
    return result.Success
        ? Results.Ok(result)
        : Results.Json(result, statusCode: StatusCodes.Status502BadGateway);
})
.WithName("Chat")
.WithOpenApi();

app.MapGet("/api/chat/health", async (IChatAiClient chatClient) =>
{
    var ok = await chatClient.TestConnectionAsync();
    return ok ? Results.Ok(new { status = "ok" }) : Results.StatusCode(StatusCodes.Status502BadGateway);
})
.WithName("ChatHealth")
.WithOpenApi();

if (!hasDatabaseConfiguration)
{
    app.MapGet("/api/specialties", () => Results.Ok(Array.Empty<SpecialtyDto>()))
        .WithName("GetSpecialties")
        .WithOpenApi();

    app.MapGet("/api/recommendations", () => Results.Ok(Array.Empty<HospitalRecommendationDto>()))
        .WithName("GetRecommendations")
        .WithOpenApi();
}

if (hasDatabaseConfiguration)
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<MedMatchDbContext>();
        await DbSeeder.InitializeAsync(db);
    }

    app.MapPost("/api/auth/signup", async (SignUpRequest request, AuthService auth) =>
    {
        if (string.IsNullOrWhiteSpace(request.FullName) ||
            !System.Net.Mail.MailAddress.TryCreate(request.Email, out _) ||
            string.IsNullOrEmpty(request.Password) || request.Password.Length < 8)
        {
            return Results.BadRequest(new { error = "Full name, a valid email, and a password of at least 8 characters are required." });
        }

        var result = await auth.SignUpAsync(request);
        return result is null
            ? Results.Conflict(new { error = "Email is already registered." })
            : Results.Ok(result);
    })
    .WithName("SignUp")
    .WithOpenApi();

    app.MapPost("/api/auth/login", async (LoginRequest request, AuthService auth) =>
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password))
        {
            return Results.BadRequest(new { error = "Email and password are required." });
        }

        var result = await auth.LoginAsync(request);
        return result is null
            ? Results.Json(new { error = "Invalid email or password." }, statusCode: StatusCodes.Status401Unauthorized)
            : Results.Ok(result);
    })
    .WithName("Login")
    .WithOpenApi();

    app.MapPost("/api/auth/forgot-password", async (
        ForgotPasswordRequest request,
        AuthService auth,
        IWebHostEnvironment environment) =>
    {
        if (!System.Net.Mail.MailAddress.TryCreate(request.Email, out _))
        {
            return Results.BadRequest(new { error = "A valid email is required." });
        }

        var token = await auth.CreatePasswordResetTokenAsync(request.Email);
        return Results.Ok(new
        {
            message = "If the email is registered, password reset instructions have been created.",
            resetToken = environment.IsDevelopment() ? token : null
        });
    })
    .WithName("ForgotPassword")
    .WithOpenApi();

    app.MapPost("/api/auth/reset-password", async (ResetPasswordRequest request, AuthService auth) =>
    {
        if (string.IsNullOrWhiteSpace(request.Token) ||
            string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 8)
        {
            return Results.BadRequest(new { error = "A valid token and a password of at least 8 characters are required." });
        }

        return await auth.ResetPasswordAsync(request)
            ? Results.Ok(new { message = "Password has been reset." })
            : Results.BadRequest(new { error = "Reset token is invalid or expired." });
    })
    .WithName("ResetPassword")
    .WithOpenApi();

    app.MapWebAuthnEndpoints();

    app.MapGet("/api/specialties", async (ISpecialtyRepository repository) =>
        Results.Ok(await repository.GetAllAsync()))
        .WithName("GetSpecialties")
        .WithOpenApi();

    app.MapGet("/api/recommendations", async (
        double? latitude,
        double? longitude,
        double? lat,
        double? lng,
        string? specialtyCode,
        string? specialty,
        string? bedClass,
        int? maxResults,
        double? maxDistanceKm,
        IRecommendationEngine recommendationEngine) =>
    {
        var resolvedLatitude = latitude ?? lat;
        var resolvedLongitude = longitude ?? lng;
        var resolvedSpecialty = specialtyCode ?? specialty;

        if (resolvedLatitude is null || resolvedLongitude is null || string.IsNullOrWhiteSpace(resolvedSpecialty))
        {
            return Results.BadRequest(new { error = "latitude, longitude, and specialtyCode are required." });
        }

        var request = new RecommendationRequestDto
        {
            Latitude = resolvedLatitude.Value,
            Longitude = resolvedLongitude.Value,
            SpecialtyCode = resolvedSpecialty,
            BedClass = string.IsNullOrWhiteSpace(bedClass) ? "KELAS_1" : bedClass,
            MaxResults = Math.Clamp(maxResults ?? 5, 1, 20),
            MaxDistanceKm = (int)Math.Clamp(maxDistanceKm ?? 50, 1, 100),
            IncludeQueueEstimation = true
        };

        return Results.Ok(await recommendationEngine.GetRecommendationsAsync(request));
    })
    .WithName("GetRecommendations")
    .WithOpenApi();

    app.MapGet("/api/hospitals", async (IHospitalRepository repository) =>
        Results.Ok(await repository.GetAllAsync()))
        .WithName("GetHospitals")
        .WithOpenApi();

    app.MapGet("/api/hospitals/nearby", async (
        double latitude,
        double longitude,
        string? specialtyCode,
        int? radiusKm,
        int? maxResults,
        IHospitalRepository repository) =>
    {
        var hospitals = await repository.GetNearbyAsync(
            latitude,
            longitude,
            Math.Clamp(radiusKm ?? 25, 1, 100),
            specialtyCode,
            Math.Clamp(maxResults ?? 20, 1, 50));

        var bedClass = "KELAS_1";
        var results = hospitals.Select(hospital => new HospitalRecommendationDto
        {
            HospitalId = hospital.Id,
            HospitalName = hospital.Name,
            BedClass = bedClass,
            CurrentQueueCount = hospital.CurrentQueueCount,
            EstimatedWaitMinutes = hospital.CurrentQueue?.EstimatedWaitMinutes ?? 0,
            AvailableBeds = hospital.GetAvailableBeds(bedClass),
            SpecialtyCode = specialtyCode ?? string.Empty,
            SpecialtyName = hospital.Specialties.FirstOrDefault(s => s.SpecialtyCode == specialtyCode)?.Name ?? string.Empty,
            HospitalType = hospital.Type,
            Address = hospital.Address,
            Phone = hospital.Phone,
            Latitude = hospital.Latitude,
            Longitude = hospital.Longitude
        }).ToList();

        return Results.Ok(results);
    })
    .WithName("GetNearbyHospitals")
    .WithOpenApi();

    app.MapGet("/api/hospitals/{id}", async (string id, IHospitalRepository repository) =>
    {
        var hospital = await repository.GetByIdAsync(id);
        if (hospital is null)
        {
            return Results.NotFound(new { error = "Hospital not found." });
        }

        var result = new HospitalDetailDto
        {
            Id = hospital.Id,
            Name = hospital.Name,
            Code = hospital.Code,
            Latitude = hospital.Latitude,
            Longitude = hospital.Longitude,
            Address = hospital.Address,
            Phone = hospital.Phone,
            Email = hospital.Email,
            Type = hospital.Type,
            Status = hospital.Status,
            Specialties = hospital.Specialties.Select(s => new SpecialtyDto
            {
                Code = s.SpecialtyCode,
                Name = s.Name,
                Category = s.Category
            }).ToList(),
            BedCapacities = hospital.BedCapacities.Select(b => new BedCapacityDto
            {
                Class = b.Class,
                Total = b.Total,
                Occupied = b.Occupied,
                Available = b.Available,
                LastUpdated = b.LastUpdated
            }).ToList(),
            CurrentQueue = hospital.CurrentQueue is null ? null : new QueueInfoDto
            {
                CurrentLength = hospital.CurrentQueue.CurrentLength,
                CurrentServingNumber = hospital.CurrentQueue.CurrentServingNumber,
                EstimatedWaitMinutes = hospital.CurrentQueue.EstimatedWaitMinutes,
                ServingVelocityPerHour = hospital.CurrentQueue.ServingVelocityPerHour,
                DoctorQuota = hospital.CurrentQueue.DoctorQuota,
                DoctorsOnDuty = hospital.CurrentQueue.DoctorsOnDuty,
                LastUpdated = hospital.CurrentQueue.LastUpdated,
                Status = hospital.CurrentQueue.Status
            },
            LastUpdated = hospital.LastUpdated
        };

        return Results.Ok(result);
    })
    .WithName("GetHospital")
    .WithOpenApi();
}

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

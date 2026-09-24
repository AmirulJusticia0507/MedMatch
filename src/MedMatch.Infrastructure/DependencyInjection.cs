using MedMatch.Core.Interfaces;
using MedMatch.Infrastructure.Data;
using MedMatch.Infrastructure.Repositories;
using MedMatch.Infrastructure.ExternalApis;
using MedMatch.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http;
using Polly;

namespace MedMatch.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string? connectionString = null)
    {
        services.AddDbContext<MedMatchDbContext>(options =>
            options.UseNpgsql(connectionString ?? configuration.GetConnectionString("NeonDbConnection"),
                o => o.UseNetTopologySuite()));

        services.AddScoped<IHospitalRepository, HospitalRepository>();
        services.AddScoped<ISpecialtyRepository, SpecialtyRepository>();
        services.AddScoped<IQueueRepository, QueueRepository>();
        services.AddScoped<IBedRepository, BedRepository>();
        services.AddScoped<ISyncService, SyncService>();

        services.AddHttpClient<IBpjsApiClient, BpjsApiClient>()
            .AddPolicyHandler(GetRetryPolicy());

        services.AddHttpClient<ISiranapApiClient, SiranapApiClient>()
            .AddPolicyHandler(GetRetryPolicy());

        services.AddHttpClient<ISpatialRoutingClient, OsrmRoutingClient>()
            .AddPolicyHandler(GetRetryPolicy());

        services.Configure<BpjsApiOptions>(configuration.GetSection("ExternalApis:Bpjs"));
        services.Configure<SiranapApiOptions>(configuration.GetSection("ExternalApis:Siranap"));
        services.Configure<OsrmOptions>(configuration.GetSection("ExternalApis:Osrm"));

        return services;
    }

    public static IServiceCollection AddChatAi(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BazaarLinkOptions>(configuration.GetSection("ExternalApis:BazaarLink"));

        services.AddHttpClient<IChatAiClient, BazaarLinkChatClient>()
            .AddPolicyHandler(Polly.Policy<HttpResponseMessage>
                .Handle<HttpRequestException>()
                .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt))));

        return services;
    }

    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return Polly.Policy<HttpResponseMessage>
            .Handle<HttpRequestException>()
            .OrResult(r => !r.IsSuccessStatusCode)
            .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    // Log retry if needed
                });
    }
}

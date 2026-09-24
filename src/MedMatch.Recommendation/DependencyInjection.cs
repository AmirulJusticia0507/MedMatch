using MedMatch.Core.Interfaces;
using MedMatch.Recommendation;
using Microsoft.Extensions.DependencyInjection;

namespace MedMatch.Recommendation;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRecommendation(this IServiceCollection services)
    {
        services.AddScoped<IRecommendationEngine, RecommendationEngine>();
        return services;
    }
}
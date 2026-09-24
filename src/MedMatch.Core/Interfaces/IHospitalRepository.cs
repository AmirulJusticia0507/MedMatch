using MedMatch.Core.Models;
using MedMatch.Core.DTOs;

namespace MedMatch.Core.Interfaces;

public interface IHospitalRepository
{
    Task<List<Hospital>> GetAllAsync();
    Task<Hospital?> GetByIdAsync(string id);
    Task<List<Hospital>> GetBySpecialtyAsync(string specialtyCode);
    Task<List<Hospital>> GetNearbyAsync(double lat, double lng, double radiusKm, string? specialtyCode = null, int maxResults = 20);
    Task<List<Hospital>> GetActiveAsync();
    Task<Hospital> AddAsync(Hospital hospital);
    Task<Hospital> UpdateAsync(Hospital hospital);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
    Task<int> CountAsync();
}

public interface ISpecialtyRepository
{
    Task<List<Specialty>> GetAllAsync();
    Task<Specialty?> GetByCodeAsync(string code);
    Task<Specialty> AddAsync(Specialty specialty);
    Task<Specialty> UpdateAsync(Specialty specialty);
}

public interface IQueueRepository
{
    Task<QueueInfo?> GetLatestAsync(string hospitalId, string specialtyCode);
    Task<List<QueueInfo>> GetByHospitalAsync(string hospitalId);
    Task<QueueInfo> AddAsync(QueueInfo queueInfo);
    Task<List<QueueInfo>> AddRangeAsync(List<QueueInfo> queueInfos);
}

public interface IBedRepository
{
    Task<List<BedCapacity>> GetByHospitalAsync(string hospitalId);
    Task<BedCapacity?> GetByHospitalAndClassAsync(string hospitalId, string bedClass);
    Task<BedCapacity> AddAsync(BedCapacity bed);
    Task<BedCapacity> UpdateAsync(BedCapacity bed);
    Task<List<BedCapacity>> AddRangeAsync(List<BedCapacity> beds);
}
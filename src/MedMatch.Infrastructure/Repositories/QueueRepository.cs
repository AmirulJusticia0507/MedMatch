using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace MedMatch.Infrastructure.Repositories;

public class QueueRepository : IQueueRepository
{
    private readonly MedMatchDbContext _context;

    public QueueRepository(MedMatchDbContext context)
    {
        _context = context;
    }

    public async Task<QueueInfo?> GetLatestAsync(string hospitalId, string specialtyCode)
        => await _context.Queues
            .FirstOrDefaultAsync(q => q.HospitalId == hospitalId && q.SpecialtyCode == specialtyCode);

    public async Task<List<QueueInfo>> GetByHospitalAsync(string hospitalId)
        => await _context.Queues
            .Where(q => q.HospitalId == hospitalId)
            .OrderByDescending(q => q.LastUpdated)
            .ToListAsync();

    public async Task<QueueInfo> AddAsync(QueueInfo queueInfo)
    {
        queueInfo.LastUpdated = DateTime.UtcNow;
        _context.Queues.Add(queueInfo);
        await _context.SaveChangesAsync();
        return queueInfo;
    }

    public async Task<List<QueueInfo>> AddRangeAsync(List<QueueInfo> queueInfos)
    {
        foreach (var q in queueInfos)
        {
            q.LastUpdated = DateTime.UtcNow;
        }
        _context.Queues.AddRange(queueInfos);
        await _context.SaveChangesAsync();
        return queueInfos;
    }
}
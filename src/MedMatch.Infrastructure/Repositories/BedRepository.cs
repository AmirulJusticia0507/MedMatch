using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace MedMatch.Infrastructure.Repositories;

public class BedRepository : IBedRepository
{
    private readonly MedMatchDbContext _context;

    public BedRepository(MedMatchDbContext context)
    {
        _context = context;
    }

    public async Task<List<BedCapacity>> GetByHospitalAsync(string hospitalId)
        => await _context.BedCapacities
            .Where(b => b.HospitalId == hospitalId)
            .OrderBy(b => b.Class)
            .ToListAsync();

    public async Task<BedCapacity?> GetByHospitalAndClassAsync(string hospitalId, string bedClass)
        => await _context.BedCapacities
            .FirstOrDefaultAsync(b => b.HospitalId == hospitalId && b.Class == bedClass);

    public async Task<BedCapacity> AddAsync(BedCapacity bed)
    {
        bed.LastUpdated = DateTime.UtcNow;
        _context.BedCapacities.Add(bed);
        await _context.SaveChangesAsync();
        return bed;
    }

    public async Task<BedCapacity> UpdateAsync(BedCapacity bed)
    {
        bed.LastUpdated = DateTime.UtcNow;
        _context.BedCapacities.Update(bed);
        await _context.SaveChangesAsync();
        return bed;
    }

    public async Task<List<BedCapacity>> AddRangeAsync(List<BedCapacity> beds)
    {
        foreach (var b in beds)
        {
            b.LastUpdated = DateTime.UtcNow;
        }
        _context.BedCapacities.AddRange(beds);
        await _context.SaveChangesAsync();
        return beds;
    }
}
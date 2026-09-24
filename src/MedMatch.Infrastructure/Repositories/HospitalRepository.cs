using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace MedMatch.Infrastructure.Repositories;

public class HospitalRepository : IHospitalRepository
{
    private readonly MedMatchDbContext _context;

    public HospitalRepository(MedMatchDbContext context)
    {
        _context = context;
    }

    public async Task<List<Hospital>> GetAllAsync()
        => await _context.Hospitals
            .Include(h => h.Specialties)
            .Include(h => h.BedCapacities)
            .Include(h => h.CurrentQueue)
            .Where(h => h.IsActive)
            .ToListAsync();

    public async Task<Hospital?> GetByIdAsync(string id)
        => await _context.Hospitals
            .Include(h => h.Specialties)
            .Include(h => h.BedCapacities)
            .Include(h => h.CurrentQueue)
            .FirstOrDefaultAsync(h => h.Id == id);

    public async Task<List<Hospital>> GetBySpecialtyAsync(string specialtyCode)
        => await _context.Hospitals
            .Include(h => h.Specialties)
            .Include(h => h.BedCapacities)
            .Include(h => h.CurrentQueue)
            .Where(h => h.IsActive && h.Specialties.Any(s => s.SpecialtyCode == specialtyCode))
            .ToListAsync();

    public async Task<List<Hospital>> GetNearbyAsync(double lat, double lng, double radiusKm, string? specialtyCode = null, int maxResults = 20)
    {
        var query = _context.Hospitals
            .Include(h => h.Specialties)
            .Include(h => h.BedCapacities)
            .Include(h => h.CurrentQueue)
            .Where(h => h.IsActive);

        if (!string.IsNullOrEmpty(specialtyCode))
        {
            query = query.Where(h => h.Specialties.Any(s => s.SpecialtyCode == specialtyCode));
        }

        var hospitals = await query.ToListAsync();

        return hospitals
            .Select(h => new { Hospital = h, Distance = CalculateDistance(lat, lng, h.Latitude, h.Longitude) })
            .Where(x => x.Distance <= radiusKm)
            .OrderBy(x => x.Distance)
            .Take(maxResults)
            .Select(x => x.Hospital)
            .ToList();
    }

    public async Task<List<Hospital>> GetActiveAsync()
        => await _context.Hospitals
            .Include(h => h.Specialties)
            .Include(h => h.BedCapacities)
            .Include(h => h.CurrentQueue)
            .Where(h => h.IsActive)
            .ToListAsync();

    public async Task<Hospital> AddAsync(Hospital hospital)
    {
        _context.Hospitals.Add(hospital);
        await _context.SaveChangesAsync();
        return hospital;
    }

    public async Task<Hospital> UpdateAsync(Hospital hospital)
    {
        hospital.LastUpdated = DateTime.UtcNow;
        _context.Hospitals.Update(hospital);
        await _context.SaveChangesAsync();
        return hospital;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var hospital = await _context.Hospitals.FindAsync(id);
        if (hospital == null) return false;
        
        hospital.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExistsAsync(string id)
        => await _context.Hospitals.AnyAsync(h => h.Id == id);

    public async Task<int> CountAsync()
        => await _context.Hospitals.CountAsync(h => h.IsActive);

    private static double CalculateDistance(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371; // Earth radius in km
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;
}
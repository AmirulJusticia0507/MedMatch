using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace MedMatch.Infrastructure.Repositories;

public class SpecialtyRepository : ISpecialtyRepository
{
    private readonly MedMatchDbContext _context;

    public SpecialtyRepository(MedMatchDbContext context)
    {
        _context = context;
    }

    public async Task<List<Specialty>> GetAllAsync()
        => await _context.Specialties.Where(s => s.IsActive).ToListAsync();

    public async Task<Specialty?> GetByCodeAsync(string code)
        => await _context.Specialties.FirstOrDefaultAsync(s => s.Code == code);

    public async Task<Specialty> AddAsync(Specialty specialty)
    {
        _context.Specialties.Add(specialty);
        await _context.SaveChangesAsync();
        return specialty;
    }

    public async Task<Specialty> UpdateAsync(Specialty specialty)
    {
        _context.Specialties.Update(specialty);
        await _context.SaveChangesAsync();
        return specialty;
    }
}
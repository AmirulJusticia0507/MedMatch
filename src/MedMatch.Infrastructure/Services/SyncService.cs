using MedMatch.Core.Interfaces;
using MedMatch.Core.Models;
using MedMatch.Infrastructure.Data;
using MedMatch.Infrastructure.ExternalApis;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MedMatch.Infrastructure.Services;

public class SyncService : ISyncService
{
    private readonly MedMatchDbContext _context;
    private readonly IBpjsApiClient _bpjsClient;
    private readonly ISiranapApiClient _siranapClient;
    private readonly ILogger<SyncService> _logger;

    public SyncService(
        MedMatchDbContext context,
        IBpjsApiClient bpjsClient,
        ISiranapApiClient siranapClient,
        ILogger<SyncService> logger)
    {
        _context = context;
        _bpjsClient = bpjsClient;
        _siranapClient = siranapClient;
        _logger = logger;
    }

    public async Task SyncHospitalsAsync()
    {
        _logger.LogInformation("Starting hospital sync from SIRANAP");
        
        try
        {
            var facilities = await _siranapClient.GetFacilitiesAsync();
            var specialties = await _siranapClient.GetSpecialtiesAsync();
            
            foreach (var facility in facilities)
            {
                var existing = await _context.Hospitals
                    .Include(h => h.Specialties)
                    .Include(h => h.BedCapacities)
                    .FirstOrDefaultAsync(h => h.Id == facility.Id);

                if (existing == null)
                {
                    _context.Hospitals.Add(facility);
                    _logger.LogDebug("Added new hospital: {HospitalName}", facility.Name);
                }
                else
                {
                    existing.Name = facility.Name;
                    existing.Code = facility.Code;
                    existing.Latitude = facility.Latitude;
                    existing.Longitude = facility.Longitude;
                    existing.Address = facility.Address;
                    existing.Phone = facility.Phone;
                    existing.Email = facility.Email;
                    existing.Type = facility.Type;
                    existing.Status = facility.Status;
                    existing.IsActive = facility.IsActive;
                    existing.LastUpdated = DateTime.UtcNow;

                    existing.Specialties.Clear();
                    existing.Specialties.AddRange(facility.Specialties);

                    existing.BedCapacities.Clear();
                    existing.BedCapacities.AddRange(facility.BedCapacities);
                    
                    _logger.LogDebug("Updated hospital: {HospitalName}", facility.Name);
                }
            }

            await _context.SaveChangesAsync();
            
            foreach (var specialty in specialties)
            {
                var existing = await _context.Specialties.FindAsync(specialty.Code);
                if (existing == null)
                {
                    _context.Specialties.Add(specialty);
                }
                else
                {
                    existing.Name = specialty.Name;
                    existing.Description = specialty.Description;
                    existing.Category = specialty.Category;
                    existing.IsActive = specialty.IsActive;
                }
            }
            await _context.SaveChangesAsync();

            _logger.LogInformation("Hospital sync completed. Synced {Count} hospitals and {SpecialtyCount} specialties", 
                facilities.Count, specialties.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Hospital sync failed");
            throw;
        }
    }

    public async Task SyncBedAvailabilityAsync()
    {
        _logger.LogInformation("Starting bed availability sync from BPJS");
        
        try
        {
            var hospitals = await _context.Hospitals
                .Where(h => h.IsActive)
                .ToListAsync();

            var allBeds = new List<BedCapacity>();
            int successCount = 0;

            foreach (var hospital in hospitals)
            {
                try
                {
                    var beds = await _bpjsClient.GetBedAvailabilityAsync(hospital.Code);
                    foreach (var bed in beds)
                    {
                        bed.HospitalId = hospital.Id;
                        allBeds.Add(bed);
                    }
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get beds for hospital {HospitalCode}", hospital.Code);
                }
            }

            foreach (var bed in allBeds)
            {
                var existing = await _context.BedCapacities
                    .FirstOrDefaultAsync(b => b.HospitalId == bed.HospitalId && b.Class == bed.Class);

                if (existing == null)
                {
                    _context.BedCapacities.Add(bed);
                }
                else
                {
                    existing.Total = bed.Total;
                    existing.Occupied = bed.Occupied;
                    existing.LastUpdated = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Bed availability sync completed. Updated {Count} hospitals, {BedCount} bed records", 
                successCount, allBeds.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bed availability sync failed");
            throw;
        }
    }

    public async Task SyncQueueInfoAsync()
    {
        _logger.LogInformation("Starting queue info sync from BPJS");
        
        try
        {
            var hospitals = await _context.Hospitals
                .Where(h => h.IsActive)
                .ToListAsync();

            var allQueues = new List<QueueInfo>();
            int successCount = 0;

            foreach (var hospital in hospitals)
            {
                try
                {
                    var queues = await _bpjsClient.GetQueueInfoAsync(hospital.Code);
                    foreach (var queue in queues)
                    {
                        queue.HospitalId = hospital.Id;
                        allQueues.Add(queue);
                    }
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get queues for hospital {HospitalCode}", hospital.Code);
                }
            }

            foreach (var queue in allQueues)
            {
                var existing = await _context.Queues
                    .FirstOrDefaultAsync(q => q.HospitalId == queue.HospitalId && q.SpecialtyCode == queue.SpecialtyCode);

                if (existing == null)
                {
                    _context.Queues.Add(queue);
                }
                else
                {
                    existing.CurrentLength = queue.CurrentLength;
                    existing.CurrentServingNumber = queue.CurrentServingNumber;
                    existing.EstimatedWaitMinutes = queue.EstimatedWaitMinutes;
                    existing.ServingVelocityPerHour = queue.ServingVelocityPerHour;
                    existing.DoctorQuota = queue.DoctorQuota;
                    existing.DoctorsOnDuty = queue.DoctorsOnDuty;
                    existing.LastUpdated = DateTime.UtcNow;
                    existing.Status = queue.Status;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Queue info sync completed. Updated {Count} hospitals, {QueueCount} queue records", 
                successCount, allQueues.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Queue info sync failed");
            throw;
        }
    }

    public async Task SyncSpecialtiesAsync()
    {
        _logger.LogInformation("Starting specialty sync from SIRANAP");
        
        try
        {
            var specialties = await _siranapClient.GetSpecialtiesAsync();
            
            foreach (var specialty in specialties)
            {
                var existing = await _context.Specialties.FindAsync(specialty.Code);
                if (existing == null)
                {
                    _context.Specialties.Add(specialty);
                }
                else
                {
                    existing.Name = specialty.Name;
                    existing.Description = specialty.Description;
                    existing.Category = specialty.Category;
                    existing.IsActive = specialty.IsActive;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Specialty sync completed. Synced {Count} specialties", specialties.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Specialty sync failed");
            throw;
        }
    }

    public async Task FullSyncAsync()
    {
        _logger.LogInformation("Starting full sync");
        
        await SyncHospitalsAsync();
        await SyncSpecialtiesAsync();
        await SyncBedAvailabilityAsync();
        await SyncQueueInfoAsync();
        
        _logger.LogInformation("Full sync completed");
    }
}
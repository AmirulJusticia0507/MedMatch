using MedMatch.Core.Models;

namespace MedMatch.Core.Interfaces;

public interface ISyncService
{
    Task SyncHospitalsAsync();
    Task SyncBedAvailabilityAsync();
    Task SyncQueueInfoAsync();
    Task SyncSpecialtiesAsync();
    Task FullSyncAsync();
}

public interface IBackgroundJobService
{
    void ScheduleSyncJobs();
    void TriggerImmediateSync(string jobType);
    Task<JobStatus> GetJobStatusAsync(string jobId);
}

public record JobStatus(string JobId, string JobType, JobState State, DateTime CreatedAt, DateTime? StartedAt, DateTime? CompletedAt, string? ErrorMessage);

public enum JobState
{
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled
}
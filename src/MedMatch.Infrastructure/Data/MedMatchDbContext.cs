using Microsoft.EntityFrameworkCore;
using MedMatch.Core.Models;
using NetTopologySuite.Geometries;

namespace MedMatch.Infrastructure.Data;

public class MedMatchDbContext : DbContext
{
    public MedMatchDbContext(DbContextOptions<MedMatchDbContext> options) : base(options) { }

    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<Specialty> Specialties => Set<Specialty>();
    public DbSet<BedCapacity> BedCapacities => Set<BedCapacity>();
    public DbSet<QueueInfo> Queues => Set<QueueInfo>();
    public DbSet<UserAccount> Users => Set<UserAccount>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Hospital>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Code).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.Email).HasMaxLength(200);
            
            entity.Property(e => e.Latitude).HasColumnType("double precision");
            entity.Property(e => e.Longitude).HasColumnType("double precision");
            
            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => new { e.Latitude, e.Longitude });
            
            entity.OwnsMany(e => e.Specialties, s =>
            {
                s.WithOwner().HasForeignKey("HospitalId");
                s.Property(p => p.SpecialtyCode).HasMaxLength(50);
                s.Property(p => p.Name).HasMaxLength(100);
                s.Property(p => p.Category).HasConversion<int>();
            });
            
            entity.OwnsMany(e => e.BedCapacities, b =>
            {
                b.WithOwner().HasForeignKey("HospitalId");
                b.Property(p => p.Class).HasMaxLength(20);
                b.Property(p => p.Total).IsRequired();
                b.Property(p => p.Occupied).IsRequired();
                b.Property(p => p.LastUpdated).HasColumnType("timestamp with time zone");
            });
            
            entity.OwnsOne(e => e.CurrentQueue, q =>
            {
                q.Property(p => p.SpecialtyCode).HasMaxLength(50);
                q.Property(p => p.CurrentLength).IsRequired();
                q.Property(p => p.CurrentServingNumber).IsRequired();
                q.Property(p => p.EstimatedWaitMinutes).IsRequired();
                q.Property(p => p.ServingVelocityPerHour).HasColumnType("double precision");
                q.Property(p => p.DoctorQuota).IsRequired();
                q.Property(p => p.DoctorsOnDuty).IsRequired();
                q.Property(p => p.LastUpdated).HasColumnType("timestamp with time zone");
                q.Property(p => p.Status).HasConversion<int>();
            });
        });

        modelBuilder.Entity<Specialty>(entity =>
        {
            entity.HasKey(e => e.Code);
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Category).HasConversion<int>();
        });

        modelBuilder.Entity<BedCapacity>(entity =>
        {
            entity.HasKey(e => new { e.HospitalId, e.Class });
            entity.Property(e => e.HospitalId).HasMaxLength(50);
            entity.Property(e => e.Class).HasMaxLength(20);
            entity.Property(e => e.Total).IsRequired();
            entity.Property(e => e.Occupied).IsRequired();
            entity.Property(e => e.LastUpdated).HasColumnType("timestamp with time zone");
        });

        modelBuilder.Entity<QueueInfo>(entity =>
        {
            entity.HasKey(e => new { e.HospitalId, e.SpecialtyCode });
            entity.Property(e => e.HospitalId).HasMaxLength(50);
            entity.Property(e => e.SpecialtyCode).HasMaxLength(50);
            entity.Property(e => e.LastUpdated).HasColumnType("timestamp with time zone");
        });

        modelBuilder.Entity<UserAccount>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).HasMaxLength(320).IsRequired();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.FullName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Role).HasMaxLength(30).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("PasswordResetTokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => new { e.UserId, e.ExpiresAt });
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}

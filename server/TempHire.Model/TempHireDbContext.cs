using Microsoft.EntityFrameworkCore;

namespace TempHire.Model
{
    /// <summary>
    /// The business data store.  Replaces the DevForce <c>TempHireDbContext</c> / <c>TempHireEntities</c>
    /// pair: DevForce needed a DbContext for the schema *and* an <c>EntityManager</c> subclass to expose
    /// <c>EntityQuery&lt;T&gt;</c> properties.  With Breeze the EntityManager lives on the client, so only
    /// the DbContext remains here.
    /// <para>
    /// Breeze reads its metadata straight off this model (see
    /// <c>TempHirePersistenceManager.Metadata()</c>), which is why the fluent configuration below matters:
    /// whatever you declare here is what the Angular client will validate against.
    /// </para>
    /// </summary>
    public class TempHireDbContext : DbContext
    {
        public TempHireDbContext(DbContextOptions<TempHireDbContext> options) : base(options)
        {
        }

        public DbSet<StaffingResource> StaffingResources { get; set; }
        public DbSet<Address> Addresses { get; set; }
        public DbSet<AddressType> AddressTypes { get; set; }
        public DbSet<PhoneNumber> PhoneNumbers { get; set; }
        public DbSet<PhoneNumberType> PhoneNumberTypes { get; set; }
        public DbSet<Rate> Rates { get; set; }
        public DbSet<RateType> RateTypes { get; set; }
        public DbSet<Skill> Skills { get; set; }
        public DbSet<State> States { get; set; }
        public DbSet<WorkExperienceItem> WorkExperienceItems { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<StaffingResource>(b =>
            {
                b.ToTable("StaffingResources");
                b.HasMany(e => e.Addresses)
                    .WithOne(e => e.StaffingResource)
                    .HasForeignKey(e => e.StaffingResourceId)
                    .OnDelete(DeleteBehavior.Cascade);
                b.HasMany(e => e.PhoneNumbers)
                    .WithOne(e => e.StaffingResource)
                    .HasForeignKey(e => e.StaffingResourceId)
                    .OnDelete(DeleteBehavior.Cascade);
                b.HasMany(e => e.Rates)
                    .WithOne(e => e.StaffingResource)
                    .HasForeignKey(e => e.StaffingResourceId)
                    .OnDelete(DeleteBehavior.Cascade);
                b.HasMany(e => e.Skills)
                    .WithOne(e => e.StaffingResource)
                    .HasForeignKey(e => e.StaffingResourceId)
                    .OnDelete(DeleteBehavior.Cascade);
                b.HasMany(e => e.WorkExperience)
                    .WithOne(e => e.StaffingResource)
                    .HasForeignKey(e => e.StaffingResourceId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Address>(b =>
            {
                b.ToTable("Addresses");
                // Lookups are never deleted, so Restrict rather than Cascade.
                b.HasOne(e => e.AddressType)
                    .WithMany()
                    .HasForeignKey(e => e.AddressTypeId)
                    .OnDelete(DeleteBehavior.Restrict);
                b.HasOne(e => e.State)
                    .WithMany()
                    .HasForeignKey(e => e.StateId)
                    .OnDelete(DeleteBehavior.Restrict);
                b.HasIndex(e => e.StaffingResourceId);
            });

            modelBuilder.Entity<PhoneNumber>(b =>
            {
                b.ToTable("PhoneNumbers");
                b.HasOne(e => e.PhoneNumberType)
                    .WithMany()
                    .HasForeignKey(e => e.PhoneNumberTypeId)
                    .OnDelete(DeleteBehavior.Restrict);
                b.HasIndex(e => e.StaffingResourceId);
            });

            modelBuilder.Entity<Rate>(b =>
            {
                b.ToTable("Rates");
                b.HasOne(e => e.RateType)
                    .WithMany()
                    .HasForeignKey(e => e.RateTypeId)
                    .OnDelete(DeleteBehavior.Restrict);
                b.HasIndex(e => e.StaffingResourceId);
            });

            modelBuilder.Entity<Skill>(b =>
            {
                b.ToTable("Skills");
                b.HasIndex(e => e.StaffingResourceId);
            });

            modelBuilder.Entity<WorkExperienceItem>(b =>
            {
                b.ToTable("WorkExperienceItems");
                b.HasIndex(e => e.StaffingResourceId);
            });

            modelBuilder.Entity<AddressType>().ToTable("AddressTypes");
            modelBuilder.Entity<PhoneNumberType>().ToTable("PhoneNumberTypes");
            modelBuilder.Entity<RateType>().ToTable("RateTypes");
            modelBuilder.Entity<State>(b =>
            {
                b.ToTable("States");
                b.HasIndex(e => e.ShortName);
            });
        }
    }

    /// <summary>
    /// The security data store.  The original sample deliberately used a second physical database
    /// (<c>TempHire.Security.sdf</c>) to demonstrate multiple data stores; that separation is preserved
    /// here as a second DbContext with its own connection string.  It is never exposed through Breeze.
    /// </summary>
    public class SecurityDbContext : DbContext
    {
        public SecurityDbContext(DbContextOptions<SecurityDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(b =>
            {
                b.ToTable("Users");
                b.HasIndex(e => e.Username).IsUnique();
            });
        }
    }
}

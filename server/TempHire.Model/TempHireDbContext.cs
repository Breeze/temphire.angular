using System.Reflection;
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
        private readonly ICurrentTenant _currentTenant;
        private Guid? _tenantOverride;

        public TempHireDbContext(DbContextOptions<TempHireDbContext> options, ICurrentTenant currentTenant = null)
            : base(options)
        {
            _currentTenant = currentTenant;
        }

        /// <summary>
        /// The tenant whose rows this context sees and writes: the signed-in user's, from their access
        /// token, unless code that runs without a user (seeding, the metadata export) has chosen one
        /// with <see cref="UseTenant"/>.  Null means no tenant, and then every tenant-owned query is
        /// empty and every tenant-owned write is refused.
        /// </summary>
        public Guid? CurrentTenantId => _tenantOverride ?? _currentTenant?.TenantId;

        /// <summary>Makes this context work on behalf of <paramref name="tenantId"/>.  Not for request code.</summary>
        public void UseTenant(Guid? tenantId) => _tenantOverride = tenantId;

        public DbSet<Tenant> Tenants { get; set; }
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

            modelBuilder.Entity<Tenant>(b =>
            {
                b.ToTable("Tenants");
                b.HasIndex(e => e.EmailDomain).IsUnique();
            });

            // Multi-tenancy: every tenant-owned entity gets a foreign key to its tenant and a global
            // query filter on the current tenant.  Found by interface rather than listed, so a new
            // tenant-owned entity cannot be forgotten.
            foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                         .Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType))
                         .ToList())
            {
                ConfigureTenantOwnedMethod.MakeGenericMethod(entityType.ClrType).Invoke(this, [modelBuilder]);
            }
        }

        private static readonly MethodInfo ConfigureTenantOwnedMethod =
            typeof(TempHireDbContext).GetMethod(nameof(ConfigureTenantOwned), BindingFlags.NonPublic | BindingFlags.Instance);

        private void ConfigureTenantOwned<T>(ModelBuilder modelBuilder) where T : class, ITenantOwned
        {
            modelBuilder.Entity<T>(b =>
            {
                b.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).OnDelete(DeleteBehavior.Restrict);

                // EF Core evaluates CurrentTenantId per context instance, i.e. per request, so this one
                // filter limits every LINQ query against T - Breeze's, the search, the MCP tools - to
                // the caller's tenant.  Only IgnoreQueryFilters() gets past it, and only the seeding
                // and the ownership check below use that.
                b.HasQueryFilter(e => e.TenantId == CurrentTenantId);
            });
        }

        // ------------------------------------------------------------------------------------------
        // Writes
        // ------------------------------------------------------------------------------------------

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            EnforceTenant();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            EnforceTenant();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        /// <summary>
        /// The write side of multi-tenancy.  A query filter cannot stop a write: Breeze attaches the
        /// client's entities and saves them by key, so a client that knew another tenant's key could
        /// otherwise update or delete that tenant's row.  So for every tenant-owned entity being saved:
        /// <list type="bullet">
        ///   <item>an insert gets the current tenant;</item>
        ///   <item>an update or delete must target a row that the current tenant owns in the database,
        ///         and can never change the row's tenant.</item>
        /// </list>
        /// The client's copy carries no tenant at all (<c>TenantId</c> is never sent), so the
        /// database is the only thing consulted.
        /// </summary>
        private void EnforceTenant()
        {
            var pending = ChangeTracker.Entries<ITenantOwned>()
                .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                .ToList();
            if (pending.Count == 0)
            {
                return;
            }

            var tenantId = CurrentTenantId
                ?? throw new TenantAccessException("There is no tenant to save data for.");

            foreach (var entry in pending.Where(e => e.State == EntityState.Added))
            {
                entry.Entity.TenantId = tenantId;
            }

            foreach (var group in pending.Where(e => e.State != EntityState.Added).GroupBy(e => e.Metadata.ClrType))
            {
                var ids = group.Select(e => (Guid)e.Property("Id").CurrentValue).ToList();
                var owned = (HashSet<Guid>)OwnedIdsMethod.MakeGenericMethod(group.Key).Invoke(this, [ids, tenantId]);

                foreach (var entry in group)
                {
                    if (!owned.Contains((Guid)entry.Property("Id").CurrentValue))
                    {
                        // The same answer whether the row belongs to another tenant or does not exist.
                        throw new TenantAccessException($"The {group.Key.Name} being saved was not found.");
                    }

                    entry.Entity.TenantId = tenantId;
                    entry.Property(nameof(ITenantOwned.TenantId)).IsModified = false;
                }
            }
        }

        private static readonly MethodInfo OwnedIdsMethod =
            typeof(TempHireDbContext).GetMethod(nameof(OwnedIds), BindingFlags.NonPublic | BindingFlags.Instance);

        private HashSet<Guid> OwnedIds<T>(List<Guid> ids, Guid tenantId) where T : class, ITenantOwned
        {
            return Set<T>()
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(e => e.TenantId == tenantId && ids.Contains(EF.Property<Guid>(e, "Id")))
                .Select(e => EF.Property<Guid>(e, "Id"))
                .ToHashSet();
        }
    }

    /// <summary>The current user's tenant, from their access token.  Null when there is none.</summary>
    public interface ICurrentTenant
    {
        Guid? TenantId { get; }
    }

    /// <summary>Thrown for a write outside the current tenant.  The server answers it with 403.</summary>
    public class TenantAccessException : UnauthorizedAccessException
    {
        public TenantAccessException(string message) : base(message)
        {
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

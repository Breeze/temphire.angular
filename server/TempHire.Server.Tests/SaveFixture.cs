using System.Security.Claims;
using Breeze.Persistence;
using IdeaBlade.Validation;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;
using TempHire.Model;
using TempHire.Model.Identity;
using TempHire.Server.Persistence;
using TempHire.Server.Validation;

namespace TempHire.Server.Tests
{
    /// <summary>
    /// A TempHire database and the server's save pipeline, for tests that save the way the client
    /// does: a Breeze save bundle through <see cref="TempHirePersistenceManager.SaveChangesAsync"/>,
    /// with the validation rules the server loads at startup.
    ///
    /// <para>
    /// The database is in-memory SQLite, one per test, so each test starts empty.  It runs real SQL,
    /// so EF Core's concurrency check - an UPDATE or DELETE that matches no row - behaves as it does on
    /// SQL Server.
    /// </para>
    /// </summary>
    public sealed class SaveFixture : IDisposable
    {
        public static readonly Guid Tenant = Guid.NewGuid();
        public static readonly Guid AddressTypeId = Guid.NewGuid();
        public static readonly Guid PhoneNumberTypeId = Guid.NewGuid();
        public static readonly Guid StateId = Guid.NewGuid();

        private readonly SqliteConnection _connection = new("DataSource=:memory:");
        private readonly ServiceProvider _services;

        public SaveFixture()
        {
            _connection.Open();

            var metadata = new ValidationMetadataFile(Path.Combine(AppContext.BaseDirectory, "validation.metadata.json"));
            var services = new ServiceCollection();
            services.AddIdeaBladeValidation(v => v.AddMetadataJson(metadata.Json).AddDataAnnotations("breeze"));
            _services = services.BuildServiceProvider();

            using var db = NewContext();
            db.Database.EnsureCreated();
            db.Tenants.Add(new Tenant { Id = Tenant, Name = "Harbor Staffing", EmailDomain = "harbor.test" });
            db.AddressTypes.Add(new AddressType { Id = AddressTypeId, Name = "Home", DisplayName = "Home Address", Default = true });
            db.PhoneNumberTypes.Add(new PhoneNumberType { Id = PhoneNumberTypeId, Name = "Home", Default = true });
            db.States.Add(new State { Id = StateId, Name = "Washington", ShortName = "WA" });
            db.SaveChanges();
        }

        public void Dispose()
        {
            _services.Dispose();
            _connection.Dispose();
        }

        /// <summary>A context on the test tenant's behalf, as a signed-in user of it would have.</summary>
        public TempHireDbContext NewContext()
        {
            var db = new TempHireDbContext(new DbContextOptionsBuilder<TempHireDbContext>().UseSqlite(_connection).Options);
            db.UseTenant(Tenant);
            return db;
        }

        /// <summary>Saves a bundle as an editor would.</summary>
        public async Task<SaveResult> SaveAsync(JObject bundle)
        {
            using var db = NewContext();
            using var scope = _services.CreateScope();
            var editor = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, "anna@harbor.test"), new Claim(ClaimTypes.Role, TempHireRoles.Editor)], "test"));
            var manager = new TempHirePersistenceManager(db, editor, scope.ServiceProvider.GetRequiredService<ValidationService>());
            return await manager.SaveChangesAsync(bundle);
        }

        /// <summary>Stores entities directly, as data that is already in the database.</summary>
        public void Store(params object[] entities) => StoreFor(Tenant, entities);

        /// <summary>Stores entities that belong to the given tenant.</summary>
        public void StoreFor(Guid tenant, params object[] entities)
        {
            using var db = NewContext();
            db.UseTenant(tenant);
            db.AddRange(entities);
            foreach (var entity in entities.OfType<AuditEntityBase>())
            {
                entity.RowVersion = 1;
            }
            db.SaveChanges();
        }

        /// <summary>Reads an entity back from the database, untracked.</summary>
        public T Load<T>(Guid id) where T : class
        {
            using var db = NewContext();
            return db.Set<T>().AsNoTracking().SingleOrDefault(e => EF.Property<Guid>(e, "Id") == id);
        }

        public static StaffingResource Resource() =>
            new() { Id = Guid.NewGuid(), FirstName = "Ann", LastName = "Lee", Summary = "Data analyst", TenantId = Tenant };

        public static Address Address(Guid resourceId) =>
            new()
            {
                Id = Guid.NewGuid(), StaffingResourceId = resourceId, AddressTypeId = AddressTypeId, StateId = StateId,
                Address1 = "1 Main St", City = "Seattle", Zipcode = "98101", TenantId = Tenant,
            };

        public static PhoneNumber Phone(Guid resourceId) =>
            new()
            {
                Id = Guid.NewGuid(), StaffingResourceId = resourceId, PhoneNumberTypeId = PhoneNumberTypeId,
                AreaCode = "206", Number = "555-1234", TenantId = Tenant,
            };

        /// <summary>A resource with an address and a phone number, stored: one that passes every rule.</summary>
        public (StaffingResource Resource, Address Address, PhoneNumber Phone) StoreValidResource()
        {
            var resource = Resource();
            var address = Address(resource.Id);
            var phone = Phone(resource.Id);
            Store(resource, address, phone);
            return (resource, address, phone);
        }
    }

    /// <summary>
    /// Builds a save bundle the way the Breeze client does: each entity's data properties, and an
    /// <c>entityAspect</c> with its type, its state and, for a modified entity, the original values of
    /// the properties it changed.
    /// </summary>
    public sealed class SaveBundle
    {
        private readonly JArray _entities = [];

        public SaveBundle Add(object entity) => With(entity, "Added");

        public SaveBundle Delete(object entity) => With(entity, "Deleted");

        /// <summary>
        /// A modified entity.  <paramref name="originalValues"/> are the values the client loaded, of
        /// the properties it changed; <paramref name="entity"/> holds the new ones.
        /// </summary>
        public SaveBundle Modify(object entity, object originalValues) =>
            With(entity, "Modified", JObject.FromObject(originalValues));

        public JObject Build() => new() { ["entities"] = _entities, ["saveOptions"] = new JObject() };

        private SaveBundle With(object entity, string state, JObject originalValues = null)
        {
            // EF Core fixes up navigation properties between the entities it has seen, which point back
            // at each other; they are dropped below anyway.
            var json = JObject.FromObject(entity, Newtonsoft.Json.JsonSerializer.Create(
                new Newtonsoft.Json.JsonSerializerSettings { ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore }));

            // Data properties only: Breeze sends navigation properties' keys, not the related entities.
            foreach (var navigation in json.Properties().Where(p => p.Value.Type is JTokenType.Array or JTokenType.Object).ToList())
            {
                navigation.Remove();
            }

            var aspect = new JObject
            {
                ["entityTypeName"] = $"{entity.GetType().Name}:#{entity.GetType().Namespace}",
                ["entityState"] = state,
            };
            if (originalValues != null)
            {
                aspect["originalValuesMap"] = originalValues;
            }
            json["entityAspect"] = aspect;

            _entities.Add(json);
            return this;
        }
    }
}

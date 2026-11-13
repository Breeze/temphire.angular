using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Breeze.Persistence;
using Breeze.Persistence.EFCore;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using TempHire.Model;

// Both Breeze and EF Core define an `EntityState`, and they are not the same enum: this file works
// with Breeze's, which describes what the *client* sent in the save bundle.
using EntityState = Breeze.Persistence.EntityState;

namespace TempHire.Server.Persistence
{
    /// <summary>
    /// The Breeze equivalent of <c>DomainModel/SaveInterceptor.cs</c>
    /// (DevForce's <c>EntityServerSaveInterceptor</c>).
    ///
    /// <para>The original did three things on every save; all three are reproduced here:</para>
    /// <list type="number">
    ///   <item>
    ///     <b>Authorization.</b>  <c>DefaultAuthorization</c> was <c>false</c>, so nothing could be saved
    ///     unless its type carried <c>[ClientCanSave(true)]</c> - which only <c>AuditEntityBase</c> did.
    ///     Here <see cref="BeforeSaveEntity"/> enforces the same rule.
    ///   </item>
    ///   <item>
    ///     <b>Validation.</b>  <c>ValidateSave</c> spun up a sandbox EntityManager, restored the cache
    ///     state into it and called <c>Validate</c> on every entity so that cross-entity rules
    ///     ("a resource must have an address") could see the whole graph.  Breeze hands us the whole
    ///     change set at once in <see cref="BeforeSaveEntities"/>, so the sandbox is unnecessary: we
    ///     stitch the graph together from the save map and validate that.
    ///   </item>
    ///   <item>
    ///     <b>Audit columns.</b>  <c>ExecuteSave</c> stamped Created/Modified and the user name.
    ///     Same here, plus the RowVersion bump that DevForce's
    ///     <c>ConcurrencyStrategy.AutoIncrement</c> used to do for us.
    ///   </item>
    /// </list>
    /// </summary>
    public class TempHirePersistenceManager : EFPersistenceManager<TempHireDbContext>
    {
        private readonly ClaimsPrincipal _principal;

        public TempHirePersistenceManager(TempHireDbContext dbContext, ClaimsPrincipal principal = null)
            : base(dbContext)
        {
            _principal = principal;
        }

        private string CurrentUserName =>
            _principal?.Identity?.Name
            ?? _principal?.FindFirst(ClaimTypes.Name)?.Value
            ?? "Unknown";

        /// <summary>
        /// Breeze's metadata, without multi-tenancy.  The tenant is the server's business: the client
        /// never reads or writes a tenant id (it is also <c>[JsonIgnore]</c>), so the <c>TenantId</c>
        /// columns and the <c>Tenant</c> type are left out.  Left in, the client would generate them
        /// into its entity classes and require a value for every new entity.
        /// </summary>
        protected override string BuildJsonMetadata()
        {
            var metadata = JObject.Parse(base.BuildJsonMetadata());

            if (metadata["structuralTypes"] is JArray types)
            {
                foreach (var tenantType in types.Where(t => (string)t["shortName"] == nameof(Tenant)).ToList())
                {
                    tenantType.Remove();
                }

                foreach (var properties in types.Select(t => t["dataProperties"]).OfType<JArray>())
                {
                    foreach (var tenantId in properties
                                 .Where(p => (string)p["nameOnServer"] == nameof(ITenantOwned.TenantId))
                                 .ToList())
                    {
                        tenantId.Remove();
                    }
                }
            }

            if (metadata["resourceEntityTypeMap"] is JObject resources)
            {
                foreach (var tenants in resources.Properties()
                             .Where(p => ((string)p.Value)?.StartsWith(nameof(Tenant) + ":#") == true)
                             .ToList())
                {
                    tenants.Remove();
                }
            }

            return metadata.ToString(Newtonsoft.Json.Formatting.None);
        }

        /// <summary>
        /// Replaces <c>SaveInterceptor.DefaultAuthorization = false</c> plus <c>[ClientCanSave]</c>.
        /// Returning false tells Breeze to silently drop the entity from the save; throwing makes the
        /// rejection explicit, which is what the original did (it failed the whole save).
        /// </summary>
        protected override bool BeforeSaveEntity(EntityInfo entityInfo)
        {
            if (entityInfo.Entity is not AuditEntityBase)
            {
                throw new EntityErrorsException(
                    $"Entities of type '{entityInfo.Entity.GetType().Name}' may not be saved by the client.",
                    new[]
                    {
                        new EntityError
                        {
                            ErrorName = "NotAuthorized",
                            EntityTypeName = entityInfo.Entity.GetType().FullName,
                            KeyValues = KeyValuesOf(entityInfo.Entity),
                            ErrorMessage = "This entity type is read-only."
                        }
                    })
                {
                    StatusCode = System.Net.HttpStatusCode.Forbidden
                };
            }

            return true;
        }

        protected override Dictionary<Type, List<EntityInfo>> BeforeSaveEntities(
            Dictionary<Type, List<EntityInfo>> saveMap)
        {
            StampAuditColumns(saveMap);
            ValidateSave(saveMap);

            return base.BeforeSaveEntities(saveMap);
        }

        /// <summary>Port of <c>SaveInterceptor.ExecuteSave</c>.</summary>
        private void StampAuditColumns(Dictionary<Type, List<EntityInfo>> saveMap)
        {
            var now = DateTime.UtcNow;
            var user = CurrentUserName;

            foreach (var entityInfo in saveMap.SelectMany(kv => kv.Value))
            {
                if (entityInfo.Entity is not AuditEntityBase entity)
                {
                    continue;
                }

                switch (entityInfo.EntityState)
                {
                    case EntityState.Added:
                        entity.Created = now;
                        entity.CreatedUser = user;
                        entity.Modified = now;
                        entity.ModifyUser = user;
                        entity.RowVersion = 1;
                        break;

                    case EntityState.Modified:
                        entity.Modified = now;
                        entity.ModifyUser = user;
                        // DevForce did this via ConcurrencyStrategy.AutoIncrement.  EF Core keeps the
                        // *original* value in the UPDATE ... WHERE clause because RowVersion is marked
                        // [ConcurrencyCheck], so bumping it here is safe and gives the same behaviour.
                        entity.RowVersion += 1;
                        break;
                }
            }
        }

        /// <summary>Port of <c>SaveInterceptor.ValidateSave</c>.</summary>
        private void ValidateSave(Dictionary<Type, List<EntityInfo>> saveMap)
        {
            var errors = new List<EntityError>();

            // The cross-entity rules on StaffingResource need to see the children that are being saved
            // alongside it.  Breeze sends parent and children in the same bundle but does not wire up the
            // navigation properties, so we do it here - this is the Breeze analogue of the original's
            // "sandbox" EntityManager.
            var resources = EntitiesOfType<StaffingResource>(saveMap);
            if (resources.Count > 0)
            {
                var addresses = EntitiesOfType<Address>(saveMap);
                var phoneNumbers = EntitiesOfType<PhoneNumber>(saveMap);

                foreach (var (resource, info) in resources)
                {
                    if (info.EntityState == EntityState.Deleted)
                    {
                        continue;
                    }

                    // Start from what is already in the database, then apply the pending change set.
                    //
                    // AsNoTracking is essential here, not an optimisation.  This runs *before*
                    // Breeze attaches the client's entities to the DbContext, so a tracking query
                    // would put the database's copy of each Address/PhoneNumber into the change
                    // tracker; Breeze would then call Add on the client's instance with the same
                    // key and EF Core would throw "another instance with the key value ... is
                    // already being tracked".
                    resource.Addresses = MergeChildren(
                        Context.Addresses.AsNoTracking()
                            .Where(a => a.StaffingResourceId == resource.Id).ToList(),
                        addresses, a => a.StaffingResourceId == resource.Id, a => a.Id);

                    resource.PhoneNumbers = MergeChildren(
                        Context.PhoneNumbers.AsNoTracking()
                            .Where(p => p.StaffingResourceId == resource.Id).ToList(),
                        phoneNumbers, p => p.StaffingResourceId == resource.Id, p => p.Id);
                }
            }

            foreach (var (entity, info) in EntitiesOfType<EntityBase>(saveMap))
            {
                if (info.EntityState == EntityState.Deleted)
                {
                    continue;
                }

                var results = new List<ValidationResult>();

                // Data annotations first ([Required], [StringLength], ...) - the same annotations Breeze
                // publishes to the client as validators, re-checked on the server.
                Validator.TryValidateObject(entity, new ValidationContext(entity), results, validateAllProperties: true);

                // ...then the entity's own cross-property rules.
                entity.Validate(results);

                errors.AddRange(results.Select(r => new EntityError
                {
                    ErrorName = "ValidationError",
                    EntityTypeName = entity.GetType().FullName,
                    KeyValues = KeyValuesOf(entity),
                    PropertyName = r.MemberNames?.FirstOrDefault(),
                    ErrorMessage = r.ErrorMessage
                }));
            }

            if (errors.Count > 0)
            {
                throw new EntityErrorsException(
                    string.Join("\n", errors.Select(e => e.ErrorMessage).Distinct()), errors);
            }
        }

        /// <summary>
        /// The primary key values of an entity, for an <see cref="EntityError"/>.  Read from the EF
        /// model here rather than with Breeze's <c>GetKeyValues</c>, which threw a
        /// NullReferenceException for these entities.
        /// </summary>
        private object[] KeyValuesOf(object entity)
        {
            var entityType = Context.Model.FindEntityType(entity.GetType())
                ?? throw new InvalidOperationException($"{entity.GetType().Name} is not an entity type of the model.");
            return entityType.FindPrimaryKey()!.Properties
                .Select(p => p.PropertyInfo?.GetValue(entity))
                .ToArray();
        }

        private static List<(T Entity, EntityInfo Info)> EntitiesOfType<T>(
            Dictionary<Type, List<EntityInfo>> saveMap) where T : class
        {
            return saveMap
                .SelectMany(kv => kv.Value)
                .Where(info => info.Entity is T)
                .Select(info => ((T)info.Entity, info))
                .ToList();
        }

        /// <summary>
        /// Applies the pending adds/deletes from the save bundle on top of the rows already stored, so
        /// that a rule like "must have at least one address" sees the post-save state.
        /// </summary>
        private static ICollection<T> MergeChildren<T>(
            List<T> stored,
            List<(T Entity, EntityInfo Info)> pending,
            Func<T, bool> belongsToParent,
            Func<T, Guid> keySelector) where T : class
        {
            var result = stored.ToDictionary(keySelector);

            foreach (var (entity, info) in pending)
            {
                var key = keySelector(entity);

                if (info.EntityState == EntityState.Deleted)
                {
                    result.Remove(key);
                }
                else if (belongsToParent(entity))
                {
                    result[key] = entity;
                }
                else
                {
                    // Re-parented away from this resource.
                    result.Remove(key);
                }
            }

            return result.Values.ToList();
        }
    }
}

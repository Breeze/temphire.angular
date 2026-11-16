using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Breeze.Persistence;
using Breeze.Persistence.EFCore;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using TempHire.Model;
using TempHire.Model.Identity;

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
    ///     ("a resource must have an address") could see the whole graph.  Neither Breeze nor EF Core
    ///     validates on save, so <see cref="ValidateSave"/> does it here: each entity's data annotations
    ///     and own rules, and the cross-entity rule by counting what the database will hold after the
    ///     save, without rebuilding the graph.
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
        /// Only an editor may save.  Enforced here, in the save interceptor, rather than only on the
        /// controller action, so every save that goes through Breeze is checked, whatever calls it.
        /// Readers can still query; the client hides its editing commands from them, so this is the
        /// guard against a hand-made request.  Answers 403 (see the exception filter in Program.cs).
        /// </summary>
        private void EnsureMaySave()
        {
            if (_principal?.IsInRole(TempHireRoles.Editor) != true)
            {
                throw new UnauthorizedAccessException("Only editors can save changes. You have read-only access.");
            }
        }

        /// <summary>
        /// Replaces <c>SaveInterceptor.DefaultAuthorization = false</c> plus <c>[ClientCanSave]</c>.
        /// Returning false tells Breeze to silently drop the entity from the save; throwing makes the
        /// rejection explicit, which is what the original did (it failed the whole save).
        /// </summary>
        protected override bool BeforeSaveEntity(EntityInfo entityInfo)
        {
            // Breeze calls this for each entity before BeforeSaveEntities, so the role is checked here
            // first: a reader's save is refused before anything else looks at it.
            EnsureMaySave();

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
            EnsureMaySave();
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

        /// <summary>
        /// Port of <c>SaveInterceptor.ValidateSave</c>.  Neither Breeze nor EF Core validates on save,
        /// so this is the server's check behind the client's own validation.
        /// </summary>
        private void ValidateSave(Dictionary<Type, List<EntityInfo>> saveMap)
        {
            var errors = new List<EntityError>();

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

            // The original's cross-entity rule: every staffing resource keeps at least one address and
            // one phone number.
            CheckEveryResourceKeeps<Address>(saveMap, errors, nameof(StaffingResource.Addresses),
                "StaffingResource must have at least one address",
                ids => Context.Addresses.Where(a => ids.Contains(a.StaffingResourceId))
                    .Select(a => new Child(a.Id, a.StaffingResourceId)).ToList(),
                a => new Child(a.Id, a.StaffingResourceId));

            CheckEveryResourceKeeps<PhoneNumber>(saveMap, errors, nameof(StaffingResource.PhoneNumbers),
                "StaffingResource must have at least one phone number",
                ids => Context.PhoneNumbers.Where(p => ids.Contains(p.StaffingResourceId))
                    .Select(p => new Child(p.Id, p.StaffingResourceId)).ToList(),
                p => new Child(p.Id, p.StaffingResourceId));

            if (errors.Count > 0)
            {
                throw new EntityErrorsException(
                    string.Join("\n", errors.Select(e => e.ErrorMessage).Distinct()), errors);
            }
        }

        /// <summary>A child row (an address, a phone number) and the staffing resource it belongs to.</summary>
        private sealed record Child(Guid Id, Guid ResourceId);

        /// <summary>
        /// Checks that every staffing resource this save touches - itself, or through one of its
        /// <typeparamref name="TChild"/> rows - still has at least one such row afterwards.
        ///
        /// <para>
        /// It works on ids only: the rows stored now (<paramref name="stored"/>, one query for all the
        /// resources concerned), minus the ones this save deletes or moves away, plus the ones it adds
        /// or moves in.  Nothing is attached to the entities.  (An earlier version hung the stored rows
        /// on the resource's navigation properties to call a rule on the entity; Breeze attaches a
        /// modified entity with <c>DbContext.Add</c>, which then took those rows for new ones.)
        /// </para>
        /// <para>
        /// Unlike that version, this also catches a save that deletes a resource's last address
        /// without the resource itself being in the save.
        /// </para>
        /// </summary>
        private void CheckEveryResourceKeeps<TChild>(
            Dictionary<Type, List<EntityInfo>> saveMap,
            List<EntityError> errors,
            string propertyName,
            string message,
            Func<List<Guid>, List<Child>> stored,
            Func<TChild, Child> asChild) where TChild : class
        {
            var resources = EntitiesOfType<StaffingResource>(saveMap);
            var deletedResources = resources
                .Where(r => r.Info.EntityState == EntityState.Deleted)
                .Select(r => r.Entity.Id)
                .ToHashSet();

            var pending = EntitiesOfType<TChild>(saveMap)
                .Select(c => (Child: asChild(c.Entity), c.Info))
                .ToList();

            // The resources concerned: those in the save, and those a pending child belongs to now or
            // belonged to before (a child moved to another resource leaves its old one).  A resource
            // being deleted takes its children with it, so the rule does not apply to it.
            var resourceIds = resources.Select(r => r.Entity.Id)
                .Concat(pending.Select(p => p.Child.ResourceId))
                .Concat(pending.Select(p => OriginalResourceId(p.Info)).OfType<Guid>())
                .Where(id => !deletedResources.Contains(id))
                .Distinct()
                .ToList();

            if (resourceIds.Count == 0)
            {
                return;
            }

            var storedChildren = stored(resourceIds);

            foreach (var resourceId in resourceIds)
            {
                var remaining = storedChildren
                    .Where(c => c.ResourceId == resourceId)
                    .Select(c => c.Id)
                    .ToHashSet();

                foreach (var (child, info) in pending)
                {
                    remaining.Remove(child.Id);
                    if (info.EntityState != EntityState.Deleted && child.ResourceId == resourceId)
                    {
                        remaining.Add(child.Id);
                    }
                }

                if (remaining.Count > 0)
                {
                    continue;
                }

                var resource = resources.FirstOrDefault(r => r.Entity.Id == resourceId).Entity;
                errors.Add(new EntityError
                {
                    ErrorName = "ValidationError",
                    EntityTypeName = typeof(StaffingResource).FullName,
                    KeyValues = resource != null ? KeyValuesOf(resource) : [resourceId],
                    PropertyName = propertyName,
                    ErrorMessage = message
                });
            }
        }

        /// <summary>The resource a modified child belonged to before this save, if it was moved.</summary>
        private static Guid? OriginalResourceId(EntityInfo info)
        {
            return info.OriginalValuesMap != null
                   && info.OriginalValuesMap.TryGetValue("StaffingResourceId", out var value)
                   && Guid.TryParse(value?.ToString(), out var id)
                ? id
                : null;
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
    }
}

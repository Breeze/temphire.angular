using System.Security.Claims;
using Breeze.Persistence;
using Breeze.Persistence.EFCore;
using ValidationService = IdeaBlade.Validation.ValidationService;
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
    ///     validates on save, so <see cref="ValidateSaveAsync"/> does it here: the validation metadata,
    ///     the entities' data annotations and cross-entity rules included, against what the database
    ///     will hold after the save.
    ///   </item>
    ///   <item>
    ///     <b>Audit columns.</b>  <c>ExecuteSave</c> stamped Created/Modified and the user name.
    ///     Same here, plus the RowVersion bump that DevForce's
    ///     <c>ConcurrencyStrategy.AutoIncrement</c> used to do for us.
    ///   </item>
    /// </list>
    /// <para>
    /// Saves are asynchronous (<see cref="SaveChangesAsync"/>): validation rules may be, and the rules
    /// read the database.  Breeze's asynchronous save calls the synchronous hooks as well as the
    /// asynchronous ones, so the per-entity checks stay in <see cref="BeforeSaveEntity"/>, and the rest is
    /// in <see cref="BeforeSaveEntitiesAsync"/>.  The synchronous <see cref="SaveChanges"/> would skip it,
    /// so it refuses to run.
    /// </para>
    /// </summary>
    public class TempHirePersistenceManager : EFPersistenceManager<TempHireDbContext>
    {
        private readonly ClaimsPrincipal _principal;
        private readonly ValidationService _validation;

        /// <param name="validation">
        /// Checks the validation metadata, data annotations included, on every save.
        /// </param>
        public TempHirePersistenceManager(
            TempHireDbContext dbContext, ClaimsPrincipal principal, ValidationService validation)
            : base(dbContext)
        {
            _principal = principal;
            _validation = validation ?? throw new ArgumentNullException(nameof(validation));
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
            // Breeze calls this for each entity before BeforeSaveEntitiesAsync, so the role is checked here
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

        /// <summary>Not supported: a save must be asynchronous, see <see cref="SaveChangesAsync"/>.</summary>
        public new SaveResult SaveChanges(JObject saveBundle, TransactionSettings transactionSettings = null) =>
            throw new NotSupportedException(
                "TempHire saves asynchronously, so that validation rules can be asynchronous: use SaveChangesAsync.");

        protected override async Task<Dictionary<Type, List<EntityInfo>>> BeforeSaveEntitiesAsync(
            Dictionary<Type, List<EntityInfo>> saveMap, CancellationToken cancellationToken)
        {
            EnsureMaySave();
            StampAuditColumns(saveMap);
            await ValidateSaveAsync(saveMap, cancellationToken);

            return await base.BeforeSaveEntitiesAsync(saveMap, cancellationToken);
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
                        IncrementRowVersion(entityInfo, entity);
                        break;
                }
            }
        }

        /// <summary>
        /// The new version of a modified row - what DevForce's <c>ConcurrencyStrategy.AutoIncrement</c>
        /// did.  EF Core compares the stored row with the <i>original</i> <c>RowVersion</c>, the
        /// version the client loaded, in the UPDATE's WHERE clause, and writes the current one.
        /// <para>
        /// The Breeze client increments it itself before it saves, and sends the version it loaded
        /// among the original values; then there is nothing to do.  Any other client may not: then
        /// the version it sent is the one it loaded, so it is recorded as the original value, which
        /// Breeze hands to EF Core, and incremented.
        /// </para>
        /// </summary>
        private static void IncrementRowVersion(EntityInfo entityInfo, AuditEntityBase entity)
        {
            entityInfo.OriginalValuesMap ??= new Dictionary<string, object>();
            if (entityInfo.OriginalValuesMap.TryAdd(nameof(AuditEntityBase.RowVersion), entity.RowVersion))
            {
                entity.RowVersion += 1;
            }
        }

        /// <summary>
        /// Port of <c>SaveInterceptor.ValidateSave</c>.  Neither Breeze nor EF Core validates on save,
        /// so this is the server's check behind the client's own validation, and it is the same check:
        /// the validation metadata (<c>Validation/validation.metadata.json</c>), which the client
        /// installs into Breeze.  Its global <c>breeze</c> validator is, on the server, the entities'
        /// data annotations ([Required], [StringLength], ... - registered in Program.cs), the same
        /// annotations Breeze publishes to the client as validators; the rest are the rules beyond
        /// them, cross-entity ones included.  All of it sees the database as it will be after the save
        /// (<see cref="SaveValidationStore"/>), so "a resource keeps an address" also catches a save
        /// that deletes a resource's last address on its own.  Asynchronous rules run too.
        /// </summary>
        private async Task ValidateSaveAsync(Dictionary<Type, List<EntityInfo>> saveMap, CancellationToken cancellationToken)
        {
            var store = await SaveValidationStore.CreateAsync(Context, saveMap, cancellationToken);
            var errors = (await _validation.ValidateEntitiesAsync(store, cancellationToken: cancellationToken))
                .SelectMany(ToEntityErrors)
                .ToList();

            if (errors.Count > 0)
            {
                throw new EntityErrorsException(
                    string.Join("\n", errors.Select(e => e.ErrorMessage).Distinct()), errors);
            }
        }

        /// <summary>
        /// A validation metadata error as Breeze <see cref="EntityError"/>s: one for each property the
        /// error is about (a rule comparing two dates is about both), or one for the entity as a whole.
        /// The metadata names properties as the client does (<c>stateId</c>); the validation service's
        /// naming convention (camelCase, the default) has the errors name them as the entities do
        /// (<c>StateId</c>), both in <c>PropertyNames</c>, which the Breeze client maps back to its own
        /// names, and in a property rule's message: <c>'StateId' is required</c>.
        /// </summary>
        private IEnumerable<EntityError> ToEntityErrors(IdeaBlade.Validation.ValidationError error)
        {
            var entity = error.Model!;
            var propertyNames = error.PropertyNames.Count > 0 ? error.PropertyNames : new string[] { null };

            return propertyNames.Select(propertyName => new EntityError
            {
                ErrorName = error.Id,
                EntityTypeName = entity.GetType().FullName,
                KeyValues = KeyValuesOf(entity),
                PropertyName = propertyName,
                ErrorMessage = error.ErrorMessage
            });
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

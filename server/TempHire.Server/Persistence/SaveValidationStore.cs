using System.Linq.Expressions;
using System.Reflection;
using Breeze.Persistence;
using IdeaBlade.Validation;
using Microsoft.EntityFrameworkCore;
using TempHire.Model;

using EntityState = Breeze.Persistence.EntityState;

namespace TempHire.Server.Persistence
{
    /// <summary>
    /// What the validation rules see during a save: the database as it will be once the save is done.
    ///
    /// <para>
    /// A Breeze save bundle holds only what the client changed.  A rule such as "a staffing resource has
    /// at least one address" (<c>store('Address').some(...)</c> in the validation metadata) needs the
    /// resource's other addresses too, the ones already stored.  So:
    /// </para>
    /// <list type="bullet">
    ///   <item>
    ///     <see cref="Entities"/>, the entities to validate, are those the save adds or modifies, plus
    ///     the stored staffing resources whose children it changes.  Deleting a resource's last address
    ///     breaks a rule of the resource, even when the resource itself is not in the save.
    ///   </item>
    ///   <item>
    ///     <see cref="GetEntities"/>, behind <c>store(type)</c>, returns the stored rows of a resource's
    ///     children for the resources concerned, with the save's deletions taken out and its additions
    ///     and changes put in.
    ///   </item>
    /// </list>
    /// <para>
    /// Rows are read with <c>AsNoTracking</c>: Breeze attaches the save's entities to the same
    /// <c>DbContext</c>, so nothing read here may be tracked.  Entities a resource is being deleted
    /// with are left out; a resource on its way out need not keep an address.
    /// </para>
    /// </summary>
    internal sealed class SaveValidationStore : IValidationEntityStore, IValidationEntityTypeLookup
    {
        private const string ResourceIdProperty = nameof(Address.StaffingResourceId);

        private static readonly MethodInfo StoredChildrenMethod =
            typeof(SaveValidationStore).GetMethod(nameof(StoredChildren), BindingFlags.NonPublic | BindingFlags.Instance)!;

        private readonly TempHireDbContext _context;
        private readonly List<EntityInfo> _pending;
        private readonly HashSet<object> _pendingKeys;
        private readonly List<Guid> _resourceIds;
        private readonly Dictionary<string, List<object>> _byType = new();

        public SaveValidationStore(TempHireDbContext context, Dictionary<Type, List<EntityInfo>> saveMap)
        {
            _context = context;
            _pending = saveMap.SelectMany(kv => kv.Value).ToList();
            _pendingKeys = _pending.Select(info => KeyOf(info.Entity)).ToHashSet();

            var deletedResources = _pending
                .Where(info => info.EntityState == EntityState.Deleted && info.Entity is StaffingResource)
                .Select(info => ((StaffingResource)info.Entity).Id)
                .ToHashSet();

            // The resources concerned: those in the save, and those a changed child belongs to now or
            // belonged to before (a child moved to another resource leaves its old one).
            _resourceIds = _pending
                .SelectMany(info => info.Entity switch
                {
                    StaffingResource resource => [resource.Id],
                    IHasRoot => new[] { ResourceIdOf(info.Entity), OriginalResourceId(info) }.OfType<Guid>(),
                    _ => [],
                })
                .Where(id => !deletedResources.Contains(id))
                .Distinct()
                .ToList();

            var live = _pending.Where(info => info.EntityState != EntityState.Deleted).Select(info => info.Entity).ToList();
            var savedResources = live.OfType<StaffingResource>().Select(r => r.Id).ToHashSet();
            var storedResources = _resourceIds.Where(id => !savedResources.Contains(id)).ToList();

            Entities = live
                .Concat(_context.StaffingResources.AsNoTracking().Where(r => storedResources.Contains(r.Id)))
                .ToList();
        }

        /// <summary>The entities to validate.</summary>
        public IReadOnlyList<object> Entities { get; }

        /// <summary>The entities of a type as they will be after the save, for <c>store(type)</c>.</summary>
        public IEnumerable<object> GetEntities(string entityType)
        {
            if (!_byType.TryGetValue(entityType, out var entities))
            {
                var clrType = _context.Model.GetEntityTypes().FirstOrDefault(t => t.ClrType.Name == entityType)?.ClrType;
                var stored = clrType != null && typeof(IHasRoot).IsAssignableFrom(clrType)
                    ? (IEnumerable<object>)StoredChildrenMethod.MakeGenericMethod(clrType).Invoke(this, null)!
                    : [];

                entities = stored
                    .Where(entity => !_pendingKeys.Contains(KeyOf(entity)))
                    .Concat(_pending
                        .Where(info => info.EntityState != EntityState.Deleted && info.Entity.GetType().Name == entityType)
                        .Select(info => info.Entity))
                    .Concat(clrType == typeof(StaffingResource) ? Entities.OfType<StaffingResource>() : [])
                    .Distinct()
                    .ToList();

                _byType[entityType] = entities;
            }

            return entities;
        }

        /// <summary>The stored rows of a resource's child type that belong to the resources concerned.</summary>
        private List<object> StoredChildren<T>() where T : class
        {
            var ids = _resourceIds;
            var row = Expression.Parameter(typeof(T), "row");
            var belongs = Expression.Lambda<Func<T, bool>>(
                Expression.Call(
                    typeof(Enumerable), nameof(Enumerable.Contains), [typeof(Guid)],
                    Expression.Constant(ids),
                    Expression.Call(typeof(EF), nameof(EF.Property), [typeof(Guid)], row, Expression.Constant(ResourceIdProperty))),
                row);

            return ids.Count == 0 ? [] : _context.Set<T>().AsNoTracking().Where(belongs).Cast<object>().ToList();
        }

        private object KeyOf(object entity)
        {
            var key = _context.Model.FindEntityType(entity.GetType())?.FindPrimaryKey()?.Properties.Single().PropertyInfo;
            return (entity.GetType(), key?.GetValue(entity));
        }

        private static Guid? ResourceIdOf(object entity) =>
            entity.GetType().GetProperty(ResourceIdProperty)?.GetValue(entity) as Guid?;

        /// <summary>The resource a modified child belonged to before this save, if it was moved.</summary>
        private static Guid? OriginalResourceId(EntityInfo info) =>
            info.OriginalValuesMap != null
            && info.OriginalValuesMap.TryGetValue(ResourceIdProperty, out var value)
            && Guid.TryParse(value?.ToString(), out var id)
                ? id
                : null;
    }
}

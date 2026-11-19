using System.ComponentModel.DataAnnotations;

namespace TempHire.Model
{
    /// <summary>
    /// Base for every entity the client is allowed to save.  In DevForce this was expressed with
    /// <c>[ClientCanSave(true)]</c> combined with <c>SaveInterceptor.DefaultAuthorization == false</c>;
    /// the Breeze equivalent lives in <c>TempHirePersistenceManager.BeforeSaveEntity</c>, which rejects
    /// any entity that is not an <see cref="AuditEntityBase"/>.  The lookup types (states, address,
    /// phone number and rate types) don't derive from it: they are read-only.
    /// <para>
    /// The WPF model had a common root, DevForce's <c>EntityBase</c>, for <c>[ProvideEntityAspect]</c>,
    /// <c>[DataContract]</c>, <c>[RequiresAuthentication]</c>, a virtual <c>Validate</c> and the
    /// concurrency column.  None of that needs a base class here: the entity aspect lives on the Breeze
    /// client, serialization is plain JSON.NET, <c>[RequiresAuthentication]</c> is <c>[Authorize]</c> on
    /// the Breeze controller, the rules beyond the data annotations are validation metadata
    /// (TempHire.Server/Validation/validation.metadata.json), and the concurrency column is here.
    /// </para>
    /// <para>
    /// This class is intentionally *not* an EF Core entity type (it has no key and no
    /// <see cref="Microsoft.EntityFrameworkCore.DbSet{TEntity}"/>).  EF Core therefore treats it as an
    /// unmapped base class and copies its properties down into every derived table, which is exactly
    /// the shape the original SQL Compact schema had.
    /// </para>
    /// </summary>
    public abstract class AuditEntityBase : ITenantOwned
    {
        /// <summary>
        /// Optimistic concurrency token.  DevForce did this with
        /// <c>[ConcurrencyStrategy(ConcurrencyStrategy.AutoIncrement)]</c>, on every entity; here it is
        /// on the entities the client can save, the only ones that can conflict.  The column is a
        /// plain int marked as an EF Core concurrency token: an UPDATE or DELETE only matches the row
        /// while it still has the version the client loaded, and the Breeze server reports a row it
        /// didn't match as a concurrency conflict (409).  The Breeze client increments it before a
        /// save, and <c>TempHirePersistenceManager</c> does too, for any other client.
        /// </summary>
        [ConcurrencyCheck]
        public int RowVersion { get; set; }

        /// <summary>
        /// The tenant (company) the row belongs to.  The client never sees or sends it: it is left
        /// out of the Breeze metadata and of every JSON payload (<c>[JsonIgnore]</c>).
        /// <c>TempHireDbContext</c> filters every query on it and sets it on every insert.
        /// </summary>
        [Newtonsoft.Json.JsonIgnore]
        public Guid TenantId { get; set; }

        public DateTime Created { get; set; }

        [MaxLength(100)]
        public string CreatedUser { get; set; }

        public DateTime Modified { get; set; }

        [MaxLength(100)]
        public string ModifyUser { get; set; }
    }

    /// <summary>
    /// An entity whose rows belong to one tenant.  Every audited entity is one; the lookup types
    /// (states, address/phone/rate types) are shared reference data and are not.
    /// </summary>
    public interface ITenantOwned
    {
        Guid TenantId { get; set; }
    }

    /// <summary>
    /// Marks a child entity that belongs to an aggregate root.  Used by the client to decide which
    /// unit of work an entity belongs to.  Ported verbatim from the WPF model.
    /// </summary>
    public interface IHasRoot
    {
        object Root { get; }
    }
}

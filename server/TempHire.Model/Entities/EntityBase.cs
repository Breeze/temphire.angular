using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>
    /// Root of the domain model.  Replaces the DevForce <c>EntityBase</c>, which carried
    /// <c>[ProvideEntityAspect]</c>, <c>[DataContract]</c> and <c>[RequiresAuthentication]</c>.
    /// <para>
    /// None of those attributes have a Breeze equivalent on the entity itself:
    /// </para>
    /// <list type="bullet">
    ///   <item>the entity aspect lives on the Breeze client, not on the server POCO;</item>
    ///   <item>serialization is plain JSON.NET;</item>
    ///   <item><c>[RequiresAuthentication]</c> becomes <c>[Authorize]</c> on the Breeze controller.</item>
    /// </list>
    /// <para>
    /// This class is intentionally *not* an EF Core entity type (it has no key and no
    /// <see cref="Microsoft.EntityFrameworkCore.DbSet{TEntity}"/>).  EF Core therefore treats it as an
    /// unmapped base class and copies its properties down into every derived table, which is exactly
    /// the shape the original SQL Compact schema had.
    /// </para>
    /// </summary>
    public abstract class EntityBase
    {
        /// <summary>
        /// Optimistic concurrency token.  DevForce did this with
        /// <c>[ConcurrencyStrategy(ConcurrencyStrategy.AutoIncrement)]</c>; here the column is a plain
        /// int marked as an EF Core concurrency token and incremented by
        /// <c>TempHirePersistenceManager.BeforeSaveEntities</c>.
        /// </summary>
        [ConcurrencyCheck]
        public int RowVersion { get; set; }

        /// <summary>
        /// Custom, cross-property validation.  The DevForce version received a
        /// <c>VerifierResultCollection</c>; the Breeze equivalent is a list of
        /// <see cref="ValidationResult"/> which the persistence manager turns into
        /// Breeze <c>EntityError</c>s and returns to the client with a 403.
        /// </summary>
        public virtual void Validate(ICollection<ValidationResult> validationErrors)
        {
        }
    }

    /// <summary>
    /// Base for every entity the client is allowed to save.  In DevForce this was expressed with
    /// <c>[ClientCanSave(true)]</c> combined with <c>SaveInterceptor.DefaultAuthorization == false</c>;
    /// the Breeze equivalent lives in <c>TempHirePersistenceManager.BeforeSaveEntity</c>, which rejects
    /// any entity that is not an <see cref="AuditEntityBase"/>.
    /// </summary>
    public abstract class AuditEntityBase : EntityBase
    {
        public DateTime Created { get; set; }

        [MaxLength(100)]
        public string CreatedUser { get; set; }

        public DateTime Modified { get; set; }

        [MaxLength(100)]
        public string ModifyUser { get; set; }
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

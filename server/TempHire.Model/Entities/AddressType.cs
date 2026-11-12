using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>
    /// Lookup type.  Derives from <see cref="EntityBase"/> rather than <see cref="AuditEntityBase"/>,
    /// which is what makes it read-only to the client - see the authorization check in
    /// <c>TempHirePersistenceManager.BeforeSaveEntity</c>.
    /// </summary>
    public class AddressType : EntityBase
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; }

        [Required]
        [MaxLength(50)]
        public string DisplayName { get; set; }

        public bool Default { get; set; }
    }
}

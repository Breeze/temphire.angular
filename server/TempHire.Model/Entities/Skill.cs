using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>Ported from <c>DomainModel/Skill.cs</c>.</summary>
    public class Skill : AuditEntityBase, IHasRoot
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Description { get; set; }

        public Guid StaffingResourceId { get; set; }

        public StaffingResource StaffingResource { get; set; }

        [NotMapped]
        public object Root => StaffingResource;
    }
}

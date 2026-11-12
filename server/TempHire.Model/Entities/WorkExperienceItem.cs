using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>Ported from <c>DomainModel/WorkExperienceItem.cs</c>.</summary>
    public class WorkExperienceItem : AuditEntityBase, IHasRoot
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        public DateTime From { get; set; }

        public DateTime To { get; set; }

        [Required]
        [MaxLength(200)]
        public string PositionTitle { get; set; }

        [Required]
        [MaxLength(200)]
        public string Company { get; set; }

        [Required]
        [MaxLength(200)]
        public string Location { get; set; }

        [Required]
        public string Description { get; set; }

        public Guid StaffingResourceId { get; set; }

        public StaffingResource StaffingResource { get; set; }

        [NotMapped]
        public object Root => StaffingResource;
    }
}

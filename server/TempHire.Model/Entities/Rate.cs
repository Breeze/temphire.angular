using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>Ported from <c>DomainModel/Rate.cs</c>.</summary>
    public class Rate : AuditEntityBase, IHasRoot
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public Guid RateTypeId { get; set; }

        public Guid StaffingResourceId { get; set; }

        public RateType RateType { get; set; }

        public StaffingResource StaffingResource { get; set; }

        [NotMapped]
        public object Root => StaffingResource;
    }
}

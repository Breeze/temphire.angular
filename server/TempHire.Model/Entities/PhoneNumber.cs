using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>Ported from <c>DomainModel/PhoneNumber.cs</c>.</summary>
    public class PhoneNumber : AuditEntityBase, IHasRoot
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [StringLength(3, MinimumLength = 3)]
        public string AreaCode { get; set; }

        [Required]
        [StringLength(8, MinimumLength = 7)]
        public string Number { get; set; }

        public Guid PhoneNumberTypeId { get; set; }

        public Guid StaffingResourceId { get; set; }

        public bool Primary { get; set; }

        public StaffingResource StaffingResource { get; set; }

        public PhoneNumberType PhoneNumberType { get; set; }

        [NotMapped]
        public object Root => StaffingResource;
    }
}

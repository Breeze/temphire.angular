using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>Ported from <c>DomainModel/Address.cs</c>.</summary>
    public class Address : AuditEntityBase, IHasRoot
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Address1 { get; set; }

        [MaxLength(200)]
        public string Address2 { get; set; }

        [Required]
        [MaxLength(100)]
        public string City { get; set; }

        public Guid StaffingResourceId { get; set; }

        public Guid AddressTypeId { get; set; }

        [Required]
        [StringLength(10, MinimumLength = 5)]
        public string Zipcode { get; set; }

        public bool Primary { get; set; }

        public Guid StateId { get; set; }

        public StaffingResource StaffingResource { get; set; }

        public AddressType AddressType { get; set; }

        public State State { get; set; }

        [NotMapped]
        public object Root => StaffingResource;

        /// <summary>
        /// The DevForce version checked <c>State.EntityFacts.EntityAspect.IsNullOrPendingEntity</c>.
        /// With Breeze the equivalent check is simply that a real StateId was chosen; the client-side
        /// entity adds the "please pick a state" message while editing.
        /// </summary>
        public override void Validate(ICollection<ValidationResult> validationErrors)
        {
            if (StateId == Guid.Empty)
            {
                validationErrors.Add(new ValidationResult(
                    "The State field is required", new[] { nameof(StateId) }));
            }
        }
    }
}

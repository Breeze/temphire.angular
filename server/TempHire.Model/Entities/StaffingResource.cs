using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>
    /// The aggregate root.  Compare with <c>DomainModel/StaffingResource.cs</c> in the WPF app.
    /// <para>
    /// The DevForce version exposed <c>RelatedEntityList&lt;T&gt;</c> collections and Add/Delete methods
    /// that manipulated the DevForce <c>EntityAspect</c>.  On the Breeze side those behaviours belong to
    /// the *client* entity (see <c>client/src/app/core/entities/staffing-resource.ts</c>); the server
    /// entity is a plain POCO holding the same data.
    /// </para>
    /// </summary>
    public class StaffingResource : AuditEntityBase
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FirstName { get; set; }

        [MaxLength(100)]
        public string MiddleName { get; set; }

        [Required]
        [MaxLength(100)]
        public string LastName { get; set; }

        [Required]
        public string Summary { get; set; }

        /// <summary>Optional.  The validation metadata checks that it is before <see cref="HireDate"/>.</summary>
        public DateTime? DateOfBirth { get; set; }

        /// <summary>Optional.  The validation metadata checks that it is after <see cref="DateOfBirth"/>.</summary>
        public DateTime? HireDate { get; set; }

        public ICollection<Address> Addresses { get; set; } = new List<Address>();

        public ICollection<PhoneNumber> PhoneNumbers { get; set; } = new List<PhoneNumber>();

        public ICollection<Rate> Rates { get; set; } = new List<Rate>();

        public ICollection<WorkExperienceItem> WorkExperience { get; set; } = new List<WorkExperienceItem>();

        public ICollection<Skill> Skills { get; set; } = new List<Skill>();

        [NotMapped]
        public string FullName =>
            !string.IsNullOrWhiteSpace(MiddleName)
                ? $"{FirstName?.Trim()} {MiddleName.Trim()} {LastName?.Trim()}"
                : $"{FirstName?.Trim()} {LastName?.Trim()}";

        // The original's rule that a resource always has at least one address and one phone number is
        // in the validation metadata (TempHire.Server/Validation/validation.metadata.json).  The client
        // checks it as the user edits; the server checks it on save, against what the database will
        // hold after the save (SaveValidationStore).
    }
}

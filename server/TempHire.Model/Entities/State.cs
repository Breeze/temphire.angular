using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>Lookup type - read-only to the client.</summary>
    public class State : EntityBase
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [StringLength(2)]
        public string ShortName { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }
    }
}

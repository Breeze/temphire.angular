//====================================================================================================================
// Copyright (c) 2014 IdeaBlade
//====================================================================================================================
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE 
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS 
// OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
//====================================================================================================================
// USE OF THIS SOFTWARE IS GOVERENED BY THE LICENSING TERMS WHICH CAN BE FOUND AT
// http://cocktail.ideablade.com/licensing
//====================================================================================================================

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;

namespace DomainModel
{
    public class StaffingResource : AuditEntityBase
    {
        public StaffingResource()
        {
        }

        [NotMapped]
        public string FullName
        {
            get
            {
                return !string.IsNullOrWhiteSpace(MiddleName)
                           ? string.Format("{0} {1} {2}", FirstName.Trim(), MiddleName.Trim(), LastName.Trim())
                           : string.Format("{0} {1}", FirstName.Trim(), LastName.Trim());
            }
        }

        /// <summary>Gets or sets the Id. </summary>
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        [Required]
        public Guid Id { get; set; }

        /// <summary>Gets or sets the FirstName. </summary>
        [Required]
        public string FirstName { get; set; }

        /// <summary>Gets or sets the MiddleName. </summary>
        public string MiddleName { get; set; }

        /// <summary>Gets or sets the LastName. </summary>
        [Required]
        public string LastName { get; set; }

        /// <summary>Gets or sets the Summary. </summary>
        [Required]
        public string Summary { get; set; }

        /// <summary>Gets the Addresses. </summary>
        public ICollection<Address> Addresses { get; set; }

        /// <summary>Gets the PhoneNumbers. </summary>
        public ICollection<PhoneNumber> PhoneNumbers { get; set; }

        /// <summary>Gets the Rates. </summary>
        public ICollection<Rate> Rates { get; set; }

        /// <summary>Gets the WorkExperience. </summary>
        public ICollection<WorkExperienceItem> WorkExperience { get; set; }

        /// <summary>Gets the Skills. </summary>
        public ICollection<Skill> Skills { get; set; }

        /// <summary>Gets or sets the PrimaryAddress. </summary>
        [NotMapped]
        public Address PrimaryAddress
        {
            get
            {
                if (Addresses == null) return null;

                return Addresses.FirstOrDefault(a => a.Primary);
            }
            set
            {
                if (value.StaffingResource != this)
                    throw new InvalidOperationException("Address is not associated with this StaffingResource.");

                Addresses.Where(a => a.Primary).ForEach(a => a.Primary = false);
                value.Primary = true;
            }
        }

        /// <summary>Gets or sets the PrimaryPhoneNumber. </summary>
        [NotMapped]
        public PhoneNumber PrimaryPhoneNumber
        {
            get
            {
                if (PhoneNumbers == null) return null;

                return PhoneNumbers.FirstOrDefault(a => a.Primary);
            }
            set
            {
                if (value.StaffingResource != this)
                    throw new InvalidOperationException("PhoneNumber is not associated with this StaffingResource.");

                PhoneNumbers.Where(p => p.Primary).ForEach(p => p.Primary = false);
                value.Primary = true;
            }
        }
    }
}
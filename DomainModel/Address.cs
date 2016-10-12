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
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DomainModel
{
    public class Address : AuditEntityBase, IHasRoot
    {
        public Address()
        {
        }

        /// <summary>Gets or sets the Id. </summary>
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        [Required]
        public Guid Id { get; set; }

        /// <summary>Gets or sets the Address1. </summary>
        [Required]
        public string Address1 { get; set; }

        /// <summary>Gets or sets the Address2. </summary>
        public string Address2 { get; set; }

        /// <summary>Gets or sets the City. </summary>
        [Required]
        public string City { get; set; }

        /// <summary>Gets or sets the StaffingResourceId. </summary>
        [Required]
        public Guid StaffingResourceId { get; set; }

        /// <summary>Gets or sets the AddressTypeId. </summary>
        [Required]
        public Guid AddressTypeId { get; set; }

        /// <summary>Gets or sets the Zipcode. </summary>
        [Required]
        [StringLength(10, MinimumLength = 5)]
        public string Zipcode { get; set; }

        /// <summary>Gets or sets the Primary. </summary>
        [Required]
        public bool Primary { get; set; }

        /// <summary>Gets or sets the StateId. </summary>
        [Required]
        public Guid StateId { get; set; }

        /// <summary>Gets or sets the StaffingResource. </summary>
        public StaffingResource StaffingResource { get; set; }

        /// <summary>Gets or sets the AddressType. </summary>
        public AddressType AddressType { get; set; }

        /// <summary>Gets or sets the State. </summary>
        [Required]
        public State State { get; set; }

        #region IHasRoot Members

        public object Root
        {
            get { return StaffingResource; }
        }

        #endregion
    }
}
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

namespace DomainModel.Projections
{
    public class StaffingResourceListItem
    {
        public Guid Id { get; set; }

        public string FirstName { get; set; }

        public string MiddleName { get; set; }

        public string LastName { get; set; }

        public string Address1 { get; set; }

        public string Address2 { get; set; }

        public string City { get; set; }

        public string State { get; set; }

        public string Zipcode { get; set; }

        public string AreaCode { get; set; }

        public string Number { get; set; }

        public string FullName
        {
            get
            {
                return !string.IsNullOrWhiteSpace(MiddleName)
                           ? string.Format("{0} {1} {2}", FirstName.Trim(), MiddleName.Trim(), LastName.Trim())
                           : string.Format("{0} {1}", FirstName.Trim(), LastName.Trim());
            }
        }

        public string PhoneNumber
        {
            get { return string.Format("({0}) {1}", AreaCode, Number); }
        }
    }
}
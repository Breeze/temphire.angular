namespace TempHire.Model.Projections
{
    /// <summary>
    /// Read-only projection backing the search grid.  Ported from
    /// <c>DomainModel/Projections/StaffingResourceListItem.cs</c>, which implemented DevForce's
    /// <c>IKnownType</c> so it could ride along on an <c>EntityQuery.Select(...)</c>.
    /// <para>
    /// Breeze has no equivalent marker: a query that returns a non-entity type simply comes back as
    /// plain JSON, which the client treats as a DTO.  <c>FullName</c> and <c>PhoneNumber</c> are
    /// composed in the LINQ projection (see <c>BreezeController.StaffingResourceListItems</c>) rather
    /// than in calculated properties, so that they can be sorted and filtered by the database.
    /// </para>
    /// </summary>
    public class StaffingResourceListItem
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; }
        public string MiddleName { get; set; }
        public string LastName { get; set; }
        public string FullName { get; set; }
        public string Address1 { get; set; }
        public string Address2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Zipcode { get; set; }
        public string AreaCode { get; set; }
        public string Number { get; set; }
        public string PhoneNumber { get; set; }
    }
}

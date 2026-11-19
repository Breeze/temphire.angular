using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TempHire.Model.Migrations.TempHire
{
    /// <summary>
    /// TempHire takes U.S. addresses only: the "International" placeholder state is gone, and the
    /// validation metadata wants a U.S. ZIP code and U.S. phone numbers.  A database seeded before has
    /// the original sample's three London resources on that state; this moves them to the U.S.
    /// addresses a new database is seeded with (<c>SampleDataProvider</c>), then removes the state.
    /// Any other address still on it is the database owner's to fix, so the migration stops there.
    /// </summary>
    public partial class UsAddressesOnly : Migration
    {
        // SampleDataProvider.CreateGuid(n): International (52), and Massachusetts, Illinois, New York.
        private const string International = "00000034-0000-0000-0000-000000000000";
        private const string Massachusetts = "00000016-0000-0000-0000-000000000000";
        private const string Illinois = "0000000e-0000-0000-0000-000000000000";
        private const string NewYork = "00000021-0000-0000-0000-000000000000";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var (lastName, city, state, zipcode, areaCode) in new[]
                     {
                         ("Buchanan", "Boston", Massachusetts, "02108", "617"),
                         ("Suyama", "Chicago", Illinois, "60601", "312"),
                         ("Dodsworth", "New York", NewYork, "10001", "212"),
                     })
            {
                migrationBuilder.Sql($"""
                    UPDATE a SET a.City = N'{city}', a.StateId = '{state}', a.Zipcode = N'{zipcode}'
                    FROM Addresses a JOIN StaffingResources r ON r.Id = a.StaffingResourceId
                    WHERE a.StateId = '{International}' AND r.LastName = N'{lastName}';

                    UPDATE p SET p.AreaCode = N'{areaCode}'
                    FROM PhoneNumbers p JOIN StaffingResources r ON r.Id = p.StaffingResourceId
                    WHERE p.AreaCode = N'071' AND r.LastName = N'{lastName}';
                    """);
            }

            migrationBuilder.Sql($"""
                IF EXISTS (SELECT 1 FROM Addresses WHERE StateId = '{International}')
                    THROW 50000, N'Some addresses are not U.S. addresses (state International). TempHire takes U.S. addresses only: give them a U.S. state and ZIP code, then start again.', 1;

                DELETE FROM States WHERE Id = '{International}';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The state comes back; the addresses stay in the U.S.
            migrationBuilder.Sql($"""
                IF NOT EXISTS (SELECT 1 FROM States WHERE Id = '{International}')
                    INSERT INTO States (Id, ShortName, Name, RowVersion) VALUES ('{International}', N'--', N'International', 0);
                """);
        }
    }
}

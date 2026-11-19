using Microsoft.EntityFrameworkCore.Migrations;
using TempHire.Model.SampleData;

#nullable disable

namespace TempHire.Model.Migrations.TempHire
{
    /// <summary>
    /// Gives the sample staffing resources of a database seeded before they had dates of birth and
    /// hire dates the dates a new database is seeded with (<see cref="SampleDataProvider.SampleDates"/>).
    /// Only dates that are missing, or that break the validation metadata's rule (at least 18 years
    /// old when hired), are replaced; dates someone entered that pass it are kept.
    /// </summary>
    public partial class SampleBirthAndHireDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var (id, dateOfBirth, hireDate) in SampleDataProvider.SampleDates())
            {
                migrationBuilder.Sql($"""
                    UPDATE StaffingResources
                    SET DateOfBirth = '{dateOfBirth:yyyy-MM-dd}', HireDate = '{hireDate:yyyy-MM-dd}'
                    WHERE Id = '{id}'
                      AND (DateOfBirth IS NULL OR HireDate IS NULL OR DATEADD(year, 18, DateOfBirth) > HireDate);
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The dates stay: they are valid sample data.
        }
    }
}

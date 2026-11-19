using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TempHire.Model.Migrations.TempHire
{
    /// <inheritdoc />
    public partial class RowVersionOnSavableEntitiesOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "States");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "RateTypes");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "PhoneNumberTypes");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "AddressTypes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "States",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "RateTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "PhoneNumberTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "AddressTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}

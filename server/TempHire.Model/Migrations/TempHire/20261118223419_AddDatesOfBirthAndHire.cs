using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TempHire.Model.Migrations.TempHire
{
    /// <inheritdoc />
    public partial class AddDatesOfBirthAndHire : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "StaffingResources",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HireDate",
                table: "StaffingResources",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "StaffingResources");

            migrationBuilder.DropColumn(
                name: "HireDate",
                table: "StaffingResources");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSingleActiveLeasePerPropertyIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_leases_PropertyId",
                table: "leases",
                column: "PropertyId",
                unique: true,
                filter: "\"Status\" = 'Active' AND \"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leases_PropertyId",
                table: "leases");
        }
    }
}

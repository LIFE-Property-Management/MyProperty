using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOverduePaymentsPartialIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_payments_DueDate",
                table: "payments");

            migrationBuilder.CreateIndex(
                name: "IX_payments_DueDate_Outstanding",
                table: "payments",
                column: "DueDate",
                filter: "\"Status\" = 'Outstanding' AND \"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_payments_DueDate_Outstanding",
                table: "payments");

            migrationBuilder.CreateIndex(
                name: "IX_payments_DueDate",
                table: "payments",
                column: "DueDate");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStakeholderDashboardIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_users_CreatedAt",
                table: "users",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_payments_ConfirmedAt",
                table: "payments",
                column: "ConfirmedAt");

            migrationBuilder.CreateIndex(
                name: "IX_payments_Status",
                table: "payments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_leases_CreatedAt",
                table: "leases",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_leases_Status",
                table: "leases",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_invites_CreatedAt",
                table: "invites",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_CreatedAt",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_payments_ConfirmedAt",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "IX_payments_Status",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "IX_leases_CreatedAt",
                table: "leases");

            migrationBuilder.DropIndex(
                name: "IX_leases_Status",
                table: "leases");

            migrationBuilder.DropIndex(
                name: "IX_invites_CreatedAt",
                table: "invites");
        }
    }
}

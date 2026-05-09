using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameUserKeycloakIdAndDropRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_Role",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "users");

            migrationBuilder.RenameColumn(
                name: "KeycloakId",
                table: "users",
                newName: "KeycloakSubId");

            migrationBuilder.RenameIndex(
                name: "IX_users_KeycloakId",
                table: "users",
                newName: "IX_users_KeycloakSubId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "KeycloakSubId",
                table: "users",
                newName: "KeycloakId");

            migrationBuilder.RenameIndex(
                name: "IX_users_KeycloakSubId",
                table: "users",
                newName: "IX_users_KeycloakId");

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "users",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_users_Role",
                table: "users",
                column: "Role");
        }
    }
}

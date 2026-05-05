using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameInviteTokenToTokenHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_invites_Token",
                table: "invites");

            migrationBuilder.DropColumn(
                name: "Token",
                table: "invites");

            migrationBuilder.AddColumn<Guid>(
                name: "LandlordId",
                table: "leases",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "TokenHash",
                table: "invites",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_leases_LandlordId_Status",
                table: "leases",
                columns: new[] { "LandlordId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_invites_TokenHash",
                table: "invites",
                column: "TokenHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_leases_users_LandlordId",
                table: "leases",
                column: "LandlordId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_leases_users_LandlordId",
                table: "leases");

            migrationBuilder.DropIndex(
                name: "IX_leases_LandlordId_Status",
                table: "leases");

            migrationBuilder.DropIndex(
                name: "IX_invites_TokenHash",
                table: "invites");

            migrationBuilder.DropColumn(
                name: "LandlordId",
                table: "leases");

            migrationBuilder.DropColumn(
                name: "TokenHash",
                table: "invites");

            migrationBuilder.AddColumn<string>(
                name: "Token",
                table: "invites",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_invites_Token",
                table: "invites",
                column: "Token",
                unique: true);
        }
    }
}

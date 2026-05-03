using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFailedEmails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "failed_emails",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ToAddress = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Subject = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    IsHtml = table.Column<bool>(type: "boolean", nullable: false),
                    HangfireJobId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    LastError = table.Column<string>(type: "text", nullable: false),
                    FailedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_failed_emails", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_failed_emails_FailedAt",
                table: "failed_emails",
                column: "FailedAt");

            migrationBuilder.CreateIndex(
                name: "IX_failed_emails_HangfireJobId",
                table: "failed_emails",
                column: "HangfireJobId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "failed_emails");
        }
    }
}

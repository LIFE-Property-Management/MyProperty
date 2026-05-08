using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyProperty.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentOcrColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OcrAmount",
                table: "payments",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "OcrDate",
                table: "payments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OcrMerchant",
                table: "payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OcrProcessedAt",
                table: "payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OcrRawResponse",
                table: "payments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OcrAmount",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "OcrDate",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "OcrMerchant",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "OcrProcessedAt",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "OcrRawResponse",
                table: "payments");
        }
    }
}

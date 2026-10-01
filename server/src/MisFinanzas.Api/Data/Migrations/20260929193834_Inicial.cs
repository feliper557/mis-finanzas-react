using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MisFinanzas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    rev = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    grp = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => new { x.user_id, x.id });
                    table.CheckConstraint("ck_categories_grp", "grp IN ('fijos', 'variables', 'ahorros')");
                    table.ForeignKey(
                        name: "fk_categories_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inv_categories",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inv_categories", x => new { x.user_id, x.id });
                    table.ForeignKey(
                        name: "fk_inv_categories_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "loans",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    kind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    quien = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    concepto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    monto = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    pagado = table.Column<bool>(type: "boolean", nullable: false),
                    fecha = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_loans", x => new { x.user_id, x.id });
                    table.CheckConstraint("ck_loans_kind", "kind IN ('prestamo', 'deuda')");
                    table.ForeignKey(
                        name: "fk_loans_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "months",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    k = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    ing = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    proj = table.Column<bool>(type: "boolean", nullable: false),
                    tiene_ingresos = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_months", x => new { x.user_id, x.k });
                    table.ForeignKey(
                        name: "fk_months_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "saving_pots",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saving_pots", x => new { x.user_id, x.id });
                    table.ForeignKey(
                        name: "fk_saving_pots_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "budgets",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    category_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_budgets", x => new { x.user_id, x.category_id });
                    table.ForeignKey(
                        name: "fk_budgets_categories_user_id_category_id",
                        columns: x => new { x.user_id, x.category_id },
                        principalTable: "categories",
                        principalColumns: new[] { "user_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inv_items",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    inv_category_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    concepto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    monto = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    pend = table.Column<bool>(type: "boolean", nullable: false),
                    gan = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    fecha = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inv_items", x => new { x.user_id, x.id });
                    table.ForeignKey(
                        name: "fk_inv_items_inv_categories_user_id_inv_category_id",
                        columns: x => new { x.user_id, x.inv_category_id },
                        principalTable: "inv_categories",
                        principalColumns: new[] { "user_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "income_sources",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    month_k = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    fuente = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    m = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_income_sources", x => x.id);
                    table.ForeignKey(
                        name: "fk_income_sources_months_user_id_month_k",
                        columns: x => new { x.user_id, x.month_k },
                        principalTable: "months",
                        principalColumns: new[] { "user_id", "k" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "transactions",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    month_k = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    category_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    concepto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    monto = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    pagado = table.Column<bool>(type: "boolean", nullable: false),
                    fecha = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_transactions", x => new { x.user_id, x.id });
                    table.ForeignKey(
                        name: "fk_transactions_categories_user_id_category_id",
                        columns: x => new { x.user_id, x.category_id },
                        principalTable: "categories",
                        principalColumns: new[] { "user_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_transactions_months_user_id_month_k",
                        columns: x => new { x.user_id, x.month_k },
                        principalTable: "months",
                        principalColumns: new[] { "user_id", "k" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "saving_entries",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    pot_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    nota = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    monto = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    fecha = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saving_entries", x => new { x.user_id, x.id });
                    table.ForeignKey(
                        name: "fk_saving_entries_saving_pots_user_id_pot_id",
                        columns: x => new { x.user_id, x.pot_id },
                        principalTable: "saving_pots",
                        principalColumns: new[] { "user_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_income_sources_user_id_month_k",
                table: "income_sources",
                columns: new[] { "user_id", "month_k" });

            migrationBuilder.CreateIndex(
                name: "ix_inv_items_user_id_inv_category_id",
                table: "inv_items",
                columns: new[] { "user_id", "inv_category_id" });

            migrationBuilder.CreateIndex(
                name: "ix_saving_entries_user_id_pot_id",
                table: "saving_entries",
                columns: new[] { "user_id", "pot_id" });

            migrationBuilder.CreateIndex(
                name: "ix_transactions_user_id_category_id",
                table: "transactions",
                columns: new[] { "user_id", "category_id" });

            migrationBuilder.CreateIndex(
                name: "ix_transactions_user_id_month_k",
                table: "transactions",
                columns: new[] { "user_id", "month_k" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "budgets");

            migrationBuilder.DropTable(
                name: "income_sources");

            migrationBuilder.DropTable(
                name: "inv_items");

            migrationBuilder.DropTable(
                name: "loans");

            migrationBuilder.DropTable(
                name: "saving_entries");

            migrationBuilder.DropTable(
                name: "transactions");

            migrationBuilder.DropTable(
                name: "inv_categories");

            migrationBuilder.DropTable(
                name: "saving_pots");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "months");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}

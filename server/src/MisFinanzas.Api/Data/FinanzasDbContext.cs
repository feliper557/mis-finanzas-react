using Microsoft.EntityFrameworkCore;

namespace MisFinanzas.Api.Data;

/// <summary>
/// Contexto unico de la aplicacion. Los nombres de tabla y columna pasan a snake_case
/// automaticamente con <c>UseSnakeCaseNamingConvention()</c>, igual que en Lactumama.
/// </summary>
public class FinanzasDbContext(DbContextOptions<FinanzasDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Month> Months => Set<Month>();

    public DbSet<IncomeSource> IncomeSources => Set<IncomeSource>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Budget> Budgets => Set<Budget>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<InvCategory> InvCategories => Set<InvCategory>();

    public DbSet<InvItem> InvItems => Set<InvItem>();

    public DbSet<SavingPot> SavingPots => Set<SavingPot>();

    public DbSet<SavingEntry> SavingEntries => Set<SavingEntry>();

    public DbSet<Loan> Loans => Set<Loan>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Es una aplicacion de dinero: ningun importe puede pasar por coma flotante.
        builder.Properties<decimal>().HavePrecision(14, 2);

        builder.Properties<string>().HaveMaxLength(200);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(320);
        });

        builder.Entity<Month>(e =>
        {
            e.HasKey(x => new { x.UserId, x.K });
            e.Property(x => x.K).HasMaxLength(7);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Ingresos)
                .WithOne()
                .HasForeignKey(x => new { x.UserId, x.MonthK })
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<IncomeSource>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedOnAdd();
            e.Property(x => x.MonthK).HasMaxLength(7);
            e.HasIndex(x => new { x.UserId, x.MonthK });
        });

        builder.Entity<Category>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.Grp).HasMaxLength(20);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_categories_grp",
                "grp IN ('fijos', 'variables', 'ahorros')"));
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Budget)
                .WithOne()
                .HasForeignKey<Budget>(x => new { x.UserId, x.CategoryId })
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Budget>(e => e.HasKey(x => new { x.UserId, x.CategoryId }));

        builder.Entity<Transaction>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.MonthK).HasMaxLength(7);
            e.Property(x => x.Concepto).HasMaxLength(500);

            // El filtro habitual del cliente es "todos los gastos de este mes".
            e.HasIndex(x => new { x.UserId, x.MonthK });

            e.HasOne<Month>()
                .WithMany()
                .HasForeignKey(x => new { x.UserId, x.MonthK })
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Category>()
                .WithMany()
                .HasForeignKey(x => new { x.UserId, x.CategoryId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<InvCategory>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<InvItem>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.Concepto).HasMaxLength(500);
            e.HasOne<InvCategory>()
                .WithMany()
                .HasForeignKey(x => new { x.UserId, x.InvCategoryId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<SavingPot>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<SavingEntry>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.Nota).HasMaxLength(500);

            // Sin restriccion de positividad sobre Monto: un valor negativo es un retiro.
            e.HasOne<SavingPot>()
                .WithMany()
                .HasForeignKey(x => new { x.UserId, x.PotId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Loan>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.Kind).HasMaxLength(10);
            e.Property(x => x.Concepto).HasMaxLength(500);
            e.ToTable(t => t.HasCheckConstraint("ck_loans_kind", "kind IN ('prestamo', 'deuda')"));
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Logging;
using TempHire.Model.SampleData;

namespace TempHire.Model
{
    /// <summary>
    /// Brings both databases up to the current schema with EF Core migrations, then seeds them.
    /// Runs once when the server starts.
    ///
    /// <para>
    /// <b>Not how a production application does it.</b>  Migrating on startup means every instance
    /// races to change the schema, the application's account needs rights to alter it, and a bad
    /// migration takes the site down with it.  A real deployment runs migrations as a separate,
    /// reviewed step (<c>dotnet ef migrations bundle</c> or an idempotent SQL script).  And this
    /// sample drops a database it cannot migrate, losing its data - fine for a demo, never for
    /// real data.
    /// </para>
    /// </summary>
    public static class DatabaseSetup
    {
        public static void Prepare(TempHireDbContext context, SecurityDbContext securityContext, ILogger logger)
        {
            Migrate(context.Database, "TempHire", logger);
            Migrate(securityContext.Database, "TempHireSecurity", logger);
            SampleDataProvider.Initialize(context, securityContext);
        }

        private static void Migrate(DatabaseFacade database, string name, ILogger logger)
        {
            // Earlier versions of this sample created the databases with EnsureCreated(), which builds
            // the tables but records no migrations.  Migrate() would then try to create the tables again
            // and fail, so a database that exists but has no migration history is dropped and rebuilt.
            // Its data is lost, which this sample accepts; a real application would baseline the
            // existing schema instead.
            if (database.CanConnect() && !database.GetAppliedMigrations().Any())
            {
                logger.LogWarning("The {Database} database has no migration history; recreating it.", name);
                database.EnsureDeleted();
            }

            var pending = database.GetPendingMigrations().ToList();
            if (pending.Count == 0)
            {
                return;
            }

            logger.LogInformation("Applying {Count} migration(s) to the {Database} database: {Migrations}",
                pending.Count, name, string.Join(", ", pending));
            database.Migrate();
        }
    }
}

# TempHire (Angular + BreezeJS)

A conversion of the WPF/DevForce **TempHire** sample (`../TempHire.Wpf.sln`) to a modern web stack.

| | Original | This version |
|---|---|---|
| Client | WPF + Caliburn.Micro + Cocktail | **Angular 22** (standalone, zoneless, signals) + **PrimeNG 22** |
| Data access (client) | DevForce `EntityManager` | **breeze-client 2.2.2** |
| Server | DevForce EntityServer (WCF) | **ASP.NET Core 9** + **Breeze.AspNetCore 7.5.1** |
| ORM | Entity Framework 6 (Code First) | **EF Core 9** |
| Database | SQL Server Compact (`.sdf`) | **SQL Server LocalDB / Express** |
| Auth | DevForce `IEntityLoginManager` + server session | **JWT bearer** + PBKDF2 password hashing |

The application behaves the same as the original: log in, search staffing resources, view one,
edit it in an isolated sandbox, and save or cancel. `docs/CONVERSION-NOTES.md` maps every piece of
the old architecture onto its replacement and records the places where behaviour deliberately
changed.

> **A note on the .NET version.** The server targets **`net9.0`** with the 9.0.19 package set.
> .NET 9 is an STS release: it is in maintenance support (security fixes only) and reaches
> end of support on **10 November 2026**. Moving to .NET 10 (LTS, supported to November 2028) is a
> two-line change — set `<TargetFramework>net10.0</TargetFramework>` in both `.csproj` files and
> move the `Microsoft.*` package versions to `10.0.*`. Breeze 7.5.1 supports .NET 5 through 10, so
> nothing else has to change.

---

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) — the 9.0 SDK, or the 10.0 SDK, which can build
  a `net9.0` project as well
- [Node.js](https://nodejs.org) **22.22.3+**, 24.15+, or 26+ (required by the Angular 22 CLI)
- SQL Server **LocalDB** (ships with the Visual Studio "Data storage and processing" workload and
  with [SQL Server Express](https://www.microsoft.com/sql-server/sql-server-downloads)), or any
  SQL Server instance — see [Using a different database](#using-a-different-database)

## Running it

Two terminals. Server first, because the client fetches its Breeze metadata from it.

**1. Server** (`http://localhost:5000`)

```
cd server/TempHire.Server
dotnet restore
dotnet run
```

On first run this creates two databases (`TempHire` and `TempHireSecurity`) and seeds them with the
same eight staffing resources the original sample shipped with, plus the `Admin` user.

**2. Client** (`http://localhost:4200`)

```
cd client
npm install
npm start
```

Then open <http://localhost:4200> and sign in with **`Admin`** / **`password`** — the credentials
from the original `SecuritySampleDataProvider`.

### Building for production

```
cd client
npm run build:server     # builds into ../server/TempHire.Server/wwwroot
cd ../server/TempHire.Server
dotnet run --environment Production
```

`Program.cs` already serves static files and falls back to `index.html`, so the whole app is then
available from the server's own origin and no CORS is involved.

---

## Layout

```
TempHire.Angular/
├── TempHire.Angular.sln
├── server/
│   ├── TempHire.Model/            # POCO entities, DbContexts, sample data
│   │   ├── Entities/              # ← DomainModel/ + Security/User.cs
│   │   ├── Projections/           # ← DomainModel/Projections/
│   │   ├── SampleData/            # ← DomainServices/SampleData/
│   │   └── TempHireDbContext.cs   # business + security contexts
│   └── TempHire.Server/
│       ├── Controllers/
│       │   ├── BreezeController.cs   # metadata, queries, SaveChanges, lookups, search
│       │   └── AccountController.cs  # login / logout / me
│       ├── Persistence/
│       │   └── TempHirePersistenceManager.cs   # ← DomainModel/SaveInterceptor.cs
│       ├── Auth/                  # JWT options + token service
│       └── Program.cs
└── client/
    └── src/app/
        ├── core/
        │   ├── entities/          # TypeScript entity classes + Breeze registration
        │   ├── services/          # ← Cocktail: EntityManagerProvider, UnitOfWork,
        │   │                      #   Repository, UnitOfWorkManager, toolbar, dialogs, auth
        │   └── dialogs/
        ├── login/                 # ← ViewModels/Login/
        ├── home/                  # ← ViewModels/HomeViewModel.cs
        ├── resource-mgt/          # ← ViewModels/StaffingResource/
        │   └── sections/          # the four detail tabs
        ├── app.ts / app.html      # ← Views/ShellView.Wpf.xaml
        └── app.routes.ts          # ← Cocktail workspaces + INavigator
```

Every ported file carries a doc comment naming the WPF file it came from, so you can read the two
side by side.

---

## Why these libraries

**PrimeNG** for the UI. TempHire is a data-dense desktop-style app: its screens are grids, tabs,
modal dialogs and inline editors. PrimeNG's `p-table`, `p-tabs`, `DynamicDialog`, `p-select`,
`p-inputNumber` and `p-datePicker` map almost one-to-one onto the WPF `DataGrid`, `TabControl`,
Cocktail dialogs, `ComboBox` and Xceed editors, which keeps the conversion honest. Angular Material
would also work but its table is lower-level, so the address/phone/rates/skills grids would need
noticeably more hand-written code.

The rest of the WPF-era dependencies did not need replacing so much as *deleting*:

| Original | Replacement | Why |
|---|---|---|
| Caliburn.Micro (MVVM, conventions, `IEventAggregator`) | Angular components, signals, RxJS `Subject` | Angular already is an MVVM framework; the event aggregator becomes two `Subject`s on `UnitOfWork` |
| Cocktail (`IUnitOfWorkManager`, `IRepository`, `IFactory`, `IDialogManager`, `IBusyWatcher`, `INavigator`) | Hand-ported into `core/services` | These are ~250 lines of pattern, and porting them keeps the app's architecture recognisable. Navigation becomes the Angular router |
| MEF (`[Export]`, `[ImportMany]`) | Angular DI + explicit lists | Angular DI covers the singleton/scoped cases; the two places MEF was used for *discovery* (workspaces, detail sections) are now explicit lists, called out in the code |
| Xceed WPF Toolkit `BusyIndicator` | `BusyService` + `p-progressSpinner` | |
| `System.Windows.Interactivity` behaviours | Native DOM behaviour / directives | `SelectAllOnFocusBehavior`, `InitialFocusBehavior` etc. are one-liners in HTML |
| `IdeaBlade.Validation` | Breeze validators, derived from the EF Core model | `[Required]`/`[StringLength]` on the server entities reach the client automatically in the Breeze metadata |

No date, HTTP or utility library was added: Angular's `HttpClient` and the platform's `Intl` cover
what jQuery/lodash/moment would once have been used for.

---

## Using a different database

The server targets SQL Server through `Microsoft.EntityFrameworkCore.SqlServer`. To point at a real
instance instead of LocalDB, change the two connection strings in
`server/TempHire.Server/appsettings.json`.

To move to another provider, swap the package in `TempHire.Model.csproj` and the two
`options.UseSqlServer(...)` calls in `Program.cs`. Nothing else in the model is SQL Server-specific
apart from `[Column(TypeName = "decimal(18,2)")]` on `Rate.Amount`.

Schema creation uses `Database.EnsureCreated()` (see `SampleDataProvider.Initialize`), which is
right for a sample but not for a system that has to evolve. For real work, replace it with EF Core
migrations:

```
dotnet tool install --global dotnet-ef --version 9.*
dotnet ef migrations add Initial --project ../TempHire.Model --startup-project .
dotnet ef database update
```

(The `dotnet-ef` tool's major version has to match the EF Core packages, hence the `9.*`.)

## Configuration

| Setting | Where | Notes |
|---|---|---|
| `ConnectionStrings:TempHire` | `appsettings.json` | Business data |
| `ConnectionStrings:TempHireSecurity` | `appsettings.json` | Users — a separate database, as in the original |
| `Jwt:SigningKey` | `appsettings.Development.json` | **Development placeholder.** Set a real one before deploying: `dotnet user-secrets set "Jwt:SigningKey" "<long random string>"` |
| `Jwt:ExpiryMinutes` | `appsettings.json` | Defaults to 8 hours |
| `AllowedClientOrigins` | `appsettings.json` | CORS allow-list for the dev server |
| `breezeApiRoot` / `accountApiRoot` | `client/src/environments/` | `environment.ts` is the **production** file; `environment.development.ts` replaces it during `ng serve` |

---

## Known gaps

- **No automated tests beyond a shell smoke test.** The original had none either. `ng test` runs
  Vitest; the server has no test project.
- **`Database.EnsureCreated()` instead of migrations**, as described above.
- **Logout does not revoke the token.** A JWT is valid until it expires; `AccountController.Logout`
  is the hook where a revocation list would go.
- **Search has no paging.** `StaffingResourceListItems` returns every match, exactly as
  `StaffingResourceSearchService.Simple` did. `[BreezeQueryFilter(MaxTake = ...)]` is the place to
  add a cap.
- **The `.sdf` sample databases are not migrated.** The seed data is re-created from the ported
  `SampleDataProvider`, so ids match the original, but any data you added to the old SQL Compact
  files does not come across.

See `docs/CONVERSION-NOTES.md` for the full architecture mapping and the list of deliberate
behavioural changes.

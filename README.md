# TempHire (Angular + BreezeJS)

A conversion of the WPF/DevForce **TempHire** sample (`../TempHire.Wpf.sln`) to a modern web stack.

| | Original | This version |
|---|---|---|
| Client | WPF + Caliburn.Micro + Cocktail | **Angular 22** (standalone, zoneless, signals) + **PrimeNG 22** |
| Data access (client) | DevForce `EntityManager` | **breeze-client 3** |
| Server | DevForce EntityServer (WCF) | **ASP.NET Core 10** + **Breeze.AspNetCore 8** |
| ORM | Entity Framework 6 (Code First) | **EF Core 10** |
| Database | SQL Server Compact (`.sdf`) | **SQL Server LocalDB / Express** |
| Auth | DevForce `IEntityLoginManager` + server session | **JWT bearer** + PBKDF2 password hashing |

The application behaves the same as the original: log in, search staffing resources, view one,
edit it in an isolated sandbox, and save or cancel. `docs/CONVERSION-NOTES.md` maps every piece of
the old architecture onto its replacement and records the places where behaviour deliberately
changed.

> **A note on the .NET version.** The server targets **`net10.0`** (LTS, supported to November
> 2028) with the 10.0.x package set. It stays on .NET 10 rather than .NET 11 because Breeze 8
> supports .NET 8, 9 and 10, and `Breeze.Persistence.EFCore` 8 requires EF Core 10 (it pins
> `Microsoft.EntityFrameworkCore.Relational` to `[10.0.0, 11.0.0)`).

---

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) — the 10.0 SDK or later
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

## Entity classes are generated

The TypeScript entity classes in `client/src/app/core/model/` are written by the entity generator
that ships with `breeze-client` 3 (`breeze-gen-entities`), from the same Breeze metadata the server
publishes. The flow has three steps, and `npm run model` in `client/` runs the first two:

```
EF Core model ──► client/metadata.json ──► client/src/app/core/model/*.ts ──► registerModelClasses
   (server)      npm run model:metadata     npm run model:generate           (at login, client)
```

1. **Export the metadata.** `npm run model:metadata` runs the server with `--export-metadata`, which
   writes exactly what `GET /api/breeze/Metadata` serves to `client/metadata.json` and exits. It
   reads the EF Core model only, so it needs no database and no login. The file is checked in, so a
   schema change shows up in review as a metadata diff next to the class diff it causes.
2. **Generate the classes.** `npm run model:generate` writes one class per entity type, each
   extending the hand-written `BaseEntity`, plus an `index.ts` barrel with `registerModelClasses`.
   Generated lines end in `// @generated`; constructors, getters and methods you add (such as
   `StaffingResource.addAddress`) are never touched, so regenerating is always safe.
3. **Register them.** `core/model-registration.ts` calls `registerModelClasses` on the master
   manager's `MetadataStore` once the metadata has loaded. From then on Breeze builds entities from
   these classes, and the typed APIs work: `EntityQuery.from(StaffingResource)` is an
   `EntityQuery<StaffingResource>`, and `createEntity(Address, { ... })` checks its initial values
   against the class.

**After changing an entity on the server**, run `npm run model` in `client/` and commit the
metadata and class changes together. `client/src/app/core/model/README.md` covers the markers for
keeping a hand-written property away from the generator.

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
    ├── metadata.json              # Breeze metadata exported from the server (npm run model:metadata)
    └── src/app/
        ├── core/
        │   ├── model/             # generated entity classes + hand-written methods (npm run model)
        │   ├── model-registration.ts   # registers the classes and adds client-only validators
        │   ├── projections/       # non-entity query results (StaffingResourceListItem)
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
| Caliburn.Micro (MVVM, conventions, `IEventAggregator`) | Angular components and signals | Angular already is an MVVM framework; the event aggregator's messages become signals (`UnitOfWork.changes`, `UnitOfWorkManager.saves`) |
| Cocktail (`IUnitOfWorkManager`, `IRepository`, `IFactory`, `IDialogManager`, `IBusyWatcher`, `INavigator`) | Hand-ported into `core/services` | These are ~250 lines of pattern, and porting them keeps the app's architecture recognisable. Navigation becomes the Angular router |
| MEF (`[Export]`, `[ImportMany]`) | Angular DI + explicit lists | Angular DI covers the singleton/scoped cases; the two places MEF was used for *discovery* (workspaces, detail sections) are now explicit lists, called out in the code |
| Xceed WPF Toolkit `BusyIndicator` | `BusyService` + `p-progressSpinner` | |
| `System.Windows.Interactivity` behaviours | Native DOM behaviour / directives | `SelectAllOnFocusBehavior`, `InitialFocusBehavior` etc. are one-liners in HTML |
| `IdeaBlade.Validation` | Breeze validators, derived from the EF Core model | `[Required]`/`[StringLength]` on the server entities reach the client automatically in the Breeze metadata |

No date, HTTP or utility library was added: Angular's `HttpClient` and the platform's `Intl` cover
what jQuery/lodash/moment would once have been used for.

### Angular as of version 22

The client is meant to show current Angular, not just to run on it:

- **Standalone components, no NgModules**, lazy-loaded routes, functional guards and interceptors.
- **Zoneless and OnPush.** There is no zone.js, and Angular 22 makes OnPush the default change
  detection for every component.  Views update from signals, so state lives in signals.
- **Signals throughout.** `input()` / `output()` instead of decorators, `computed` for derived
  state, `linkedSignal` where a value must survive a reload (the search grid keeps its rows while
  new ones load), and `effect` only for genuine side effects.
- **Breeze entities and signals.** Entities are plain mutable objects, so a unit of work turns its
  `EntityManager`'s change events into a counter signal, `UnitOfWork.changes`, plus a `hasChanges`
  signal.  The toolbar's Save and Cancel derive from those, so an edit anywhere in a sandbox
  enables Save without any subscription.
- **`resource()`** loads the search results; its params are the search text and the save counter,
  so a save anywhere reloads the list.
- **Signal Forms** (`@angular/forms/signals`) for the forms over plain data: login, the search box
  and the name editor.  The entity editors keep `[(ngModel)]` bound straight to the Breeze
  entities, as Breeze recommends: a Signal Form would hold a second copy of every value, kept in
  step with the entity by hand.
- **`@defer`** for the Rates, Work Experience and Skills tabs, each loaded as its own chunk when its
  tab is first opened.
- **Injection functions** such as `registerToolbarGroup`, which adds a toolbar group and removes
  it through `DestroyRef`, in place of lifecycle hooks.
- **The `@angular/build` builder** (esbuild, a Vite dev server, Vitest for `ng test`); there is no
  Webpack.

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

- **A temporary workaround for a breeze-client 3.0.0 bug.** Breeze 3.0.0 fails any request whose
  successful response has an empty body: a **204 No Content**, which ASP.NET Core sends whenever a
  controller action returns `null`, or a 200 with no body. The query rejects with
  `SyntaxError: Unexpected end of JSON input` instead of resolving with no results. None of
  TempHire's current endpoints send such a response, but a new action that can return `null`
  would. `app.config.ts` therefore wraps Breeze's fetch function in `emptyBodyAsNull`
  (`client/src/app/core/services/breeze-fetch.ts`), the workaround from the
  [breeze-client release notes](https://github.com/Breeze/breeze-client-v3/blob/fix/empty-response-body/RELEASE-NOTES.md).
  The fix is on the `fix/empty-response-body` branch of breeze-client-v3 and not yet released.
  **When you upgrade to a release with the fix**, `breeze-fetch.spec.ts` fails its "without the
  workaround" test; that is the signal to delete `breeze-fetch.ts` and its spec, and to pass
  `httpClientFetch(inject(HttpClient))` to `configureBreeze` directly.
- **No automated tests beyond a shell smoke test and the workaround above.** The original had none
  either. `ng test` runs Vitest; the server has no test project.
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

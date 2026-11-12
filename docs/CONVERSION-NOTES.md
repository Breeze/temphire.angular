# Conversion notes: DevForce/WPF → Breeze/Angular

This document maps the original TempHire architecture onto the converted one, and records every
place where behaviour changed on purpose.

---

## 1. The shape of the change

DevForce and Breeze are the same idea in two eras. Both give you:

- an **EntityManager** on the client that caches entities and tracks their changes,
- **queries composed on the client** and executed on the server,
- a **change set** shipped back in one round trip and saved transactionally,
- **metadata** describing the model, shared by both tiers.

So the conversion is mostly a translation rather than a redesign. The three genuine structural
differences are:

**a. The domain assembly is no longer shared.** DevForce compiled `DomainModel.dll` into both the
WPF client and the EntityServer, so entity *behaviour* (`StaffingResource.AddAddress`,
`PrimaryAddress`, `Validate`) existed identically on both sides. Breeze cannot do that: the server
is C#, the client is TypeScript. The behaviour is therefore written twice —
`server/TempHire.Model/Entities/StaffingResource.cs` holds the POCO and the server-side rules,
`client/src/app/core/model/staffing-resource.ts` holds the client-side methods. What *is* shared is
the shape: the client's property declarations are generated from the server's metadata
(`npm run model`), so only the behaviour is written by hand on the client. The
`[Required]`/`[StringLength]` annotations *do* still cross the wire, because Breeze reads them off
the EF Core model and publishes them in the metadata as validators.

**b. There is no lazy loading.** DevForce's `RelatedEntityList<T>` faulted child collections in on
first access, which is why the WPF view models had `IsPending` flags and
`PendingEntityListResolved` events. Breeze has no equivalent, so the detail screen eager-loads
everything it needs with a single `expand`
(`ResourceMgtUnitOfWork.loadStaffingResource`). The `IsPending` flags are gone; `IsEmpty` survives.

**c. Queries travel as JSON, not expression trees.** The client still writes
`EntityQuery.from(StaffingResource).where(...)`, but `[BreezeQueryFilter]` applies it server-side
to an `IQueryable<T>`. Where the original composed a LINQ predicate on the client and shipped it
(`StaffingResourceSearchService.Simple`), the predicate now lives in
`BreezeController.StaffingResourceListItems` and the client passes a search string.

---

## 2. File-by-file map

### Domain model

| Original | Converted |
|---|---|
| `DomainModel/EntityBase.cs` (`EntityBase`, `AuditEntityBase`) | `server/TempHire.Model/Entities/EntityBase.cs` + `client/…/model/base-entity.ts` (`BaseEntity`; the audit columns are generated onto each entity that has them) |
| `DomainModel/StaffingResource.cs` | `…/Entities/StaffingResource.cs` + `…/model/staffing-resource.ts` |
| `DomainModel/Address.cs`, `PhoneNumber.cs`, `Rate.cs`, `Skill.cs`, `WorkExperienceItem.cs` | `…/Entities/*.cs` + `…/model/*.ts` |
| `DomainModel/AddressType.cs`, `PhoneNumberType.cs`, `RateType.cs`, `State.cs` | `…/Entities/*.cs` + `…/model/address-type.ts` etc. (generated, no hand-written code) |
| `DomainModel/Projections/StaffingResourceListItem.cs` | `…/Projections/StaffingResourceListItem.cs` + `client/…/projections/staffing-resource-list-item.ts` |
| `DomainModel/TempHireDbContext.cs` (EF6) | `…/TempHireDbContext.cs` (EF Core 10, fluent config) |
| `DomainModel/TempHireEntities.cs` (`EntityManager` subclass) | *gone* — the EntityManager is a client concept now |
| `DomainModel/TempHireEntities.ibmmx` (IdeaBlade model file) | *gone* — metadata is generated from the EF Core model at `GET /api/breeze/Metadata`, and exported to `client/metadata.json`, from which `breeze-gen-entities` (`npm run model`) writes the client classes |
| `DomainModel/SaveInterceptor.cs` | `server/TempHire.Server/Persistence/TempHirePersistenceManager.cs` |
| `Security/User.cs`, `LoginManager.cs`, `CryptoHelper.cs` | `…/Entities/User.cs` + `Controllers/AccountController.cs` + `Auth/TokenService.cs` |
| `Security/SecurityDbContext.cs` | `SecurityDbContext` in `…/TempHireDbContext.cs` |
| `DomainServices/SampleData/*.cs` | `…/SampleData/SampleDataProvider.cs` |

### DevForce / Punch attributes

| Attribute | Replacement |
|---|---|
| `[ProvideEntityAspect]` | Breeze attaches `entityAspect` at runtime when the type is registered with the `MetadataStore` |
| `[DataContract(IsReference = true)]` | Json.NET with `TypeNameHandling.Objects` + `$id`/`$ref`, configured by `JsonSerializationFns.UpdateWithDefaults` |
| `[RequiresAuthentication]` on `EntityBase` | `[Authorize]` on `BreezeController` |
| `[ClientCanSave(true)]` on `AuditEntityBase` + `DefaultAuthorization = false` | `TempHirePersistenceManager.BeforeSaveEntity` rejects anything that is not an `AuditEntityBase`. Same effect: the four lookup types are read-only to the client |
| `[ClientCanQuery(false)]` on `User` | `User` is not exposed by any controller and lives in a separate DbContext, so it never reaches the client metadata |
| `[ConcurrencyStrategy(ConcurrencyStrategy.AutoIncrement)]` | `[ConcurrencyCheck]` on `RowVersion`; incremented in `BeforeSaveEntities` |
| `[BeforeSet]` string trimming on `EntityBase` | Not ported. It silently trimmed every string on assignment; doing that on the client would fight the user's cursor. Trim at the point of use instead |
| `[AfterSet("FirstName")] → ForcePropertyChanged("FullName")` | Unnecessary — `fullName` is a plain getter and Angular re-evaluates it each change detection pass |

### Client services (Punch → `client/src/app/core/services/`)

Punch was first called Cocktail, and its code still uses that name: the types below are in the
`Cocktail` namespace, which the original sample imports with `using Cocktail;`.

| Punch | Converted | Notes |
|---|---|---|
| `IEntityManagerProvider` + `GlobalCache` + `GlobalCacheRepository<T>` | `entity-manager-provider.ts` | One master manager holds metadata + all lookups; every sandbox is `createEmptyCopy()` seeded via `exportEntities`/`importEntities`. This is the same trick `GlobalCacheRepository.OnManagerCreated` used, and it is why `QueryStrategy.CacheOnly` becomes `FetchStrategy.FromLocalCache` |
| `IUnitOfWork` | `unit-of-work.ts` | Owns one `EntityManager` |
| `IUnitOfWorkManager<T>` | `unit-of-work-manager.ts` | Keyed cache. `Guid.Empty` → `SHARED_UNIT_OF_WORK_KEY` |
| `IRepository<T>` | `repository.ts` | |
| `IFactory<T>` / `StaffingResourceFactory` | `EntityFactory` / `StaffingResourceFactory` in `resource-mgt-unit-of-work.ts` | |
| `IDialogManager`, `DialogResult`, `DialogButtons` | `dialog.service.ts` + `core/dialogs/message-box.component.ts` | Cancellation still surfaces as a thrown error (`DialogCancelledError`) so the ported control flow reads like the original's `catch (TaskCanceledException)`. PrimeNG's two-button `p-confirmDialog` cannot express Yes/No/Cancel, so the buttons are data |
| `IBusyWatcher` / `Busy.GetTicket()` | `busy.service.ts` — `await busy.run(promise)` | |
| `IToolbarManager`, `ToolbarAction`, `ToolbarGroup` | `toolbar.service.ts` | `CanExecute` was found by reflecting for a `Can<Method>` property; it is now an explicit `canExecute` thunk reading signals |
| `IAuthenticationService`, `LoggedInMessage`, `LoggedOutMessage` | `auth.service.ts` (+ `auth.interceptor.ts`, `auth.guard.ts`) | The two messages become one `isLoggedIn` signal |
| `INavigator` | Angular router (`app.routes.ts`) | |
| `IErrorHandler`, `ValidationErrorHandler` | `error-handler.service.ts` | |
| `IWorkspace` (`[ImportMany]` via MEF) | `WORKSPACES` array in `app.routes.ts` | Angular has no ambient discovery; the list is explicit |
| `IMessageProcessor`, `EntityChangedMessage`, `SavedMessage` | `UnitOfWork.changes` / `UnitOfWork.hasChanges` and `UnitOfWorkManager.saves` signals | `EntityChangedMessage` becomes a counter signal bumped from the manager's `entityChanged` event; `SavedMessage` a save counter that the search list's `resource()` reads, so it reloads after any save |

### Screens

| Original view model + view | Converted |
|---|---|
| `ShellViewModel` + `ShellView.Wpf.xaml` | `app.ts` / `app.html` |
| `LoginViewModel` + `LoginView.Wpf.xaml` | `login/login.component.ts` |
| `HomeViewModel` + `HomeView.xaml` | `home/home.component.ts` |
| `ResourceMgtViewModel` + `ResourceMgtView.xaml` | `resource-mgt/resource-mgt.component.*` |
| `StaffingResourceSearchViewModel` + view | `resource-mgt/resource-search.component.ts` |
| `StaffingResourceDetailViewModel` + view | `resource-mgt/resource-detail.component.ts` (+ loading logic hoisted into `resource-mgt.component.ts`) |
| `StaffingResourceSummaryViewModel` + view | `resource-mgt/resource-summary.component.ts` |
| `StaffingResourceContactInfoViewModel` + view | `resource-mgt/sections/resource-contact-info.component.ts` |
| `StaffingResourceAddressListViewModel` + `StaffingResourceAddressItemViewModel` | `sections/resource-address-list.component.ts` |
| `StaffingResourcePhoneListViewModel` + `StaffingResourcePhoneItemViewModel` | `sections/resource-phone-list.component.ts` |
| `StaffingResourceRatesViewModel` + view | `sections/resource-rates.component.ts` |
| `StaffingResourceWorkExperienceViewModel` + view | `sections/resource-work-experience.component.ts` |
| `StaffingResourceSkillsViewModel` + view | `sections/resource-skills.component.ts` |
| `StaffingResourceNameEditorViewModel` + view | `resource-mgt/resource-name-editor.component.ts` |
| `ItemSelectorViewModel` + view | `resource-mgt/item-selector.component.ts` |
| `Harness` project (Punch development harness) | Not ported — `ng serve` with hot reload covers what it was for |
| `TempHire.SL`, `*.SL` projects (Silverlight) | Not ported — Silverlight is dead, and the browser is now the only target |

---

## 3. The part worth understanding: sandbox editing

This is the architectural idea TempHire exists to demonstrate, and it survives intact.

`UnitOfWorkManager` keys units of work by id:

- **`SHARED_UNIT_OF_WORK_KEY`** (`Guid.Empty` in the original) — one long-lived unit of work that
  every read-only screen shares. The search list and the view-mode detail read from it, so they see
  the same entity instances and stay in sync for free.
- **`<resourceId>`** — a *sandbox*, created when you press Edit or Add. It owns a separate
  `EntityManager`, so the edits are invisible to everything else on screen and `Cancel` is one
  `rejectChanges()` with no side effects.

`ResourceMgtComponent.loadDetail` picks the key from the edit mode, exactly as
`StaffingResourceDetailViewModel.UnitOfWork` did:

```ts
const key = editMode === 'view' ? SHARED_UNIT_OF_WORK_KEY : id;
```

Two consequences are worth calling out because they are not obvious:

1. **After a save, the shared cache is dropped** (`unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY).clear()`).
   The save happened in the sandbox, so the shared manager still holds the children it loaded
   earlier — including any that were just deleted. A Breeze query merge never detaches entities the
   server omitted, so re-querying would not remove them; the cache has to be cleared and re-seeded.
2. **A sandbox is released once it is clean** (`releaseIfClean`), mirroring Punch's automatic
   eviction, so a cancelled edit does not leak its `EntityManager` for the rest of the session.

---

## 4. Deliberate behavioural changes

Everything below is a conscious departure from the original.

**Security**

- *Password storage.* The original AES-encrypted the password with a key derived from the password
  itself and "authenticated" by decrypting and comparing — reversible, and not acceptable today.
  `User` now stores a PBKDF2-HMAC-SHA256 hash (210,000 iterations, 16-byte salt) and compares in
  constant time. The seeded credentials are unchanged, so `Admin`/`password` still works.
- *Session.* A stateless JWT replaces the DevForce server session. The token lives in
  `sessionStorage` and is attached by `auth.interceptor.ts`. It cannot be revoked before it expires.
- *Metadata requires authentication*, matching `[RequiresAuthentication]` on the DevForce
  `EntityBase`. This is why `AuthService.login` calls `EntityManagerProvider.prepare()` immediately
  after the token arrives — the same place `LoginViewModel` called `IGlobalCache.LoadAsync()`.

**UI**

- *Login is a route, not a modal.* The WPF shell popped a modal on load and after logout; a
  `/login` route plus `authGuard` is the web idiom, and it makes browser refresh work.
- *Selection debounce removed.* `ResourceMgtViewModel` debounced grid selection with a 200 ms
  `DispatcherTimer` because the WPF `DataGrid` fires `SelectionChanged` during keyboard navigation.
  PrimeNG raises it once per click, so the timer is gone.
- *Work experience is listed newest first.* The original ordered by `From` ascending.
- *Primary address/phone is chosen with a radio button*, where the original used a "Set primary"
  button per row. The enable/disable rules (`CanSetPrimary`, `CanDelete`) are unchanged.
- *An unsaved-changes prompt now guards route exit* (`pendingChangesGuard`), covering what
  `IScreen.CanClose` + `OnNavigatingFrom` did when the shell switched workspaces.

**Server**

- *`Rate.Amount` gained a non-negative validator.* The WPF view enforced this through a masked
  numeric editor; expressing it as a model rule is strictly better.
- *The search projection composes `FullName` and `PhoneNumber` in SQL.* They were calculated
  properties on the DTO before. Doing it in the projection means the database can sort and filter on
  them.
- *`IsNullOrEmpty` replaces `IsNullOrWhiteSpace`* in the search projection, because EF Core can
  translate the former and not the latter.
- *Validation runs against the save bundle, not a sandbox EntityManager.* `SaveInterceptor.ValidateSave`
  restored the cache state into a throwaway `EntityManager` so that cross-entity rules could see the
  whole graph. Breeze hands the whole change set to `BeforeSaveEntities` at once, so
  `TempHirePersistenceManager` stitches the graph together from the save map plus the stored rows
  (read with `AsNoTracking`, which is required — a tracking query here would collide with the
  entities Breeze is about to attach).

**Not carried over**

- The Silverlight projects (`*.SL`) and the Punch development `Harness`.
- `DemoConnectionOptionsResolver`, `FakeLoginManager`, `DesignTimeSupport/` — DevForce's design-time
  and fake-store scaffolding, which has no counterpart when the client always talks to a real server.
- `Common/Behaviors/*` — `BindablePasswordBehavior`, `InitialFocusBehavior`,
  `SelectAllOnFocusBehavior`, `ScrollIntoViewBehavior`. All four work around WPF limitations that
  the DOM does not have.
- `Common/Converters/*` — `InverseBooleanConverter` and `SourceToTabItemsConverter` are expressions
  in an Angular template.

---

## 5. Things to be aware of when extending it

- **Zoneless, OnPush change detection.** There is no zone.js, and Angular 22 makes OnPush the
  default, so a component re-renders only for an event in its own template or a signal it reads.
  State that changes anywhere else - in a promise callback, or in another component - must live in
  a `signal` or the view will not repaint.  Breeze entity *properties* are safe to bind directly
  with `[(ngModel)]` in the component that edits them, because that edit is an event in that
  component.  Anything that has to react to an entity change *elsewhere*, as the toolbar's Save
  button does, reads `UnitOfWork.changes` (or `hasChanges`) inside a `computed`.
- **Signal Forms and PrimeNG.** `[formField]` passes the field's `invalid` state to PrimeNG's
  `pInputText`, which shows its red border at once, and binding `[invalid]` yourself next to
  `[formField]` is a compile error (NG8022).  `app.config.ts` therefore adds a
  `signal-form-untouched` class through `provideSignalFormsConfig`, and `styles.css` holds back the
  invalid border on those fields until they have been touched.  Entity fields are not held back:
  a Breeze error shows at once.
- **Adding an editable entity field** means binding it with `[(ngModel)]` plus
  `[breezeField]="entity" breezeProperty="name" #nameField="breezeField"
  [invalid]="nameField.invalid()"`.  Without the directive the field still works, but its Breeze
  errors reach neither the form nor PrimeNG.  Validation rules belong on the server's entity, not
  in the form.
- **One `MetadataStore` for the page.** Breeze binds each registered entity class to a single
  store, so `EntityManagerProvider` keeps one store across logout and login and registers the
  classes once.  Creating a new store per login made the second login in a page fail.
- **Adding a detail tab** means editing `resource-detail.component.ts`. The original got this for
  free from MEF's `[ImportMany] IEnumerable<IStaffingResourceDetailSection>` ordered by `Index`.
- **Adding a workspace** means adding a route in `app.routes.ts` and an entry in `WORKSPACES`.
- **Adding an entity type** means: POCO + `DbSet` on the server, a `[HttpGet]` action returning
  `IQueryable<T>` on `BreezeController`, then `npm run model` in `client/` to export the metadata
  and generate the TypeScript class (registration is generated too), and a repository on
  `ResourceMgtUnitOfWork` (`this.createRepository(MyEntity)`). Repositories query the entity
  type's `defaultResourceName` from the metadata, which is the `DbSet` name, so the controller
  action must be named after the `DbSet`.
- **Breeze's `EntityErrorsException` returns HTTP 403**, not 400. `auth.interceptor.ts` deliberately
  does *not* treat 403 as an authentication failure — doing so would log the user out whenever a
  save failed validation.
- **Adding a non-Breeze endpoint? Give its DTOs `[JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]`.**
  `Program.cs` clears Json.NET's naming strategy for the whole pipeline, because Breeze requires
  entity property names on the wire to match the CLR names in the metadata (the client converts them
  with `NamingConvention.camelCase`). Anything else MVC serialises therefore goes out in PascalCase
  by default. Breeze's own traffic is unaffected either way — `processAnonType` in the client applies
  the naming convention to non-entity results too, which is why the `StaffingResourceListItems`
  projection needs no attribute. But a DTO read with a plain `HttpClient`, as the account endpoints
  are, will silently hand you `undefined` for every property. See the comment above the DTOs in
  `AccountController.cs`.

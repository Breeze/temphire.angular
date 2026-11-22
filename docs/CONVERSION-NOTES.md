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
| `DomainModel/EntityBase.cs` (`EntityBase`, `AuditEntityBase`) | `server/TempHire.Model/Entities/AuditEntityBase.cs` (`AuditEntityBase` only; the lookups need no base class) + `client/…/model/base-entity.ts` (`BaseEntity`; the audit columns are generated onto each entity that has them) |
| `DomainModel/StaffingResource.cs` | `…/Entities/StaffingResource.cs` + `…/model/staffing-resource.ts` |
| `DomainModel/Address.cs`, `PhoneNumber.cs`, `Rate.cs`, `Skill.cs`, `WorkExperienceItem.cs` | `…/Entities/*.cs` + `…/model/*.ts` |
| `DomainModel/AddressType.cs`, `PhoneNumberType.cs`, `RateType.cs`, `State.cs` | `…/Entities/*.cs` + `…/model/address-type.ts` etc. (generated, no hand-written code) |
| `DomainModel/Projections/StaffingResourceListItem.cs` | `…/Projections/StaffingResourceListItem.cs` + `client/…/projections/staffing-resource-list-item.ts` |
| `DomainModel/TempHireDbContext.cs` (EF6) | `…/TempHireDbContext.cs` (EF Core 10, fluent config) |
| `DomainModel/TempHireEntities.cs` (`EntityManager` subclass) | *gone* — the EntityManager is a client concept now |
| `DomainModel/TempHireEntities.ibmmx` (IdeaBlade model file) | *gone* — metadata is generated from the EF Core model at `GET /api/breeze/Metadata`, and exported to `client/metadata.json`, from which `breeze-gen-entities` (`npm run model`) writes the client classes |
| `DomainModel/SaveInterceptor.cs` | `server/TempHire.Server/Persistence/TempHirePersistenceManager.cs` |
| `Security/User.cs`, `LoginManager.cs`, `CryptoHelper.cs` | ASP.NET Core Identity: `…/Identity/TempHireUser.cs` + OAuth 2.1 with OpenIddict: `Controllers/SignInController.cs` (sign-in page), `Controllers/AuthorizationController.cs` + `Auth/TokenClaims.cs` (tokens) + `Auth/TenantResolver.cs` |
| `Security/SecurityDbContext.cs` | `…/Identity/TempHireIdentityDbContext.cs` (the `TempHireIdentity` database) |
| `DomainServices/SampleData/*.cs` | `…/SampleData/SampleDataProvider.cs` |

### DevForce / Punch attributes

| Attribute | Replacement |
|---|---|
| `[ProvideEntityAspect]` | Breeze attaches `entityAspect` at runtime when the type is registered with the `MetadataStore` |
| `[DataContract(IsReference = true)]` | Json.NET with `TypeNameHandling.Objects` + `$id`/`$ref`, configured by `JsonSerializationFns.UpdateWithDefaults` |
| `[RequiresAuthentication]` on `EntityBase` | `[Authorize]` on `BreezeController` |
| `[ClientCanSave(true)]` on `AuditEntityBase` + `DefaultAuthorization = false` | `TempHirePersistenceManager.BeforeSaveEntity` rejects anything that is not an `AuditEntityBase`. Same effect: the four lookup types are read-only to the client |
| `[ClientCanQuery(false)]` on `User` | `User` is not exposed by any controller and lives in a separate DbContext, so it never reaches the client metadata |
| `[ConcurrencyStrategy(ConcurrencyStrategy.AutoIncrement)]` | `[ConcurrencyCheck]` on `RowVersion`; incremented in `BeforeSaveEntitiesAsync` |
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
| `IDialogManager`, `DialogResult`, `DialogButtons` | `dialog.service.ts` + `core/dialogs/message-box.component.ts` | Cancellation still surfaces as a thrown error (`DialogCancelledError`) so the ported control flow reads like the original's `catch (TaskCanceledException)`. Optimus UI's two-button `p-confirmDialog` cannot express Yes/No/Cancel, so the buttons are data |
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
| `LoginViewModel` + `LoginView.Wpf.xaml` | The server's sign-in page, `Views/SignIn/Login.cshtml` (OAuth: the client never sees the password); the client keeps `auth-callback/auth-callback.component.ts` |
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

1. **After a save, the shared cache is dropped**, by `SaveHandler` after every successful commit,
   so no workspace has to remember it.  The save happened in the sandbox, so the shared manager still holds the children it loaded
   earlier — including any that were just deleted. A Breeze query merge never detaches entities the
   server omitted, so re-querying would not remove them; the cache has to be cleared and re-seeded.
2. **A sandbox is released once it is clean** (`releaseIfClean`), mirroring Punch's automatic
   eviction, so a cancelled edit does not leak its `EntityManager` for the rest of the session.

---

## 4. Deliberate behavioural changes

Everything below is a conscious departure from the original.

**Security**

- *Users and passwords.* The original kept its own user table and AES-encrypted the password with a
  key derived from the password itself, "authenticating" by decrypting and comparing — reversible,
  and not acceptable today. Users now live in **ASP.NET Core Identity**, in a database of their own
  (`TempHireIdentity`): Identity stores salted PBKDF2 hashes, and `SignInManager` checks passwords
  and locks an account for five minutes after five failed attempts. The `Admin` user is gone: users
  sign in with an email address, whose domain picks their company (see [Multi-tenancy](https://github.com/Breeze/temphire.server#multi-tenancy) in the
  server's README), and the seeded users share the password `password`. Identity also keeps external logins,
  so a provider such as Microsoft Entra ID can be added later (see [Users and sign-in](https://github.com/Breeze/temphire.server#users-and-sign-in) in the
  server's README).
- *Session.* OAuth 2.1 replaces the DevForce server session: the server is its own authorization
  server (OpenIddict), and the app signs in with the Authorization Code flow and PKCE.  The access
  token (30 minutes) and refresh token live in `sessionStorage`; `auth.interceptor.ts` attaches the
  access token and `AuthService` renews it.  An access token cannot be revoked before it expires.
  See [Users and sign-in](https://github.com/Breeze/temphire.server#users-and-sign-in) in the server's README.
- *Metadata requires authentication*, matching `[RequiresAuthentication]` on the DevForce
  `EntityBase`. This is why `AuthService.completeSignIn` calls `EntityManagerProvider.prepare()`
  as soon as it has the tokens — the same place `LoginViewModel` called `IGlobalCache.LoadAsync()`.

**UI**

- *Login is a page on the server, not a modal.* The WPF shell popped a modal on load and after
  logout; here `authGuard` sends the browser to the server's sign-in page and back, and a browser
  refresh keeps the session.
- *Selection debounce removed.* `ResourceMgtViewModel` debounced grid selection with a 200 ms
  `DispatcherTimer` because the WPF `DataGrid` fires `SelectionChanged` during keyboard navigation.
  Optimus UI raises it once per click, so the timer is gone.
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
  whole graph. Neither Breeze nor EF Core validates on save, so `TempHirePersistenceManager` does it
  in `BeforeSaveEntitiesAsync` (saves are asynchronous, so validation rules can be), where it gets the whole change set at once, through the validation metadata
  (`Validation/validation.metadata.json`): its global `breeze` validator runs each entity's data
  annotations, and its other rules replaced the entities' `Validate` methods and the hand-written
  cross-entity check. The rules see the database as it will be after the save (`SaveValidationStore`): the rows
  stored now, read without tracking, minus what the save deletes or moves away, plus what it adds or
  moves in. Nothing is hung on the entities' navigation properties; Breeze attaches a modified entity
  with `DbContext.Add`, which would take any rows found there for new ones. The resources whose
  children the save changes are validated too, so deleting a resource's last address is caught
  even when the resource itself is not in the save. The client checks the same metadata first.

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
- **Signal Forms and Optimus UI.** `[formField]` passes the field's `invalid` state to Optimus UI's
  `pInputText`, which shows its red border at once, and binding `[invalid]` yourself next to
  `[formField]` is a compile error (NG8022).  `app.config.ts` therefore adds a
  `signal-form-untouched` class through `provideSignalFormsConfig`, and `styles.css` holds back the
  invalid border on those fields until they have been touched.  Entity fields follow the library's
  error visibility instead (`provideErrorVisibility` in `ResourceMgtComponent`): a loaded entity's
  errors show at once, a new entity's first errors once the user edits or leaves the field, or
  tries to save.
- **Adding an editable entity field** means binding it with `name="property"` and `[(ngModel)]`
  inside an `ngForm [validationModel]="entity"` element, plus `#field="fieldErrors"
  [invalid]="field.invalid()"`, in a component that imports `ValidationFormsDirectives` and
  `FieldErrorsDirective`.  Without them the field still works, but its errors reach neither the
  form nor Optimus UI.  Validation rules belong on the
  server - a data annotation on the entity, or a rule in `Validation/validation.metadata.json` -
  not in the form.
- **One `MetadataStore` for the page.** Breeze binds each registered entity class to a single
  store, so `EntityManagerProvider` keeps one store across logout and login and registers the
  classes once.  Creating a new store per login made the second login in a page fail.
- **Adding a detail tab** means editing `resource-detail.component.ts`, and adding the tab to
  `RESOURCE_TABS` in `resource-tabs.ts` with the entity types whose errors it shows, so that it
  is marked when they have errors.  The original got the tab for free from MEF's
  `[ImportMany] IEnumerable<IStaffingResourceDetailSection>` ordered by `Index`.
- **Adding a workspace** means adding a route in `app.routes.ts` and an entry in `WORKSPACES`.
  If it saves, it saves through `SaveHandler`: `save(unitOfWork, validation, options)` with its
  validation scope and error visibility, or `commit(unitOfWork)` for a deletion, which isn't
  validated.  The handler decides on the data as it is when Save is clicked, shows every error and
  says why nothing was saved, and drops the shared cache after a save.  Don't call
  `unitOfWork.commit()` yourself, and don't decide on the continuous `validateEntityStore()`
  result; it lags an edit by a moment.
- **Adding an entity type** means: POCO + `DbSet` on the server, a `[HttpGet]` action returning
  `IQueryable<T>` on `BreezeController`, then `npm run model` in `client/` to export the metadata
  and generate the TypeScript class (registration is generated too), and a repository on
  `ResourceMgtUnitOfWork` (`this.createRepository(MyEntity)`). Repositories query the entity
  type's `defaultResourceName` from the metadata, which is the `DbSet` name, so the controller
  action must be named after the `DbSet`.  Place the type in `TAB_OF_ENTITY_TYPE`
  (`resource-mgt/resource-tabs.ts`) too: `resource-tabs.spec.ts` fails until it is.
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

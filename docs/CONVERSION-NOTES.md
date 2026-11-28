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
the EF Core model and publishes them in the metadata as validators. The validation rules are not
written twice either: see **d**.

**b. There is no lazy loading.** DevForce's `RelatedEntityList<T>` faulted child collections in on
first access, which is why the WPF view models had `IsPending` flags and
`PendingEntityListResolved` events. Breeze has no equivalent, so the detail screen eager-loads
everything it needs with a single `expand`
(`StaffingResourceRepository.withId`). The `IsPending` flags are gone; `IsEmpty` survives.

**c. Queries travel as JSON, not expression trees.** The client still writes
`EntityQuery.from(StaffingResource).where(...)`, but `[BreezeQueryFilter]` applies it server-side
to an `IQueryable<T>`. Where the original composed a LINQ predicate on the client and shipped it
(`StaffingResourceSearchService.Simple`), the predicate now lives in
`ResourceMgtController.StaffingResourceListItems` and the client passes a search string.

**d. The rules become data, read by both tiers.** In the original, the rules were spread over
several places, and none of them listed them all:

- the verifiers DevForce generated from the model's attributes (required, string lengths);
- `StaffingResource.Validate`, which wanted at least one address and one phone number;
- `SaveInterceptor.ValidateSave`, which rebuilt the graph to run those checks on save;
- the views, which enforced rules by not letting the user break them: a new resource always got an
  address and a phone number, the last one couldn't be deleted, and a masked editor kept a rate
  from going negative.

DevForce's shared assembly ran the entity rules on both tiers. Without it, every rule would have to
be written twice, in C# for the server and in TypeScript for the client, and the copies would drift.
Instead they are declarations in one file, `server/TempHire.Server/Validation/validation.metadata.json`,
which IdeaBlade Validation reads on both tiers: the client checks them as the user edits, the
server checks them again on every save. The data annotations join them through the global
`breeze` validator. So the file is also the one place to read what the rules *are*, and to change
them: a rule added there runs in both clients and on the server at once. The rules the original
enforced invisibly are now visible errors, and the conversion added the ones it lacked: U.S.
addresses and phone numbers, a rate that isn't negative, 18 or older when hired, and a plausible
date of birth. A test (`SampleDataTests` on the server) validates all the sample data with them.

This matters most for an application that was never client/server. A desktop application that
talks to its database directly keeps all its rules in the client. On the web the server has to
enforce them, because a hand-made request skips the client; without one set of rules that both
tiers read, every rule of the desktop application would be written twice.

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
| `DomainModel/TempHireEntities.ibmmx` (IdeaBlade model file) | *gone* — metadata is generated from the EF Core model at `GET /api/model/Metadata`, and exported to `client/metadata.json`, from which `breeze-gen-entities` (`npm run model`) writes the client classes |
| `DomainModel/SaveInterceptor.cs` | `server/TempHire.Server/Persistence/TempHirePersistenceManager.cs` |
| `Security/User.cs`, `LoginManager.cs`, `CryptoHelper.cs` | ASP.NET Core Identity: `…/Identity/TempHireUser.cs` + OAuth 2.1 with OpenIddict: `Controllers/SignInController.cs` (sign-in page), `Controllers/AuthorizationController.cs` + `Auth/TokenClaims.cs` (tokens) + `Auth/TenantResolver.cs` |
| `Security/SecurityDbContext.cs` | `…/Identity/TempHireIdentityDbContext.cs` (the `TempHireIdentity` database) |
| `DomainServices/SampleData/*.cs` | `…/SampleData/SampleDataProvider.cs` |

### DevForce / Punch attributes

| Attribute | Replacement |
|---|---|
| `[ProvideEntityAspect]` | Breeze attaches `entityAspect` at runtime when the type is registered with the `MetadataStore` |
| `[DataContract(IsReference = true)]` | Json.NET with `TypeNameHandling.Objects` + `$id`/`$ref`, configured by `JsonSerializationFns.UpdateWithDefaults` |
| `[RequiresAuthentication]` on `EntityBase` | `[Authorize]` on the Breeze controllers (`ModelController`, `LookupsController`, `ResourceMgtController`) |
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
| `IUnitOfWorkManager<T>` / `UnitOfWorkManager<T>` | `unit-of-work-manager.ts` | `UnitOfWorkManager<T extends UnitOfWork>`, a keyed cache: `Guid.Empty` → `SHARED_UNIT_OF_WORK_KEY`.  Generic as in the original, so each workspace has a manager for its own unit of work.  Its units of work announce their saves as events (`EventAggregator`), and every manager reacts to the saves and to sign-out in an `effect` of its own: it drops its shared cache, or forgets every unit of work.  Nothing calls a manager for either |
| `ResourceMgtUnitOfWorkManager` | `resource-mgt-unit-of-work-manager.ts` | `UnitOfWorkManager<ResourceMgtUnitOfWork>`, the one the Resource Management screens inject.  A new workspace gets one like it |
| `IRepository<T>` | `repository.ts` | |
| `StaffingResourceRepository` | `staffing-resource-repository.ts` | A subclass of the generic repository whose `withId` loads a resource with all of its children, as the original's `GetKeyQuery` included its addresses and phone numbers. Every caller gets a complete resource |
| `IStaffingResourceSearchService` / `StaffingResourceSearchService` | `staffing-resource-search-service.ts`, the unit of work's `search` | `simple(text)`; the predicate now lives on the server |
| `IFactory<T>` / `StaffingResourceFactory` | `IEntityFactory` / `EntityFactory` in `unit-of-work.ts`; `createFactory(StaffingResource)` in `resource-mgt-unit-of-work.ts` | The original factory also added a default address and phone number; a new resource now starts without them, so the generic factory is all it needs |
| `IDialogManager`, `DialogResult`, `DialogButtons` | `dialog.service.ts` + `core/dialogs/message-box.component.ts` | Every dialog returns what the user chose: a message box its button's `DialogResult` (closing it counts as its cancel answer), a component dialog its result or `undefined`. The first port kept Punch's shape, where cancelling rejected the task with `TaskCanceledException`, as a thrown `DialogCancelledError`; every caller then needed a try/catch, and real failures were reported by hand. Cancelling is an answer, not an error. Optimus UI's two-button `p-confirmDialog` cannot express Yes/No/Cancel, so the buttons are data |
| `IBusyWatcher` / `Busy.GetTicket()` | `busy.service.ts` — `await busy.run(promise)` | |
| `IToolbarManager`, `ToolbarAction`, `ToolbarGroup` | `toolbar.service.ts` | `CanExecute` was found by reflecting for a `Can<Method>` property; it is now an explicit `canExecute` thunk reading signals |
| `IAuthenticationService`, `LoggedInMessage`, `LoggedOutMessage` | `auth.service.ts` (+ `auth.interceptor.ts`, `auth.guard.ts`) | For the UI, the two messages become one `isLoggedIn` signal.  `LoggedOutMessage` is also an event (`EventAggregator.lastLogout`), on which every unit-of-work manager forgets its units of work |
| `INavigator` | Angular router (`app.routes.ts`) | |
| `IErrorHandler`, `ValidationErrorHandler` | `error-handler.service.ts` | Angular's global `ErrorHandler`. `provideBrowserGlobalErrorListeners()` passes it window errors and unhandled rejections, so a command that fails (called from a click) is reported without a try/catch in the component. A component catches only an error it acts on, such as rolling back a failed delete |
| `IWorkspace` (`[ImportMany]` via MEF) | `WORKSPACES` array in `app.routes.ts` | Angular has no ambient discovery; the list is explicit |
| `IEventAggregator`, `IMessageProcessor`, `EntityChangedMessage`, `SavedMessage` | `event-aggregator.ts`; `UnitOfWork.changes` / `UnitOfWork.hasChanges` signals | The event aggregator stays, for the app-wide messages: an event is a signal holding its latest occurrence (`lastSave`, `lastLogout`), set by a notification method (`saved`, `loggedOut`), and `IHandle<T>` becomes reading the signal.  The search list's `resource()` reads `lastSave`, so it reloads after a save in any workspace, and every unit-of-work manager reads it in an `effect`.  `EntityChangedMessage`, which concerned one unit of work, becomes a counter signal on it, bumped from the manager's `entityChanged` event |

### Screens

| Original view model + view | Converted |
|---|---|
| `ShellViewModel` + `ShellView.Wpf.xaml` | `app.ts` / `app.html` |
| `LoginViewModel` + `LoginView.Wpf.xaml` | The server's sign-in page, `Views/SignIn/Login.cshtml` (OAuth: the client never sees the password); the client keeps `auth-callback/auth-callback.component.*` |
| `HomeViewModel` + `HomeView.xaml` | `home/home.component.*` |
| `ResourceMgtViewModel` + `ResourceMgtView.xaml` | `resource-mgt/resource-mgt.component.*` |
| `StaffingResourceSearchViewModel` + view | `resource-mgt/resource-search.component.*` |
| `StaffingResourceDetailViewModel` + view | `resource-mgt/resource-detail.component.*` (+ loading logic hoisted into `resource-mgt.component.*`) |
| `StaffingResourceSummaryViewModel` + view | `resource-mgt/resource-summary.component.*` |
| `StaffingResourceContactInfoViewModel` + view | `resource-mgt/sections/resource-contact-info.component.*` |
| `StaffingResourceAddressListViewModel` + view | `sections/resource-address-list.component.*` |
| `StaffingResourceAddressItemViewModel` (one address) | `sections/resource-address.component.*`, one card per address |
| `StaffingResourcePhoneListViewModel` + view | `sections/resource-phone-list.component.*` |
| `StaffingResourcePhoneItemViewModel` (one phone number) | `sections/resource-phone.component.*`, one card per phone number |
| `StaffingResourceRatesViewModel` + view | `sections/resource-rates.component.*` |
| `StaffingResourceWorkExperienceViewModel` + view | `sections/resource-work-experience.component.*` |
| `StaffingResourceSkillsViewModel` + view | `sections/resource-skills.component.*` |
| `StaffingResourceNameEditorViewModel` + view | `resource-mgt/resource-name-editor.component.*` |
| `ItemSelectorViewModel` + view | `resource-mgt/item-selector.component.*` |
| `Harness` project (Punch development harness) | Not ported — `ng serve` with hot reload covers what it was for |
| `TempHire.SL`, `*.SL` projects (Silverlight) | Not ported — Silverlight is dead, and the browser is now the only target |

---

## 3. The part worth understanding: sandbox editing

This is the architectural idea TempHire exists to demonstrate, and it survives intact.

Each workspace's unit-of-work manager (`ResourceMgtUnitOfWorkManager` here, a `UnitOfWorkManager<T>`) keys its units of work by id:

- **`SHARED_UNIT_OF_WORK_KEY`** (`Guid.Empty` in the original) — one long-lived unit of work that
  every read-only screen shares. The search list and the view-mode detail read from it, so they see
  the same entity instances and stay in sync for free.
- **`<resourceId>`** — a *sandbox*, created when you press Edit or Add. It owns a separate
  `EntityManager`, so the edits are invisible to everything else on screen and `Cancel` is one
  `rejectChanges()` with no side effects.

Breeze keeps an entity Modified once a property has changed, even when the user types the old value
back.  The unit of work watches its manager's property changes and returns such an entity to
Unchanged once `entityAspect.getChangedProperties()` is empty (Breeze compares dates by time, and
complex and array properties by content).  Each entity is judged on its own: a resource whose fields
are back to their originals is Unchanged while an edited address still keeps `hasChanges` true.

`ResourceMgtComponent.loadDetail` picks the key from the edit mode, exactly as
`StaffingResourceDetailViewModel.UnitOfWork` did:

```ts
const key = editMode === 'view' ? SHARED_UNIT_OF_WORK_KEY : id;
```

Two consequences are worth calling out because they are not obvious:

1. **After a save, the shared cache is dropped**, by every manager when its saved event comes
   (`EventAggregator.lastSave`), so no workspace has to remember it.  The save happened in the sandbox, so the shared manager still holds the children it loaded
   earlier — including any that were just deleted. A Breeze query merge never detaches entities the
   server omitted, so re-querying would not remove them; the cache has to be cleared and re-seeded.
2. **The manager holds its units of work weakly**, as Punch's did (Cocktail's `ObjectManager`
   kept them in a `WeakRefDictionary`): `WeakRef`s, with a `FinalizationRegistry` that removes the
   keys of collected ones.  A sandbox lives as long as the screen holds it; after a save or a
   cancel nothing does, and the garbage collector takes it with its `EntityManager`, with no code to
   release it.  The first port evicted sandboxes by hand (`releaseIfClean`, called from three
   places); a missed call would have leaked a manager for the rest of the session.

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
- *A phone number is one field.* The original had an area code field and a number field. The
  number now takes the whole U.S. number in any of the common formats, and a valid one is
  rewritten as `(206) 555-1234` when the user leaves the field (`formatPhoneNumber` in
  `core/model/phone-number.ts`).
- *An unsaved-changes prompt now guards route exit* (`pendingChangesGuard`), covering what
  `IScreen.CanClose` + `OnNavigatingFrom` did when the shell switched workspaces.

**Server**

- *`Rate.Amount` gained a non-negative validator.* The WPF view enforced this through a masked
  numeric editor; expressing it as a model rule is strictly better.
- *The search projection composes `FullName` in SQL.* It was a calculated property on the DTO
  before. Doing it in the projection means the database can sort and filter on it. `PhoneNumber` is
  the primary phone's `Number` as stored, now that the area code is part of it.
- *`PhoneNumber.AreaCode` is folded into `Number`* (migration `PhoneNumberInOneField`), which
  widens to 20 characters for the formats the rule accepts. Existing numbers become
  `(206) 555-1234`.
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
- **Adding a validation rule** means a rule in `Validation/validation.metadata.json`: a built-in
  validator where one fits (`range`, `pattern`, `date`, ...), an `expression` otherwise, and a
  validator registered on both tiers for what neither can state.  It then runs in both clients and
  on the server, with no code.  Test it in `server-rules.spec.ts` (the client) and
  `SaveRulesTests` (the server); `SampleDataTests` fails if the sample data breaks it.
- **One `MetadataStore` for the page.** Breeze binds each registered entity class to a single
  store, so `EntityManagerProvider` keeps one store across logout and login and registers the
  classes once.  Creating a new store per login made the second login in a page fail.
- **Adding a detail tab** means editing `resource-detail.component.ts`, and adding the tab to
  `RESOURCE_TABS` in `resource-tabs.ts` with the entity types whose errors it shows, so that it
  is marked when they have errors.  The original got the tab for free from MEF's
  `[ImportMany] IEnumerable<IStaffingResourceDetailSection>` ordered by `Index`.
- **Adding a workspace** means adding a route in `app.routes.ts` and an entry in `WORKSPACES`.
  If it saves, it saves through `SaveHandler`: `save(unitOfWork, validation, options)` with its
  validation scope and error visibility.  The handler decides on the data as it is when Save is
  clicked, and shows every error and says why nothing was saved.  Only a commit that isn't
  validated, a deletion, calls `unitOfWork.commit()` directly.  Don't decide on the continuous
  `validateEntityStore()` result; it lags an edit by a moment.  What follows every save - dropping
  the shared caches, reloading the search list - comes from the saved event, so a new workspace's
  manager does it with no code of its own.
- **Never reach for the `EntityManager`.** Components and services work with data only through
  the unit of work: its repositories (queries and loads), factories (new entities), services
  (searches and other queries) and `commit()` / `rollback()`, and the validation entity store.
  The manager is the unit of work's own (`protected`), created by `EntityManagerProvider`.  If a
  screen needs something none of them offers, add it to the unit of work as one of those parts;
  don't expose the manager.  The conversion had an `entityManager` getter on
  `ResourceMgtUnitOfWork` "so the detail screens can create entities directly"; nothing ever used
  it, and it is gone.  An entity's own methods (`StaffingResource.addAddress`, `delete`) are the
  one exception: like the original's, they create and delete their children through their own
  `entityAspect`.
- **One controller per workspace.** Each workspace's unit of work queries and saves through its
  own controller on the server (`ResourceMgtUnitOfWork` → `ResourceMgtController`, `api/resourcemgt`),
  passed to the unit of work as a Breeze `DataService`. What every workspace needs has a controller
  of its own: the model's metadata (`ModelController`) and the lookups loaded at sign-in
  (`LookupsController`, whose `AllTypes` returns every lookup table in one bundle). A new workspace
  gets a new controller and data service; a lookup only one workspace uses goes in that
  workspace's controller, not in `AllTypes`.
- **Adding an entity type** means: POCO + `DbSet` on the server, a `[HttpGet]` action returning
  `IQueryable<T>` on the controller of the workspace that uses it, then `npm run model` in
  `client/` to export the metadata and generate the TypeScript class (registration is generated
  too), and a repository on that workspace's unit of work (`this.createRepository(MyEntity)`). If
  loading the entity should bring related entities with it, subclass `Repository` and override
  `withId`, as `StaffingResourceRepository` does, so no caller has to know what to expand.
  Repositories query the entity type's `defaultResourceName` from the metadata, which is the
  `DbSet` name, so the controller action must be named after the `DbSet`.  Place the type in
  `TAB_OF_ENTITY_TYPE` (`resource-mgt/resource-tabs.ts`) too: `resource-tabs.spec.ts` fails until
  it is.
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

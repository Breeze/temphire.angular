# Entity classes

The classes in this folder are maintained by `breeze-gen-entities`, the entity generator that ships
with `breeze-client`. Regenerate them from `client/`:

```bash
npm run model            # export metadata from the server, then generate
npm run model:generate   # generate from the checked-in metadata.json only
```

## Who owns what

| File | Owner |
|---|---|
| `index.ts` | The generator, whole file. Never edit it. |
| `base-entity.ts` | You. The generator names it as the base class (`--base BaseEntity`) but never writes it. |
| every other `*.ts` | Shared: lines ending in `// @generated` belong to the generator, everything else to you. |

In a shared file, the generator owns every property the server metadata knows about. It rewrites
those declarations in place, appends new ones, and removes a `// @generated` line whose column has
left the schema. Constructors, getters, methods, comments and imports you wrote are never touched,
which is why `StaffingResource.addAddress` and `Address.root` survive a regeneration.

Mapped properties are written with `declare`. Keep it if you edit one by hand: without it, an ES2022
class field becomes an own property set to `undefined` that hides the accessor Breeze installs on
the prototype.

## Keeping something away from the generator

```ts
declare middleName: string | null; // @manual           one declaration is yours

// @manual-start                                         everything until @manual-end is yours
// @manual-end

// @manual-file                                          on a line of its own: the whole file is yours
```

Deleting a `// @generated` marker does not make a mapped property yours: the metadata still names
it, so the next run claims it back. Use `// @manual` instead.

## Registration

`registerModelClasses` in `index.ts` binds every class to a `MetadataStore`. TempHire calls it once,
in `core/model-registration.ts`, on the master manager's store; every other manager shares that
store through `createEmptyCopy()`. A class can only be registered with one store.

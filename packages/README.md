# Local packages

A build of [ideablade-validation](https://github.com/Breeze/ideablade-validation) that the client
uses until the library is published to npm:

- `ideablade-validation-0.1.0-preview.8.tgz` - the client's `@ideablade/validation`, a `file:`
  dependency in `client/package.json`.

The server takes the matching NuGet package, `IdeaBlade.Validation`, from its own `packages`
folder (`server/packages/`, in the [temphire.server](https://github.com/Breeze/temphire.server)
submodule).

**Updating it.**  Build it from the library with a new prerelease version - never the same version
twice, so the server's NuGet package and this one keep matching versions:

```
cd ideablade-validation/js
npm run build
npm version 0.1.0-preview.9 --no-git-tag-version
npm pack --pack-destination <this folder>
git checkout -- package.json package-lock.json
```

Then delete the old file here, change the version in `client/package.json`, and run `npm install`
in `client`.  Update the server's package to the same version at the same time (see
`server/packages/README.md`).

**Once the library is published**, delete this folder and reference the published version instead.

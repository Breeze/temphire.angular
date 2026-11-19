# Local packages

Builds of [ideablade-validation](https://github.com/Breeze/ideablade-validation) that TempHire uses
until the library is published to npm and NuGet:

- `IdeaBlade.Validation.0.1.0-preview.2.nupkg` - the server's `IdeaBlade.Validation` package, found
  through the `local` source in `nuget.config`;
- `ideablade-validation-0.1.0-preview.2.tgz` - the client's `@ideablade/validation`, a `file:`
  dependency in `client/package.json`.

**Updating them.**  Build them from the library with a new prerelease version - never the same
version twice: NuGet caches a package by id and version (`~/.nuget/packages`) and would keep using
the old one.

```
cd ideablade-validation/js
npm run build
npm version 0.1.0-preview.2 --no-git-tag-version
npm pack --pack-destination <this folder>
git checkout -- package.json package-lock.json

cd ../dotnet/src/IdeaBlade.Validation
dotnet pack -c Release -p:Version=0.1.0-preview.2 -o <this folder>
```

Then delete the old files here, change the version in `server/TempHire.Server/TempHire.Server.csproj`
and `client/package.json`, and run `npm install` in `client`.

**Once the library is published**, delete this folder and the `local` source in `nuget.config`,
and reference the published versions instead.

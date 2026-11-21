# TempHire in Docker

Runs TempHire, Angular client and server in one image, next to SQL Server, with Docker Compose:

```
https://localhost:8443  ──►  app  (TempHire.Server, serving the Angular build)  ──►  sql  (SQL Server 2022)
                               │
                               └──► Ollama on this machine (host.docker.internal:11434), or Claude
```

It runs the server the way it would run anywhere real: in the **Production** environment, over
**HTTPS**, with OpenIddict's keys from certificate files and the databases in their own container.
It is still a local setup: SQL Server's Developer edition, the ASP.NET Core development certificate
for HTTPS, and secrets in a `.env` file.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/), running Linux containers.
- The .NET SDK (for `dotnet dev-certs`), and a trusted ASP.NET Core development certificate:
  `dotnet dev-certs https --check --trust` says so; `dotnet dev-certs https --trust` creates one.
- For Quinn: Ollama running on this machine with `qwen3:4b-instruct` (as for the normal setup), or
  an Anthropic API key.

## Running it

From the repository root, in PowerShell:

```powershell
.\docker\New-TempHireSecrets.ps1
docker compose up --build -d
```

Then open <https://localhost:8443> and sign in as one of the sample users, for example
`anna@harbor.test` with the password `password`.  The sign-in page doesn't list them: that's for
Development only.

The first start takes a minute: SQL Server initializes, then the server creates and seeds both
databases.  `docker compose logs -f app` shows it.

## What the script creates

`New-TempHireSecrets.ps1` writes what the repository doesn't hold; neither is committed:

| File | What |
|---|---|
| `.env` | The SQL Server `sa` password, the certificate passwords, and `QUINN_PROVIDER` |
| `docker/certs/https.pfx` | The ASP.NET Core development certificate (`CN=localhost`), for HTTPS; Windows trusts it, so the browser does |
| `docker/certs/trusted/localhost.crt` | Its public part, so the container trusts it too (see below) |
| `docker/certs/signing.pfx`, `encryption.pfx` | Self-signed keys for OpenIddict's tokens (the server's `OAuthCertificates`) |

It keeps what exists; `-Force` recreates the certificates.  A new signing key invalidates every
token, so everyone signs in again.

**Why the container trusts the development certificate.**  Quinn calls the server's own `/mcp`
endpoint at `https://localhost:8443` from inside the container, where Windows' certificate trust
doesn't reach.  `SSL_CERT_DIR` in `compose.yaml` adds `docker/certs/trusted` to the system's CAs.
With a certificate from a public CA, drop that line.

## Quinn

- **Ollama** (the default): the container reaches Ollama on Windows at `host.docker.internal`.
- **Claude**: add these two lines to `.env` and run `docker compose up -d` again:

  ```
  QUINN_PROVIDER=Claude
  CLAUDE_API_KEY=<your key>
  ```

  The container doesn't see the server's user secrets, so the key has to be in `.env` (which is not
  committed).  Quinn's budgets apply as usual.

## Data, stopping and starting over

- The databases live in the `sqldata` volume and survive `docker compose down` and rebuilds.
- ASP.NET Core's data protection keys (the sign-in cookie, antiforgery) live in the
  `dataprotection` volume, so a restart doesn't sign everyone out of the sign-in page.
- `docker compose stop` stops both containers; `docker compose start` starts them again.
- `docker compose down` removes the containers; `docker compose down -v` also deletes the volumes,
  databases included, so the next start seeds them afresh.
- After changing the code, `docker compose up --build -d` rebuilds the image and replaces the app
  container.

## Taking it further

This is a production-*like* setup, not a production deployment.  For one:

- Use a certificate from a real CA for HTTPS, and drop `SSL_CERT_DIR`.
- Keep the certificates and passwords in a secret store (Azure Key Vault, Docker secrets), not in
  `.env` and a folder.
- Use a SQL Server edition licensed for production, or Azure SQL; set `ConnectionStrings__*`.
- Set `OAuth__Origins__0` to the public address; behind a proxy that terminates TLS, see the
  server's README on origins and forwarded headers.

# syntax=docker/dockerfile:1
#
# TempHire, Angular client: one image with the server and the client it serves.
#   1. Node builds the client (production configuration: same-origin API, no dev server).
#   2. The .NET SDK publishes the server (the server/ submodule).
#   3. The ASP.NET Core runtime image runs the server, with the client in its wwwroot.
# compose.yaml runs it next to SQL Server; see docker/README.md.

# ---- 1. The client ------------------------------------------------------------------------------
FROM node:26.13.0-slim AS client
WORKDIR /src
# The validation library comes from packages/ until it is published (see packages/README.md).
COPY packages/ packages/
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci --no-audit --no-fund
COPY client/ client/
RUN cd client && npm run build

# ---- 2. The server ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src/server
COPY server/ ./
# server/nuget.config maps IdeaBlade.* to server/packages and everything else to nuget.org.
RUN dotnet publish TempHire.Server/TempHire.Server.csproj -c Release -o /app

# ---- 3. The runtime -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=server /app ./
COPY --from=client /src/client/dist/temphire-client/browser ./wwwroot

# ASP.NET Core keeps its data protection keys (sign-in cookie, antiforgery) here; compose mounts a
# volume on it so they survive a restart.  Created now so the volume belongs to the app user.
RUN mkdir -p /home/app/.aspnet/DataProtection-Keys && chown -R app:app /home/app/.aspnet

USER app
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=https://+:8443
EXPOSE 8443
ENTRYPOINT ["dotnet", "TempHire.Server.dll"]

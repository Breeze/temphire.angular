<#
.SYNOPSIS
    Creates what compose.yaml needs and the repository doesn't hold: .env with passwords, and the
    certificates in docker/certs.

.DESCRIPTION
    - .env (in the repository root): the SQL Server sa password, the certificate passwords, and
      Quinn's provider.  Kept if it exists; delete it to start over.
    - docker/certs/https.pfx: the ASP.NET Core development certificate (CN=localhost), which
      Windows trusts once `dotnet dev-certs https --trust` has run, so the browser accepts
      https://localhost:8443.
    - docker/certs/signing.pfx and encryption.pfx: self-signed keys for OpenIddict's tokens.

    Neither .env nor docker/certs is committed.  The Claude API key is not handled here: to use
    Claude in the container, add CLAUDE_API_KEY=... to .env yourself and set QUINN_PROVIDER=Claude.

.PARAMETER Force
    Recreate the certificates even if they exist.  (A new signing key signs out everyone.)
#>
param([switch]$Force)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$certs = Join-Path $PSScriptRoot 'certs'
$envFile = Join-Path $root '.env'
New-Item -ItemType Directory -Force $certs | Out-Null

function New-Password([int]$length = 24) {
    # Letters and digits, plus one of each kind SQL Server's policy wants; no characters that need
    # quoting in a connection string or a .env file.
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $bytes = New-Object byte[] $length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $body = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
    return "Th$body" + '9a'
}

function Read-EnvFile {
    $values = @{}
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { $values[$matches[1]] = $matches[2] }
        }
    }
    return $values
}

# ---- .env ---------------------------------------------------------------------------------------
$values = Read-EnvFile
if (-not (Test-Path $envFile)) {
    @(
        "# TempHire in Docker; created by docker/New-TempHireSecrets.ps1.  Not committed."
        "SQL_SA_PASSWORD=$(New-Password)"
        "HTTPS_CERT_PASSWORD=$(New-Password)"
        "OAUTH_CERT_PASSWORD=$(New-Password)"
        "# Quinn: Ollama (on this machine) or Claude.  For Claude, also add CLAUDE_API_KEY=..."
        "QUINN_PROVIDER=Ollama"
    ) | Set-Content -Encoding ascii $envFile
    Write-Host "Created .env"
    $values = Read-EnvFile
} else {
    Write-Host ".env exists; keeping it"
}

# ---- HTTPS: the development certificate --------------------------------------------------------
$https = Join-Path $certs 'https.pfx'
if ($Force -or -not (Test-Path $https)) {
    dotnet dev-certs https --check --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No ASP.NET Core development certificate yet; creating and trusting one (Windows asks to confirm)."
        dotnet dev-certs https --trust
    }
    dotnet dev-certs https --export-path $https --password $values['HTTPS_CERT_PASSWORD'] --format Pfx
    if ($LASTEXITCODE -ne 0) { throw "dotnet dev-certs couldn't export the certificate." }
    Write-Host "Exported the development certificate to docker/certs/https.pfx"
}

# The same certificate's public part, for the container to trust: Quinn calls the server's own
# /mcp at https://localhost:8443 from inside the container, where Windows' trust doesn't reach.
$trusted = Join-Path $certs 'trusted'
New-Item -ItemType Directory -Force $trusted | Out-Null
$publicCert = Join-Path $trusted 'localhost.crt'
if ($Force -or -not (Test-Path $publicCert)) {
    $pfx = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($https, $values['HTTPS_CERT_PASSWORD'])
    $pem = "-----BEGIN CERTIFICATE-----`n" +
        [Convert]::ToBase64String($pfx.RawData, [Base64FormattingOptions]::InsertLineBreaks).Replace("`r`n", "`n") +
        "`n-----END CERTIFICATE-----`n"
    [System.IO.File]::WriteAllText($publicCert, $pem)
    Write-Host "Wrote its public part to docker/certs/trusted/localhost.crt"
}

# ---- OpenIddict: signing and encryption keys -----------------------------------------------------
function New-OAuthCertificate([string]$path, [string]$subject, $usage) {
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    $request = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
        $subject, $rsa,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $request.CertificateExtensions.Add(
        (New-Object System.Security.Cryptography.X509Certificates.X509KeyUsageExtension($usage, $true)))
    $now = [DateTimeOffset]::UtcNow
    $certificate = $request.CreateSelfSigned($now.AddMinutes(-5), $now.AddYears(2))
    $bytes = $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $values['OAUTH_CERT_PASSWORD'])
    [System.IO.File]::WriteAllBytes($path, $bytes)
}

$usage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]
foreach ($cert in @(
        @{ File = 'signing.pfx'; Subject = 'CN=TempHire OAuth signing'; Usage = $usage::DigitalSignature },
        @{ File = 'encryption.pfx'; Subject = 'CN=TempHire OAuth encryption'; Usage = $usage::KeyEncipherment })) {
    $path = Join-Path $certs $cert.File
    if ($Force -or -not (Test-Path $path)) {
        New-OAuthCertificate $path $cert.Subject $cert.Usage
        Write-Host "Created docker/certs/$($cert.File)"
    }
}

Write-Host "Done.  Next: docker compose up --build"

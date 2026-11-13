<#
.SYNOPSIS
    Stores the Anthropic API key Quinn uses with Claude, in the server's user-secrets store.

.DESCRIPTION
    The key goes into the .NET user-secrets store of TempHire.Server as Agent:Claude:ApiKey: the
    secrets.json file under your user profile that `dotnet user-secrets` manages, outside the
    repository, so it is never committed.  ASP.NET Core reads user secrets in the Development
    environment.

    The key is read without echoing it and written straight to that file, so it appears neither on
    screen nor in a command line or the shell's history.  (Piping it to `dotnet user-secrets` would
    also keep it off the command line, but Windows PowerShell 5.1 adds a byte-order mark to text
    piped to programs, which the tool cannot parse.)

    Restart the server afterwards.

.PARAMETER UseClaude
    Also switch Quinn to Claude (Agent:Provider = Claude in user secrets, which overrides
    appsettings.json on this machine only).

.PARAMETER UseOllama
    Switch Quinn back to the local Ollama model.  The stored key is kept.

.PARAMETER Remove
    Delete the stored key.

.EXAMPLE
    .\Set-ClaudeApiKey.ps1 -UseClaude
#>
[CmdletBinding(DefaultParameterSetName = 'Set')]
param(
    [Parameter(ParameterSetName = 'Set')]
    [switch] $UseClaude,

    [Parameter(ParameterSetName = 'Ollama', Mandatory)]
    [switch] $UseOllama,

    [Parameter(ParameterSetName = 'Remove', Mandatory)]
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'

# The secrets file of TempHire.Server, from the UserSecretsId in its project file.
$projectFile = Join-Path $PSScriptRoot 'TempHire.Server\TempHire.Server.csproj'
$secretsId = ([xml](Get-Content $projectFile -Raw)).Project.PropertyGroup.UserSecretsId |
    Where-Object { $_ } | Select-Object -First 1
if (-not $secretsId) {
    throw "No UserSecretsId in $projectFile."
}

$secretsRoot = if ($env:APPDATA) { Join-Path $env:APPDATA 'Microsoft\UserSecrets' } else { Join-Path $HOME '.microsoft/usersecrets' }
$secretsDir = Join-Path $secretsRoot $secretsId
$secretsFile = Join-Path $secretsDir 'secrets.json'

function Update-Secrets([hashtable] $set = @{}, [string[]] $remove = @()) {
    $secrets = [ordered]@{}
    if (Test-Path $secretsFile) {
        $existing = Get-Content $secretsFile -Raw | ConvertFrom-Json
        if ($existing) {
            foreach ($property in $existing.PSObject.Properties) { $secrets[$property.Name] = $property.Value }
        }
    }

    foreach ($name in $set.Keys) { $secrets[$name] = $set[$name] }
    foreach ($name in $remove) { $secrets.Remove($name) }

    New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
    # UTF-8 without a byte-order mark, like `dotnet user-secrets` writes it.
    [System.IO.File]::WriteAllText($secretsFile, ($secrets | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
}

if ($Remove) {
    Update-Secrets -remove 'Agent:Claude:ApiKey'
    Write-Host 'The Claude API key has been removed.'
    return
}

if ($UseOllama) {
    Update-Secrets -set @{ 'Agent:Provider' = 'Ollama' }
    Write-Host 'Quinn now uses the local Ollama model. Restart the server.'
    return
}

$secure = Read-Host -AsSecureString -Prompt 'Anthropic API key'
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Error 'No key entered; nothing was changed.'
    exit 1
}

$secrets = @{ 'Agent:Claude:ApiKey' = $key }
if ($UseClaude) {
    $secrets['Agent:Provider'] = 'Claude'
}
Update-Secrets -set $secrets

Write-Host 'The Claude API key has been stored in user secrets (Agent:Claude:ApiKey).'
if ($UseClaude) {
    Write-Host 'Quinn now uses Claude on this machine. Restart the server.'
}
else {
    Write-Host 'To use it, run this again with -UseClaude, or set Agent:Provider to "Claude" in appsettings.json. Restart the server.'
}

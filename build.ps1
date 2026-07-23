# Build and deploy Vue project
# Usage:
#   .\build.ps1                          # Build only
#   .\build.ps1 -DeployTarget remote     # Build and deploy using config file
#   .\build.ps1 -DeployTarget remote -RemoteUser root -RemoteHost 43.136.84.124 -RemotePath /var/www/starslipay

param(
    [string]$DeployTarget,
    [string]$RemoteUser,
    [string]$RemoteHost,
    [string]$RemotePath = "/usr/share/nginx/html",
    [string]$ConfigFile = ".deploy.conf"
)

$ErrorActionPreference = "Stop"

function Write-Color {
    param(
        [string]$Text,
        [ConsoleColor]$Color = [ConsoleColor]::White
    )
    $originalColor = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Host $Text
    $Host.UI.RawUI.ForegroundColor = $originalColor
}

function Load-Config {
    param([string]$File)
    
    if (-not (Test-Path $File)) {
        return
    }
    
    Write-Color "  Loading config from $File..." Gray
    try {
        $config = Get-Content $File -Raw | ConvertFrom-Json
        if (-not $RemoteUser -and $config.user) { $script:RemoteUser = $config.user }
        if (-not $RemoteHost -and $config.host) { $script:RemoteHost = $config.host }
        if (-not $RemotePath -and $config.path) { $script:RemotePath = $config.path }
        Write-Color "  OK" Green
    } catch {
        Write-Color "  WARN Failed to load config" Yellow
    }
}

function Check-Node {
    Write-Color "`n[1/4] Checking Node.js..." Cyan
    try {
        node --version | Out-Null
        npm --version | Out-Null
        Write-Color "  OK" Green
    } catch {
        Write-Color "  ERROR Node.js not installed" Red
        exit 1
    }
}

function Build-Project {
    Write-Color "`n[2/4] Building project..." Cyan
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Color "  OK" Green
    } catch {
        Write-Color "  ERROR: $_" Red
        exit 1
    }
}

function Deploy-To-Remote {
    param(
        [string]$User,
        [string]$HostAddr,
        [string]$Path
    )
    
    Write-Color "`n[3/4] Deploying to $User@$HostAddr..." Cyan
    
    if (-not $User -or -not $HostAddr) {
        Write-Color "  ERROR Missing server info" Red
        Write-Color "    Use: .\build.ps1 -DeployTarget remote -RemoteUser root -RemoteHost your-server" Red
        Write-Color "    Or create .deploy.conf with {`"user`":`"root`",`"host`":`"ip`",`"path`":`"/path`"}" Red
        exit 1
    }
    
    $distPath = Join-Path $PWD "dist"
    $remoteDest = "$User@$HostAddr`:$Path"
    
    Write-Color "  Uploading files..." Gray
    scp -r "$distPath/*" $remoteDest
    if ($LASTEXITCODE -ne 0) {
        Write-Color "  ERROR Upload failed" Red
        exit 1
    }
    Write-Color "  OK" Green
    
    Write-Color "`n[4/4] Restarting Nginx..." Cyan
    ssh "$User@$HostAddr" "sudo systemctl restart nginx"
    if ($LASTEXITCODE -ne 0) {
        Write-Color "  WARN Nginx restart failed, try manually" Yellow
    } else {
        Write-Color "  OK" Green
    }
    
    Write-Color "`n  DEPLOYMENT COMPLETE!" Green
    Write-Color "    Access: http://$HostAddr" Green
}

Write-Color "==========================================" Cyan
Write-Color "     starslipay Build Script" Cyan
Write-Color "==========================================" Cyan

Check-Node
Build-Project

if ($DeployTarget -eq "remote") {
    Load-Config -File $ConfigFile
    Deploy-To-Remote -User $RemoteUser -HostAddr $RemoteHost -Path $RemotePath
}

Write-Color ""
Write-Color "==========================================" Cyan
Write-Color "     Done!" Green
Write-Color "==========================================" Cyan
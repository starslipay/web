# 仅构建（生成 dist 目录）
# .\build.ps1
# 构建并部署到远程服务器
# .\build.ps1 -DeployTarget remote -RemoteUser root -RemoteHost 43.136.84.124
# 指定部署路径
# .\build.ps1 -DeployTarget remote -RemoteUser root -RemoteHost 43.136.84.124 -RemotePath /var/www/starslipay
param(
    [string]$DeployTarget,
    [string]$RemoteUser,
    [string]$RemoteHost,
    [string]$RemotePath = "/usr/share/nginx/html"
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

function Check-Node {
    Write-Color "`n[1/5] Checking Node.js environment..." Cyan
    
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Node.js not installed"
        }
        Write-Color "  OK Node.js version: $nodeVersion" Green
        
        $npmVersion = npm --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "npm not installed"
        }
        Write-Color "  OK npm version: $npmVersion" Green
    }
    catch {
        Write-Color "  ERROR: $_" Red
        Write-Color "    Please install Node.js (https://nodejs.org/)" Red
        exit 1
    }
}

function Install-Dependencies {
    Write-Color "`n[2/5] Installing dependencies..." Cyan
    
    if (Test-Path "node_modules") {
        Write-Color "  OK node_modules already exists, skip" Green
        return
    }
    
    try {
        Write-Color "  Running: npm install..." Gray
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        Write-Color "  OK dependencies installed" Green
    }
    catch {
        Write-Color "  ERROR: $_" Red
        exit 1
    }
}

function Build-Project {
    Write-Color "`n[3/5] Building project..." Cyan
    
    try {
        Write-Color "  Running: npm run build..." Gray
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "build failed"
        }
        Write-Color "  OK build successful" Green
    }
    catch {
        Write-Color "  ERROR: $_" Red
        exit 1
    }
}

function Verify-Build {
    Write-Color "`n[4/5] Verifying build output..." Cyan
    
    $distPath = Join-Path $PWD "dist"
    if (-not (Test-Path $distPath)) {
        Write-Color "  ERROR dist directory not found" Red
        exit 1
    }
    
    Write-Color "  OK dist directory exists" Green
    
    $files = Get-ChildItem -Path $distPath -Recurse
    $fileCount = $files.Count
    Write-Color "  OK $fileCount files in dist" Green
    
    Write-Color "`n  File list:" Gray
    Get-ChildItem -Path $distPath -Recurse | Select-Object FullName, Length | Format-Table -AutoSize
}

function Deploy-To-Remote {
    param(
        [string]$User,
        [string]$HostAddr,
        [string]$Path
    )
    
    Write-Color "`n[5/5] Deploying to remote server..." Cyan
    
    if (-not $User -or -not $HostAddr) {
        Write-Color "  ERROR Missing remote server info" Red
        Write-Color "    Usage: .\build.ps1 -DeployTarget remote -RemoteUser user -RemoteHost host" Red
        exit 1
    }
    
    try {
        Write-Color "  Checking SSH client..." Gray
        try {
            Get-Command ssh -ErrorAction Stop | Out-Null
            Write-Color "  OK SSH client available" Green
        } catch {
            throw "SSH client not available"
        }
        
        $distPath = Join-Path $PWD "dist"
        $remoteDest = "$User@$HostAddr`:$Path"
        
        Write-Color "  Uploading files to $remoteDest..." Gray
        scp -r "$distPath/*" $remoteDest
        if ($LASTEXITCODE -ne 0) {
            throw "file upload failed"
        }
        Write-Color "  OK files uploaded" Green
        
        Write-Color "  Restarting Nginx..." Gray
        ssh "$User@$HostAddr" "sudo systemctl restart nginx"
        if ($LASTEXITCODE -ne 0) {
            Write-Color "  WARN Nginx restart failed, please restart manually" Yellow
        } else {
            Write-Color "  OK Nginx restarted" Green
        }
        
        Write-Color "`n  DEPLOYMENT COMPLETE!" Green
        Write-Color "    Access: http://$HostAddr" Green
    }
    catch {
        Write-Color "  ERROR: $_" Red
        exit 1
    }
}

Write-Color "==========================================" Cyan
Write-Color "     Vue Project Build Script" Cyan
Write-Color "==========================================" Cyan
Write-Color "  Project: $PWD" Gray
Write-Color ""

Check-Node
Install-Dependencies
Build-Project
Verify-Build

if ($DeployTarget -eq "remote") {
    Deploy-To-Remote -User $RemoteUser -HostAddr $RemoteHost -Path $RemotePath
}

Write-Color ""
Write-Color "==========================================" Cyan
Write-Color "     Build Complete!" Green
Write-Color "==========================================" Cyan
Write-Color "  Output: dist/" Gray
Write-Color "  Deploy: Copy dist/ to Nginx html directory" Gray
Write-Color ""
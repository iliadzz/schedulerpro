# Scheduler Pro Deployment Script
# This script extracts version, creates backup, and commits to git

# Define paths
$indexPath = "D:\Scripts\Projects\Scheduler Pro\public\index.html"
$publicDir = "D:\Scripts\Projects\Scheduler Pro\public"
$backupDir = "D:\Scripts\Projects\Backups"

# Function to display colored output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "=== Scheduler Pro Deployment Script ==="
Write-Host ""

# Step 1: Extract version number from index.html
Write-ColorOutput Yellow "Step 1: Extracting version number..."

if (-not (Test-Path $indexPath)) {
    Write-ColorOutput Red "Error: index.html not found at $indexPath"
    exit 1
}

$indexContent = Get-Content $indexPath -Raw
$versionPattern = '<script type="module" src="js/main\.js\?v=([^"]+)">'
$match = [regex]::Match($indexContent, $versionPattern)

if (-not $match.Success) {
    Write-ColorOutput Red "Error: Could not find version number in index.html"
    Write-ColorOutput Red "Looking for pattern: <script type=`"module`" src=`"js/main.js?v=VERSION`">"
    exit 1
}

$version = $match.Groups[1].Value
Write-ColorOutput Green "Found version: $version"
Write-Host ""

# Step 2: Get user comments
Write-ColorOutput Yellow "Step 2: Getting commit message..."
$comments = Read-Host "Enter your commit message"

if ([string]::IsNullOrWhiteSpace($comments)) {
    Write-ColorOutput Red "Error: Commit message cannot be empty"
    exit 1
}

Write-ColorOutput Green "Commit message: $comments"
Write-Host ""

# Step 3: Change to public directory
Write-ColorOutput Yellow "Step 3: Changing to public directory..."

if (-not (Test-Path $publicDir)) {
    Write-ColorOutput Red "Error: Public directory not found at $publicDir"
    exit 1
}

Set-Location $publicDir
Write-ColorOutput Green "Changed to: $(Get-Location)"
Write-Host ""

# Step 4: Git add
Write-ColorOutput Yellow "Step 4: Running git add..."

try {
    $gitAddOutput = & git add . 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "Git add completed successfully"
        if ($gitAddOutput) {
            Write-ColorOutput Cyan $gitAddOutput
        }
    } else {
        Write-ColorOutput Red "Git add failed with exit code: $LASTEXITCODE"
        Write-ColorOutput Red $gitAddOutput
        exit 1
    }
} catch {
    Write-ColorOutput Red "Error running git add: $($_.Exception.Message)"
    exit 1
}

Write-Host ""

# Step 5: Git commit
Write-ColorOutput Yellow "Step 5: Running git commit..."

try {
    $gitCommitOutput = & git commit -m $comments 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "Git commit completed successfully"
        Write-ColorOutput Cyan $gitCommitOutput
    } else {
        # Check if it's just "nothing to commit" (exit code 1)
        if ($gitCommitOutput -match "nothing to commit") {
            Write-ColorOutput Cyan "No changes to commit"
            Write-ColorOutput Cyan $gitCommitOutput
        } else {
            Write-ColorOutput Red "Git commit failed with exit code: $LASTEXITCODE"
            Write-ColorOutput Red $gitCommitOutput
            exit 1
        }
    }
} catch {
    Write-ColorOutput Red "Error running git commit: $($_.Exception.Message)"
    exit 1
}

Write-Host ""

# Step 6: Git push
Write-ColorOutput Yellow "Step 6: Running git push..."

try {
    $gitPushOutput = & git push 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "Git push completed successfully"
        Write-ColorOutput Cyan $gitPushOutput
    } else {
        Write-ColorOutput Red "Git push failed with exit code: $LASTEXITCODE"
        Write-ColorOutput Red $gitPushOutput
        exit 1
    }
} catch {
    Write-ColorOutput Red "Error running git push: $($_.Exception.Message)"
    exit 1
}

Write-Host ""

# Step 7: Extract commit hash and create backup
Write-ColorOutput Yellow "Step 7: Creating backup with commit hash..."

# Extract the new commit hash from git push output
$commitHash = ""
$pushOutputString = $gitPushOutput -join "`n"

# Look for pattern like "96a696f..b087794  main -> main" and extract the second hash
$hashPattern = "([a-f0-9]{7,})\.\.([a-f0-9]{7,})\s+\w+\s*->\s*\w+"
$hashMatch = [regex]::Match($pushOutputString, $hashPattern)

if ($hashMatch.Success) {
    $oldHash = $hashMatch.Groups[1].Value
    $newHash = $hashMatch.Groups[2].Value
    $commitHash = "${oldHash}_${newHash}"
    Write-ColorOutput Green "Extracted commit hash: $commitHash"
} else {
    # Fallback: get current commit hash
    Write-ColorOutput Cyan "Could not extract hash from push output, using current HEAD hash..."
    $currentHash = & git rev-parse --short HEAD 2>&1
    if ($LASTEXITCODE -eq 0) {
        $commitHash = "current_$currentHash"
        Write-ColorOutput Green "Using current hash: $commitHash"
    } else {
        Write-ColorOutput Yellow "Could not get commit hash, using timestamp instead..."
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $commitHash = "backup_$timestamp"
    }
}

# Create backup directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    Write-ColorOutput Cyan "Creating backup directory: $backupDir"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# Create zip filename with version and commit hash
$zipFileName = "public.$version.$commitHash.zip"
$zipPath = Join-Path $backupDir $zipFileName

# Remove existing zip if it exists
if (Test-Path $zipPath) {
    Write-ColorOutput Cyan "Removing existing backup: $zipFileName"
    Remove-Item $zipPath -Force
}

try {
    # Create zip archive
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($publicDir, $zipPath)
    Write-ColorOutput Green "Backup created: $zipFileName"
    
    # Display zip file size
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-ColorOutput Cyan "Backup size: $zipSize MB"
} catch {
    Write-ColorOutput Red "Error creating backup: $($_.Exception.Message)"
    Write-ColorOutput Yellow "Deployment was successful, but backup failed"
}

Write-Host ""
Write-ColorOutput Green "=== Deployment completed successfully! ==="
Write-ColorOutput Cyan "Version: $version"
Write-ColorOutput Cyan "Backup: $zipFileName"
Write-ColorOutput Cyan "Commit Hash: $commitHash"
Write-ColorOutput Cyan "Commit Message: $comments"

# Optional: Display git status
Write-Host ""
Write-ColorOutput Yellow "Current git status:"
& git status --short 2>&1 | Write-ColorOutput Cyan
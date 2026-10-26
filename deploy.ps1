param(
    [Parameter(Mandatory=$false)]
    [string]$VercelToken,

    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "senior-center-map"
)

# Auto-detect token if not passed
if (-not $VercelToken) {
    if ($env:VERCEL_TOKEN) {
        $VercelToken = $env:VERCEL_TOKEN
    } elseif (Test-Path "C:\Users\HEO\.gemini\antigravity\vercel_token.txt") {
        $VercelToken = (Get-Content "C:\Users\HEO\.gemini\antigravity\vercel_token.txt" -Raw).Trim()
    }
}

if (-not $VercelToken) {
    Write-Host "Error: Vercel Token not found." -ForegroundColor Red
    exit 1
}

$projectDir = $PSScriptRoot
Write-Host "Deploying to Vercel (Project: $ProjectName)..." -ForegroundColor Cyan

$filesToDeploy = @(
    @{ path = "index.html"; fullPath = "$projectDir\index.html" },
    @{ path = "styles.css"; fullPath = "$projectDir\styles.css" },
    @{ path = "app.js"; fullPath = "$projectDir\app.js" },
    @{ path = "api/config.js"; fullPath = "$projectDir\api\config.js" },
    @{ path = "api/data.js"; fullPath = "$projectDir\api\data.js" },
    @{ path = "manifest.json"; fullPath = "$projectDir\manifest.json" },
    @{ path = "sw.js"; fullPath = "$projectDir\sw.js" },
    @{ path = "icon-192.png"; fullPath = "$projectDir\icon-192.png" },
    @{ path = "icon-512.png"; fullPath = "$projectDir\icon-512.png" }
)

$filePayloads = @()
foreach ($item in $filesToDeploy) {
    if (Test-Path $item.fullPath) {
        $bytes = [System.IO.File]::ReadAllBytes($item.fullPath)
        $b64 = [System.Convert]::ToBase64String($bytes)
        $filePayloads += @{
            file = $item.path
            data = $b64
            encoding = "base64"
        }
    }
}

$bodyObj = @{
    name = $ProjectName
    files = $filePayloads
    target = "production"
    projectSettings = @{
        framework = $null
    }
}

$jsonBody = $bodyObj | ConvertTo-Json -Depth 6
$headers = @{
    "Authorization" = "Bearer $VercelToken"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonBody))
    Write-Host "DEPLOY_SUCCESS: https://$($response.url)" -ForegroundColor Green
    Write-Host "READY_STATE: $($response.readyState)" -ForegroundColor Green
    return $response
} catch {
    Write-Host "DEPLOY_ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "DETAILS: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    throw $_
}

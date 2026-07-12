# Assembles the dist/ folder for Cloudflare Pages deployment.
#
# dist/ is a clean copy of the deployable site assets:
#   - static:    index.html, admin.html, favicon.svg, manifest.json, sw.js, css/, js/
#   - functions: functions/  ->  dist/functions/  (Pages Functions: /api/answers, /api/profiles)
#
# Deploy after running this:
#   $env:CLOUDFLARE_API_TOKEN  = ...   # from .cloudflare.env
#   $env:CLOUDFLARE_ACCOUNT_ID = ...
#   npx wrangler pages deploy dist --project-name rewardmaths --branch main
#
# The KV binding (SCORES) is read from wrangler.toml at deploy time.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$dist = Join-Path $root 'dist'
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null

# Static files
Copy-Item (Join-Path $root 'index.html')    $dist
Copy-Item (Join-Path $root 'admin.html')    $dist
Copy-Item (Join-Path $root 'favicon.svg')   $dist
Copy-Item (Join-Path $root 'manifest.json') $dist
Copy-Item (Join-Path $root 'sw.js')         $dist
Copy-Item (Join-Path $root '_headers')      $dist
Copy-Item (Join-Path $root 'css') $dist -Recurse
Copy-Item (Join-Path $root 'js')  $dist -Recurse

# Pages Functions (must live inside the deployed directory)
Copy-Item (Join-Path $root 'functions') $dist -Recurse

Write-Host "dist/ assembled:" -ForegroundColor Green
Get-ChildItem $dist -Recurse -File | ForEach-Object { $_.FullName.Substring($dist.Length + 1) }

# Phat_Hanh_AWord.ps1 - TU DONG hoa toan bo mot lan phat hanh AWord:
#   1) Danh ma phien ban theo THOI GIAN (YYYYMMDD.gio.phut) - tu dong moi lan chay
#   2) Dong goi: bundle + tao bo cai .exe
#   3) Commit + PUSH ma nguon len GitHub (nhanh main)
#   4) Tao GitHub Release v<phien ban> + TAI LEN bo cai .exe
# Bo tu cap nhat trong app se nhan duoc ban moi o lan mo ke tiep.
#
# Cach dung (PowerShell, KHONG can Administrator):
#   $env:GITHUB_TOKEN = "ghp_..."   # Personal Access Token quyen 'repo' (tao o https://github.com/settings/tokens)
#   .\Phat_Hanh_AWord.ps1
#   # tuy chon ghi chu:  .\Phat_Hanh_AWord.ps1 -Notes "- Sua loi X`n- Them Y"
#
# Khong dat GITHUB_TOKEN: van stamp + build + commit; buoc push/release se bao va dung.
param(
    [string]$Repo = "biencuong/AWord-Theia",
    [string]$Notes = "",
    [switch]$BoQuaBuild,   # neu da build san, chi commit + push + release
    [switch]$ChiBuild      # chi stamp + build, khong commit/push/release
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$appDir = Join-Path $root "electron-app"

function Buoc($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# --- 1) Danh ma phien ban theo thoi gian ---
Buoc "Danh ma phien ban theo thoi gian"
$version = (& node (Join-Path $appDir "scripts\stamp-version.cjs")).Trim()
if (-not $version) { Write-Error "Khong danh duoc ma phien ban."; exit 1 }
Write-Host "Phien ban: $version"

# --- 2) Dong goi ---
if (-not $BoQuaBuild) {
    Buoc "Dong goi (bundle + tao bo cai)"
    Push-Location $appDir
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    & npm run bundle
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Bundle that bai."; exit 1 }
    & npm run package
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Dong goi that bai."; exit 1 }
    Pop-Location
}
$exe = Join-Path $appDir "dist\AWord-Setup-$version.exe"
if (-not (Test-Path $exe)) { Write-Error "Khong tim thay $exe"; exit 1 }
Write-Host ("Bo cai: {0} ({1} MB)" -f $exe, [math]::Round((Get-Item $exe).Length/1MB))

if ($ChiBuild) { Write-Host "`nDa build xong (che do -ChiBuild). Bo qua commit/push/release." -ForegroundColor Yellow; exit 0 }

# --- 3) Commit + push ma nguon ---
Buoc "Commit + push ma nguon"
Push-Location $root
& git add -A
# Chi commit neu co thay doi
& git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    & git commit -m "AWord $version"
    Write-Host "Da commit: AWord $version"
} else {
    Write-Host "Khong co thay doi de commit."
}
& git push origin HEAD:main
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Push that bai (kiem tra dang nhap GitHub)."; exit 1 }
Pop-Location

# --- 4) GitHub Release + tai len exe ---
Buoc "Tao GitHub Release + tai len bo cai"
if (-not $env:GITHUB_TOKEN) {
    Write-Warning "Chua dat GITHUB_TOKEN - da push ma nguon nhung KHONG tao release/tai exe duoc."
    Write-Warning "Dat token roi chay lai:  `$env:GITHUB_TOKEN='ghp_...'; .\Phat_Hanh_AWord.ps1 -BoQuaBuild"
    exit 1
}
$tag = "v$version"
$headers = @{ Authorization = "Bearer $env:GITHUB_TOKEN"; Accept = "application/vnd.github+json"; "User-Agent" = "AWord-Publisher" }
if (-not $Notes) {
    $notesFile = Join-Path $root "GHI_CHU_PHAT_HANH.md"
    if (Test-Path $notesFile) { $Notes = (Get-Content $notesFile -Raw -Encoding UTF8).Trim() }
}
if (-not $Notes) { $Notes = "Ban phat hanh AWord $version" }

$body = @{ tag_name = $tag; name = "AWord $version"; body = $Notes; draft = $false; prerelease = $false } | ConvertTo-Json
try {
    $rel = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repo/releases" -Headers $headers -Body $body -ContentType "application/json"
} catch {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$tag" -Headers $headers
    Write-Host "Release $tag da ton tai, dung lai de tai tep len."
}
$name = [System.IO.Path]::GetFileName($exe)
$uploadUrl = ($rel.upload_url -replace "\{.*\}", "") + "?name=$name"
Write-Host "Tai len $name..."
Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -ContentType "application/octet-stream" -InFile $exe | Out-Null

Write-Host "`nXONG: https://github.com/$Repo/releases/tag/$tag" -ForegroundColor Green
Write-Host "Cac may da cai AWord se tu nhan duoc ban $version trong lan mo ke tiep."

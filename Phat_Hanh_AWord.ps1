# Phát hành bản AWord mới lên GitHub Releases — bộ tự cập nhật trong app sẽ nhận được.
# Cách dùng (PowerShell):
#   1. Tăng "version" trong electron-app\package.json (vd 1.0.1)
#   2. Đóng gói: .\Dong_Goi_AWord.bat  (ra electron-app\dist\AWord-Setup-1.0.1.exe)
#   3. Tạo Personal Access Token (classic, quyền repo) tại https://github.com/settings/tokens
#   4. $env:GITHUB_TOKEN = "ghp_..." ; .\Phat_Hanh_AWord.ps1
param(
    [string]$Repo = "biencuong/AWord-Theia"
)

$ErrorActionPreference = "Stop"
if (-not $env:GITHUB_TOKEN) { Write-Error "Chua dat bien moi truong GITHUB_TOKEN (Personal Access Token co quyen repo)."; exit 1 }

$pkg = Get-Content "$PSScriptRoot\electron-app\package.json" -Raw | ConvertFrom-Json
$version = $pkg.version
$tag = "v$version"
$exe = "$PSScriptRoot\electron-app\dist\AWord-Setup-$version.exe"
if (-not (Test-Path $exe)) { Write-Error "Khong tim thay $exe — hay dong goi truoc (Dong_Goi_AWord.bat)."; exit 1 }

$headers = @{ Authorization = "Bearer $env:GITHUB_TOKEN"; Accept = "application/vnd.github+json"; "User-Agent" = "AWord-Publisher" }

Write-Host "Tao release $tag tren $Repo..."
$body = @{ tag_name = $tag; name = "AWord $version"; body = "Ban phat hanh AWord $version"; draft = $false; prerelease = $false } | ConvertTo-Json
try {
    $rel = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repo/releases" -Headers $headers -Body $body -ContentType "application/json"
} catch {
    # Release/tag co the da ton tai — lay release theo tag
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$tag" -Headers $headers
    Write-Host "Release $tag da ton tai, dung lai de tai tep len."
}

$name = [System.IO.Path]::GetFileName($exe)
$uploadUrl = ($rel.upload_url -replace "\{.*\}", "") + "?name=$name"
Write-Host "Tai len $name ($([math]::Round((Get-Item $exe).Length/1MB)) MB)..."
Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -ContentType "application/octet-stream" -InFile $exe | Out-Null
Write-Host "XONG: https://github.com/$Repo/releases/tag/$tag"
Write-Host "Cac may da cai AWord se tu nhan duoc ban $version trong lan mo ke tiep."

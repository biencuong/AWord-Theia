# Cap_Nhat_Claude.ps1 - Hoa hop binary Claude giua ban DONG KEM AWord va ban CAI SAN tren may.
# Muc tieu (hybrid): uu tien dung claude cua may neu MOI HON hoac BANG va chay duoc - de nhan
# ban va moi va tranh phan ky phien ban; neu may khong co / cu hon / hong thi GIU ban dong kem
# (chay offline duoc tren moi may co quan). Luon giu ban goc de phuc hoi.
#
# Chay: khi cai (installer goi), first-run, hoac thu cong qua Start Menu "Cap nhat Claude (AWord)".
# Khong can Admin (moi thu trong ho so nguoi dung). An toan chay lai nhieu lan (idempotent).

param(
    # Thu muc cai AWord (chua AWord.exe). Mac dinh: thu muc chua script nay (installer dat vao INSTDIR).
    [string]$InstallDir = $PSScriptRoot
)

$ErrorActionPreference = 'SilentlyContinue'
$logFile = Join-Path $env:USERPROFILE '.claude\aword-claude-binary.log'
function Ghi($msg) {
    $dong = "[$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] $msg"
    Write-Output $dong
    try { Add-Content -Path $logFile -Value $dong -Encoding UTF8 } catch {}
}

# --- 1. Xac dinh binary dong kem trong bo cai ---
$duongDanNoiBo = @(
    'resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe',
    'resources\app\plugins\Anthropic.claude-code\extension\resources\native-binaries\win32-x64\claude.exe'
)
$bundled = $null
foreach ($rel in $duongDanNoiBo) {
    $thu = Join-Path $InstallDir $rel
    if (Test-Path $thu) { $bundled = $thu; break }
}
if (-not $bundled) { Ghi "Khong tim thay claude.exe dong kem trong '$InstallDir' - bo qua."; exit 0 }

# Backup PHAI co duoi .exe. Sidecar luu phien ban DANG HIEU LUC (tranh phai chay lai binary
# vua ghi - file moi ghi bi antivirus quet lan dau, chay --version rat cham hoac treo).
$backup    = Join-Path (Split-Path $bundled) 'claude.aword-goc.exe'
$activeFile = Join-Path (Split-Path $bundled) 'claude.active.version'
# Lan dau: luu ban goc dong kem de ve sau phuc hoi duoc.
if (-not (Test-Path $backup)) { Copy-Item $bundled $backup -Force }

# --- 2. Lay phien ban mot binary (chay --version, co chan treo) ---
function LayPhienBan($exe) {
    if (-not (Test-Path $exe)) { return $null }
    try {
        $job = Start-Job -ScriptBlock { param($e) & $e --version 2>$null } -ArgumentList $exe
        if (Wait-Job $job -Timeout 30) {
            $out = (Receive-Job $job) -join ' '
        } else { $out = $null }
        Remove-Job $job -Force
        if ($out -match '(\d+\.\d+\.\d+)') { return $Matches[1] }
    } catch {}
    return $null
}

# So sanh semver: >0 neu a>b, 0 neu bang, <0 neu a<b
function SoSanh($a, $b) {
    $pa = $a.Split('.'); $pb = $b.Split('.')
    for ($i = 0; $i -lt 3; $i++) {
        $d = [int]$pa[$i] - [int]$pb[$i]
        if ($d -ne 0) { return $d }
    }
    return 0
}

# Phien ban GOC dong kem: doc tu package.json cua plugin (khop version claude.exe dong kem),
# KHONG chay binary - vua nhanh vua tranh treo do antivirus quet.
$verGoc = $null
$pkgPlugin = Join-Path $InstallDir 'resources\app\plugins\Anthropic.claude-code\extension\package.json'
if (Test-Path $pkgPlugin) {
    try { $verGoc = (Get-Content $pkgPlugin -Raw -Encoding UTF8 | ConvertFrom-Json).version } catch {}
}
if (-not $verGoc) { Ghi "Khong doc duoc phien ban ban dong kem tu package.json - bo qua."; exit 0 }

# Phien ban DANG HIEU LUC: doc tu sidecar (chinh tay minh ghi moi lan doi); lan dau = verGoc.
$verActive = $verGoc
if (Test-Path $activeFile) { $t = (Get-Content $activeFile -Raw).Trim(); if ($t) { $verActive = $t } }
Ghi "Ban dong kem goc: $verGoc | Dang hieu luc: $verActive"

# --- 3. Tim cac claude CAI SAN tren may (loai ban dong kem va shim npm nho) ---
$ungVien = New-Object System.Collections.Generic.List[string]
$g = (Get-Command claude -ErrorAction SilentlyContinue).Source
if ($g) { $ungVien.Add($g) }
$ungVien.Add((Join-Path $env:USERPROFILE '.local\bin\claude.exe'))
$ungVien.Add((Join-Path $env:LOCALAPPDATA 'Programs\claude\claude.exe'))
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Anthropic.ClaudeCode_*\claude.exe" -ErrorAction SilentlyContinue |
    ForEach-Object { $ungVien.Add($_.FullName) }

$bundledFull = (Resolve-Path $bundled).Path
$backupFull  = (Resolve-Path $backup).Path
$tot = @{}  # duongDan -> phienBan, cua claude may hop le
foreach ($uv in $ungVien) {
    if (-not (Test-Path $uv)) { continue }
    $full = (Resolve-Path $uv).Path
    if ($full -eq $bundledFull -or $full -eq $backupFull) { continue }  # chinh la ban dong kem
    if ((Get-Item $full).Length -lt 50MB) { continue }  # loai shim .cmd/.exe launcher nho
    if ($tot.ContainsKey($full)) { continue }
    $v = LayPhienBan $full
    if ($v) { $tot[$full] = $v; Ghi "Claude may: $full = $v" }
}

# Chon ban may co phien ban CAO NHAT
$bestPath = $null; $bestVer = $null
foreach ($k in $tot.Keys) {
    if (-not $bestVer -or (SoSanh $tot[$k] $bestVer) -gt 0) { $bestPath = $k; $bestVer = $tot[$k] }
}

# --- 4. Quyet dinh ---
if ($bestPath -and $verGoc -and (SoSanh $bestVer $verGoc) -ge 0) {
    # May co ban >= ban goc dong kem: dung ban may neu dang hieu luc chua phai ban do
    if ($verActive -ne $bestVer) {
        Copy-Item $bestPath $bundled -Force
        Set-Content -Path $activeFile -Value $bestVer -Encoding ASCII
        Ghi "=> DUNG claude cua may ($bestVer) tu: $bestPath"
    } else {
        Ghi "=> Da dung claude may ($bestVer) tu truoc - khong doi."
    }
} else {
    # May khong co ban phu hop: bao dam dang dung BAN GOC dong kem
    if ((Test-Path $backup) -and $verActive -ne $verGoc) {
        Copy-Item $backup $bundled -Force
        Set-Content -Path $activeFile -Value $verGoc -Encoding ASCII
        Ghi "=> Khoi phuc ban dong kem ($verGoc) - claude may khong co/cu hon/hong."
    } else {
        Ghi "=> Giu ban dong kem ($verGoc) - offline, khong can claude may."
    }
}
exit 0

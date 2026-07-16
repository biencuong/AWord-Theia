# Cap_Nhat_QuyTac.ps1 - Cap nhat CLAUDE.md (quy tac lam viec) theo kieu HOP NHAT, khong ghi de mat.
# AWord chi quan ly KHOI giua hai dau moc <!-- AWORD:BEGIN ... --> ... <!-- AWORD:END ... -->.
# Khi cap nhat: thay DUNG khoi do bang ban moi, GIU NGUYEN moi thu nguoi dung viet NGOAI khoi.
# Backup ban cu theo THOI GIAN (CLAUDE.backup-yyyyMMdd-HHmmss.md) de khong de len backup lan truoc.
# Chay boi bo cai khi nguoi dung chon "Cap nhat". Khong can Admin. An toan chay lai (idempotent).

$ErrorActionPreference = 'Stop'
$thuMuc  = Join-Path $env:USERPROFILE '.claude'
$target  = Join-Path $thuMuc 'CLAUDE.md'
$nguon   = Join-Path $thuMuc 'CLAUDE.aword-moi.md'   # ban AWord moi (co day du 2 dau moc), installer ghi ra
if (-not (Test-Path $nguon)) { exit 0 }

$banMoi = Get-Content $nguon -Raw -Encoding UTF8

# Chua co CLAUDE.md -> dat ban moi nguyen ven
if (-not (Test-Path $target)) {
    [System.IO.File]::WriteAllText($target, $banMoi, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "Da tao CLAUDE.md moi."
    exit 0
}

# Bieu thuc bat khoi AWord (giua 2 dau moc, khong tham)
$dau  = '<!-- AWORD:BEGIN'
$reKhoi = "(?s)$([regex]::Escape($dau)).*?AWORD:END[^>]*-->"

# Lay khoi AWord moi tu ban moi
$mMoi = [regex]::Match($banMoi, $reKhoi)
if (-not $mMoi.Success) {
    Write-Output "Ban AWord moi thieu dau moc - giu nguyen CLAUDE.md hien tai."
    exit 0
}
$khoiMoi = $mMoi.Value

# Backup theo thoi gian truoc khi doi
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $target (Join-Path $thuMuc "CLAUDE.backup-$stamp.md") -Force

$hienTai = Get-Content $target -Raw -Encoding UTF8
$mCu = [regex]::Match($hienTai, $reKhoi)

if ($mCu.Success) {
    # CLAUDE.md da co khoi AWord -> thay DUNG khoi do (cat-ghep theo chi so, khong dung
    # regex-replace de tranh nham lan overload/thay the '$' trong PowerShell), giu phan
    # nguoi dung viet TRUOC va SAU khoi.
    $ketQua = $hienTai.Substring(0, $mCu.Index) + $khoiMoi + $hienTai.Substring($mCu.Index + $mCu.Length)
    Write-Output "Da cap nhat khoi AWord trong CLAUDE.md, giu nguyen phan cua nguoi dung."
} else {
    # CLAUDE.md la file rieng cua nguoi dung (chua co dau moc) -> DAT khoi AWord len dau,
    # giu TOAN BO noi dung cu cua nguoi dung phia sau.
    $ketQua = $khoiMoi + "`r`n`r`n" + $hienTai.TrimStart()
    Write-Output "Da chen khoi AWord vao dau CLAUDE.md, giu nguyen toan bo noi dung cu cua nguoi dung."
}

[System.IO.File]::WriteAllText($target, $ketQua, (New-Object System.Text.UTF8Encoding($false)))

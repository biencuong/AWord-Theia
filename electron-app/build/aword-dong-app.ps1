# Dong ung dung dang chay truoc khi cai dat / go cai dat.
# Bo cai NSIS goi qua installer.nsh (macro awordDongAppDangChay, sinh boi scripts/nsis-dong-app.cjs).
#
# Vi sao khong dung cach mac dinh cua electron-builder (taskkill /im theo ten tep):
#  - taskkill khong dong tien trinh CON (cmd/conhost cua Terminal, claude.exe, python...). Backend cua app
#    co the ket khi thoat vi con cho dong Terminal (ConPTY), roi thanh tien trinh "da thoat nhung Windows
#    van giu lai" - khong dong duoc, bo cai lap "cannot be closed" mai.
#  - Tien trinh con mo coi chay tu thu muc cai (claude.exe...) van khoa tep, cai de that bai.
#
# Tham so:
#   -TenExe  ten tep chay cua app (AWord.exe / AWordPro.exe)
#   -ThuMuc  thu muc cai ($INSTDIR) - moi tien trinh chay tu day deu bi dong
#   -CheDo   tim  = app dang mo thi tra 3 de bo cai hoi nguoi dung; khong mo thi don dep luon nhu 'dong'
#            dong = dong het (cay tien trinh con truoc, app sau), cho toi da ~10 giay
# Ma thoat:
#   0 = sach, cai tiep duoc
#   1 = con tien trinh dang chay nhung khong dong duoc (quyen quan tri, tai khoan khac...)
#   2 = chi con tien trinh "treo khi thoat" (Windows giu lai) - can khoi dong lai may
#   3 = (CheDo tim) app dang mo
param(
    [string]$TenExe = 'AWord.exe',
    [string]$ThuMuc = '',
    [string]$CheDo = 'tim'
)
$ErrorActionPreference = 'SilentlyContinue'

$thuMucCai = ''
if ($ThuMuc) { $thuMucCai = $ThuMuc.TrimEnd('\') + '\' }
$toi = $env:USERNAME

function Lay-TienTrinh {
    $ds = @(Get-WmiObject Win32_Process)
    $theoId = @{}
    foreach ($p in $ds) { $theoId[[int]$p.ProcessId] = $p }
    return @{ ds = $ds; theoId = $theoId }
}

# Chuoi to tien cua chinh script nay (powershell -> bo cai -> ...): khong bao gio dong.
function Lay-BaoVe($tt) {
    $baoVe = @{}
    $id = [int]$PID
    for ($i = 0; $i -lt 16 -and $tt.theoId.ContainsKey($id); $i++) {
        $baoVe[$id] = $true
        $cha = [int]$tt.theoId[$id].ParentProcessId
        if ($cha -eq $id -or -not $tt.theoId.ContainsKey($cha)) { break }
        # PID cha co the da bi Windows cap lai cho tien trinh khac: cha that phai sinh truoc con
        if ([string]$tt.theoId[$cha].CreationDate -gt [string]$tt.theoId[$id].CreationDate) { break }
        $id = $cha
    }
    return $baoVe
}

function La-CuaToi($p) {
    try { $o = $p.GetOwner(); return (-not $o.User) -or ($o.User -eq $toi) } catch { return $true }
}

# Tien trinh cua app: dung ten tep (cua nguoi dung hien tai) hoac chay tu thu muc cai.
function Lay-App($tt, $baoVe) {
    $kq = @()
    foreach ($p in $tt.ds) {
        $id = [int]$p.ProcessId
        if ($baoVe.ContainsKey($id)) { continue }
        $trongThuMuc = $thuMucCai -and $p.ExecutablePath -and $p.ExecutablePath.StartsWith($thuMucCai, [StringComparison]::OrdinalIgnoreCase)
        $dungTen = $p.Name -and ($p.Name -ieq $TenExe) -and (La-CuaToi $p)
        if ($trongThuMuc -or $dungTen) { $kq += $p }
    }
    return $kq
}

# Con chau (theo thu tu rong dan) cua cac tien trinh goc.
function Lay-ConChau($tt, $goc, $baoVe) {
    $con = @{}
    foreach ($p in $tt.ds) {
        $c = [int]$p.ParentProcessId
        if ($c -eq [int]$p.ProcessId -or -not $tt.theoId.ContainsKey($c)) { continue }
        if ([string]$tt.theoId[$c].CreationDate -gt [string]$p.CreationDate) { continue }
        if (-not $con.ContainsKey($c)) { $con[$c] = New-Object System.Collections.ArrayList }
        [void]$con[$c].Add([int]$p.ProcessId)
    }
    $daXet = @{}
    $hang = New-Object System.Collections.ArrayList
    foreach ($p in $goc) { $daXet[[int]$p.ProcessId] = $true; [void]$hang.Add([int]$p.ProcessId) }
    $kq = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $hang.Count; $i++) {
        $id = $hang[$i]
        if (-not $con.ContainsKey($id)) { continue }
        foreach ($c in $con[$id]) {
            if ($daXet.ContainsKey($c) -or $baoVe.ContainsKey($c)) { continue }
            $daXet[$c] = $true
            [void]$hang.Add($c)
            [void]$kq.Add($c)
        }
    }
    return $kq
}

# 'song' = dang chay; 'treo' = da thoat nhung Windows chua giai phong; '' = da het.
function Trang-Thai([int]$id) {
    $gp = Get-Process -Id $id -ErrorAction SilentlyContinue
    if (-not $gp) { return '' }
    try { if ($gp.HasExited) { return 'treo' } } catch { }
    return 'song'
}

# $canCho: PID -> CreationDate. So khop ca thoi diem sinh de PID bi cap lai cho tien trinh khac khong bi tinh nham.
function Ket-Luan($canCho) {
    $loc = (@($canCho.Keys) | ForEach-Object { "ProcessId=$_" }) -join ' OR '
    $conLai = @{}
    foreach ($p in @(Get-WmiObject Win32_Process -Filter $loc)) { $conLai[[int]$p.ProcessId] = [string]$p.CreationDate }
    $coSong = $false; $coTreo = $false
    foreach ($id in @($canCho.Keys)) {
        if (-not $conLai.ContainsKey($id)) { continue }
        if ($conLai[$id] -ne $canCho[$id]) { continue }
        $t = Trang-Thai $id
        if ($t -eq 'song') { $coSong = $true } elseif ($t -eq 'treo') { $coTreo = $true }
    }
    if ($coSong) { return 1 }
    if ($coTreo) { return 2 }
    return 0
}

# Dong con chau truoc (Terminal, claude.exe...) de backend khong ket khi thoat, roi toi app; ghi vao $canCho.
function Dong-Het($tt, $app, $baoVe, $canCho) {
    $conChau = @(Lay-ConChau $tt $app $baoVe)
    [array]::Reverse($conChau)
    foreach ($id in $conChau) {
        $canCho[[int]$id] = [string]$tt.theoId[[int]$id].CreationDate
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
    foreach ($p in $app) {
        $canCho[[int]$p.ProcessId] = [string]$p.CreationDate
        Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction SilentlyContinue
    }
}

$tt = Lay-TienTrinh
$baoVe = Lay-BaoVe $tt
$app = @(Lay-App $tt $baoVe)

if ($CheDo -eq 'tim') {
    foreach ($p in $app) {
        if (($p.Name -ieq $TenExe) -and ((Trang-Thai ([int]$p.ProcessId)) -eq 'song')) { exit 3 }
    }
}

$canCho = @{}
Dong-Het $tt $app $baoVe $canCho
if ($canCho.Count -eq 0) { exit 0 }
$kq = 0
$soLanChiTreo = 0
for ($lan = 0; $lan -lt 20; $lan++) {
    $kq = Ket-Luan $canCho
    if ($kq -eq 0) { break }
    # Chi con tien trinh treo, 4 lan lien tiep (~2 giay): cho them cung vo ich, can khoi dong lai may
    if ($kq -eq 2) { $soLanChiTreo++; if ($soLanChiTreo -ge 4) { break } } else { $soLanChiTreo = 0 }
    Start-Sleep -Milliseconds 500
    if ($lan -eq 6) {
        # Van con: quet lai (co the vua sinh tien trinh con moi trong luc dong)
        $tt = Lay-TienTrinh
        Dong-Het $tt @(Lay-App $tt $baoVe) $baoVe $canCho
    }
}
exit $kq

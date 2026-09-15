# Chuan bi moi truong phat trien AWord Web da nguoi dung tren may Windows:
#   WSL2 + Ubuntu 24.04 + Docker Engine (mien phi, KHONG dung Docker Desktop) + Node.js 24 trong Ubuntu.
# Chay qua Cai_WSL_Docker.cmd (tu xin quyen quan tri). Chay lai bao nhieu lan cung duoc: moi lan tu lam
# tiep buoc con thieu.
#   Buoc 1: bat WSL (lan dau can KHOI DONG LAI MAY, xong chay lai tep nay).
#   Buoc 2: cai Ubuntu 24.04 (dang nhap mac dinh bang root, khong hoi tao tai khoan).
#   Buoc 3: bat systemd, cai Docker Engine + Node.js 24 trong Ubuntu, kiem tra docker run hello-world.
# Gioi han tai nguyen WSL (tranh an het RAM may that): ghi %USERPROFILE%\.wslconfig neu chua co
#   (memory=16GB, processors=6). Da co tep thi giu nguyen.
# Continue: PowerShell 5.1 bien dong stderr cua lenh ngoai (qua 2>&1) thanh loi dung script neu de Stop; tu kiem ma thoat.
$ErrorActionPreference = 'Continue'
$DISTRO = 'Ubuntu-24.04'

function Bao($s) { Write-Host "[AWord Web] $s" -ForegroundColor Cyan }
function Loi($s) { Write-Host "[AWord Web] LOI: $s" -ForegroundColor Red }

$laAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laAdmin) { Loi 'Can chay bang quyen quan tri (dung Cai_WSL_Docker.cmd).'; exit 1 }

# WSL in ra UTF-16: doc dung de so khop ten distro
[Console]::OutputEncoding = [Text.Encoding]::Unicode

# ---- Buoc 1: WSL ----
& wsl.exe --status *> $null
if ($LASTEXITCODE -ne 0) {
    Bao 'Buoc 1/3: cai WSL (Windows Subsystem for Linux)...'
    & wsl.exe --install --no-distribution
    if ($LASTEXITCODE -ne 0) { Loi "wsl --install that bai (ma $LASTEXITCODE)."; exit 1 }
    Bao 'Da cai WSL. KHOI DONG LAI MAY TINH, sau do bam dup lai Cai_WSL_Docker.cmd de lam tiep.'
    exit 0
}
Bao 'Buoc 1/3: WSL da san sang.'

$cauHinh = Join-Path $env:USERPROFILE '.wslconfig'
if (-not (Test-Path $cauHinh)) {
    Set-Content -Path $cauHinh -Encoding ASCII -Value "[wsl2]`r`nmemory=16GB`r`nprocessors=6`r`n"
    Bao "Da tao $cauHinh (WSL toi da 16 GB RAM, 6 luong CPU)."
}

# ---- Buoc 2: Ubuntu ----
$dsDistro = (& wsl.exe --list --quiet) -replace "`0", '' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($dsDistro -notcontains $DISTRO) {
    Bao "Buoc 2/3: cai $DISTRO (tai khoang vai tram MB)..."
    & wsl.exe --install -d $DISTRO --no-launch
    if ($LASTEXITCODE -ne 0) { Loi "Cai $DISTRO that bai (ma $LASTEXITCODE)."; exit 1 }
    # Ban Ubuntu dang goi Store can dang ky lan dau; ban dang tep tar (WSL moi) da dang ky san.
    $dsDistro = (& wsl.exe --list --quiet) -replace "`0", '' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($dsDistro -notcontains $DISTRO) {
        $exe = Get-Command 'ubuntu2404.exe' -ErrorAction SilentlyContinue
        if (-not $exe) { Loi "Khong tim thay ubuntu2404.exe de dang ky $DISTRO."; exit 1 }
        & $exe.Source install --root
        if ($LASTEXITCODE -ne 0) { Loi "Dang ky $DISTRO that bai (ma $LASTEXITCODE)."; exit 1 }
    }
}
Bao "Buoc 2/3: $DISTRO da san sang."
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# ---- Buoc 3: systemd + Docker Engine + Node.js 24 (chay bang root trong Ubuntu) ----
$lenhLinux = @'
set -e
export DEBIAN_FRONTEND=noninteractive
if ! grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null; then
  printf '[boot]\nsystemd=true\n' > /etc/wsl.conf
  echo "CAN_KHOI_DONG_LAI_WSL"
  exit 0
fi
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
if ! command -v node >/dev/null 2>&1 || ! node --version | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
docker run --rm hello-world >/dev/null
echo "DOCKER_OK $(docker --version) | node $(node --version)"
'@
Bao 'Buoc 3/3: cai Docker Engine va Node.js 24 trong Ubuntu (co the mat vai phut)...'
$ra = $lenhLinux -replace "`r", '' | & wsl.exe -d $DISTRO -u root -- bash -s 2>&1
$ra | ForEach-Object { Write-Host $_ }
if ($ra -match 'CAN_KHOI_DONG_LAI_WSL') {
    & wsl.exe --terminate $DISTRO | Out-Null
    Bao 'Da bat systemd, khoi dong lai Ubuntu va cai tiep...'
    $ra = $lenhLinux -replace "`r", '' | & wsl.exe -d $DISTRO -u root -- bash -s 2>&1
    $ra | ForEach-Object { Write-Host $_ }
}
if (-not ($ra -match 'DOCKER_OK')) { Loi 'Chua cai xong Docker - xem thong bao phia tren, chay lai tep nay.'; exit 1 }
Bao 'XONG: WSL2 + Ubuntu 24.04 + Docker Engine + Node.js 24 da san sang cho AWord Web.'
exit 0

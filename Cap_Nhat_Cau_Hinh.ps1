# Cap_Nhat_Cau_Hinh.ps1 — Cập nhật settings.json của Claude Code theo kiểu HỢP NHẤT (không thay thế):
# lấy cấu hình hiện có của máy làm gốc, áp các thông số tối ưu của bản mới đè lên, và GIỮ NGUYÊN:
#   - ANTHROPIC_AUTH_TOKEN thật của máy (bản đóng gói chỉ chứa placeholder "xxxx"),
#   - các máy chủ MCP đã kết nối (mcpServers),
#   - mọi khóa cá nhân khác mà bản mới không định nghĩa.
# Mảng (ví dụ permissions.allow) được hợp nhất, loại trùng lặp.
# Bộ cài AWord gọi script này khi người dùng chọn "Cập nhật". Bản cũ được SAO LƯU theo THỜI GIAN
# (settings.backup-yyyyMMdd-HHmmss.json) để không đè lên bản sao lưu lần trước. Không cần Admin.

$ErrorActionPreference = 'Stop'
$thuMuc  = Join-Path $env:USERPROFILE '.claude'
$fileCu  = Join-Path $thuMuc 'settings.json'
$fileMoi = Join-Path $thuMuc 'settings.example.json'
if (-not (Test-Path $fileMoi)) { exit 0 }
if (-not (Test-Path $fileCu))  { Copy-Item $fileMoi $fileCu; exit 0 }

# Sao lưu theo thời gian trước khi hợp nhất (giữ mọi bản cũ, không mất của người dùng)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $fileCu (Join-Path $thuMuc "settings.backup-$stamp.json") -Force

try { $cauHinhCu = Get-Content $fileCu -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $cauHinhCu = $null }
$cauHinhMoi = Get-Content $fileMoi -Raw -Encoding UTF8 | ConvertFrom-Json
if ($null -eq $cauHinhCu) {
    # settings.json cũ hỏng, không đọc được — dùng nguyên bản mới
    Copy-Item $fileMoi $fileCu -Force
    exit 0
}

function Hop-Nhat($goc, $them) {
    # Đệ quy: khóa của bản mới đè lên bản cũ; khóa riêng của bản cũ giữ nguyên;
    # object lồng nhau hợp nhất sâu; mảng gộp lại loại trùng.
    foreach ($p in $them.PSObject.Properties) {
        $ten = $p.Name
        $giaTriMoi = $p.Value
        $thuocTinhCu = $goc.PSObject.Properties[$ten]
        if ($null -ne $thuocTinhCu -and
            $thuocTinhCu.Value -is [System.Management.Automation.PSCustomObject] -and
            $giaTriMoi -is [System.Management.Automation.PSCustomObject]) {
            Hop-Nhat $thuocTinhCu.Value $giaTriMoi
        } elseif ($null -ne $thuocTinhCu -and
            $thuocTinhCu.Value -is [System.Array] -and $giaTriMoi -is [System.Array]) {
            $gop = @($thuocTinhCu.Value) + @($giaTriMoi)
            $goc.$ten = @($gop | Select-Object -Unique)
        } elseif ($null -ne $thuocTinhCu) {
            $goc.$ten = $giaTriMoi
        } else {
            $goc | Add-Member -NotePropertyName $ten -NotePropertyValue $giaTriMoi
        }
    }
}

# Ghi nhớ trạng thái gateway của máy TRƯỚC khi hợp nhất — quyết định cách xử lý token:
#   1. Máy KHÔNG có gateway lẫn token (dùng đăng nhập claude.ai): không được áp env
#      ANTHROPIC_* của bản mới (gateway + token placeholder sẽ phá đăng nhập đang chạy).
#   2. Máy có gateway TRÙNG với bản mới: giữ token thật của máy (token vẫn hợp lệ).
#   3. Máy có gateway KHÁC bản mới (đổi nhà cung cấp): dùng token của bản mới —
#      token cũ thuộc gateway cũ, giữ lại sẽ hỏng xác thực trên gateway mới.
$urlCu = $null; $tokenCu = $null
if ($cauHinhCu.env) {
    $urlCu   = $cauHinhCu.env.ANTHROPIC_BASE_URL
    $tokenCu = $cauHinhCu.env.ANTHROPIC_AUTH_TOKEN
}
$urlMoi = $null
if ($cauHinhMoi.env) { $urlMoi = $cauHinhMoi.env.ANTHROPIC_BASE_URL }

Hop-Nhat $cauHinhCu $cauHinhMoi

if (-not $urlCu -and -not $tokenCu) {
    # Trường hợp 1: máy đăng nhập claude.ai — gỡ mọi khóa ANTHROPIC_* vừa bị thêm vào
    if ($cauHinhCu.env) {
        foreach ($ten in @($cauHinhCu.env.PSObject.Properties.Name)) {
            if ($ten -like 'ANTHROPIC_*') { $cauHinhCu.env.PSObject.Properties.Remove($ten) }
        }
    }
} elseif ($tokenCu -and $tokenCu -notmatch '^[xX]{3,}$' -and $urlCu -eq $urlMoi) {
    # Trường hợp 2: cùng gateway — trả lại token thật của máy
    $cauHinhCu.env.ANTHROPIC_AUTH_TOKEN = $tokenCu
}
# Trường hợp 3 (đổi gateway): giữ nguyên token bản mới — không làm gì thêm.

$json = $cauHinhCu | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($fileCu, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Da hop nhat settings.json: ap thong so toi uu moi, giu token/MCP/tuy chinh ca nhan."

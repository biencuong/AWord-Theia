# Cap_Nhat_Cau_Hinh.ps1 — Cập nhật settings.json của Claude Code theo kiểu HỢP NHẤT (không thay thế):
# lấy cấu hình hiện có của máy làm gốc, áp các thông số tối ưu của bản mới đè lên, và GIỮ NGUYÊN:
#   - ANTHROPIC_AUTH_TOKEN thật của máy (bản đóng gói chỉ chứa placeholder "xxxx"),
#   - các máy chủ MCP đã kết nối (mcpServers),
#   - mọi khóa cá nhân khác mà bản mới không định nghĩa.
# Mảng (ví dụ permissions.allow) được hợp nhất, loại trùng lặp.
# Bộ cài AWord gọi script này khi người dùng chọn "Cập nhật" — bản cũ đã được sao lưu
# thành settings.truoc-cap-nhat.json ngay trước đó. Chạy độc lập cũng được (không cần Admin).

$ErrorActionPreference = 'Stop'
$thuMuc  = Join-Path $env:USERPROFILE '.claude'
$fileCu  = Join-Path $thuMuc 'settings.json'
$fileMoi = Join-Path $thuMuc 'settings.example.json'
if (-not (Test-Path $fileMoi)) { exit 0 }
if (-not (Test-Path $fileCu))  { Copy-Item $fileMoi $fileCu; exit 0 }

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

# Nhớ token thật của máy trước khi hợp nhất (bản mới sẽ đè bằng placeholder)
$tokenCu = $null
if ($cauHinhCu.env -and $cauHinhCu.env.ANTHROPIC_AUTH_TOKEN) {
    $tokenCu = $cauHinhCu.env.ANTHROPIC_AUTH_TOKEN
}

Hop-Nhat $cauHinhCu $cauHinhMoi

# Trả lại token thật nếu máy đã có (chỉ nhận token bản mới khi token cũ trống/placeholder)
if ($tokenCu -and $tokenCu -notmatch '^[xX]{3,}$') {
    $cauHinhCu.env.ANTHROPIC_AUTH_TOKEN = $tokenCu
}

$json = $cauHinhCu | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($fileCu, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Da hop nhat settings.json: ap thong so toi uu moi, giu token/MCP/tuy chinh ca nhan."

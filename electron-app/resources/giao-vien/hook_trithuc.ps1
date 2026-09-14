# hook_trithuc.ps1 - Hook SessionStart cua Claude Code (AWord, vai Giao vien) cho Kho tri thuc AI giang day.
# Doc %USERPROFILE%\.aword\trithuc.json (do Ket_Noi_KhoTriThuc.cmd tao), goi GET <url goc>/api/v1/thong-bao?doc=1
# (vd https://aword.vn/trithuc/api/v1/thong-bao?doc=1) voi 2 header xac thuc thiet bi
# (Authorization: Bearer <token>, X-May: <ma may>), timeout 4 giay.
# Co thong bao -> in JSON hookSpecificOutput.additionalContext "KHO TRI THỨC AI: ..." de Claude nhac nguoi dung
# nguyen van. Khong co thong bao / chua ket noi / mat mang -> IM LANG (khong in gi, exit 0).
# Di tru: may chua chay lai script ket noi (chi co khosgk.json cua ban thu nghiem) -> doc tep cu, doi /khosgk/ -> /trithuc/.
# AWord chep tep nay vao %USERPROFILE%\.aword\ va dang ky hook khi nguoi dung bat vai Giao vien.
# LUU Y: tep phai giu ma hoa UTF-8 CO BOM (PowerShell 5.1 doc tep khong BOM theo ANSI -> vo chuoi tieng Viet).
$ErrorActionPreference = 'SilentlyContinue'
try {
    $thuMuc = Join-Path $env:USERPROFILE '.aword'
    $tep = Join-Path $thuMuc 'trithuc.json'
    if (-not (Test-Path -LiteralPath $tep)) { $tep = Join-Path $thuMuc 'khosgk.json' }
    if (-not (Test-Path -LiteralPath $tep)) { exit 0 }
    $cauHinh = Get-Content -LiteralPath $tep -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $cauHinh -or -not $cauHinh.url -or -not $cauHinh.token) { exit 0 }

    # URL goc = URL MCP bo duoi "/mcp" (vd https://aword.vn/trithuc/mcp -> https://aword.vn/trithuc)
    $goc = ([string]$cauHinh.url).Trim() -replace '/+$', '' -replace '/mcp$', '' -replace '/khosgk$', '/trithuc'
    $api = "$goc/api/v1/thong-bao?doc=1"
    $header = @{ 'Authorization' = "Bearer $($cauHinh.token)"; 'X-May' = [string]$cauHinh.ma_may }

    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
    $ketQua = Invoke-RestMethod -Uri $api -Method Get -Headers $header -TimeoutSec 4
    if ($null -eq $ketQua) { exit 0 }

    # Chap nhan ca hai dang: {thong_bao:[...]} hoac mang [...]
    $thongBao = @()
    if ($ketQua -is [System.Array]) { $thongBao = @($ketQua) }
    elseif ($ketQua.PSObject.Properties['thong_bao']) { $thongBao = @($ketQua.thong_bao) }
    $thongBao = @($thongBao | Where-Object { $_ -and $_.noi_dung })
    if ($thongBao.Count -eq 0) { exit 0 }

    $dong = foreach ($t in $thongBao) {
        $mucDo = if ($t.muc_do) { "[$($t.muc_do)] " } else { '' }
        $ngay = if ($t.ngay) { " ($($t.ngay))" } else { '' }
        "- $mucDo$($t.noi_dung)$ngay"
    }
    $vanBan = "KHO TRI THỨC AI: Có $($thongBao.Count) thông báo từ Kho tri thức AI giảng dạy (dịch vụ, cập nhật dữ liệu, đóng góp tài liệu). Hãy nhắc người dùng NGUYÊN VĂN các dòng dưới đây ở đầu câu trả lời đầu tiên, rồi mới làm việc chính; thông báo hết hạn/chưa kích hoạt thì hướng dẫn gia hạn theo skill tra-cuu-tri-thuc:`n" + ($dong -join "`n")

    $ra = @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $vanBan } } | ConvertTo-Json -Compress -Depth 5
    try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
    Write-Output $ra
} catch {
    # Im lang khi loi mang/may chu - khong lam ban phien lam viec
}
exit 0

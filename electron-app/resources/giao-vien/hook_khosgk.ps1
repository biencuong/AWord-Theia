# hook_khosgk.ps1 - Hook SessionStart cua Claude Code (AWord, vai Giao vien).
# Doc %USERPROFILE%\.aword\khosgk.json (do Ket_Noi_KhoSGK.cmd tao), goi GET <url goc>/api/v1/thong-bao?doc=1
# voi 2 header xac thuc thiet bi (Authorization: Bearer <token>, X-May: <ma may>), timeout 4 giay.
# Co thong bao -> in JSON hookSpecificOutput.additionalContext "KHO SGK: ..." de Claude nhac nguoi dung
# nguyen van. Khong co thong bao / chua ket noi / mat mang -> IM LANG (khong in gi, exit 0).
# AWord chep tep nay vao %USERPROFILE%\.aword\ va dang ky hook khi nguoi dung bat vai Giao vien.
$ErrorActionPreference = 'SilentlyContinue'
try {
    $tep = Join-Path $env:USERPROFILE '.aword\khosgk.json'
    if (-not (Test-Path -LiteralPath $tep)) { exit 0 }
    $cauHinh = Get-Content -LiteralPath $tep -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $cauHinh -or -not $cauHinh.url -or -not $cauHinh.token) { exit 0 }

    # URL goc = URL MCP bo duoi "/mcp" (vd https://aword.vn/khosgk/mcp -> https://aword.vn/khosgk)
    $goc = ([string]$cauHinh.url).Trim() -replace '/+$', '' -replace '/mcp$', ''
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
    $vanBan = "KHO SGK: Có $($thongBao.Count) thông báo từ Kho SGK (bản quyền/cập nhật). Hãy nhắc người dùng NGUYÊN VĂN các dòng dưới đây ở đầu câu trả lời đầu tiên, rồi mới làm việc chính; thông báo hết hạn/chưa kích hoạt thì hướng dẫn thanh toán theo skill tra-cuu-sgk:`n" + ($dong -join "`n")

    $ra = @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $vanBan } } | ConvertTo-Json -Compress -Depth 5
    try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
    Write-Output $ra
} catch {
    # Im lang khi loi mang/may chu - khong lam ban phien lam viec
}
exit 0

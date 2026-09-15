// Khối NSIS "đóng app đang chạy trước khi cài/gỡ" — gen-installer-nsh.cjs chèn vào installer.nsh.
// Dùng chung cho dòng AWord 2.x (nhánh ban-2x) và AWord Pro: chỉ dựa vào ${PRODUCT_NAME}/${APP_EXECUTABLE_FILENAME}.
//
// Thay CHECK_APP_RUNNING mặc định của electron-builder (taskkill /im theo TÊN tệp) vì cách đó:
//  - không đóng tiến trình CON (Terminal cmd/conhost, claude.exe, python…): backend có thể kẹt khi thoát
//    (chờ đóng ConPTY) thành tiến trình "đã thoát nhưng Windows còn giữ" → bộ cài báo "cannot be closed" mãi;
//  - bỏ qua tiến trình con mồ côi chạy từ thư mục cài (vẫn khóa tệp);
//  - không chạy trong phiên nâng quyền (cài cho mọi người dùng) → bộ gỡ bản cũ tự kiểm tra rồi thất bại.
// Việc dò/đóng làm trong build/aword-dong-app.ps1 (mã thoát 0/1/2/3 — xem đầu tệp đó).
'use strict';

const THONG_BAO_DANG_MO =
    '${PRODUCT_NAME} đang mở.$\\r$\\n$\\r$\\n' +
    'Bấm OK để đóng ${PRODUCT_NAME} (kể cả Terminal và các tác vụ Claude đang chạy bên trong) rồi tiếp tục. ' +
    'Hãy lưu tài liệu đang soạn trước khi bấm OK.$\\r$\\n$\\r$\\nBấm Cancel để thoát bộ cài.';

const THONG_BAO_TREO =
    'Một tiến trình ${PRODUCT_NAME} cũ đã thoát nhưng vẫn bị Windows giữ lại nên không đóng được ' +
    '(thường gặp khi còn cửa sổ Terminal mở lúc cập nhật).$\\r$\\n$\\r$\\n' +
    'CÁCH XỬ LÝ: KHỞI ĐỘNG LẠI MÁY TÍNH, sau đó chạy lại bộ cài này.$\\r$\\n$\\r$\\n' +
    '• Retry (Thử lại): kiểm tra lại.$\\r$\\n' +
    '• Ignore (Bỏ qua): vẫn cài tiếp — có thể không thành công.$\\r$\\n' +
    '• Abort (Hủy): thoát bộ cài.';

const THONG_BAO_KHONG_DONG =
    'Không đóng được ${PRODUCT_NAME} đang chạy (có thể đang chạy bằng quyền quản trị hoặc bằng tài khoản khác).$\\r$\\n$\\r$\\n' +
    'Hãy tự đóng ${PRODUCT_NAME} (hoặc khởi động lại máy tính) rồi bấm Retry (Thử lại). Bấm Cancel để thoát bộ cài.';

module.exports = [
    '; ===== Đóng app đang chạy trước khi cài/gỡ — sinh từ scripts/nsis-dong-app.cjs =====',
    '!macro awordDongAppDangChay',
    '  InitPluginsDir',
    '  File "/oname=$PLUGINSDIR\\aword-dong-app.ps1" "${PROJECT_DIR}\\build\\aword-dong-app.ps1"',
    '  ; Cập nhật (--updated): app vừa tự thoát để chạy bộ cài → đóng luôn, không hỏi.',
    '  StrCpy $R8 "tim"',
    '  ${if} ${isUpdated}',
    '    StrCpy $R8 "dong"',
    '  ${endIf}',
    '  aword_dong_app_lai:',
    '  DetailPrint `Đang đóng "${PRODUCT_NAME}"...`',
    '  ; Bộ cài là tiến trình 32-bit: gọi PowerShell 64-bit qua sysnative (khởi động nhanh gấp đôi) khi có.',
    '  StrCpy $R9 "$SYSDIR\\WindowsPowerShell\\v1.0\\powershell.exe"',
    '  IfFileExists "$WINDIR\\sysnative\\WindowsPowerShell\\v1.0\\powershell.exe" 0 +2',
    '    StrCpy $R9 "$WINDIR\\sysnative\\WindowsPowerShell\\v1.0\\powershell.exe"',
    '  ; -InputFormat None: nsExec nối stdin qua ống dẫn, thiếu cờ này PowerShell có thể chờ stdin mãi.',
    '  nsExec::Exec `"$R9" -NoProfile -NonInteractive -InputFormat None -ExecutionPolicy Bypass -WindowStyle Hidden -File "$PLUGINSDIR\\aword-dong-app.ps1" -TenExe "${APP_EXECUTABLE_FILENAME}" -ThuMuc "$INSTDIR" -CheDo $R8`',
    '  Pop $R9',
    '  ${if} $R9 == "3"',
    `    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "${THONG_BAO_DANG_MO}" /SD IDOK IDOK aword_dong_app_dong_y`,
    '    Quit',
    '    aword_dong_app_dong_y:',
    '    StrCpy $R8 "dong"',
    '    Goto aword_dong_app_lai',
    '  ${elseIf} $R9 == "2"',
    `    MessageBox MB_ABORTRETRYIGNORE|MB_ICONEXCLAMATION "${THONG_BAO_TREO}" /SD IDIGNORE IDRETRY aword_dong_app_lai IDIGNORE aword_dong_app_xong`,
    '    Quit',
    '  ${elseIf} $R9 == "1"',
    `    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${THONG_BAO_KHONG_DONG}" /SD IDCANCEL IDRETRY aword_dong_app_lai`,
    '    Quit',
    '  ${elseIf} $R9 != "0"',
    '    ; PowerShell không chạy được (bị chính sách chặn…): quay về cách cũ nhưng đóng kèm cây tiến trình con.',
    '    nsExec::Exec `"$SYSDIR\\cmd.exe" /c taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`',
    '    Pop $R9',
    '    Sleep 1500',
    '  ${endIf}',
    '  aword_dong_app_xong:',
    '!macroend',
    '',
    '; Bộ cài (cài cho người dùng hiện tại) và bộ gỡ: thay kiểm tra mặc định của electron-builder.',
    '!macro customCheckAppRunning',
    '  !insertmacro awordDongAppDangChay',
    '!macroend',
    '',
    '; Cài cho MỌI người dùng: phiên nâng quyền (UAC) bỏ qua CHECK_APP_RUNNING → tự đóng app ở đây, trước khi',
    '; bộ gỡ bản cũ chạy (bộ gỡ cũ dò theo tên tệp, gặp app còn chạy là báo "cannot be closed").',
    '!macro customInit',
    '  ${if} ${UAC_IsInnerInstance}',
    '    !insertmacro awordDongAppDangChay',
    '  ${endIf}',
    '!macroend',
    ''
];

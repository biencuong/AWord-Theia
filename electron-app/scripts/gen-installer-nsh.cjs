// Sinh installer.nsh từ danh sách skill thực tế trong resources/skills/.
// Mỗi skill chỉ được copy vào %USERPROFILE%\.claude\skills\<tên> nếu CHƯA có
// SKILL.md ở đó (không ghi đè bản người dùng đã tuỳ chỉnh).
// Chạy tự động trong bước prepackage — installer.nsh luôn khớp nội dung đóng gói.
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');
const skillsDir = path.join(appDir, 'resources', 'skills');
const outPath = path.join(appDir, 'installer.nsh');

const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
    .map(e => e.name)
    .sort();

if (skills.length === 0) {
    console.error('[gen-installer-nsh] Không tìm thấy skill nào trong resources/skills!');
    process.exit(1);
}

// Các file nguồn ở gốc AWord-Theia được nhúng vào bộ cài — thiếu là fail sớm,
// tránh NSIS báo "no files found" khó hiểu lúc biên dịch.
const rootDir = path.join(appDir, '..');
for (const f of ['settings.json', 'CLAUDE.user.md', 'Ket_Noi_KhoDuLieu.cmd', 'Cai_Dat_Cong_Cu.cmd', 'Cap_Nhat_Cau_Hinh.ps1', 'Kiem_Tra_AWord.cmd', 'Cap_Nhat_Claude.ps1', 'Cap_Nhat_QuyTac.ps1']) {
    if (!fs.existsSync(path.join(rootDir, f))) {
        console.error(`[gen-installer-nsh] Thiếu file nguồn ${f} ở gốc AWord-Theia!`);
        process.exit(1);
    }
}

const lines = [
    '; TỆP NÀY ĐƯỢC SINH TỰ ĐỘNG bởi scripts/gen-installer-nsh.cjs — đừng sửa tay.',
    '; 1) Cài các skill đóng gói kèm vào thư mục skill cá nhân của Claude Code',
    ';    (%USERPROFILE%\\.claude\\skills\\). Không ghi đè skill người dùng đã có.',
    '; 2) Đăng ký menu chuột phải Windows "Mở bằng AWord" cho tệp/thư mục (HKCU,',
    ';    không cần quyền Admin — giống cách VS Code làm). Gỡ sạch khi uninstall.',
    '!macro customInstall',
];
skills.forEach((skill, i) => {
    lines.push(
        `  IfFileExists "$PROFILE\\.claude\\skills\\${skill}\\SKILL.md" skip_skill_${i}`,
        `    SetOutPath "$PROFILE\\.claude\\skills\\${skill}"`,
        `    File /r "\${PROJECT_DIR}\\resources\\skills\\${skill}\\*"`,
        `  skip_skill_${i}:`
    );
});
lines.push(
    '',
    '  ; settings.json của AWord cho Claude Code (gateway, model mặc định, tốc độ trả lời).',
    '  ; - Máy CHƯA có: cài thẳng.',
    '  ; - Máy ĐÃ có (cập nhật/cài lại): HỎI người dùng. Chọn CẬP NHẬT thì HỢP NHẤT (không thay',
    '  ;   thế): script Cap_Nhat_Cau_Hinh.ps1 áp thông số tối ưu mới lên cấu hình hiện có,',
    '  ;   GIỮ token thật + mcpServers + tùy chỉnh cá nhân; bản cũ sao lưu theo thời gian settings.backup-*.json.',
    '  ; - Cài im lặng (/S): mặc định GIỮ bản hiện có (/SD IDNO) — lựa chọn an toàn nhất.',
    '  ; - Bản mẫu settings.example.json LUÔN được ghi mới (script hợp nhất đọc từ đây).',
    '  ; Nguồn: AWord-Theia\\settings.json + Cap_Nhat_Cau_Hinh.ps1 (cạnh thư mục electron-app).',
    '  SetOutPath "$INSTDIR"',
    '  File "${PROJECT_DIR}\\..\\Cap_Nhat_Cau_Hinh.ps1"',
    '  SetOutPath "$PROFILE\\.claude"',
    '  File "/oname=settings.example.json" "${PROJECT_DIR}\\..\\settings.json"',
    '  IfFileExists "$PROFILE\\.claude\\settings.json" hoi_settings',
    '    File "/oname=settings.json" "${PROJECT_DIR}\\..\\settings.json"',
    '    Goto xong_settings',
    '  hoi_settings:',
    '  MessageBox MB_YESNO|MB_ICONQUESTION "Máy này đã có cấu hình Claude (settings.json).$\\r$\\n$\\r$\\nBạn có muốn CẬP NHẬT theo cấu hình mới của AWord không?$\\r$\\n$\\r$\\n• CÓ (khuyến nghị): BỔ SUNG các thông số tối ưu mới vào cấu hình hiện có theo kiểu HỢP NHẤT, KHÔNG thay thế — GIỮ NGUYÊN mã kết nối AI, các Kho dữ liệu (MCP) đã kết nối và mọi tùy chỉnh cá nhân. Bản cũ vẫn được sao lưu theo thời gian (settings.backup-<ngày giờ>.json) — không mất.$\\r$\\n$\\r$\\n• KHÔNG: giữ nguyên cấu hình hiện tại, không thay đổi gì; bản mẫu mới vẫn xem được ở settings.example.json." /SD IDNO IDNO xong_settings',
    "    ExecWait 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"$INSTDIR\\Cap_Nhat_Cau_Hinh.ps1\"'",
    '  xong_settings:',
    '',
    '  ; CLAUDE.md cấp người dùng: quy tắc làm việc + quy trình đọc tài liệu của AWord.',
    '  ; - Máy CHƯA có: cài thẳng CLAUDE.user.md (đã có 2 dấu mốc AWORD:BEGIN/END).',
    '  ; - Máy ĐÃ có: HỎI. Chọn CẬP NHẬT thì HỢP NHẤT (Cap_Nhat_QuyTac.ps1): chỉ thay KHỐI do',
    '  ;   AWord quản lý (giữa 2 dấu mốc), GIỮ NGUYÊN mọi thứ người dùng tự viết ngoài khối;',
    '  ;   bản cũ sao lưu theo thời gian CLAUDE.backup-*.md.',
    '  ; - CLAUDE.aword-moi.md LUÔN ghi mới (script hợp nhất đọc khối AWord mới từ đây).',
    '  ; Nguồn: AWord-Theia\\CLAUDE.user.md + Cap_Nhat_QuyTac.ps1',
    '  SetOutPath "$INSTDIR"',
    '  File "${PROJECT_DIR}\\..\\Cap_Nhat_QuyTac.ps1"',
    '  SetOutPath "$PROFILE\\.claude"',
    '  File "/oname=CLAUDE.aword-moi.md" "${PROJECT_DIR}\\..\\CLAUDE.user.md"',
    '  IfFileExists "$PROFILE\\.claude\\CLAUDE.md" hoi_claude_md',
    '    File "/oname=CLAUDE.md" "${PROJECT_DIR}\\..\\CLAUDE.user.md"',
    '    Goto xong_claude_md',
    '  hoi_claude_md:',
    '  MessageBox MB_YESNO|MB_ICONQUESTION "Máy này đã có tệp quy tắc làm việc của Claude (CLAUDE.md).$\\r$\\n$\\r$\\nBạn có muốn CẬP NHẬT theo bản mới của AWord không?$\\r$\\n$\\r$\\n• CÓ (khuyến nghị): nhận quy trình đọc PDF scan mới và kỹ năng đọc văn bản mới. HỢP NHẤT chứ KHÔNG ghi đè — chỉ cập nhật phần quy tắc do AWord quản lý, GIỮ NGUYÊN mọi quy tắc RIÊNG bạn tự thêm. Bản cũ vẫn được sao lưu theo thời gian (CLAUDE.backup-<ngày giờ>.md) — không mất.$\\r$\\n$\\r$\\n• KHÔNG: giữ quy tắc hiện tại — AWord vẫn chạy bình thường nhưng Claude tiếp tục đọc PDF scan theo cách cũ và không biết kỹ năng đọc văn bản mới." /SD IDNO IDNO xong_claude_md',
    "    ExecWait 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"$INSTDIR\\Cap_Nhat_QuyTac.ps1\"'",
    '  xong_claude_md:',
    '',
    '  ; Script kết nối Kho dữ liệu cơ quan (MCP HTTP): đặt vào thư mục cài + Start Menu.',
    '  ; LUÔN ghi mới (script không chứa dữ liệu người dùng, cần bản mới nhất).',
    '  SetOutPath "$INSTDIR"',
    '  File "${PROJECT_DIR}\\..\\Ket_Noi_KhoDuLieu.cmd"',
    '  CreateShortCut "$SMPROGRAMS\\Kết nối Kho dữ liệu (AWord).lnk" "$INSTDIR\\Ket_Noi_KhoDuLieu.cmd" "" "$INSTDIR\\AWord.exe" 0',
    '',
    '  ; Script cài công cụ đọc tài liệu (python + thư viện doc/docx/xlsx/xls/pdf).',
    '  ; Tự chạy 1 lần ở lần khởi động đầu (marker aword-cong-cu.ok); shortcut để chạy lại tay.',
    '  File "${PROJECT_DIR}\\..\\Cai_Dat_Cong_Cu.cmd"',
    '  CreateShortCut "$SMPROGRAMS\\Cài công cụ tài liệu (AWord).lnk" "$INSTDIR\\Cai_Dat_Cong_Cu.cmd" "" "$INSTDIR\\AWord.exe" 0',
    '',
    '  ; Công cụ chẩn đoán khi Claude không khởi động (kiểm tra claude.exe, gợi ý xử lý AV).',
    '  File "${PROJECT_DIR}\\..\\Kiem_Tra_AWord.cmd"',
    '  CreateShortCut "$SMPROGRAMS\\Kiểm tra AWord.lnk" "$INSTDIR\\Kiem_Tra_AWord.cmd" "" "$INSTDIR\\AWord.exe" 0',
    '',
    '  ; Hòa hợp binary Claude (hybrid): ưu tiên claude cài sẵn trên máy nếu mới hơn/bằng và',
    '  ; chạy được, không thì giữ bản đóng kèm (offline). Chạy ngay khi cài + shortcut chạy lại tay.',
    '  File "${PROJECT_DIR}\\..\\Cap_Nhat_Claude.ps1"',
    '  CreateShortCut "$SMPROGRAMS\\Cập nhật Claude (AWord).lnk" "$INSTDIR\\Cap_Nhat_Claude.ps1" "" "$INSTDIR\\AWord.exe" 0',
    "  ExecWait 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"$INSTDIR\\Cap_Nhat_Claude.ps1\" -InstallDir \"$INSTDIR\"'",
    '',
    '  ; Menu chuột phải: tệp bất kỳ',
    '  WriteRegStr HKCU "Software\\Classes\\*\\shell\\AWord" "" "Mở bằng AWord"',
    '  WriteRegStr HKCU "Software\\Classes\\*\\shell\\AWord" "Icon" "$INSTDIR\\AWord.exe"',
    `  WriteRegStr HKCU "Software\\Classes\\*\\shell\\AWord\\command" "" '"$INSTDIR\\AWord.exe" "%1"'`,
    '  ; Menu chuột phải: thư mục',
    '  WriteRegStr HKCU "Software\\Classes\\Directory\\shell\\AWord" "" "Mở thư mục bằng AWord"',
    '  WriteRegStr HKCU "Software\\Classes\\Directory\\shell\\AWord" "Icon" "$INSTDIR\\AWord.exe"',
    `  WriteRegStr HKCU "Software\\Classes\\Directory\\shell\\AWord\\command" "" '"$INSTDIR\\AWord.exe" "%1"'`,
    '  ; Menu chuột phải: nền thư mục đang mở (khoảng trống trong Explorer)',
    '  WriteRegStr HKCU "Software\\Classes\\Directory\\Background\\shell\\AWord" "" "Mở thư mục bằng AWord"',
    '  WriteRegStr HKCU "Software\\Classes\\Directory\\Background\\shell\\AWord" "Icon" "$INSTDIR\\AWord.exe"',
    `  WriteRegStr HKCU "Software\\Classes\\Directory\\Background\\shell\\AWord\\command" "" '"$INSTDIR\\AWord.exe" "%V"'`,
    '',
    '  ; Làm mới icon cache của Windows để shortcut nhận icon AWord mới ngay',
    '  ; (không cần đăng xuất/khởi động lại; lỗi cũng không sao — chỉ là cache).',
    "  ExecWait 'ie4uinit.exe -show'",
    '!macroend',
    '',
    '!macro customUnInstall',
    '  Delete "$SMPROGRAMS\\Kết nối Kho dữ liệu (AWord).lnk"',
    '  Delete "$SMPROGRAMS\\Cài công cụ tài liệu (AWord).lnk"',
    '  Delete "$SMPROGRAMS\\Kiểm tra AWord.lnk"',
    '  Delete "$SMPROGRAMS\\Cập nhật Claude (AWord).lnk"',
    '  DeleteRegKey HKCU "Software\\Classes\\*\\shell\\AWord"',
    '  DeleteRegKey HKCU "Software\\Classes\\Directory\\shell\\AWord"',
    '  DeleteRegKey HKCU "Software\\Classes\\Directory\\Background\\shell\\AWord"',
    '!macroend',
    '',
    '; Trang HOÀN TẤT: bấm "Kết thúc" -> trình cài ĐÓNG NGAY (ExecShellAsUser không chặn),',
    '; AWord mở ở NỀN sau ~2 giây (để cửa sổ trình cài biến mất trước) — tránh cảm giác treo',
    '; do AWord khởi động lần đầu hơi lâu. Chạy qua PowerShell ẩn (không cửa sổ), Start-Process',
    '; nên tiến trình AWord tách rời, sống độc lập sau khi trình cài thoát.',
    '!macro customFinishPage',
    '  Function StartApp',
    '    ${StdUtils.ExecShellAsUser} $0 "powershell.exe" "open" "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command $\\"Start-Sleep -Seconds 2; Start-Process -FilePath \'$INSTDIR\\AWord.exe\'$\\""',
    '  FunctionEnd',
    '  !define MUI_FINISHPAGE_RUN',
    '  !define MUI_FINISHPAGE_RUN_TEXT "Mở AWord (chạy ở nền)"',
    '  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"',
    '  !insertmacro MUI_PAGE_FINISH',
    '!macroend',
    ''
);

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`[gen-installer-nsh] Đã sinh installer.nsh cho ${skills.length} skill: ${skills.join(', ')}`);

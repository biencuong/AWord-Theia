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
for (const f of ['settings.json', 'CLAUDE.user.md', 'Ket_Noi_KhoDuLieu.cmd', 'Cai_Dat_Cong_Cu.cmd']) {
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
    '  ; Cài settings.json tùy chỉnh của AWord cho Claude Code (gateway, model mặc định,',
    '  ; tiếng Việt, hiệu năng tối đa) — chỉ khi máy CHƯA có, không đụng cấu hình sẵn.',
    '  ; Đồng thời LUÔN đặt bản mẫu settings.example.json cạnh đó để người dùng tham khảo',
    '  ; và tự sửa khi cần (bản mẫu được ghi mới mỗi lần cài).',
    '  ; Nguồn: AWord-Theia\\settings.json (cạnh thư mục electron-app).',
    '  SetOutPath "$PROFILE\\.claude"',
    '  File "/oname=settings.example.json" "${PROJECT_DIR}\\..\\settings.json"',
    '  IfFileExists "$PROFILE\\.claude\\settings.json" skip_claude_settings',
    '    File "/oname=settings.json" "${PROJECT_DIR}\\..\\settings.json"',
    '  skip_claude_settings:',
    '',
    '  ; CLAUDE.md cấp người dùng: hướng Claude ưu tiên tra Kho dữ liệu cơ quan',
    '  ; (MCP khodulieu). Chỉ cài khi CHƯA có — không đè bản người dùng đã sửa.',
    '  ; Nguồn: AWord-Theia\\CLAUDE.user.md',
    '  IfFileExists "$PROFILE\\.claude\\CLAUDE.md" skip_claude_md',
    '    SetOutPath "$PROFILE\\.claude"',
    '    File "/oname=CLAUDE.md" "${PROJECT_DIR}\\..\\CLAUDE.user.md"',
    '  skip_claude_md:',
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
    '  DeleteRegKey HKCU "Software\\Classes\\*\\shell\\AWord"',
    '  DeleteRegKey HKCU "Software\\Classes\\Directory\\shell\\AWord"',
    '  DeleteRegKey HKCU "Software\\Classes\\Directory\\Background\\shell\\AWord"',
    '!macroend',
    ''
);

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`[gen-installer-nsh] Đã sinh installer.nsh cho ${skills.length} skill: ${skills.join(', ')}`);

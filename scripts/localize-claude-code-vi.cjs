// Việt hóa phần giao diện KHAI BÁO của extension Claude Code (Anthropic):
// tiêu đề lệnh, mô tả cài đặt, walkthrough trong package.json của plugin đã tải về.
// Extension này KHÔNG dùng cơ chế %key%/package.nls.json (chuỗi viết cứng),
// nên cách duy nhất là vá trực tiếp bản plugin được đóng gói cùng AWord.
// Lưu ý: nội dung BÊN TRONG khung chat (webview do Claude Code CLI dựng) không
// vá được từ ngoài — phần đó giữ nguyên theo sản phẩm gốc của Anthropic.
// Idempotent: đánh dấu bằng trường "_aword_vi" trong package.json.
const fs = require('fs');
const path = require('path');

const DICH_LENH = {
    'Claude Code: Open in New Tab': 'Claude Code: Mở trong thẻ mới',
    'Claude Code: Open': 'Claude Code: Mở',
    'Claude Code: Open in Primary Editor': 'Claude Code: Mở trong trình soạn thảo chính',
    'Claude Code: Open in New Window': 'Claude Code: Mở trong cửa sổ mới',
    'Claude Code: Create Worktree': 'Claude Code: Tạo worktree',
    'Claude Code: Open in Side Bar': 'Claude Code: Mở ở thanh bên',
    'Claude Code: New Conversation': 'Claude Code: Cuộc trò chuyện mới',
    'Claude Code: Reopen Closed Session': 'Claude Code: Mở lại phiên vừa đóng',
    'Claude Code: Update extension': 'Claude Code: Cập nhật extension',
    'Claude Code: Focus input': 'Claude Code: Chuyển tiêu điểm vào ô nhập',
    'Claude Code: Blur input': 'Claude Code: Rời tiêu điểm khỏi ô nhập',
    'Claude Code: Logout': 'Claude Code: Đăng xuất',
    'Claude Code: Open in Terminal': 'Claude Code: Mở trong Terminal',
    'Claude Code: Accept Proposed Changes': 'Claude Code: Chấp nhận thay đổi đề xuất',
    'Claude Code: Reject Proposed Changes': 'Claude Code: Từ chối thay đổi đề xuất',
    'Claude Code: Insert @-Mention Reference': 'Claude Code: Chèn tham chiếu @',
    'Claude Code: Install Plugin': 'Claude Code: Cài plugin',
    'Claude Code: Insert At-Mentioned': 'Claude Code: Chèn tham chiếu @',
    'Claude Code: Show Logs': 'Claude Code: Hiện nhật ký',
    'Claude Code: Open Walkthrough': 'Claude Code: Mở hướng dẫn sử dụng',
};

const DICH_CAI_DAT = {
    'claudeCode.environmentVariables': 'Biến môi trường đặt khi khởi chạy Claude.\n\nNên đặt biến môi trường trong settings.json của Claude.\nXem tài liệu: https://code.claude.com/docs/en/settings',
    'claudeCode.useTerminal': 'Chạy Claude trong terminal thay vì giao diện gốc.',
    'claudeCode.allowDangerouslySkipPermissions': 'Cho phép chế độ bỏ qua kiểm tra quyền. Chỉ nên dùng trong môi trường cách ly không có Internet.',
    'claudeCode.claudeProcessWrapper': 'Đường dẫn tệp thực thi dùng để khởi chạy tiến trình Claude.',
    'claudeCode.respectGitIgnore': 'Tôn trọng tệp .gitignore khi tìm kiếm tệp. Mẹo: khi tắt, vẫn có thể lọc bằng các mẫu loại trừ trong .ignore.',
    'claudeCode.initialPermissionMode': 'Chế độ quyền ban đầu cho cuộc trò chuyện mới. \'manual\' tương đương \'default\' — chế độ ghi nhãn Manual trên giao diện.',
    'claudeCode.disableLoginPrompt': 'Khi bật, không bao giờ nhắc đăng nhập/xác thực trong extension. Dùng khi việc xác thực được xử lý bên ngoài.',
    'claudeCode.autosave': 'Tự động lưu tệp trước khi Claude đọc hoặc ghi.',
    'claudeCode.useCtrlEnterToSend': 'Khi bật, dùng Ctrl/Cmd+Enter để gửi thay vì chỉ Enter. Enter khi đó dùng để xuống dòng.',
    'claudeCode.preferredLocation': 'Vị trí mặc định mở Claude. Cài đặt này tự cập nhật khi bạn mở Claude ở vị trí mới.',
    'claudeCode.enableNewConversationShortcut': 'Dùng phím tắt Cmd/Ctrl+N để bắt đầu cuộc trò chuyện mới khi Claude đang có tiêu điểm.',
    'claudeCode.enableReopenClosedSessionShortcut': 'Dùng Cmd/Ctrl+Shift+T để mở lại thẻ phiên Claude vừa đóng gần nhất. Chỉ chặn phím tắt khi thứ đóng gần nhất là thẻ Claude; nếu không sẽ chuyển về hành vi mở lại editor bình thường.',
    'claudeCode.hideOnboarding': 'Ẩn danh sách hướng dẫn làm quen trong Claude Code.',
    'claudeCode.usePythonEnvironment': 'Tự động kích hoạt môi trường Python của workspace khi chạy Claude. Cần cài extension [Python](https://marketplace.visualstudio.com/items?itemName=ms-python.python).',
};

const DICH_WALKTHROUGH = {
    'Get started with Claude Code': 'Bắt đầu với Claude Code',
    'Learn how to use Claude Code to write, edit, and understand your code.': 'Tìm hiểu cách dùng Claude Code để viết, chỉnh sửa và hiểu mã nguồn của bạn.',
    'Your AI coding partner': 'Trợ thủ lập trình AI của bạn',
    'Claude Code helps you write, edit, and understand code right in VS Code.': 'Claude Code giúp bạn viết, chỉnh sửa và hiểu mã ngay trong trình soạn thảo.',
    'Open Claude Code': 'Mở Claude Code',
    'Click the orange Claude icon in the top right corner, or press Ctrl+Escape (Cmd+Escape on Mac) to start a conversation.': 'Bấm biểu tượng Claude màu cam ở góc trên bên phải, hoặc nhấn Ctrl+Escape (Cmd+Escape trên Mac) để bắt đầu trò chuyện.',
    'Chat with Claude': 'Trò chuyện với Claude',
    'Type a message and press Enter. Ask questions, request changes, or get help understanding your code. Use @ to mention files for context, or select code first to ask about it.': 'Gõ tin nhắn và nhấn Enter. Đặt câu hỏi, yêu cầu chỉnh sửa, hoặc nhờ giải thích mã. Dùng @ để đính kèm tệp làm ngữ cảnh, hoặc bôi đen mã trước rồi hỏi về đoạn đó.',
    'Past conversations': 'Các cuộc trò chuyện trước',
    'Click the Past Conversations button at the top or type /resume to browse past sessions. You can start a new conversation anytime by clicking the New Chat button.': 'Bấm nút Past Conversations ở trên cùng hoặc gõ /resume để xem các phiên trước. Bạn có thể bắt đầu cuộc trò chuyện mới bất cứ lúc nào bằng nút New Chat.',
};

const DICH_MO_TA = {
    'Claude Code for VS Code: Harness the power of Claude Code without leaving your IDE':
        'Claude Code cho AWord: Khai thác sức mạnh của Claude Code ngay trong ứng dụng',
};

function patchPluginDir(pluginRoot) {
    const pkgPath = path.join(pluginRoot, 'extension', 'package.json');
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg._aword_vi) {
        console.log(`[localize-claude-code-vi] Đã vá từ trước: ${pkgPath}`);
        return true;
    }
    if (pkg.description && DICH_MO_TA[pkg.description]) {
        pkg.description = DICH_MO_TA[pkg.description];
    }
    for (const cmd of pkg.contributes?.commands ?? []) {
        if (DICH_LENH[cmd.title]) cmd.title = DICH_LENH[cmd.title];
    }
    const props = pkg.contributes?.configuration?.properties ?? {};
    for (const [key, viDesc] of Object.entries(DICH_CAI_DAT)) {
        if (!props[key]) continue;
        if (props[key].description) props[key].description = viDesc;
        else if (props[key].markdownDescription) props[key].markdownDescription = viDesc;
    }
    for (const wt of pkg.contributes?.walkthroughs ?? []) {
        if (DICH_WALKTHROUGH[wt.title]) wt.title = DICH_WALKTHROUGH[wt.title];
        if (DICH_WALKTHROUGH[wt.description]) wt.description = DICH_WALKTHROUGH[wt.description];
        for (const step of wt.steps ?? []) {
            if (DICH_WALKTHROUGH[step.title]) step.title = DICH_WALKTHROUGH[step.title];
            if (DICH_WALKTHROUGH[step.description]) step.description = DICH_WALKTHROUGH[step.description];
        }
    }
    pkg._aword_vi = true;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    console.log(`[localize-claude-code-vi] Đã vá: ${pkgPath}`);
    return true;
}

const root = path.join(__dirname, '..');
let patched = 0;
for (const app of ['electron-app', 'browser-app']) {
    const pluginRoot = path.join(root, app, 'plugins', 'Anthropic.claude-code');
    if (patchPluginDir(pluginRoot)) patched++;
}
if (patched === 0) {
    console.error('[localize-claude-code-vi] KHÔNG tìm thấy plugin Anthropic.claude-code nào để vá!');
    process.exit(1);
}

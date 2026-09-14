// Nhận diện widget là KHUNG CHAT Claude Code — dùng chung cho mọi thao tác đóng/mở/khởi động lại.
// KHÔNG khớp theo chữ "claude" trong id/tiêu đề: id tab tài liệu có dạng
// `code-editor-opener:file:///.../CLAUDE.md` (kể cả mọi tệp trong "CLAUDE OUTPUTS/"), còn tiêu đề
// khung chat bị extension đổi theo tên cuộc trò chuyện. Nhận diện theo dấu hiệu cố định:
// - khung chat giữa màn hình: webview có viewType "claudeVSCodePanel" (webviews-main gán viewType);
// - khung chat thanh bên: view container "claude-sidebar" / "claude-sidebar-secondary" của plugin — Theia
//   (plugin-view-registry) đặt id widget là `plugin-view-container:workbench.view.extension.<id>`.
// Danh sách phiên (claude-sessions-sidebar) và xem trước kế hoạch (claudePlanPreview) không phải khung chat.
export interface WidgetCoTheLaClaude {
    id: string;
    title?: { label?: string };
}

export function laWidgetClaude(w: WidgetCoTheLaClaude): boolean {
    const viewType = (w as { viewType?: unknown }).viewType;
    if (typeof viewType === 'string') {
        return viewType === 'claudeVSCodePanel';
    }
    return /^plugin-view-container:(workbench\.view\.extension\.)?claude-sidebar(-secondary)?$/.test(w.id);
}

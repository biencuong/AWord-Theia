import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry, CommandService,
    MenuContribution, MenuModelRegistry, MessageService
} from '@theia/core';
import { ApplicationShell, CommonMenus } from '@theia/core/lib/browser';
import { laWidgetClaude } from './aword-claude-widget';

const LENH_CLAUDE_THANH_BEN = 'claude-vscode.sidebar.open';
const LENH_CLAUDE_GIUA = 'claude-vscode.editor.open';

// Menu "Bố cục" trên thanh menu — các công tắc sắp xếp giao diện cho công việc văn phòng.
export const LayoutExplorer: Command = { id: 'aword.layout.toggle-explorer', label: 'Hiện/ẩn thanh Khám phá' };
export const LayoutClaude: Command = { id: 'aword.layout.toggle-claude', label: 'Hiện/ẩn khung Claude' };
export const LayoutClaudeCenter: Command = { id: 'aword.layout.claude-center', label: 'Khung Claude ra giữa' };
export const LayoutClaudeSide: Command = { id: 'aword.layout.claude-side', label: 'Khung Claude ra thanh bên phải' };
export const LayoutClaudeRestart: Command = { id: 'aword.layout.claude-restart', label: 'Khởi động lại Claude (khi bị treo)' };
export const LayoutFocus: Command = { id: 'aword.layout.focus', label: 'Chế độ tập trung (ẩn thanh bên & bảng dưới)' };
// Lệnh có sẵn của Claude Code (claude-vscode.reopenClosedSession) đọc lại đúng lịch sử phiên trò
// chuyện đã lưu cho thư mục dự án đang mở — CÙNG một kho lưu (~/.claude) dù mở bằng AWord, VS Code
// hay CLI trên máy này, nên phiên làm ở nơi khác vẫn mở lại được ở đây. Bọc thành lệnh riêng của
// AWord chỉ để lệnh này dễ tìm hơn (có mặt trong menu Trợ giúp, không chỉ Command Palette).
export const LayoutClaudeReopenSession: Command = { id: 'aword.layout.claude-reopen-session', label: 'Mở lại phiên trò chuyện Claude gần đây' };

const EXPLORER_CONTAINER_ID = 'explorer-view-container';

@injectable()
export class AwordLayoutContribution implements CommandContribution, MenuContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    protected dangTapTrung = false;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(LayoutExplorer, { execute: () => this.toggleExplorer() });
        commands.registerCommand(LayoutClaude, { execute: () => this.toggleClaude() });
        commands.registerCommand(LayoutClaudeCenter, { execute: () => this.moClaude(LENH_CLAUDE_GIUA) });
        commands.registerCommand(LayoutClaudeSide, { execute: () => this.moClaude(LENH_CLAUDE_THANH_BEN) });
        commands.registerCommand(LayoutClaudeRestart, { execute: () => this.restartClaude() });
        commands.registerCommand(LayoutClaudeReopenSession, { execute: () => this.moPhienGanDay() });
        commands.registerCommand(LayoutFocus, { execute: () => this.toggleTapTrung() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // KHÔNG tạo menu "Bố cục" trên thanh menu (giữ gọn tối thiểu). Các lệnh bố cục (hiện/ẩn
        // Explorer, Claude, tập trung...) vẫn dùng được qua Command Palette (Ctrl+Shift+P).
        // Riêng "Khởi động lại Claude (khi treo)" là thao tác gỡ kẹt quan trọng nên vẫn để trong
        // menu Trợ giúp cho dễ tìm.
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: LayoutClaudeRestart.id,
            label: LayoutClaudeRestart.label,
            order: '3'
        });
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: LayoutClaudeReopenSession.id,
            label: LayoutClaudeReopenSession.label,
            order: '4'
        });
    }

    protected toggleExplorer(): void {
        try {
            if (this.shell.isExpanded('left')) {
                this.shell.collapsePanel('left');
            } else {
                this.shell.expandPanel('left');
                this.shell.revealWidget(EXPLORER_CONTAINER_ID);
            }
        } catch { /* bố cục chưa sẵn sàng */ }
    }

    // Mặc định mở ở THANH BÊN (đúng claudeCode.preferredLocation): mỗi khung chat là một webview
    // + một tiến trình claude.exe (~250 MB) — không tự sinh thêm khung giữa màn hình.
    protected toggleClaude(): void {
        const w = this.timClaude();
        if (w) {
            try { w.close(); return; } catch { /* thử mở lại bên dưới */ }
        }
        this.moClaude(LENH_CLAUDE_THANH_BEN);
    }

    protected moClaude(lenh: string): void {
        const duPhong = lenh === LENH_CLAUDE_THANH_BEN ? LENH_CLAUDE_GIUA : LENH_CLAUDE_THANH_BEN;
        this.commandService.executeCommand(lenh).catch(() =>
            this.commandService.executeCommand(duPhong)).catch(() => { /* plugin chưa sẵn sàng */ });
    }

    // Khôi phục khi Claude "chạy mãi"/treo: đóng MỌI khung chat Claude (giải phóng tiến trình
    // CLI đang treo cùng webview) rồi mở lại sạch. Đây là cách gỡ kẹt tin cậy vì đóng
    // webview làm extension kết thúc tiến trình con; mở lại sinh tiến trình mới.
    protected async restartClaude(): Promise<void> {
        let daDong = 0;
        for (const w of [...this.shell.widgets]) {
            if (laWidgetClaude(w)) {
                try { w.close(); daDong++; } catch { /* bỏ qua */ }
            }
        }
        this.messageService.info(daDong > 0
            ? 'Đang khởi động lại Claude…'
            : 'Đang mở lại Claude…', { timeout: 4000 });
        await new Promise(r => setTimeout(r, 700));
        this.moClaude(LENH_CLAUDE_THANH_BEN);
    }

    // Mở lại phiên trò chuyện gần đây nhất của dự án đang mở (kể cả phiên đã bắt đầu ở VS Code/CLI
    // trên cùng máy — Claude Code đọc lịch sử theo thư mục dự án từ ~/.claude, không riêng theo IDE).
    protected async moPhienGanDay(): Promise<void> {
        try {
            await this.commandService.executeCommand('claude-vscode.reopenClosedSession');
        } catch {
            this.messageService.warn('Không có phiên trò chuyện nào để mở lại, hoặc Claude Code chưa sẵn sàng.');
        }
    }

    protected toggleTapTrung(): void {
        try {
            if (!this.dangTapTrung) {
                this.shell.collapsePanel('left');
                this.shell.collapsePanel('bottom');
                this.dangTapTrung = true;
            } else {
                this.shell.expandPanel('left');
                this.dangTapTrung = false;
            }
        } catch { /* bố cục chưa sẵn sàng */ }
    }

    protected timClaude(): { id: string; close(): void } | undefined {
        return this.shell.getWidgets('main').find(laWidgetClaude) ?? this.shell.widgets.find(laWidgetClaude);
    }
}

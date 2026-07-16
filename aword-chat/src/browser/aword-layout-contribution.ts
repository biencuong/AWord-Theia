import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry, CommandService,
    MenuContribution, MenuModelRegistry, MAIN_MENU_BAR
} from '@theia/core';
import { ApplicationShell } from '@theia/core/lib/browser';

// Menu "Bố cục" trên thanh menu — các công tắc sắp xếp giao diện cho công việc văn phòng.
export const LayoutExplorer: Command = { id: 'aword.layout.toggle-explorer', label: 'Hiện/ẩn thanh Khám phá' };
export const LayoutClaude: Command = { id: 'aword.layout.toggle-claude', label: 'Hiện/ẩn khung Claude' };
export const LayoutClaudeCenter: Command = { id: 'aword.layout.claude-center', label: 'Khung Claude ra giữa' };
export const LayoutClaudeSide: Command = { id: 'aword.layout.claude-side', label: 'Khung Claude ra thanh bên phải' };
export const LayoutFocus: Command = { id: 'aword.layout.focus', label: 'Chế độ tập trung (ẩn thanh bên & bảng dưới)' };

const EXPLORER_CONTAINER_ID = 'explorer-view-container';
const AWORD_LAYOUT_MENU = [...MAIN_MENU_BAR, 'aword_layout'];

@injectable()
export class AwordLayoutContribution implements CommandContribution, MenuContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    protected dangTapTrung = false;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(LayoutExplorer, { execute: () => this.toggleExplorer() });
        commands.registerCommand(LayoutClaude, { execute: () => this.toggleClaude() });
        commands.registerCommand(LayoutClaudeCenter, { execute: () => this.moClaude('claude-vscode.editor.open') });
        commands.registerCommand(LayoutClaudeSide, { execute: () => this.moClaude('claude-vscode.sidebar.open') });
        commands.registerCommand(LayoutFocus, { execute: () => this.toggleTapTrung() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // Đặt menu "Bố cục" trước menu Trợ giúp (9_help).
        menus.registerSubmenu(AWORD_LAYOUT_MENU, 'Bố cục', { sortString: '7_layout' });
        menus.registerMenuAction([...AWORD_LAYOUT_MENU, '1_panels'], { commandId: LayoutExplorer.id, label: LayoutExplorer.label, order: '1' });
        menus.registerMenuAction([...AWORD_LAYOUT_MENU, '1_panels'], { commandId: LayoutClaude.id, label: LayoutClaude.label, order: '2' });
        menus.registerMenuAction([...AWORD_LAYOUT_MENU, '2_claude'], { commandId: LayoutClaudeCenter.id, label: LayoutClaudeCenter.label, order: '1' });
        menus.registerMenuAction([...AWORD_LAYOUT_MENU, '2_claude'], { commandId: LayoutClaudeSide.id, label: LayoutClaudeSide.label, order: '2' });
        menus.registerMenuAction([...AWORD_LAYOUT_MENU, '3_focus'], { commandId: LayoutFocus.id, label: LayoutFocus.label, order: '1' });
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

    protected toggleClaude(): void {
        const w = this.timClaude();
        if (w) {
            try { w.close(); return; } catch { /* thử mở lại bên dưới */ }
        }
        this.moClaude('claude-vscode.editor.open');
    }

    protected moClaude(lenh: string): void {
        this.commandService.executeCommand(lenh).catch(() =>
            this.commandService.executeCommand('claude-vscode.editor.open')).catch(() => { /* plugin chưa sẵn sàng */ });
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

    protected timClaude(): { id: string; isVisible?: boolean; close(): void } | undefined {
        const laClaude = (w: { id: string; title?: { label?: string } }) =>
            /claude/i.test(w.id) || /claude/i.test(w.title?.label ?? '');
        const w = this.shell.getWidgets('main').find(laClaude) ?? this.shell.widgets.find(laClaude);
        return w as { id: string; isVisible?: boolean; close(): void } | undefined;
    }
}

import { injectable, inject } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry, Command, URI } from '@theia/core';
import { AbstractViewContribution, CommonMenus, FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { AwordWelcomeWidget } from './aword-welcome-widget';
import { QUY_TAC_CLAUDE_MD } from './aword-setup-prompts';

export const AwordWelcomeCommand: Command = {
    id: 'aword:welcome',
    label: 'Trang chào mừng'
};

// Đánh dấu "đã chào mừng" trong localStorage: trang chào mừng chỉ tự mở LẦN ĐẦU;
// các lần sau khởi động thẳng vào khung chat Claude (trải nghiệm kiểu Claude for Windows).
const KHOA_DA_CHAO_MUNG = 'aword.daChaoMung';
// Thư mục làm việc mặc định tạo trong Documents của người dùng ở lần chạy đầu.
const TEN_WORKSPACE_MAC_DINH = 'AWord';
const THU_MUC_CON_MAC_DINH = ['ABOUT ME', 'TEMPLATES', 'PROJECTS', 'CLAUDE OUTPUTS'];

@injectable()
export class AwordWelcomeContribution extends AbstractViewContribution<AwordWelcomeWidget> implements FrontendApplicationContribution {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(EnvVariablesServer)
    protected readonly envServer: EnvVariablesServer;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    constructor() {
        super({
            widgetId: AwordWelcomeWidget.ID,
            widgetName: AwordWelcomeWidget.LABEL,
            defaultWidgetOptions: { area: 'main' }
        });
    }

    // Khởi động kiểu "chat trước tiên":
    // - Chưa từng mở thư mục nào → tự tạo Documents\AWord (kèm cấu trúc chuẩn + CLAUDE.md) và mở luôn,
    //   người dùng không phải qua bước "Mở thư mục". Việc mở workspace nạp lại cửa sổ, nhánh dưới chạy tiếp.
    // - Đã có workspace → mở khung chat Claude ở vùng soạn thảo chính; trang chào mừng chỉ hiện lần đầu.
    // - Người dùng CHỦ ĐỘNG đóng workspace (đã có mục gần đây) → tôn trọng, chỉ hiện trang chào mừng.
    async onDidInitializeLayout(app: FrontendApplication): Promise<void> {
        if (this.workspaceService.tryGetRoots().length === 0) {
            let ganDay: string[] = [];
            try { ganDay = await this.workspaceService.recentWorkspaces(); } catch { /* backend chưa sẵn sàng */ }
            if ((ganDay?.length ?? 0) === 0 && await this.taoVaMoWorkspaceMacDinh()) {
                return; // cửa sổ sắp nạp lại với workspace mới
            }
            await this.openView({ activate: true, reveal: true });
            return;
        }
        if (!window.localStorage.getItem(KHOA_DA_CHAO_MUNG)) {
            window.localStorage.setItem(KHOA_DA_CHAO_MUNG, '1');
            await this.openView({ activate: false, reveal: true });
            // Lần đầu: thu gọn panel trái để khung chat rộng rãi — Explorer mở lại bằng cách bấm icon.
            try { app.shell.collapsePanel('left'); } catch { /* bố cục chưa sẵn sàng — không sao */ }
        }
        this.moClaudeGiuaManHinh(app);
    }

    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(AwordWelcomeCommand, {
            execute: () => this.openView({ activate: true, reveal: true })
        });
    }

    override registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AwordWelcomeCommand.id,
            label: AwordWelcomeCommand.label,
            order: '2'
        });
    }

    // Tạo Documents\AWord với cấu trúc chuẩn (ABOUT ME/TEMPLATES/PROJECTS/CLAUDE OUTPUTS + CLAUDE.md)
    // rồi mở làm workspace. Trả về true nếu đã kích hoạt mở (cửa sổ sẽ nạp lại).
    protected async taoVaMoWorkspaceMacDinh(): Promise<boolean> {
        try {
            const home = new URI(await this.envServer.getHomeDirUri());
            const wsUri = home.resolve('Documents').resolve(TEN_WORKSPACE_MAC_DINH);
            if (!await this.fileService.exists(wsUri)) {
                await this.fileService.createFolder(wsUri);
                for (const con of THU_MUC_CON_MAC_DINH) {
                    await this.fileService.createFolder(wsUri.resolve(con));
                }
                await this.fileService.createFile(wsUri.resolve('CLAUDE.md'), BinaryBuffer.fromString(QUY_TAC_CLAUDE_MD));
            }
            this.workspaceService.open(wsUri);
            return true;
        } catch {
            return false; // không tạo được (đĩa/quyền) — rơi về trang chào mừng để người dùng tự mở thư mục
        }
    }

    // Mở khung chat Claude làm tab chính giữa màn hình. Plugin nạp bất đồng bộ nên phải
    // CHỜ LỆNH ĐƯỢC ĐĂNG KÝ rồi mới gọi, và chỉ gọi ĐÚNG MỘT LẦN.
    // TUYỆT ĐỐI không gọi-thử-lặp-lại: nếu lệnh đã tồn tại nhưng chạy lỗi (vd claude.exe
    // không khởi động được trên máy đó), mỗi lần gọi lại là một lần spawn CLI —
    // từng gây lỗi thực tế bắn ra hàng chục cửa sổ claude khi khởi động.
    // QUAN TRỌNG không kém: Theia KHÔI PHỤC layout phiên trước (gồm cả panel Claude cũ)
    // song song với đoạn này — mở thêm panel mới khi panel cũ đang tái tạo sẽ ra 2 cửa sổ
    // Claude (lỗi thực tế). Vì vậy phải quét widget Claude hiện có trước: có rồi thì chỉ
    // focus vào nó, chưa có mới mở.
    protected async moClaudeGiuaManHinh(app: FrontendApplication): Promise<void> {
        const lenhGiuaManHinh = 'claude-vscode.editor.open';
        const lenhThanhBen = 'claude-vscode.sidebar.open';
        for (let lan = 0; lan < 60 && !this.commandRegistry.getCommand(lenhGiuaManHinh); lan++) {
            await new Promise(r => setTimeout(r, 500));
        }
        if (!this.commandRegistry.getCommand(lenhGiuaManHinh)) {
            return; // plugin không nạp được trong 30s — không cố thêm
        }
        // Webview của phiên trước gắn lại vào layout KHÔNG đồng bộ với việc plugin đăng ký
        // lệnh — quét theo chu kỳ tối đa 5 giây: hễ thấy widget Claude xuất hiện thì chỉ
        // focus nó và dừng; hết 5 giây không thấy mới coi là chưa có và mở mới.
        for (let lan = 0; lan < 10; lan++) {
            const claudeDangCo = this.timWidgetClaude(app);
            if (claudeDangCo) {
                try { await app.shell.activateWidget(claudeDangCo.id); } catch { /* widget đang tái tạo — bỏ qua */ }
                return;
            }
            await new Promise(r => setTimeout(r, 500));
        }
        try {
            await this.commandRegistry.executeCommand(lenhGiuaManHinh);
        } catch {
            // Một lần dự phòng duy nhất; vẫn lỗi thì dừng — plugin sẽ tự hiện thông báo lỗi của nó.
            try { await this.commandRegistry.executeCommand(lenhThanhBen); } catch { /* dừng, không lặp */ }
        }
    }

    // Tìm widget Claude đang tồn tại — ưu tiên vùng soạn thảo chính, sau đó mọi vùng khác
    // (sidebar...). Nhận diện theo id hoặc nhãn tiêu đề vì webview của plugin không có id cố định.
    protected timWidgetClaude(app: FrontendApplication): { id: string } | undefined {
        const laClaude = (w: { id: string; title?: { label?: string } }) =>
            /claude/i.test(w.id) || /claude/i.test(w.title?.label ?? '');
        return app.shell.getWidgets('main').find(laClaude) ?? app.shell.widgets.find(laClaude);
    }
}

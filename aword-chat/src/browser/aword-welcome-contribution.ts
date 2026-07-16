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

// Các view container ở thanh bên trái KHÔNG cần cho công việc văn phòng — ẩn khỏi activity bar.
// (Quản lý mã nguồn, Kiểm thử, Gỡ lỗi — do plugin-ext/scm/test/debug kéo theo, không gỡ khỏi bundle được.)
const ICON_SIDEBAR_AN = ['scm-view-container', 'test-view-container', 'debug'];
const EXPLORER_CONTAINER_ID = 'explorer-view-container';

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
        // Ẩn các icon sidebar không dùng: ẩn NGAY một lần, rồi NGHE SỰ KIỆN thêm widget để
        // ẩn nốt view container nào xuất hiện trễ — thay cho việc quét mù nhiều lần theo mốc
        // thời gian cứng (tốn và kéo dài "đuôi" khởi động). Tự ngừng nghe sau khi layout ổn định.
        this.anIconSidebar(app);
        const subAn = app.shell.onDidAddWidget(() => this.anIconSidebar(app));
        setTimeout(() => subAn.dispose(), 8000);

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
        }
        // Mặc định mở trình Khám phá (Explorer) với thư mục làm việc ở panel trái.
        await this.moExplorer(app);
        // TRÌ HOÃN mở khung Claude ra khỏi đường khởi động then-chốt: chờ ứng dụng "rảnh tay"
        // rồi mới mở (webview + spawn claude.exe ~253MB là việc nặng). Để layout/Explorer hiện
        // trước, không chặn UI. Vẫn đảm bảo chỉ mở đúng một lần (logic trong moClaudeGiuaManHinh).
        this.moKhiRanh(() => this.moClaudeGiuaManHinh(app));
    }

    // Chạy cb khi renderer rảnh (requestIdleCallback); không có thì lùi 500ms.
    protected moKhiRanh(cb: () => void): void {
        const ric = (window as unknown as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
        if (ric) { ric(cb, { timeout: 3000 }); } else { setTimeout(cb, 500); }
    }

    // Ẩn view container Quản lý mã nguồn / Kiểm thử / Gỡ lỗi khỏi thanh bên trái.
    protected anIconSidebar(app: FrontendApplication): void {
        try {
            for (const w of app.shell.getWidgets('left')) {
                if (ICON_SIDEBAR_AN.includes(w.id)) { w.close(); }
            }
        } catch { /* layout chưa sẵn sàng — lần quét sau sẽ xử lý */ }
    }

    // Hiện trình Khám phá + bung thư mục làm việc để thấy danh sách tệp ngay.
    protected async moExplorer(app: FrontendApplication): Promise<void> {
        try {
            await app.shell.revealWidget(EXPLORER_CONTAINER_ID);
            const nav = app.shell.getWidgets('left').find(w => w.id === 'files') as
                { model?: { root?: unknown; expandNode?: (n: unknown) => unknown } } | undefined;
            const root = nav?.model?.root;
            if (nav?.model?.expandNode && root) { nav.model.expandNode(root); }
        } catch { /* không hiện được — không sao, người dùng tự mở */ }
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
        // Chờ plugin đăng ký lệnh bằng SỰ KIỆN (onCommandsChanged) thay vì polling 500ms.
        if (!await this.doiLenh(lenhGiuaManHinh, 30000)) {
            return; // plugin không nạp được trong 30s — không cố thêm
        }
        // Theia khôi phục layout phiên trước (có thể gồm panel Claude cũ). Chờ NGẮN bằng sự kiện
        // thêm widget: thấy widget Claude thì chỉ focus (tránh mở thành 2 cửa sổ); không thấy mới mở.
        const claudeDangCo = await this.doiWidgetClaude(app, 2000);
        if (claudeDangCo) {
            try { await app.shell.activateWidget(claudeDangCo.id); } catch { /* widget đang tái tạo — bỏ qua */ }
            return;
        }
        try {
            await this.commandRegistry.executeCommand(lenhGiuaManHinh);
        } catch {
            // Một lần dự phòng duy nhất; vẫn lỗi thì dừng — plugin sẽ tự hiện thông báo lỗi của nó.
            try { await this.commandRegistry.executeCommand(lenhThanhBen); } catch { /* dừng, không lặp */ }
        }
    }

    // Chờ một lệnh được đăng ký (theo sự kiện, có timeout). Trả về true nếu lệnh sẵn sàng.
    protected doiLenh(id: string, timeoutMs: number): Promise<boolean> {
        if (this.commandRegistry.getCommand(id)) { return Promise.resolve(true); }
        return new Promise<boolean>(resolve => {
            const to = setTimeout(() => { sub.dispose(); resolve(false); }, timeoutMs);
            const sub = this.commandRegistry.onCommandsChanged(() => {
                if (this.commandRegistry.getCommand(id)) { clearTimeout(to); sub.dispose(); resolve(true); }
            });
        });
    }

    // Chờ widget Claude xuất hiện (do khôi phục layout), theo sự kiện, có timeout.
    protected doiWidgetClaude(app: FrontendApplication, timeoutMs: number): Promise<{ id: string } | undefined> {
        const co = this.timWidgetClaude(app);
        if (co) { return Promise.resolve(co); }
        return new Promise(resolve => {
            const to = setTimeout(() => { sub.dispose(); resolve(undefined); }, timeoutMs);
            const sub = app.shell.onDidAddWidget(() => {
                const w = this.timWidgetClaude(app);
                if (w) { clearTimeout(to); sub.dispose(); resolve(w); }
            });
        });
    }

    // Tìm widget Claude đang tồn tại — ưu tiên vùng soạn thảo chính, sau đó mọi vùng khác
    // (sidebar...). Nhận diện theo id hoặc nhãn tiêu đề vì webview của plugin không có id cố định.
    protected timWidgetClaude(app: FrontendApplication): { id: string } | undefined {
        const laClaude = (w: { id: string; title?: { label?: string } }) =>
            /claude/i.test(w.id) || /claude/i.test(w.title?.label ?? '');
        return app.shell.getWidgets('main').find(laClaude) ?? app.shell.widgets.find(laClaude);
    }
}

import { injectable, inject } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry, Command, URI } from '@theia/core';
import { AbstractViewContribution, CommonMenus, FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { AwordWelcomeWidget } from './aword-welcome-widget';
import { QUY_TAC_CLAUDE_MD } from './aword-setup-prompts';
import { laWidgetClaude } from './aword-claude-widget';

export const AwordWelcomeCommand: Command = {
    id: 'aword:welcome',
    label: 'Trang chào mừng'
};

// Đánh dấu "đã chào mừng" trong localStorage: trang chào mừng chỉ tự mở LẦN ĐẦU;
// các lần sau khởi động thẳng vào khung chat Claude (trải nghiệm kiểu Claude for Windows).
const KHOA_DA_CHAO_MUNG = 'aword.daChaoMung';
// Panel Claude (thanh bên phải) mặc định mới rộng hơn (xem ApplicationShellOptions ở
// aword-chat-frontend-module.ts) chỉ áp dụng cho layout CHƯA từng lưu. Cờ này đảm bảo máy đã
// dùng AWord từ trước (đã lưu bề rộng hẹp cũ) cũng được nong lên MỘT LẦN duy nhất — sau đó tôn
// trọng nếu người dùng tự kéo lại theo ý mình.
const KHOA_DA_NOI_RONG_CLAUDE = 'aword.daNoiRongClaudeSidebar';
const TY_LE_CHIEU_RONG_CLAUDE = 0.33;
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
        // Nong panel Claude một lần cho máy đã có layout lưu sẵn từ trước (xem ghi chú KHOA_DA_NOI_RONG_CLAUDE).
        this.noiRongClaudeMacDinh(app);
        // KHÔNG ép mở thêm Claude ở GIỮA màn hình: extension Claude Code đã tự mở sẵn MỘT khung
        // Claude mặc định (thanh bên, theo preferredLocation=sidebar) + Theia khôi phục panel Claude
        // của phiên trước. Ép mở thêm ở giữa gây HAI cửa sổ Claude (thừa + nặng thêm 1 webview +
        // 1 tiến trình). Người dùng cần khung to hơn thì dùng menu Bố cục → "Claude ra giữa"
        // (menu này gọi lệnh claude-vscode.editor.open trực tiếp, không qua đây).
        // Dọn Claude thừa: layout phiên trước (bản cũ) có thể còn panel Claude ở GIỮA — đóng nó đi
        // NẾU đã có Claude mặc định ở thanh bên (chỉ đóng khi chắc chắn còn Claude khác → không rơi
        // về trạng thái không có Claude nào).
        this.moKhiRanh(() => this.donClaudeThua(app));
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

    // Hiện trình Khám phá + CHỌN NÓ làm tab đang hoạt động ở panel trái (không chỉ "hiện panel" mà
    // còn có thể đang dừng ở tab khác) + bung thư mục làm việc để thấy danh sách tệp ngay.
    protected async moExplorer(app: FrontendApplication): Promise<void> {
        try {
            app.shell.expandPanel('left');
            await app.shell.revealWidget(EXPLORER_CONTAINER_ID);
            await app.shell.activateWidget(EXPLORER_CONTAINER_ID);
            const nav = app.shell.getWidgets('left').find(w => w.id === 'files') as
                { model?: { root?: unknown; expandNode?: (n: unknown) => unknown } } | undefined;
            const root = nav?.model?.root;
            if (nav?.model?.expandNode && root) { nav.model.expandNode(root); }
        } catch { /* không hiện được — không sao, người dùng tự mở */ }
    }

    // Nong panel Claude (thanh bên phải) lên ~33% bề rộng cửa sổ hiện tại — CHỈ MỘT LẦN, cho các
    // máy đã dùng AWord từ trước nên đã có layout lưu sẵn với bề rộng hẹp cũ (ApplicationShellOptions
    // mới chỉ tự áp dụng cho panel CHƯA từng bung). SidePanelHandler#resize tự xử lý đúng cả khi
    // panel đang thu gọn/plugin Claude chưa nạp xong (lưu lại `lastPanelSize`, áp dụng khi bung sau).
    protected noiRongClaudeMacDinh(app: FrontendApplication): void {
        if (window.localStorage.getItem(KHOA_DA_NOI_RONG_CLAUDE)) { return; }
        window.localStorage.setItem(KHOA_DA_NOI_RONG_CLAUDE, '1');
        try {
            const rong = app.shell.node.clientWidth;
            if (rong > 0) { app.shell.resize(Math.round(rong * TY_LE_CHIEU_RONG_CLAUDE), 'right'); }
        } catch { /* shell chưa sẵn sàng — không sao, ApplicationShellOptions vẫn lo lần bung đầu tiên */ }
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

    // Dọn khung chat Claude thừa ở vùng GIỮA: đóng CHỈ KHI đang còn khung chat Claude khác (thanh
    // bên do extension mở mặc định) — không bao giờ đóng hết. Thử ngay, rồi nghe sự kiện thêm widget
    // (tối đa 8s) để bắt cả khi Claude thanh bên/khôi phục layout xuất hiện trễ.
    protected donClaudeThua(app: FrontendApplication): void {
        const thu = (): boolean => {
            const giua = app.shell.getWidgets('main').filter(laWidgetClaude);
            const conKhac = app.shell.widgets.some(w => laWidgetClaude(w) && !giua.includes(w));
            if (giua.length > 0 && conKhac) {
                for (const w of giua) { try { w.close(); } catch { /* đang tái tạo — bỏ qua */ } }
                return true;
            }
            return false;
        };
        if (thu()) { return; }
        const sub = app.shell.onDidAddWidget(() => { if (thu()) { sub.dispose(); } });
        setTimeout(() => sub.dispose(), 8000);
    }
}

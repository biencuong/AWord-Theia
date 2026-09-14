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
// Panel Claude (thanh bên phải) mặc định mới rộng hơn (xem ApplicationShellOptions ở
// aword-chat-frontend-module.ts) chỉ áp dụng cho layout CHƯA từng lưu. Cờ này đảm bảo máy đã
// dùng AWord từ trước (đã lưu bề rộng hẹp cũ) cũng được nong lên MỘT LẦN duy nhất — sau đó tôn
// trọng nếu người dùng tự kéo lại theo ý mình.
const KHOA_DA_NOI_RONG_CLAUDE = 'aword.daNoiRongClaudeSidebar';
const TY_LE_CHIEU_RONG_CLAUDE = 0.33;
// Thư mục làm việc mặc định tạo trong Documents của người dùng ở lần chạy đầu.
const TEN_WORKSPACE_MAC_DINH = 'AWord';
const THU_MUC_CON_MAC_DINH = ['ABOUT ME', 'TEMPLATES', 'PROJECTS', 'CLAUDE OUTPUTS'];

// Các view container ở thanh bên trái KHÔNG hiện khi khởi động — ẩn khỏi activity bar:
// - Quản lý mã nguồn, Kiểm thử, Gỡ lỗi (plugin-ext/scm/test/debug kéo theo, không gỡ khỏi bundle được);
// - Claude Code "danh sách phiên" (claudeVSCodeSessionsList — cũng là một webview giao diện Claude đầy đủ): Claude chỉ
//   để mặc định ở THANH BÊN PHỤ (phải) → khởi động chỉ nạp MỘT khung Claude. Lịch sử phiên vẫn mở được bằng nút đồng hồ
//   trong khung chat hoặc Trợ giúp → "Mở lại phiên trò chuyện Claude gần đây". Theia thêm tiền tố workbench.view.extension.
const CLAUDE_DANH_SACH_PHIEN = 'plugin-view-container:workbench.view.extension.claude-sessions-sidebar';
const ICON_SIDEBAR_AN = ['scm-view-container', 'test-view-container', 'debug', CLAUDE_DANH_SACH_PHIEN];
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
        // Ẩn các icon sidebar không dùng: ẩn NGAY một lần, rồi NGHE SỰ KIỆN thêm widget SUỐT PHIÊN để ẩn nốt view
        // container xuất hiện trễ — plugin có thể nạp rất muộn (máy chậm, hoặc chờ người dùng trả lời hộp thoại "tin
        // tưởng thư mục"), nên không đặt mốc thời gian. Mỗi lần chỉ duyệt vài widget thanh trái — không đáng kể.
        // Áp dụng mọi nhánh bên dưới, cả bản app lẫn bản web.
        this.anIconSidebar(app);
        app.shell.onDidAddWidget(() => this.anIconSidebar(app));
        // Di trú tên gọi Kho tri thức AI (bản thử nghiệm) nay do AwordKhoTriThucContribution làm cùng lượt tự kết nối
        // khi mở AWord (áp lại vai nếu còn hook tên cũ/thiếu quyền) — không gọi datVai hai lần song song.

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
        // KHÔNG đóng khung Claude mà Theia khôi phục từ phiên trước (thẻ giữa màn hình, danh sách phiên đang mở):
        // đó là việc người dùng đang làm dở — extension tự khởi động lại đúng cuộc trò chuyện để làm tiếp.
    }

    // Ẩn các view container trong ICON_SIDEBAR_AN khỏi thanh bên trái. Nếu cái bị ẩn đang là tab được chọn (danh sách
    // phiên Claude hay tự chiếm tab khi plugin nạp xong) thì trả thanh trái về Trình khám phá, không để trống.
    protected anIconSidebar(app: FrontendApplication): void {
        try {
            for (const w of app.shell.getWidgets('left')) {
                if (!ICON_SIDEBAR_AN.includes(w.id)) { continue; }
                const dangChon = app.shell.leftPanelHandler.tabBar.currentTitle?.owner === w;
                w.close();
                if (dangChon && app.shell.getWidgets('left').some(x => x.id === EXPLORER_CONTAINER_ID)) {
                    app.shell.activateWidget(EXPLORER_CONTAINER_ID).catch(() => { /* chưa sẵn sàng */ });
                }
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
}

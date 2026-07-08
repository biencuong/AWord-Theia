import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandService, MessageService, URI } from '@theia/core';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PROMPT_THIET_LAP_WORKSPACE, PROMPT_DE_XUAT_PLUGIN } from './aword-setup-prompts';

// Hướng dẫn sử dụng nhanh — giữ ngắn gọn, mỗi mục một hành động cụ thể.
const HUONG_DAN: { icon: string; text: string }[] = [
    { icon: '📁', text: 'Mở thư mục tài liệu/dự án của bạn (Tệp → Mở thư mục, hoặc nút bên trái).' },
    { icon: '🤖', text: 'Mở Claude ở thanh bên phải (biểu tượng Claude, hoặc Ctrl+Escape) rồi gõ yêu cầu bằng tiếng Việt.' },
    { icon: '@', text: 'Gõ @ trong khung chat để đính kèm tệp làm ngữ cảnh; bôi đen đoạn văn bản rồi hỏi về đoạn đó.' },
    { icon: '✏️', text: 'Claude đọc và sửa tệp trực tiếp — mỗi thay đổi đều hiện diff để bạn duyệt trước khi chấp nhận.' },
    { icon: '⚡', text: 'AWord có sẵn 18 kỹ năng (soạn thảo docx, bảng tính, trình chiếu, xử lý văn bản đến...) — cứ mô tả việc cần làm, Claude tự chọn kỹ năng phù hợp.' },
    { icon: '📚', text: 'Tra cứu văn bản cơ quan: chạy "Kết nối Kho dữ liệu (AWord)" trong Start Menu một lần (nhập địa chỉ + mã khóa do quản trị cấp) — sau đó hỏi Claude về văn bản, quy định; Claude tự tra kho và trích dẫn số ký hiệu.' },
    { icon: '🔄', text: 'Cập nhật phiên bản mới trong menu Trợ giúp → Cập nhật phiên bản mới.' },
];

@injectable()
export class AwordWelcomeWidget extends ReactWidget {

    static readonly ID = 'aword.welcome';
    static readonly LABEL = 'Chào mừng';

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(WindowService)
    protected readonly windowService!: WindowService;

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    protected ganDay: string[] = [];

    @postConstruct()
    protected init(): void {
        this.doInit();
    }

    protected async doInit(): Promise<void> {
        this.id = AwordWelcomeWidget.ID;
        this.title.label = AwordWelcomeWidget.LABEL;
        this.title.caption = 'Trang chào mừng AWord';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-home';
        this.update();
        try {
            const list = await this.workspaceService.recentWorkspaces();
            this.ganDay = (list ?? []).slice(0, 8);
        } catch { this.ganDay = []; }
        this.update();
    }

    render(): React.ReactElement {
        return <div className='aword-welcome'>
            <div className='aword-welcome-inner'>
                <div className='aword-about-header aword-welcome-header'>
                    <div className='aword-about-logo'>A</div>
                    <div>
                        <div className='aword-about-title'>AWord</div>
                        <div className='aword-about-subtitle'>Giải pháp AI &amp; Chuyển đổi số cho cơ quan, doanh nghiệp</div>
                    </div>
                </div>
                <div className='aword-welcome-columns'>
                    <div className='aword-welcome-col'>
                        <h3>Bắt đầu</h3>
                        <button className='theia-button main aword-welcome-btn' onClick={() => this.moThuMuc()}>📁 Mở thư mục…</button>
                        <button className='theia-button secondary aword-welcome-btn' onClick={() => this.moClaude()}>🤖 Trò chuyện với Claude</button>

                        <h3>Thiết lập ban đầu</h3>
                        <p className='aword-welcome-setup-note'>
                            Lần đầu dùng AWord? Bấm nút dưới — Claude sẽ hỏi bạn <b>từng câu một</b> (tên, cơ quan,
                            công việc, văn phong…) rồi tự dựng cấu trúc thư mục làm việc chuẩn
                            (ABOUT ME / TEMPLATES / PROJECTS / CLAUDE OUTPUTS) kèm quy tắc soạn thảo Nghị định 30.
                        </p>
                        <button className='theia-button main aword-welcome-btn' onClick={() => this.guiPromptChoClaude(PROMPT_THIET_LAP_WORKSPACE, 'thiết lập không gian làm việc')}>🚀 Thiết lập không gian làm việc</button>
                        <button className='theia-button secondary aword-welcome-btn' onClick={() => this.guiPromptChoClaude(PROMPT_DE_XUAT_PLUGIN, 'đề xuất plugin')}>🧩 Đề xuất plugin theo công việc</button>

                        <h3>Mở gần đây</h3>
                        {this.ganDay.length === 0
                            ? <div className='aword-welcome-empty'>Chưa có mục nào — hãy mở thư mục đầu tiên của bạn.</div>
                            : <ul className='aword-welcome-recent'>
                                {this.ganDay.map(uri => this.renderMucGanDay(uri))}
                            </ul>}
                    </div>
                    <div className='aword-welcome-col'>
                        <h3>Hướng dẫn nhanh</h3>
                        <ul className='aword-welcome-guide'>
                            {HUONG_DAN.map((m, i) => <li key={i}><span className='aword-welcome-guide-icon'>{m.icon}</span>{m.text}</li>)}
                        </ul>

                        <h3>Về AWord</h3>
                        <p className='aword-welcome-about'>
                            AWord đồng hành cùng các cơ quan và doanh nghiệp đưa trí tuệ nhân tạo (AI) và chuyển đổi số vào công việc
                            hằng ngày — tự động hóa quy trình, tiết kiệm thời gian, nâng cao hiệu quả và năng suất một cách bền vững.
                        </p>
                        <p className='aword-welcome-about'>
                            <b>Hotline / Zalo:</b> 0983 606 845 &nbsp;·&nbsp;
                            <a href='#' onClick={e => { e.preventDefault(); this.moTrangChu(); }}>Trang chủ aword.vn</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>;
    }

    protected renderMucGanDay(uri: string): React.ReactElement {
        let ten = uri, duongDan = uri;
        try {
            const u = new URI(uri);
            ten = u.path.base || uri;
            duongDan = u.path.fsPath();
        } catch { /* giữ nguyên chuỗi gốc */ }
        return <li key={uri}>
            <a href='#' onClick={e => { e.preventDefault(); this.moWorkspace(uri); }} title={duongDan}>{ten}</a>
            <span className='aword-welcome-recent-path'>{duongDan}</span>
        </li>;
    }

    protected moThuMuc(): void {
        this.commandService.executeCommand('workspace:openFolder').catch(() =>
            this.commandService.executeCommand('workspace:open'));
    }

    protected moClaude(): void {
        this.commandService.executeCommand('claude-vscode.sidebar.open').catch(() =>
            this.commandService.executeCommand('claude-vscode.editor.open')).catch(() => { /* plugin chưa sẵn sàng */ });
    }

    // Khung chat của Claude là webview đóng — không bơm chữ trực tiếp được;
    // sao chép prompt vào clipboard rồi mở Claude để người dùng dán (Ctrl+V) và gửi.
    protected async guiPromptChoClaude(prompt: string, tenViec: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(prompt);
            this.moClaude();
            this.messageService.info(
                `Đã sao chép nội dung ${tenViec}. Bấm vào ô nhập của Claude (bên phải), dán bằng Ctrl+V rồi nhấn Enter để bắt đầu.`,
                { timeout: 15000 }
            );
        } catch {
            this.messageService.warn('Không sao chép được nội dung — hãy thử lại.');
        }
    }

    protected moWorkspace(uri: string): void {
        try {
            this.workspaceService.open(new URI(uri));
        } catch { /* uri hỏng — bỏ qua */ }
    }

    protected moTrangChu(): void {
        this.windowService.openNewWindow('https://aword.vn', { external: true });
    }
}

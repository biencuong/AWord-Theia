import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandService, MessageService, URI } from '@theia/core';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PROMPT_CHON_NHOM_KY_NANG, PROMPT_THIET_LAP_GIAO_VIEN, PROMPT_THIET_LAP_HANH_CHINH } from './aword-setup-prompts';
import { AWORD_LOGO_SVG } from './aword-logo';

// Hướng dẫn sử dụng nhanh — giữ ngắn gọn, mỗi mục một hành động cụ thể.
const HUONG_DAN: { icon: string; text: string }[] = [
    { icon: '🤖', text: 'Khung chat Claude nằm ở thanh bên phải — gõ yêu cầu bằng tiếng Việt và Enter để gửi (Ctrl+Escape để quay lại khung chat bất cứ lúc nào).' },
    { icon: '📁', text: 'AWord tự tạo thư mục làm việc Documents\\AWord ở lần đầu; muốn làm việc trên thư mục khác thì Tệp → Mở thư mục.' },
    { icon: '@', text: 'Gõ @ trong khung chat để đính kèm tệp làm ngữ cảnh; hoặc chuột phải tệp trong Explorer → "Thêm vào Claude Code (@)"; kéo-thả tệp vào khung chat cũng được.' },
    { icon: '📄', text: 'Đọc mọi loại văn bản: docx, xlsx, pdf — kể cả PDF scan và ảnh chụp; cứ đưa tệp và yêu cầu "đọc/tóm tắt", Claude tự xử lý.' },
    { icon: '✏️', text: 'Claude đọc và sửa tệp trực tiếp — mỗi thay đổi đều hiện diff để bạn duyệt trước khi chấp nhận.' },
    { icon: '⚡', text: 'AWord có sẵn gần 40 kỹ năng (văn bản Nghị định 30, xử lý văn bản đến, giáo án, đề kiểm tra, trình chiếu, bảng tính...) — cứ mô tả việc cần làm, Claude tự chọn kỹ năng phù hợp.' },
    { icon: '🧠', text: 'Claude tự ghi nhớ việc đang làm vào thư mục ẩn .aword/bo-nho trong thư mục làm việc — phiên sau nối tiếp liền mạch; công cụ AI khác cũng dùng chung được qua tệp AGENTS.md.' },
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
                    <div className='aword-about-logo' dangerouslySetInnerHTML={{ __html: AWORD_LOGO_SVG }} />
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
                            Lần đầu dùng AWord? Chọn đúng vai trò — Claude sẽ hỏi bạn <b>từng câu một</b> rồi tự dựng
                            thư mục làm việc, quy tắc và bộ nhớ làm việc phù hợp với công việc của bạn.
                        </p>
                        <button className='theia-button main aword-welcome-btn' onClick={() => this.guiPromptChoClaude(PROMPT_THIET_LAP_GIAO_VIEN, 'thiết lập cho giáo viên')}>🎓 Tôi là giáo viên</button>
                        <button className='theia-button main aword-welcome-btn' onClick={() => this.guiPromptChoClaude(PROMPT_THIET_LAP_HANH_CHINH, 'thiết lập cho công tác hành chính')}>🏛️ Tôi làm công tác hành chính</button>
                        <button className='theia-button secondary aword-welcome-btn' onClick={() => this.guiPromptChoClaude(PROMPT_CHON_NHOM_KY_NANG, 'bật/tắt nhóm kỹ năng')}>🧩 Bật/tắt nhóm kỹ năng</button>

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
        // Ưu tiên thanh bên (khung chat mặc định, đã có sẵn) — mở thêm khung giữa màn hình là thêm một
        // webview + một tiến trình claude.exe (~250 MB). Giữa màn hình chỉ là dự phòng.
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
                `Đã sao chép nội dung ${tenViec}. Bấm vào ô nhập của khung chat Claude, dán bằng Ctrl+V rồi nhấn Enter để bắt đầu.`,
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

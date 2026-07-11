import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry, CommandService,
    MenuContribution, MenuModelRegistry, MAIN_MENU_BAR, MutableCompoundMenuNode,
    MessageService, SelectionService, URI
} from '@theia/core';
import { CommonMenus, ConfirmDialog, Dialog } from '@theia/core/lib/browser';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { ApplicationServer } from '@theia/core/lib/common/application-protocol';
import { UriAwareCommandHandler } from '@theia/core/lib/common/uri-command-handler';
import { NavigatorContextMenu } from '@theia/navigator/lib/browser/navigator-contribution';
import { WorkspaceService } from '@theia/workspace/lib/browser';

export const AwordAboutCommand: Command = {
    id: 'aword:about',
    label: 'Giới thiệu AWord'
};

export const AwordUpdateCommand: Command = {
    id: 'aword:check-update',
    label: 'Cập nhật phiên bản mới'
};

export const AwordAddToClaudeCommand: Command = {
    id: 'aword:add-to-claude',
    label: 'Thêm vào Claude Code (@)'
};

// Đường dẫn menu "Terminal" do @theia/terminal đăng ký: [...MAIN_MENU_BAR, '7_terminal'].
const TERMINAL_MENU_ID = '7_terminal';
// Repo phát hành — phải khớp electron-app/scripts/inject-auto-update.cjs và Phat_Hanh_AWord.ps1.
const GITHUB_REPO = 'biencuong/AWord-Theia';
const TRANG_CHU = 'https://aword.vn';

function buildAboutMessageNode(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'aword-about-content';

    // Đầu trang: logo chữ A (màu thương hiệu cam, khớp icon app) + tên + phụ đề
    const header = document.createElement('div');
    header.className = 'aword-about-header';
    const logo = document.createElement('div');
    logo.className = 'aword-about-logo';
    logo.textContent = 'A';
    const titleBox = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'aword-about-title';
    title.textContent = 'AWord';
    const subtitle = document.createElement('div');
    subtitle.className = 'aword-about-subtitle';
    subtitle.textContent = 'Giải pháp AI & Chuyển đổi số';
    titleBox.appendChild(title);
    titleBox.appendChild(subtitle);
    header.appendChild(logo);
    header.appendChild(titleBox);
    wrap.appendChild(header);

    const tagline = document.createElement('p');
    tagline.className = 'aword-about-tagline';
    tagline.innerHTML = '<b>AWord</b> — Giải pháp AI &amp; Chuyển đổi số cho cơ quan, doanh nghiệp';
    wrap.appendChild(tagline);

    const lead = document.createElement('p');
    lead.textContent = 'AWord đồng hành cùng các cơ quan và doanh nghiệp đưa trí tuệ nhân tạo (AI) và chuyển đổi số '
        + 'vào công việc hằng ngày — tự động hóa quy trình, tiết kiệm thời gian, nâng cao hiệu quả và năng suất một cách bền vững.';
    wrap.appendChild(lead);

    const contact = document.createElement('p');
    contact.className = 'aword-about-contact';
    contact.innerHTML = '<b>Hotline / Zalo:</b> <a href="tel:0983606845">0983 606 845</a><br>'
        + `<b>Trang chủ:</b> <a href="${TRANG_CHU}" target="_blank">aword.vn</a>`;
    wrap.appendChild(contact);

    return wrap;
}

interface ThongTinRelease {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    assets?: { name: string; browser_download_url: string }[];
}

function soSanhPhienBan(a: string, b: string): number { // >0 nếu a mới hơn b
    const pa = a.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = b.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) { return d; }
    }
    return 0;
}

@injectable()
export class AwordMenuContribution implements CommandContribution, MenuContribution {

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(ApplicationServer)
    protected readonly applicationServer: ApplicationServer;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AwordAboutCommand, {
            // Dựng ConfirmDialog trực tiếp (không qua DI) để tránh lỗi Inversify "asynchronous dependencies"
            // từng gặp khi bind một ReactDialog tuỳ biến làm service — xem ghi chú trong kế hoạch.
            execute: () => new ConfirmDialog({
                title: AwordAboutCommand.label!,
                msg: buildAboutMessageNode(),
                ok: Dialog.OK,
                cancel: ''
            }).open()
        });
        commands.registerCommand(AwordUpdateCommand, {
            execute: () => this.kiemTraCapNhat()
        });
        commands.registerCommand(AwordAddToClaudeCommand, UriAwareCommandHandler.MultiSelect(this.selectionService, {
            execute: uris => this.themVaoClaude(uris),
            isEnabled: uris => uris.length > 0,
            isVisible: uris => uris.length > 0
        }));
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AwordUpdateCommand.id,
            label: AwordUpdateCommand.label,
            order: '0'
        });
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AwordAboutCommand.id,
            label: AwordAboutCommand.label,
            order: '1'
        });
        // Chuột phải trong cây thư mục (Explorer): gửi tham chiếu @tệp vào khung chat Claude.
        menus.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
            commandId: AwordAddToClaudeCommand.id,
            label: AwordAddToClaudeCommand.label,
            order: 'z1'
        });
        // Ẩn menu "Terminal" khỏi thanh menu chính — tính năng Terminal vẫn dùng được qua Command Palette (Ctrl+Shift+P).
        // Dùng onDidChange thay vì FrontendApplicationContribution.onStart() vì thứ tự đăng ký menu giữa các
        // extension không được đảm bảo; lắng nghe sự kiện đảm bảo gỡ đúng lúc menu Terminal xuất hiện, dù trước hay sau.
        this.hideTerminalMenu(menus);
        this.pruneHelpMenu(menus);
        menus.onDidChange(() => {
            this.hideTerminalMenu(menus);
            this.pruneHelpMenu(menus);
        });
    }

    // Kiểm tra release mới nhất trên GitHub, hiện hộp thoại bản cũ/bản mới + tóm tắt nâng cấp.
    protected async kiemTraCapNhat(): Promise<void> {
        let banHienTai = '';
        try {
            banHienTai = (await this.applicationServer.getApplicationInfo())?.version ?? '';
        } catch { /* backend chưa sẵn sàng — vẫn hiện được thông tin bản mới */ }

        let release: ThongTinRelease | undefined;
        let loi: string | undefined;
        try {
            const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
                headers: { 'Accept': 'application/vnd.github+json' }
            });
            if (res.status === 404) {
                loi = 'Chưa có bản phát hành nào trên kênh cập nhật.';
            } else if (!res.ok) {
                loi = `Máy chủ cập nhật trả về lỗi HTTP ${res.status}.`;
            } else {
                release = await res.json();
            }
        } catch {
            loi = 'Không kết nối được máy chủ cập nhật. Kiểm tra kết nối mạng rồi thử lại.';
        }

        const wrap = document.createElement('div');
        wrap.className = 'aword-about-content aword-update-content';

        if (loi || !release) {
            const p = document.createElement('p');
            p.textContent = loi ?? 'Không đọc được thông tin bản phát hành.';
            wrap.appendChild(p);
            if (banHienTai) {
                const cur = document.createElement('p');
                cur.className = 'aword-about-subtitle';
                cur.textContent = `Bạn đang dùng AWord ${banHienTai}.`;
                wrap.appendChild(cur);
            }
            await new ConfirmDialog({ title: AwordUpdateCommand.label!, msg: wrap, ok: Dialog.OK, cancel: '' }).open();
            return;
        }

        const banMoi = (release.tag_name ?? release.name ?? '').replace(/^v/i, '');
        const coBanMoi = banHienTai !== '' && banMoi !== '' && soSanhPhienBan(banMoi, banHienTai) > 0;

        const bang = document.createElement('div');
        bang.className = 'aword-update-versions';
        bang.innerHTML =
            `<div><span class="aword-update-label">Bản đang dùng:</span> <b>${banHienTai || 'không rõ'}</b></div>` +
            `<div><span class="aword-update-label">Bản mới nhất:</span> <b>${banMoi || 'không rõ'}</b></div>`;
        wrap.appendChild(bang);

        const ketLuan = document.createElement('p');
        ketLuan.className = 'aword-update-status';
        ketLuan.textContent = coBanMoi
            ? 'Đã có phiên bản mới! Bấm "Tải bản mới" để tải bộ cài về và chạy cập nhật.'
            : 'Bạn đang dùng phiên bản mới nhất.';
        wrap.appendChild(ketLuan);

        const tomTat = (release.body ?? '').trim();
        if (tomTat) {
            const tieuDe = document.createElement('p');
            tieuDe.innerHTML = '<b>Nội dung nâng cấp:</b>';
            tieuDe.style.marginBottom = '4px';
            wrap.appendChild(tieuDe);
            const noiDung = document.createElement('pre');
            noiDung.className = 'aword-update-notes';
            noiDung.textContent = tomTat.length > 1200 ? tomTat.slice(0, 1200) + '…' : tomTat;
            wrap.appendChild(noiDung);
        }

        const dongY = await new ConfirmDialog({
            title: AwordUpdateCommand.label!,
            msg: wrap,
            ok: coBanMoi ? 'Tải bản mới' : Dialog.OK,
            cancel: coBanMoi ? 'Để sau' : ''
        }).open();

        if (coBanMoi && dongY) {
            const goiCai = release.assets?.find(a => /^AWord-Setup-.*\.exe$/i.test(a.name));
            this.windowService.openNewWindow(goiCai?.browser_download_url ?? release.html_url ?? `https://github.com/${GITHUB_REPO}/releases/latest`, { external: true });
        }
    }

    // Chuột phải trong Explorer -> đưa tham chiếu @tệp/@thư-mục vào khung chat Claude.
    // Khung chat của Claude là webview đóng: KHÔNG thể bơm chữ trực tiếp từ ngoài, và lệnh
    // insertAtMention của extension chỉ đọc editor đang mở (không nhận URI) nên không dùng
    // được từ Explorer. Cách tin cậy 100% và ĐỒNG NHẤT cho cả tệp lẫn thư mục, một hay
    // nhiều mục: sao chép chuỗi @... vào clipboard + mở panel Claude + nhắc dán Ctrl+V.
    protected async themVaoClaude(uris: URI[]): Promise<void> {
        const thamChieu = uris.map(u => '@' + this.duongDanTuongDoi(u)).join(' ');
        try {
            await navigator.clipboard.writeText(thamChieu);
        } catch {
            this.messageService.warn('Không sao chép được tham chiếu vào bộ nhớ tạm.');
            return;
        }
        // Mở khung Claude + TỰ FOCUS sẵn vào ô nhập để người dùng chỉ cần 1 lần Ctrl+V
        // (không phải bấm chuột vào ô). Không thể chèn thẳng chữ: khung chat là webview
        // đóng của Anthropic, và lệnh insertAtMention của extension chỉ đọc editor văn bản
        // đang mở — mà .docx/.pdf/.xlsx mở bằng trình xem riêng nên không dùng được.
        try {
            await this.commandService.executeCommand('claude-vscode.sidebar.open')
                .catch(() => this.commandService.executeCommand('claude-vscode.editor.open'));
            await new Promise(r => setTimeout(r, 250));
            await this.commandService.executeCommand('claude-vscode.focus').catch(() => { /* không sao */ });
        } catch { /* plugin chưa sẵn sàng — tham chiếu vẫn nằm trong clipboard */ }
        this.messageService.info(
            `Đã sao chép ${thamChieu} — nhấn Ctrl+V để chỉ dẫn cho Claude (con trỏ đã sẵn trong ô nhập).`,
            { timeout: 12000 }
        );
    }

    protected duongDanTuongDoi(uri: URI): string {
        for (const root of this.workspaceService.tryGetRoots()) {
            const rel = root.resource.relative(uri);
            if (rel) {
                return rel.toString();
            }
        }
        return uri.path.base || uri.toString();
    }

    private hideTerminalMenu(menus: MenuModelRegistry): void {
        const menuBar = menus.getMenu(MAIN_MENU_BAR);
        const terminalNode = menuBar?.children.find(child => child.id === TERMINAL_MENU_ID);
        if (terminalNode && menuBar && MutableCompoundMenuNode.is(menuBar)) {
            menuBar.removeNode(terminalNode);
        }
    }

    // Menu Trợ giúp chỉ giữ lại các mục của AWord; gỡ mọi mục khác
    // (About mặc định của Theia, Getting Started, tài liệu online...).
    private pruneHelpMenu(menus: MenuModelRegistry): void {
        const help = menus.getMenu(CommonMenus.HELP);
        if (!help || !MutableCompoundMenuNode.is(help)) {
            return;
        }
        const giuLai = new Set<string>([AwordAboutCommand.id, AwordUpdateCommand.id, 'aword:welcome']);
        for (const child of [...help.children]) {
            if (!giuLai.has(child.id)) {
                help.removeNode(child);
            }
        }
    }
}

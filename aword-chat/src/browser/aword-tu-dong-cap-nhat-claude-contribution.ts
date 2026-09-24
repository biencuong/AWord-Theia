import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService, environment
} from '@theia/core';
import { CommonMenus, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CapNhatClaudeCodeServer, soSanhPhienBanSo } from '../common/cap-nhat-claude-code-protocol';
import { AwordMenuContribution } from './aword-menu-contribution';

export const AwordTuDongCapNhatClaudeCommand: Command = {
    id: 'aword:tu-dong-cap-nhat-claude-code',
    label: 'Tự động cập nhật Claude Code'
};

// Công tắc lưu theo máy (localStorage của AWord). Mặc định BẬT; chỉ lưu khi người dùng TẮT.
const KHOA_TAT = 'aword.tuDongCapNhatClaudeCode.tat';
// Lần kiểm tra đầu chờ AWord mở xong và Claude Code nạp xong, để không tranh mạng/CPU lúc khởi động.
const TRE_LAN_DAU_MS = 90 * 1000;
// Sau đó kiểm tra lại định kỳ — AWord để mở cả ngày vẫn nhận bản mới trong ngày.
const CHU_KY_MS = 6 * 60 * 60 * 1000;

// Tự cập nhật Claude Code THEO THỜI GIAN THỰC, không chờ đóng gói bản AWord mới: định kỳ hỏi bản mới nhất
// (Open VSX, trừ bản người duy trì chặn trong danh mục — xem CapNhatClaudeCodeServer#layBanMoiNhat), tải
// ngầm, rồi mời khởi động lại. Plugin chỉ được Theia nạp lúc khởi động nên bản mới có hiệu lực từ lần mở
// AWord kế tiếp; người dùng không bấm "Khởi động lại" thì lần sau mở AWord là tự dùng bản mới.
@injectable()
export class AwordTuDongCapNhatClaudeContribution implements FrontendApplicationContribution, CommandContribution, MenuContribution {

    @inject(CapNhatClaudeCodeServer)
    protected readonly server: CapNhatClaudeCodeServer;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(AwordMenuContribution)
    protected readonly menu: AwordMenuContribution;

    private dangKiemTra = false;

    onStart(): void {
        // Bản trên trình duyệt dùng Claude Code của máy chủ — việc cập nhật do quản trị máy chủ lo.
        if (!environment.electron.is()) {
            return;
        }
        setTimeout(() => this.kiemTraNen(), TRE_LAN_DAU_MS);
        setInterval(() => this.kiemTraNen(), CHU_KY_MS);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AwordTuDongCapNhatClaudeCommand, {
            execute: () => this.batTat(),
            isToggled: () => this.dangBat(),
            isVisible: () => environment.electron.is()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AwordTuDongCapNhatClaudeCommand.id,
            label: AwordTuDongCapNhatClaudeCommand.label,
            order: '3'
        });
    }

    protected dangBat(): boolean {
        try {
            return window.localStorage.getItem(KHOA_TAT) !== '1';
        } catch {
            return true;
        }
    }

    protected batTat(): void {
        const batMoi = !this.dangBat();
        try {
            if (batMoi) {
                window.localStorage.removeItem(KHOA_TAT);
            } else {
                window.localStorage.setItem(KHOA_TAT, '1');
            }
        } catch { /* không lưu được thì chỉ có tác dụng trong phiên này */ }
        if (batMoi) {
            this.messageService.info('Đã BẬT tự động cập nhật Claude Code: AWord tự tải bản mới khi Anthropic phát hành.', { timeout: 6000 });
            this.kiemTraNen();
        } else {
            this.messageService.info('Đã TẮT tự động cập nhật Claude Code. Vẫn cập nhật tay được ở Trợ giúp → Cập nhật Claude Code.', { timeout: 6000 });
        }
    }

    protected async kiemTraNen(): Promise<void> {
        if (this.dangKiemTra || !this.dangBat()) {
            return;
        }
        this.dangKiemTra = true;
        try {
            await this.server.vaLaiVietHoa().catch(() => undefined);
            const [banDangDung, banMoi] = await Promise.all([
                this.server.layPhienBanDangDung().catch(() => undefined),
                this.server.layBanMoiNhat()
            ]);
            if (!banMoi || (banDangDung && soSanhPhienBanSo(banMoi.phienBan, banDangDung) <= 0)) {
                return;
            }
            await this.server.capNhat(banMoi);
            this.moiKhoiDongLai(banMoi.phienBan);
        } catch (e) {
            // Chạy nền: mất mạng/máy chủ bận thì im lặng thử lại ở chu kỳ sau, không làm phiền người dùng.
            console.warn('[AWord] Tự động cập nhật Claude Code chưa được, sẽ thử lại sau:', e);
        } finally {
            this.dangKiemTra = false;
        }
    }

    protected async moiKhoiDongLai(phienBan: string): Promise<void> {
        const KHOI_DONG_LAI = 'Khởi động lại ngay';
        const chon = await this.messageService.info(
            `Đã tải Claude Code ${phienBan}. Khởi động lại AWord để dùng — hoặc để sau, lần mở AWord tới sẽ tự dùng bản mới.`,
            KHOI_DONG_LAI, 'Để sau'
        );
        if (chon === KHOI_DONG_LAI) {
            this.menu.khoiDongLaiAWord();
        }
    }
}

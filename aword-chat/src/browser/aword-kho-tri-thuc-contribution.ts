import { injectable, inject } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, CommandService, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core';
import { CommonMenus, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { VaiNguoiDungServer } from '../common/vai-nguoi-dung-protocol';
import { KetQuaDongBoTriThuc, KhoTriThucServer } from '../common/kho-tri-thuc-protocol';

export const KetNoiLaiKhoTriThucCommand: Command = {
    id: 'aword.tri-thuc.ket-noi-lai',
    label: 'Kết nối lại Kho tri thức AI giảng dạy'
};
const LENH_KHOI_DONG_LAI_CLAUDE = 'aword.layout.claude-restart';
// Đợi sau khởi động: không tranh tài nguyên với lúc nạp plugin/khung Claude; backend tự khóa nối tiếp.
const TRE_KHI_MO_MS = 3000;

// Kho tri thức AI giảng dạy chạy TỰ ĐỘNG cho vai Giáo viên: mỗi lần mở AWord đồng bộ ngầm (tạo/giữ token, mã máy,
// đăng ký MCP `trithuc` khi máy chủ phản hồi). Chỉ lên tiếng khi vừa kết nối xong (và tự khởi động lại khung Claude
// để nạp công cụ tt_*) hoặc khi máy chủ đã trả lời mà vẫn đăng ký lỗi — mất mạng thì im lặng, lần sau tự thử lại.
@injectable()
export class AwordKhoTriThucContribution implements FrontendApplicationContribution, CommandContribution, MenuContribution {

    @inject(VaiNguoiDungServer) protected readonly vaiServer: VaiNguoiDungServer;
    @inject(KhoTriThucServer) protected readonly khoTriThuc: KhoTriThucServer;
    @inject(CommandService) protected readonly commandService: CommandService;
    @inject(MessageService) protected readonly messageService: MessageService;

    onStart(): void {
        setTimeout(() => { void this.dongBoKhiMo(); }, TRE_KHI_MO_MS);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(KetNoiLaiKhoTriThucCommand, { execute: () => this.ketNoiLai() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: KetNoiLaiKhoTriThucCommand.id,
            label: KetNoiLaiKhoTriThucCommand.label,
            order: 'z2'
        });
    }

    // Vai Giáo viên còn thiếu gì (quy tắc, hook, quyền công cụ — máy nâng cấp từ bản cũ, hoặc còn hook tên cũ) → áp lại
    // vai (idempotent, gồm cả kết nối kho); đủ rồi thì chỉ đồng bộ kết nối kho.
    protected async dongBoKhiMo(): Promise<void> {
        try {
            const tt = await this.vaiServer.docTrangThai();
            if (!tt.vai?.giaoVien) { return; }
            const thieu = !tt.khoiGiaoVienTrongClaudeMd || !tt.hookTriThucDaBat || !tt.quyenTriThucDaBat || tt.hookCuConLai;
            const kq = thieu ? (await this.vaiServer.datVai(tt.vai)).khoTriThuc : await this.khoTriThuc.dongBo();
            if (!kq) { return; }
            if (kq.thayDoiDangKy) {
                this.apDung(kq, true);
            } else if (kq.canhBao.length > 0 && kq.trangThai.mayChu !== 'khong_phan_hoi') {
                kq.canhBao.forEach(cb => this.messageService.warn(cb, { timeout: 20000 }));
            }
        } catch { /* backend chưa sẵn sàng — lần mở sau tự thử lại */ }
    }

    protected async ketNoiLai(): Promise<void> {
        const tienTrinh = await this.messageService.showProgress({ text: 'Đang kết nối Kho tri thức AI giảng dạy…' });
        try {
            const kq = await this.khoTriThuc.dongBo();
            tienTrinh.cancel();
            this.apDung(kq, false);
        } catch (e) {
            tienTrinh.cancel();
            this.messageService.error(`Không kết nối được Kho tri thức AI: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // Báo kết quả; đăng ký vừa đổi → khởi động lại khung Claude để phiên chat nạp (hoặc bỏ) công cụ tt_*.
    apDung(kq: KetQuaDongBoTriThuc, imLangNeuKhongDoi: boolean): void {
        if (kq.thayDoiDangKy || !imLangNeuKhongDoi) {
            this.messageService.info(`Kho tri thức AI: ${kq.trangThai.thongDiep}`, { timeout: 20000 });
        }
        kq.canhBao.forEach(cb => this.messageService.warn(cb, { timeout: 20000 }));
        if (kq.thayDoiDangKy) {
            this.commandService.executeCommand(LENH_KHOI_DONG_LAI_CLAUDE).catch(() => { /* chưa có lệnh bố cục */ });
        }
    }
}

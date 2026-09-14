import { injectable, inject } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, CommandService, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core';
import { CommonMenus, ConfirmDialog, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PreferenceScope, PreferenceService } from '@theia/core/lib/common/preferences';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import {
    BIEN_SETTINGS_WRAPPER, CauHinhDeepSeekServer, TrangThaiDeepSeek, laWrapperCuaAword
} from '../common/cau-hinh-deepseek-protocol';
import { CauHinhDeepSeekDialog } from './aword-cau-hinh-deepseek-dialog';

import '../../src/browser/style/cau-hinh-deepseek.css';

export const AwordCauHinhDeepSeekCommand: Command = {
    id: 'aword:cau-hinh-deepseek',
    label: 'Mô hình AI DeepSeek cho AWord…'
};

// Tùy chọn của extension Claude Code — ghi ở phạm vi Người dùng của AWord (~/.theia/settings.json), là tệp
// riêng của AWord: VS Code và Claude Code dòng lệnh không đọc tệp này.
const PREF_WRAPPER = 'claudeCode.claudeProcessWrapper';
const PREF_ENV = 'claudeCode.environmentVariables';
const LENH_KHOI_DONG_LAI_CLAUDE = 'aword.layout.claude-restart';

// Type (không phải interface) để khớp ràng buộc JSONValue của PreferenceService.inspect.
type BienMoiTruong = { name: string; value?: string };

@injectable()
export class AwordCauHinhDeepSeekContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    @inject(CauHinhDeepSeekServer)
    protected readonly server: CauHinhDeepSeekServer;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AwordCauHinhDeepSeekCommand, { execute: () => this.moCauHinh() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.FILE_SETTINGS_SUBMENU_OPEN, {
            commandId: AwordCauHinhDeepSeekCommand.id,
            label: AwordCauHinhDeepSeekCommand.label,
            order: 'z1'
        });
    }

    // Tự đồng bộ mỗi lần mở AWord: tùy chọn wrapper luôn khớp trạng thái đã lưu (vd AWord cài lại sang thư
    // mục khác thì đường dẫn wrapper đổi; đã tắt mà tùy chọn còn sót thì gỡ). Không chặn khởi động.
    onStart(): void {
        this.server.docTrangThai()
            .then(tt => this.dongBoTuyChon(tt))
            .catch(() => { /* backend chưa sẵn sàng — lần mở sau đồng bộ tiếp */ });
    }

    protected async moCauHinh(): Promise<void> {
        let tt: TrangThaiDeepSeek;
        try {
            tt = await this.server.docTrangThai();
        } catch (e) {
            this.messageService.error(`Không đọc được cấu hình DeepSeek: ${this.loi(e)}`);
            return;
        }
        if (!tt.hoTro) {
            this.messageService.warn(tt.loi ?? 'Máy này chưa hỗ trợ cấu hình DeepSeek cho AWord.');
            return;
        }
        const hopThoai = new CauHinhDeepSeekDialog(
            tt,
            (apiKey, model) => this.server.kiemTraKetNoi(apiKey, model),
            url => this.windowService.openNewWindow(url, { external: true })
        );
        const giaTri = await hopThoai.open();
        if (!giaTri) { return; }

        let ttMoi: TrangThaiDeepSeek;
        try {
            ttMoi = await this.server.luuCauHinh(giaTri);
            await this.dongBoTuyChon(ttMoi);
        } catch (e) {
            this.messageService.error(`Không lưu được cấu hình DeepSeek: ${this.loi(e)}`);
            return;
        }

        const coThayDoi = ttMoi.bat !== tt.bat || (ttMoi.bat && (!!giaTri.apiKey || ttMoi.model !== tt.model || ttMoi.effort !== tt.effort));
        if (!coThayDoi) {
            this.messageService.info('Đã lưu cấu hình DeepSeek — không có thay đổi cần áp dụng.', { timeout: 5000 });
            return;
        }
        const khoiDongLai = await new ConfirmDialog({
            title: AwordCauHinhDeepSeekCommand.label!.replace(/…$/, ''),
            msg: (ttMoi.bat
                ? 'Đã bật DeepSeek cho AWord.'
                : 'Đã tắt DeepSeek — AWord quay về kết nối AI như trước.')
                + ' Khởi động lại Claude ngay để áp dụng? Cuộc trò chuyện đang mở sẽ được đóng; có thể mở lại qua Trợ giúp → Mở lại phiên trò chuyện Claude gần đây.',
            ok: 'Khởi động lại Claude',
            cancel: 'Để sau'
        }).open();
        if (khoiDongLai) {
            // Chờ tùy chọn mới truyền sang tiến trình plugin trước khi Claude được sinh lại.
            await new Promise(r => setTimeout(r, 800));
            this.commandService.executeCommand(LENH_KHOI_DONG_LAI_CLAUDE).catch(() => { /* lệnh chưa sẵn sàng */ });
        } else {
            this.messageService.info('Cấu hình DeepSeek sẽ áp dụng cho lần khởi động Claude tiếp theo.', { timeout: 6000 });
        }
    }

    // Chỉ ghi khi khác giá trị hiện tại; không đụng wrapper do người dùng tự đặt và các biến môi trường khác.
    protected async dongBoTuyChon(tt: TrangThaiDeepSeek): Promise<void> {
        await this.preferenceService.ready;
        const wrapperHienTai = this.preferenceService.inspect<string>(PREF_WRAPPER)?.globalValue;
        const envHienTai = this.preferenceService.inspect<BienMoiTruong[]>(PREF_ENV)?.globalValue;
        const dsEnv = Array.isArray(envHienTai) ? envHienTai : [];
        const envKhac = dsEnv.filter(e => e?.name !== BIEN_SETTINGS_WRAPPER);

        if (tt.bat && tt.duongDanWrapper) {
            if (wrapperHienTai !== tt.duongDanWrapper) {
                await this.preferenceService.set(PREF_WRAPPER, tt.duongDanWrapper, PreferenceScope.User);
            }
            const envMoi = [...envKhac, { name: BIEN_SETTINGS_WRAPPER, value: tt.duongDanSettings }];
            if (JSON.stringify(envMoi) !== JSON.stringify(dsEnv)) {
                await this.preferenceService.set(PREF_ENV, envMoi, PreferenceScope.User);
            }
            return;
        }
        if (laWrapperCuaAword(wrapperHienTai)) {
            await this.preferenceService.set(PREF_WRAPPER, undefined, PreferenceScope.User);
        }
        if (envKhac.length !== dsEnv.length) {
            await this.preferenceService.set(PREF_ENV, envKhac.length ? envKhac : undefined, PreferenceScope.User);
        }
    }

    protected loi(e: unknown): string {
        const thongBao = e instanceof Error ? e.message : String(e);
        // Lỗi RPC từ backend có dạng "Request 'luuCauHinh' failed ... Error: <thông điệp>" — lấy phần thông điệp.
        return thongBao.replace(/^[\s\S]*?Error:\s*/, '');
    }
}

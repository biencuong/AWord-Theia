import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core';
import {
    bindViewContribution, FrontendApplicationContribution, WidgetFactory, WebSocketConnectionProvider,
    ApplicationShellOptions
} from '@theia/core/lib/browser';
import { AwordMenuContribution } from './aword-menu-contribution';
import { AwordLayoutContribution } from './aword-layout-contribution';
import { AwordWelcomeWidget } from './aword-welcome-widget';
import { AwordWelcomeContribution } from './aword-welcome-contribution';
import { CapNhatClaudeCodeServer, CAP_NHAT_CLAUDE_CODE_PATH } from '../common/cap-nhat-claude-code-protocol';
import { VaiNguoiDungServer, VAI_NGUOI_DUNG_PATH } from '../common/vai-nguoi-dung-protocol';
import { CauHinhDeepSeekServer, CAU_HINH_DEEPSEEK_PATH } from '../common/cau-hinh-deepseek-protocol';
import { AwordCauHinhDeepSeekContribution } from './aword-cau-hinh-deepseek-contribution';
import { KhoTriThucServer, KHO_TRI_THUC_PATH } from '../common/kho-tri-thuc-protocol';
import { AwordKhoTriThucContribution } from './aword-kho-tri-thuc-contribution';
import { ChiSoTokenServer, CHI_SO_TOKEN_PATH } from '../common/chi-so-token-protocol';
import { AwordThongKeWidget } from './aword-thong-ke-widget';
import { AwordChiSoTokenWidget } from './aword-chi-so-token-widget';
import { AwordThongKeContribution } from './aword-thong-ke-contribution';
import { AwordTuDongCapNhatClaudeContribution } from './aword-tu-dong-cap-nhat-claude-contribution';
import { FileResourceResolver } from '@theia/filesystem/lib/browser/file-resource';
import { AwordFileResourceResolver } from './aword-mo-tep-nhi-phan';

import '../../src/browser/style/index.css';
import '../../src/browser/style/thong-bao-giua.css';
import '../../src/browser/style/chi-so-token.css';

// Package aword-chat: tùy biến AWord trên nền Theia — menu (ẩn Terminal, tinh gọn Xem/Trợ giúp),
// trang Chào mừng, khởi động chat-first (tự tạo workspace + mở khung chat Claude giữa màn hình).
// LƯU Ý an toàn DI: không bind ReactDialog tuỳ biến làm service (từng gây lỗi Inversify LAZY_IN_SYNC
// làm gãy plugin Claude Code) — dialog luôn dựng trực tiếp bằng `new`; widget/factory chuẩn thì an toàn.
export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    // Panel Claude (thanh bên phải) mặc định của Theia chỉ rộng ~19% cửa sổ (initialSizeRatio
    // 0.191 trong @theia/core) — hẹp cho một khung chat. Nới lên ~33% (gấp ~1,75 lần), vẫn là TỶ
    // LỆ nên tự co giãn theo kích thước màn hình ("tùy giao diện"), không phải số pixel cố định.
    // Chỉ áp dụng cho workspace CHƯA có layout lưu sẵn — máy đã dùng AWord trước đó (đã lưu bề
    // rộng cũ) được nong bù một lần trong AwordWelcomeContribution#onDidInitializeLayout.
    rebind(ApplicationShellOptions).toConstantValue({
        rightPanel: { initialSizeRatio: 0.33 }
    });

    // Tệp nhị phân không có trình xem: tự mở bằng ứng dụng Windows thay vì hộp thoại "Bạn vẫn muốn mở?" (như VS Code).
    rebind(FileResourceResolver).to(AwordFileResourceResolver).inSingletonScope();

    bind(CapNhatClaudeCodeServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<CapNhatClaudeCodeServer>(CAP_NHAT_CLAUDE_CODE_PATH);
    }).inSingletonScope();
    // Dịch vụ "Vai của bạn" (trang Chào mừng) — mọi thao tác tệp cấu hình cá nhân làm ở backend.
    bind(VaiNguoiDungServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<VaiNguoiDungServer>(VAI_NGUOI_DUNG_PATH);
    }).inSingletonScope();

    // "Mô hình AI DeepSeek cho AWord" (Tệp → Tùy chọn) — hộp thoại dựng bằng `new`, chỉ contribution nằm trong DI.
    bind(CauHinhDeepSeekServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<CauHinhDeepSeekServer>(CAU_HINH_DEEPSEEK_PATH);
    }).inSingletonScope();
    bind(AwordCauHinhDeepSeekContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordCauHinhDeepSeekContribution);
    bind(MenuContribution).toService(AwordCauHinhDeepSeekContribution);
    bind(FrontendApplicationContribution).toService(AwordCauHinhDeepSeekContribution);

    // Kho tri thức AI giảng dạy — tự kết nối cho vai Giáo viên khi mở AWord + lệnh "Kết nối lại" ở menu Trợ giúp.
    bind(KhoTriThucServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<KhoTriThucServer>(KHO_TRI_THUC_PATH);
    }).inSingletonScope();
    bind(AwordKhoTriThucContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordKhoTriThucContribution);
    bind(MenuContribution).toService(AwordKhoTriThucContribution);
    bind(FrontendApplicationContribution).toService(AwordKhoTriThucContribution);

    // Chỉ số token và chi phí (đọc sổ phiên Claude Code) — chỉ báo trên thanh tiêu đề và trang thống kê.
    bind(ChiSoTokenServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<ChiSoTokenServer>(CHI_SO_TOKEN_PATH);
    }).inSingletonScope();

    bind(AwordMenuContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordMenuContribution);
    bind(MenuContribution).toService(AwordMenuContribution);

    // Tự cập nhật Claude Code theo thời gian thực (kiểm tra nền lúc mở AWord + mỗi 6 giờ; bật/tắt ở menu Trợ giúp).
    bind(AwordTuDongCapNhatClaudeContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordTuDongCapNhatClaudeContribution);
    bind(MenuContribution).toService(AwordTuDongCapNhatClaudeContribution);
    bind(FrontendApplicationContribution).toService(AwordTuDongCapNhatClaudeContribution);

    bind(AwordLayoutContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordLayoutContribution);
    bind(MenuContribution).toService(AwordLayoutContribution);

    bind(AwordWelcomeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AwordWelcomeWidget.ID,
        createWidget: () => ctx.container.get<AwordWelcomeWidget>(AwordWelcomeWidget)
    })).inSingletonScope();
    bindViewContribution(bind, AwordWelcomeContribution);
    bind(FrontendApplicationContribution).toService(AwordWelcomeContribution);

    // Thống kê token: trang đầy đủ + chỉ báo nhỏ trên thanh tiêu đề.
    // Chỉ báo phải là singleton vì nó tự giữ nhịp hỏi số và theo dõi bề rộng cửa sổ; tạo hai thể hiện là
    // hai vòng hẹn giờ cùng chạy và hai lần ghi đè biến bề rộng.
    bind(AwordThongKeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AwordThongKeWidget.ID,
        createWidget: () => ctx.container.get<AwordThongKeWidget>(AwordThongKeWidget)
    })).inSingletonScope();
    bind(AwordChiSoTokenWidget).toSelf().inSingletonScope();
    bindViewContribution(bind, AwordThongKeContribution);
    bind(FrontendApplicationContribution).toService(AwordThongKeContribution);
});

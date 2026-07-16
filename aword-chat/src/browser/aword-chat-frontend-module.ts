import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import { AwordMenuContribution } from './aword-menu-contribution';
import { AwordWelcomeWidget } from './aword-welcome-widget';
import { AwordWelcomeContribution } from './aword-welcome-contribution';

import '../../src/browser/style/index.css';

// Package aword-chat: tùy biến AWord trên nền Theia — menu (ẩn Terminal, tinh gọn Xem/Trợ giúp),
// trang Chào mừng, khởi động chat-first (tự tạo workspace + mở khung chat Claude giữa màn hình).
// LƯU Ý an toàn DI: không bind ReactDialog tuỳ biến làm service (từng gây lỗi Inversify LAZY_IN_SYNC
// làm gãy plugin Claude Code) — dialog luôn dựng trực tiếp bằng `new`; widget/factory chuẩn thì an toàn.
export default new ContainerModule(bind => {
    bind(AwordMenuContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordMenuContribution);
    bind(MenuContribution).toService(AwordMenuContribution);

    bind(AwordWelcomeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AwordWelcomeWidget.ID,
        createWidget: () => ctx.container.get<AwordWelcomeWidget>(AwordWelcomeWidget)
    })).inSingletonScope();
    bindViewContribution(bind, AwordWelcomeContribution);
    bind(FrontendApplicationContribution).toService(AwordWelcomeContribution);
});

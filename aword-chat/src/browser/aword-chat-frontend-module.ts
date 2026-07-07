import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core';
import { AwordMenuContribution } from './aword-menu-contribution';

import '../../src/browser/style/index.css';

// Ghi chú: widget mẫu "Hello World" (aword-chat-widget.tsx/aword-chat-contribution.ts) được giữ nguyên
// trong repo để tham khảo sau này nhưng KHÔNG bind ở đây — package aword-chat giờ phục vụ mục đích thật:
// ẩn menu Terminal + thêm mục "Giới thiệu AWord" vào menu Trợ giúp (xem aword-menu-contribution.ts).
export default new ContainerModule(bind => {
    bind(AwordMenuContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AwordMenuContribution);
    bind(MenuContribution).toService(AwordMenuContribution);
});

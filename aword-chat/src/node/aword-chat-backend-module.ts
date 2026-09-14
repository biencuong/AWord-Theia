import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { CapNhatClaudeCodeServer, CAP_NHAT_CLAUDE_CODE_PATH } from '../common/cap-nhat-claude-code-protocol';
import { CapNhatClaudeCodeServerImpl } from './cap-nhat-claude-code-server-impl';
import { VaiNguoiDungServer, VAI_NGUOI_DUNG_PATH } from '../common/vai-nguoi-dung-protocol';
import { VaiNguoiDungServerImpl } from './vai-nguoi-dung-server-impl';

export default new ContainerModule(bind => {
    bind(CapNhatClaudeCodeServer).to(CapNhatClaudeCodeServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CAP_NHAT_CLAUDE_CODE_PATH, () =>
            ctx.container.get(CapNhatClaudeCodeServer)
        )
    ).inSingletonScope();

    // "Vai của bạn" (trang Chào mừng): lưu vai, hợp nhất khối quy tắc giáo viên, cây thư mục, hook Kho tri thức AI.
    bind(VaiNguoiDungServer).to(VaiNguoiDungServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(VAI_NGUOI_DUNG_PATH, () =>
            ctx.container.get(VaiNguoiDungServer)
        )
    ).inSingletonScope();
});

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { CapNhatClaudeCodeServer, CAP_NHAT_CLAUDE_CODE_PATH } from '../common/cap-nhat-claude-code-protocol';
import { CapNhatClaudeCodeServerImpl } from './cap-nhat-claude-code-server-impl';

export default new ContainerModule(bind => {
    bind(CapNhatClaudeCodeServer).to(CapNhatClaudeCodeServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CAP_NHAT_CLAUDE_CODE_PATH, () =>
            ctx.container.get(CapNhatClaudeCodeServer)
        )
    ).inSingletonScope();
});

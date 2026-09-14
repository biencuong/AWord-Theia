import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { CapNhatClaudeCodeServer, CAP_NHAT_CLAUDE_CODE_PATH } from '../common/cap-nhat-claude-code-protocol';
import { CapNhatClaudeCodeServerImpl } from './cap-nhat-claude-code-server-impl';
import { VaiNguoiDungServer, VAI_NGUOI_DUNG_PATH } from '../common/vai-nguoi-dung-protocol';
import { VaiNguoiDungServerImpl } from './vai-nguoi-dung-server-impl';
import { CauHinhDeepSeekServer, CAU_HINH_DEEPSEEK_PATH } from '../common/cau-hinh-deepseek-protocol';
import { CauHinhDeepSeekServerImpl } from './cau-hinh-deepseek-server-impl';
import { KhoTriThucServer, KHO_TRI_THUC_PATH } from '../common/kho-tri-thuc-protocol';
import { KhoTriThucServerImpl } from './kho-tri-thuc-server-impl';

export default new ContainerModule(bind => {
    // Kho tri thức AI giảng dạy: tự kết nối cho vai Giáo viên (token, mã máy, đăng ký MCP `trithuc`). Bind TRƯỚC
    // VaiNguoiDungServer vì dịch vụ vai gọi nó khi bật/tắt vai; một thể hiện duy nhất để khóa nối tiếp có hiệu lực.
    bind(KhoTriThucServerImpl).toSelf().inSingletonScope();
    bind(KhoTriThucServer).toService(KhoTriThucServerImpl);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(KHO_TRI_THUC_PATH, () =>
            ctx.container.get(KhoTriThucServer)
        )
    ).inSingletonScope();

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

    // "Mô hình AI DeepSeek cho AWord" (Tệp → Tùy chọn): lưu khóa/cấu hình, tệp --settings riêng, kiểm tra kết nối.
    bind(CauHinhDeepSeekServer).to(CauHinhDeepSeekServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CAU_HINH_DEEPSEEK_PATH, () =>
            ctx.container.get(CauHinhDeepSeekServer)
        )
    ).inSingletonScope();
});

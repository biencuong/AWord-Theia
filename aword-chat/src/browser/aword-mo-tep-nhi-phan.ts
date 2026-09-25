import { injectable, inject } from '@theia/core/shared/inversify';
import { MessageService, nls, URI } from '@theia/core';
import { FileResourceResolver } from '@theia/filesystem/lib/browser/file-resource';

// Theia gặp tệp nhị phân (ảnh, tệp chương trình, dữ liệu…) mà không có trình xem riêng thì bật hộp thoại chặn
// "Tệp là tệp nhị phân hoặc dùng bảng mã văn bản không được hỗ trợ… Bạn vẫn muốn mở?" — người dùng văn phòng
// không hiểu và lỡ bấm "Có" thì trình soạn thảo đổ ra ký tự rác, có thể treo. VS Code không hỏi: tệp có trình xem
// thì mở bằng trình xem (ảnh đã được đặt trình xem mặc định — scripts/lazy-office-plugin.cjs), tệp còn lại thì
// AWord tự giao cho ứng dụng mặc định của Windows (Paint, Photos, Media Player…) và chỉ báo một dòng.
// Chỉ đổi trường hợp TỆP NHỊ PHÂN; tệp văn bản quá lớn vẫn hỏi như cũ (người dùng có thể muốn xem trong AWord).
@injectable()
export class AwordFileResourceResolver extends FileResourceResolver {

    @inject(MessageService)
    protected readonly messageService: MessageService;

    protected override async shouldOpenAsText(uri: URI, error: string): Promise<boolean> {
        const laTepNhiPhan = error === nls.localize('theia/filesystem/fileResource/binaryTitle', 'The file is either binary or uses an unsupported text encoding.');
        if (!laTepNhiPhan || this.applicationState.state !== 'ready') {
            // Lúc khôi phục bố cục (chưa ready) Theia tự mở lại tệp đã mở trước đó — giữ nguyên hành vi gốc.
            return super.shouldOpenAsText(uri, error);
        }
        const ten = this.labelProvider.getName(uri);
        const dienTheia = (window as unknown as { electronTheiaCore?: { openWithSystemApp?: (duongDan: string) => void } }).electronTheiaCore;
        if (uri.scheme === 'file' && dienTheia?.openWithSystemApp) {
            dienTheia.openWithSystemApp(uri.path.fsPath());
            this.messageService.info(`Đã mở “${ten}” bằng ứng dụng mặc định của Windows (tệp không phải văn bản).`, { timeout: 5000 });
        } else {
            this.messageService.info(`“${ten}” không phải tệp văn bản nên không hiển thị trong trình soạn thảo.`, { timeout: 5000 });
        }
        return false;
    }
}

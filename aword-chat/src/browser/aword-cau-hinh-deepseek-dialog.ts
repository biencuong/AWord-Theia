import { AbstractDialog, DialogError, DialogMode } from '@theia/core/lib/browser/dialogs';
import {
    CAC_MODEL_DEEPSEEK, CAC_MUC_SUY_LUAN, KetQuaKiemTraDeepSeek, ModelDeepSeek, MucSuyLuan, TrangThaiDeepSeek, YeuCauLuuDeepSeek
} from '../common/cau-hinh-deepseek-protocol';

const TRANG_LAY_KHOA = 'https://platform.deepseek.com/api_keys';

// Hộp thoại dựng trực tiếp bằng `new` (không bind vào DI — xem ghi chú an toàn DI ở aword-chat-frontend-module.ts).
export class CauHinhDeepSeekDialog extends AbstractDialog<YeuCauLuuDeepSeek> {

    protected readonly oBat: HTMLInputElement;
    protected readonly oKhoa: HTMLInputElement;
    protected readonly oModel: HTMLSelectElement;
    protected readonly oEffort: HTMLSelectElement;
    protected readonly dongKiemTra: HTMLDivElement;

    constructor(
        protected readonly trangThai: TrangThaiDeepSeek,
        protected readonly kiemTra: (apiKey: string, model: ModelDeepSeek) => Promise<KetQuaKiemTraDeepSeek>,
        protected readonly moLienKet: (url: string) => void
    ) {
        super({ title: 'Mô hình AI DeepSeek cho AWord', maxWidth: 580, wordWrap: 'break-word' });
        const goc = document.createElement('div');
        goc.className = 'aword-deepseek';

        const gioiThieu = document.createElement('p');
        gioiThieu.className = 'aword-deepseek-note';
        gioiThieu.textContent = 'Dùng mô hình DeepSeek (qua cổng tương thích Anthropic) cho Claude trong AWord. Chỉ áp dụng cho AWord — '
            + 'Claude Code trong VS Code, dòng lệnh… trên máy này vẫn giữ nguyên cấu hình hiện tại.';
        goc.appendChild(gioiThieu);

        const hangBat = document.createElement('label');
        hangBat.className = 'aword-deepseek-toggle';
        this.oBat = document.createElement('input');
        this.oBat.type = 'checkbox';
        this.oBat.checked = trangThai.bat;
        hangBat.appendChild(this.oBat);
        hangBat.appendChild(document.createTextNode(' Dùng DeepSeek cho AWord'));
        goc.appendChild(hangBat);

        goc.appendChild(this.nhan('Khóa API DeepSeek'));
        const hangKhoa = document.createElement('div');
        hangKhoa.className = 'aword-deepseek-row';
        this.oKhoa = document.createElement('input');
        this.oKhoa.type = 'password';
        this.oKhoa.className = 'theia-input';
        this.oKhoa.autocomplete = 'off';
        this.oKhoa.spellcheck = false;
        this.oKhoa.placeholder = trangThai.coKhoa ? `Đã lưu khóa ${trangThai.khoaRutGon ?? ''} — để trống nếu giữ nguyên` : 'sk-...';
        hangKhoa.appendChild(this.oKhoa);
        const nutHien = document.createElement('button');
        nutHien.className = 'theia-button secondary';
        nutHien.textContent = 'Hiện';
        nutHien.onclick = () => {
            const dangAn = this.oKhoa.type === 'password';
            this.oKhoa.type = dangAn ? 'text' : 'password';
            nutHien.textContent = dangAn ? 'Ẩn' : 'Hiện';
        };
        hangKhoa.appendChild(nutHien);
        goc.appendChild(hangKhoa);

        const layKhoa = document.createElement('div');
        layKhoa.className = 'aword-deepseek-hint';
        const lienKet = document.createElement('a');
        lienKet.href = '#';
        lienKet.textContent = 'Lấy khóa API tại platform.deepseek.com';
        lienKet.onclick = e => { e.preventDefault(); this.moLienKet(TRANG_LAY_KHOA); };
        layKhoa.appendChild(lienKet);
        goc.appendChild(layKhoa);

        goc.appendChild(this.nhan('Mô hình chính'));
        this.oModel = this.chon(CAC_MODEL_DEEPSEEK, trangThai.model);
        goc.appendChild(this.oModel);

        goc.appendChild(this.nhan('Mức suy luận'));
        this.oEffort = this.chon(CAC_MUC_SUY_LUAN, trangThai.effort);
        goc.appendChild(this.oEffort);

        const hangKiemTra = document.createElement('div');
        hangKiemTra.className = 'aword-deepseek-row aword-deepseek-test';
        const nutKiemTra = document.createElement('button');
        nutKiemTra.className = 'theia-button secondary';
        nutKiemTra.textContent = 'Kiểm tra kết nối';
        this.dongKiemTra = document.createElement('div');
        this.dongKiemTra.className = 'aword-deepseek-result';
        nutKiemTra.onclick = async () => {
            nutKiemTra.disabled = true;
            this.dongKiemTra.className = 'aword-deepseek-result';
            this.dongKiemTra.textContent = 'Đang kiểm tra…';
            try {
                const kq = await this.kiemTra(this.oKhoa.value.trim(), this.oModel.value as ModelDeepSeek);
                this.dongKiemTra.textContent = kq.thongBao;
                this.dongKiemTra.classList.add(kq.ok ? 'ok' : 'loi');
            } catch (e) {
                this.dongKiemTra.textContent = `Không kiểm tra được: ${e instanceof Error ? e.message : String(e)}`;
                this.dongKiemTra.classList.add('loi');
            } finally {
                nutKiemTra.disabled = false;
            }
        };
        hangKiemTra.appendChild(nutKiemTra);
        hangKiemTra.appendChild(this.dongKiemTra);
        goc.appendChild(hangKiemTra);

        const chuY = document.createElement('p');
        chuY.className = 'aword-deepseek-note';
        chuY.textContent = 'Khóa API chỉ lưu trên máy này (thư mục .aword\\deepseek trong hồ sơ người dùng) và chỉ gửi tới máy chủ DeepSeek. '
            + 'Chi phí tính theo tài khoản DeepSeek; khi Claude tìm kiếm web qua DeepSeek sẽ tốn thêm token.';
        goc.appendChild(chuY);

        this.contentNode.appendChild(goc);
        this.appendCloseButton('Hủy');
        this.appendAcceptButton('Lưu và áp dụng');
    }

    get value(): YeuCauLuuDeepSeek {
        return {
            bat: this.oBat.checked,
            apiKey: this.oKhoa.value.trim(),
            model: this.oModel.value as ModelDeepSeek,
            effort: this.oEffort.value as MucSuyLuan
        };
    }

    protected override isValid(value: YeuCauLuuDeepSeek, mode: DialogMode): DialogError {
        if (mode === 'open' && value.bat && !value.apiKey && !this.trangThai.coKhoa) {
            return 'Nhập khóa API DeepSeek để bật.';
        }
        return '';
    }

    protected nhan(text: string): HTMLDivElement {
        const d = document.createElement('div');
        d.className = 'aword-deepseek-label';
        d.textContent = text;
        return d;
    }

    protected chon<T extends string>(ds: { giaTri: T; nhan: string }[], hienTai: T): HTMLSelectElement {
        const s = document.createElement('select');
        s.className = 'theia-select';
        for (const m of ds) {
            const o = document.createElement('option');
            o.value = m.giaTri;
            o.textContent = m.nhan;
            o.selected = m.giaTri === hienTai;
            s.appendChild(o);
        }
        return s;
    }
}

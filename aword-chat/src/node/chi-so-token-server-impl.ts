// Dịch vụ nền cho chỉ số token: sở hữu đường dẫn thật, bảng giá của người dùng, và vòng đời bộ đọc.
//
// Tách khỏi `kho-so-phien.ts` có chủ đích: tệp kia chỉ biết đọc sổ phiên và không biết gì về đường dẫn
// của AWord, nên kiểm thử được bằng thư mục tạm. Còn đường dẫn thật, quyền tệp và chuyện "bắt đầu đọc khi
// nào" nằm ở đây.

import { injectable } from '@theia/core/shared/inversify';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { BaoCaoToken, ChiSoToken, ChiSoTokenServer } from '../common/chi-so-token-protocol';
import type { GiaModel, SoToken } from '../common/so-token';
import { BANG_GIA_MAC_DINH, traGia } from '../common/bang-gia-mac-dinh';
import { taoKhoSoPhien, type KhoSoPhien } from './kho-so-phien';

const TEN_TEP_BANG_GIA = 'bang-gia.json';

@injectable()
export class ChiSoTokenServerImpl implements ChiSoTokenServer {
    private kho?: KhoSoPhien;
    private bangNguoiDung?: Record<string, GiaModel>;

    // AWORD_HOME chỉ dùng khi kiểm thử cách ly (không đặt trên máy người dùng).
    protected layThuMucHome(): string { return process.env.AWORD_HOME || os.homedir(); }
    protected thuMucAword(): string { return path.join(this.layThuMucHome(), '.aword'); }
    /** Sổ phiên Claude Code — tôn trọng CLAUDE_CONFIG_DIR như mọi nơi khác trong AWord. */
    protected thuMucSoPhien(): string {
        return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(this.layThuMucHome(), '.claude'), 'projects');
    }
    protected tepTrangThai(): string { return path.join(this.thuMucAword(), 'thong-ke', 'trang-thai-doc.json'); }
    protected tepBangGia(): string { return path.join(this.thuMucAword(), 'thong-ke', TEN_TEP_BANG_GIA); }

    /**
     * Bảng giá người dùng tự nhập. Đọc một lần rồi giữ trong bộ nhớ; ghi qua `luuBangGia()`.
     * Tệp hỏng thì coi như chưa có — không được để một tệp JSON sai làm hỏng cả tính năng.
     */
    protected docBangGiaTuTep(): Record<string, GiaModel> {
        if (this.bangNguoiDung) { return this.bangNguoiDung; }
        try {
            const t = JSON.parse(fs.readFileSync(this.tepBangGia(), 'utf8')) as Record<string, GiaModel>;
            this.bangNguoiDung = t && typeof t === 'object' ? t : {};
        } catch {
            this.bangNguoiDung = {};
        }
        return this.bangNguoiDung;
    }

    /** Bảng giá hiệu lực: người dùng nhập trước, rồi tới bảng dựng sẵn của AWord. */
    protected traGiaHieuLuc(model: string): SoToken | undefined {
        return traGia(model, this.docBangGiaTuTep());
    }

    /** Dựng bộ đọc ở lần dùng đầu tiên rồi bắt đầu theo dõi; các lần sau dùng lại. */
    protected layKho(): KhoSoPhien {
        if (this.kho) { return this.kho; }
        this.kho = taoKhoSoPhien({
            goc: this.thuMucSoPhien(),
            tepTrangThai: this.tepTrangThai(),
            traGia: (m: string) => this.traGiaHieuLuc(m),
        });
        void this.kho.batDau().catch(e => console.error('[aword] bắt đầu đọc sổ phiên', e));
        return this.kho;
    }

    async docChiSo(): Promise<ChiSoToken> {
        return this.layKho().docChiSo();
    }

    async docBaoCao(soNgay: number): Promise<BaoCaoToken> {
        const n = Number.isFinite(soNgay) ? Math.max(1, Math.min(3650, Math.floor(soNgay))) : 30;
        return this.layKho().docBaoCao(n);
    }

    async quetNgay(): Promise<void> {
        await this.layKho().quetNgay();
    }

    async quetLai(): Promise<void> {
        await this.layKho().quetLai();
    }

    async docBangGia(): Promise<Record<string, GiaModel>> {
        // Gộp cả bảng dựng sẵn để giao diện hiện được mục nào đang có giá sẵn, mục nào người dùng tự nhập.
        return { ...BANG_GIA_MAC_DINH, ...this.docBangGiaTuTep() };
    }

    async luuBangGia(bang: Record<string, GiaModel>): Promise<void> {
        const sach: Record<string, GiaModel> = {};
        for (const [model, g] of Object.entries(bang)) {
            if (!model || !g) { continue; }
            const so = (v: unknown): number => (Number.isFinite(v) && (v as number) >= 0 ? Math.floor(v as number) : 0);
            sach[model] = { vao: so(g.vao), ra: so(g.ra), cacheDoc: so(g.cacheDoc), cacheGhi: so(g.cacheGhi) };
        }
        const thuMuc = path.dirname(this.tepBangGia());
        fs.mkdirSync(thuMuc, { recursive: true });
        const tam = `${this.tepBangGia()}.tam`;
        await fs.promises.writeFile(tam, JSON.stringify(sach, null, 2), { encoding: 'utf8', mode: 0o600 });
        await fs.promises.rename(tam, this.tepBangGia());
        this.bangNguoiDung = sach;
    }
}

export type { BaoCaoToken, ChiSoToken } from '../common/chi-so-token-protocol';

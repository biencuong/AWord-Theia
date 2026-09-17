// Trang thống kê token và chi phí.
//
// Nguyên tắc xuyên suốt: KHÔNG BAO GIỜ hiện một con số tiền mà ta không giải thích được. Mô hình chưa có
// giá thì hiện "chưa có giá" và nói rõ tổng đang thiếu — người dùng còn biết đường nhập giá. Một con số
// thiếu mà im lặng còn tệ hơn không có con số nào: nó làm sai mọi quyết định dựa trên đó.

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { ChiSoTokenServer, type BaoCaoToken } from '../common/chi-so-token-protocol';
import { ngayNgan, soDayDu, soGon, tienDayDu } from '../common/dinh-dang-so';

/** Số ngày lấy cho các thẻ và biểu đồ. */
const NGAY_BAO_CAO = 60;

interface The {
    nhan: string;
    tien: number;
    token: number;
    luot: number;
}

@injectable()
export class AwordThongKeWidget extends ReactWidget {

    static readonly ID = 'aword.thong-ke';
    static readonly LABEL = 'Thống kê token';

    @inject(ChiSoTokenServer)
    protected readonly chiSoServer!: ChiSoTokenServer;

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    protected baoCao: BaoCaoToken | undefined;
    protected dangTai = true;
    protected dangQuetLai = false;

    @postConstruct()
    protected init(): void {
        this.id = AwordThongKeWidget.ID;
        this.title.label = AwordThongKeWidget.LABEL;
        this.title.closable = true;
        this.addClass('aword-tk');
        void this.tai();
    }

    protected async tai(): Promise<void> {
        try {
            this.baoCao = await this.chiSoServer.docBaoCao(NGAY_BAO_CAO);
        } catch {
            this.messageService.warn('Không đọc được số liệu token. Xem lại kết nối tới tiến trình nền.');
        } finally {
            this.dangTai = false;
            this.update();
        }
    }

    protected async quetLai(): Promise<void> {
        this.dangQuetLai = true;
        this.update();
        try {
            await this.chiSoServer.quetLai();
            await this.tai();
        } finally {
            this.dangQuetLai = false;
            this.update();
        }
    }

    // ---- các khối ----

    protected the(cs: BaoCaoToken['chiSo'], ngay: string[]): The[] {
        // Báo cáo chỉ mang 60 ngày gần nhất; "tất cả" vẫn nằm trong đó vì dữ liệu thật chỉ ~49 ngày.
        const tinh = (loc: (ngay: string) => boolean): The => {
            let tien = 0;
            let token = 0;
            let luot = 0;
            for (const d of this.baoCao?.theoNgay ?? []) {
                if (!loc(d.ngay)) { continue; }
                tien += d.tien;
                token += d.token.vao + d.token.ra;
                luot += d.token.luot;
            }
            return { nhan: '', tien, token, luot };
        };
        const homNay = ngay[ngay.length - 1];
        return [
            { ...tinh(g => g === homNay), nhan: 'Hôm nay' },
            { ...tinh(g => g >= ngay[Math.max(0, ngay.length - 7)]), nhan: '7 ngày' },
            { ...tinh(g => g >= `${(homNay ?? '').slice(0, 7)}-01`), nhan: 'Tháng này' },
            { ...tinh(() => true), nhan: 'Tất cả' },
        ];
    }

    protected renderThe(ds: The[]): React.ReactNode {
        return (
            <div className="aword-tk-the">
                {ds.map(t => (
                    <div className="aword-tk-o" key={t.nhan}>
                        <div className="aword-tk-o-nhan">{t.nhan}</div>
                        <div className="aword-tk-o-tien">{t.tien > 0 ? tienDayDu(t.tien) : '—'}</div>
                        <div className="aword-tk-o-phu">{soGon(t.token)} token · {soDayDu(t.luot)} lượt</div>
                    </div>
                ))}
            </div>
        );
    }

    protected renderBangModel(): React.ReactNode {
        const ds = this.baoCao?.theoModel ?? [];
        if (ds.length === 0) { return <p className="aword-tk-trong">Chưa có dữ liệu.</p>; }
        return (
            <table className="aword-tk-bang">
                <thead>
                    <tr>
                        <th>Mô hình</th>
                        <th className="so">Lượt</th>
                        <th className="so">Token vào</th>
                        <th className="so">Token ra</th>
                        <th className="so">Tiền</th>
                    </tr>
                </thead>
                <tbody>
                    {ds.map(m => (
                        <tr key={m.model}>
                            <td className="mono">{m.model}</td>
                            <td className="so">{soDayDu(m.token.luot)}</td>
                            <td className="so">{soDayDu(m.token.vao)}</td>
                            <td className="so">{soDayDu(m.token.ra)}</td>
                            <td className="so">
                                {m.chuaCoGia
                                    ? <span className="aword-tk-chuag" title="Chưa có giá cho mô hình này — số tiền bị thiếu">chưa có giá</span>
                                    : soDayDu(m.tien) + ' đ'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    /** Biểu đồ cột bằng div/CSS thuần — aword-chat chỉ có react và react-dom, không thêm thư viện. */
    protected renderBieuDo(): React.ReactNode {
        // 30 ngày gần nhất, kể cả ngày không có dữ liệu để trục thời gian không bị đứt quãng.
        const theoNgay = new Map((this.baoCao?.theoNgay ?? []).map(d => [d.ngay, d]));
        const ds: Array<{ ngay: string; tien: number }> = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 3600 * 1000 + 7 * 3600 * 1000);
            const ngay = d.toISOString().slice(0, 10);
            ds.push({ ngay, tien: theoNgay.get(ngay)?.tien ?? 0 });
        }
        const caoNhat = Math.max(1, ...ds.map(d => d.tien));
        return (
            <div className="aword-tk-bieu">
                {ds.map(d => (
                    <div className="aword-tk-cot" key={d.ngay} title={`${d.ngay}: ${d.tien > 0 ? tienDayDu(d.tien) : 'không có lượt'}`}>
                        <div className="aword-tk-cot-than" style={{ height: `${Math.round((d.tien / caoNhat) * 100)}%` }} />
                        <div className="aword-tk-cot-nhan">{ngayNgan(d.ngay)}</div>
                    </div>
                ))}
            </div>
        );
    }

    protected renderNguon(): React.ReactNode {
        const cs = this.baoCao?.chiSo;
        const luc = cs?.lanQuetCuoi ? new Date(cs.lanQuetCuoi).toLocaleString('vi-VN') : '—';
        return (
            <section className="aword-tk-khoi">
                <h3>Nguồn dữ liệu</h3>
                <p className="aword-tk-mo">
                    Số liệu đọc từ sổ phiên của Claude Code trên chính máy này (<code>~/.claude/projects</code>).
                    Không có nội dung trò chuyện nào bị đọc hay gửi đi — chỉ số token và tên mô hình.
                </p>
                <div className="aword-tk-hang">
                    <span>Lần quét xong gần nhất: <b>{luc}</b></span>
                    <button className="aword-tk-nut" onClick={() => void this.quetLai()} disabled={this.dangQuetLai}>
                        {this.dangQuetLai ? 'Đang tính lại…' : 'Tính lại từ đầu'}
                    </button>
                </div>
                {cs && cs.soTepGhiLai > 0
                    ? <p className="aword-tk-muon">
                        Có {cs.soTepGhiLai} tệp sổ phiên bị ghi lại, nên số liệu vừa được tính lại từ đầu cho chính xác.
                    </p>
                    : null}
            </section>
        );
    }

    protected renderGoi(): React.ReactNode {
        return (
            <section className="aword-tk-khoi">
                <h3>Gói token trả trước</h3>
                <p className="aword-tk-mo">
                    Số dư còn lại của gói đã mua sẽ hiện ở đây. Phần này cần máy chủ Kho tri thức cấp quyền
                    theo mã máy — chưa bật ở bản này.
                </p>
                <div className="aword-tk-hang">
                    <span>Số dư: <b>—</b></span>
                </div>
            </section>
        );
    }

    protected render(): React.ReactNode {
        if (this.dangTai) { return <div className="aword-tk"><p className="aword-tk-trong">Đang đọc số liệu…</p></div>; }

        const cs = this.baoCao?.chiSo;
        const ngay = (this.baoCao?.theoNgay ?? []).map(d => d.ngay).sort();
        const thieuGia = cs && cs.soModelChuaCoGia > 0;

        return (
            <div className="aword-tk">
                <header className="aword-tk-dau">
                    <h2>Thống kê token và chi phí</h2>
                    {cs?.dangQuet ? <span className="aword-tk-dang-quet">Đang quét sổ phiên…</span> : null}
                </header>

                {this.renderThe(this.the(cs as BaoCaoToken['chiSo'], ngay))}

                {thieuGia
                    ? <div className="aword-tk-canh">
                        <b>{cs?.soModelChuaCoGia} mô hình chưa có giá</b> — số tiền ở trên đang THIẾU, không phải sai.
                        Vào <i>Tệp → Tùy chọn → Mô hình AI</i> để nhập giá, hoặc chờ Kho tri thức cấp bảng giá.
                    </div>
                    : null}

                <section className="aword-tk-khoi">
                    <h3>Theo mô hình</h3>
                    {this.renderBangModel()}
                </section>

                <section className="aword-tk-khoi">
                    <h3>Tiền theo ngày · 30 ngày gần nhất</h3>
                    {this.renderBieuDo()}
                </section>

                {this.renderGoi()}
                {this.renderNguon()}
            </div>
        );
    }
}

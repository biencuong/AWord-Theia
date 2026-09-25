// Chỉ báo nhỏ gọn trên thanh tiêu đề: tiền đã dùng tháng này, bấm vào mở trang thống kê.
//
// Chỗ cắm: vùng `top` của ApplicationShell (`#theia-top-panel`). Vùng đó là flex container, và Lumino chỉ
// `insertBefore` widget vào Panel chứ KHÔNG đặt `position:absolute` (các phần tử absolute trong thanh tiêu
// đề là do CSS của Theia đặt). Nghĩa là widget ở đây là một flex item bình thường — `margin-left: auto` là
// đủ để đẩy sang phải, không phải đấu với layout engine.
//
// Ràng buộc bố cục phải nhớ: `#window-controls` (thu nhỏ / phóng to / đóng) là `position:absolute; right:0;
// width:144px` = 3 nút × 48px. Nên chỉ báo phải tự chừa đúng 144px bên phải, kẻo nút đóng cửa sổ đè lên số.

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandService } from '@theia/core';
import { ChiSoTokenServer, type ChiSoToken } from '../common/chi-so-token-protocol';
import { soGon, tienGon } from '../common/dinh-dang-so';

export const LENH_MO_THONG_KE = 'aword:thong-ke';

/** Bề rộng tối thiểu để hiện đủ; hẹp hơn nữa thì rút gọn rồi ẩn hẳn. */
const RONG_DAY_DU = 900;
const RONG_GON = 700;

/** Nhịp hỏi số: nhanh khi vừa có lượt mới, chậm khi rảnh. */
const NHIP_BAN = 5_000;
const NHIP_RANH = 30_000;

@injectable()
export class AwordChiSoTokenWidget extends ReactWidget {

    static readonly ID = 'aword.chi-so-token';

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    @inject(ChiSoTokenServer)
    protected readonly chiSoServer!: ChiSoTokenServer;

    protected chiSo: ChiSoToken | undefined;
    protected rong = 0;
    /** Chuỗi đang hiện — chỉ vẽ lại khi chuỗi này đổi, để không đụng vào DOM vô ích. */
    protected chuoiHienTai = '';
    protected hen?: number;
    protected dongHoQuanSat?: ResizeObserver;
    /** Vừa có lượt mới trong ít phút qua → hỏi dày hơn. */
    protected vuaCoHoatDong = false;
    /** Số lượt ở lần hỏi trước, để biết có lượt mới hay không. */
    protected luotTruoc = 0;

    @postConstruct()
    protected init(): void {
        this.id = AwordChiSoTokenWidget.ID;
        this.addClass('aword-cs-nut');
        // `Widget.title` là thuộc tính chỉ đọc; muốn chú thích khi rê chuột thì đặt thẳng lên node.
        this.node.title = 'Chi phí và token đã dùng — bấm để xem chi tiết';
        this.node.tabIndex = 0;
        this.node.setAttribute('role', 'button');

        this.node.addEventListener('click', () => {
            void this.commandService.executeCommand(LENH_MO_THONG_KE);
        });
        this.node.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void this.commandService.executeCommand(LENH_MO_THONG_KE);
            }
        });

        document.addEventListener('visibilitychange', () => this.datNhip());
        this.datNhip();
    }

    /** Theo dõi bề rộng thanh tiêu đề để chọn mức hiển thị. */
    protected theoDoiBeRong(): void {
        const thanh = document.getElementById('theia-top-panel');
        if (!thanh || this.dongHoQuanSat) { return; }
        this.rong = thanh.clientWidth;
        this.dongHoQuanSat = new ResizeObserver(() => {
            const r = thanh.clientWidth;
            if (r !== this.rong) {
                this.rong = r;
                this.capNhatChuoi();
            }
        });
        this.dongHoQuanSat.observe(thanh);
    }

    protected datNhip(): void {
        if (this.hen !== undefined) { window.clearTimeout(this.hen); this.hen = undefined; }
        // Tab bị ẩn thì không hỏi gì: người dùng không nhìn thấy, mà vẫn tốn công đọc số.
        if (document.hidden) { return; }
        const nhip = this.vuaCoHoatDong ? NHIP_BAN : NHIP_RANH;
        this.hen = window.setTimeout(() => { void this.hut(); }, nhip);
    }

    protected async hut(): Promise<void> {
        try {
            const cs = await this.chiSoServer.docChiSo();
            this.chiSo = cs;
            // Có lượt mới → chuyển sang nhịp nhanh trong lúc người dùng đang làm việc.
            const coLuotMoi = cs.tokenHomNay.luot !== this.luotTruoc;
            this.luotTruoc = cs.tokenHomNay.luot;
            const truoc = this.vuaCoHoatDong;
            this.vuaCoHoatDong = coLuotMoi || (this.vuaCoHoatDong && cs.dangQuet);
            this.capNhatChuoi();
            if (this.vuaCoHoatDong !== truoc) { /* nhịp đổi thì lần hẹn sau đã tính lại */ }
        } catch {
            // Mất kết nối RPC thì giữ số cũ, không xóa — thà số cũ còn hơn nhấp nháy "—".
        }
        this.datNhip();
    }

    /** Dựng chuỗi hiển thị theo bề rộng, và chỉ vẽ lại khi chuỗi đổi. */
    protected capNhatChuoi(): void {
        const rong = this.rong || document.getElementById('theia-top-panel')?.clientWidth || 0;
        let chuoi: string;
        const cs = this.chiSo;
        const token = cs ? `${soGon(cs.tokenThang.vao + cs.tokenThang.ra)} token` : '';
        // Chưa có giá cho model nào đã dùng → tiền tính ra 0, nhưng "0" là con số SAI (người đọc hiểu là không tốn gì).
        // Khi đó chỉ hiện số token; dấu "!" và chú thích rê chuột nói rõ là thiếu bảng giá.
        const coTien = !!cs && (cs.tienThang > 0 || cs.soModelChuaCoGia === 0);
        if (rong > 0 && rong < RONG_GON) {
            chuoi = '';
        } else if (rong > 0 && rong < RONG_DAY_DU) {
            chuoi = cs ? (coTien ? `${tienGon(cs.tienThang)}` : token) : '…';
        } else {
            chuoi = cs ? (coTien ? `${tienGon(cs.tienThang)} · ${token}` : token) : '…';
        }
        if (chuoi === this.chuoiHienTai) { return; }
        this.chuoiHienTai = chuoi;
        this.update();
        // Đo SAU khi vẽ lại: đo trước thì lấy bề rộng của nội dung cũ, và CSS sẽ chừa chỗ theo số cũ.
        requestAnimationFrame(() => {
            const rongNut = this.chuoiHienTai === '' ? 0 : this.node.getBoundingClientRect().width;
            document.documentElement.style.setProperty('--aword-tt-rong', `${Math.ceil(rongNut)}px`);
        });
    }

    protected render(): React.ReactNode {
        if (this.chuoiHienTai === '') { return null; }
        const cs = this.chiSo;
        const canhBao = cs && cs.soModelChuaCoGia > 0;
        return (
            <span className="aword-cs-trong" title={canhBao ? `${cs!.soModelChuaCoGia} mô hình chưa có giá nên chưa tính được đủ chi phí — bấm để xem và nhập bảng giá` : undefined}>
                {cs?.dangQuet ? <span className="aword-cs-cham" aria-label="đang quét" /> : null}
                <span className="aword-cs-so">{this.chuoiHienTai}</span>
                {canhBao ? <span className="aword-cs-canh" aria-label="thiếu giá">!</span> : null}
            </span>
        );
    }

    protected override onAfterAttach(msg: unknown): void {
        super.onAfterAttach(msg as never);
        this.theoDoiBeRong();
        if (!this.chiSo) { void this.hut(); }
    }

    protected override onBeforeDetach(msg: unknown): void {
        if (this.hen !== undefined) { window.clearTimeout(this.hen); }
        this.dongHoQuanSat?.disconnect();
        this.dongHoQuanSat = undefined;
        super.onBeforeDetach(msg as never);
    }
}

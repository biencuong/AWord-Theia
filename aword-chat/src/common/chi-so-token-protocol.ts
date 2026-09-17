// Chỉ số token và chi phí — hợp đồng giữa giao diện (browser) và tiến trình nền (node).
//
// Số liệu đến từ việc đọc sổ phiên của Claude Code (~/.claude/projects/**/*.jsonl). Việc đọc nằm ở tiến
// trình nền vì phải chạm đĩa và có thể tốn vài giây ở lần quét đầu; giao diện chỉ hỏi những con số đã
// tính sẵn, nên chỉ báo trên thanh tiêu đề hỏi bao nhiêu lần cũng rẻ.
//
// Các kiểu dữ liệu ở đây là dữ liệu THUẦN (không phụ thuộc Node) — cả hai đầu dùng chung một định nghĩa,
// không bên nào tự khai lại.

import type { GiaModel, SoToken } from './so-token';

export const CHI_SO_TOKEN_PATH = '/services/aword-chi-so-token';

export interface ChiSoToken {
    /** Tiền của tháng này (theo giờ Việt Nam). */
    tienThang: number;
    tokenThang: SoToken & { luot: number };
    /** Tiền của hôm nay. */
    tienHomNay: number;
    tokenHomNay: SoToken & { luot: number };
    /**
     * Số MODEL chưa tra được giá. Giao diện PHẢI hiện điều này khi khác 0 — nếu không, người dùng nhìn
     * thấy một số tiền nhỏ hơn thực tế mà tưởng là đủ.
     */
    soModelChuaCoGia: number;
    /** Đang quét — giao diện hiện "đang quét…" thay vì số 0 gây hiểu nhầm. */
    dangQuet: boolean;
    /** Lần quét xong gần nhất, ms kể từ epoch. */
    lanQuetCuoi?: number;
    /** Số tệp bị phát hiện ghi lại ở lần quét gần nhất — nghĩa là số vừa được tính lại từ đầu. */
    soTepGhiLai: number;
}

export interface BaoCaoToken {
    chiSo: ChiSoToken;
    theoNgay: Array<{ ngay: string; tien: number; token: SoToken & { luot: number } }>;
    theoModel: Array<{ model: string; token: SoToken & { luot: number }; tien: number; chuaCoGia: boolean }>;
}

export interface ChiSoTokenServer {
    /** Cực nhẹ — chỉ vài con số đã tính sẵn. Dùng cho chỉ báo trên thanh tiêu đề. */
    docChiSo(): Promise<ChiSoToken>;
    /** Báo cáo đầy đủ cho trang thống kê. */
    docBaoCao(soNgay: number): Promise<BaoCaoToken>;
    /** Đọc phần mới ngay, không chờ nhịp theo dõi. */
    quetNgay(): Promise<void>;
    /** Quét lại từ đầu — nút "Tính lại từ đầu". */
    quetLai(): Promise<void>;
    /** Bảng giá người dùng tự nhập (mã model → đồng trên 1 triệu token). */
    docBangGia(): Promise<Record<string, GiaModel>>;
    luuBangGia(bang: Record<string, GiaModel>): Promise<void>;
}

export const ChiSoTokenServer = Symbol('ChiSoTokenServer');

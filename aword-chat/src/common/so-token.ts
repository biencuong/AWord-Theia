// Số token và cách tính tiền — phần DÙNG CHUNG, không phụ thuộc Node, để cả tiến trình nền (đọc sổ phiên)
// lẫn giao diện (hiện số) dùng đúng một định nghĩa.
//
// Đơn vị giá: ĐỒNG trên 1 TRIỆU token, và công thức làm tròn LÊN — sao chép đúng `tinhChiPhi` của
// aword-web-server/src/cong-ai/bang-gia.ts. Hai bên phải khớp nhau, nếu không thì cùng một lượt gọi mà
// màn hình AWord Pro và sổ `su_dung_ai` của AWord Web lại nói hai số khác nhau.

/** Số token của một lượt gọi, đúng ngữ nghĩa `SoToken` của Cổng AI bên AWord Web. */
export interface SoToken {
    /** Token đầu vào KHÔNG tính phần cache. */
    vao: number;
    ra: number;
    /** Token đọc từ bộ nhớ đệm (cache read). */
    cacheDoc: number;
    /** Token ghi vào bộ nhớ đệm (cache creation). */
    cacheGhi: number;
}

/** Giá một model, đồng trên 1 triệu token. */
export type GiaModel = SoToken;

export interface TienLuot {
    dong: number;
    /** true khi model chưa có trong bảng giá — số tiền KHÔNG đáng tin, phải hiện rõ cho người dùng. */
    chuaCoGia: boolean;
}

/**
 * Tiền của một lượt. Model không có giá → tiền 0 kèm cờ `chuaCoGia`.
 *
 * KHÔNG đoán giá: thà hiện "chưa có giá" còn hơn hiện một con số sai mà người dùng tin. Một khoá model lạ
 * xuất hiện trong sổ phiên là chuyện thường (nhà cung cấp đổi tên, cổng AI đặt bí danh riêng), nên đây
 * là nhánh sẽ gặp thật chứ không phải phòng xa.
 */
export function tienLuot(t: SoToken, gia: GiaModel | undefined): TienLuot {
    if (!gia) { return { dong: 0, chuaCoGia: true }; }
    return {
        dong: Math.ceil((t.vao * gia.vao + t.ra * gia.ra + t.cacheDoc * gia.cacheDoc + t.cacheGhi * gia.cacheGhi) / 1_000_000),
        chuaCoGia: false,
    };
}

/** Cộng hai bộ số token (dùng khi gộp nhiều ngày hoặc nhiều model). */
export function congToken(a: SoToken, b: SoToken): SoToken {
    return { vao: a.vao + b.vao, ra: a.ra + b.ra, cacheDoc: a.cacheDoc + b.cacheDoc, cacheGhi: a.cacheGhi + b.cacheGhi };
}

export const TOKEN_KHONG: SoToken = { vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0 };

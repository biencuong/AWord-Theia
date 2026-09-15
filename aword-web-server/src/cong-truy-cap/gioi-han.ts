// Giới hạn tần suất trong bộ nhớ (cửa sổ trượt): đếm sự kiện theo khóa (IP, tên đăng nhập) để chặn dò mật khẩu.
// Khởi động lại máy chủ thì bộ đếm về 0 — việc khóa tài khoản sau 5 lần sai vẫn lưu trong CSDL.

export interface GioiHan {
    /** Số mili giây còn phải chờ (0 = được phép). */
    conCho(khoa: string): number;
    ghi(khoa: string): void;
    xoa(khoa: string): void;
}

export function taoGioiHan(tuy: { soLan: number; cuaSoMs: number; bayGio: () => number; toiDaKhoa?: number }): GioiHan {
    const bang = new Map<string, number[]>();
    const toiDa = tuy.toiDaKhoa ?? 50_000;

    const conHieuLuc = (khoa: string): number[] => {
        const nguong = tuy.bayGio() - tuy.cuaSoMs;
        const ds = (bang.get(khoa) ?? []).filter(t => t > nguong);
        if (ds.length === 0) { bang.delete(khoa); } else { bang.set(khoa, ds); }
        return ds;
    };

    return {
        conCho(khoa) {
            const ds = conHieuLuc(khoa);
            if (ds.length < tuy.soLan) { return 0; }
            return Math.max(1, ds[ds.length - tuy.soLan] + tuy.cuaSoMs - tuy.bayGio());
        },
        ghi(khoa) {
            const ds = conHieuLuc(khoa);
            ds.push(tuy.bayGio());
            if (ds.length > tuy.soLan * 2) { ds.splice(0, ds.length - tuy.soLan * 2); }
            bang.set(khoa, ds);
            if (bang.size > toiDa) {
                // Quá nhiều khóa (bị dò hàng loạt): bỏ các khóa cũ nhất
                for (const k of bang.keys()) {
                    bang.delete(k);
                    if (bang.size <= toiDa * 0.9) { break; }
                }
            }
        },
        xoa(khoa) { bang.delete(khoa); },
    };
}

/** "15 phút", "1 phút" — làm tròn lên. */
export function soPhutConLai(ms: number): string {
    return `${Math.max(1, Math.ceil(ms / 60_000))} phút`;
}

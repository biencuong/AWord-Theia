/** Lỗi phiên làm việc: `message` là thông báo tiếng Việt hiển thị được cho người dùng; `chiTiet` chỉ ghi nhật ký. */
export class LoiPhien extends Error {
    chiTiet?: string;

    constructor(thongBao: string, chiTiet?: string) {
        super(thongBao);
        this.name = 'LoiPhien';
        this.chiTiet = chiTiet;
    }
}

export function moTaLoi(e: unknown): string {
    if (e instanceof LoiPhien) { return e.chiTiet ? `${e.message} (${e.chiTiet})` : e.message; }
    return e instanceof Error ? e.message : String(e);
}

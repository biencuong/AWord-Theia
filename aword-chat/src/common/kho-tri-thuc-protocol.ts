// Kết nối TỰ ĐỘNG Kho tri thức AI giảng dạy (MCP `trithuc`) cho vai Giáo viên — người dùng không phải chạy
// script, không nhập gì. Backend (Node) làm trọn phần việc trước đây của Ket_Noi_KhoTriThuc.cmd:
//   - %USERPROFILE%\.aword\trithuc.json : url + mã máy + token thiết bị (dùng lại token cũ → giữ bản quyền;
//     di trú khosgk.json của bản thử nghiệm). CÙNG định dạng và CÙNG thuật toán mã máy với script.
//   - Đăng ký MCP `trithuc` (phạm vi user) qua claude.exe đóng kèm — CHỈ khi máy chủ đã phản hồi, để máy
//     chưa có mạng/máy chủ chưa triển khai không bị Claude báo "MCP failed"; lần mở AWord sau tự thử lại.
//   - Kiểm trạng thái bằng REST GET /api/v1/trang-thai?doc=0 (không tốn token AI, KHÔNG đánh dấu đã đọc
//     thông báo — để hook đầu phiên vẫn nhận được).
// Script Start Menu vẫn giữ làm đường dự phòng (đổi địa chỉ máy chủ thủ công).
export const KHO_TRI_THUC_PATH = '/services/aword-kho-tri-thuc';

export const URL_TRI_THUC_MAC_DINH = 'https://aword.vn/trithuc/mcp';

// Kết quả liên lạc máy chủ ở lần kiểm gần nhất.
export type TinhTrangMayChu = 'ket_noi' | 'khong_phan_hoi' | 'may_khong_khop' | 'bi_tu_choi' | 'chua_kiem_tra';

export interface BanQuyenTriThuc {
    // chua_kich_hoat | hoat_dong | sap_het_han | het_han | khoa | cho_doi_may (theo máy chủ)
    trangThai: string;
    hetHan?: string;
    conNgay?: number;
    soDiem?: number;
}

export interface TrangThaiKhoTriThuc {
    hoTro: boolean;              // nền tảng tính được mã máy (Windows; macOS dự phòng)
    daCauHinh: boolean;          // đã có trithuc.json
    url?: string;
    maMay?: string;
    ngayDangKy?: string;
    daDangKyMcp: boolean;        // cấu hình Claude đang có MCP `trithuc` khớp url + token + mã máy
    mayChu: TinhTrangMayChu;
    banQuyen?: BanQuyenTriThuc;
    thongDiep: string;           // một câu tiếng Việt cho giao diện
}

export interface KetQuaDongBoTriThuc {
    trangThai: TrangThaiKhoTriThuc;
    // true = vừa thêm/đổi/gỡ đăng ký MCP → khung Claude đang mở cần khởi động lại để nạp/bỏ công cụ tt_*
    thayDoiDangKy: boolean;
    daLam: string[];
    canhBao: string[];
}

export interface KhoTriThucServer {
    // Chỉ đọc (kiemTraMayChu=true thì gọi thêm REST trạng thái, tối đa vài giây).
    docTrangThai(kiemTraMayChu: boolean): Promise<TrangThaiKhoTriThuc>;
    // Idempotent: bảo đảm trithuc.json + đăng ký MCP (khi máy chủ phản hồi). Gọi mỗi lần mở AWord với vai Giáo viên.
    dongBo(): Promise<KetQuaDongBoTriThuc>;
    // Tắt vai Giáo viên: gỡ đăng ký MCP (bớt công cụ/token cho vai hành chính), GIỮ trithuc.json để giữ bản quyền.
    goDangKy(): Promise<KetQuaDongBoTriThuc>;
}

export const KhoTriThucServer = Symbol('KhoTriThucServer');

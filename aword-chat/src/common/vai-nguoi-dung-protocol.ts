// Giao thức RPC frontend/backend cho "Vai của bạn" (trang Chào mừng): Cán bộ hành chính /
// Giáo viên / cả hai. Backend (Node) là nơi duy nhất đụng vào tệp cấu hình cá nhân:
//   - %USERPROFILE%\.aword\vai.json            — lựa chọn vai đã lưu
//   - %USERPROFILE%\.claude\CLAUDE.md          — khối AWORD-GIAOVIEN:BEGIN/END (hợp nhất có sao lưu,
//                                                cùng cơ chế Cap_Nhat_QuyTac.ps1 dùng cho khối AWORD)
//   - %USERPROFILE%\.claude\settings.json      — hook SessionStart gọi hook_khosgk.ps1 (chỉ vai Giáo viên)
//   - %USERPROFILE%\Documents\AWord\GIAO VIEN\ — cây thư mục giáo viên + CLAUDE.md workspace
export const VAI_NGUOI_DUNG_PATH = '/services/aword-vai-nguoi-dung';

export interface VaiNguoiDung {
    hanhChinh: boolean;
    giaoVien: boolean;
}

export interface KhoSgkDaDangKy {
    url: string;
    maMay: string;
    ngay?: string;
}

export interface TrangThaiVai {
    // undefined = người dùng chưa chọn vai lần nào (vai.json chưa có)
    vai?: VaiNguoiDung;
    ngayChon?: string;
    // CLAUDE.md cấp người dùng đang chứa khối AWORD-GIAOVIEN
    khoiGiaoVienTrongClaudeMd: boolean;
    // settings.json đang có hook SessionStart gọi hook_khosgk.ps1
    hookKhoSgkDaBat: boolean;
    // Documents\AWord\GIAO VIEN đã tồn tại
    thuMucGiaoVienDaCo: boolean;
    // Đường dẫn tuyệt đối thư mục giáo viên (để hiển thị)
    thuMucGiaoVien: string;
    // Đã chạy Ket_Noi_KhoSGK.cmd (có %USERPROFILE%\.aword\khosgk.json) — undefined = chưa
    khoSgk?: KhoSgkDaDangKy;
}

export interface KetQuaDatVai {
    trangThai: TrangThaiVai;
    daLam: string[];
    canhBao: string[];
}

export interface VaiNguoiDungServer {
    docTrangThai(): Promise<TrangThaiVai>;
    // Lưu vai + áp dụng: khối CLAUDE.md, cây thư mục, hook. Idempotent — gọi lại vô hại.
    datVai(vai: VaiNguoiDung): Promise<KetQuaDatVai>;
}

export const VaiNguoiDungServer = Symbol('VaiNguoiDungServer');

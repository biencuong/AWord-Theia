// Giao thức RPC frontend/backend cho "Vai của bạn" (trang Chào mừng): Cán bộ hành chính /
// Giáo viên / cả hai. Backend (Node) là nơi duy nhất đụng vào tệp cấu hình cá nhân:
//   - %USERPROFILE%\.aword\vai.json            — lựa chọn vai đã lưu
//   - %USERPROFILE%\.claude\CLAUDE.md          — khối AWORD-GIAOVIEN:BEGIN/END (hợp nhất có sao lưu,
//                                                cùng cơ chế Cap_Nhat_QuyTac.ps1 dùng cho khối AWORD)
//   - %USERPROFILE%\.claude\settings.json      — hook SessionStart gọi hook_trithuc.ps1 (chỉ vai Giáo viên)
//   - %USERPROFILE%\Documents\AWord\GIAO VIEN\ — cây thư mục giáo viên + CLAUDE.md workspace
// Kho tri thức AI giảng dạy: cấu hình máy khách %USERPROFILE%\.aword\trithuc.json (Ket_Noi_KhoTriThuc.cmd tạo).
export const VAI_NGUOI_DUNG_PATH = '/services/aword-vai-nguoi-dung';

export interface VaiNguoiDung {
    hanhChinh: boolean;
    giaoVien: boolean;
}

export interface KhoTriThucDaDangKy {
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
    // settings.json đang có hook SessionStart gọi hook_trithuc.ps1
    hookTriThucDaBat: boolean;
    // settings.json còn mục hook tên cũ của bản thử nghiệm (cần gỡ — datVai tự gỡ)
    hookCuConLai: boolean;
    // Documents\AWord\GIAO VIEN đã tồn tại
    thuMucGiaoVienDaCo: boolean;
    // Đường dẫn tuyệt đối thư mục giáo viên (để hiển thị)
    thuMucGiaoVien: string;
    // Đã chạy Ket_Noi_KhoTriThuc.cmd (có %USERPROFILE%\.aword\trithuc.json) — undefined = chưa
    khoTriThuc?: KhoTriThucDaDangKy;
    // Chỉ còn cấu hình tên cũ của bản thử nghiệm (chưa di trú) — cần chạy lại "Kết nối Kho tri thức AI (AWord)"
    cauHinhCuChuaDiTru: boolean;
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

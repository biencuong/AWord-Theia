// Giao thức RPC frontend/backend cho "Vai của bạn" (trang Chào mừng): Cán bộ hành chính /
// Giáo viên / cả hai. Backend (Node) là nơi duy nhất đụng vào tệp cấu hình cá nhân:
//   - %USERPROFILE%\.aword\vai.json            — lựa chọn vai đã lưu
//   - %USERPROFILE%\.claude\CLAUDE.md          — khối AWORD-GIAOVIEN:BEGIN/END (hợp nhất có sao lưu,
//                                                cùng cơ chế Cap_Nhat_QuyTac.ps1 dùng cho khối AWORD)
//   - %USERPROFILE%\.claude\settings.json      — hook SessionStart gọi hook_trithuc.ps1 (chỉ vai Giáo viên)
//   - %USERPROFILE%\Documents\AWord\GIAO VIEN\ — cây thư mục giáo viên + CLAUDE.md workspace
// Kho tri thức AI giảng dạy: cấu hình máy khách %USERPROFILE%\.aword\trithuc.json — AWord TỰ tạo và đăng ký MCP
// khi bật vai Giáo viên (kho-tri-thuc-server-impl.ts); Ket_Noi_KhoTriThuc.cmd chỉ còn là đường dự phòng.
import type { KetQuaDongBoTriThuc } from './kho-tri-thuc-protocol';

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
    // settings.json đã cho phép sẵn các công cụ mcp__trithuc__* (Claude không hỏi lại mỗi lần tra cứu)
    quyenTriThucDaBat: boolean;
    // Documents\AWord\GIAO VIEN đã tồn tại
    thuMucGiaoVienDaCo: boolean;
    // Đường dẫn tuyệt đối thư mục giáo viên (để hiển thị)
    thuMucGiaoVien: string;
    // Đã có %USERPROFILE%\.aword\trithuc.json (AWord tự tạo khi bật vai Giáo viên) — undefined = chưa
    khoTriThuc?: KhoTriThucDaDangKy;
    // Chỉ còn cấu hình tên cũ của bản thử nghiệm (chưa di trú) — AWord tự di trú ở lần đồng bộ kế tiếp
    cauHinhCuChuaDiTru: boolean;
}

export interface KetQuaDatVai {
    trangThai: TrangThaiVai;
    daLam: string[];
    canhBao: string[];
    // Kết quả tự kết nối (vai Giáo viên) / gỡ đăng ký (tắt vai) Kho tri thức AI — thayDoiDangKy → khởi động lại Claude
    khoTriThuc?: KetQuaDongBoTriThuc;
}

export interface VaiNguoiDungServer {
    docTrangThai(): Promise<TrangThaiVai>;
    // Lưu vai + áp dụng: khối CLAUDE.md, cây thư mục, hook. Idempotent — gọi lại vô hại.
    datVai(vai: VaiNguoiDung): Promise<KetQuaDatVai>;
}

export const VaiNguoiDungServer = Symbol('VaiNguoiDungServer');

// Giao thức RPC frontend/backend cho "Mô hình AI DeepSeek cho AWord" (Tệp → Tùy chọn).
// Mục tiêu: AWord dùng DeepSeek qua cổng tương thích Anthropic (theo hướng dẫn chính thức
// https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code) mà KHÔNG đổi Claude Code
// ở nơi khác trên máy (VS Code, dòng lệnh...).
//
// Cơ chế (đã kiểm chứng trên claude.exe 2.1.211 và 2.1.270): khối "env" trong ~/.claude/settings.json dùng chung THẮNG
// biến môi trường của tiến trình, nhưng cờ --settings THẮNG settings.json chung. Vì vậy:
//   - backend ghi %USERPROFILE%\.aword\deepseek\claude-settings.json (khối env DeepSeek) — chỉ tồn tại khi đang bật;
//   - tùy chọn người dùng CỦA AWORD (~/.theia/settings.json, VS Code không đọc) đặt
//     claudeCode.claudeProcessWrapper = aword-claude-wrapper(.exe) và biến AWORD_CLAUDE_SETTINGS trỏ tệp trên;
//   - wrapper chèn "--settings <tệp>" rồi chạy claude.exe (xem electron-app/scripts/claude-wrapper/).
export const CAU_HINH_DEEPSEEK_PATH = '/services/aword-cau-hinh-deepseek';

export const BIEN_SETTINGS_WRAPPER = 'AWORD_CLAUDE_SETTINGS';

export type ModelDeepSeek = 'deepseek-flash[1m]' | 'deepseek-v4-pro';
export const CAC_MODEL_DEEPSEEK: { giaTri: ModelDeepSeek; nhan: string }[] = [
    { giaTri: 'deepseek-flash[1m]', nhan: 'DeepSeek Flash — ngữ cảnh 1 triệu token (khuyến nghị theo hướng dẫn DeepSeek)' },
    { giaTri: 'deepseek-v4-pro', nhan: 'DeepSeek V4 Pro — suy luận mạnh hơn, tính giá V4 Pro' },
];

export type MucSuyLuan = 'max' | 'high' | 'medium';
export const CAC_MUC_SUY_LUAN: { giaTri: MucSuyLuan; nhan: string }[] = [
    { giaTri: 'max', nhan: 'Tối đa (theo hướng dẫn DeepSeek)' },
    { giaTri: 'high', nhan: 'Cao' },
    { giaTri: 'medium', nhan: 'Trung bình — nhanh, tiết kiệm hơn' },
];

export interface TrangThaiDeepSeek {
    // false khi máy không có wrapper dùng được (vd cài thiếu tệp) — kèm lý do ở `loi`
    hoTro: boolean;
    loi?: string;
    bat: boolean;
    coKhoa: boolean;
    // Chỉ vài ký tự cuối để người dùng nhận ra khóa đã lưu — KHÔNG bao giờ trả khóa đầy đủ về giao diện
    khoaRutGon?: string;
    model: ModelDeepSeek;
    effort: MucSuyLuan;
    duongDanWrapper?: string;
    duongDanSettings: string;
}

export interface YeuCauLuuDeepSeek {
    bat: boolean;
    // Rỗng = giữ khóa đã lưu
    apiKey: string;
    model: ModelDeepSeek;
    effort: MucSuyLuan;
}

export interface KetQuaKiemTraDeepSeek {
    ok: boolean;
    thongBao: string;
}

export interface CauHinhDeepSeekServer {
    docTrangThai(): Promise<TrangThaiDeepSeek>;
    luuCauHinh(yeuCau: YeuCauLuuDeepSeek): Promise<TrangThaiDeepSeek>;
    // apiKey rỗng = kiểm tra bằng khóa đã lưu. Gửi một yêu cầu 1 token tới DeepSeek.
    kiemTraKetNoi(apiKey: string, model: ModelDeepSeek): Promise<KetQuaKiemTraDeepSeek>;
}

export const CauHinhDeepSeekServer = Symbol('CauHinhDeepSeekServer');

// Tên tệp wrapper — dùng để nhận ra tùy chọn claudeProcessWrapper do AWord đặt (không đụng wrapper người dùng tự đặt).
export function laWrapperCuaAword(duongDan: unknown): boolean {
    return typeof duongDan === 'string' && /aword-claude-wrapper(\.exe|\.sh)$/i.test(duongDan);
}

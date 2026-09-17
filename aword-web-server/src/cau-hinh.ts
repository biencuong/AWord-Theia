// Cấu hình máy chủ AWord Web — đọc từ biến môi trường (AWORD_WEB_*). Khóa AI của tổ chức và bí mật ký token CHỈ nằm
// ở biến môi trường / tệp bí mật của máy chủ, không ghi vào CSDL, không đưa vào phiên người dùng.
import * as path from 'node:path';

export type TrinhDieuPhoi = 'docker' | 'tien-trinh';

export interface CauHinh {
    /** Cổng HTTP của cổng truy cập (sau Caddy/Nginx lo HTTPS). */
    cong: number;
    diaChiNghe: string;
    /** Tên miền của cổng (đăng nhập, tài khoản, quản trị), vd web.aword.vn — không kèm cổng. */
    tenMien: string;
    /**
     * Tên miền RIÊNG của phiên AWord (mặc định app.<tenMien>); webview Claude Code dùng {uuid}.webview.<tenMienUngDung>.
     * Tách khỏi tenMien để mã chạy trong phiên (do người dùng/AI điều khiển) không cùng nguồn gốc với trang quản trị.
     */
    tenMienUngDung: string;
    /** Chạy sau proxy HTTPS → cookie Secure. */
    https: boolean;
    /** CSDL + ổ dữ liệu riêng từng tài khoản (du-lieu/tai-khoan/<id>). */
    thuMucDuLieu: string;
    /** Skill, công cụ, plugin dùng chung — gắn CHỈ ĐỌC vào mọi phiên. */
    thuMucHeThong: string;
    trinhDieuPhoi: TrinhDieuPhoi;
    /** Ảnh container AWord Web (trình docker). */
    anhDocker: string;
    /** Phiên không hoạt động quá số phút này thì cho ngủ (dừng container, giữ dữ liệu). */
    phutNguKhiRanh: number;
    /** Số ngày giữ nhật ký thao tác (bảng nhat_ky). Bảng này chỉ ghi thêm, không dọn thì mỗi lần mở
     *  trang Nhật ký lại phải quét toàn bộ lịch sử tích lũy — chậm dần theo thời gian chạy. 0 = giữ mãi. */
    giuNhatKyNgay: number;
    /** Địa chỉ Cổng AI mà phiên người dùng gọi tới (từ bên trong container). */
    diaChiCongAiChoPhien: string;
    khoaAi: { anthropic?: string; deepseek?: string; openai?: string };
    diaChiAi: { anthropic: string; deepseek: string; openai: string };
    /** Bí mật ký/mã hóa (token, bí mật TOTP) — tối thiểu 32 ký tự. */
    biMat: string;
}

function so(ten: string, macDinh: number): number {
    const v = process.env[ten];
    if (v === undefined || v === '') { return macDinh; }
    const n = Number(v);
    if (!Number.isFinite(n)) { throw new Error(`${ten} phải là số (đang là "${v}").`); }
    return n;
}

export function docCauHinh(env: NodeJS.ProcessEnv = process.env): CauHinh {
    const biMat = env.AWORD_WEB_BI_MAT ?? '';
    if (biMat.length < 32) {
        throw new Error('Thiếu AWORD_WEB_BI_MAT (tối thiểu 32 ký tự ngẫu nhiên) — dùng để ký token và mã hóa bí mật xác thực hai lớp.');
    }
    const trinh = (env.AWORD_WEB_TRINH_DIEU_PHOI ?? 'docker') as TrinhDieuPhoi;
    if (trinh !== 'docker' && trinh !== 'tien-trinh') {
        throw new Error('AWORD_WEB_TRINH_DIEU_PHOI chỉ nhận "docker" hoặc "tien-trinh".');
    }
    const cong = so('AWORD_WEB_CONG', 8080);
    const thuMucDuLieu = path.resolve(env.AWORD_WEB_DU_LIEU ?? 'du-lieu');
    const tenMien = (env.AWORD_WEB_TEN_MIEN ?? 'aword.localhost').trim().toLowerCase().replace(/:\d+$/, '');
    return {
        cong,
        // Trình docker: container phải gọi được Cổng AI trên máy chủ → nghe mọi giao diện (đặt tường lửa chặn từ ngoài).
        diaChiNghe: env.AWORD_WEB_NGHE ?? (trinh === 'docker' ? '0.0.0.0' : '127.0.0.1'),
        tenMien,
        tenMienUngDung: (env.AWORD_WEB_TEN_MIEN_UNG_DUNG ?? `app.${tenMien}`).trim().toLowerCase().replace(/:\d+$/, ''),
        https: env.AWORD_WEB_HTTPS === '1',
        thuMucDuLieu,
        thuMucHeThong: path.resolve(env.AWORD_WEB_HE_THONG ?? path.join(thuMucDuLieu, 'he-thong')),
        trinhDieuPhoi: trinh,
        anhDocker: env.AWORD_WEB_ANH ?? 'aword-web:latest',
        phutNguKhiRanh: so('AWORD_WEB_PHUT_NGU', 30),
        giuNhatKyNgay: so('AWORD_WEB_GIU_NHAT_KY_NGAY', 180),
        diaChiCongAiChoPhien: env.AWORD_WEB_CONG_AI_CHO_PHIEN
            ?? (trinh === 'docker' ? `http://host.docker.internal:${cong}/ai` : `http://127.0.0.1:${cong}/ai`),
        khoaAi: {
            anthropic: env.AWORD_KHOA_ANTHROPIC || undefined,
            deepseek: env.AWORD_KHOA_DEEPSEEK || undefined,
            openai: env.AWORD_KHOA_OPENAI || undefined,
        },
        diaChiAi: {
            anthropic: env.AWORD_DIA_CHI_ANTHROPIC ?? 'https://api.anthropic.com',
            deepseek: env.AWORD_DIA_CHI_DEEPSEEK ?? 'https://api.deepseek.com/anthropic',
            openai: env.AWORD_DIA_CHI_OPENAI ?? 'https://api.openai.com',
        },
        biMat,
    };
}

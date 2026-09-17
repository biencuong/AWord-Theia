// CSDL của máy chủ AWord Web: SQLite tích hợp sẵn trong Node 24 (node:sqlite) — không cần module native,
// một tệp duy nhất trong thư mục dữ liệu, sao lưu bằng cách chép tệp (sau VACUUM INTO).
// Lược đồ đánh số bằng PRAGMA user_version; mỗi bước nâng cấp chạy trong một giao dịch.
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Thời điểm lưu dạng số mili giây từ epoch (UTC). */
export const bayGio = (): number => Date.now();

const NANG_CAP: string[] = [
    // 1 — nền Giai đoạn 1
    `
    CREATE TABLE don_vi (
        id              INTEGER PRIMARY KEY,
        ma              TEXT NOT NULL UNIQUE,
        ten             TEXT NOT NULL,
        tao_luc         INTEGER NOT NULL
    );

    -- vai_tro: quan_tri_he_thong | quan_tri_don_vi | nguoi_dung
    -- trang_thai: hoat_dong | khoa | chi_doc | luu_tru
    CREATE TABLE tai_khoan (
        id                  INTEGER PRIMARY KEY,
        ten_dang_nhap       TEXT NOT NULL UNIQUE COLLATE NOCASE,
        ho_ten              TEXT NOT NULL,
        email               TEXT,
        don_vi_id           INTEGER REFERENCES don_vi(id),
        vai_tro             TEXT NOT NULL DEFAULT 'nguoi_dung'
                            CHECK (vai_tro IN ('quan_tri_he_thong','quan_tri_don_vi','nguoi_dung')),
        mat_khau_bam        TEXT NOT NULL,
        phai_doi_mat_khau   INTEGER NOT NULL DEFAULT 1,
        totp_bi_mat_ma_hoa  TEXT,
        totp_bat            INTEGER NOT NULL DEFAULT 0,
        -- Bước thời gian của mã đã dùng gần nhất: chống dùng lại cùng một mã
        totp_buoc_cuoi      INTEGER,
        trang_thai          TEXT NOT NULL DEFAULT 'hoat_dong'
                            CHECK (trang_thai IN ('hoat_dong','khoa','chi_doc','luu_tru')),
        so_lan_sai          INTEGER NOT NULL DEFAULT 0,
        khoa_den            INTEGER,
        -- Thuê bao theo thời gian: NULL = không giới hạn
        han_dung            INTEGER,
        -- Hạn mức AI mỗi tháng, quy ra đồng: NULL = không giới hạn
        han_muc_thang_dong  INTEGER,
        tao_luc             INTEGER NOT NULL,
        cap_nhat_luc        INTEGER NOT NULL,
        dang_nhap_cuoi      INTEGER
    );
    CREATE INDEX tai_khoan_don_vi ON tai_khoan(don_vi_id);

    -- Phiên đăng nhập trình duyệt: chỉ lưu BĂM của token cookie.
    CREATE TABLE phien_dang_nhap (
        token_bam       TEXT PRIMARY KEY,
        tai_khoan_id    INTEGER NOT NULL REFERENCES tai_khoan(id) ON DELETE CASCADE,
        tao_luc         INTEGER NOT NULL,
        het_han         INTEGER NOT NULL,
        hoat_dong_cuoi  INTEGER NOT NULL,
        -- 0 = mới qua mật khẩu, còn chờ mã xác thực hai lớp
        da_xac_thuc_du  INTEGER NOT NULL DEFAULT 0,
        ip              TEXT,
        trinh_duyet     TEXT
    );
    CREATE INDEX phien_dang_nhap_tai_khoan ON phien_dang_nhap(tai_khoan_id);

    -- Token Cổng AI cấp cho phiên làm việc (container) — ngắn hạn, thu hồi được; chỉ lưu BĂM.
    CREATE TABLE token_ai (
        token_bam       TEXT PRIMARY KEY,
        tai_khoan_id    INTEGER NOT NULL REFERENCES tai_khoan(id) ON DELETE CASCADE,
        tao_luc         INTEGER NOT NULL,
        het_han         INTEGER NOT NULL,
        thu_hoi         INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX token_ai_tai_khoan ON token_ai(tai_khoan_id);

    -- Bảng giá mô hình (đồng / 1 triệu token). ma = tên mô hình Claude Code gửi lên;
    -- mo_hinh_goc = tên gửi tới nhà cung cấp.
    CREATE TABLE bang_gia (
        ma                  TEXT PRIMARY KEY,
        nha_cung_cap        TEXT NOT NULL CHECK (nha_cung_cap IN ('anthropic','deepseek','openai')),
        mo_hinh_goc         TEXT NOT NULL,
        ten_hien_thi        TEXT NOT NULL,
        gia_vao             INTEGER NOT NULL,
        gia_ra              INTEGER NOT NULL,
        gia_cache_doc       INTEGER NOT NULL DEFAULT 0,
        gia_cache_ghi       INTEGER NOT NULL DEFAULT 0,
        bat                 INTEGER NOT NULL DEFAULT 1,
        cap_nhat_luc        INTEGER NOT NULL
    );

    -- Mỗi lượt gọi AI (đã trừ hạn mức theo token thực tế).
    CREATE TABLE su_dung_ai (
        id              INTEGER PRIMARY KEY,
        tai_khoan_id    INTEGER NOT NULL REFERENCES tai_khoan(id) ON DELETE CASCADE,
        don_vi_id       INTEGER,
        luc             INTEGER NOT NULL,
        thang           TEXT NOT NULL,          -- 'YYYY-MM' theo giờ Việt Nam, để cộng hạn mức tháng
        mo_hinh         TEXT NOT NULL,
        nha_cung_cap    TEXT NOT NULL,
        token_vao       INTEGER NOT NULL DEFAULT 0,
        token_ra        INTEGER NOT NULL DEFAULT 0,
        token_cache_doc INTEGER NOT NULL DEFAULT 0,
        token_cache_ghi INTEGER NOT NULL DEFAULT 0,
        chi_phi_dong    INTEGER NOT NULL DEFAULT 0,
        trang_thai      TEXT NOT NULL,          -- xong | loi | huy
        ma_loi          TEXT
    );
    CREATE INDEX su_dung_ai_thang ON su_dung_ai(tai_khoan_id, thang);

    -- Phiên làm việc (container/tiến trình AWord Web) của từng tài khoản.
    CREATE TABLE phien_lam_viec (
        tai_khoan_id    INTEGER PRIMARY KEY REFERENCES tai_khoan(id) ON DELETE CASCADE,
        trinh           TEXT NOT NULL,
        ma_trinh        TEXT,                   -- id container / pid
        dia_chi         TEXT,                   -- host:port nội bộ
        trang_thai      TEXT NOT NULL,          -- dang_khoi_dong | chay | ngu | loi
        bat_dau         INTEGER,
        hoat_dong_cuoi  INTEGER
    );

    -- Nhật ký quản trị và bảo mật (ai làm gì, lúc nào).
    CREATE TABLE nhat_ky (
        id              INTEGER PRIMARY KEY,
        luc             INTEGER NOT NULL,
        tai_khoan_id    INTEGER,                -- người thực hiện (NULL = hệ thống)
        hanh_dong       TEXT NOT NULL,
        doi_tuong       TEXT,
        chi_tiet        TEXT,                   -- JSON
        ip              TEXT
    );
    CREATE INDEX nhat_ky_luc ON nhat_ky(luc);
    `,
    // 2 — đăng nhập bằng email hoặc số điện thoại (0xxxxxxxxx). ten_dang_nhap giữ làm khóa nội bộ = email (chữ thường)
    // nếu có, không thì số điện thoại. Mỗi tài khoản cần ít nhất một trong hai (kiểm ở tầng ứng dụng).
    `
    ALTER TABLE tai_khoan ADD COLUMN so_dien_thoai TEXT;
    UPDATE tai_khoan SET email = NULL WHERE email IS NOT NULL AND trim(email) = '';
    UPDATE tai_khoan SET email = lower(ten_dang_nhap)
        WHERE email IS NULL AND ten_dang_nhap LIKE '%_@_%'
          AND NOT EXISTS (SELECT 1 FROM tai_khoan k WHERE k.email = lower(tai_khoan.ten_dang_nhap) COLLATE NOCASE);
    UPDATE tai_khoan SET so_dien_thoai = ten_dang_nhap
        WHERE ten_dang_nhap GLOB '0[35789][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
    CREATE UNIQUE INDEX tai_khoan_email ON tai_khoan(email COLLATE NOCASE) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX tai_khoan_so_dien_thoai ON tai_khoan(so_dien_thoai) WHERE so_dien_thoai IS NOT NULL;
    `,
    // 3 — chỉ mục phục vụ trang Nhật ký và việc dọn nhật ký cũ.
    //     Lọc theo người thực hiện là truy vấn phổ biến nhất của trang (bấm vào một tài khoản), và
    //     `luc` là cột dùng để cắt theo thời hạn lưu. nhat_ky chỉ ghi thêm nên không có chỉ mục thì
    //     mỗi lần mở trang lại quét toàn bộ lịch sử, càng chạy càng chậm.
    `
    CREATE INDEX IF NOT EXISTS nhat_ky_tai_khoan ON nhat_ky(tai_khoan_id, id);
    `,
];

export function moCsdl(tep: string): DatabaseSync {
    if (tep !== ':memory:') { fs.mkdirSync(path.dirname(tep), { recursive: true }); }
    const db = new DatabaseSync(tep);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    nangCap(db);
    return db;
}

function nangCap(db: DatabaseSync): void {
    const hienTai = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
    for (let i = hienTai; i < NANG_CAP.length; i++) {
        giaoDich(db, () => {
            db.exec(NANG_CAP[i]);
            db.exec(`PRAGMA user_version = ${i + 1}`);
        });
    }
}

/** Chạy fn trong một giao dịch; lỗi thì hoàn tác. */
export function giaoDich<T>(db: DatabaseSync, fn: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try {
        const kq = fn();
        db.exec('COMMIT');
        return kq;
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}

/** Tháng theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè) — mốc cộng hạn mức. */
export function thangViet(luc: number = bayGio()): string {
    const d = new Date(luc + 7 * 3600 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function ghiNhatKy(db: DatabaseSync, muc: {
    taiKhoanId?: number | null; hanhDong: string; doiTuong?: string; chiTiet?: unknown; ip?: string;
}): void {
    db.prepare('INSERT INTO nhat_ky (luc, tai_khoan_id, hanh_dong, doi_tuong, chi_tiet, ip) VALUES (?, ?, ?, ?, ?, ?)')
        .run(bayGio(), muc.taiKhoanId ?? null, muc.hanhDong, muc.doiTuong ?? null,
            muc.chiTiet === undefined ? null : JSON.stringify(muc.chiTiet), muc.ip ?? null);
}

/**
 * Xóa nhật ký cũ hơn `giuNgay` ngày. Trả về số dòng đã xóa. `giuNgay <= 0` = giữ mãi, không xóa gì.
 *
 * Vì sao phải dọn: nhat_ky chỉ ghi thêm — mỗi lần đăng nhập, đăng xuất, mỗi thao tác quản trị và mỗi lần
 * phiên đổi trạng thái đều thêm một dòng, không có chỗ nào xóa. Trang Nhật ký lại đếm và lọc trên toàn
 * bảng, nên thời gian mở trang tăng dần theo thời gian máy chủ chạy, không theo lượng dữ liệu người dùng
 * thực sự xem.
 *
 * Xóa theo lô có trần: xóa một phát cả triệu dòng sẽ giữ khóa ghi hàng chục giây và chặn mọi yêu cầu khác
 * (SQLite đồng bộ trên cùng một luồng). Mỗi lô 5.000 dòng, tối đa 40 lô mỗi lần chạy — phần còn lại để lần
 * chạy hôm sau, vì đây là việc dọn nền chứ không phải việc gấp.
 *
 * LƯU Ý: đây là nhật ký kiểm toán. Đặt AWORD_WEB_GIU_NHAT_KY_NGAY=0 để giữ vĩnh viễn nếu cơ quan yêu cầu.
 */
export function donNhatKyCu(db: DatabaseSync, giuNgay: number): number {
    if (!Number.isFinite(giuNgay) || giuNgay <= 0) { return 0; }
    const moc = bayGio() - giuNgay * 24 * 3600 * 1000;
    const lenh = db.prepare('DELETE FROM nhat_ky WHERE id IN (SELECT id FROM nhat_ky WHERE luc < ? LIMIT 5000)');
    let tong = 0;
    for (let i = 0; i < 40; i++) {
        const n = Number(lenh.run(moc).changes);
        tong += n;
        if (n < 5000) { break; }
    }
    return tong;
}

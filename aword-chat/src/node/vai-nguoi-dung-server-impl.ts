import { injectable, inject, optional } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as os from 'os';
import * as fs from '@theia/core/shared/fs-extra';
import { KetQuaDatVai, KhoTriThucDaDangKy, TrangThaiVai, VaiNguoiDung, VaiNguoiDungServer } from '../common/vai-nguoi-dung-protocol';
import { KetQuaDongBoTriThuc, KhoTriThucServer } from '../common/kho-tri-thuc-protocol';
import { QUY_TAC_CLAUDE_MD, QUY_TAC_CLAUDE_MD_GIAO_VIEN } from '../common/quy-tac-workspace';

// Dịch vụ "Vai của bạn" — phía Node, là nơi DUY NHẤT sửa tệp cấu hình cá nhân của Claude Code.
// Nguyên tắc (nhất quán với Cap_Nhat_QuyTac.ps1 / Cap_Nhat_Cau_Hinh.ps1 của bộ cài):
//   - HỢP NHẤT, không ghi đè: CLAUDE.md chỉ thay/chèn/gỡ ĐÚNG khối AWORD-GIAOVIEN, giữ nguyên mọi thứ
//     khác; settings.json chỉ thêm/bớt đúng mục hook của Kho tri thức AI, giữ hook và khóa khác.
//   - SAO LƯU theo thời gian trước khi ghi (CLAUDE.backup-*.md, settings.backup-*.json) — không đè bản cũ.
//   - Không bao giờ xóa thư mục/tệp dữ liệu của người dùng (tắt vai chỉ gỡ quy tắc + hook).
//   - Idempotent: gọi lại với cùng vai không đổi gì, không sao lưu thừa.
// Di trú tên gọi (bản thử nghiệm dùng tên cũ): mục hook tên cũ trong settings.json luôn được gỡ khi áp vai;
// tệp hook tên cũ do chính AWord chép vào ~/.aword được xóa sau khi settings không còn trỏ tới nó.

export const RE_KHOI_GIAO_VIEN = /<!-- AWORD-GIAOVIEN:BEGIN[\s\S]*?AWORD-GIAOVIEN:END[^>]*-->/;
const RE_KHOI_AWORD = /<!-- AWORD:BEGIN[\s\S]*?AWORD:END[^>]*-->/;
export const TEN_TEP_KHOI_GIAO_VIEN = 'CLAUDE.giaovien.md';
export const TEN_TEP_HOOK = 'hook_trithuc.ps1';
// Tên cũ của bản thử nghiệm — CHỈ dùng để di trú/gỡ.
export const TEN_TEP_HOOK_CU = 'hook_khosgk.ps1';
const TEN_TEP_CAU_HINH_KHO = 'trithuc.json';
const TEN_TEP_CAU_HINH_KHO_CU = 'khosgk.json';
const TEN_WORKSPACE = 'AWord';
const TEN_THU_MUC_GIAO_VIEN = 'GIAO VIEN';
const THU_MUC_CON_GIAO_VIEN = ['HO SO CUA TOI', 'TU LIEU MON HOC', 'KE HOACH BAI DAY', 'BAI TRINH CHIEU', 'DE KIEM TRA', 'HOC LIEU TRUC QUAN', 'BO NHO'];
const THU_MUC_CON_HANH_CHINH = ['ABOUT ME', 'TEMPLATES', 'PROJECTS', 'CLAUDE OUTPUTS'];

interface HookLenh { type?: string; command?: string; timeout?: number; }
interface NhomHook { matcher?: string; hooks?: HookLenh[]; }

// Trả về nội dung CLAUDE.md mới, hoặc undefined nếu KHÔNG cần đổi.
//   bat=true : thay khối cũ bằng khối mới nếu khác; chưa có thì chèn NGAY SAU khối AWORD (hai khối do
//              AWord quản lý đứng cạnh nhau, phần người dùng viết vẫn ở sau); không có khối AWORD thì
//              đặt lên đầu, giữ toàn bộ nội dung cũ phía sau.
//   bat=false: gỡ khối (và dòng trống dư ngay sau), giữ nguyên phần còn lại.
export function hopNhatKhoiGiaoVien(hienTai: string | undefined, khoiNguon: string, bat: boolean): string | undefined {
    const mKhoi = RE_KHOI_GIAO_VIEN.exec(khoiNguon);
    if (bat && !mKhoi) {
        throw new Error('Tệp khối quy tắc giáo viên thiếu dấu mốc AWORD-GIAOVIEN:BEGIN/END.');
    }
    const khoiMoi = mKhoi ? mKhoi[0] : '';
    const cu = hienTai ?? '';
    const eol = /\r\n/.test(cu) ? '\r\n' : '\n';
    const mCu = RE_KHOI_GIAO_VIEN.exec(cu);
    if (bat) {
        if (mCu) {
            if (mCu[0] === khoiMoi) { return undefined; }
            return cu.substring(0, mCu.index) + khoiMoi + cu.substring(mCu.index + mCu[0].length);
        }
        const mAword = RE_KHOI_AWORD.exec(cu);
        if (mAword) {
            const cat = mAword.index + mAword[0].length;
            return cu.substring(0, cat) + eol + eol + khoiMoi + cu.substring(cat);
        }
        return cu.trim().length === 0 ? khoiMoi + eol : khoiMoi + eol + eol + cu.replace(/^\s+/, '');
    }
    if (!mCu) { return undefined; }
    const truoc = cu.substring(0, mCu.index);
    const sau = cu.substring(mCu.index + mCu[0].length).replace(/^(\r?\n)+/, '');
    // Bỏ dòng trống dư giữa phần trước và phần sau (tối đa để lại một dòng trống)
    const truocGon = truoc.replace(/(\r?\n){3,}$/, eol + eol);
    return truocGon + sau;
}

function laLenhHook(h: HookLenh, tenTep: string): boolean {
    return typeof h.command === 'string' && h.command.includes(tenTep);
}

// Có mục hook dùng tệp `tenTep` trong settings chưa (mọi nhóm SessionStart, mọi lệnh chứa tên tệp).
export function coHook(settings: Record<string, unknown>, tenTep: string = TEN_TEP_HOOK): boolean {
    const hooks = settings.hooks as Record<string, unknown> | undefined;
    const nhom = hooks?.SessionStart;
    if (!Array.isArray(nhom)) { return false; }
    return (nhom as NhomHook[]).some(n => Array.isArray(n.hooks) && n.hooks.some(h => laLenhHook(h, tenTep)));
}

// Thêm/gỡ đúng mục hook của Kho tri thức AI trong settings (sửa tại chỗ). Trả về true nếu có thay đổi.
// Luôn gỡ mục hook TÊN CŨ (bản thử nghiệm). Giữ nguyên mọi hook khác (kể cả hook SessionStart của người
// dùng); nhóm rỗng sau khi gỡ thì bỏ.
export function hopNhatHookTriThuc(settings: Record<string, unknown>, lenh: string, bat: boolean): boolean {
    const hooksGoc = settings.hooks;
    const hooks: Record<string, unknown> = (hooksGoc && typeof hooksGoc === 'object') ? hooksGoc as Record<string, unknown> : {};
    const nhomCu: NhomHook[] = Array.isArray(hooks.SessionStart) ? hooks.SessionStart as NhomHook[] : [];
    // Idempotent: đã có ĐÚNG MỘT mục của ta với cùng lệnh và không còn mục tên cũ → không đổi gì.
    const cuaTa: HookLenh[] = [];
    let soMucCu = 0;
    for (const n of nhomCu) {
        for (const h of (Array.isArray(n.hooks) ? n.hooks : [])) {
            if (laLenhHook(h, TEN_TEP_HOOK)) { cuaTa.push(h); }
            if (laLenhHook(h, TEN_TEP_HOOK_CU)) { soMucCu++; }
        }
    }
    if (bat && soMucCu === 0 && cuaTa.length === 1 && cuaTa[0].command === lenh) { return false; }
    let doi = false;
    const nhomMoi: NhomHook[] = [];
    for (const n of nhomCu) {
        if (!Array.isArray(n.hooks)) { nhomMoi.push(n); continue; }
        const conLai = n.hooks.filter(h => !laLenhHook(h, TEN_TEP_HOOK) && !laLenhHook(h, TEN_TEP_HOOK_CU));
        if (conLai.length !== n.hooks.length) {
            doi = true;
            if (conLai.length > 0) { nhomMoi.push({ ...n, hooks: conLai }); }
        } else {
            nhomMoi.push(n);
        }
    }
    if (bat) {
        nhomMoi.push({ matcher: 'startup|resume', hooks: [{ type: 'command', command: lenh, timeout: 10 }] });
        doi = true;
    }
    if (!doi) { return false; }
    if (nhomMoi.length > 0) {
        hooks.SessionStart = nhomMoi;
    } else {
        delete hooks.SessionStart;
    }
    if (Object.keys(hooks).length > 0) {
        settings.hooks = hooks;
    } else {
        delete settings.hooks;
    }
    return true;
}

// Công cụ Kho tri thức AI được Claude gọi KHÔNG hỏi lại (vai Giáo viên) — tra cứu, trạng thái, tạo đơn QR (chưa
// chuyển tiền), đóng góp (skill đã hỏi xác nhận quyền chia sẻ). CỐ Ý KHÔNG có: tt_doi_diem (tiêu điểm tích lũy, không
// hoàn lại) và tt_chuyen_may (chuyển bản quyền, giới hạn 2 lần/năm) — Claude Code vẫn hỏi người dùng trước khi gọi.
export const QUYEN_TRI_THUC = [
    'tt_trang_thai', 'tt_gioi_thieu', 'tt_thanh_toan', 'tt_kiem_tra_thanh_toan', 'tt_thong_bao', 'tt_gop_y', 'tt_danh_sach', 'tt_muc_luc',
    'tt_bai', 'tt_tim', 'tt_hinh', 'tt_hinh_theo_bai', 'tt_yeu_cau_can_dat', 'tt_cap_nhat', 'tt_dong_gop_tao', 'tt_dong_gop_ds', 'tt_diem'
].map(t => `mcp__trithuc__${t}`);

// Thêm (bat) / gỡ đúng các quy tắc QUYEN_TRI_THUC trong permissions.allow, giữ nguyên quy tắc khác và thứ tự.
// Trả về true nếu có thay đổi.
export function hopNhatQuyenTriThuc(settings: Record<string, unknown>, bat: boolean): boolean {
    const quyenGoc = settings.permissions;
    const quyen: Record<string, unknown> = (quyenGoc && typeof quyenGoc === 'object') ? quyenGoc as Record<string, unknown> : {};
    const allow: string[] = Array.isArray(quyen.allow) ? (quyen.allow as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const conLai = allow.filter(r => !QUYEN_TRI_THUC.includes(r));
    const moi = bat ? [...conLai, ...QUYEN_TRI_THUC] : conLai;
    const coCuaTa = allow.filter(r => QUYEN_TRI_THUC.includes(r));
    const daDung = bat ? coCuaTa.length === QUYEN_TRI_THUC.length && new Set(coCuaTa).size === QUYEN_TRI_THUC.length : coCuaTa.length === 0;
    if (daDung) { return false; }
    quyen.allow = moi;
    settings.permissions = quyen;
    return true;
}

function nhanThoiGian(): string {
    const d = new Date();
    const hai = (n: number) => (n < 10 ? '0' : '') + n;
    return `${d.getFullYear()}${hai(d.getMonth() + 1)}${hai(d.getDate())}-${hai(d.getHours())}${hai(d.getMinutes())}${hai(d.getSeconds())}`;
}

@injectable()
export class VaiNguoiDungServerImpl implements VaiNguoiDungServer {

    // Tùy chọn để kiểm thử dựng thẳng bằng `new` (không có DI) vẫn chạy phần vai như cũ.
    @inject(KhoTriThucServer) @optional()
    protected readonly khoTriThuc?: KhoTriThucServer;

    async docTrangThai(): Promise<TrangThaiVai> {
        const vaiJson = await this.docJson(this.tepVai());
        let vai: VaiNguoiDung | undefined;
        let ngayChon: string | undefined;
        if (vaiJson) {
            vai = { hanhChinh: vaiJson.hanh_chinh === true, giaoVien: vaiJson.giao_vien === true };
            ngayChon = typeof vaiJson.ngay === 'string' ? vaiJson.ngay : undefined;
        }
        const claudeMd = await this.docVanBan(this.tepClaudeMd());
        const settings = await this.docJson(this.tepSettings());
        return {
            vai,
            ngayChon,
            khoiGiaoVienTrongClaudeMd: !!claudeMd && RE_KHOI_GIAO_VIEN.test(claudeMd),
            hookTriThucDaBat: !!settings && coHook(settings, TEN_TEP_HOOK),
            hookCuConLai: !!settings && coHook(settings, TEN_TEP_HOOK_CU),
            quyenTriThucDaBat: !!settings && !hopNhatQuyenTriThuc(JSON.parse(JSON.stringify(settings)), true),
            thuMucGiaoVienDaCo: await fs.pathExists(this.thuMucGiaoVien()),
            thuMucGiaoVien: this.thuMucGiaoVien(),
            khoTriThuc: await this.docKhoTriThuc(),
            cauHinhCuChuaDiTru: !(await fs.pathExists(this.tepKhoTriThuc())) && await fs.pathExists(this.tepKhoTriThucCu())
        };
    }

    async datVai(vai: VaiNguoiDung): Promise<KetQuaDatVai> {
        const daLam: string[] = [];
        const canhBao: string[] = [];

        // 1. Lưu lựa chọn vai
        await fs.mkdirp(this.thuMucAword());
        await this.ghiVanBan(this.tepVai(), JSON.stringify({
            hanh_chinh: vai.hanhChinh, giao_vien: vai.giaoVien, ngay: new Date().toISOString()
        }, undefined, 2) + '\n');

        // 2. Khối AWORD-GIAOVIEN trong CLAUDE.md cấp người dùng (hợp nhất + sao lưu)
        try {
            const khoiNguon = vai.giaoVien ? await this.docKhoiGiaoVien() : '';
            const hienTai = await this.docVanBan(this.tepClaudeMd());
            const moi = hopNhatKhoiGiaoVien(hienTai, khoiNguon, vai.giaoVien);
            if (moi !== undefined) {
                await fs.mkdirp(this.thuMucClaude());
                const saoLuu = await this.saoLuu(this.tepClaudeMd(), `CLAUDE.backup-${nhanThoiGian()}.md`);
                await this.ghiVanBan(this.tepClaudeMd(), moi);
                daLam.push(vai.giaoVien
                    ? `Đã nạp quy tắc vai Giáo viên vào CLAUDE.md${saoLuu ? ' (bản cũ: ' + saoLuu + ')' : ''}.`
                    : `Đã gỡ quy tắc vai Giáo viên khỏi CLAUDE.md${saoLuu ? ' (bản cũ: ' + saoLuu + ')' : ''}.`);
            }
        } catch (e) {
            canhBao.push(`Không cập nhật được CLAUDE.md: ${this.moTaLoi(e)}`);
        }

        // 3. Cây thư mục (chỉ tạo thêm, không bao giờ xóa)
        try {
            if (vai.giaoVien) {
                const taoMoi = await this.taoCayGiaoVien();
                daLam.push(taoMoi ? `Đã tạo thư mục giáo viên ${this.thuMucGiaoVien()}.` : `Thư mục giáo viên ${this.thuMucGiaoVien()} đã sẵn sàng.`);
            }
            if (vai.hanhChinh) {
                await this.taoCayHanhChinh();
            }
        } catch (e) {
            canhBao.push(`Không tạo được thư mục làm việc: ${this.moTaLoi(e)}`);
        }

        // 4. Hook SessionStart Kho tri thức AI (chỉ vai Giáo viên) + chép hook_trithuc.ps1 vào ~/.aword;
        //    luôn gỡ mục hook tên cũ (bản thử nghiệm) nếu còn.
        try {
            if (vai.giaoVien) { await this.chepHook(); }
            const settingsCu = await this.docJson(this.tepSettings());
            if (!settingsCu && await fs.pathExists(this.tepSettings())) {
                canhBao.push('settings.json của Claude đang hỏng (không đọc được JSON) — giữ nguyên, chưa bật hook thông báo Kho tri thức AI.');
            } else {
                const settings: Record<string, unknown> = settingsCu ?? {};
                const coMucCu = coHook(settings, TEN_TEP_HOOK_CU);
                const daBatTruoc = coHook(settings, TEN_TEP_HOOK);
                const doiHook = hopNhatHookTriThuc(settings, this.lenhHook(), vai.giaoVien);
                const doiQuyen = hopNhatQuyenTriThuc(settings, vai.giaoVien);
                if (doiHook || doiQuyen) {
                    // Một lần sao lưu + một lần ghi cho cả hook và quyền.
                    await fs.mkdirp(this.thuMucClaude());
                    const saoLuu = await this.saoLuu(this.tepSettings(), `settings.backup-${nhanThoiGian()}.json`);
                    await this.ghiVanBan(this.tepSettings(), JSON.stringify(settings, undefined, 2) + '\n');
                    const ghiChuSaoLuu = saoLuu ? ' (settings.json cũ: ' + saoLuu + ')' : '';
                    if (doiHook && vai.giaoVien) {
                        daLam.push(coMucCu
                            ? `Đã chuyển hook thông báo đầu phiên sang Kho tri thức AI (gỡ mục tên cũ)${ghiChuSaoLuu}.`
                            : `Đã bật hook thông báo Kho tri thức AI đầu phiên${ghiChuSaoLuu}.`);
                    } else if (doiHook && (daBatTruoc || coMucCu)) {
                        daLam.push('Đã tắt hook thông báo Kho tri thức AI.');
                    }
                    if (doiQuyen) {
                        daLam.push(vai.giaoVien
                            ? `Đã cho phép Claude dùng công cụ Kho tri thức AI không hỏi lại (đổi điểm, chuyển máy vẫn hỏi)${doiHook ? '' : ghiChuSaoLuu}.`
                            : 'Đã gỡ quyền dùng công cụ Kho tri thức AI.');
                    }
                }
                // Tệp hook tên cũ do AWord tự chép vào ~/.aword: xóa khi settings không còn trỏ tới (không phải dữ liệu người dùng).
                if (!coHook(settings, TEN_TEP_HOOK_CU) && await fs.pathExists(this.tepHookCu())) {
                    await fs.remove(this.tepHookCu());
                }
            }
        } catch (e) {
            canhBao.push(`Không cập nhật được hook thông báo Kho tri thức AI: ${this.moTaLoi(e)}`);
        }

        // 5. Kho tri thức AI: vai Giáo viên → tự kết nối (token, mã máy, đăng ký MCP `trithuc`); tắt vai → gỡ đăng ký
        //    MCP (giữ trithuc.json để giữ bản quyền). Người dùng không phải chạy script nào.
        let khoTriThuc: KetQuaDongBoTriThuc | undefined;
        if (this.khoTriThuc) {
            try {
                khoTriThuc = vai.giaoVien ? await this.khoTriThuc.dongBo() : await this.khoTriThuc.goDangKy();
                daLam.push(...khoTriThuc.daLam);
                canhBao.push(...khoTriThuc.canhBao);
            } catch (e) {
                canhBao.push(`Chưa kết nối được Kho tri thức AI: ${this.moTaLoi(e)} — AWord sẽ tự thử lại ở lần mở sau.`);
            }
        }

        if (daLam.length === 0 && canhBao.length === 0) {
            daLam.push('Vai đã được lưu — cấu hình trên máy vốn đã đúng, không cần đổi gì.');
        }
        return { trangThai: await this.docTrangThai(), daLam, canhBao, khoTriThuc };
    }

    // ---- đường dẫn (tách riêng để kiểm thử có thể trỏ HOME sang thư mục tạm) ----
    // AWORD_HOME chỉ dùng khi kiểm thử cách ly. Thư mục cấu hình Claude theo đúng quy ước của Claude Code:
    // CLAUDE_CONFIG_DIR nếu có (settings.json, CLAUDE.md nằm thẳng trong đó), không thì ~/.claude.
    protected layThuMucHome(): string { return process.env.AWORD_HOME || os.homedir(); }
    protected thuMucAword(): string { return path.join(this.layThuMucHome(), '.aword'); }
    protected thuMucClaude(): string { return process.env.CLAUDE_CONFIG_DIR || path.join(this.layThuMucHome(), '.claude'); }
    protected tepVai(): string { return path.join(this.thuMucAword(), 'vai.json'); }
    protected tepKhoTriThuc(): string { return path.join(this.thuMucAword(), TEN_TEP_CAU_HINH_KHO); }
    protected tepKhoTriThucCu(): string { return path.join(this.thuMucAword(), TEN_TEP_CAU_HINH_KHO_CU); }
    protected tepHook(): string { return path.join(this.thuMucAword(), TEN_TEP_HOOK); }
    protected tepHookCu(): string { return path.join(this.thuMucAword(), TEN_TEP_HOOK_CU); }
    protected tepClaudeMd(): string { return path.join(this.thuMucClaude(), 'CLAUDE.md'); }
    protected tepSettings(): string { return path.join(this.thuMucClaude(), 'settings.json'); }
    protected thuMucWorkspace(): string { return path.join(this.layThuMucHome(), 'Documents', TEN_WORKSPACE); }
    protected thuMucGiaoVien(): string { return path.join(this.thuMucWorkspace(), TEN_THU_MUC_GIAO_VIEN); }

    // Lệnh hook ghi vào settings.json: đường dẫn tuyệt đối tới bản chép trong ~/.aword (dấu "/" để
    // không phụ thuộc shell chạy hook), PowerShell không profile, không hỏi, bỏ qua execution policy.
    protected lenhHook(): string {
        const duongDan = this.tepHook().replace(/\\/g, '/');
        return `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${duongDan}"`;
    }

    // Tài nguyên đóng gói kèm app (electron-app/resources/giao-vien/): bản cài đặt nằm ở
    // resources/app/resources/giao-vien; khi chạy dev thì theo cwd (electron-app|browser-app) hoặc
    // suy từ vị trí tệp này (aword-chat/lib/node). Dự phòng cuối: bản installer ghi vào ~/.claude.
    protected timTaiNguyen(ten: string): string | undefined {
        const ungVien: string[] = [];
        const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
        if (resourcesPath) { ungVien.push(path.join(resourcesPath, 'app', 'resources', 'giao-vien', ten)); }
        ungVien.push(path.join(process.cwd(), 'resources', 'giao-vien', ten));
        ungVien.push(path.join(__dirname, '..', '..', '..', 'electron-app', 'resources', 'giao-vien', ten));
        return ungVien.find(p => fs.existsSync(p));
    }

    protected async docKhoiGiaoVien(): Promise<string> {
        const tep = this.timTaiNguyen(TEN_TEP_KHOI_GIAO_VIEN) ?? path.join(this.thuMucClaude(), 'CLAUDE.giaovien-moi.md');
        const noiDung = await this.docVanBan(tep);
        if (!noiDung) {
            throw new Error(`Không tìm thấy tệp quy tắc vai Giáo viên (${TEN_TEP_KHOI_GIAO_VIEN}) trong tài nguyên AWord.`);
        }
        return noiDung;
    }

    protected async chepHook(): Promise<void> {
        const nguon = this.timTaiNguyen(TEN_TEP_HOOK);
        if (!nguon) {
            throw new Error(`Không tìm thấy ${TEN_TEP_HOOK} trong tài nguyên AWord.`);
        }
        await fs.mkdirp(this.thuMucAword());
        await fs.copy(nguon, this.tepHook(), { overwrite: true });
    }

    // Trả về true nếu thư mục GIAO VIEN được tạo mới trong lần gọi này.
    protected async taoCayGiaoVien(): Promise<boolean> {
        const goc = this.thuMucGiaoVien();
        const moi = !(await fs.pathExists(goc));
        await fs.mkdirp(goc);
        for (const con of THU_MUC_CON_GIAO_VIEN) {
            await fs.mkdirp(path.join(goc, con));
        }
        const claudeMd = path.join(goc, 'CLAUDE.md');
        if (!(await fs.pathExists(claudeMd))) {
            await this.ghiVanBan(claudeMd, QUY_TAC_CLAUDE_MD_GIAO_VIEN + '\n');
        }
        return moi;
    }

    protected async taoCayHanhChinh(): Promise<void> {
        const goc = this.thuMucWorkspace();
        await fs.mkdirp(goc);
        for (const con of THU_MUC_CON_HANH_CHINH) {
            await fs.mkdirp(path.join(goc, con));
        }
        const claudeMd = path.join(goc, 'CLAUDE.md');
        if (!(await fs.pathExists(claudeMd))) {
            await this.ghiVanBan(claudeMd, QUY_TAC_CLAUDE_MD + '\n');
        }
    }

    protected async docKhoTriThuc(): Promise<KhoTriThucDaDangKy | undefined> {
        const j = await this.docJson(this.tepKhoTriThuc());
        if (!j || typeof j.url !== 'string' || typeof j.ma_may !== 'string') { return undefined; }
        return { url: j.url, maMay: j.ma_may, ngay: typeof j.ngay === 'string' ? j.ngay : undefined };
    }

    // Sao lưu theo thời gian (nếu tệp có); trả về tên tệp sao lưu hoặc undefined.
    protected async saoLuu(tep: string, tenSaoLuu: string): Promise<string | undefined> {
        if (!(await fs.pathExists(tep))) { return undefined; }
        const dich = path.join(path.dirname(tep), tenSaoLuu);
        await fs.copy(tep, dich, { overwrite: true });
        return tenSaoLuu;
    }

    protected async docVanBan(tep: string): Promise<string | undefined> {
        try {
            const raw = await fs.readFile(tep, 'utf8');
            return raw.replace(/^﻿/, '');
        } catch {
            return undefined;
        }
    }

    protected async docJson(tep: string): Promise<Record<string, unknown> | undefined> {
        const raw = await this.docVanBan(tep);
        if (raw === undefined) { return undefined; }
        try {
            const v = JSON.parse(raw);
            return (v && typeof v === 'object') ? v as Record<string, unknown> : undefined;
        } catch {
            return undefined;
        }
    }

    // Ghi UTF-8 KHÔNG BOM, atomic (ghi tệp tạm rồi đổi tên) — không để tệp cấu hình hỏng dở.
    protected async ghiVanBan(tep: string, noiDung: string): Promise<void> {
        await fs.mkdirp(path.dirname(tep));
        const tam = `${tep}.tmp-${process.pid}`;
        await fs.writeFile(tam, noiDung, { encoding: 'utf8' });
        await fs.move(tam, tep, { overwrite: true });
    }

    protected moTaLoi(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }
}

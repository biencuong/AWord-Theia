import { injectable } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { execFile } from 'child_process';
import * as fs from '@theia/core/shared/fs-extra';
import {
    BanQuyenTriThuc, KetQuaDongBoTriThuc, KhoTriThucServer, TinhTrangMayChu, TrangThaiKhoTriThuc, URL_TRI_THUC_MAC_DINH
} from '../common/kho-tri-thuc-protocol';

// Kết nối tự động Kho tri thức AI giảng dạy — thay cho Ket_Noi_KhoTriThuc.cmd (xem kho-tri-thuc-protocol.ts).
// Tương thích hai chiều với script: cùng tệp ~/.aword/trithuc.json, cùng thuật toán mã máy, cùng tên MCP và
// header — máy đã chạy script vẫn giữ nguyên token (bản quyền), chạy script sau này cũng không lệch.

const TEN_MCP = 'trithuc';
const TEN_MCP_CU = 'khosgk';
const TEN_TEP = 'trithuc.json';
const TEN_TEP_CU = 'khosgk.json';
const RE_TOKEN = /^[A-Za-z0-9]{32,200}$/;
const RE_MA_MAY = /^M-[0-9A-F]{4}(-[0-9A-F]{4}){4}$/;
const HAN_REST_MS = 8000;
const HAN_CLI_MS = 60000;

// Mã máy — NGUYÊN VĂN thuật toán của Ket_Noi_KhoTriThuc.cmd (bước 3): "M-" + 20 hex đầu (in hoa) của
// SHA-256("UUID bo mạch|số sê-ri ổ hệ thống|tên máy"), nhóm 4. Chạy đúng bằng PowerShell để giá trị WMI
// (UUID, VolumeSerialNumber) và $env:COMPUTERNAME trùng khít với script.
const PS_MA_MAY = [
    "$ErrorActionPreference = 'Stop'",
    "$uuid = ''; try { $uuid = [string](Get-CimInstance Win32_ComputerSystemProduct).UUID } catch { }",
    "$oHT = $env:SystemDrive; if (-not $oHT) { $oHT = 'C:' }",
    "$seri = ''; try { $seri = [string](Get-CimInstance Win32_LogicalDisk -Filter ('DeviceID=''' + $oHT + '''')).VolumeSerialNumber } catch { }",
    "$goc = $uuid + '|' + $seri + '|' + $env:COMPUTERNAME",
    '$sha = [System.Security.Cryptography.SHA256]::Create()',
    '$bam = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($goc))',
    "$hex = (($bam | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 20).ToUpper()",
    "'M-' + $hex.Substring(0,4) + '-' + $hex.Substring(4,4) + '-' + $hex.Substring(8,4) + '-' + $hex.Substring(12,4) + '-' + $hex.Substring(16,4)"
].join('; ');

interface CauHinhTriThuc {
    url?: string;
    ma_may?: string;
    token?: string;
    ngay?: string;
    [khoa: string]: unknown;
}

interface MucMcp {
    type?: string;
    url?: string;
    headers?: Record<string, string>;
}

interface KetQuaHoi {
    tinhTrang: TinhTrangMayChu;
    banQuyen?: BanQuyenTriThuc;
    thongDiepMayChu?: string;
}

function ngayGioDiaPhuong(d = new Date()): string {
    const hai = (n: number) => (n < 10 ? '0' : '') + n;
    const lech = -d.getTimezoneOffset();
    const dau = lech >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}T${hai(d.getHours())}:${hai(d.getMinutes())}:${hai(d.getSeconds())}` +
        `${dau}${hai(Math.floor(Math.abs(lech) / 60))}:${hai(Math.abs(lech) % 60)}`;
}

function ngayVn(iso?: string): string | undefined {
    const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
    return m ? `${m[3]}/${m[2]}/${m[1]}` : undefined;
}

@injectable()
export class KhoTriThucServerImpl implements KhoTriThucServer {

    protected dangChay: Promise<KetQuaDongBoTriThuc> | undefined;

    async docTrangThai(kiemTraMayChu: boolean): Promise<TrangThaiKhoTriThuc> {
        const ch = await this.docCauHinh();
        const mcp = await this.docMcp();
        const coDu = !!ch && this.hopLe(ch);
        const hoi: KetQuaHoi = kiemTraMayChu && coDu
            ? await this.hoiTrangThai(ch!.url!, ch!.token!, ch!.ma_may!)
            : { tinhTrang: 'chua_kiem_tra' };
        return this.dungTrangThai(ch, !!coDu && this.khopDangKy(mcp.trithuc, ch!), hoi);
    }

    dongBo(): Promise<KetQuaDongBoTriThuc> {
        return this.noiTiep(() => this.thucHienDongBo());
    }

    goDangKy(): Promise<KetQuaDongBoTriThuc> {
        return this.noiTiep(() => this.thucHienGoDangKy());
    }

    // Không cho hai lượt đồng bộ/gỡ chạy chồng (mở AWord + bấm vai cùng lúc) — lượt sau đợi lượt trước.
    protected noiTiep(viec: () => Promise<KetQuaDongBoTriThuc>): Promise<KetQuaDongBoTriThuc> {
        const truoc = this.dangChay ?? Promise.resolve(undefined as unknown as KetQuaDongBoTriThuc);
        const lan = truoc.catch(() => undefined).then(viec);
        this.dangChay = lan;
        return lan;
    }

    protected async thucHienDongBo(): Promise<KetQuaDongBoTriThuc> {
        const daLam: string[] = [];
        const canhBao: string[] = [];

        // 1. Cấu hình máy khách: dùng lại trithuc.json; chưa có thì di trú khosgk.json (bản thử nghiệm); không có nữa thì tạo mới.
        let ch = await this.docCauHinh();
        let diTru = false;
        if (!ch || !RE_TOKEN.test(String(ch.token ?? ''))) {
            const cu = await this.docJson(this.tepCu());
            if (cu && RE_TOKEN.test(String(cu.token ?? ''))) {
                ch = { ...cu, di_tru_tu: TEN_TEP_CU, di_tru_luc: ngayGioDiaPhuong() };
                diTru = true;
                daLam.push('Đã chuyển token thiết bị từ cấu hình thử nghiệm cũ — giữ nguyên bản quyền.');
            }
        }
        const moi: CauHinhTriThuc = { ...(ch ?? {}) };
        let canGhi = diTru;
        const url = this.chonUrl(ch);
        if (moi.url !== url) { moi.url = url; canGhi = true; }
        if (!RE_TOKEN.test(String(moi.token ?? ''))) {
            moi.token = crypto.randomBytes(32).toString('hex');
            moi.ngay = ngayGioDiaPhuong();
            canGhi = true;
            daLam.push('Đã tạo token thiết bị cho máy này.');
        }
        if (!RE_MA_MAY.test(String(moi.ma_may ?? ''))) {
            const ma = await this.tinhMaMay();
            if (!ma) {
                canhBao.push('Không tính được mã máy để kết nối Kho tri thức AI — AWord sẽ thử lại ở lần mở sau.');
                return { trangThai: this.dungTrangThai(ch, false, { tinhTrang: 'chua_kiem_tra' }), thayDoiDangKy: false, daLam, canhBao };
            }
            moi.ma_may = ma;
            canGhi = true;
        }

        // 2. Hỏi máy chủ (REST, không đánh dấu đã đọc). Báo lệch máy → tính lại mã máy (đổi phần cứng/cài lại Windows).
        let hoi = await this.hoiTrangThai(moi.url!, moi.token!, moi.ma_may!);
        if (hoi.tinhTrang === 'may_khong_khop') {
            const maThat = await this.tinhMaMay();
            if (maThat && maThat !== moi.ma_may) {
                moi.ma_may_cu = moi.ma_may;
                moi.ma_may = maThat;
                canGhi = true;
                hoi = await this.hoiTrangThai(moi.url!, moi.token!, moi.ma_may);
            }
        }
        if (canGhi) {
            if (moi.ngay && ch?.ngay) { moi.cap_nhat = ngayGioDiaPhuong(); }
            await this.ghiRieng(this.tep(), JSON.stringify(moi, undefined, 2));
            if (diTru) {
                await fs.move(this.tepCu(), path.join(this.thuMucAword(), 'khosgk.da-chuyen-sang-trithuc.json'), { overwrite: true }).catch(() => { /* bỏ qua */ });
            }
        }

        // 3. Đăng ký MCP `trithuc`: chỉ khi máy chủ đã trả lời (hoặc đã từng đăng ký — cập nhật cho khớp token/mã máy).
        let mcp = await this.docMcp();
        let thayDoiDangKy = false;
        if (mcp.khosgk) {
            // Tên cũ của bản thử nghiệm trỏ /khosgk/mcp đã không còn — gỡ ngay, kể cả khi chưa đăng ký được tên mới.
            await this.chayClaude(['mcp', 'remove', TEN_MCP_CU, '-s', 'user']);
            mcp = await this.docMcp();
            thayDoiDangKy = !mcp.khosgk;
        }
        const khop = this.khopDangKy(mcp.trithuc, moi);
        const mayChuTraLoi = hoi.tinhTrang !== 'khong_phan_hoi' && hoi.tinhTrang !== 'chua_kiem_tra';
        if (!khop && (mayChuTraLoi || !!mcp.trithuc)) {
            const loi = await this.dangKyMcp(moi, !!mcp.trithuc);
            mcp = await this.docMcp();
            if (this.khopDangKy(mcp.trithuc, moi)) {
                thayDoiDangKy = true;
                daLam.push(`Đã kết nối Kho tri thức AI giảng dạy (máy ${moi.ma_may}).`);
            } else {
                canhBao.push(`Chưa đăng ký được Kho tri thức AI vào Claude: ${loi || 'cấu hình Claude không nhận mục trithuc'}. AWord sẽ thử lại ở lần mở sau.`);
            }
        }
        const trangThai = this.dungTrangThai(moi, this.khopDangKy(mcp.trithuc, moi), hoi);
        return { trangThai, thayDoiDangKy, daLam, canhBao };
    }

    protected async thucHienGoDangKy(): Promise<KetQuaDongBoTriThuc> {
        const daLam: string[] = [];
        const canhBao: string[] = [];
        const truoc = await this.docMcp();
        let thayDoiDangKy = false;
        if (truoc.trithuc || truoc.khosgk) {
            if (truoc.khosgk) { await this.chayClaude(['mcp', 'remove', TEN_MCP_CU, '-s', 'user']); }
            if (truoc.trithuc) { await this.chayClaude(['mcp', 'remove', TEN_MCP, '-s', 'user']); }
            const sau = await this.docMcp();
            thayDoiDangKy = (!!truoc.trithuc && !sau.trithuc) || (!!truoc.khosgk && !sau.khosgk);
            if (sau.trithuc) {
                canhBao.push('Chưa gỡ được Kho tri thức AI khỏi cấu hình Claude — thử bấm lại vai.');
            } else {
                daLam.push('Đã tắt công cụ Kho tri thức AI trong Claude (vẫn giữ bản quyền của máy để bật lại khi cần).');
            }
        }
        const ch = await this.docCauHinh();
        return { trangThai: this.dungTrangThai(ch, false, { tinhTrang: 'chua_kiem_tra' }), thayDoiDangKy, daLam, canhBao };
    }

    protected async dangKyMcp(ch: CauHinhTriThuc, coTriThuc: boolean): Promise<string> {
        if (coTriThuc) { await this.chayClaude(['mcp', 'remove', TEN_MCP, '-s', 'user']); }
        const muc: MucMcp = {
            type: 'http',
            url: ch.url,
            headers: { 'Authorization': `Bearer ${ch.token}`, 'X-May': ch.ma_may!, 'X-Ten-May': this.tenMay() }
        };
        const kq = await this.chayClaude(['mcp', 'add-json', '-s', 'user', TEN_MCP, JSON.stringify(muc)]);
        if (kq.loi) { return kq.loi; }
        // Không in token: chỉ lấy dòng lỗi đầu, che mọi chuỗi token.
        return kq.ma === 0 ? '' : (kq.stderr || kq.stdout).split(/\r?\n/)[0].split(ch.token!).join('***').slice(0, 200);
    }

    protected dungTrangThai(ch: CauHinhTriThuc | undefined, daDangKyMcp: boolean, hoi: KetQuaHoi): TrangThaiKhoTriThuc {
        const coDu = !!ch && this.hopLe(ch);
        return {
            hoTro: this.hoTro(),
            daCauHinh: coDu,
            url: ch?.url,
            maMay: ch?.ma_may,
            ngayDangKy: typeof ch?.ngay === 'string' ? ch.ngay : undefined,
            daDangKyMcp,
            mayChu: hoi.tinhTrang,
            banQuyen: hoi.banQuyen,
            thongDiep: this.moTa(coDu, daDangKyMcp, hoi, ch?.ma_may)
        };
    }

    protected moTa(coDu: boolean, daDangKy: boolean, hoi: KetQuaHoi, maMay?: string): string {
        if (!this.hoTro()) { return 'Chưa hỗ trợ tự kết nối Kho tri thức AI trên hệ điều hành này.'; }
        const may = maMay ? ` (máy ${maMay})` : '';
        switch (hoi.tinhTrang) {
            case 'khong_phan_hoi':
                return daDangKy
                    ? `Đã kết nối${may}, nhưng lúc này chưa liên lạc được máy chủ — kiểm tra mạng Internet.`
                    : 'Chưa liên lạc được máy chủ Kho tri thức AI — kiểm tra mạng Internet; AWord tự kết nối ở lần mở sau.';
            case 'may_khong_khop':
                return `Bản quyền đang gắn với máy khác${may} — nói với Claude: "Chuyển bản quyền Kho tri thức AI sang máy này".`;
            case 'bi_tu_choi':
                return hoi.thongDiepMayChu || 'Máy chủ từ chối thiết bị này — liên hệ hỗ trợ AWord (0983 606 845).';
            case 'ket_noi': {
                const bq = hoi.banQuyen;
                const dau = daDangKy ? `Đã kết nối${may}` : `Máy chủ đã phản hồi${may}, đang chờ đăng ký vào Claude`;
                if (!bq) { return `${dau}.`; }
                const han = ngayVn(bq.hetHan);
                switch (bq.trangThai) {
                    case 'chua_kich_hoat': return `${dau} — chưa kích hoạt: gõ "Thanh toán Kho tri thức AI" trong khung chat để nhận mã QR.`;
                    case 'hoat_dong': return `${dau} — đang hoạt động${han ? ' đến ' + han : ''}${bq.soDiem ? `, ${bq.soDiem} điểm tích lũy` : ''}.`;
                    case 'sap_het_han': return `${dau} — sắp hết hạn${han ? ' (' + han + ')' : ''}: gõ "Thanh toán Kho tri thức AI" trong khung chat để gia hạn.`;
                    case 'het_han': return `${dau} — đã hết hạn${han ? ' từ ' + han : ''}: gõ "Thanh toán Kho tri thức AI" trong khung chat để gia hạn.`;
                    case 'cho_doi_may': return `${dau} — đang chờ duyệt chuyển bản quyền sang máy này.`;
                    case 'khoa': return `${dau} — thiết bị đang bị khóa, liên hệ hỗ trợ AWord (0983 606 845).`;
                    default: return `${dau} — trạng thái: ${bq.trangThai}.`;
                }
            }
            default:
                return daDangKy ? `Đã kết nối${may}.` : coDu ? `Đã có cấu hình${may}, chưa đăng ký vào Claude.` : 'Chưa kết nối.';
        }
    }

    // ---- máy chủ ----

    protected hoiTrangThai(url: string, token: string, maMay: string): Promise<KetQuaHoi> {
        const goc = url.trim().replace(/\/+$/, '').replace(/\/mcp$/i, '').replace(/\/khosgk$/i, '/trithuc');
        let dich: URL;
        try { dich = new URL(`${goc}/api/v1/trang-thai?doc=0`); } catch { return Promise.resolve({ tinhTrang: 'khong_phan_hoi' }); }
        const thuVien = dich.protocol === 'http:' ? http : https;
        return new Promise(resolve => {
            let xong = false;
            const ket = (kq: KetQuaHoi) => { if (!xong) { xong = true; clearTimeout(han); req.destroy(); resolve(kq); } };
            const req = thuVien.request(dich, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'X-May': maMay, 'X-Ten-May': this.tenMay(), 'Accept': 'application/json', 'User-Agent': 'AWord-KhoTriThuc' }
            }, res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', d => { body += d; if (body.length > 1e6) { ket({ tinhTrang: 'khong_phan_hoi' }); } });
                res.on('end', () => ket(this.dienGiai(res.statusCode ?? 0, body)));
                res.on('error', () => ket({ tinhTrang: 'khong_phan_hoi' }));
            });
            const han = setTimeout(() => ket({ tinhTrang: 'khong_phan_hoi' }), HAN_REST_MS);
            req.on('error', () => ket({ tinhTrang: 'khong_phan_hoi' }));
            req.end();
        });
    }

    // Chỉ coi là "máy chủ Kho tri thức AI đã trả lời" khi thân là JSON đúng hợp đồng (trang_thai / loi) —
    // trang 404 HTML của host chưa triển khai, cổng captive... đều là "không phản hồi".
    protected dienGiai(status: number, body: string): KetQuaHoi {
        let j: Record<string, unknown> | undefined;
        try { j = JSON.parse(body); } catch { return { tinhTrang: 'khong_phan_hoi' }; }
        if (!j || typeof j !== 'object') { return { tinhTrang: 'khong_phan_hoi' }; }
        if (status === 200 && typeof j.trang_thai === 'string') {
            return {
                tinhTrang: 'ket_noi',
                banQuyen: {
                    trangThai: j.trang_thai,
                    hetHan: typeof j.het_han === 'string' ? j.het_han : undefined,
                    conNgay: typeof j.con_ngay === 'number' ? j.con_ngay : undefined,
                    soDiem: typeof j.so_diem === 'number' ? j.so_diem : undefined
                }
            };
        }
        const loi = typeof j.loi === 'string' ? j.loi : '';
        const thongDiep = typeof j.thong_diep === 'string' ? j.thong_diep : undefined;
        if (loi === 'may_khong_khop') { return { tinhTrang: 'may_khong_khop', thongDiepMayChu: thongDiep }; }
        if (loi) { return { tinhTrang: 'bi_tu_choi', thongDiepMayChu: thongDiep }; }
        return { tinhTrang: 'khong_phan_hoi' };
    }

    // ---- cấu hình Claude (đọc trực tiếp; GHI chỉ qua claude.exe để không đè trạng thái các phiên Claude đang chạy) ----

    protected async docMcp(): Promise<{ trithuc?: MucMcp; khosgk?: MucMcp }> {
        const j = await this.docJson(this.tepCauHinhClaude());
        const ds = (j?.mcpServers && typeof j.mcpServers === 'object') ? j.mcpServers as Record<string, MucMcp> : {};
        return { trithuc: ds[TEN_MCP], khosgk: ds[TEN_MCP_CU] };
    }

    protected khopDangKy(muc: MucMcp | undefined, ch: CauHinhTriThuc): boolean {
        if (!muc || !ch.url || !ch.token || !ch.ma_may) { return false; }
        const h = muc.headers ?? {};
        return (muc.type ?? 'http') === 'http' && muc.url === ch.url
            && h['Authorization'] === `Bearer ${ch.token}` && h['X-May'] === ch.ma_may;
    }

    protected chayClaude(thamSo: string[]): Promise<{ ma: number; stdout: string; stderr: string; loi?: string }> {
        const exe = this.timClaude();
        if (!exe) {
            return Promise.resolve({ ma: -1, stdout: '', stderr: '', loi: 'không tìm thấy claude.exe đóng kèm AWord' });
        }
        const env: NodeJS.ProcessEnv = { ...process.env };
        for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'ELECTRON_RUN_AS_NODE']) { delete env[k]; }
        return new Promise(resolve => {
            execFile(exe, thamSo, { env, windowsHide: true, timeout: HAN_CLI_MS, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
                const ma = err ? (typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : -1) : 0;
                resolve({ ma, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), loi: err && ma === -1 ? err.message.slice(0, 200) : undefined });
            });
        });
    }

    // claude.exe của plugin Claude Code: bản cập nhật cá nhân (nút "Cập nhật Claude Code") → bản đóng kèm → bản dev.
    protected timClaude(): string | undefined {
        const bin = process.platform === 'win32' ? 'claude.exe' : 'claude';
        const duoi = path.join('Anthropic.claude-code', 'extension', 'resources', 'native-binary', bin);
        const ungVien: string[] = [];
        if (process.env.AWORD_CAP_NHAT_PLUGIN_DIR) { ungVien.push(path.join(process.env.AWORD_CAP_NHAT_PLUGIN_DIR, duoi)); }
        const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
        if (resourcesPath) { ungVien.push(path.join(resourcesPath, 'app', 'plugins', duoi)); }
        ungVien.push(path.join(path.dirname(process.execPath), 'resources', 'app', 'plugins', duoi));
        ungVien.push(path.join(process.cwd(), 'plugins', duoi));
        ungVien.push(path.join(__dirname, '..', '..', '..', 'electron-app', 'plugins', duoi));
        return ungVien.find(p => fs.existsSync(p));
    }

    // ---- mã máy ----

    protected hoTro(): boolean {
        return process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux';
    }

    protected async tinhMaMay(): Promise<string | undefined> {
        if (process.platform === 'win32') {
            // Lệnh đưa qua stdin (-Command -), KHÔNG dùng -EncodedCommand: phần mềm bảo mật ở cơ quan hay chặn/cảnh báo
            // PowerShell mã hóa base64 do ứng dụng khác sinh ra.
            return new Promise(resolve => {
                const p = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
                    { windowsHide: true, timeout: 45000 }, (err, stdout) => {
                        const ma = String(stdout ?? '').trim().split(/\r?\n/).map(s => s.trim()).filter(s => RE_MA_MAY.test(s)).pop();
                        resolve(!err && ma ? ma : undefined);
                    });
                p.stdin?.end(PS_MA_MAY + '\r\n');
            });
        }
        // macOS/Linux (script chỉ có bản Windows): cùng khuôn "UUID|sê-ri|tên máy" từ nguồn tương đương của hệ điều hành.
        let uuid = '';
        try {
            if (process.platform === 'darwin') {
                uuid = await new Promise<string>(resolve => execFile('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { timeout: 15000 },
                    (_e, out) => resolve((/"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(String(out ?? '')) ?? [])[1] ?? '')));
            } else {
                uuid = (await fs.readFile('/etc/machine-id', 'utf8')).trim();
            }
        } catch { /* để trống như script khi WMI lỗi */ }
        const hex = crypto.createHash('sha256').update(`${uuid}||${os.hostname()}`, 'utf8').digest('hex').substring(0, 20).toUpperCase();
        return `M-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}`;
    }

    protected tenMay(): string {
        return (process.env.COMPUTERNAME || os.hostname() || '').slice(0, 120);
    }

    // ---- đường dẫn & tệp ----

    // AWORD_HOME chỉ dùng khi kiểm thử cách ly (không đặt trên máy người dùng).
    protected layThuMucHome(): string { return process.env.AWORD_HOME || os.homedir(); }
    protected thuMucAword(): string { return path.join(this.layThuMucHome(), '.aword'); }
    protected tep(): string { return path.join(this.thuMucAword(), TEN_TEP); }
    protected tepCu(): string { return path.join(this.thuMucAword(), TEN_TEP_CU); }
    protected tepCauHinhClaude(): string {
        return path.join(process.env.CLAUDE_CONFIG_DIR || this.layThuMucHome(), '.claude.json');
    }

    // Địa chỉ máy chủ: biến AWORD_TRITHUC_URL (kiểm thử/triển khai nội bộ) → trithuc.json → tệp trithuc.url
    // cạnh AWordPro.exe (script ghi khi người dùng nhập địa chỉ khác) → khosgk.url cũ (đổi /khosgk/ → /trithuc/) → mặc định.
    // Địa chỉ cũ của AWord Pro 3.0.0 (đường dẫn /trithuc dưới tên miền chính, đã ghi vào trithuc.json) tự chuyển sang tên miền riêng;
    // url khác đi thì thucHienDongBo ghi lại trithuc.json và đăng ký lại MCP.
    protected chonUrl(ch: CauHinhTriThuc | undefined): string {
        const chuan = (u: string) => u.trim()
            .replace(/\/khosgk\//i, '/trithuc/')
            .replace(/\/\/aword\.vn\/trithuc\//i, '//trithuc.aword.vn/');
        if (process.env.AWORD_TRITHUC_URL) { return chuan(process.env.AWORD_TRITHUC_URL); }
        if (typeof ch?.url === 'string' && /^https?:\/\//i.test(ch.url.trim())) { return chuan(ch.url); }
        const thuMucCai = path.dirname(process.execPath);
        for (const ten of ['trithuc.url', 'khosgk.url']) {
            try {
                const u = fs.readFileSync(path.join(thuMucCai, ten), 'utf8').trim();
                if (/^https?:\/\//i.test(u)) { return chuan(u); }
            } catch { /* không có tệp */ }
        }
        return URL_TRI_THUC_MAC_DINH;
    }

    protected hopLe(ch: CauHinhTriThuc): boolean {
        return typeof ch.url === 'string' && RE_TOKEN.test(String(ch.token ?? '')) && RE_MA_MAY.test(String(ch.ma_may ?? ''));
    }

    protected async docCauHinh(): Promise<CauHinhTriThuc | undefined> {
        return this.docJson(this.tep()) as Promise<CauHinhTriThuc | undefined>;
    }

    protected async docJson(tep: string): Promise<Record<string, unknown> | undefined> {
        try {
            const v = JSON.parse((await fs.readFile(tep, 'utf8')).replace(/^﻿/, ''));
            return v && typeof v === 'object' ? v as Record<string, unknown> : undefined;
        } catch {
            return undefined;
        }
    }

    // Ghi atomic (tệp tạm rồi đổi tên), UTF-8 không BOM như script; quyền 600 trên macOS/Linux (chứa token).
    protected async ghiRieng(tep: string, noiDung: string): Promise<void> {
        await fs.mkdirp(path.dirname(tep));
        const tam = `${tep}.tmp-${process.pid}`;
        await fs.writeFile(tam, noiDung, { encoding: 'utf8', mode: 0o600 });
        await fs.move(tam, tep, { overwrite: true });
    }
}

import { injectable } from '@theia/core/shared/inversify';
import * as https from 'https';
import * as path from 'path';
import * as os from 'os';
import * as vm from 'vm';
import * as fs from '@theia/core/shared/fs-extra';
import { CapNhatClaudeCodeServer, ThongTinBanDuocDuyet, soSanhPhienBanSo } from '../common/cap-nhat-claude-code-protocol';
import * as BANG_DICH from '../common/viet-hoa-claude-code.json';

// extract-zip không có kiểu công khai ổn định để import trực tiếp (types của nó kéo theo
// @types/yauzl) — require thô + tự khai kiểu cần dùng là đủ và tránh phụ thuộc kiểu gián tiếp.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extractZip = require('extract-zip') as (zipPath: string, opts: { dir: string }) => Promise<void>;

// Repo phát hành AWord — PHẢI khớp GITHUB_REPO trong aword-menu-contribution.ts.
const GITHUB_REPO = 'biencuong/AWord-Theia';
// AWord Pro có danh mục riêng; claude-code.json giữ nguyên cho dòng AWord 2.x (đã dừng cập nhật).
const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/aword-manifest/claude-code-pro.json`;
const PLUGIN_ID = 'Anthropic.claude-code';
// Nguồn thời gian thực: Open VSX — nơi Anthropic phát hành extension Claude Code cho các IDE không phải VS Code.
const OPEN_VSX = 'https://open-vsx.org/api/Anthropic/claude-code';
const KHUNG_DANH_SACH_PHIEN = 'claude-sessions-sidebar';
// Bảng dịch MỚI NHẤT trên repo — thêm bản dịch cho chuỗi của bản Claude Code mới là mọi máy nhận được khi tự cập nhật.
const URL_BANG_DICH = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/aword-chat/src/common/viet-hoa-claude-code.json`;
// Cùng quy tắc với tools/viet-hoa-claude-code/viet-hoa.cjs: chỉ thay chuỗi đứng ngay sau thuộc tính hiển thị.
const RE_CHUOI_HIEN_THI = /(?<=[,{(\s])(children|placeholder|title|label|"aria-label"|description|text|tooltip|header|message|subtitle|hint|buttonText|confirmLabel|cancelLabel|emptyText):"([^"\\\n]{2,300})"/g;

interface BangDich {
    lenh?: Record<string, string>;
    caiDat?: Record<string, string>;
    walkthrough?: Record<string, string>;
    moTa?: Record<string, string>;
    webview?: Record<string, string>;
}

interface ManifestClaudeCode {
    phienBan?: string;
    ghiChu?: string;
    vsix?: Record<string, string>; // khoá: "<process.platform>-<process.arch>", vd "win32-x64", "darwin-arm64"
    // Điều khiển cập nhật THEO THỜI GIAN THỰC (mọi máy đọc lại mỗi lần kiểm tra, không cần đóng gói):
    tuDong?: boolean;       // false = chỉ dùng bản đã duyệt ở trên (phanh khẩn cấp khi Anthropic phát hành bản lỗi)
    khongDung?: string[];   // các bản đã biết là lỗi — bỏ qua, lấy bản mới nhất còn lại
    toiDa?: string;         // trần phiên bản (tuỳ chọn)
}

interface BanOpenVsx { version?: string; files?: { download?: string } }

@injectable()
export class CapNhatClaudeCodeServerImpl implements CapNhatClaudeCodeServer {

    // Hai lượt gọi cùng một bản (tự động chạy nền + người dùng bấm nút) dùng chung một lần tải.
    private readonly dangTai = new Map<string, Promise<void>>();

    async layPhienBanDangDung(): Promise<string | undefined> {
        const banBundle = await this.docPhienBanThuMuc(path.join(this.thuMucBundle(), PLUGIN_ID));
        const thuMucCapNhat = this.thuMucCapNhat();
        const banCapNhat = thuMucCapNhat ? (await this.cacBanCapNhat(thuMucCapNhat))[0]?.phienBan : undefined;
        if (banCapNhat && (!banBundle || soSanhPhienBanSo(banCapNhat, banBundle) > 0)) {
            return banCapNhat;
        }
        return banBundle;
    }

    async layBanDuocDuyet(): Promise<ThongTinBanDuocDuyet | undefined> {
        return this.banTuManifest(await this.docManifest());
    }

    async layBanMoiNhat(): Promise<ThongTinBanDuocDuyet | undefined> {
        const manifest = await this.docManifest();
        const banDaDuyet = this.banTuManifest(manifest);
        if (manifest?.tuDong === false) {
            return banDaDuyet;
        }
        let moiNhat: ThongTinBanDuocDuyet | undefined;
        try {
            moiNhat = await this.banMoiNhatOpenVsx(manifest);
        } catch { /* Open VSX không trả lời — dùng bản đã duyệt */ }
        if (!moiNhat || (banDaDuyet && soSanhPhienBanSo(banDaDuyet.phienBan, moiNhat.phienBan) >= 0)) {
            return banDaDuyet;
        }
        return moiNhat;
    }

    private async docManifest(): Promise<ManifestClaudeCode | undefined> {
        try {
            return JSON.parse(await this.taiVanBan(MANIFEST_URL)) as ManifestClaudeCode;
        } catch {
            return undefined;
        }
    }

    private banTuManifest(manifest: ManifestClaudeCode | undefined): ThongTinBanDuocDuyet | undefined {
        const urlVsix = manifest?.vsix?.[this.nenTang()];
        if (!manifest?.phienBan || !urlVsix) {
            return undefined;
        }
        return { phienBan: manifest.phienBan, urlVsix, ghiChu: manifest.ghiChu, nguon: 'danh-muc' };
    }

    // Bản mới nhất trên Open VSX; bản đó bị danh mục chặn thì dò lùi trong 30 bản gần nhất.
    private async banMoiNhatOpenVsx(manifest: ManifestClaudeCode | undefined): Promise<ThongTinBanDuocDuyet | undefined> {
        const nenTang = this.nenTang();
        const chan = new Set(manifest?.khongDung ?? []);
        const hopLe = (v: string) => !chan.has(v) && (!manifest?.toiDa || soSanhPhienBanSo(v, manifest.toiDa) <= 0);
        const taoBan = (v: string, url?: string): ThongTinBanDuocDuyet => ({
            phienBan: v,
            urlVsix: url || `${OPEN_VSX}/${nenTang}/${v}/file/Anthropic.claude-code-${v}@${nenTang}.vsix`,
            ghiChu: `Claude Code ${v} — bản mới nhất Anthropic phát hành trên Open VSX.`,
            nguon: 'open-vsx'
        });
        const latest = JSON.parse(await this.taiVanBan(`${OPEN_VSX}/${nenTang}/latest`)) as BanOpenVsx;
        if (latest.version && hopLe(latest.version)) {
            return taoBan(latest.version, latest.files?.download);
        }
        const ds = JSON.parse(await this.taiVanBan(`${OPEN_VSX}/${nenTang}/versions?size=30`)) as { versions?: Record<string, string> };
        const tot = Object.keys(ds.versions ?? {}).filter(hopLe).sort((a, b) => soSanhPhienBanSo(b, a))[0];
        return tot ? taoBan(tot) : undefined;
    }

    private nenTang(): string {
        return `${process.platform}-${process.arch}`;
    }

    async capNhat(thongTin: ThongTinBanDuocDuyet): Promise<void> {
        const dang = this.dangTai.get(thongTin.phienBan);
        if (dang) {
            return dang;
        }
        const viec = this.taiVaCai(thongTin).finally(() => this.dangTai.delete(thongTin.phienBan));
        this.dangTai.set(thongTin.phienBan, viec);
        return viec;
    }

    // Mỗi bản một thư mục riêng "Anthropic.claude-code-<bản>": bản đang chạy có claude.exe đang mở nên
    // Windows không cho xoá/ghi đè (EBUSY) — không động vào nó. Theia tự nạp bản số hiệu cao nhất
    // (PluginDeployer#findBestVersion). Giải nén ở thư mục tạm rồi mới chuyển vào, để thư mục Theia quét
    // không bao giờ chứa gói dở dang nếu mất điện/tắt máy giữa chừng.
    private async taiVaCai(thongTin: ThongTinBanDuocDuyet): Promise<void> {
        const thuMucCapNhat = this.thuMucCapNhat();
        if (!thuMucCapNhat) {
            throw new Error('Tính năng này chỉ dùng được trên bản cài đặt AWord (Electron).');
        }
        const dauThoiGian = Date.now();
        const tepTam = path.join(os.tmpdir(), `aword-claude-code-${thongTin.phienBan}-${dauThoiGian}.vsix`);
        const thuMucTam = path.join(os.tmpdir(), `aword-claude-code-${thongTin.phienBan}-${dauThoiGian}`);
        const thuMucPlugin = path.join(thuMucCapNhat, `${PLUGIN_ID}-${thongTin.phienBan}`);
        try {
            await this.taiFile(thongTin.urlVsix, tepTam);
            const kichThuoc = (await fs.stat(tepTam)).size;
            if (kichThuoc < 10240) {
                throw new Error('Tệp tải về quá nhỏ, có thể đã tải lỗi.');
            }
            await extractZip(tepTam, { dir: thuMucTam });
            const coManifestVsix = await fs.pathExists(path.join(thuMucTam, 'extension.vsixmanifest'));
            const phienBanGoi = await this.docPhienBanThuMuc(thuMucTam);
            if (!coManifestVsix || !phienBanGoi) {
                throw new Error('Gói tải về không đúng định dạng VSIX của Claude Code.');
            }
            await this.vaChoAWord(thuMucTam);
            await fs.ensureDir(thuMucCapNhat);
            await fs.remove(thuMucPlugin);
            await fs.move(thuMucTam, thuMucPlugin);
        } finally {
            await fs.remove(tepTam).catch(() => { /* bỏ qua */ });
            await fs.remove(thuMucTam).catch(() => { /* bỏ qua */ });
        }
        await this.donBanCu(thuMucCapNhat, thongTin.phienBan);
        // Báo tiến trình chính: lần "Khởi động lại" tới phải khởi động lại TOÀN BỘ ứng dụng (xem patch-plugins-env.cjs).
        await fs.writeFile(path.join(path.dirname(thuMucCapNhat), 'aword-can-khoi-dong-lai'), thongTin.phienBan).catch(() => { /* bỏ qua */ });
    }

    async vaLaiVietHoa(): Promise<void> {
        const thuMucCapNhat = this.thuMucCapNhat();
        const banMoiNhat = thuMucCapNhat ? (await this.cacBanCapNhat(thuMucCapNhat))[0] : undefined;
        if (banMoiNhat) {
            await this.vaChoAWord(banMoiNhat.thuMuc);
        }
    }

    // Các bản đã cập nhật (kể cả thư mục tên cũ "Anthropic.claude-code" của bản AWord trước), mới nhất trước.
    private async cacBanCapNhat(thuMucCapNhat: string): Promise<{ thuMuc: string; phienBan: string }[]> {
        let ten: string[];
        try {
            ten = await fs.readdir(thuMucCapNhat);
        } catch {
            return [];
        }
        const ds: { thuMuc: string; phienBan: string }[] = [];
        for (const t of ten) {
            if (t !== PLUGIN_ID && !t.startsWith(`${PLUGIN_ID}-`)) { continue; }
            const thuMuc = path.join(thuMucCapNhat, t);
            const phienBan = await this.docPhienBanThuMuc(thuMuc);
            if (phienBan) { ds.push({ thuMuc, phienBan }); }
        }
        return ds.sort((a, b) => soSanhPhienBanSo(b.phienBan, a.phienBan));
    }

    // Dọn các bản cũ hơn bản vừa cài. Trước khi xoá, ĐỔI TÊN sang thư mục bên cạnh (cùng ổ nên nguyên tử):
    // bản đang chạy bị khoá thì đổi tên thất bại và thư mục còn NGUYÊN VẸN — không bao giờ để lại một bản
    // xoá dở trong thư mục Theia quét. Bản bị khoá sẽ được dọn ở lần cập nhật sau.
    private async donBanCu(thuMucCapNhat: string, banGiuLai: string): Promise<void> {
        const thuMucRac = path.join(path.dirname(thuMucCapNhat), 'cap-nhat-plugin-cu');
        await fs.remove(thuMucRac).catch(() => { /* còn tệp bị khoá — lần sau dọn tiếp */ });
        for (const ban of await this.cacBanCapNhat(thuMucCapNhat)) {
            if (soSanhPhienBanSo(ban.phienBan, banGiuLai) >= 0) { continue; }
            const dich = path.join(thuMucRac, `${path.basename(ban.thuMuc)}-${Date.now()}`);
            try {
                await fs.ensureDir(thuMucRac);
                await fs.rename(ban.thuMuc, dich);
            } catch {
                continue;
            }
            await fs.remove(dich).catch(() => { /* bỏ qua */ });
        }
    }

    // Thư mục cập nhật cá nhân — do electron-main.js (đã patch, xem patch-plugins-env.cjs)
    // gán qua biến môi trường, dùng app.getPath('userData') làm nguồn sự thật DUY NHẤT
    // (không tự suy luận lại đường dẫn userData ở đây để tránh lệch với nơi Theia đã quét).
    private thuMucCapNhat(): string | undefined {
        return process.env.AWORD_CAP_NHAT_PLUGIN_DIR;
    }

    private thuMucBundle(): string {
        const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
        return resourcesPath ? path.join(resourcesPath, 'app', 'plugins') : path.join(process.cwd(), 'plugins');
    }

    // Bản tải về phải giống bản đóng gói sẵn: gỡ khung "danh sách phiên" (lý do ở scripts/localize-claude-code-vi.cjs)
    // và Việt hoá phần khai báo bằng CÙNG bảng dịch (common/viet-hoa-claude-code.json). Lỗi thì bỏ qua — plugin
    // vẫn chạy được, chỉ còn chữ tiếng Anh ở tên lệnh/cài đặt.
    private async vaChoAWord(thuMucPlugin: string): Promise<void> {
        const bang = await this.layBangDich();
        await this.vaKhungChat(path.join(thuMucPlugin, 'extension'), bang.webview ?? {});
        const tep = path.join(thuMucPlugin, 'extension', 'package.json');
        try {
            const pkg = await fs.readJSON(tep);
            const c = pkg.contributes ?? {};
            for (const vung of Object.keys(c.viewsContainers ?? {})) {
                c.viewsContainers[vung] = c.viewsContainers[vung].filter((v: { id?: string }) => v.id !== KHUNG_DANH_SACH_PHIEN);
            }
            if (c.views?.[KHUNG_DANH_SACH_PHIEN]) {
                delete c.views[KHUNG_DANH_SACH_PHIEN];
            }
            const lenh = bang.lenh ?? {};
            const caiDat = bang.caiDat ?? {};
            const walkthrough = bang.walkthrough ?? {};
            const moTa = bang.moTa ?? {};
            if (pkg.description && moTa[pkg.description]) {
                pkg.description = moTa[pkg.description];
            }
            for (const cmd of c.commands ?? []) {
                if (lenh[cmd.title]) { cmd.title = lenh[cmd.title]; }
            }
            const props = c.configuration?.properties ?? {};
            for (const [khoa, viDesc] of Object.entries(caiDat)) {
                if (!props[khoa]) { continue; }
                if (props[khoa].description) {
                    props[khoa].description = viDesc;
                } else if (props[khoa].markdownDescription) {
                    props[khoa].markdownDescription = viDesc;
                }
            }
            for (const wt of c.walkthroughs ?? []) {
                if (walkthrough[wt.title]) { wt.title = walkthrough[wt.title]; }
                if (walkthrough[wt.description]) { wt.description = walkthrough[wt.description]; }
                for (const buoc of wt.steps ?? []) {
                    if (walkthrough[buoc.title]) { buoc.title = walkthrough[buoc.title]; }
                    if (walkthrough[buoc.description]) { buoc.description = walkthrough[buoc.description]; }
                }
            }
            pkg._aword_vi = true;
            await fs.writeFile(tep, JSON.stringify(pkg, null, 2), 'utf8');
        } catch { /* bỏ qua */ }
    }

    private async layBangDich(): Promise<BangDich> {
        try {
            const bang = JSON.parse(await this.taiVanBan(URL_BANG_DICH)) as BangDich;
            if (bang?.lenh) {
                return bang;
            }
        } catch { /* không mạng — dùng bảng đóng gói */ }
        return BANG_DICH as BangDich;
    }

    // Chữ trong KHUNG CHAT (webview/index.js). Giữ bản gốc cạnh bên (.goc-aword) để lần sau áp lại đúng từ gốc;
    // bản vá phải qua kiểm tra cú pháp mới được ghi — hỏng thì giữ tiếng Anh, khung chat vẫn chạy.
    private async vaKhungChat(thuMucExt: string, webview: Record<string, string>): Promise<void> {
        const tep = path.join(thuMucExt, 'webview', 'index.js');
        try {
            const tepGoc = tep + '.goc-aword';
            const hienTai = await fs.readFile(tep, 'utf8');
            const goc = (await fs.pathExists(tepGoc)) ? await fs.readFile(tepGoc, 'utf8') : hienTai;
            const moi = goc.replace(RE_CHUOI_HIEN_THI, (nguyen: string, thuocTinh: string, chu: string) => {
                const vi = webview[chu];
                return typeof vi === 'string' && vi && !/["\\\n\r]/.test(vi) ? `${thuocTinh}:"${vi}"` : nguyen;
            });
            if (moi === hienTai) {
                return;
            }
            new vm.Script(moi, { filename: 'webview-index.js' });
            if (!(await fs.pathExists(tepGoc))) {
                await fs.writeFile(tepGoc, hienTai, 'utf8');
            }
            await fs.writeFile(tep, moi, 'utf8');
        } catch { /* không có khung chat hoặc bản vá lỗi cú pháp — giữ nguyên */ }
    }

    private async docPhienBanThuMuc(thuMucPlugin: string): Promise<string | undefined> {
        try {
            const pkg = await fs.readJSON(path.join(thuMucPlugin, 'extension', 'package.json'));
            return typeof pkg.version === 'string' ? pkg.version : undefined;
        } catch {
            return undefined;
        }
    }

    private taiVanBan(url: string, chuyenTiep = 0): Promise<string> {
        return new Promise((resolve, reject) => {
            if (chuyenTiep > 5) { reject(new Error('Quá nhiều lượt chuyển tiếp.')); return; }
            const req = https.get(url, { headers: { 'User-Agent': 'AWord-CapNhat' } }, res => {
                res.on('error', reject);
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    resolve(this.taiVanBan(res.headers.location, chuyenTiep + 1));
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                let noiDung = '';
                res.setEncoding('utf8');
                res.on('data', doan => { noiDung += doan; });
                res.on('end', () => resolve(noiDung));
            });
            req.on('error', reject);
            req.setTimeout(30000, () => req.destroy(new Error('Hết thời gian chờ máy chủ cập nhật.')));
        });
    }

    // Timeout tính theo khoảng IM LẶNG của socket (không phải tổng thời gian tải), nên gói lớn
    // qua mạng chậm vẫn tải được; chỉ cắt khi mạng đứng hẳn — tránh giao diện treo mãi.
    private taiFile(url: string, dich: string, chuyenTiep = 0): Promise<void> {
        return new Promise((resolve, reject) => {
            if (chuyenTiep > 5) { reject(new Error('Quá nhiều lượt chuyển tiếp.')); return; }
            const req = https.get(url, { headers: { 'User-Agent': 'AWord-CapNhat' } }, res => {
                res.on('error', reject);
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    resolve(this.taiFile(res.headers.location, dich, chuyenTiep + 1));
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const ws = fs.createWriteStream(dich);
                res.pipe(ws);
                ws.on('finish', () => ws.close(() => resolve()));
                ws.on('error', reject);
            });
            req.on('error', reject);
            req.setTimeout(60000, () => req.destroy(new Error('Mạng không phản hồi quá 60 giây — tải gói Claude Code bị dừng.')));
        });
    }
}

import { injectable } from '@theia/core/shared/inversify';
import * as https from 'https';
import * as path from 'path';
import * as os from 'os';
import * as fs from '@theia/core/shared/fs-extra';
import { CapNhatClaudeCodeServer, ThongTinBanDuocDuyet, soSanhPhienBanSo } from '../common/cap-nhat-claude-code-protocol';

// extract-zip không có kiểu công khai ổn định để import trực tiếp (types của nó kéo theo
// @types/yauzl) — require thô + tự khai kiểu cần dùng là đủ và tránh phụ thuộc kiểu gián tiếp.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extractZip = require('extract-zip') as (zipPath: string, opts: { dir: string }) => Promise<void>;

// Repo phát hành AWord — PHẢI khớp GITHUB_REPO trong aword-menu-contribution.ts.
const GITHUB_REPO = 'biencuong/AWord-Theia';
// AWord Pro có danh mục riêng; claude-code.json giữ nguyên cho dòng AWord 2.x (đã dừng cập nhật).
const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/aword-manifest/claude-code-pro.json`;
const PLUGIN_ID = 'Anthropic.claude-code';

interface ManifestClaudeCode {
    phienBan?: string;
    ghiChu?: string;
    vsix?: Record<string, string>; // khoá: "<process.platform>-<process.arch>", vd "win32-x64", "darwin-arm64"
}

@injectable()
export class CapNhatClaudeCodeServerImpl implements CapNhatClaudeCodeServer {

    async layPhienBanDangDung(): Promise<string | undefined> {
        const banBundle = await this.docPhienBanPlugin(this.thuMucBundle());
        const thuMucCapNhat = this.thuMucCapNhat();
        const banCapNhat = thuMucCapNhat ? await this.docPhienBanPlugin(thuMucCapNhat) : undefined;
        if (banCapNhat && (!banBundle || soSanhPhienBanSo(banCapNhat, banBundle) > 0)) {
            return banCapNhat;
        }
        return banBundle;
    }

    async layBanDuocDuyet(): Promise<ThongTinBanDuocDuyet | undefined> {
        let noiDung: string;
        try {
            noiDung = await this.taiVanBan(MANIFEST_URL);
        } catch {
            return undefined;
        }
        let manifest: ManifestClaudeCode;
        try {
            manifest = JSON.parse(noiDung);
        } catch {
            return undefined;
        }
        const nenTang = `${process.platform}-${process.arch}`;
        const urlVsix = manifest.vsix?.[nenTang];
        if (!manifest.phienBan || !urlVsix) {
            return undefined;
        }
        return { phienBan: manifest.phienBan, urlVsix, ghiChu: manifest.ghiChu };
    }

    async capNhat(thongTin: ThongTinBanDuocDuyet): Promise<void> {
        const thuMucCapNhat = this.thuMucCapNhat();
        if (!thuMucCapNhat) {
            throw new Error('Tính năng này chỉ dùng được trên bản cài đặt AWord (Electron).');
        }
        const thuMucPlugin = path.join(thuMucCapNhat, PLUGIN_ID);
        const tepTam = path.join(os.tmpdir(), `aword-claude-code-${thongTin.phienBan}-${Date.now()}.vsix`);
        try {
            await this.taiFile(thongTin.urlVsix, tepTam);
            const kichThuoc = (await fs.stat(tepTam)).size;
            if (kichThuoc < 10240) {
                throw new Error('Tệp tải về quá nhỏ, có thể đã tải lỗi.');
            }
            await fs.remove(thuMucPlugin);
            await extractZip(tepTam, { dir: thuMucPlugin });
            const coManifestVsix = await fs.pathExists(path.join(thuMucPlugin, 'extension.vsixmanifest'));
            const phienBanSauKhiGiaiNen = await this.docPhienBanPlugin(thuMucCapNhat);
            if (!coManifestVsix || !phienBanSauKhiGiaiNen) {
                await fs.remove(thuMucPlugin).catch(() => { /* bỏ qua */ });
                throw new Error('Gói tải về không đúng định dạng VSIX của Claude Code.');
            }
            await this.boKhungDanhSachPhien(thuMucPlugin);
        } finally {
            await fs.remove(tepTam).catch(() => { /* bỏ qua */ });
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

    // Gỡ khung "danh sách phiên" khỏi khai báo plugin — giống scripts/localize-claude-code-vi.cjs (lý do ghi ở đó).
    // Lỗi thì bỏ qua: khung vẫn bị AWord đóng khi hiện (aword-welcome-contribution.ts), chỉ nhật ký có thêm lỗi webview.
    private async boKhungDanhSachPhien(thuMucPlugin: string): Promise<void> {
        const KHUNG = 'claude-sessions-sidebar';
        const tep = path.join(thuMucPlugin, 'extension', 'package.json');
        try {
            const pkg = await fs.readJSON(tep);
            const c = pkg.contributes ?? {};
            let doi = false;
            for (const vung of Object.keys(c.viewsContainers ?? {})) {
                const truoc = c.viewsContainers[vung].length;
                c.viewsContainers[vung] = c.viewsContainers[vung].filter((v: { id?: string }) => v.id !== KHUNG);
                doi = doi || c.viewsContainers[vung].length !== truoc;
            }
            if (c.views?.[KHUNG]) {
                delete c.views[KHUNG];
                doi = true;
            }
            if (doi) {
                await fs.writeFile(tep, JSON.stringify(pkg, null, 2), 'utf8');
            }
        } catch { /* bỏ qua */ }
    }

    private async docPhienBanPlugin(thuMucGoc: string): Promise<string | undefined> {
        try {
            const pkg = await fs.readJSON(path.join(thuMucGoc, PLUGIN_ID, 'extension', 'package.json'));
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

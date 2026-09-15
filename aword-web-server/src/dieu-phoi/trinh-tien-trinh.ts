// Trình "tien-trinh": mỗi phiên là một tiến trình backend Theia (browser-app đã build) chạy thẳng trên máy chủ.
// CHỈ ĐỂ PHÁT TRIỂN (máy Windows chưa có Docker) — KHÔNG CÔ LẬP: mọi phiên chạy chung tài khoản hệ điều hành của máy chủ,
// Claude Code trong phiên đọc/ghi được tệp của tài khoản khác và của chính máy chủ.
import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import type { TrinhPhien } from './dieu-phoi.ts';

export const CANH_BAO_KHONG_CO_LAP = '[AWord Web] CẢNH BÁO: trình điều phối "tien-trinh" KHÔNG cô lập người dùng — mọi phiên chạy chung '
    + 'quyền hệ điều hành của máy chủ, Claude Code trong phiên đọc/ghi được tệp của tài khoản khác. CHỈ dùng để phát triển '
    + 'trên một máy; triển khai thật phải dùng trình "docker".';

export interface TuyChonTienTrinh {
    /** Thư mục gốc repo AWord-Theia. Mặc định: AWORD_WEB_REPO, không có thì thư mục cha của aword-web-server. */
    repo?: string;
    /** Tệp backend chạy bằng node. Mặc định <repo>/browser-app/lib/backend/main.js (kiểm thử: backend giả). */
    tepBackend?: string;
    thuMucPlugins?: string;
    /** Thư mục làm việc của tiến trình. Mặc định <repo>/browser-app. */
    cwd?: string;
    /** Biến môi trường gốc để kế thừa (PATH...) — đã lọc bí mật máy chủ. Mặc định process.env. */
    envGoc?: NodeJS.ProcessEnv;
    /** Nơi in cảnh báo không cô lập. Mặc định console.warn. */
    canhBao?: (thongBao: string) => void;
    /** Hạn chờ tiến trình thoát sau khi yêu cầu dừng (ms). */
    hanChoThoatMs?: number;
}

interface TienTrinhDangChay {
    con: ChildProcess;
    thoat: boolean;
    chuDongDung: boolean;
    daThoat: Promise<void>;
    tepNhatKy: string;
}

/** Tối đa soDong dòng cuối của tệp (đọc 64 KB cuối, không nạp cả tệp lớn). */
function duoiTep(tep: string, soDong: number): string {
    let fd: number | undefined;
    try {
        fd = fs.openSync(tep, 'r');
        const kichThuoc = fs.fstatSync(fd).size;
        const doDai = Math.min(kichThuoc, 64 * 1024);
        const du = Buffer.alloc(doDai);
        fs.readSync(fd, du, 0, doDai, kichThuoc - doDai);
        return du.toString('utf8').split(/\r?\n/).slice(-soDong - 1).join('\n').trim();
    } catch {
        return '';
    } finally {
        if (fd !== undefined) { fs.closeSync(fd); }
    }
}

// Bí mật và cấu hình của máy chủ/phiên cha KHÔNG được lọt vào phiên người dùng.
const RE_ENV_CAM = /^(AWORD_WEB_|AWORD_KHOA_|AWORD_DIA_CHI_|ANTHROPIC_|CLAUDE_CODE_|OPENAI_|DEEPSEEK_|THEIA_|DOCKER_|NODE_TEST_)|^(CLAUDECODE|ELECTRON_RUN_AS_NODE|NODE_OPTIONS|AWORD_WEB_REPO)$/i;

export function locEnvMayChu(env: NodeJS.ProcessEnv): Record<string, string> {
    const ra: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
        if (v !== undefined && !RE_ENV_CAM.test(k)) { ra[k] = v; }
    }
    return ra;
}

function timCongTrong(): Promise<number> {
    return new Promise((ok, loi) => {
        const s = net.createServer();
        s.once('error', loi);
        s.listen(0, '127.0.0.1', () => {
            const cong = (s.address() as net.AddressInfo).port;
            s.close(() => ok(cong));
        });
    });
}

const tachMa = (ma: string): { pid: number; cong: number } => {
    const [pid, cong] = ma.split(':').map(Number);
    return { pid: Number.isInteger(pid) ? pid : 0, cong: Number.isInteger(cong) ? cong : 0 };
};

function pidConSong(pid: number): boolean {
    try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

const cho = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

function chayLenh(lenh: string, thamSo: string[]): Promise<string> {
    return new Promise(ok => execFile(lenh, thamSo, { windowsHide: true, timeout: 20000 }, (_e, out) => ok(String(out ?? ''))));
}

// PID trong CSDL có thể đã bị hệ điều hành cấp lại cho tiến trình khác (máy chủ khởi động lại) — chỉ nhận là phiên
// khi dòng lệnh đúng là backend chạy ở cổng đã ghi.
async function dongLenh(pid: number): Promise<string> {
    if (process.platform === 'win32') {
        return chayLenh('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`]);
    }
    if (process.platform === 'linux') {
        try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' '); } catch { return ''; }
    }
    return chayLenh('ps', ['-o', 'command=', '-p', String(pid)]);
}

export function taoTrinhTienTrinh(tuy: TuyChonTienTrinh = {}): TrinhPhien {
    const repo = path.resolve(tuy.repo ?? process.env.AWORD_WEB_REPO ?? path.join(import.meta.dirname, '..', '..', '..'));
    const thuMucApp = path.join(repo, 'browser-app');
    const tepBackend = path.resolve(tuy.tepBackend ?? path.join(thuMucApp, 'lib', 'backend', 'main.js'));
    const thuMucPlugins = path.resolve(tuy.thuMucPlugins ?? path.join(thuMucApp, 'plugins'));
    const cwd = path.resolve(tuy.cwd ?? thuMucApp);
    const hanChoThoatMs = tuy.hanChoThoatMs ?? 5000;
    const dangChay = new Map<string, TienTrinhDangChay>();
    const nguoiNghe: Array<(maTrinh: string) => void> = [];
    (tuy.canhBao ?? console.warn)(CANH_BAO_KHONG_CO_LAP);

    // Theia hiểu "local-dir:<đường dẫn>"; trong cwd thì dùng đường dẫn tương đối như Chay_AWord_Web.cmd (tránh
    // phân tích URI với ký tự ổ đĩa Windows), ngoài cwd thì đường dẫn tuyệt đối dấu "/".
    const thamSoPlugins = (): string => {
        const tuongDoi = path.relative(cwd, thuMucPlugins);
        const p = tuongDoi && !tuongDoi.startsWith('..') && !path.isAbsolute(tuongDoi) ? tuongDoi : thuMucPlugins;
        return `--plugins=local-dir:${p.replace(/\\/g, '/')}`;
    };

    async function dietCay(pid: number): Promise<void> {
        if (process.platform === 'win32') {
            await chayLenh('taskkill', ['/PID', String(pid), '/T', '/F']);
            return;
        }
        // POSIX: tiến trình chạy detached là trưởng nhóm → gửi tín hiệu cho cả nhóm.
        const gui = (tinHieu: NodeJS.Signals): void => {
            try { process.kill(-pid, tinHieu); } catch { try { process.kill(pid, tinHieu); } catch { /* đã dừng */ } }
        };
        gui('SIGTERM');
        const hetHan = Date.now() + hanChoThoatMs;
        while (Date.now() < hetHan && pidConSong(pid)) { await cho(100); }
        if (pidConSong(pid)) { gui('SIGKILL'); }
    }

    async function conChay(maTrinh: string): Promise<boolean> {
        const muc = dangChay.get(maTrinh);
        if (muc) { return !muc.thoat && muc.con.exitCode === null; }
        const { pid, cong } = tachMa(maTrinh);
        if (!pid || !cong || !pidConSong(pid)) { return false; }
        const lenh = (await dongLenh(pid)).replace(/\\/g, '/');
        return lenh.includes(`--port=${cong}`) && lenh.includes(path.basename(tepBackend));
    }

    return {
        conChay,

        async khoiDong(p) {
            if (!fs.existsSync(tepBackend)) {
                throw new Error(`Chưa build bản web: không thấy ${tepBackend} (chạy Chay_AWord_Web.cmd hoặc "npm run build:browser" ở repo).`);
            }
            const cong = await timCongTrong();
            const thuMucLam = path.join(p.thuMucRieng, 'Documents', 'AWord');
            const thuMucNhatKy = path.join(p.thuMucRieng, '.aword');
            fs.mkdirSync(thuMucLam, { recursive: true });
            fs.mkdirSync(thuMucNhatKy, { recursive: true });
            const env: Record<string, string> = { ...locEnvMayChu(tuy.envGoc ?? process.env), ...p.env };
            // Tiến trình chạy ngay trên máy chủ → Cổng AI ở 127.0.0.1, không phải host.docker.internal.
            if (env.ANTHROPIC_BASE_URL) {
                env.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL.replace('//host.docker.internal', '//127.0.0.1');
            }
            // Windows: os.homedir() đọc USERPROFILE (không đọc HOME).
            if (process.platform === 'win32' && p.env.HOME) {
                for (const k of Object.keys(env)) { if (k.toUpperCase() === 'USERPROFILE') { delete env[k]; } }
                env.USERPROFILE = p.env.HOME;
            }
            const tepNhatKy = path.join(thuMucNhatKy, 'nhat-ky-phien.log');
            const nhatKy = fs.openSync(tepNhatKy, 'a');
            let con: ChildProcess;
            try {
                con = spawn(process.execPath, [tepBackend, '--hostname=127.0.0.1', `--port=${cong}`, thamSoPlugins(), thuMucLam], {
                    cwd, env, detached: true, windowsHide: true, stdio: ['ignore', nhatKy, nhatKy],
                });
            } finally {
                fs.closeSync(nhatKy);
            }
            await new Promise<void>((ok, loi) => {
                con.once('spawn', ok);
                con.once('error', loi);
            });
            const maTrinh = `${con.pid}:${cong}`;
            const muc: TienTrinhDangChay = {
                con, thoat: false, chuDongDung: false, tepNhatKy,
                daThoat: new Promise(ok => con.once('exit', () => ok())),
            };
            con.on('exit', () => {
                muc.thoat = true;
                if (!muc.chuDongDung) { for (const f of nguoiNghe) { f(maTrinh); } }
            });
            con.unref();
            dangChay.set(maTrinh, muc);
            return { maTrinh, diaChi: `127.0.0.1:${cong}` };
        },

        async dung(maTrinh) {
            const muc = dangChay.get(maTrinh);
            const { pid } = tachMa(maTrinh);
            if (muc) {
                if (muc.thoat) { dangChay.delete(maTrinh); return; }
                muc.chuDongDung = true;
                await dietCay(pid);
                let hen: NodeJS.Timeout | undefined;
                await Promise.race([muc.daThoat, new Promise<void>(ok => { hen = setTimeout(ok, hanChoThoatMs); })]);
                clearTimeout(hen);
                dangChay.delete(maTrinh);
                return;
            }
            // Tiến trình của lần chạy máy chủ trước: chỉ dừng khi chắc chắn đúng là phiên.
            if (pid && await conChay(maTrinh)) { await dietCay(pid); }
        },

        khiDungNgoaiY(nghe) {
            nguoiNghe.push(nghe);
        },

        async nhatKyGanNhat(maTrinh, soDong) {
            const muc = dangChay.get(maTrinh);
            return muc ? duoiTep(muc.tepNhatKy, soDong) : '';
        },
    };
}

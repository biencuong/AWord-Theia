// Trình "docker": mỗi tài khoản một container AWord Web, gọi thẳng Docker Engine API (v1.43+) bằng node:http —
// qua socket unix (/var/run/docker.sock), named pipe (Docker Desktop) hoặc DOCKER_HOST=tcp:// (không TLS).
//
// Cô lập: chạy uid 1000 (không root), bỏ mọi capability, no-new-privileges, giới hạn RAM/CPU/số tiến trình, /tmp là
// tmpfs; chỉ gắn ổ riêng của tài khoản (đọc-ghi) + thư mục hệ thống (chỉ đọc). Mạng riêng `aword-phien` TẮT liên lạc
// giữa các container (enable_icc=false) — phiên này không gọi được Theia của phiên khác.
//
// Ngủ = stop + XÓA container; đánh thức = tạo lại. Lý do: token Cổng AI đổi mỗi lần khởi động mà Env của container
// không sửa được; tạo lại cũng nhận ngay ảnh mới sau khi cập nhật AWord. Dữ liệu nằm ở thư mục gắn vào nên không mất.
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { CauHinh } from '../cau-hinh.ts';
import type { TrinhPhien } from './dieu-phoi.ts';
import { LoiPhien } from './loi-phien.ts';

export const PHIEN_BAN_API_DOCKER = 'v1.43';
export const HOME_TRONG_CONTAINER = '/home/aword';
export const HE_THONG_TRONG_CONTAINER = '/opt/aword-he-thong';
const CONG_THEIA = 3000;
const NHAN_TAI_KHOAN = 'aword.tai-khoan';
const NHAN_HE_THONG = 'aword.he-thong';

export interface KetNoiDocker { socketPath?: string; host?: string; port?: number }

export interface TuyChonDocker {
    cauHinh: CauHinh;
    /** Mặc định DOCKER_HOST; không có thì socket mặc định của hệ điều hành. */
    dockerHost?: string;
    /** Tên mạng Docker của các phiên. Mặc định AWORD_DOCKER_MANG hoặc "aword-phien". */
    mang?: string;
    /** Mạng internal (không có đường ra ngoài) — cần Cổng AI/proxy nằm TRONG mạng này. Mặc định AWORD_DOCKER_MANG_NOI_BO=1. */
    mangNoiBo?: boolean;
    boNhoByte?: number;
    soCpu?: number;
    pidsLimit?: number;
    /** Giây chờ container tự dừng trước khi bị buộc dừng. */
    giayChoDung?: number;
    /** Proxy ra ngoài cho phiên (vd http://aword-proxy:3128). Mặc định AWORD_DOCKER_PROXY. */
    proxyRaNgoai?: string;
    env?: NodeJS.ProcessEnv;
}

export function phanTichDockerHost(giaTri: string | undefined, nenTang: string = process.platform): KetNoiDocker {
    if (!giaTri) {
        return nenTang === 'win32' ? { socketPath: '\\\\.\\pipe\\docker_engine' } : { socketPath: '/var/run/docker.sock' };
    }
    if (giaTri.startsWith('unix://')) { return { socketPath: giaTri.slice('unix://'.length) }; }
    if (giaTri.startsWith('npipe://')) { return { socketPath: giaTri.slice('npipe://'.length).replace(/\//g, '\\') }; }
    if (/^(tcp|http):\/\//.test(giaTri)) {
        const u = new URL(giaTri.replace(/^tcp:/, 'http:'));
        return { host: u.hostname, port: Number(u.port || 2375) };
    }
    throw new Error(`DOCKER_HOST "${giaTri}" chưa được hỗ trợ (dùng unix://, npipe:// hoặc tcp:// không TLS).`);
}

interface PhanHoiDocker { ma: number; json: any; vanBan: string }

function goiDocker(ketNoi: KetNoiDocker, method: string, duongDan: string, than?: unknown): Promise<PhanHoiDocker> {
    return new Promise((ok, loi) => {
        const du = than === undefined ? undefined : Buffer.from(JSON.stringify(than), 'utf8');
        const req = http.request({
            ...ketNoi, method, path: `/${PHIEN_BAN_API_DOCKER}${duongDan}`,
            headers: du ? { 'Content-Type': 'application/json', 'Content-Length': du.length } : {},
            timeout: 60000,
        }, res => {
            const phan: Buffer[] = [];
            res.on('data', (c: Buffer) => phan.push(c));
            res.on('error', loi);
            res.on('end', () => {
                const vanBan = Buffer.concat(phan).toString('utf8');
                let json: any;
                try { json = vanBan ? JSON.parse(vanBan) : undefined; } catch { json = undefined; }
                ok({ ma: res.statusCode ?? 0, json, vanBan });
            });
        });
        req.on('timeout', () => req.destroy(new Error('Docker Engine không phản hồi sau 60 giây')));
        req.on('error', e => loi(new LoiPhien('Máy chủ không kết nối được Docker Engine.', e.message)));
        req.end(du);
    });
}

const loiDocker = (viec: string, r: PhanHoiDocker): LoiPhien =>
    new LoiPhien(`Docker báo lỗi khi ${viec}.`, `HTTP ${r.ma}: ${(r.json?.message ?? r.vanBan).toString().slice(0, 300)}`);

export interface ThamSoContainer {
    anh: string;
    taiKhoanId: number;
    thuMucRieng: string;
    thuMucHeThong: string;
    env: Record<string, string>;
    mang: string;
    mangNoiBo: boolean;
    boNhoByte: number;
    soCpu: number;
    pidsLimit: number;
}

/** Thân POST /containers/create (tách riêng để kiểm thử đúng từng giới hạn). */
export function taoThanContainer(t: ThamSoContainer): Record<string, unknown> {
    return {
        Image: t.anh,
        // Tên máy cố định theo tài khoản: mã máy (Kho tri thức AI) không đổi mỗi lần tạo lại container.
        Hostname: `aword-phien-${t.taiKhoanId}`,
        User: '1000:1000',
        Env: Object.entries(t.env).map(([k, v]) => `${k}=${v}`),
        Labels: { [NHAN_TAI_KHOAN]: String(t.taiKhoanId), [NHAN_HE_THONG]: 'aword-web' },
        WorkingDir: HOME_TRONG_CONTAINER,
        ExposedPorts: { [`${CONG_THEIA}/tcp`]: {} },
        HostConfig: {
            Binds: [
                `${t.thuMucRieng}:${HOME_TRONG_CONTAINER}:rw`,
                `${t.thuMucHeThong}:${HE_THONG_TRONG_CONTAINER}:ro`,
            ],
            Memory: t.boNhoByte,
            MemorySwap: t.boNhoByte,           // không cho dùng thêm swap
            NanoCpus: Math.round(t.soCpu * 1e9),
            PidsLimit: t.pidsLimit,
            CapDrop: ['ALL'],
            SecurityOpt: ['no-new-privileges'],
            Tmpfs: { '/tmp': 'rw,nosuid,nodev,size=512m' },
            NetworkMode: t.mang,
            // Mạng thường: Cổng AI của máy chủ gọi qua host.docker.internal. Mạng internal không có cổng ra máy chủ.
            ExtraHosts: t.mangNoiBo ? [] : ['host.docker.internal:host-gateway'],
            RestartPolicy: { Name: 'no' },
            Init: true,                        // tiến trình init thu dọn tiến trình con mồ côi (claude, python...)
            LogConfig: { Type: 'json-file', Config: { 'max-size': '10m', 'max-file': '3' } },
        },
        NetworkingConfig: { EndpointsConfig: { [t.mang]: {} } },
    };
}

/** Tên giao diện bridge trên máy chủ cho mạng phiên (Linux giới hạn 15 ký tự). */
export const tenBridge = (mang: string): string => `br-${mang}`.slice(0, 15);

/**
 * Biến môi trường proxy ra ngoài cho phiên (mạng internal + proxy lọc tên miền). Không đi qua proxy: Cổng AI (host của
 * ANTHROPIC_BASE_URL) và máy cục bộ. NODE_USE_ENV_PROXY=1: fetch/http của Node 24 (hook, MCP bằng Node) mới dùng proxy.
 */
export function envProxy(proxy: string | undefined, env: Record<string, string>): Record<string, string> {
    if (!proxy) { return {}; }
    const khongQua = ['localhost', '127.0.0.1'];
    try { if (env.ANTHROPIC_BASE_URL) { khongQua.unshift(new URL(env.ANTHROPIC_BASE_URL).hostname); } } catch { /* bỏ qua */ }
    const noProxy = khongQua.join(',');
    return { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, http_proxy: proxy, https_proxy: proxy, NO_PROXY: noProxy, no_proxy: noProxy, NODE_USE_ENV_PROXY: '1' };
}

function so(giaTri: string | undefined, macDinh: number): number {
    const n = Number(giaTri);
    return giaTri !== undefined && giaTri !== '' && Number.isFinite(n) && n > 0 ? n : macDinh;
}

export function taoTrinhDocker(tuy: TuyChonDocker): TrinhPhien {
    const env = tuy.env ?? process.env;
    const { cauHinh } = tuy;
    const ketNoi = phanTichDockerHost(tuy.dockerHost ?? env.DOCKER_HOST);
    const mang = tuy.mang ?? env.AWORD_DOCKER_MANG ?? 'aword-phien';
    const mangNoiBo = tuy.mangNoiBo ?? env.AWORD_DOCKER_MANG_NOI_BO === '1';
    const boNhoByte = tuy.boNhoByte ?? so(env.AWORD_DOCKER_BO_NHO_MB, 2048) * 1024 * 1024;
    const soCpu = tuy.soCpu ?? so(env.AWORD_DOCKER_CPU, 2);
    const pidsLimit = tuy.pidsLimit ?? so(env.AWORD_DOCKER_PIDS, 512);
    const giayChoDung = tuy.giayChoDung ?? 10;
    const proxyRaNgoai = tuy.proxyRaNgoai ?? (env.AWORD_DOCKER_PROXY || undefined);
    const goi = (method: string, duongDan: string, than?: unknown): Promise<PhanHoiDocker> => goiDocker(ketNoi, method, duongDan, than);
    let mangSanSang: Promise<void> | undefined;

    function damBaoMang(): Promise<void> {
        mangSanSang ??= (async () => {
            const r = await goi('GET', `/networks/${encodeURIComponent(mang)}`);
            if (r.ma === 200) { return; }
            if (r.ma !== 404) { throw loiDocker(`kiểm tra mạng ${mang}`, r); }
            const t = await goi('POST', '/networks/create', {
                Name: mang, Driver: 'bridge', Internal: mangNoiBo, CheckDuplicate: true,
                Labels: { [NHAN_HE_THONG]: 'aword-web' },
                Options: {
                    'com.docker.network.bridge.enable_icc': 'false',
                    // Tên giao diện cố định trên máy chủ để viết luật tường lửa (DOCKER-USER/INPUT) — tối đa 15 ký tự.
                    'com.docker.network.bridge.name': tenBridge(mang),
                },
            });
            // 409: vừa được tạo song song — dùng luôn.
            if (t.ma !== 201 && t.ma !== 409) { throw loiDocker(`tạo mạng ${mang}`, t); }
        })().catch(e => { mangSanSang = undefined; throw e; });
        return mangSanSang;
    }

    async function xoaContainer(id: string): Promise<void> {
        const dung = await goi('POST', `/containers/${encodeURIComponent(id)}/stop?t=${giayChoDung}`);
        if (![204, 304, 404].includes(dung.ma)) { throw loiDocker('dừng container', dung); }
        const xoa = await goi('DELETE', `/containers/${encodeURIComponent(id)}?force=true`);
        if (![204, 404].includes(xoa.ma)) { throw loiDocker('xóa container', xoa); }
    }

    // Container cùng tên còn sót (phiên trước, máy chủ dừng đột ngột): xóa để tạo lại với token/ảnh mới —
    // nhưng chỉ khi đúng là container AWord Web của tài khoản này.
    async function donContainerCu(ten: string, taiKhoanId: number): Promise<void> {
        const r = await goi('GET', `/containers/${ten}/json`);
        if (r.ma === 404) { return; }
        if (r.ma !== 200) { throw loiDocker('kiểm tra container cũ', r); }
        if (r.json?.Config?.Labels?.[NHAN_TAI_KHOAN] !== String(taiKhoanId)) {
            throw new LoiPhien(`Đã có container tên "${ten}" không do AWord Web tạo — hệ thống không tự xóa, quản trị cần kiểm tra.`);
        }
        await xoaContainer(String(r.json.Id));
    }

    // Máy chủ chạy bằng root → thư mục mới tạo thuộc root, người dùng uid 1000 trong container không ghi được.
    function traoQuyenThuMuc(thuMucRieng: string): void {
        if (typeof process.getuid !== 'function' || process.getuid() !== 0) { return; }
        for (const con of ['', 'Documents', path.join('Documents', 'AWord'), '.claude', '.aword', '.theia']) {
            try { fs.chownSync(path.join(thuMucRieng, con), 1000, 1000); } catch { /* bỏ qua */ }
        }
    }

    return {
        homeTrongPhien: () => HOME_TRONG_CONTAINER,

        async khoiDong(p) {
            await damBaoMang();
            fs.mkdirSync(cauHinh.thuMucHeThong, { recursive: true });
            traoQuyenThuMuc(p.thuMucRieng);
            const ten = `aword-phien-${p.taiKhoanId}`;
            await donContainerCu(ten, p.taiKhoanId);
            const than = taoThanContainer({
                anh: cauHinh.anhDocker, taiKhoanId: p.taiKhoanId, thuMucRieng: p.thuMucRieng,
                thuMucHeThong: cauHinh.thuMucHeThong, env: { ...p.env, ...envProxy(proxyRaNgoai, p.env) },
                mang, mangNoiBo, boNhoByte, soCpu, pidsLimit,
            });
            let tao = await goi('POST', `/containers/create?name=${ten}`, than);
            if (tao.ma === 409) {
                // Có yêu cầu khác vừa tạo trùng tên (hiếm — bộ điều phối đã chống khởi động trùng): dọn rồi thử lại một lần.
                await donContainerCu(ten, p.taiKhoanId);
                tao = await goi('POST', `/containers/create?name=${ten}`, than);
            }
            if (tao.ma === 404 && /image/i.test(String(tao.json?.message ?? tao.vanBan))) {
                throw new LoiPhien(`Máy chủ chưa có ảnh AWord Web "${cauHinh.anhDocker}" — quản trị cần build ảnh (aword-web-server/docker/README.md).`,
                    String(tao.json?.message ?? tao.vanBan));
            }
            if (tao.ma !== 201 || !tao.json?.Id) { throw loiDocker('tạo container', tao); }
            const id = String(tao.json.Id);
            try {
                const batDau = await goi('POST', `/containers/${id}/start`);
                if (batDau.ma !== 204 && batDau.ma !== 304) { throw loiDocker('khởi động container', batDau); }
                const tt = await goi('GET', `/containers/${id}/json`);
                if (tt.ma !== 200) { throw loiDocker('đọc thông tin container', tt); }
                const ip = tt.json?.NetworkSettings?.Networks?.[mang]?.IPAddress;
                if (!ip) { throw new LoiPhien(`Container không có địa chỉ trong mạng ${mang}.`); }
                return { maTrinh: id, diaChi: `${ip}:${CONG_THEIA}` };
            } catch (e) {
                await xoaContainer(id).catch(() => undefined);
                throw e;
            }
        },

        async dung(maTrinh) {
            await xoaContainer(maTrinh);
        },

        async conChay(maTrinh) {
            const r = await goi('GET', `/containers/${encodeURIComponent(maTrinh)}/json`);
            if (r.ma === 404) { return false; }
            if (r.ma !== 200) { throw loiDocker('kiểm tra container', r); }
            return r.json?.State?.Running === true;
        },

        async nhatKyGanNhat(maTrinh, soDong) {
            const r = await goiDockerTho(ketNoi, `/containers/${encodeURIComponent(maTrinh)}/logs?stdout=true&stderr=true&tail=${soDong}`);
            return r.ma === 200 ? tachLuongNhatKy(r.du) : '';
        },
    };
}

function goiDockerTho(ketNoi: KetNoiDocker, duongDan: string): Promise<{ ma: number; du: Buffer }> {
    return new Promise((ok, loi) => {
        const req = http.request({ ...ketNoi, method: 'GET', path: `/${PHIEN_BAN_API_DOCKER}${duongDan}`, timeout: 15000 }, res => {
            const phan: Buffer[] = [];
            res.on('data', (c: Buffer) => phan.push(c));
            res.on('error', loi);
            res.on('end', () => ok({ ma: res.statusCode ?? 0, du: Buffer.concat(phan) }));
        });
        req.on('timeout', () => req.destroy(new Error('Docker Engine không phản hồi')));
        req.on('error', loi);
        req.end();
    });
}

/** Nhật ký container không TTY: các khung [luồng, 0, 0, 0, độ dài uint32 BE] + dữ liệu → nối lại thành văn bản. */
export function tachLuongNhatKy(du: Buffer): string {
    const phan: Buffer[] = [];
    let i = 0;
    while (i + 8 <= du.length && du[i] <= 2 && du[i + 1] === 0 && du[i + 2] === 0 && du[i + 3] === 0) {
        const n = du.readUInt32BE(i + 4);
        phan.push(du.subarray(i + 8, i + 8 + n));
        i += 8 + n;
    }
    // Không đúng khung (container chạy TTY) → trả nguyên văn phần còn lại.
    if (i < du.length) { phan.push(du.subarray(i)); }
    return Buffer.concat(phan).toString('utf8');
}

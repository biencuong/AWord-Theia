import { injectable } from '@theia/core/shared/inversify';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as fs from '@theia/core/shared/fs-extra';
import {
    BIEN_SETTINGS_WRAPPER, CAC_MODEL_DEEPSEEK, CAC_MUC_SUY_LUAN, CauHinhDeepSeekServer, KetQuaKiemTraDeepSeek,
    ModelDeepSeek, MucSuyLuan, TrangThaiDeepSeek, YeuCauLuuDeepSeek
} from '../common/cau-hinh-deepseek-protocol';

const BASE_URL = 'https://api.deepseek.com/anthropic';
// Model nhỏ/nhanh cho tác vụ phụ (đặt tiêu đề, subagent...) — đúng hướng dẫn DeepSeek.
const MODEL_NHANH = 'deepseek-flash';

interface CauHinhDaLuu {
    bat?: boolean;
    apiKey?: string;
    model?: string;
    effort?: string;
    ngayCapNhat?: string;
}

// Wrapper cho macOS/Linux: exec thay tiến trình nên không để sót tiến trình con (không cần Job Object như Windows).
const WRAPPER_SH = `#!/bin/sh
# aword-claude-wrapper (macOS/Linux) — do AWord tự sinh; xem aword-claude-wrapper.cs để biết lý do.
claude="$1"; shift
if [ -n "$${BIEN_SETTINGS_WRAPPER}" ] && [ -f "$${BIEN_SETTINGS_WRAPPER}" ]; then
  exec "$claude" --settings "$${BIEN_SETTINGS_WRAPPER}" "$@"
fi
exec "$claude" "$@"
`;

@injectable()
export class CauHinhDeepSeekServerImpl implements CauHinhDeepSeekServer {

    async docTrangThai(): Promise<TrangThaiDeepSeek> {
        const ch = await this.docCauHinh();
        const wrapper = await this.timWrapper(false);
        const key = ch.apiKey ?? '';
        return {
            hoTro: !!wrapper.duongDan,
            loi: wrapper.loi,
            bat: !!ch.bat && !!key,
            coKhoa: !!key,
            khoaRutGon: key ? `…${key.slice(-4)}` : undefined,
            model: this.chuanModel(ch.model),
            effort: this.chuanEffort(ch.effort),
            duongDanWrapper: wrapper.duongDan,
            duongDanSettings: this.tepSettings(),
        };
    }

    async luuCauHinh(yeuCau: YeuCauLuuDeepSeek): Promise<TrangThaiDeepSeek> {
        const cu = await this.docCauHinh();
        const keyMoi = (yeuCau.apiKey ?? '').trim();
        const key = keyMoi || cu.apiKey || '';
        if (yeuCau.bat && !key) {
            throw new Error('Chưa có khóa API DeepSeek — nhập khóa để bật.');
        }
        const model = this.chuanModel(yeuCau.model);
        const effort = this.chuanEffort(yeuCau.effort);
        const ch: CauHinhDaLuu = { bat: yeuCau.bat, apiKey: key || undefined, model, effort, ngayCapNhat: new Date().toISOString() };

        await fs.mkdirp(this.thuMuc());
        await this.ghiRieng(this.tepCauHinh(), JSON.stringify(ch, undefined, 2));

        if (yeuCau.bat) {
            const wrapper = await this.timWrapper(true);
            if (!wrapper.duongDan) {
                throw new Error(wrapper.loi ?? 'Không tìm thấy tệp aword-claude-wrapper.');
            }
            await this.ghiRieng(this.tepSettings(), JSON.stringify(this.dungSettings(key, model, effort), undefined, 2));
        } else {
            // Tệp --settings chỉ tồn tại khi đang bật: dù tùy chọn wrapper còn sót, wrapper cũng chạy claude y nguyên.
            await fs.remove(this.tepSettings());
        }
        return this.docTrangThai();
    }

    async kiemTraKetNoi(apiKey: string, model: ModelDeepSeek): Promise<KetQuaKiemTraDeepSeek> {
        const key = (apiKey ?? '').trim() || (await this.docCauHinh()).apiKey || '';
        if (!key) {
            return { ok: false, thongBao: 'Chưa có khóa API để kiểm tra.' };
        }
        const tenModel = this.chuanModel(model).replace(/\[1m\]$/i, '');
        // Dùng stream: khi một mô hình quá tải, DeepSeek vẫn trả 200 rồi chỉ gửi ": keep-alive" (xếp hàng) — nhờ đó
        // phân biệt được "mạng không tới" với "khóa đúng nhưng mô hình đang bận". Hạn giờ TUYỆT ĐỐI, không phải idle
        // (keep-alive làm socket không bao giờ im lặng). Có sự kiện đầu tiên là đủ kết luận → cắt ngay.
        const body = JSON.stringify({ model: tenModel, max_tokens: 1, stream: true, messages: [{ role: 'user', content: 'ping' }] });
        return new Promise(resolve => {
            let xong = false;
            let coPhanHoi = false;
            const ketThuc = (kq: KetQuaKiemTraDeepSeek) => {
                if (xong) { return; }
                xong = true;
                clearTimeout(han);
                req.destroy();
                resolve(kq);
            };
            const req = https.request(`${BASE_URL}/v1/messages`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'text/event-stream',
                    'anthropic-version': '2023-06-01',
                    'authorization': `Bearer ${key}`,
                    'content-length': Buffer.byteLength(body),
                    'user-agent': 'AWord-KiemTraDeepSeek'
                }
            }, res => {
                coPhanHoi = true;
                const status = res.statusCode ?? 0;
                let noiDung = '';
                res.setEncoding('utf8');
                res.on('data', d => {
                    noiDung += d;
                    if (status !== 200) { return; }
                    const loiTrongStream = /"type"\s*:\s*"error"[\s\S]*?"message"\s*:\s*"([^"]*)"/.exec(noiDung);
                    if (loiTrongStream) {
                        ketThuc({ ok: false, thongBao: `DeepSeek báo lỗi: ${loiTrongStream[1]}` });
                    } else if (/event:\s*message_start|"type"\s*:\s*"message_start"/.test(noiDung)) {
                        ketThuc(this.dienGiai(200, '', tenModel));
                    }
                });
                res.on('error', e => ketThuc({ ok: false, thongBao: `Mất kết nối khi đọc phản hồi: ${e.message}` }));
                res.on('end', () => ketThuc(status === 200
                    ? { ok: false, thongBao: `DeepSeek đóng kết nối mà mô hình ${tenModel} chưa phản hồi — thử lại sau.` }
                    : this.dienGiai(status, noiDung, tenModel)));
            });
            const han = setTimeout(() => ketThuc(coPhanHoi
                ? { ok: false, thongBao: `Khóa hợp lệ, nhưng mô hình ${tenModel} đang quá tải (DeepSeek xếp hàng, chưa trả lời sau 20 giây). Thử lại sau hoặc chọn mô hình khác.` }
                : { ok: false, thongBao: 'Không kết nối được api.deepseek.com (quá 20 giây không phản hồi) — kiểm tra mạng hoặc tường lửa cơ quan.' }), 20000);
            req.on('error', e => ketThuc({ ok: false, thongBao: `Không kết nối được api.deepseek.com: ${e.message}` }));
            req.end(body);
        });
    }

    protected dienGiai(status: number, noiDung: string, tenModel: string): KetQuaKiemTraDeepSeek {
        let chiTiet = '';
        try { chiTiet = JSON.parse(noiDung)?.error?.message ?? ''; } catch { /* không phải JSON */ }
        if (status === 200) { return { ok: true, thongBao: `Kết nối thành công — khóa hợp lệ, mô hình ${tenModel} đã phản hồi.` }; }
        if (status === 401) { return { ok: false, thongBao: 'Khóa API không hợp lệ. Kiểm tra lại khóa tại platform.deepseek.com.' }; }
        if (status === 402) { return { ok: false, thongBao: 'Tài khoản DeepSeek đã hết số dư — nạp thêm tại platform.deepseek.com rồi thử lại.' }; }
        if (status === 429) { return { ok: false, thongBao: 'DeepSeek đang giới hạn số yêu cầu — thử lại sau ít phút.' }; }
        return { ok: false, thongBao: `DeepSeek trả lỗi HTTP ${status}${chiTiet ? `: ${chiTiet}` : ''}.` };
    }

    // Khối env theo đúng hướng dẫn DeepSeek, bổ sung các biến mà settings.json chung của AWord đang đặt
    // (ANTHROPIC_SMALL_FAST_MODEL...) để không lọt tên model của gateway cũ sang DeepSeek, và xóa rỗng
    // ANTHROPIC_API_KEY để khóa Anthropic riêng của máy (nếu có) không bị gửi tới DeepSeek.
    protected dungSettings(key: string, model: ModelDeepSeek, effort: MucSuyLuan): object {
        return {
            model,
            effortLevel: effort,
            env: {
                ANTHROPIC_BASE_URL: BASE_URL,
                ANTHROPIC_AUTH_TOKEN: key,
                ANTHROPIC_API_KEY: '',
                ANTHROPIC_MODEL: model,
                ANTHROPIC_DEFAULT_OPUS_MODEL: model,
                ANTHROPIC_DEFAULT_SONNET_MODEL: model,
                ANTHROPIC_DEFAULT_HAIKU_MODEL: MODEL_NHANH,
                ANTHROPIC_SMALL_FAST_MODEL: MODEL_NHANH,
                CLAUDE_CODE_SUBAGENT_MODEL: MODEL_NHANH,
                CLAUDE_CODE_EFFORT_LEVEL: effort,
                CLAUDE_CODE_AUTO_COMPACT_WINDOW: '786432'
            }
        };
    }

    // Windows: wrapper .exe đóng kèm bộ cài (resources/aword-bin). Nơi khác: sinh wrapper shell vào ~/.aword/bin khi cần.
    protected async timWrapper(taoNeuThieu: boolean): Promise<{ duongDan?: string; loi?: string }> {
        if (process.platform !== 'win32') {
            const tep = path.join(this.thuMucAword(), 'bin', 'aword-claude-wrapper.sh');
            if (taoNeuThieu) {
                await fs.mkdirp(path.dirname(tep));
                await fs.writeFile(tep, WRAPPER_SH, { mode: 0o755 });
                await fs.chmod(tep, 0o755);
            }
            return { duongDan: tep };
        }
        const ten = path.join('aword-bin', 'aword-claude-wrapper.exe');
        const ungVien: string[] = [];
        const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
        if (resourcesPath) { ungVien.push(path.join(resourcesPath, ten)); }
        ungVien.push(path.join(path.dirname(process.execPath), 'resources', ten));
        ungVien.push(path.join(process.cwd(), 'resources', ten));
        // Bản dev chạy từ browser-app (cwd khác electron-app): suy từ vị trí tệp này (aword-chat/lib/node).
        ungVien.push(path.join(__dirname, '..', '..', '..', 'electron-app', 'resources', ten));
        for (const p of ungVien) {
            if (await fs.pathExists(p)) { return { duongDan: p }; }
        }
        return { loi: 'Không tìm thấy aword-claude-wrapper.exe trong thư mục cài AWord — hãy cài lại AWord bản mới nhất.' };
    }

    protected async docCauHinh(): Promise<CauHinhDaLuu> {
        try { return await fs.readJSON(this.tepCauHinh()); } catch { return {}; }
    }

    // Tệp chứa khóa API: quyền 0600 (Windows bỏ qua mode; thư mục hồ sơ người dùng vốn chỉ tài khoản đó đọc được).
    protected async ghiRieng(tep: string, noiDung: string): Promise<void> {
        await fs.writeFile(tep, noiDung, { encoding: 'utf8', mode: 0o600 });
    }

    protected chuanModel(v: unknown): ModelDeepSeek {
        return CAC_MODEL_DEEPSEEK.find(m => m.giaTri === v)?.giaTri ?? 'deepseek-flash[1m]';
    }

    protected chuanEffort(v: unknown): MucSuyLuan {
        return CAC_MUC_SUY_LUAN.find(m => m.giaTri === v)?.giaTri ?? 'max';
    }

    // AWORD_HOME chỉ dùng khi kiểm thử cách ly (cùng quy ước với dịch vụ vai / Kho tri thức AI).
    protected thuMucAword(): string { return path.join(process.env.AWORD_HOME || os.homedir(), '.aword'); }
    protected thuMuc(): string { return path.join(this.thuMucAword(), 'deepseek'); }
    protected tepCauHinh(): string { return path.join(this.thuMuc(), 'cau-hinh.json'); }
    protected tepSettings(): string { return path.join(this.thuMuc(), 'claude-settings.json'); }
}

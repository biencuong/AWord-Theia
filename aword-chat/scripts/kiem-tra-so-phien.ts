// Chốt "số vàng" của sổ phiên: quét TOÀN BỘ ~/.claude/projects bằng CHÍNH bộ đọc mà ứng dụng dùng, rồi in
// ra những con số mà mọi giai đoạn sau phải tái tạo được.
//
// Chạy:  node_modules/.bin/ts-node --transpile-only aword-chat/scripts/kiem-tra-so-phien.ts
//        (từ thư mục gốc monorepo)
//
// Vì sao dùng chính bộ đọc thật chứ không viết một bản đếm riêng: một bản đếm song song chỉ chứng minh được
// bản đếm đó đúng, không chứng minh được thứ chạy trong ứng dụng đúng. Script này gọi thẳng
// `taoKhoSoPhien` — cùng đường đi, cùng phép khử trùng, cùng cách xử lý tệp ghi dở.
//
// Trạng thái đọc ghi vào tệp TẠM, không đụng vào trạng thái thật của người dùng.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { taoKhoSoPhien } from '../src/node/kho-so-phien';
import { BANG_GIA_MAC_DINH, NGAY_LAY_GIA, traGia, type GiaModel } from '../src/common/bang-gia-mac-dinh';
import type { SoToken } from '../src/common/so-token';

const GOC = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');

/** Mốc đối chiếu, đo ngày 18/9/2026 bằng chính bộ đọc này. */
const MOC = {
    luot: 34_754,
    /** Số dòng thô — nếu ra gần mức này thì phép khử trùng KHÔNG chạy. */
    dongTho: 79_364,
    /** Số id duy nhất nếu khử theo `uuid` — bẫy, vì gần bằng số dòng thô. */
    theoUuid: 78_456,
};

/** Bảng giá dựng sẵn hiện đang rỗng; người dùng nhập giá thì đọc thêm ở đây. */
function bangGiaNguoiDung(): Record<string, GiaModel> {
    try {
        const t = path.join(os.homedir(), '.aword', 'thong-ke', 'bang-gia.json');
        return JSON.parse(fs.readFileSync(t, 'utf8')) as Record<string, GiaModel>;
    } catch {
        return {};
    }
}

async function main(): Promise<void> {
    if (!fs.existsSync(GOC)) {
        console.error(`Không thấy thư mục sổ phiên: ${GOC}`);
        process.exit(1);
    }

    const bangNguoiDung = bangGiaNguoiDung();
    const tepTrangThai = path.join(os.tmpdir(), `aword-kiem-tra-sophien-${process.pid}.json`);
    const dau = Date.now();

    const kho = taoKhoSoPhien({
        goc: GOC,
        tepTrangThai,
        traGia: (m: string): SoToken | undefined => traGia(m, bangNguoiDung),
        nhipPollMs: 1_000_000,
    });

    console.log('Đang quét...');
    await kho.quetLai();
    const giay = ((Date.now() - dau) / 1000).toFixed(1);

    const bc = kho.docBaoCao(3650);
    const cs = bc.chiSo;
    const tong = bc.theoModel.reduce(
        (s, m) => ({ vao: s.vao + m.token.vao, ra: s.ra + m.token.ra, cacheDoc: s.cacheDoc + m.token.cacheDoc, cacheGhi: s.cacheGhi + m.token.cacheGhi, luot: s.luot + m.token.luot }),
        { vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0, luot: 0 },
    );

    kho.dung();
    fs.rmSync(tepTrangThai, { force: true });

    console.log('');
    console.log('=== SỐ VÀNG SỔ PHIÊN ===');
    console.log(`Thư mục             : ${GOC}`);
    console.log(`Thời gian quét      : ${giay} giây`);
    console.log(`Lượt gọi đã tính    : ${tong.luot.toLocaleString('vi-VN')}`);
    console.log(`Số ngày có dữ liệu  : ${bc.theoNgay.length}`);
    console.log('');
    console.log('Token:');
    console.log(`  vào ${tong.vao.toLocaleString('vi-VN')} · ra ${tong.ra.toLocaleString('vi-VN')} · cache đọc ${tong.cacheDoc.toLocaleString('vi-VN')} · cache ghi ${tong.cacheGhi.toLocaleString('vi-VN')}`);

    console.log('');
    console.log('Theo model (lượt · token vào · token ra · tiền):');
    for (const m of bc.theoModel) {
        const tien = m.chuaCoGia ? 'chưa có giá' : `${m.tien.toLocaleString('vi-VN')} đ`;
        console.log(`  ${m.model.padEnd(30)} ${String(m.token.luot).padStart(6)} · ${m.token.vao.toLocaleString('vi-VN').padStart(12)} · ${m.token.ra.toLocaleString('vi-VN').padStart(11)} · ${tien}`);
    }

    if (cs.tienThang > 0) {
        console.log('');
        console.log(`Tiền tháng này      : ${cs.tienThang.toLocaleString('vi-VN')} đ`);
    }
    if (cs.soModelChuaCoGia > 0) {
        console.log(`⚠ ${cs.soModelChuaCoGia} model CHƯA CÓ GIÁ — tiền đang THIẾU, không phải sai.`);
        console.log(`   Bảng giá dựng sẵn: ${Object.keys(BANG_GIA_MAC_DINH).length} mục, ngày lấy giá: ${NGAY_LAY_GIA ?? '(chưa có)'}`);
    }

    console.log('');
    console.log('=== ĐỐI CHIẾU MỐC ===');
    console.log(`  lượt đã tính ${tong.luot.toLocaleString('vi-VN')} — mốc ${MOC.luot.toLocaleString('vi-VN')}`);
    if (tong.luot > MOC.dongTho * 0.9) {
        console.log('  ✗ NGHI KHỬ TRÙNG HỎNG: số ra gần bằng số dòng thô.');
        process.exitCode = 1;
    } else if (tong.luot > MOC.luot * 1.5) {
        console.log('  ✗ NGHI KHỬ THEO uuid: số ra cỡ số dòng thô, tức không khử được gì.');
        process.exitCode = 1;
    } else {
        console.log('  ✓ Cùng bậc độ lớn với mốc (máy vẫn ghi thêm nên số sẽ tăng dần — đây là phép kiểm bậc độ lớn, không phải khớp tuyệt đối).');
    }
}

void main();

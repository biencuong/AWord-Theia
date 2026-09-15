// Đọc bảng tính Excel (.xlsx) chỉ bằng thư viện chuẩn của Node: tự đọc cấu trúc ZIP (thư mục trung tâm) rồi giải nén
// bằng zlib.inflateRawSync, lấy trang tính ĐẦU TIÊN. Chỉ cần đủ cho việc nhập danh sách tài khoản: ô chuỗi (chung/nội
// tuyến/công thức), số, logic, ngày (số seri Excel có định dạng ngày → "YYYY-MM-DD").
import { inflateRawSync } from 'node:zlib';

export type GiaTriO = string | number | boolean | null;

const LOI_TEP = 'Tệp Excel bị hỏng hoặc không đúng định dạng .xlsx (hãy lưu lại bằng "Excel Workbook (*.xlsx)").';
/** Giới hạn giải nén mỗi tệp con — chống "bom ZIP". */
const TOI_DA_GIAI_NEN = 32 * 1024 * 1024;
const TOI_DA_MUC_ZIP = 5000;
const TOI_DA_DONG = 20000;
const TOI_DA_COT = 200;

/** Đọc mục lục ZIP; trả về hàm lấy nội dung (đã giải nén) theo tên tệp con. */
export function docZip(buf: Buffer): Map<string, () => Buffer> {
    const ketQua = new Map<string, () => Buffer>();
    // Bản ghi kết thúc thư mục trung tâm (EOCD) nằm cuối tệp, sau nó tối đa 65535 byte chú thích
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) { throw new Error(LOI_TEP); }
    const soMuc = buf.readUInt16LE(eocd + 10);
    const viTriThuMuc = buf.readUInt32LE(eocd + 16);
    if (soMuc > TOI_DA_MUC_ZIP || viTriThuMuc >= buf.length) { throw new Error(LOI_TEP); }

    let p = viTriThuMuc;
    for (let n = 0; n < soMuc; n++) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) { throw new Error(LOI_TEP); }
        const co = buf.readUInt16LE(p + 8);
        const phuongThuc = buf.readUInt16LE(p + 10);
        const kichThuocNen = buf.readUInt32LE(p + 20);
        const doDaiTen = buf.readUInt16LE(p + 28);
        const doDaiThem = buf.readUInt16LE(p + 30);
        const doDaiChuThich = buf.readUInt16LE(p + 32);
        const viTriCucBo = buf.readUInt32LE(p + 42);
        const ten = buf.subarray(p + 46, p + 46 + doDaiTen).toString('utf8');
        p += 46 + doDaiTen + doDaiThem + doDaiChuThich;
        if (co & 1) { throw new Error('Tệp Excel đang đặt mật khẩu — hãy bỏ mật khẩu rồi nhập lại.'); }
        ketQua.set(ten, () => {
            if (viTriCucBo + 30 > buf.length || buf.readUInt32LE(viTriCucBo) !== 0x04034b50) { throw new Error(LOI_TEP); }
            const batDau = viTriCucBo + 30 + buf.readUInt16LE(viTriCucBo + 26) + buf.readUInt16LE(viTriCucBo + 28);
            if (batDau + kichThuocNen > buf.length) { throw new Error(LOI_TEP); }
            const duLieu = buf.subarray(batDau, batDau + kichThuocNen);
            if (phuongThuc === 0) { return Buffer.from(duLieu); }
            if (phuongThuc === 8) {
                try {
                    return inflateRawSync(duLieu, { maxOutputLength: TOI_DA_GIAI_NEN });
                } catch {
                    throw new Error(LOI_TEP);
                }
            }
            throw new Error(LOI_TEP);
        });
    }
    return ketQua;
}

// ---- Duyệt XML tối giản (đủ cho các phần SpreadsheetML; không xử lý DTD/thực thể ngoài) ----
interface TheXml { loai: 'mo' | 'dong' | 'tu-dong'; ten: string; tt: Record<string, string> }
type NutXml = TheXml | { loai: 'chu'; noiDung: string };

const THUC_THE: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function giaiThucThe(s: string): string {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, m: string) => {
        if (m[0] !== '#') { return THUC_THE[m]; }
        const ma = m[1] === 'x' ? parseInt(m.slice(2), 16) : parseInt(m.slice(1), 10);
        return ma > 0 && ma <= 0x10ffff ? String.fromCodePoint(ma) : '';
    });
}

const boTienTo = (ten: string): string => ten.slice(ten.indexOf(':') + 1);

function* duyetXml(xml: string): Generator<NutXml> {
    const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<[?!][\s\S]*?>|<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g;
    for (let m = re.exec(xml); m; m = re.exec(xml)) {
        if (m[1] !== undefined) { yield { loai: 'chu', noiDung: m[1] }; continue; }
        if (m[6] !== undefined) { yield { loai: 'chu', noiDung: giaiThucThe(m[6]) }; continue; }
        if (m[3] === undefined) { continue; } // chú thích, <?xml ?>, <!DOCTYPE>
        const tt: Record<string, string> = {};
        const reTt = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        for (let a = reTt.exec(m[4]); a; a = reTt.exec(m[4])) {
            tt[boTienTo(a[1])] = giaiThucThe(a[2] ?? a[3] ?? '');
        }
        yield { loai: m[2] === '/' ? 'dong' : (m[5] === '/' ? 'tu-dong' : 'mo'), ten: boTienTo(m[3]), tt };
    }
}

/** Chuỗi dùng chung: mỗi <si> ghép các <t>, bỏ phần phiên âm <rPh>. */
function docChuoiChung(xml: string): string[] {
    const ds: string[] = [];
    let hienTai = '', trongT = false, sauPhienAm = 0;
    for (const nut of duyetXml(xml)) {
        if (nut.loai === 'chu') {
            if (trongT && sauPhienAm === 0) { hienTai += nut.noiDung; }
            continue;
        }
        if (nut.ten === 'si') {
            if (nut.loai === 'mo') { hienTai = ''; } else { ds.push(nut.loai === 'tu-dong' ? '' : hienTai); }
        } else if (nut.ten === 'rPh') {
            if (nut.loai === 'mo') { sauPhienAm++; } else if (nut.loai === 'dong') { sauPhienAm--; }
        } else if (nut.ten === 't') {
            trongT = nut.loai === 'mo';
        }
    }
    return ds;
}

const MA_DINH_DANG_NGAY = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function laMaDinhDangNgay(maDinhDang: string): boolean {
    const sach = maDinhDang.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[dmyhs]/i.test(sach) && !/^general$/i.test(sach.trim());
}

/** Với mỗi chỉ số kiểu ô (thuộc tính s), cho biết đó có phải định dạng ngày/giờ không. */
function docKieuNgay(xml: string): boolean[] {
    const dinhDangRieng = new Map<number, string>();
    const kq: boolean[] = [];
    let trongCellXfs = false;
    for (const nut of duyetXml(xml)) {
        if (nut.loai === 'chu') { continue; }
        if (nut.ten === 'numFmt' && nut.loai !== 'dong') {
            dinhDangRieng.set(Number(nut.tt.numFmtId), nut.tt.formatCode ?? '');
        } else if (nut.ten === 'cellXfs') {
            trongCellXfs = nut.loai === 'mo';
        } else if (nut.ten === 'xf' && trongCellXfs && nut.loai !== 'dong') {
            const id = Number(nut.tt.numFmtId ?? 0);
            const rieng = dinhDangRieng.get(id);
            kq.push(rieng !== undefined ? laMaDinhDangNgay(rieng) : MA_DINH_DANG_NGAY.has(id));
        }
    }
    return kq;
}

/** Số seri Excel → "YYYY-MM-DD" (có giờ thì "YYYY-MM-DDTHH:MM:SS"). */
export function seriSangNgay(seri: number, he1904 = false): string {
    const goc = he1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    const d = new Date(goc + Math.round(seri * 86400) * 1000);
    const iso = d.toISOString();
    return iso.slice(11, 19) === '00:00:00' ? iso.slice(0, 10) : iso.slice(0, 19);
}

function cotTuThamChieu(thamChieu: string): number {
    const m = /^([A-Z]{1,3})\d*$/i.exec(thamChieu);
    if (!m) { return -1; }
    let cot = 0;
    for (const c of m[1].toUpperCase()) { cot = cot * 26 + (c.charCodeAt(0) - 64); }
    return cot - 1;
}

function chuanDuongDan(goc: string, dich: string): string {
    if (dich.startsWith('/')) { return dich.slice(1); }
    const phan = goc.split('/').slice(0, -1);
    for (const p of dich.split('/')) {
        if (p === '..') { phan.pop(); } else if (p !== '.' && p !== '') { phan.push(p); }
    }
    return phan.join('/');
}

/** Đọc trang tính đầu tiên của tệp .xlsx thành mảng hàng (ô trống = null, đã bỏ các hàng trống ở cuối). */
export function docXlsx(buf: Buffer): GiaTriO[][] {
    if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) { throw new Error(LOI_TEP); }
    const zip = docZip(buf);
    const lay = (ten: string): string | undefined => {
        const f = zip.get(ten);
        return f ? f().toString('utf8') : undefined;
    };

    const workbook = lay('xl/workbook.xml');
    if (!workbook) { throw new Error(LOI_TEP); }
    let idTrangDau: string | undefined;
    let he1904 = false;
    for (const nut of duyetXml(workbook)) {
        if (nut.loai === 'chu') { continue; }
        if (nut.ten === 'workbookPr' && /^(1|true)$/i.test(nut.tt.date1904 ?? '')) { he1904 = true; }
        if (nut.ten === 'sheet' && nut.loai !== 'dong' && idTrangDau === undefined) { idTrangDau = nut.tt.id; }
    }
    let duongDanTrang = 'xl/worksheets/sheet1.xml';
    const quanHe = lay('xl/_rels/workbook.xml.rels');
    if (quanHe && idTrangDau) {
        for (const nut of duyetXml(quanHe)) {
            if (nut.loai !== 'chu' && nut.ten === 'Relationship' && nut.tt.Id === idTrangDau && nut.tt.Target) {
                duongDanTrang = chuanDuongDan('xl/workbook.xml', nut.tt.Target);
            }
        }
    }
    const trang = lay(duongDanTrang);
    if (trang === undefined) { throw new Error(LOI_TEP); }
    const chuoiChung = docChuoiChung(lay('xl/sharedStrings.xml') ?? '');
    const kieuNgay = docKieuNgay(lay('xl/styles.xml') ?? '');

    const hang: GiaTriO[][] = [];
    let hangHienTai: GiaTriO[] | null = null;
    let soHang = -1, cotTiep = 0;
    let o: { cot: number; t: string; s: number } | null = null;
    let giaTriV = '', chuoiNoiTuyen = '', trong: 'v' | 't' | '' = '', sauPhienAm = 0;

    const ketThucO = (): void => {
        if (!o || !hangHienTai) { return; }
        let gt: GiaTriO = null;
        switch (o.t) {
            case 's': gt = chuoiChung[Number(giaTriV)] ?? null; break;
            case 'inlineStr': gt = chuoiNoiTuyen; break;
            case 'str': gt = giaTriV; break;
            case 'b': gt = giaTriV === '1' || giaTriV.toLowerCase() === 'true'; break;
            case 'e': gt = null; break;
            case 'd': gt = giaTriV.slice(0, 10) || null; break;
            default: {
                if (giaTriV.trim() === '') { gt = null; break; }
                const so = Number(giaTriV);
                gt = !Number.isFinite(so) ? giaTriV : (kieuNgay[o.s] ? seriSangNgay(so, he1904) : so);
            }
        }
        if (o.cot < TOI_DA_COT && gt !== null && gt !== '') {
            while (hangHienTai.length < o.cot) { hangHienTai.push(null); }
            hangHienTai[o.cot] = gt;
        }
        o = null;
    };

    for (const nut of duyetXml(trang)) {
        if (nut.loai === 'chu') {
            if (trong === 'v') { giaTriV += nut.noiDung; } else if (trong === 't' && sauPhienAm === 0) { chuoiNoiTuyen += nut.noiDung; }
            continue;
        }
        switch (nut.ten) {
            case 'row':
                if (nut.loai === 'dong') { hangHienTai = null; break; }
                soHang = nut.tt.r ? Number(nut.tt.r) - 1 : soHang + 1;
                if (!Number.isInteger(soHang) || soHang < 0) { throw new Error(LOI_TEP); }
                if (soHang >= TOI_DA_DONG) { throw new Error(`Bảng tính quá lớn (tối đa ${TOI_DA_DONG} dòng).`); }
                while (hang.length <= soHang) { hang.push([]); }
                hangHienTai = hang[soHang];
                cotTiep = 0;
                if (nut.loai === 'tu-dong') { hangHienTai = null; }
                break;
            case 'c': {
                if (nut.loai === 'dong') { ketThucO(); break; }
                const cot = nut.tt.r ? cotTuThamChieu(nut.tt.r) : cotTiep;
                cotTiep = cot + 1;
                o = { cot, t: nut.tt.t ?? 'n', s: Number(nut.tt.s ?? 0) };
                giaTriV = ''; chuoiNoiTuyen = ''; trong = ''; sauPhienAm = 0;
                if (nut.loai === 'tu-dong') { o = null; }
                break;
            }
            case 'v': trong = nut.loai === 'mo' ? 'v' : ''; break;
            case 't': trong = nut.loai === 'mo' ? 't' : ''; break;
            case 'rPh':
                if (nut.loai === 'mo') { sauPhienAm++; } else if (nut.loai === 'dong') { sauPhienAm--; }
                break;
        }
    }
    while (hang.length > 0 && hang[hang.length - 1].every(g => g === null || g === '')) { hang.pop(); }
    return hang;
}

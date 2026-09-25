// Kiểm thử LOGIC của chỉ báo trên thanh tiêu đề, chạy trong jsdom (jest đã cấu hình jsdom sẵn).
//
// Vì sao không mở ứng dụng thật để kiểm: AWord Pro giữ khoá "chỉ một bản chạy", nên mở thêm một bản để
// thử là tranh khoá với bản người dùng đang dùng. Phần kiểm được ở đây là phần dễ sai nhất — ngưỡng bề
// rộng, chuỗi hiển thị, cờ cảnh báo, và biến CSS dùng để chừa chỗ cho tiêu đề cửa sổ. Phần bố cục thật
// (Lumino đặt widget vào vùng `top`, các nút cửa sổ có bị đè không) thì vẫn phải nhìn bằng mắt trên bản
// chạy thật.

import { AwordChiSoTokenWidget } from '../src/browser/aword-chi-so-token-widget';
import type { ChiSoToken } from '../src/common/chi-so-token-protocol';

/** jsdom không có ResizeObserver; chỉ báo dùng nó để theo dõi bề rộng thanh tiêu đề. */
class ResizeObserverGia {
    observe(): void { /* không cần làm gì trong kiểm thử */ }
    disconnect(): void { /* không cần làm gì trong kiểm thử */ }
}

/** Mặt nhìn vào bên trong widget dành cho kiểm thử — có kiểu hẳn hoi thay vì ép sang Record. */
interface WidgetNoiBo {
    commandService: { executeCommand: (id: string) => Promise<unknown> };
    chiSoServer: { docChiSo: () => Promise<ChiSoToken> };
    update: () => void;
    init: () => void;
    rong: number;
    chiSo: ChiSoToken | undefined;
    chuoiHienTai: string;
    capNhatChuoi: () => void;
    render: () => unknown;
}

function noiBo(w: AwordChiSoTokenWidget): WidgetNoiBo {
    return w as unknown as WidgetNoiBo;
}

function chiSo(ghiDe: Partial<ChiSoToken> = {}): ChiSoToken {
    return {
        tienThang: 1_234_567,
        tokenThang: { vao: 1_000_000, ra: 500_000, cacheDoc: 0, cacheGhi: 0, luot: 100 },
        tienHomNay: 10_000,
        tokenHomNay: { vao: 1_000, ra: 500, cacheDoc: 0, cacheGhi: 0, luot: 3 },
        soModelChuaCoGia: 0,
        dangQuet: false,
        soTepGhiLai: 0,
        ...ghiDe,
    };
}

describe('chỉ báo token trên thanh tiêu đề', () => {
    let daChay: string[] = [];
    let thanh: HTMLElement;

    function dungWidget(rong: number, cs: ChiSoToken): AwordChiSoTokenWidget {
        thanh.style.width = `${rong}px`;
        Object.defineProperty(thanh, 'clientWidth', { value: rong, configurable: true });

        const w = new AwordChiSoTokenWidget();
        // Dựng thẳng bằng `new` (không qua DI) rồi tự gắn dịch vụ — đúng cách repo này vẫn làm với hộp thoại.
        const nb = noiBo(w);
        nb.commandService = { executeCommand: (id: string) => { daChay.push(id); return Promise.resolve(); } };
        nb.chiSoServer = { docChiSo: () => Promise.resolve(cs) };
        nb.update = () => { /* không vẽ React trong kiểm thử logic */ };
        nb.init();
        nb.rong = rong;
        nb.chiSo = cs;
        nb.capNhatChuoi();
        return w;
    }

    beforeEach(() => {
        daChay = [];
        (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverGia;
        thanh = document.createElement('div');
        thanh.id = 'theia-top-panel';
        document.body.appendChild(thanh);
        document.documentElement.style.removeProperty('--aword-tt-rong');
    });

    afterEach(() => {
        thanh.remove();
    });

    test('bề rộng lớn: hiện cả tiền lẫn token', () => {
        const w = noiBo(dungWidget(1200, chiSo()));
        expect(w.chuoiHienTai).toBe('1,2tr · 1,5tr token');
    });

    test('bề rộng vừa: chỉ hiện tiền', () => {
        const w = noiBo(dungWidget(800, chiSo()));
        expect(w.chuoiHienTai).toBe('1,2tr');
    });

    test('bề rộng hẹp: ẩn hẳn và trả chỗ cho tiêu đề cửa sổ', () => {
        const w = noiBo(dungWidget(600, chiSo()));
        expect(w.chuoiHienTai).toBe('');
        expect(w.render()).toBeNull();
    });

    test('chưa có số liệu thì hiện dấu chờ, không hiện số 0 gây hiểu nhầm', () => {
        const w = noiBo(dungWidget(1200, chiSo()));
        w.chiSo = undefined;
        w.capNhatChuoi();
        expect(w.chuoiHienTai).toBe('…');
    });

    test('thiếu giá thì hiện dấu cảnh báo — người dùng phải biết số tiền đang thiếu', () => {
        const w = dungWidget(1200, chiSo({ soModelChuaCoGia: 2 }));
        const json = JSON.stringify(noiBo(w).render());
        expect(json).toContain('aword-cs-canh');
    });

    test('CHƯA CÓ GIÁ mô hình nào (tiền tính ra 0) thì KHÔNG hiện "0" — chỉ hiện token + dấu cảnh báo', () => {
        const cs = chiSo({ tienThang: 0, soModelChuaCoGia: 8 });
        const rong = noiBo(dungWidget(1200, cs));
        expect(rong.chuoiHienTai).toBe('1,5tr token');
        expect(JSON.stringify(rong.render())).toContain('aword-cs-canh');
        expect(noiBo(dungWidget(800, cs)).chuoiHienTai).toBe('1,5tr token');
    });

    test('có giá một phần (tiền > 0) thì vẫn hiện tiền kèm dấu cảnh báo', () => {
        const w = noiBo(dungWidget(1200, chiSo({ soModelChuaCoGia: 1 })));
        expect(w.chuoiHienTai).toBe('1,2tr · 1,5tr token');
    });

    test('đang quét thì hiện dấu hiệu quét', () => {
        const w = dungWidget(1200, chiSo({ dangQuet: true }));
        expect(JSON.stringify(noiBo(w).render())).toContain('aword-cs-cham');
    });

    test('bấm vào thì mở trang thống kê', () => {
        const w = dungWidget(1200, chiSo());
        w.node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(daChay).toEqual(['aword:thong-ke']);
    });

    test('bấm bằng bàn phím (Enter) cũng mở được', () => {
        const w = dungWidget(1200, chiSo());
        w.node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(daChay).toEqual(['aword:thong-ke']);
    });

    test('chuỗi hiển thị không đổi thì KHÔNG vẽ lại — tránh đụng vào DOM mỗi 5 giây', () => {
        const w = noiBo(dungWidget(1200, chiSo()));
        let soLanVe = 0;
        w.update = () => { soLanVe++; };
        w.capNhatChuoi();
        w.capNhatChuoi();
        expect(soLanVe).toBe(0);
    });
});

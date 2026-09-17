// Bảng giá token dựng sẵn của AWord Pro.
//
// ⚠ BẢNG NÀY CỐ Ý ĐỂ RỖNG. Không viết giá theo trí nhớ.
//
// Lý do: giá token là con số người dùng dùng để tin vào hoá đơn của mình. Một con số sai mà trông hợp lý
// còn tệ hơn không có con số nào — nó âm thầm làm sai mọi báo cáo chi phí và mọi quyết định dựa trên đó.
// Giá phải lấy từ TRANG GIÁ CÔNG BỐ của từng nhà cung cấp, kèm ngày lấy, và ngày đó phải hiện thẳng trong
// giao diện để người dùng biết số liệu cũ tới đâu.
//
// Thứ tự ưu tiên khi tra giá (ba tầng, tầng trên thắng):
//   1. Người dùng tự nhập (lưu ở ~/.aword/thong-ke/bang-gia.json)
//   2. Kho tri thức đẩy về (trang trithuc.aword.vn phục vụ danh mục giá — xem kế hoạch GĐ4/GĐ5)
//   3. Bảng này
//
// Kho tri thức phục vụ giá là đường chính: nhà cung cấp đổi giá thì sửa một chỗ trên máy chủ, mọi máy nhận
// ngay, không phải phát hành lại AWord Pro cho từng máy.

import { tienLuot, type GiaModel, type SoToken } from './so-token';

/** Ngày lấy giá của bảng dựng sẵn. `null` = chưa có giá nào được xác minh. */
export const NGAY_LAY_GIA: string | null = null;

/**
 * Giá dựng sẵn theo mã model, đơn vị đồng trên 1 triệu token.
 *
 * RỖNG CÓ CHỦ ĐÍCH — xem ghi chú đầu tệp. Khi bổ sung, mỗi mục phải kèm ngày lấy giá và nguồn.
 */
export const BANG_GIA_MAC_DINH: Record<string, GiaModel> = {};

/** Tra giá một model: bảng người dùng nhập trước, rồi tới bảng dựng sẵn. */
export function traGia(model: string, bangNguoiDung?: Record<string, GiaModel>): GiaModel | undefined {
    return bangNguoiDung?.[model] ?? BANG_GIA_MAC_DINH[model];
}

/**
 * Tiền của một mẫu số theo ngày × model.
 *
 * Trả kèm `soModelChuaCoGia` — số model gặp trong sổ mà chưa tra được giá. Con số này PHẢI hiện ra ở giao
 * diện: người dùng cần biết tổng tiền đang thiếu chứ không phải tưởng là đủ.
 */
export function tienTheoModel(
    mau: Record<string, Record<string, SoToken & { luot: number }>>,
    bangNguoiDung?: Record<string, GiaModel>,
): { dong: number; soModelChuaCoGia: number; dsChuaCoGia: string[] } {
    let dong = 0;
    const chuaCoGia = new Set<string>();
    for (const theoModel of Object.values(mau)) {
        for (const [model, t] of Object.entries(theoModel)) {
            const kq = tienLuot(t, traGia(model, bangNguoiDung));
            dong += kq.dong;
            if (kq.chuaCoGia) { chuaCoGia.add(model); }
        }
    }
    return { dong, soModelChuaCoGia: chuaCoGia.size, dsChuaCoGia: [...chuaCoGia] };
}

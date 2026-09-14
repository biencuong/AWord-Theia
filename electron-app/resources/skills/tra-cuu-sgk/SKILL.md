---
name: tra-cuu-sgk
description: Tra cứu Kho SGK (MCP server `khosgk`, các công cụ `sgk_*`) — sách giáo khoa, sách giáo viên, sách bài tập "Kết nối tri thức với cuộc sống" đã số hóa có cấu trúc (bài, mục, hoạt động, bài tập, hình ảnh bóc tách). Dùng khi soạn kế hoạch bài dạy, ra đề, làm bài trình chiếu, học liệu cần bám đúng bài trong SGK; khi người dùng nói "theo SGK", "bài ... trong sách", "hình trong SGK", "tra SGK", "kho SGK", "kiểm tra trạng thái Kho SGK", "kích hoạt/gia hạn Kho SGK", "chuyển máy Kho SGK", hoặc bất cứ khi nào các công cụ `sgk_*` đang có trong phiên và việc đang làm liên quan nội dung sách.
---

# Tra cứu Kho SGK (MCP `khosgk`)

Kho SGK là máy chủ tri thức tại `https://aword.vn/khosgk/` do AWord cung cấp cho vai Giáo viên:
84 quyển SGK/SGV/SBT "Kết nối tri thức với cuộc sống" (bộ sách thống nhất toàn quốc từ năm học
2026–2027, QĐ 3588/QĐ-BGDĐT) đã được số hóa thành **bài học có cấu trúc** (mục, hoạt động, bài tập,
ghi nhớ, công thức LaTeX, bảng) kèm **hình ảnh bóc tách** đúng vị trí và chú thích. Bản quyền tính
theo **mã máy** (50.000 đ/máy/năm), thanh toán bằng **quét QR** ngay trong chat.

## 1. Khi nào dùng — khi nào không

- DÙNG trước khi soạn bất kỳ sản phẩm nào cần nội dung sách: kế hoạch bài dạy, đề kiểm tra, bài
  trình chiếu, mô phỏng/học liệu, thẩm định đối chiếu SGK. Kho thay cho việc đọc PDF scan bằng thị
  giác (nhanh hơn, rẻ token hơn, có sẵn hình).
- DÙNG khi người dùng hỏi trạng thái bản quyền, muốn kích hoạt/gia hạn/đổi máy, muốn góp ý lỗi sách.
- KHÔNG dùng khi câu hỏi không liên quan nội dung sách (văn bản hành chính, quy định...).
- Nếu người dùng đã bỏ PDF SGK vào `TU LIEU MON HOC/<Môn>/SGK/` mà kho cũng có sách đó → ƯU TIÊN
  kho (đã kiểm chứng, có cấu trúc); chỉ mở PDF khi kho chưa có sách/bài cần.

## 2. Kiểm tra kết nối trước khi làm

| Tình huống | Cách nhận biết | Việc phải làm |
|---|---|---|
| Chưa kết nối | Không có công cụ nào tên `sgk_*` trong phiên | Hướng dẫn: mở Start Menu → chạy **"Kết nối Kho SGK (AWord)"** (hoặc tệp `Ket_Noi_KhoSGK.cmd` trong thư mục cài AWord, thường `%LOCALAPPDATA%\Programs\AWord`), nhấn Enter để nhận địa chỉ mặc định, rồi **mở lại AWord**. Không cần mã khóa — mã máy và token được sinh tự động. |
| Đã kết nối, mất mạng/máy chủ tạm ngừng | Công cụ có nhưng gọi lỗi mạng | Báo tạm thời, KHÔNG bảo chạy lại tệp kết nối; làm tiếp bằng PDF trong `TU LIEU MON HOC` nếu có. |
| Chưa kích hoạt / hết hạn | Kết quả công cụ tri thức là JSON `{"loi":"chua_kich_hoat"...}` hoặc `"het_han"` kèm `huong_dan` | Theo mục 6 (thanh toán QR trong chat). |
| Sai máy | HTTP 403 `may_khong_khop` | Token đang gắn với máy khác: chạy lại "Kết nối Kho SGK (AWord)" trên máy này; nếu là máy mới thay máy cũ → `sgk_chuyen_may(ly_do)` (quản trị duyệt, ≤ 2 lần/năm). |
| Bị khóa | 403 `khoa` | Báo người dùng liên hệ hỗ trợ AWord (Hotline/Zalo 0983 606 845). |

Lần đầu trong phiên, nếu chưa chắc luật của kho có đổi so với skill này, đọc resource `khosgk://huong-dan`
(ngắn). Bình thường KHÔNG cần — skill này đã chứa đủ luật.

## 3. Luật tiết kiệm token (bắt buộc — theo HUONG_DAN_AI của kho)

1. **Index-first**: `sgk_danh_sach` (tối đa 1 lần/phiên, lọc `mon`, `lop`) → `sgk_muc_luc(ma_sach)` →
   chọn `bai_id` → `sgk_bai`. KHÔNG tìm kiếm mò (`sgk_tim`) khi đã biết môn/lớp/bài.
2. **Lấy đúng phần cần** bằng tham số `phan` của `sgk_bai`:
   - soạn mục tiêu → `phan="muc-tieu"`; ra đề → `phan="bai-tap"` rồi `phan="ghi-nho"`;
   - làm slide/mô phỏng → `phan="hoat-dong"`; soạn giáo án đầy đủ → `phan="tat-ca"` (một lần).
   - Không cần mô tả hình trong văn bản → thêm `khong_hinh=true`.
3. **Hình**: markdown bài đã có dòng mô tả từng hình (`> Hình x.y (tr.NN): ...`) — chỉ gọi `sgk_hinh`
   khi cần chèn ảnh thật vào docx/pptx/html. Tải bằng `url_tai` (mục 5), KHÔNG kéo base64 vào ngữ cảnh
   (`kem_anh=true` chỉ khi thật sự cần nhìn ảnh và ảnh ≤ 60 KB).
4. **Tìm kiếm** `sgk_tim(query, mon, lop, gioi_han≤8)`: đọc 8 kết quả × 300 ký tự rồi mới mở đúng bài.
5. **Không nạp lại** bài đã đọc trong phiên; ghi nhớ `ma_sach`, `bai_id`, `trang_in` để trích dẫn.
6. Dùng đúng loại sách: `sgk` = nội dung học sinh đọc; `sgv` = gợi ý dạy học, đáp án (phương pháp +
   đáp án); `sbt` = nguồn câu hỏi luyện tập/ra đề. `sgk_yeu_cau_can_dat(ma_sach, bai_id)` gộp mục tiêu
   SGK + gợi ý SGV cùng môn–lớp — dùng khi soạn mục tiêu bài dạy.
7. Mọi kết quả có thể kèm `thong_bao` → chuyển NGUYÊN VĂN cho người dùng trước khi trả lời (mục 7).
8. Phát hiện lỗi nội dung (chữ sai, hình sai chú thích) → `sgk_gop_y(ma_sach, pdf_trang, noi_dung)`,
   nêu rõ chữ sai và chữ đúng.
9. Hạn mức: 400 lượt `sgk_bai`/máy/ngày, 60 lượt `sgk_hinh` kèm ảnh/ngày; gặp `{loi:"vuot_han_muc",
   reset_luc}` → báo người dùng giờ được dùng lại, làm tiếp bằng nội dung đã lấy.

## 4. Bảng công cụ

### 4.1. Bản quyền, thanh toán, thông báo
| Công cụ | Tham số | Trả về |
|---|---|---|
| `sgk_trang_thai` | – | `ma_may, trang_thai (chua_kich_hoat/hoat_dong/sap_het_han/het_han/khoa/cho_doi_may), het_han, phien_ban_lon_duoc_dung, phien_ban_kho_moi_nhat, gia{kich_hoat, gia_han, cap_nhat_lon}, thong_bao[]` |
| `sgk_thanh_toan` | `loai?` = `kich_hoat` \| `gia_han` \| `cap_nhat_lon` (mặc định tự chọn) | `ma_don, so_tien, noi_dung_ck ("KHOSGK 12345678"), ngan_hang{ten, so_tai_khoan, chu_tai_khoan}, qr_url, trang_thanh_toan, het_han_don, huong_dan` + ảnh QR (nếu ≤ 60 KB) |
| `sgk_kiem_tra_thanh_toan` | `ma_don` | `trang_thai: cho_thanh_toan \| da_thanh_toan \| xem_xet \| het_han`, `het_han_ban_quyen?` |
| `sgk_chuyen_may` | `ly_do` | tạo yêu cầu đổi máy (gọi từ máy mới) → `trang_thai: cho_duyet, so_lan_con_lai` |
| `sgk_thong_bao` | `danh_dau_da_doc?` | thông báo chưa đọc của máy + toàn hệ thống |
| `sgk_gop_y` | `ma_sach, pdf_trang, noi_dung` | `{id, cam_on}` |

### 4.2. Tri thức (cần bản quyền còn hạn)
| Công cụ | Tham số | Trả về |
|---|---|---|
| `sgk_danh_sach` | `mon?, lop?, loai?` (`sgk\|sgv\|sbt\|cd\|tk`) | bảng sách: `ma_sach, ten, loai, mon, lop, tap, so_bai, phien_ban` |
| `sgk_muc_luc` | `ma_sach` | mục lục: chương → bài → trang in → `bai_id` |
| `sgk_bai` | `ma_sach`, `bai_id` hoặc `trang_in`, `phan?` (`tat-ca\|muc-tieu\|hoat-dong\|bai-tap\|ghi-nho\|noi-dung`), `khong_hinh?` | markdown bài (đã lọc) + `hinh[]{id, so_hinh, chu_thich, url_tai}` |
| `sgk_tim` | `query, mon?, lop?, loai?, gioi_han?≤8` | `[{ma_sach, ten_sach, bai_id, ten_bai, trang_in, trich}]` |
| `sgk_hinh` | `ma_sach, hinh_id, kem_anh?` | `id, so_hinh, chu_thich, mo_ta, bai_id, trang_in, bbox, url_tai` (+ ảnh base64 nếu `kem_anh`) |
| `sgk_hinh_theo_bai` | `ma_sach, bai_id` | danh mục hình của bài + `url_tai` từng hình |
| `sgk_yeu_cau_can_dat` | `ma_sach, bai_id` | mục tiêu bài (SGK) + gợi ý dạy học/đáp án trong SGV tương ứng |
| `sgk_cap_nhat` | – | phiên bản kho, ngày, nhật ký thay đổi, sách mới |

Định danh: `ma_sach` = `<loai>-<mon>-<lop>[-<tap>]` (ví dụ `sgk-khoa-hoc-tu-nhien-9`, `sgk-toan-1-tap-mot`);
`bai_id` = `b<chương>-<bài>` (`b03-08`) hoặc `b00-<số>` khi không chia chương; `hinh_id` = `p<trang PDF>_H<k>`.
Resources: `khosgk://huong-dan`, `khosgk://index`, `khosgk://sach/<ma_sach>/muc-luc`. Prompt mẫu:
`soan-giao-an-theo-sgk` (môn, lớp, bài).

## 5. Quy trình mẫu và cách trích dẫn

**Soạn kế hoạch bài dạy** (kết hợp skill `soan-ke-hoach-bai-day`):
`sgk_danh_sach(mon, lop)` → `sgk_muc_luc(ma_sach)` → `sgk_yeu_cau_can_dat(ma_sach, bai_id)` (mục tiêu +
gợi ý SGV) → `sgk_bai(ma_sach, bai_id, phan="tat-ca")` → soạn; cần ảnh minh họa cho phiếu học tập thì
`sgk_hinh` + tải theo mục 5.1.
**Ra đề** (skill `ra-de-kiem-tra`): với từng bài trong phạm vi → `sgk_bai(..., phan="bai-tap")` +
`phan="ghi-nho"`; thêm `sgk_danh_sach(loai="sbt")` → bài tương ứng trong SBT làm ngân hàng câu hỏi.
**Bài trình chiếu / mô phỏng**: `sgk_bai(..., phan="hoat-dong")` để bám tiến trình và hiện tượng đúng
sách; hình thí nghiệm lấy từ `sgk_hinh_theo_bai`.

**Trích dẫn** — mọi nội dung lấy từ kho phải ghi nguồn theo mẫu:
`Theo SGK Khoa học tự nhiên 9 (Kết nối tri thức với cuộc sống), Bài 8. Thấu kính, tr.40–41`
(ngắn gọn trong văn bản: `Theo SGK <tên sách> tr.<trang_in>`). Với SGV/SBT ghi rõ `Theo SGV ...`/`Theo SBT ...`.
Trong sản phẩm bàn giao (docx/pptx) đặt nguồn dưới hình hoặc cuối đoạn trích; không trích nguyên văn
dài quá mức cần thiết cho bài dạy.

### 5.1. Tải hình từ `url_tai` để chèn vào docx/pptx/html

`url_tai` là URL ký sẵn dạng `https://aword.vn/khosgk/f/<het_han>/<chu_ky>/<ma_sach>/<tep>` — **không cần
header**, sống **30 phút** → tải NGAY khi nhận, không lưu URL để dùng sau. Tải bằng PowerShell (Bash tool
trên Windows gọi `powershell.exe`):

```powershell
$dich = "HOC LIEU TRUC QUAN/<Môn>/hinh"; New-Item -ItemType Directory -Force $dich | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri "<url_tai>" -OutFile "$dich/<hinh_id>.jpg" -TimeoutSec 30
```
(hoặc `curl.exe -L -sS --max-time 30 -o "<dich>/<hinh_id>.jpg" "<url_tai>"`). Đặt tên tệp theo `hinh_id`
(`p0041_H5.jpg`), rồi chèn: docx → `document.add_picture(path, width=Inches(4.5))` (skill `docx`), pptx →
`slide.shapes.add_picture(...)` (skill `pptx`), html → `<img src="hinh/p0041_H5.jpg">` (chép tệp cạnh html).
Dưới mỗi hình ghi `so_hinh` + `chu_thich` + nguồn trích dẫn. Ảnh JPEG q85 nguyên độ phân giải trang,
thường 40–60 KB — không cần nén lại.

## 6. Chưa kích hoạt / hết hạn — hướng dẫn thanh toán QR ngay trong chat

Khi công cụ tri thức trả `{"loi":"chua_kich_hoat"|"het_han", "huong_dan": ...}` hoặc người dùng muốn
kích hoạt/gia hạn/mua bản cập nhật lớn:
1. Gọi `sgk_trang_thai` → nói rõ: mã máy, trạng thái, hạn dùng (nếu có), giá.
2. Gọi `sgk_thanh_toan()` (hoặc `loai="gia_han"`/`"cap_nhat_lon"` theo ý người dùng). Trình bày trong chat,
   đủ và đúng thứ tự:
   - Số tiền; ngân hàng, số tài khoản, chủ tài khoản;
   - **Nội dung chuyển khoản CHÍNH XÁC** (ví dụ `KHOSGK 12345678`) — nhấn mạnh phải ghi đúng để hệ thống tự
     khớp; thiếu/sai nội dung thì phải chờ quản trị đối soát tay;
   - Ảnh QR: nếu kết quả có phần ảnh, hiện ngay; luôn kèm `qr_url` (mở bằng trình duyệt để quét bằng app
     ngân hàng) và `trang_thanh_toan` (trang tự làm mới trạng thái mỗi 5 giây);
   - Hạn của đơn (`het_han_don`, 24 giờ).
3. Sau khi người dùng báo đã chuyển: `sgk_kiem_tra_thanh_toan(ma_don)`; hệ thống đối soát email báo có
   mỗi phút → thường 1–3 phút. `da_thanh_toan` → chúc mừng, nêu `het_han_ban_quyen`, làm tiếp việc đang dở.
   `xem_xet` → tiền đã về nhưng lệch số tiền/nội dung: quản trị sẽ duyệt tay, chờ thông báo trong chat.
   `cho_thanh_toan` quá 10 phút → nhắc kiểm tra lại nội dung CK; vẫn không được thì liên hệ hỗ trợ.
4. Không hứa hẹn thời gian xử lý ngoài thông tin `huong_dan` của máy chủ; không tự bịa số tài khoản.

## 7. Thông báo từ kho

Mọi kết quả `sgk_*` có thể kèm `thong_bao: [{id, muc_do, noi_dung, ngay}]` (thanh toán thành công, sắp
hết hạn 15/3 ngày, hết hạn, bản cập nhật lớn có phí, sách mới, thông báo quản trị). Quy tắc: **nhắc người
dùng NGUYÊN VĂN `noi_dung` ở đầu câu trả lời** rồi mới trả lời việc chính; loại `bat_buoc` (hết hạn, khóa)
lặp lại cho đến khi xử lý — hướng dẫn xử lý ngay (mục 6). Hook đầu phiên của AWord cũng in dòng
`KHO SGK: ...` vào ngữ cảnh — xử lý như trên. Người dùng nói "kiểm tra trạng thái Kho SGK" → `sgk_trang_thai`
và tóm tắt đầy đủ (mã máy, trạng thái, hạn, phiên bản kho, thông báo).

---
name: cap-nhat-quy-dinh-nam-hoc
description: Cập nhật tri thức quy định cho NĂM HỌC MỚI và quản lý hồ sơ - sổ sách giáo viên. Tự tìm trên web các văn bản mới (hướng dẫn nhiệm vụ năm học của Bộ/Sở, thông tư/công văn sửa đổi - thay thế), nhận văn bản người dùng gửi vào, KIỂM HIỆU LỰC và loại bỏ quy định lỗi thời qua "sổ hiệu lực" - nguồn chân lý mọi skill khác phải tra trước khi viện dẫn. Nắm danh mục hồ sơ - sổ sách bắt buộc của giáo viên để soạn khi cần. Dùng khi người dùng nói "cập nhật quy định", "quy định năm học mới", "văn bản mới", "kiểm tra còn hiệu lực", "làm hồ sơ/sổ sách", "kế hoạch giáo dục của giáo viên", "kế hoạch tổ chuyên môn", hoặc gửi một văn bản để app ghi nhớ dùng cho năm học.
---

# Cập nhật quy định năm học & hồ sơ - sổ sách giáo viên

Skill này giữ cho tri thức pháp lý của AWord (vai Giáo viên) LUÔN ĐÚNG THỜI ĐIỂM: quy định mới được nạp,
quy định lỗi thời bị loại khỏi vòng viện dẫn. Văn bản quy phạm pháp luật và văn bản hành chính
KHÔNG có bản quyền (Luật SHTT Điều 15) → được phép tải, lưu, dùng chung hợp pháp.

## Nguyên tắc tối quan trọng — SỔ HIỆU LỰC là nguồn chân lý

Tri thức đóng gói sẵn trong app (references các skill) đúng tại thời điểm phát hành, nhưng quy
định thay đổi theo năm. Vì vậy có một LỚP PHỦ trong workspace người dùng, ưu tiên CAO HƠN tri
thức đóng gói:

- `HO SO CUA TOI/QUY DINH NAM HOC/_SO-HIEU-LUC.md` — bảng: văn bản HẾT hiệu lực → văn bản THAY THẾ.
- **MỌI skill (soạn giáo án, ra đề, thẩm định...) PHẢI tra sổ này TRƯỚC khi viện dẫn bất kỳ văn
  bản nào.** Nếu số hiệu định trích có trong cột "hết hiệu lực" → KHÔNG được dùng, phải dùng văn
  bản thay thế ghi ở cột bên. Sổ hiệu lực thắng cả reference đóng gói.
- Không có sổ (chưa từng cập nhật) → dùng tri thức đóng gói như cũ, và GỢI Ý người dùng chạy
  cập nhật đầu năm học.

## Bố cục tri thức trong workspace (lớp phủ theo năm học)

```
HO SO CUA TOI/QUY DINH NAM HOC/
  _CHI-MUC.md            Chỉ mục tổng: văn bản đang hiệu lực theo nhóm, trỏ tới file tóm tắt.
  _SO-HIEU-LUC.md        Sổ hiệu lực: hết hiệu lực → thay thế (nguồn chân lý loại bỏ lỗi thời).
  _GUI-VAO/              Người dùng THẢ FILE văn bản (PDF/docx) vào đây để app nạp.
  <nam-hoc>/             VD 2026-2027/: từng văn bản một file tóm tắt (số hiệu, ngày, trích yếu,
                         điều khoản quan trọng, nguồn tải).
```

**TẠO CÂY THƯ MỤC TRƯỚC (bắt buộc):** app KHÔNG tự tạo `QUY DINH NAM HOC/` lúc first-run (chỉ tạo
7 thư mục chuẩn). Vì vậy TRƯỚC khi hướng dẫn người dùng thả file hay ghi chỉ mục, LUÔN tạo nếu
chưa có: `HO SO CUA TOI/QUY DINH NAM HOC/` và `HO SO CUA TOI/QUY DINH NAM HOC/_GUI-VAO/` (dùng
lệnh tạo thư mục; không báo lỗi nếu đã tồn tại).

Xác định NĂM HỌC hiện tại theo ngày thực khi chạy: năm học Việt Nam bắt đầu ~tháng 9; nếu đang
từ tháng 6 trở đi thì năm học sắp tới là (năm nay)-(năm sau). Không chắc → HỎI người dùng.

## Quy trình A — Tự tìm quy định mới trên web (khi người dùng yêu cầu cập nhật)

1. Xác định năm học cần cập nhật (hỏi nếu không chắc).
2. WebSearch + WebFetch các nhóm sau (ưu tiên nguồn chính thống: moet.gov.vn, chinhphu.vn,
   vanban.chinhphu.vn, cổng Sở GD&ĐT tỉnh; thuvienphapluat chặn 403 nhưng CDN PDF của nó không chặn):
   - **Hướng dẫn nhiệm vụ năm học** của Bộ GD&ĐT (theo cấp: GDTH, GDTrH, GDTX) cho năm học đó,
     và của Sở GD&ĐT tỉnh người dùng (hỏi tỉnh nếu chưa biết).
   - **Thông tư/công văn MỚI hoặc SỬA ĐỔI** về: đánh giá học sinh (TT 22/2021, TT 27/2020,
     TT 26/2025...), kế hoạch giáo dục/dạy học (CV 5512, CV 2345, CV 5555), điều lệ trường,
     hồ sơ sổ sách, khung năng lực số (TT 02/2025), giáo dục địa phương, tích hợp.
   - Văn bản THAY THẾ/BÃI BỎ văn bản cũ (tìm cụm "thay thế", "bãi bỏ", "hết hiệu lực").
3. Với MỖI văn bản tìm được: xác minh ĐANG hiệu lực (đối chiếu ≥2 nguồn; tìm văn bản thay thế
   nếu đã hết hiệu lực), tải TOÀN VĂN, ghi 1 file tóm tắt (số hiệu + ngày ban hành + cơ quan +
   trích yếu + các điều khoản quan trọng + đường dẫn nguồn) vào thư mục `<nam-hoc>/`.
4. Cập nhật `_CHI-MUC.md` và `_SO-HIEU-LUC.md`: mỗi văn bản cũ bị thay → ghi 1 dòng
   "hết hiệu lực → thay bằng ...". TRÌNH danh sách thay đổi cho người dùng xác nhận trước khi chốt.
5. Ghi tóm tắt kết quả cho người dùng: đã thêm mấy văn bản, loại mấy văn bản lỗi thời.

## Quy trình B — Người dùng gửi văn bản cho app

1. Người dùng thả file vào `HO SO CUA TOI/QUY DINH NAM HOC/_GUI-VAO/` (hoặc đính kèm @ trong chat).
2. Đọc bằng skill `doc-van-ban-local` (PDF scan → pdf_sang_anh.py đọc bằng thị giác; docx/xlsx theo loại).
3. Trích: số hiệu, ngày, cơ quan ban hành, trích yếu, phạm vi áp dụng, văn bản bị thay thế (nếu ghi).
4. KIỂM HIỆU LỰC: có thể cần tra web xác nhận còn hiệu lực + tìm văn bản thay thế nếu người dùng
   gửi nhầm bản cũ — báo rõ nếu phát hiện văn bản đã hết hiệu lực.
5. Ghi vào `<nam-hoc>/` + cập nhật `_CHI-MUC.md` + `_SO-HIEU-LUC.md`; chuyển file gốc vào thư mục
   năm học (dọn `_GUI-VAO/`). Báo người dùng đã nạp gì, thay thế gì.

## Quy trình C — Loại bỏ quy định lỗi thời (chạy cùng A/B, và khi rà soát định kỳ)

- Mỗi lần thêm văn bản mới có mệnh đề "thay thế/bãi bỏ" → GHI NGAY dòng tương ứng vào `_SO-HIEU-LUC.md`.
- Rà định kỳ (đầu năm học): duyệt `_CHI-MUC.md`, tra hiệu lực từng văn bản trọng yếu; văn bản đã
  hết hiệu lực chuyển xuống sổ hiệu lực kèm văn bản thay thế.
- TUYỆT ĐỐI không xóa file gốc (giữ để tra cứu lịch sử) — chỉ ĐÁNH DẤU hết hiệu lực trong sổ.

## Danh mục HỒ SƠ - SỔ SÁCH bắt buộc của giáo viên (để soạn khi cần)

Căn cứ Điều lệ trường (TT 32/2020/TT-BGDĐT THCS-THPT ngày 15/9/2020; TT 28/2020/TT-BGDĐT tiểu học
ngày 04/9/2020) và các văn bản giảm hồ sơ sổ sách, chỉ đạo dùng hồ sơ điện tử (rà web bản mới
nhất qua Quy trình A trước khi khẳng định danh mục). Hồ sơ cơ bản của GIÁO VIÊN:

| Hồ sơ/sổ | Căn cứ khung | Cách làm trong AWord |
|---|---|---|
| Kế hoạch giáo dục của giáo viên (trong năm học) | Phụ lục III CV 5512 | Xem skill/nghiên cứu kế hoạch chuyên môn; dựng từ template docx |
| Kế hoạch bài dạy (giáo án) | Phụ lục IV CV 5512 / PL3 CV 2345 | skill `soan-ke-hoach-bai-day` |
| Sổ theo dõi, đánh giá học sinh | TT 22/2021 (THCS-THPT), TT 27/2020 (TH) | Dựng bảng theo mẫu thông tư hiện hành (kiểm sổ hiệu lực) |
| Sổ chủ nhiệm (nếu là GVCN) | Điều lệ trường | Dựng từ mẫu; nội dung theo hướng dẫn của trường |
| Kế hoạch dạy học của tổ chuyên môn | Phụ lục I CV 5512 | Dựng từ template; nghiên cứu kế hoạch chuyên môn |
| Kế hoạch tổ chức hoạt động giáo dục của tổ | Phụ lục II CV 5512 | Như trên |

Khi người dùng cần LÀM một loại hồ sơ: (1) tra `_SO-HIEU-LUC.md` để dùng ĐÚNG văn bản còn hiệu
lực; (2) lấy đúng khung/mẫu — cấu trúc đầy đủ từng cột của Phụ lục I/II/III CV 5512 và các phụ lục
CV 2345 ở `references/ke-hoach-chuyen-mon-pho-thong.md` (đọc đúng mục cần, đủ để dựng template);
(3) dựng file bằng skill `docx`/`the-thuc-van-ban-theo-nd30`, GIỮ thể thức mẫu, điền nội dung thật.
Quan hệ duyệt (bám file trên): trung học — Tổ lập PL I+II, Hiệu trưởng duyệt; GV lập PL III, Tổ
trưởng ký; tiểu học — KHGD nhà trường ban hành trước 31/8, không có KHGD cá nhân kiểu PL III.
Điều 21 hai Điều lệ (TT 32/2020, TT 28/2020) + Chỉ thị 138/CT-BGDĐT là "trần" hồ sơ — KHÔNG đẻ
thêm loại ngoài danh mục. Danh mục trên là KHUNG — số lượng cụ thể theo hướng dẫn năm học của
Sở/trường (xu hướng GIẢM mạnh hồ sơ giấy, tăng hồ sơ điện tử) → luôn kiểm bản mới.

## Ghi chú tích hợp
- Đầu mỗi năm học, nhắc người dùng (nhẹ nhàng, 1 lần) chạy cập nhật quy định.
- Thư mục giáo viên trong AWord: `Documents\AWord\GIAO VIEN\` — mọi đường dẫn `HO SO CUA TOI/...`
  ở trên tính từ thư mục đó (nếu thư mục làm việc đang mở là `Documents\AWord` thì thêm tiền tố `GIAO VIEN/`).
- Kết quả cập nhật là LỚP PHỦ workspace, KHÔNG sửa references đóng gói của app (references là bản
  nền theo phiên bản app; sổ hiệu lực phủ lên khi cần).
- Mọi khẳng định quy định phải kèm SỐ HIỆU + NGÀY; văn bản hết hiệu lực phải nêu văn bản thay thế.

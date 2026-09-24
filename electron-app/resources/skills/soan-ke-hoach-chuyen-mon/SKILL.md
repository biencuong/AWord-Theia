---
name: soan-ke-hoach-chuyen-mon
description: Soạn kế hoạch chuyên môn cấp tổ và cấp trường — kế hoạch dạy học môn học của tổ chuyên môn (Phụ lục I CV 5512), kế hoạch tổ chức hoạt động giáo dục của tổ (Phụ lục II), kế hoạch giáo dục của giáo viên (Phụ lục III), kế hoạch giáo dục nhà trường tiểu học (Phụ lục 1 CV 2345) và kế hoạch dạy học môn học khối lớp tiểu học (Phụ lục 2 CV 2345). Dùng khi người dùng nói "kế hoạch tổ chuyên môn", "phụ lục 1/2/3", "phân phối chương trình", "PPCT", "kế hoạch giáo dục nhà trường", "kế hoạch giáo dục của giáo viên", "kế hoạch năm học của tổ".
---

# Kế hoạch chuyên môn (tổ chuyên môn và nhà trường)

Khác với `soan-ke-hoach-bai-day` (giáo án một bài, viết văn xuôi sư phạm): kế hoạch chuyên môn là **văn bản
bảng biểu chạy suốt năm học** — phân phối chương trình hàng trăm dòng, số liệu đặc điểm tình hình, lịch
kiểm tra định kỳ. Cách làm hoàn toàn khác: thu thập dữ liệu → dựng bảng → **kiểm tra chéo số liệu**.

## Năm loại kế hoạch (chọn đúng loại trước khi làm)

| Loại | Khung | Cấp |
|---|---|---|
| KH dạy học môn học của tổ chuyên môn | **PL I CV 5512** | THCS, THPT, GDTX |
| KH tổ chức hoạt động giáo dục của tổ | **PL II CV 5512** | THCS, THPT, GDTX |
| KH giáo dục của giáo viên | **PL III CV 5512** | THCS, THPT, GDTX |
| KH giáo dục nhà trường | **PL 1 CV 2345** (kèm bảng 1.1–1.4) | Tiểu học |
| KH dạy học môn học khối lớp | **PL 2 CV 2345** | Tiểu học |

GDTX **không có mẫu riêng** — dùng khung 5512 và đổi nhãn: Trường → Trung tâm, học sinh → học viên,
Hiệu trưởng → Giám đốc.

## Nạp tri thức CHỌN LỌC

Đọc ĐÚNG file theo loại kế hoạch, không nạp cả bốn:

- `references/cv-5512-phu-luc-1-2-3.md` — nguyên văn 3 khung PL I/II/III + cách điền + quy tắc kiểm chéo số tiết.
- `references/cv-2345-phu-luc-1-2.md` — nguyên văn 2 khung tiểu học + 4 bảng phụ.
- `references/to-chuyen-mon-va-ho-so.md` — tổ chuyên môn (Điều 14, 21 TT 32/2020 và TT 28/2020), sinh hoạt
  chuyên môn theo nghiên cứu bài học, **giới hạn hồ sơ bắt buộc**, quan hệ và thời hạn duyệt giữa các kế hoạch.
- `references/can-cu-phap-ly.md` — căn cứ pháp lý và các điểm mới cần kiểm hiệu lực mỗi năm.

## Template có sẵn trong `templates/`

| Tệp | Dùng cho | Trạng thái |
|---|---|---|
| `khdh-to-chuyen-mon-5512-pl1.docx` | PL I — KH dạy học môn học của tổ (trung học, GDTX) | ✅ có |
| `kh-hoat-dong-giao-duc-5512-pl2.docx` | PL II — KH tổ chức hoạt động giáo dục của tổ | ✅ có |
| `khgd-giao-vien-5512-pl3.docx` | PL III — KH giáo dục của giáo viên | ✅ có |
| `khgd-nha-truong-2345-pl1.docx` | PL 1 CV 2345 — KH giáo dục nhà trường (tiểu học) | ✅ có — đủ khung I–VI + 4 bảng phụ 1.1 (17 cột: 5 lớp × Tổng/HK1/HK2) · 1.2 · 1.3 · 1.4 |
| `khdh-mon-hoc-2345-pl2.docx` | PL 2 CV 2345 — KH dạy học môn học khối lớp (tiểu học) | ✅ có — khung I–IV, bảng 2 tầng tiêu đề lặp theo môn |

**Cả năm template đều khổ ngang A4**, có sẵn khối đầu (Trường/Tổ — Quốc hiệu/Tiêu ngữ), các bảng đúng
số cột theo nguyên văn phụ lục, và khối ký. **Điền vào bản sao, không dựng file mới** — dựng mới sẽ sai
thể thức và thiếu cột.

Điểm khác giữa hai hệ: **tiểu học KHÔNG có kế hoạch giáo dục cá nhân kiểu Phụ lục III** — chuỗi là
Nhà trường (PL 1) → Tổ/khối (PL 2) → KHBD; giáo viên chủ nhiệm chỉ lập **kế hoạch lớp học** (không có mẫu cứng).

Sinh lại template khi khung thay đổi: `python scripts/tao_template.py`

## Quy trình (bắt buộc theo thứ tự)

1. **Xác định loại kế hoạch, cấp học, môn, khối.** Hỏi TỪNG CÂU MỘT nếu thiếu.
2. **Thu thập số liệu thật** — không bịa: số lớp, số học sinh, số giáo viên bộ môn, phòng học bộ môn, thiết bị
   dạy học, số tuần thực dạy của trường (mặc định 35 nhưng **phải hỏi**, trường có thể dạy khác).
3. **Dựng bảng theo khung**, dùng template trong `templates/` nếu có (giữ đúng thể thức); chưa có template cho
   loại đó thì dựng bảng trực tiếp theo nguyên văn khung trong `references/`.
4. **KIỂM TRA CHÉO số liệu** (bước quan trọng nhất — xem mục dưới).
5. **Trình bày và bàn giao**: nêu rõ số liệu nào người dùng cần xác nhận, chỗ nào còn giả định, và gợi ý
   `tham-dinh-ho-so-day-hoc` để rà độc lập trước khi nộp.

## Kiểm tra chéo — bắt buộc, không bỏ qua

| Kiểm | Cách |
|---|---|
| **Tổng số tiết** | Cộng PPCT phải **khớp** tổng số tiết môn/khối theo chương trình 2018 — kể cả tiết ôn tập và kiểm tra. Lệch một tiết là sai |
| **Số tuần** | Tổng tiết ÷ số tiết/tuần phải khớp số tuần thực dạy của trường |
| **Lịch kiểm tra định kỳ** | THCS–THPT theo **TT 22/2021** (giữa kỳ + cuối kỳ mỗi học kỳ); GDTX theo **TT 43/2021**; tiểu học đánh giá theo **TT 27/2020** và **PL 2 tiểu học KHÔNG có mục kiểm tra định kỳ** — không tự thêm vào |
| **Yêu cầu cần đạt** | Phải khớp chương trình môn học, không chép của khối/lớp khác |
| **Thời hạn duyệt** | Thứ tự và thời hạn giữa các loại kế hoạch — xem `references/to-chuyen-mon-va-ho-so.md` |

## Chống sai phổ biến (đúc kết sẵn — theo mục 12.6 tài liệu gốc)

- **PPCT cộng đúng tổng tiết**, luôn hỏi số tuần thực dạy (mặc định 35, nhưng hỏi).
- **THPT: hỏi tổ hợp môn lựa chọn và cụm chuyên đề** trước khi sinh mục chuyên đề lựa chọn (PL I mục II.2).
- **Không sinh thêm loại hồ sơ ngoài Điều 21** hai Điều lệ (vi phạm Chỉ thị 138 về cắt giảm hồ sơ) — ví dụ
  không tự tạo "sổ báo giảng", "kế hoạch tháng của giáo viên" như văn bản bắt buộc. Người dùng yêu cầu thêm
  thì làm, nhưng **nói rõ đây không phải hồ sơ bắt buộc**.
- **Mẫu là "tham khảo, vận dụng"** (CV 2613) — cho phép thêm/bớt cột phụ, nhưng cảnh báo khi việc bớt làm mất
  nội dung mà kiểm tra chéo cần.
- **Số hiệu văn bản đổi mỗi năm** — không ghi cứng trong skill; tra `cap-nhat-quy-dinh-nam-hoc` (sổ hiệu lực)
  trước khi viện dẫn, và nêu rõ nếu văn bản đã bị thay thế.

## Liên kết skill khác

- `soan-ke-hoach-bai-day` — đọc PL III/PL 2 của người dùng (nếu có trong `HO SO CUA TOI/`) để tự điền tên bài,
  số tiết, thời điểm vào giáo án.
- `ra-de-kiem-tra` — mục kiểm tra định kỳ trong PL I là **đầu vào trực tiếp** cho ma trận – bản đặc tả.
- `cap-nhat-quy-dinh-nam-hoc` — tra sổ hiệu lực và các văn bản đổi hằng năm.
- `tham-dinh-ho-so-day-hoc` — rà độc lập kế hoạch tổ trước khi nộp.
- `docx` — kỹ thuật tạo file (dùng cùng template, không dựng mới từ đầu).

---
name: soan-bai-trinh-chieu
description: Soạn bài trình chiếu (.pptx) cho bài dạy — cấu trúc slide bám đúng tiến trình các hoạt động của kế hoạch bài dạy đã có, tuân thủ quy tắc sư phạm (chữ to theo cấp học, 1 ý/slide, câu hỏi trước đáp án). Dùng khi người dùng nói "bài trình chiếu", "slide bài giảng", "powerpoint bài dạy", "làm slide cho giáo án/bài này".
---

# Soạn bài trình chiếu cho bài dạy

Kỹ thuật dựng file .pptx (python-pptx, template, font, layout) làm theo skill **`pptx`** chính thống;
phần NHÌN (bộ màu, phông, bố cục từng slide, biểu đồ, ảnh, rà lỗi trình bày) theo skill
**`thiet-ke-trinh-chieu`** —
skill này CHỈ bổ sung LUẬT SƯ PHẠM, nằm trong 3 file references (đọc CHỌN LỌC đúng phần cần):
- `references/quy-tac-slide-su-pham.md` — cỡ chữ theo cấp, cấu trúc, checklist rà.
- `references/hieu-ung-trinh-tu-su-pham.md` — TRÌNH TỰ THỂ HIỆN + HIỆU ỨNG theo LOẠI KIẾN THỨC
  (quy nạp, POE, công thức từng bước, đọc hiểu, từ vựng, so sánh, luyện tập, củng cố...) kèm
  lý giải sư phạm và kỹ thuật thực hiện (tách slide mặc định / XML `<p:timing>` khi cần hiệu ứng
  thật) — Grep đúng mục B khớp dạng nội dung của từng hoạt động.
- `references/bo-cuc-mau-chu.md` — bố cục lưới 1/3 – tỷ lệ vàng 62/38, thang 3 bậc cỡ chữ,
  màu theo chức năng, tương phản ≥ 4,5:1.

## Quy trình

1. **Tìm nguồn**: nếu người dùng vừa soạn KHBD hoặc nói "cho bài này" — đọc đúng file KHBD trong
   `KE HOACH BAI DAY/<Môn>/Lop <X>/`, KHÔNG hỏi lại nội dung. Chưa có KHBD → đề nghị soạn KHBD
   trước (skill `soan-ke-hoach-bai-day`) hoặc người dùng cung cấp nội dung.
2. **Dàn slide bám tiến trình KHBD** (mặc định, có thể điều chỉnh theo bài):
   ① Trang bìa: tên bài, môn – lớp, giáo viên; ② Khởi động/Mở đầu (tình huống, trò chơi, câu hỏi);
   ③ Hình thành kiến thức (mỗi đơn vị kiến thức 1–3 slide, hình ảnh/sơ đồ thay chữ);
   ④ Luyện tập (bài tập — MỖI câu hỏi 1 slide, đáp án ở slide SAU hoặc animation click);
   ⑤ Vận dụng (nhiệm vụ thực tiễn); ⑥ Củng cố – dặn dò. Tiểu học/mầm non thêm yếu tố trò chơi,
   hình ảnh sinh động; mầm non slide gần như toàn hình.
3. **Áp trình tự thể hiện theo loại kiến thức**: ưu tiên đọc BẢNG PHÂN TÍCH BÀI DẠY ở đầu mục III
   của KHBD (đơn vị kiến thức → dạng nội dung → PPDH đã chọn) — slide phải THỂ HIỆN ĐÚNG phương
   pháp đã chốt trong giáo án, không tự đổi. KHBD không có bảng thì tự xác định dạng nội dung
   từng hoạt động (khái niệm quy nạp? thí nghiệm POE? công thức từng bước? đọc hiểu?...) →
   tra đúng mục B trong `hieu-ung-trinh-tu-su-pham.md` → áp thứ tự xuất hiện + hiệu ứng tương ứng. Mặc định thực hiện
   bằng TÁCH SLIDE (tương thích mọi máy trường); chỉ chèn XML hiệu ứng thật khi người dùng yêu cầu.
4. **Dựng file** theo skill `pptx`; bố cục + cỡ chữ + màu theo `bo-cuc-mau-chu.md`; theme thống
   nhất toàn bài (có thể dùng skill `theme-factory`).
5. **Ghi chú người nói kiểu "giáo sư hướng dẫn" cho MỌI slide** (bắt buộc — khung 4 phần ở mục D
   của `hieu-ung-trinh-tu-su-pham.md`): bấm khi nào ▶, nói/hỏi gì 🗣, VÌ SAO thiết kế vậy 🎓
   (lý giải sư phạm cho người dạy), bẫy thường gặp ⚠. Đây là phần biến bộ slide thành tài liệu
   bồi dưỡng phương pháp cho chính giáo viên — không được bỏ.
6. **Tự rà theo 2 checklist** (`quy-tac-slide-su-pham.md` + mục D `bo-cuc-mau-chu.md`) rồi báo
   kết quả ngắn gọn.
7. **Lưu** `BAI TRINH CHIEU/<Môn>/Lop <X>/Slide_<tên-bài>.pptx`, nêu đường dẫn.

## Quy tắc cứng (vi phạm = phải sửa trước khi bàn giao)

- Cỡ chữ nội dung: ≥ 28pt tiểu học/mầm non, ≥ 24pt THCS/THPT/GDTX; tiêu đề ≥ 36pt.
- Tối đa 6 dòng chữ/slide, mỗi dòng ≤ 12 từ; 1 ý tưởng/slide.
- Câu hỏi tương tác luôn đứng TRƯỚC đáp án; đáp án không lộ cùng lúc với câu hỏi.
- Không nhồi nguyên đoạn văn từ KHBD/SGK lên slide — slide là điểm tựa nói, không phải giáo án chiếu.
- Tiếng Việt đầy đủ dấu; không emoji trong slide học thuật (trừ tiểu học/mầm non dùng chừng mực).

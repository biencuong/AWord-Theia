---
name: soan-ke-hoach-bai-day
description: Soạn kế hoạch bài dạy (giáo án) đúng khung quy định cho mọi cấp học Việt Nam — tiểu học theo Phụ lục 3 CV 2345/BGDĐT-GDTH, THCS/THPT/GDTX theo Phụ lục IV CV 5512/BGDĐT-GDTrH, mầm non theo Chương trình GDMN — bám yêu cầu cần đạt CTGDPT 2018 và SGK Kết nối tri thức, tự kiểm theo 12 tiêu chí CV 5555. Dùng khi người dùng yêu cầu "soạn giáo án", "kế hoạch bài dạy", "KHBD", "soạn bài" kèm tên bài/môn/lớp, hoặc muốn sửa/nâng cấp một giáo án có sẵn.
---

# Soạn kế hoạch bài dạy (giáo án)

## Nguyên tắc nạp tri thức CHỌN LỌC (đọc trước khi làm)

References của skill phủ CẢ 5 nhóm (mầm non → GDTX) và mọi môn — mỗi lần soạn CHỈ ĐỌC đúng phần cần:
- Khung KHBD: đọc ĐÚNG MỘT file theo cấp học của người dùng (bảng dưới). KHÔNG đọc các khung khác.
- `references/ppdh-bo-mon.md`: chia mục theo môn — dùng Grep tìm đúng mục môn đang soạn, chỉ đọc mục đó.
- `references/anh-xa-noi-dung-ppdh-danh-gia.md`: chỉ đọc hàng khớp dạng nội dung bài.
- Các file chuyên đề (`giao-duc-stem.md`, `khung-nang-luc-so.md`) CHỈ đọc khi bài dạy thực sự cần
  (bài STEM / bài có hoạt động dùng công nghệ số).
- Nếu workspace có `HO SO CUA TOI/tri-thuc-cua-toi.md` (chỉ mục tri thức): theo đúng chỉ mục đó.

## Chọn khung theo cấp học

| Cấp/nhóm | Khung bắt buộc | File reference | Template |
|---|---|---|---|
| Tiểu học | Phụ lục 3, CV 2345/BGDĐT-GDTH (07/6/2021) | `references/cv-2345-phu-luc-3.md` | `templates/khbd-tieu-hoc-2345.docx` |
| THCS, THPT | Phụ lục IV, CV 5512/BGDĐT-GDTrH (18/12/2020) | `references/cv-5512-phu-luc-4.md` | `templates/khbd-thcs-thpt-5512.docx` |
| GDTX (THCS/THPT) | Khung 5512 + đặc thù học viên người lớn | `cv-5512-phu-luc-4.md` + `gdtx-dac-thu.md` | `templates/khbd-thcs-thpt-5512.docx` |
| Mầm non | Khung hoạt động học Chương trình GDMN | `references/khung-mam-non.md` | `templates/khbd-mam-non.docx` |

## Quy trình soạn (bắt buộc theo thứ tự)

1. **Thu thập bối cảnh**: đọc `HO SO CUA TOI/` + `BO NHO/dai-han.md` (thói quen soạn của giáo viên).
   Xác định: môn, lớp, tên bài, số tiết, vị trí bài trong chương (tra PPCT trong `TU LIEU MON HOC/`
   nếu có). Thiếu thông tin cốt lõi → AskUserQuestion TỪNG CÂU MỘT.
2. **Lấy chuẩn**: yêu cầu cần đạt của bài — tìm `TU LIEU MON HOC/<Môn>/yeu-cau-can-dat-lop-<X>.md`;
   không có thì tra web (chương trình môn học TT 32/2018/TT-BGDĐT) rồi LƯU về đó, ghi nguồn.
   Mầm non: mục tiêu lĩnh vực phát triển theo độ tuổi (trong `khung-mam-non.md`).
3. **Bám SGK**: tìm bài trong `TU LIEU MON HOC/<Môn>/SGK/` (SGK Kết nối tri thức với cuộc sống —
   bộ thống nhất toàn quốc từ 2026-2027 theo QĐ 3588/QĐ-BGDĐT; PDF scan đọc bằng thị giác, chỉ đọc
   đúng trang của bài). Không có file SGK → soạn theo yêu cầu cần đạt và GHI RÕ "chưa đối chiếu SGK"
   cuối sản phẩm.
4. **Chọn PPDH/KTDH**: Grep đúng mục môn trong `ppdh-bo-mon.md` + tra `anh-xa-noi-dung-ppdh-danh-gia.md`
   theo dạng nội dung bài; điều chỉnh theo thiết bị/đặc thù lớp trong hồ sơ. Bài có tiềm năng STEM
   (chế tạo, thử nghiệm, tích hợp liên môn) → hỏi người dùng có muốn thiết kế theo bài học STEM
   5 hoạt động không (đọc `giao-duc-stem.md`).
5. **Năng lực số**: nếu bài có hoạt động học sinh dùng công nghệ (tra cứu, mô phỏng, sản phẩm số) →
   ghi mục tiêu năng lực số của học sinh theo khung TT 02/2025/TT-BGDĐT (đọc `khung-nang-luc-so.md`,
   chỉ mục cách tích hợp).
6. **Học từ mẫu tốt gần nhất**: nếu `KE HOACH BAI DAY/<Môn>/` đã có KHBD cùng môn (ưu tiên cùng
   khối, mới nhất, không bị ghi lỗi trong `BO NHO/kinh-nghiem.md`) — đọc lướt MỘT file đó làm
   mẫu văn phong/độ chi tiết (nhờ cache nên rẻ); KHÔNG sao chép nội dung, chỉ học giọng và mức
   chi tiết mà giáo viên này đã chấp nhận.
7. **Soạn trên BẢN SAO template**: copy đúng template theo bảng trên về
   `KE HOACH BAI DAY/<Môn>/Lop <X>/KHBD_<tên-bài-không-dấu>.docx` rồi ĐIỀN bằng python-docx
   (kỹ thuật theo skill `docx`). TUYỆT ĐỐI không dựng file mới từ đầu, không đổi khung/đề mục.
   Nội dung phải CỤ THỂ theo bài (câu hỏi thật, số liệu thật, hoạt động thật) — không viết chung chung
   kiểu "GV đặt câu hỏi, HS trả lời".
8. **Tự kiểm theo CV 5555**: rà từng tiêu chí trong `references/cv-5555-tieu-chi.md` (checklist);
   mầm non thay bằng tiêu chí "lấy trẻ làm trung tâm, chơi mà học" trong `khung-mam-non.md`.
   Sửa các điểm chưa đạt rồi báo người dùng kết quả rà ngắn gọn (đạt/chưa đạt tiêu chí nào, đã sửa gì).
9. **Bàn giao**: nêu đường dẫn file, các giả định đã dùng, phần giáo viên nên rà lại
   (đặc biệt khi chưa đối chiếu SGK). Gợi ý bước tiếp: "làm bài trình chiếu cho bài này?" hoặc
   "thẩm định độc lập trước khi nộp?" (skill `tham-dinh-ho-so-day-hoc`).

## Lưu ý chất lượng

- Khung 5512: đủ 4 hoạt động (Mở đầu/Xác định vấn đề → Hình thành kiến thức mới → Luyện tập →
  Vận dụng), MỖI hoạt động đủ 4 mục a) Mục tiêu b) Nội dung c) Sản phẩm d) Tổ chức thực hiện;
  "Tổ chức thực hiện" viết theo 4 bước: giao nhiệm vụ → thực hiện → báo cáo, thảo luận →
  kết luận, nhận định.
- Khung 2345 (tiểu học): I. Yêu cầu cần đạt; II. Đồ dùng dạy học; III. Các hoạt động dạy học
  chủ yếu (Mở đầu; Hình thành kiến thức mới; Luyện tập, thực hành; Vận dụng, trải nghiệm);
  IV. Điều chỉnh sau bài dạy (để trống cho giáo viên ghi sau khi dạy).
- Mầm non: mục đích – yêu cầu theo lĩnh vực phát triển và độ tuổi; tiến hành dưới hình thức
  CHƠI, có gây hứng thú; ngôn ngữ phù hợp trẻ.
- GDTX: ví dụ/ngữ liệu gắn đời sống, công việc của học viên người lớn; nhịp độ phù hợp học lại.
- Phương án đánh giá trong bài phải khớp thông tư của cấp (chi tiết: references của skill
  `ra-de-kiem-tra` — thư mục cạnh bên `../ra-de-kiem-tra/references/`).
- Trích dẫn số ký hiệu văn bản khi nêu căn cứ; không bịa yêu cầu cần đạt.

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
- **Gói tri thức chuẩn hóa theo CẤP × MÔN**: `references/ppdh-cap-tieu-hoc.md`,
  `ppdh-cap-thcs.md`, `ppdh-cap-thpt-gdtx.md`, `ppdh-cap-mam-non.md` (nếu có) — đọc ĐÚNG MỘT file
  của cấp mình, Grep đúng mục môn: PPDH khuyến nghị của Bộ cho từng MẠCH NỘI DUNG của môn ở đúng
  cấp đó (nguồn Mô đun 2 ETEP). Chưa có file cấp thì dùng `ppdh-bo-mon.md`.
- Các file chuyên đề CHỈ đọc khi bài dạy thực sự cần (mỗi file một chủ đề tích hợp):
  `giao-duc-stem.md` (bài STEM 5 hoạt động); `khung-nang-luc-so.md` (năng lực số HS — TT 02/2025 +
  CV 3456/BGDĐT-GDPT); `tich-hop-noi-dung-giao-duc.md` (bảng quét 6 cơ hội tích hợp);
  `tich-hop-ky-nang-song.md` (KNS — dịch sang năng lực/phẩm chất, 3 mức độ, ví dụ 3 cấp);
  `tich-hop-giao-duc-moi-truong.md` (BVMT/BĐKH/tiết kiệm năng lượng — CV 4555, QĐ 1422/QĐ-TTg);
  `giao-duc-dia-phuong.md` (GDĐP — Luật 123/2025 đổi thẩm quyền phê duyệt về Chủ tịch UBND tỉnh;
  hỏi GV đang dạy bộ tài liệu tỉnh nào, nhất là các tỉnh mới sáp nhập).
- Nếu workspace có `HO SO CUA TOI/tri-thuc-cua-toi.md` (chỉ mục tri thức): theo đúng chỉ mục đó.
- **CHỐNG ẢO GIÁC**: bất kỳ kiến thức trọng tâm nào KHÔNG chắc chắn (không có SGK để đối chiếu,
  yêu cầu cần đạt mơ hồ, số liệu/công thức nghi ngờ) → HỎI giáo viên xác nhận trước khi viết vào
  bài ("Trọng tâm bài này em hiểu là... — đúng không ạ?"), tuyệt đối không đoán rồi viết như thật.

## Chọn khung theo cấp học

| Cấp/nhóm | Khung bắt buộc | File reference | Template |
|---|---|---|---|
| Tiểu học | Phụ lục 3, CV 2345/BGDĐT-GDTH (07/6/2021) | `references/cv-2345-phu-luc-3.md` | `templates/khbd-tieu-hoc-2345.docx` |
| THCS, THPT | Phụ lục IV, CV 5512/BGDĐT-GDTrH (18/12/2020) | `references/cv-5512-phu-luc-4.md` | `templates/khbd-thcs-thpt-5512.docx` |
| GDTX (THCS/THPT) | Khung 5512 + đặc thù học viên người lớn | `cv-5512-phu-luc-4.md` + `gdtx-dac-thu.md` | `templates/khbd-thcs-thpt-5512.docx` |
| Mầm non | Khung hoạt động học Chương trình GDMN | `references/khung-mam-non.md` | `templates/khbd-mam-non.docx` |

## Quy trình soạn — PHA 1 chốt nền, PHA 2 vòng lặp từng hoạt động

### PHA 1 — CHỐT NỀN (làm một lần; kết thúc bằng điểm chốt với giáo viên)

1. **Thu thập bối cảnh**: đọc `HO SO CUA TOI/` + `.aword/bo-nho/dai-han.md` + `.aword/bo-nho/thoi-quen.md`
   (bộ nhớ làm việc — skill `bo-nho-lam-viec`) — xác định VAI TRÒ, cấp,
   môn để chỉnh giọng làm việc (giáo sinh/GV mới → giải thích "vì sao" ở từng lựa chọn như người
   hướng dẫn; GV bộ môn → gọn việc; tổ trưởng → kèm góc thẩm định).
   Xác định: môn, lớp, tên bài, số tiết, vị trí bài trong chương (tra PPCT trong `TU LIEU MON HOC/`
   nếu có). Thiếu thông tin cốt lõi → AskUserQuestion TỪNG CÂU MỘT, mỗi câu kèm 2–4 gợi ý có
   giải thích phù hợp cấp học/bộ môn.
2. **Lấy chuẩn**: yêu cầu cần đạt của bài — tìm `TU LIEU MON HOC/<Môn>/yeu-cau-can-dat-lop-<X>.md`;
   không có thì tra web (chương trình môn học TT 32/2018/TT-BGDĐT) rồi LƯU về đó, ghi nguồn.
   Mầm non: mục tiêu lĩnh vực phát triển theo độ tuổi (trong `khung-mam-non.md`).
3. **Bám SGK**: tìm bài trong `TU LIEU MON HOC/<Môn>/SGK/` (SGK Kết nối tri thức với cuộc sống —
   bộ thống nhất toàn quốc từ 2026-2027 theo QĐ 3588/QĐ-BGDĐT; PDF scan đọc bằng thị giác, chỉ đọc
   đúng trang của bài). Không có file SGK → soạn theo yêu cầu cần đạt và GHI RÕ "chưa đối chiếu SGK"
   cuối sản phẩm.
4. **PHÂN TÍCH THÀNH PHẦN KIẾN THỨC (bước bắt buộc — giá trị cốt lõi, không được nhảy cóc)**:
   trước khi viết bất kỳ hoạt động nào, lập BẢNG PHÂN TÍCH BÀI DẠY:
   | Đơn vị kiến thức của bài | Dạng nội dung | PPDH/KTDH chọn | Vì sao |
   (a) liệt kê TỪNG đơn vị kiến thức từ yêu cầu cần đạt + SGK; (b) phân loại từng đơn vị theo
   dạng nội dung trong `anh-xa-noi-dung-ppdh-danh-gia.md` (khái niệm mới/định lý-quy tắc/
   thí nghiệm/đọc hiểu/luyện tập/vận dụng...); (c) chọn PPDH/KTDH cho TỪNG đơn vị theo bảng
   ánh xạ + Grep đúng mục môn trong `ppdh-bo-mon.md` (đặc trưng bộ môn thắng quy tắc chung khi
   xung đột); (d) điều chỉnh theo thiết bị/đặc thù lớp trong hồ sơ, ghi ngắn cột "Vì sao".
   Khi MỘT đơn vị kiến thức có ≥ 2 phương pháp cùng hợp lý (thí nghiệm trực diện vs mô phỏng
   vs video; dự án vs trạm...) → KHÔNG tự quyết: AskUserQuestion cho giáo viên chọn, mỗi phương
   án kèm giải thích ưu/nhược theo đúng PPDH bộ môn và điều kiện lớp (thiết bị, sĩ số, thời
   lượng) — giáo viên là người hiểu lớp mình nhất.
   Bảng này QUYẾT ĐỊNH cấu trúc các hoạt động phía sau — mỗi hoạt động của KHBD phải chỉ ra được
   nó dạy đơn vị kiến thức nào bằng phương pháp nào; hoạt động không truy được về bảng phân tích
   là hoạt động thừa. Lưu bảng vào ghi chú đầu mục III của KHBD (để tổ trưởng/thẩm định nhìn thấy
   logic thiết kế) và để skill `soan-bai-trinh-chieu` dùng lại.
   Bài có tiềm năng STEM (chế tạo, thử nghiệm, tích hợp liên môn) → hỏi người dùng có muốn
   thiết kế theo bài học STEM 5 hoạt động không (đọc `giao-duc-stem.md`).
5. **Quét TÍCH HỢP phù hợp** (theo `references/tich-hop-noi-dung-giao-duc.md`): dò 8 cơ hội —
   STEM/STEAM, năng lực số (TT 02/2025), hướng nghiệp, thực hành – trải nghiệm, giáo dục pháp
   luật, giáo dục địa phương (lấy tỉnh trong hồ sơ), kỹ năng sống, giáo dục môi trường — CHỈ đề
   xuất tích hợp có cơ hội tự nhiên
   trong bài, HỎI giáo viên chọn (kèm giải thích được–mất), và tích hợp được chọn phải đủ 3 chỗ:
   mục tiêu → hoạt động → tiêu chí đánh giá. Không nhồi tích hợp hình thức.
6. **Học từ mẫu tốt gần nhất**: nếu `KE HOACH BAI DAY/<Môn>/` đã có KHBD cùng môn (ưu tiên cùng
   khối, mới nhất, không bị ghi lỗi trong `.aword/bo-nho/kinh-nghiem.md`) — đọc lướt MỘT file đó làm
   mẫu văn phong/độ chi tiết (nhờ cache nên rẻ); KHÔNG sao chép nội dung, chỉ học giọng và mức
   chi tiết mà giáo viên này đã chấp nhận.
7. **ĐIỂM CHỐT PHA 1 (phỏng vấn chốt kiến thức + phương pháp — chống ảo giác)**: trình giáo viên
   (a) kiến thức trọng tâm đã hiểu + nguồn (SGK trang mấy / yêu cầu cần đạt nào); (b) BẢNG PHÂN
   TÍCH BÀI DẠY; (c) tích hợp đề xuất — bằng AskUserQuestion để chốt/sửa. Đồng thời hỏi CHẾ ĐỘ
   làm việc (chỉ hỏi lần đầu, ghi vào `.aword/bo-nho/thoi-quen.md` cho các phiên sau): ① "chốt từng
   hoạt động" — chất lượng cao nhất, giáo viên duyệt sau mỗi hoạt động; ② "soạn liền mạch,
   duyệt cuối" — nhanh nhất. CHỈ sang Pha 2 sau khi nền được chốt — nền sai thì mọi hoạt động
   phía sau sai theo.

### PHA 2 — VÒNG LẶP TỪNG HOẠT ĐỘNG (hiệu quả + tiết kiệm ngữ cảnh)

8. **Mở file đích ngay đầu pha**: copy template theo bảng trên về
   `KE HOACH BAI DAY/<Môn>/Lop <X>/KHBD_<tên-bài-không-dấu>.docx`, điền ngay phần đầu (tiêu đề,
   Mục tiêu, Thiết bị – học liệu, bảng phân tích vào ghi chú đầu mục III) từ kết quả Pha 1.
   TUYỆT ĐỐI không dựng file mới từ đầu, không đổi khung/đề mục.
9. **Lặp chu trình 4 bước cho TỪNG hoạt động** (Mở đầu → Hình thành kiến thức → Luyện tập →
   Vận dụng; mầm non: ổn định → nội dung chính → củng cố):
   (a) **NẠP đúng tri thức của hoạt động này** — hàng liên quan trong bảng phân tích + mục môn
       trong gói tri thức cấp (`ppdh-cap-*.md`/`ppdh-bo-mon.md`) + mục B/C/D khớp trong
       `logic-chon-ky-thuat-day-hoc.md`; KHÔNG nạp lại toàn bộ references;
   (b) **SOẠN chi tiết hoạt động**: đủ 4 mục a–d (khung 5512); kịch bản "Tổ chức thực hiện" viết
       CÂU HỎI THẬT theo kỹ thuật đặt câu hỏi (kèm dự kiến trả lời + nấc gợi mở khi bí), mốc phút,
       phương án co giờ — không viết chung chung kiểu "GV đặt câu hỏi, HS trả lời";
   (c) **TỰ KIỂM NHANH** hoạt động vừa soạn: các tiêu chí CV 5555 liên quan + 3 cổng chọn kỹ thuật
       + khớp thời lượng;
   (d) **GHI NGAY vào file docx** (python-docx, lưu tăng dần — gián đoạn không mất gì). Chế độ
       "chốt từng hoạt động": AskUserQuestion cho giáo viên duyệt/sửa hoạt động này (kèm gợi ý)
       rồi mới sang hoạt động kế; chế độ "liền mạch": đi tiếp luôn.
   *Vì sao vòng lặp: mỗi vòng chỉ giữ ngữ cảnh MỘT hoạt động (sâu mà rẻ — phần nền + template đã
   nằm trong cache); sai ở đâu chỉ làm lại đúng vòng đó, không đập cả bài.*
10. **Tự kiểm TOÀN BÀI theo CV 5555**: rà xâu chuỗi liên hoạt động (`cv-5555-tieu-chi.md`):
   tiến trình logic, vấn đề Mở đầu được đóng vòng ở củng cố, tổng thời lượng khớp số tiết,
   nhịp động–tĩnh; mầm non thay bằng tiêu chí "lấy trẻ làm trung tâm, chơi mà học". Sửa rồi báo
   kết quả rà ngắn gọn.
11. **Bàn giao**: nêu đường dẫn file, các giả định, phần giáo viên nên rà lại (đặc biệt khi chưa
   đối chiếu SGK). Gợi ý bước tiếp: "làm bài trình chiếu cho bài này?" hoặc "thẩm định độc lập
   trước khi nộp?" (skill `tham-dinh-ho-so-day-hoc`).

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
  `ra-de-kiem-tra` — thư mục cạnh bên `../ra-de-kiem-tra/references/`). Trong kịch bản từng
  hoạt động, phần đánh giá thường xuyên có thể kèm DỰ KIẾN nhận xét/tiêu chí quan sát viết đúng
  ngôn ngữ TT 22/2021 (THCS/THPT) hoặc TT 27/2020 (tiểu học) — chỉ ở mức tham khảo trong KHBD,
  KHÔNG mở rộng thành sản phẩm nhận xét hàng loạt riêng (ngoài phạm vi công cụ).
- Trích dẫn số ký hiệu văn bản khi nêu căn cứ; không bịa yêu cầu cần đạt.
- **Tra SỔ HIỆU LỰC trước khi viện dẫn**: nếu có `HO SO CUA TOI/QUY DINH NAM HOC/_SO-HIEU-LUC.md`,
  số hiệu định trích mà nằm trong danh sách HẾT hiệu lực thì KHÔNG dùng — dùng văn bản thay thế
  ghi trong sổ (sổ ưu tiên cao hơn references đóng gói).

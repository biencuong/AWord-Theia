---
name: ra-de-kiem-tra
description: Ra đề kiểm tra định kỳ đúng quy định — lập ma trận và bản đặc tả rồi biên soạn đề, đáp án, hướng dẫn chấm theo CV 7991/BGDĐT-GDTrH (THCS/THPT, 3 mức Biết/Hiểu/Vận dụng); tiểu học theo TT 27/2020; GDTX theo TT 43/2021 — bám yêu cầu cần đạt CTGDPT 2018 và phạm vi các bài đã học. Dùng khi người dùng nói "ra đề", "đề kiểm tra", "đề thi", "ma trận đề", "bản đặc tả", "đề giữa kỳ/cuối kỳ".
---

# Ra đề kiểm tra định kỳ

## Nạp tri thức CHỌN LỌC

Chỉ đọc file references khớp cấp học của người dùng:
| Cấp | Đọc | Ghi chú |
|---|---|---|
| THCS, THPT | `references/cv-7991-ma-tran-dac-ta.md` + `references/danh-gia-thcs-thpt-tt22.md` | Ma trận + đặc tả bắt buộc; 3 mức Biết/Hiểu/Vận dụng |
| Tiểu học | `references/danh-gia-tieu-hoc-tt27.md` | Đề 3 mức theo TT 27/2020; chỉ các môn có bài kiểm tra định kỳ |
| GDTX | `references/cv-7991-ma-tran-dac-ta.md` + `references/danh-gia-gdtx-tt43.md` | Kỹ thuật đề theo 7991, chế độ đánh giá theo TT 43/2021 |
| Mầm non | KHÔNG ra đề | Từ chối lịch sự, chuyển hướng: đánh giá trẻ theo mục tiêu Chương trình GDMN (skill soan-ke-hoach-bai-day, khung-mam-non.md) |

**Tra SỔ HIỆU LỰC trước khi viện dẫn văn bản**: nếu có `HO SO CUA TOI/QUY DINH NAM HOC/_SO-HIEU-LUC.md`,
số hiệu định trích (CV 7991, TT 22/27/43...) mà nằm trong danh sách HẾT hiệu lực thì dùng văn bản
thay thế ghi trong sổ (sổ ưu tiên cao hơn references đóng gói).

## Quy trình 6 bước (bắt buộc, không bỏ bước)

1. **Xác định phạm vi**: môn, lớp, loại bài (giữa kỳ I/cuối kỳ I/giữa kỳ II/cuối kỳ II),
   thời gian làm bài, các bài/chương trong phạm vi (tra PPCT trong `TU LIEU MON HOC/`; không rõ
   thì hỏi người dùng). Lấy yêu cầu cần đạt tương ứng
   (`TU LIEU MON HOC/<Môn>/yeu-cau-can-dat-lop-<X>.md`, thiếu thì tra web + lưu lại).
2. **Lập MA TRẬN** theo mẫu trong `cv-7991-ma-tran-dac-ta.md`: hàng = đơn vị kiến thức theo
   chương/bài; cột = mức độ (Biết/Hiểu/Vận dụng) × dạng câu hỏi (TNKQ nhiều lựa chọn, đúng–sai,
   trả lời ngắn, tự luận); phân bổ điểm cân đối và ghi tỉ lệ % từng mức.
3. **Viết BẢN ĐẶC TẢ**: với từng đơn vị kiến thức — mô tả cụ thể yêu cầu cần đạt được kiểm tra
   ở từng mức, số câu, vị trí câu trong đề.
4. **Biên soạn ĐỀ đúng theo đặc tả**: nội dung câu hỏi bám SGK Kết nối tri thức (đọc đúng bài
   trong `TU LIEU MON HOC/<Môn>/SGK/` nếu có); ngữ liệu môn Ngữ văn lấy NGOÀI SGK theo định hướng
   hiện hành (ghi trong reference 7991); GDTX dùng ngữ liệu gần đời sống người lớn.
5. **Đáp án + HƯỚNG DẪN CHẤM**: thang điểm chi tiết đến 0,25; tự luận có các ý thành phần;
   đúng–sai và trả lời ngắn theo cách tính điểm trong reference.
6. **Tự rà**: đối chiếu đề ↔ đặc tả ↔ ma trận (đủ số câu, đúng mức, đúng điểm); kiểm tra không có
   câu ngoài phạm vi/quá yêu cầu cần đạt; báo người dùng kết quả rà.
7. **GIẢI MÙ đối chứng đáp án (bắt buộc — sai đáp án là lỗi nghiêm trọng nhất của một đề thi)**:
   giao cho một subagent (Task/Agent) CHỈ nội dung đề — tuyệt đối không kèm đáp án — yêu cầu giải
   toàn bộ như một học sinh giỏi rồi trả bảng kết quả; so với đáp án đã soạn. Câu nào lệch → tự
   phân xử bên nào sai (giải lại tay lần nữa), sửa đề hoặc đáp án. Báo người dùng: "giải mù
   khớp x/y câu, đã xử lý các câu lệch: ...". Không chạy được subagent thì tự giải lại trong
   phiên nhưng CHE đáp án cũ (không nhìn lại phần D) rồi mới so.

## Sản phẩm bàn giao

Điền vào BẢN SAO của `templates/de-kiem-tra-7991.docx` (giữ nguyên khung 4 phần: Ma trận →
Bản đặc tả → Đề → Đáp án và hướng dẫn chấm), lưu
`DE KIEM TRA/<Môn>/Lop <X>/De_<loai-ky>_<nam-hoc>.docx`. Tiểu học dùng cùng template nhưng
ghi 3 mức theo TT 27/2020 (Mức 1 nhận biết – nhắc lại; Mức 2 kết nối – sắp xếp; Mức 3 vận dụng).
Cần thêm đề chẵn/lẻ hoặc đề dự phòng → hỏi người dùng trước khi làm.

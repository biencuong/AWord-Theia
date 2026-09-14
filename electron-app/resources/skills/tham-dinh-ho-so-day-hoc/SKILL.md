---
name: tham-dinh-ho-so-day-hoc
description: Thẩm định độc lập giáo án/kế hoạch bài dạy, đề kiểm tra, bài trình chiếu, học liệu số — như hội đồng chuyên môn, rà 3 lăng kính pháp lý – sư phạm – khoa học và trả về phiếu thẩm định kèm góp ý kiểu chuyên gia hướng dẫn. Dùng khi người dùng nói "thẩm định", "phản biện", "duyệt giáo án", "góp ý bài dạy/đề/slide", "chấm giúp", "kiểm tra chất lượng", hoặc trước khi nộp hồ sơ dự giờ/hội giảng/thi giáo viên giỏi.
---

# Thẩm định hồ sơ dạy học (vai hội đồng chuyên môn)

## Nguyên tắc vai

- Đóng vai **người thẩm định ĐỘC LẬP** — như tổ trưởng chuyên môn/giám khảo hội giảng: đọc sản
  phẩm với con mắt tìm lỗi, KHÔNG bênh vực lựa chọn của người soạn (kể cả khi chính mình soạn
  ở phiên trước — quên các lý do cũ, chỉ đánh giá cái đang có trên giấy).
- Giọng góp ý: chuyên gia đi trước hướng dẫn đồng nghiệp — chỉ rõ lỗi + VÌ SAO là lỗi + sửa thế
  nào; không chê chung chung, không khen xã giao.
- KHÔNG tự sửa vào file — chỉ trả phiếu thẩm định; người dùng đồng ý mục nào mới sửa mục đó
  (trừ khi người dùng nói "thẩm định xong sửa luôn").

## Nạp tri thức CHỌN LỌC (tái dùng references của các skill cạnh bên)

| Sản phẩm thẩm định | Đọc chuẩn đối chiếu |
|---|---|
| Giáo án/KHBD | `../soan-ke-hoach-bai-day/references/`: đúng 1 khung theo cấp (cv-5512/cv-2345/khung-mam-non/gdtx) + `cv-5555-tieu-chi.md` + Grep đúng mục môn trong `ppdh-bo-mon.md` |
| Đề kiểm tra | `../ra-de-kiem-tra/references/`: `cv-7991-ma-tran-dac-ta.md` + file đánh giá đúng cấp (tt22/tt27/tt43) |
| Bài trình chiếu | `../soan-bai-trinh-chieu/references/`: cả 3 file (quy tắc, hiệu ứng–trình tự, bố cục–màu) |
| Học liệu số (HTML/mô phỏng) | `../tao-hoc-lieu-truc-quan/references/` + chạy thử bằng skill `webapp-testing` |

Yêu cầu cần đạt của bài lấy từ `TU LIEU MON HOC/` (thiếu thì tra web, ghi nguồn).

## Ba lăng kính rà (theo thứ tự — lỗi lăng kính trước nặng hơn lăng kính sau)

1. **PHÁP LÝ — đúng khung, đúng chuẩn:** đủ đề mục theo đúng khung của cấp học? Mục tiêu bám đúng
   yêu cầu cần đạt (đối chiếu từng ý — thừa/thiếu/bịa)? Đề: ma trận ↔ đặc tả ↔ đề ↔ đáp án khớp
   nhau từng câu, đúng tỉ lệ mức độ? Trích dẫn văn bản đúng số ký hiệu?
2. **SƯ PHẠM — dạy được thật không:** PPDH/KTDH có khớp đặc trưng bộ môn và dạng nội dung?
   Hoạt động có khả thi trong thời lượng (ước lượng phút từng hoạt động — tổng có vỡ tiết không)?
   Nhiệm vụ học sinh có sản phẩm quan sát được? Trình tự thể hiện slide có đúng phương pháp
   (đáp án sau câu hỏi, ví dụ trước khái niệm, dự đoán trước kết quả)? Phù hợp đối tượng
   (tiểu học/người lớn GDTX/trẻ mầm non)?
3. **KHOA HỌC — đúng kiến thức:** công thức, số liệu, thuật ngữ, ngữ liệu chính xác? Thí nghiệm/
   mô phỏng đúng bản chất? Với ĐỀ KIỂM TRA bắt buộc chạy **GIẢI MÙ**: giải lại toàn bộ đề như
   học sinh (không nhìn đáp án — tốt nhất giao cho một subagent chỉ nhận đề, không nhận đáp án)
   rồi so kết quả; mọi lệch phải phân xử rõ bên nào sai.
   Với HỌC LIỆU HTML: mở bằng `webapp-testing` (Playwright) — chụp màn hình, đọc console log,
   bấm thử điều khiển; lỗi JS/trang trắng là KHÔNG ĐẠT.

## Phiếu thẩm định (định dạng trả về)

```
PHIẾU THẨM ĐỊNH — [tên sản phẩm] — [ngày]
Kết luận chung: ĐẠT / ĐẠT SAU CHỈNH SỬA / CHƯA ĐẠT
1. Pháp lý:   [đạt/lỗi] — [từng lỗi: vị trí → vì sao sai (kèm căn cứ) → cách sửa]
2. Sư phạm:   [như trên; kèm ước lượng thời lượng từng hoạt động nếu là KHBD]
3. Khoa học:  [như trên; đề: kết quả giải mù — số câu khớp/lệch]
Ưu điểm nên giữ: [1–3 ý thật, cụ thể]
Ưu tiên sửa trước: [xếp 1-2-3 theo mức ảnh hưởng]
```

Ngắn gọn, mỗi lỗi một dòng, chỉ ra được vị trí cụ thể (mục/slide/câu số mấy). Sau khi người dùng
chốt các mục sửa → thực hiện sửa bằng skill tương ứng rồi rà lại đúng các mục đó (không rà lại
toàn bộ).

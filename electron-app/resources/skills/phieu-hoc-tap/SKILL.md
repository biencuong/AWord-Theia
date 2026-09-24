---
name: phieu-hoc-tap
description: Soạn phiếu học tập / phiếu bài tập / phiếu thí nghiệm cho một bài cụ thể, bám đúng nội dung SGK và yêu cầu cần đạt, có chỗ để học sinh viết vào, in được ngay trên A4. Dùng khi giáo viên nói "phiếu học tập", "phiếu bài tập", "phiếu luyện tập", "phiếu thí nghiệm", "phiếu nhóm", "làm phiếu cho bài …", "in phiếu cho học sinh".
---

# Phiếu học tập

Phiếu học tập là **công cụ học sinh cầm tay làm bài trên lớp** — khác với giáo án (văn bản của giáo viên)
và khác với đề kiểm tra (để chấm điểm). Nguyên tắc xuyên suốt: **học sinh viết được vào phiếu**, và
**giáo viên in được ngay**.

## Quy trình (bắt buộc theo thứ tự)

1. **Xác định bài và dạng phiếu.** Cần: môn, lớp, tên bài (hoặc `bai_id`). Nếu chưa rõ, hỏi TỪNG CÂU MỘT.
   Chọn dạng phiếu theo mục đích (bảng dưới) — hỏi giáo viên nếu bài dùng được nhiều dạng.
2. **Lấy nội dung thật của bài.** Tra Kho tri thức AI (`tt_bai`, `tt_yeu_cau_can_dat`) để bám đúng SGK:
   câu hỏi, số liệu, hình vẽ, thuật ngữ phải khớp sách. Không có Kho thì đọc SGK trong `TU LIEU MON HOC/`
   (PDF scan đọc bằng thị giác, chỉ đúng trang bài đó); không có cả SGK thì ghi rõ **"chưa đối chiếu SGK"**
   ở cuối phiếu và dặn giáo viên rà lại.
3. **Xác định yêu cầu cần đạt** của bài — phiếu phải đo được đúng những yêu cầu đó, không lan sang bài khác.
4. **Soạn phiếu** theo cấu trúc chuẩn (mục dưới), dùng skill `docx` để xuất `.docx`.
5. **Tự kiểm trước khi giao** — chạy bảng kiểm cuối bài.
6. **Lưu và bàn giao:** `PHIEU HOC TAP/<Môn>/Lop <X>/Phieu_<tên-bài-không-dấu>.docx`, nêu đường dẫn + số
   trang khi in + phần giáo viên cần rà. Gợi ý bước tiếp: *"làm bài trình chiếu cho bài này?"* (`soan-bai-trinh-chieu`).

## Các dạng phiếu và khi nào dùng

| Dạng | Dùng khi | Đặc điểm |
|---|---|---|
| **Phiếu khởi động** | Đầu tiết, kiểm tra hiểu biết cũ, tạo tình huống | Ngắn nửa trang; 2–3 câu hỏi mở; học sinh viết nhanh |
| **Phiếu hình thành kiến thức** | Học sinh tự rút ra kiến thức mới từ SGK/thí nghiệm | Có câu hỏi dẫn dắt theo trình tự SGK; chỗ trống để kết luận |
| **Phiếu luyện tập** | Sau khi học xong kiến thức | Bài tập phân bậc: nhận biết → thông hiểu → vận dụng |
| **Phiếu thí nghiệm** | Bài có thí nghiệm/thực hành | Cột dụng cụ, cách tiến hành, bảng ghi số liệu, nhận xét — bám đúng thí nghiệm SGK |
| **Phiếu nhóm** | Hoạt động thảo luận nhóm | Kẻ bảng phân công vai trò + ô ghi kết quả chung; số phiếu = số nhóm |
| **Phiếu vận dụng** | Cuối tiết, giao về nhà | Gắn thực tiễn đời sống; có ô để phụ huynh/học sinh ghi lại |

## Cấu trúc chuẩn một phiếu (giữ đúng thứ tự này)

```
┌─ Đầu phiếu ─────────────────────────────────────┐
│ Trường: ……………  Họ tên HS: ……………………  Lớp: …     │   ← để trống cho HS viết
│ PHIẾU HỌC TẬP — <Tên bài>                        │
│ Môn: <môn> · Lớp <x> · Thời gian: <…> phút       │
└──────────────────────────────────────────────────┘
```

Thân phiếu chia theo **từng nhiệm vụ**, mỗi nhiệm vụ gồm:
- **Nhiệm vụ N.** <yêu cầu cụ thể, một việc rõ ràng>
- Chỗ để làm bài: dòng kẻ chấm hoặc ô trống, **đủ chỗ viết thật** (không phải ô tí xíu).
- Nếu là câu hỏi: để khoảng trống ngay dưới, không bắt học sinh viết ra vở riêng.

Cuối phiếu:
- **Em tự đánh giá:** ☐ Làm được hết ☐ Còn chỗ chưa chắc ☐ Cần cô/thầy giảng lại
- **Điều em còn thắc mắc:** <một dòng>
- (Nếu là phiếu nhóm) **Bảng phân công:** STT · Họ tên · Việc phụ trách

## Nguyên tắc chất lượng

- **Bám SGK, không bịa:** câu hỏi, số liệu, hiện tượng, thuật ngữ phải khớp bài trong sách. Không tự
  nghĩ thêm dữ kiện mà SGK không có — học sinh đối chiếu sách sẽ thấy lệch.
- **Mỗi nhiệm vụ một việc.** Không gộp 3 câu hỏi vào một ô "Thảo luận" — học sinh không biết trả lời cái nào.
- **Đủ chỗ viết.** Đây là lỗi hay gặp nhất của phiếu tự soạn: chừa 1 dòng cho câu cần 5 dòng.
- **In được ngay:** khổ A4, lề 1,5–2 cm, chữ 13–14 pt (tiểu học 14–16 pt), một mặt hoặc hai mặt đều được
  nhưng **không để nhiệm vụ bị cắt ngang trang** — ngắt trang có chủ ý.
- **Không dùng màu mực đắt tiền làm phương tiện duy nhất:** hình và ký hiệu phải đọc được khi in đen trắng.
- **Không hứa hẹn thời gian** nếu chưa rõ; phiếu cho 15 phút khác phiếu cho cả tiết.
- **Chưa đối chiếu SGK thì phải nói rõ** ở cuối phiếu — giáo viên phải biết chỗ nào cần rà.

## Bảng kiểm trước khi giao

1. Đã có tên trường / họ tên HS / lớp để trống cho học sinh viết chưa?
2. Mỗi nhiệm vụ có chỗ viết tương xứng với độ dài câu trả lời chưa?
3. Câu hỏi có bám đúng SGK/ýêu cầu cần đạt của CHÍNH bài này không?
4. Phiếu có đo được đúng yêu cầu cần đạt, không lan sang bài khác không?
5. In đen trắng còn đọc được không (hình, ký hiệu, bảng)?
6. Có ghi rõ "chưa đối chiếu SGK" nếu thiếu nguồn không?
7. Số nhiệm vụ có vừa thời gian giáo viên dự kiến không (khoảng 3–5 nhiệm vụ một tiết)?

## Liên kết skill khác

- `docx` — kỹ thuật tạo file Word (bắt buộc dùng, không tự dựng).
- `soan-ke-hoach-bai-day` — nếu cần kế hoạch bài dạy đầy đủ, hoặc lấy yêu cầu cần đạt/PPDH của bài.
- `tao-hoc-lieu-truc-quan` — nếu phiếu cần hình minh hoạ, mô phỏng, hoặc bản tương tác HTML.
- `ky-thuat-day-hoc` — nếu đang phân vân phiếu phục vụ phương pháp dạy nào.
- `../soan-ke-hoach-bai-day/references/cv-5512-phu-luc-4.md` — khung 4 hoạt động (đọc khi cần đối chiếu).

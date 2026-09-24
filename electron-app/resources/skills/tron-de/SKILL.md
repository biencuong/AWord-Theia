---
name: tron-de
description: Trộn đề kiểm tra trắc nghiệm — từ một đề gốc sinh nhiều mã đề (đảo thứ tự câu và đảo phương án) kèm bảng đáp án từng mã, để học sinh ngồi cạnh nhau không chép được bài. Dùng khi giáo viên nói "trộn đề", "tạo mã đề", "ra mấy đề khác nhau", "đảo đề", "làm đề A/B/C/D", "chống quay cóp".
---

# Trộn đề kiểm tra

Giáo viên thường phải làm việc này **thủ công mỗi lần kiểm tra** — đảo tay rất dễ sai đáp án. Skill này
sinh mã đề bằng máy và **kiểm lại được**.

## Giới hạn phải nói rõ với giáo viên TRƯỚC khi làm

| Tình huống | Xử lý |
|---|---|
| Đề **trắc nghiệm thuần chữ** | ✅ Chạy tốt bằng script |
| Đề có **hình vẽ, bảng, công thức dạng ảnh** | ⚠️ Script **không mang được hình** sang đề mới — phải chèn lại tay. Nói rõ để giáo viên quyết |
| Đề **tự luận** | ❌ Không trộn được — nói thẳng, đề xuất soạn 2–3 đề tương đương bằng `ra-de-kiem-tra` |
| Đề không theo mẫu "Câu 1." "Câu 2." | ❌ Script báo lỗi — đề nghị giáo viên chuẩn hoá lại hoặc làm tay |

**Không được im lặng bỏ qua** các trường hợp trên — giáo viên phải biết trước khi in đề cho học sinh.

## Quy trình (bắt buộc theo thứ tự)

1. **Nhận đề gốc.** Hỏi đường dẫn tệp `.docx`. Nếu giáo viên chưa có đề, dùng skill `ra-de-kiem-tra` soạn
   đề gốc trước — trộn đề là bước **sau** khi đã có đề hoàn chỉnh.
2. **Chạy xem trước**: `python scripts/tron_de.py "<đề gốc>" --kiem-tra`
   → xem số câu nhận được, số câu không nhận ra phương án, và **số đối tượng không phải chữ** (ảnh/bảng).
   Báo cho giáo viên, hỏi có tiếp tục không nếu có cảnh báo.
3. **Lấy đáp án của đề gốc** — đây là bước **hay bị bỏ sót nhất**. Đọc bảng đáp án kèm đề gốc, chuyển thành
   chuỗi `"ABCD…"` theo thứ tự câu (A = phương án đầu tiên trong đề gốc).
   **Không có đáp án gốc thì không được đoán.** Nếu giáo viên không có, chạy không `--dap-an` (bảng đáp án
   để trống cho họ tự điền) — **tuyệt đối không mặc định là A**.
4. **Sinh mã đề**:
   ```bash
   python scripts/tron_de.py "<đề gốc>" --so-ma 4 --dap-an "ABCDABCD…" --seed 2026
   ```
   `--seed` giúp chạy lại ra đúng kết quả cũ khi cần in bổ sung.
5. **Kiểm lại trước khi giao** — mở **một mã đề** đối chiếu đề gốc: câu hỏi phải khớp nội dung, đáp án trong
   bảng phải đúng với phương án sau khi đảo. Kiểm ít nhất 3 câu ngẫu nhiên.
6. **Bàn giao**: thư mục chứa `*_Ma001.docx …` + `BANG-DAP-AN.docx`; nêu rõ số mã đề, số câu mỗi mã, và
   nhắc giáo viên **kiểm lại đáp án** trước khi in.

## Nguyên tắc

- **Đáp án phải tính lại theo vị trí mới**, không giữ nguyên chữ cái — đây là lỗi nghiêm trọng nhất khi trộn đề.
- **Không đảo câu hỏi có ý nghĩa thứ tự** (ví dụ "câu trên nói về…"), và không đảo câu có hình — với đề như
  vậy thì chạy `--kiem-tra` rồi khuyến nghị giáo viên trộn tay phần đó.
- **Số mã đề vừa đủ**: 2–4 mã cho lớp thường; nhiều hơn không tăng hiệu quả mà tăng rủi ro in nhầm.
- **Ghi lại seed** đã dùng để lần sau in bổ sung ra đúng đề cũ.
- Bảng đáp án ghi rõ "tính theo phương án đúng của đề gốc" để giáo viên biết cách đối chiếu.

## Bảng kiểm trước khi giao

1. Đã chạy `--kiem-tra` và báo giáo viên các cảnh báo chưa?
2. Đáp án truyền vào có **đúng là đáp án của đề gốc** (không phải đoán) chưa?
3. Đã mở một mã đề kiểm 3 câu ngẫu nhiên chưa?
4. Đề có hình/bảng mà script báo mất — đã nói rõ với giáo viên chưa?
5. Bảng đáp án có đủ số mã và đủ số câu mỗi mã chưa?

## Liên kết skill khác

- `ra-de-kiem-tra` — soạn đề gốc đúng ma trận/đặc tả (làm trước khi trộn).
- `docx` — nếu cần sửa tay đề sau khi trộn.
- `ve-hinh-giao-khoa` — chèn lại hình vào đề đã trộn (phần script không mang được).

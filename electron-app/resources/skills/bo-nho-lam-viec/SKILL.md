---
name: bo-nho-lam-viec
description: Đọc/ghi bộ nhớ ngắn hạn, dài hạn, kinh nghiệm, thói quen và bàn giao việc dở trong thư mục ẩn .aword/bo-nho của thư mục làm việc, để phiên sau làm tiếp liền mạch. Dùng đầu phiên có nhiệm vụ, khi xong một việc lớn, khi người dùng nói "lưu bộ nhớ", "nhớ giúp tôi", "kết thúc phiên", "rút kinh nghiệm", hoặc hỏi "bạn nhớ gì về tôi".
---

# Bộ nhớ làm việc trong thư mục

Bộ nhớ nằm NGAY TRONG thư mục làm việc (không phụ thuộc lịch sử của AWord hay của riêng Claude),
nên phiên sau — kể cả bằng công cụ AI khác — đọc lại được. Quy ước đầy đủ, dùng chung cho mọi công
cụ, nằm trong `AGENTS.md` ở gốc thư mục làm việc (bản gốc: `templates/AGENTS.md` cạnh tệp này).

```
<thư mục làm việc>/
├── AGENTS.md          chỉ dẫn chung cho mọi công cụ AI (Claude, Codex, Cursor, Copilot, Gemini...)
└── .aword/            thư mục ẩn
    └── bo-nho/
        ├── ban-giao.md     việc đang dở — đọc ĐẦU TIÊN
        ├── ngan-han.md     tóm tắt phiên gần nhất — GHI ĐÈ mỗi phiên
        ├── dai-han.md      thông tin bền vững — chỉ cập nhật, không ghi đè
        ├── kinh-nghiem.md  vướng mắc đã gặp + cách xử lý
        └── thoi-quen.md    thói quen/cách làm lặp lại ≥ 2 lần của người dùng
```

## 1. Khởi tạo (chỉ khi thư mục làm việc CHƯA có `.aword/bo-nho/`)

Thư mục skill này: `%USERPROFILE%\.claude\skills\bo-nho-lam-viec\`.
1. Tạo `.aword/bo-nho/` và chép 5 tệp mẫu từ `templates/bo-nho/`.
2. Windows: ẩn thư mục bằng `attrib +h ".aword"` (chạy tại gốc thư mục làm việc).
3. `AGENTS.md` ở gốc:
   - Chưa có → chép nguyên `templates/AGENTS.md`.
   - Đã có (dự án có sẵn quy ước riêng) → KHÔNG ghi đè; chỉ nối thêm phần giữa hai dấu mốc
     `<!-- AWORD-BO-NHO:BEGIN -->` … `<!-- AWORD-BO-NHO:END -->` của mẫu vào cuối tệp (đã có mốc thì thay nội dung giữa hai mốc).
4. Không báo cáo dài dòng — một câu "Đã khởi tạo bộ nhớ làm việc" là đủ.

## 2. Đầu phiên có nhiệm vụ cụ thể (không áp dụng cho chào hỏi xã giao)

1. Đọc `ban-giao.md`. Có việc dở → hỏi người dùng có muốn làm tiếp không.
2. Đọc `ngan-han.md`.
3. Việc phức tạp hoặc thuộc dự án/lớp/môn cụ thể → đọc thêm `dai-han.md`, `kinh-nghiem.md`, `thoi-quen.md`.
Đã đọc trong phiên này thì không đọc lại. Thiếu tệp → bỏ qua, không báo lỗi.

## 3. Ghi — cây quyết định (dừng ở câu ĐÚNG ĐẦU TIÊN, ghi vào ĐÚNG MỘT tệp)

1. Việc **chưa xong** khi dừng? → `ban-giao.md`
2. Tóm tắt **chỉ đúng cho phiên này**? → `ngan-han.md` (ghi đè)
3. **Lỗi/vướng mắc cụ thể đã tìm ra cách xử lý**? → `kinh-nghiem.md`
4. **Thói quen lặp lại ≥ 2 lần** của người dùng? → `thoi-quen.md`
5. Thông tin **bền vững**, đúng ở mọi phiên sau? → `dai-han.md`
6. Không thuộc loại nào → **không ghi** (tránh rác bộ nhớ).

Ghi khi: kết thúc phiên; vừa xong một việc lớn; vừa xử lý xong một vướng mắc; người dùng dặn nhớ.
Tự quyết, không hỏi người dùng từng mục nhỏ; sau khi ghi chỉ báo ngắn đã cập nhật tệp nào.

## 4. Tiêu chí "đúng — đủ" từng tệp

- **ban-giao.md** — mỗi việc một mục: Trạng thái / Bước tiếp theo cụ thể / Tệp liên quan / Lưu ý / Ưu tiên.
  XÓA mục ngay khi việc xong (có bài học hay thì chuyển sang `kinh-nghiem.md` trước). ≤ 60 dòng.
- **ngan-han.md** — ghi đè: ngày, việc đã làm, quyết định đã chốt, việc dở (có/không → trỏ `ban-giao.md`),
  điều cần nhớ sang phiên sau. Không kể lể từng bước nhỏ. ≤ 40 dòng.
- **dai-han.md** — vai trò/đơn vị, lớp/môn hoặc lĩnh vực phụ trách, quy ước đã chốt, dự án dài hạn.
  Không lưu thứ suy ra lại được từ tệp có sẵn; có mục cũ liên quan thì SỬA mục đó, không nhân bản.
- **kinh-nghiem.md** — định dạng `[dd/mm/yyyy] — vấn đề → cách xử lý → ghi chú`. Không ghi việc suôn sẻ
  hay giải pháp hiển nhiên; có bài học tương tự thì bổ sung vào mục cũ.
- **thoi-quen.md** — chỉ ghi khi đã thấy lặp lại lần thứ 2 (lần đầu chỉ nhớ tạm trong phiên).
  Hai phần: cách làm việc ưa thích + từ khóa hay dùng.

## 5. Nguyên tắc bắt buộc

- KHÔNG ghi mật khẩu, mã khóa, token, số CCCD, số tài khoản — chỉ ghi "đã cấu hình ở đâu".
- KHÔNG bịa/suy diễn: chỉ ghi điều đã thấy trong phiên. Ngày ghi tuyệt đối (dd/mm/yyyy).
- Tiếng Việt có đầy đủ dấu, ngắn gọn. Không xóa tệp bộ nhớ — chỉ sửa nội dung bên trong.
- Hồ sơ chi tiết của người dùng nằm ở thư mục hồ sơ (`ABOUT ME/` hoặc `HO SO CUA TOI/`) —
  `dai-han.md` chỉ giữ ý chính cần cho mọi phiên, không chép lại toàn bộ hồ sơ.

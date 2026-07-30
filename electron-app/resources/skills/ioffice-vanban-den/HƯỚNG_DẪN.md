# HƯỚNG DẪN — Skill xử lý Văn bản đến iOffice (Sở GDĐT)

Tài khoản: của người dùng — trợ lý hỏi khi cần và CHỈ lưu `auth.local.json` vào máy khi
người dùng đồng ý; mật khẩu mặc định không lưu (tự đăng nhập qua `--login`). Hệ thống: VNPT iOffice (qlvbdh).
Nguyên tắc: **CHỈ đọc / điều hướng / tải file. KHÔNG bấm nút đổi trạng thái** (Chuyển xử lý, Trình ký, Phát hành, Hoàn thành).

## 1. Cài đặt (1 lần)
```
pip install playwright python-docx pdfplumber rarfile lxml
playwright install chromium
```
- Giải nén `.rar`: cần WinRAR (`C:\Program Files\WinRAR\UnRAR.exe`) hoặc đặt ENV `UNRAR_TOOL`.
- Credential iOffice: `auth.local.json` (đã .gitignore): `{"username": "...", "password": "..."}`.

## 2. Quy trình hằng ngày
| Bước | Lệnh | Kết quả |
|------|------|---------|
| 1. Lấy văn bản đến | `python scripts/fetch_vanban.py` | `inbox.json` (đã sắp ưu tiên) + tải đính kèm vào `attachments/` |
| 2. Lấy văn bản đi đã phát hành | `python scripts/fetch_vanban_di.py` | `outbox.json`, ghép về thư mục gốc nếu khớp |
| 3. Dựng chỉ mục | `python scripts/build_index.py` | `index.json` + `INDEX.md` (trạng thái, đề xuất, còn thiếu) |
| 4. Sinh tri thức | `python scripts/build_knowledge.py` | `tri_thuc/<số>.md` (mỗi VB 1 file, liên kết nhau) + `_INDEX.md` |
| 5. Gửi dần & hỏi | `python scripts/send_next.py --send 5` rồi `--poll` | Gửi VB lên Telegram hỏi cách xử lý; ghi `processing_state.json` |
| 6. Đọc & tổng hợp | (Claude/AI làm) | `references/briefings/<ngày>.md` |
| 7. Dự thảo & gửi | (AI) + `scripts/telegram_send.py` | dự thảo `_DuThao` + gửi Telegram |

> Bước 3–4 **tự chạy** sau mỗi lần `fetch_vanban.py` (có văn bản mới là có chỉ mục + tri thức).
> **Văn bản tải về nằm ở:** `attachments/<số ký hiệu>/` (đã giải nén). Dự thảo cùng thư mục (`_DuThao`).

Tuỳ chọn: `--headless` (chạy ẩn — tự đăng nhập), `--limit N` (chỉ tải N văn bản ưu tiên cao nhất/lần).
Mặc định mở cửa sổ chờ đăng nhập tay nếu auto-login lỗi (vd captcha).

## 3. Thứ tự ưu tiên (đã cài trong code)
Sắp `inbox.json` theo: **(1) độ khẩn** (Hỏa tốc→Khẩn→Thường) → **(2) văn bản cấp trên** (UBND/Bộ/Chính phủ/TW)
→ **(3) hạn xử lý gần nhất** → **(4) ngày đến cũ nhất**. Mỗi mục có `thu_tu_uu_tien`; xử lý từ trên xuống.

## 4. Phân loại & đặt tên thư mục
- **Thư mục cha = chủ đề**, mở rộng được: `CSDL` (cơ sở dữ liệu), `CĐS` (chuyển đổi số), `CKS` (chữ ký số),
  và thêm mới khi gặp (Thi cử, Tài chính...). Claude tự phán đoán theo nội dung.
- **Thư mục con = nhóm nhỏ** trong mỗi cha.
- **Tên file trong nhóm**: `01_<số văn bản> <trích yếu viết tắt>`, `02_...` (theo thứ tự).
- **Dự thảo**: cùng tên gốc + `_DuThao` (vd `1893_VP-KH&CĐS_DuThao.docx`).
- **Bản đi đã phát hành**: tải về cùng thư mục, tiền tố `PhatHanh_`.

## 5. Chỉ mục (INDEX.md / index.json)
Cho biết mỗi thư mục có gì, trạng thái vòng đời, còn thiếu gì:
- Trạng thái: `moi` 🆕 (chỉ có đến) · `da_du_thao` ✍️ · `da_phat_hanh` ✅.
- Còn thiếu: `du_thao` (XLC chưa dự thảo) · `phat_hanh` (có dự thảo, chưa phát hành) · `ban_goc`.
Chạy `build_index.py` sau mỗi lần thêm dự thảo/bản phát hành để cập nhật.
Cột **Đề xuất hành động** gợi ý văn bản có cần dự thảo không (góp ý/báo cáo/tham mưu = cần;
theo dõi/để biết/triển khai = không) — **không phải văn bản nào cũng soạn**.

## 5b. File tri thức (`tri_thuc/`)
- Mỗi văn bản 1 file `tri_thuc/<số>.md`: metadata, tóm tắt, danh sách file, và **liên kết** tới dự thảo,
  bản phát hành, văn bản trả lời, văn bản tham chiếu nội bộ (`[[...]]`). Hub: `tri_thuc/_INDEX.md`.
- Tự sinh sau mỗi `fetch_vanban.py`; hoặc chạy tay `python scripts/build_knowledge.py`.

## 5c. Gửi dần & hỏi cách xử lý (NÚT BẤM)
```
python scripts/send_next.py --send 5     # gửi 5 VB ưu tiên cao nhất + NÚT [Kết thúc][Soạn][Giao][Bỏ qua]
python scripts/send_next.py --watch      # LONG-POLL real-time: bấm nút là ghi ngay (chạy nền liên tục)
python scripts/send_next.py --poll       # bắt bù 1 lần (nếu không chạy --watch)
python scripts/send_next.py --addbuttons # gắn nút vào các tin đã gửi trước đó
python scripts/send_next.py --status     # tiến độ
```
- Bấm nút → bot hiện **"đang gõ…"** rồi **trả lời xác nhận** "✅ Đã ghi nhận: VB #.. <số> → <lựa chọn>",
  nút đổi thành "☑ …". Đổi ý cứ bấm nút khác (lần sau cùng thắng). Lưu ở `processing_state.json`.
- ⚠️ Bot PHẢI bật nhận `callback_query`: getUpdates truyền `allowed_updates=[...,"callback_query"]`
  (đã set trong code). Nếu nút "im" → kiểm tra `getWebhookInfo`/`allowed_updates`, `deleteWebhook`,
  và đừng để 2 tiến trình cùng getUpdates (lỗi 409). Xem `conventions.md §1j`.
- `--watch` nên chạy nền suốt phiên làm việc để bắt nút tức thời; vẫn dùng text reply được (vd "Giao cho ai").

## 6. Gửi Telegram (bot @Ioffice_Auto_bot)
```
python scripts/telegram_send.py --discover                       # lấy & lưu chat_id (sau khi nhắn bot)
python scripts/telegram_send.py --file <đường_dẫn_DuThao> --caption "<mô tả>"   # gửi 1 file
```
Token + chat_id ở `telegram.local.json` (đã .gitignore, chat_id hiện tại: 1379579448). Bot KHÔNG tự gửi cho chính nó.

## 7. Ghép văn bản đi ↔ văn bản đến
- Chính xác: nếu văn bản đi có `congvan_traloi_id` = `doc_id` văn bản đến → ghép tự động.
- Thực tế field này **thường = 0** → đa số phải **ghép mờ** theo số ký hiệu/trích yếu (AI).
- `inbox.json` chỉ có văn bản đến ĐANG chờ → đi trả lời cho đến đã xử lý xong sẽ không khớp.

## 8. Sự cố thường gặp
| Triệu chứng | Nguyên nhân / cách xử lý |
|-------------|--------------------------|
| Ra trang đăng nhập khi `--headless` | Phiên iOffice không bền; bỏ `--headless` để đăng nhập, hoặc dùng auto-login (`auth.local.json`). |
| Lỗi `UnicodeEncodeError` (cp1252) | Chạy với `PYTHONUTF8=1` (script đã tự ép UTF-8). |
| Chạy rất lâu / treo | Đã sửa: thay `networkidle` bằng phát hiện đổi dòng. Nếu tái diễn, kiểm tra mạng/phiên. |
| `.rar` không giải nén | Thiếu WinRAR/UnRAR — cài hoặc đặt ENV `UNRAR_TOOL`. |
| Captcha khi đăng nhập | Auto-login dừng, mở cửa sổ nhập tay (bỏ `--headless`). |

## 9. Tệp/cấu trúc
```
scripts/  fetch_vanban.py  fetch_vanban_di.py  build_index.py  telegram_send.py
references/  conventions.md  briefings/<ngày>.md
attachments/<số ký hiệu>/...        # đính kèm văn bản đến (đã giải nén)
vanban_di/<số>/...                  # bản đi chưa ghép được
inbox.json  outbox.json  index.json  INDEX.md
auth.local.json  telegram.local.json   (BÍ MẬT — .gitignore)
.browser_profile/                   (phiên trình duyệt)
```
Chi tiết kỹ thuật (selector iOffice, kinh nghiệm): `references/conventions.md`.

## 10. Giới hạn hiện tại (cần lưu ý)
- Tồn đọng lớn (542 vb): chạy lần đầu tải nhiều (~842MB); các lần sau dùng cache.
- Phân loại thư mục & dự thảo & ghép mờ là việc của AI mỗi lần xử lý (không tự động hoàn toàn).
- Gửi Telegram cần `chat_id` (chưa có — xem mục 6).

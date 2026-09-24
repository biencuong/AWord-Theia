# Công thức cho các việc hay gặp

## 0. Chạy script dài: `browser_run_code_unsafe`

Quy trình nhiều bước (đăng nhập, quét 10 trang danh sách) mà gọi từng công cụ thì vừa chậm vừa tốn ngữ cảnh.
Viết một tệp `.js` rồi chạy một phát.

Ba điều kiện bắt buộc:

- Tệp phải nằm trong **thư mục làm việc hiện tại** hoặc `<thư mục làm việc>\.playwright-mcp\`
  (trong AWord thường là `Documents\AWord\.playwright-mcp\`). Tệp ở nơi khác sẽ bị từ chối → chép vào đó trước.
- Trong tệp **không có `require`, không đọc/ghi tệp bằng `fs`**. Chỉ có `page` (và các API Playwright của trang).
- Trả về **dữ liệu đã gọn** (mảng đối tượng), không trả HTML thô.

Khung tệp:

```js
// .playwright-mcp/viec-cua-toi.js
const KET_QUA = [];
await page.goto('https://vi-du.gov.vn/danh-sach', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#bang tbody tr');
const dong = await page.$$eval('#bang tbody tr', rows => rows.map(r => {
  const o = r.querySelectorAll('td');
  return { so: o[1]?.innerText.trim(), trichyeu: o[2]?.innerText.trim(), ngay: o[3]?.innerText.trim() };
}));
KET_QUA.push(...dong);
return { tong: KET_QUA.length, dong: KET_QUA };
```

## 1. Đăng nhập mà không để lộ mật khẩu

Tạo `auth.local.json` trong thư mục skill của hệ thống đó (ví dụ
`%USERPROFILE%\.claude\skills\<tên-skill>\auth.local.json`):

```json
{ "url": "https://he-thong.gov.vn/", "username": "tk.cua.toi", "password": "..." }
```

Script đọc tệp này bằng một thẻ `file:///` ngay trong trình duyệt rồi đóng lại — mật khẩu không đi qua hội thoại,
không vào log:

```js
const tab = await page.context().newPage();
await tab.goto('file:///C:/Users/<TEN_NGUOI_DUNG>/.claude/skills/<ten-skill>/auth.local.json');
const cfg = JSON.parse(await tab.locator('pre').innerText());
await tab.close();
await page.fill('#userName', cfg.username);
await page.fill('#passWord', cfg.password);
await page.click('#submitBtn');
```

Gặp captcha/OTP: **dừng**, chụp màn hình cho người dùng nhập, rồi chạy tiếp.

## 2. Quét bảng có phân trang

- Đọc số trang từ thanh phân trang (`ul.pagination`), lặp qua từng trang.
- Sau khi chuyển trang, **chờ id/nội dung dòng đầu tiên đổi** — không chờ "mạng rảnh" (hệ thống công vụ giữ kết
  nối nền nên không bao giờ rảnh).
- **Loại trùng theo id dòng**, vì trang chuyển chậm dễ quét lại trang cũ.
- Đừng đổi số dòng/trang (`selectPageRec`) giữa chừng — danh sách sẽ nhảy.
- Số cột trong `<thead>` có thể **khác** số `<td>` thật (cột ẩn) → đếm theo `td`, đừng đếm theo tiêu đề.

## 3. Tải tệp đính kèm

```js
const [tai] = await Promise.all([
  page.waitForEvent('download'),
  page.click('a.tep-dinh-kem')
]);
const duongDan = await tai.path();
return { ten: tai.suggestedFilename(), duongDan };
```

Nhiều tệp thì lặp, ghi lại danh sách `{tên, đường dẫn}` rồi báo người dùng. Tệp nằm ở thư mục tạm của trình duyệt
— chép sang `Documents\AWord\...` bằng Bash/PowerShell rồi mới đọc bằng skill `doc-van-ban-local`.

## 4. Điền biểu mẫu trực tuyến

- Điền bằng `browser_fill_form` (nhiều ô một lượt), chọn danh sách xổ bằng `browser_select_option`.
- **Đến bước Gửi/Nộp thì dừng**: chụp màn hình, liệt kê từng ô đã điền cho người dùng soát, hỏi rõ
  "gửi luôn chứ?" rồi mới bấm. Gửi xong chụp lại màn hình xác nhận (mã hồ sơ, giờ gửi) làm minh chứng.
- Biểu mẫu có tệp đính kèm: bấm nút chọn tệp rồi gọi `browser_file_upload` với đường dẫn tuyệt đối.

## 5. Chụp minh chứng cho báo cáo

- Toàn trang: `browser_take_screenshot` với `fullPage: true`.
- Một vùng: thêm `element` + `ref` (ví dụ đúng cái bảng kết quả).
- Lưu ảnh vào `Documents\AWord\<việc>\anh\`, đặt tên có ngày, rồi chèn vào .docx bằng python-docx.
- Ảnh có thông tin cá nhân (số CCCD, số điện thoại) mà đưa vào báo cáo chia sẻ ra ngoài → hỏi người dùng trước.

## 6. Tra cứu văn bản pháp luật, cổng thông tin

- Trang công khai, đọc được bằng `WebFetch` thì dùng `WebFetch` cho nhanh.
- Cần bấm tab, mở "Toàn văn", hay trang chặn công cụ đọc tự động → mới mở trình duyệt.
- Luôn ghi lại **số ký hiệu, ngày ban hành, cơ quan ban hành, hiệu lực** và địa chỉ trang đã lấy, để trích dẫn.
- Cơ quan có Kho dữ liệu (`kho_*`) thì tra kho trước; web chỉ để bổ sung.

## 7. Theo dõi trang có gì mới

Lấy danh sách tiêu đề + ngày bằng `browser_evaluate`, ghi ra tệp JSON trong thư mục làm việc, lần sau so sánh để
chỉ báo phần mới. Đừng chụp cả trang rồi so ảnh.

## 8. Kiểm thử trang web mình đang làm

Mở địa chỉ máy chủ nội bộ, đi hết luồng như người dùng thật (đăng nhập → thao tác → kết quả), đọc
`browser_console_messages` và `browser_network_requests` để bắt lỗi JS/API. Đây là cách kiểm thử đáng tin hơn đọc
mã nguồn: nhiều lỗi (CSP chặn chuyển hướng, cookie sai miền) chỉ lộ ra trên trình duyệt thật.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân / xử lý |
|---|---|
| Lệnh báo không tìm thấy phần tử | `ref` cũ sau khi trang đổi → `browser_snapshot` lại |
| Bấm mãi không có gì xảy ra | Có hộp thoại `confirm` đang chờ → `browser_handle_dialog`; hoặc nút bị lớp phủ che → `Escape` |
| Trang trắng, không lỗi | Chờ sai điều kiện → chờ theo CHỮ hoặc theo selector, không chờ mạng rảnh |
| Chạy lần đầu rất lâu | Đang tải Chromium (~100 MB) — bình thường, chỉ một lần |
| `browser_run_code_unsafe` từ chối tệp | Tệp không nằm trong thư mục làm việc hoặc `.playwright-mcp\` → chép vào rồi chạy |
| Đăng nhập xong lại văng ra | Hệ thống chặn nhiều phiên; đóng trình duyệt khác của cùng tài khoản rồi thử lại |
| Bị khóa tài khoản | Đã thử sai mật khẩu nhiều lần — **dừng ngay khi sai lần thứ hai**, hỏi người dùng |

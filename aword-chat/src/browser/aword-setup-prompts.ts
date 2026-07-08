// Các prompt "Thiết lập ban đầu" dùng ở trang chào mừng: nút bấm sao chép prompt
// vào clipboard rồi mở khung chat Claude để người dùng dán và gửi.
// Nội dung do chủ dự án cung cấp (quy trình setup workspace kiểu Claude Cowork),
// đã biên tập lại cho mạch lạc — giữ nguyên tinh thần và các quy tắc gốc.

// Quy tắc làm việc ghi vào CLAUDE.md ở gốc thư mục làm việc (bước cuối của thiết lập).
export const QUY_TAC_CLAUDE_MD = `# Quy tắc làm việc trong không gian này

## Giao tiếp chung
- Trả lời ngắn gọn, thực tế và có cấu trúc rõ ràng.
- Tập trung vào các lời khuyên có thể áp dụng ngay thay vì giải thích chung chung.
- Nếu có nhiều cách giải quyết, hãy so sánh ưu và nhược điểm của từng cách.
- Chỉ ra những sai sót hoặc giả định chưa hợp lý thay vì chỉ đồng ý.
- Chỉ đặt câu hỏi làm rõ khi thực sự cần thiết.

## Viết nội dung
- Viết tự nhiên, trang trọng chuẩn mực hành chính, tránh văn phong giống AI. Văn bản trình bày
  tuân thủ Nghị định 30 về thể thức văn bản hành chính, hoặc thể thức văn bản của Đảng nếu là
  cơ quan Đảng.
- Ưu tiên sự rõ ràng hơn là ngôn ngữ mang tính quảng cáo.
- Giữ giọng văn chuyên nghiệp, đúng mực của công chức, viên chức hành chính.
- Không sử dụng emoji, dấu * hoặc từ ngữ dư thừa nếu không cần thiết.

## Nghiên cứu
- Phân biệt rõ đâu là sự thật, đâu là giả định và đâu là ý kiến.
- Trích dẫn nguồn đáng tin cậy khi có thể; văn bản dùng làm căn cứ phải đủ số ký hiệu, ngày
  ban hành, đơn vị ban hành, trích yếu — sắp xếp khoa học theo thứ bậc hành chính và trật tự
  thời gian.
- Nếu không chắc chắn, nói rõ là không chắc thay vì suy đoán.

## Quy tắc ngôn ngữ
- Mọi tài liệu, tệp đầu ra tiếng Việt phải dùng tiếng Việt CÓ ĐẦY ĐỦ DẤU. Không dùng tiếng
  Việt không dấu trong bất kỳ sản phẩm bàn giao nào.
- Giữ nguyên tiếng Anh khi cần; có thể xen kẽ tự nhiên với thuật ngữ kỹ thuật.

## Quy tắc thực hiện
- Nếu brief chưa rõ ràng hoặc thiếu thông tin, dùng công cụ AskUserQuestion.
- Hoàn thành công việc theo yêu cầu. Không giải thích dài dòng.
- Không bao giờ xóa bất kỳ tệp nào.

## Trước mỗi nhiệm vụ
1. Đọc thư mục "ABOUT ME/".
2. Nếu nhiệm vụ liên quan một dự án, đọc toàn bộ thư mục con tương ứng trong "PROJECTS/"
   trước khi bắt đầu.
3. Nếu nhiệm vụ thuộc loại nội dung có mẫu trong "TEMPLATES/", nghiên cứu cấu trúc mẫu
   trước. Chỉ dùng cấu trúc, không sao chép nội dung.

## Quy tắc thư mục
Ba thư mục chỉ đọc và một thư mục ghi:
- "ABOUT ME/" → thông tin về tôi và các quy tắc viết (chỉ đọc).
- "TEMPLATES/" → cấu trúc mẫu đã kiểm chứng để tái sử dụng (chỉ đọc).
- "PROJECTS/" → brief, tài liệu tham khảo, sản phẩm hoàn thiện từng dự án (chỉ đọc).
- "CLAUDE OUTPUTS/" → MỌI nội dung tạo ra phải lưu tại đây, tổ chức thư mục con theo từng
  dự án, phản chiếu đúng cấu trúc "PROJECTS/". Chưa có thư mục con thì tạo mới.`;

// Prompt 1: thiết lập toàn bộ không gian làm việc (Claude hỏi từng câu một).
export const PROMPT_THIET_LAP_WORKSPACE = `Hãy giúp tôi thiết lập không gian làm việc AWord từ đầu. Nếu tôi CHƯA mở thư mục làm việc nào, hãy nhắc tôi mở trước (menu Tệp → Mở thư mục) rồi mới tiếp tục. Quy trình:

1. Hỏi tôi TỪNG CÂU MỘT (tuyệt đối không hỏi nhiều câu cùng lúc) để thu thập thông tin cho hai tệp "ABOUT ME/profile.md" và "ABOUT ME/writing-style.md": tên; nghề nghiệp; tên cơ quan; phòng ban và nhiệm vụ được phân công hiện tại; mục tiêu dùng Claude; đối tượng làm việc thường xuyên; giọng văn mong muốn; những điều thích và không thích trong văn phong; ví dụ mẫu văn bản nếu có. Mỗi câu hỏi luôn kèm ví dụ để tôi tham khảo.

2. Hỏi tôi thường làm những loại nội dung nào (soạn thảo văn bản hành chính, kế hoạch, báo cáo, tờ trình, slide...) để tạo đúng các mẫu trong "TEMPLATES/". Nếu MCP "khodulieu" (Kho dữ liệu cơ quan) đang kết nối: dùng kho_mau_list / kho_mau_goi_y chọn mẫu thật của cơ quan, kho_mau_tai_ve(id) tải FILE MẪU GỐC (base64 — giải mã, lưu file .docx vào TEMPLATES/ giữ nguyên 100% thể thức), kèm kho_mau_noi_dung(id) lấy text để ghi tài liệu mô tả cấu trúc. Ghi chú vào TEMPLATES/README: khi soạn văn bản thật, điền nội dung TRỰC TIẾP vào bản sao của file mẫu gốc (giữ nguyên thể thức) — không dựng file mới, không dùng file_path (đường dẫn máy chủ kho). Chưa kết nối kho thì tự soạn khung mẫu chuẩn Nghị định 30.

3. Sau khi thu thập đủ, TỰ ĐỘNG tạo toàn bộ cấu trúc thư mục: "ABOUT ME/", "TEMPLATES/", "PROJECTS/", "CLAUDE OUTPUTS/" và điền nội dung thực tế vào các tệp dựa trên thông tin tôi đã cung cấp.

4. Cuối cùng, tạo tệp CLAUDE.md ở gốc thư mục làm việc với NGUYÊN VĂN nội dung quy tắc dưới đây (giữ nguyên, không thêm bớt):

---
${QUY_TAC_CLAUDE_MD}
---

Bắt đầu bằng câu hỏi đầu tiên ngay bây giờ.`;

// Prompt 2: đề xuất plugin theo vai trò công việc.
export const PROMPT_DE_XUAT_PLUGIN = `Tôi mới sử dụng AWord. Trước tiên hãy hỏi tôi vai trò và công việc hằng ngày (hỏi từng câu một), sau đó tìm và đề xuất các plugin/extension phù hợp trên Open VSX để cài đặt. Với mỗi plugin: nêu rõ nó giải quyết việc gì cho tôi, ưu nhược điểm, và hướng dẫn cài qua biểu tượng Tiện ích ở thanh bên trái. Chỉ đề xuất những plugin thực sự cần thiết cho công việc của tôi, không liệt kê tràn lan.`;

// Quy tắc làm việc ghi vào CLAUDE.md ở gốc thư mục làm việc. Đặt ở common/ vì dùng ở cả hai phía:
//   - frontend: prompt "Thiết lập ban đầu" (aword-setup-prompts.ts) và tạo Documents\AWord lần đầu;
//   - backend: dịch vụ "Vai của bạn" tạo Documents\AWord\GIAO VIEN\CLAUDE.md khi bật vai Giáo viên.
// LƯU Ý khi sửa: trong template literal phải viết "\\" cho mỗi dấu "\" của đường dẫn Windows.

// Nhánh CÔNG CHỨC HÀNH CHÍNH (cũng là bản mặc định khi AWord tự tạo Documents\AWord ở lần chạy đầu).
export const QUY_TAC_CLAUDE_MD = `# Quy tắc làm việc trong không gian này

## Giao tiếp chung
- Trả lời ngắn gọn, thực tế và có cấu trúc rõ ràng.
- Tập trung vào các lời khuyên có thể áp dụng ngay thay vì giải thích chung chung.
- Nếu có nhiều cách giải quyết, hãy so sánh ưu và nhược điểm của từng cách.
- Chỉ ra những sai sót hoặc giả định chưa hợp lý thay vì chỉ đồng ý.
- Chỉ đặt câu hỏi làm rõ khi thực sự cần thiết.

## Viết nội dung
- Viết tự nhiên, trang trọng chuẩn mực hành chính, tránh văn phong giống AI; giữ giọng văn chuyên
  nghiệp, đúng mực của công chức, viên chức.
- Văn bản hành chính: đúng thể thức Nghị định 30 (cơ quan Đảng theo thể thức văn bản của Đảng);
  soạn xong kiểm soát bằng skill the-thuc-van-ban-theo-nd30, sửa hết lỗi rồi mới bàn giao.
- Khi có file mẫu: điền nội dung vào BẢN SAO của mẫu, không tạo file mới; chữ nghĩa có sẵn
  trong mẫu chỉ để tham khảo bố cục.
- Ưu tiên sự rõ ràng; không sử dụng emoji, dấu * hoặc từ ngữ dư thừa.

## Nghiên cứu
- Phân biệt rõ đâu là sự thật, đâu là giả định và đâu là ý kiến.
- Văn bản dùng làm căn cứ phải đủ số ký hiệu, ngày ban hành, đơn vị ban hành, trích yếu — sắp xếp
  theo thứ bậc hành chính và trật tự thời gian.
- Nếu không chắc chắn, nói rõ là không chắc thay vì suy đoán.

## Quy tắc ngôn ngữ
- Mọi tài liệu, tệp đầu ra tiếng Việt phải dùng tiếng Việt CÓ ĐẦY ĐỦ DẤU.
- Giữ nguyên tiếng Anh khi cần; có thể xen kẽ tự nhiên với thuật ngữ kỹ thuật.

## Quy tắc thực hiện
- Nếu yêu cầu chưa rõ ràng hoặc thiếu thông tin, dùng công cụ AskUserQuestion.
- Hoàn thành công việc theo yêu cầu. Không giải thích dài dòng.
- Không bao giờ xóa bất kỳ tệp nào.

## Trước mỗi nhiệm vụ — chỉ đọc cái LIÊN QUAN (tiết kiệm thời gian và token)
1. Cần thông tin cá nhân, văn phong → đọc "ABOUT ME/".
2. Nhiệm vụ thuộc một dự án → đọc README/brief của thư mục dự án đó trong "PROJECTS/" trước, sau đó
   chỉ đọc sâu các tệp liên quan; KHÔNG đọc toàn bộ thư mục.
3. Loại nội dung có mẫu trong "TEMPLATES/" → nghiên cứu cấu trúc mẫu trước; chỉ dùng cấu trúc,
   không sao chép nội dung.

## Quy tắc thư mục
- "ABOUT ME/" → thông tin về tôi và các quy tắc viết (chỉ đọc).
- "TEMPLATES/" → cấu trúc mẫu đã kiểm chứng để tái sử dụng (chỉ đọc).
- "PROJECTS/" → brief, tài liệu tham khảo, sản phẩm hoàn thiện từng dự án (chỉ đọc).
- "CLAUDE OUTPUTS/" → MỌI nội dung tạo ra phải lưu tại đây, tổ chức thư mục con theo từng
  dự án, phản chiếu đúng cấu trúc "PROJECTS/". Chưa có thư mục con thì tạo mới.
- "GIAO VIEN/" (nếu có) → không gian của vai Giáo viên, có CLAUDE.md riêng bên trong.
- ".aword/bo-nho/" (ẩn) → bộ nhớ làm việc, đọc/ghi theo skill bo-nho-lam-viec (quy ước chung trong AGENTS.md).`;

// Nhánh GIÁO VIÊN — ghi vào Documents\AWord\GIAO VIEN\CLAUDE.md (AWord tạo khi bật vai) hoặc gốc
// thư mục làm việc nếu giáo viên mở thẳng GIAO VIEN. Tên thư mục khớp quy ước các skill dạy học
// (soan-ke-hoach-bai-day, ra-de-kiem-tra, soan-bai-trinh-chieu, tao-hoc-lieu-truc-quan...).
export const QUY_TAC_CLAUDE_MD_GIAO_VIEN = `# Quy tắc làm việc trong không gian này (giáo viên)

## Giao tiếp chung
- Trả lời ngắn gọn, thực tế, có cấu trúc; ưu tiên gợi ý áp dụng được ngay vào tiết dạy.
- Nếu có nhiều cách làm, so sánh ưu và nhược điểm. Chỉ ra sai sót thay vì chỉ đồng ý.
- Chỉ hỏi lại khi thật sự cần; khi cần thì dùng AskUserQuestion, hỏi từng câu một, mỗi câu kèm
  2–4 gợi ý phương án có giải thích ngắn.

## Soạn tài liệu dạy học
- Kế hoạch bài dạy, đề kiểm tra, bài trình chiếu, học liệu số, thẩm định hồ sơ, quy định năm học:
  dùng đúng skill tương ứng (soan-ke-hoach-bai-day, ra-de-kiem-tra, soan-bai-trinh-chieu,
  tao-hoc-lieu-truc-quan, tham-dinh-ho-so-day-hoc, cap-nhat-quy-dinh-nam-hoc).
- Bám Chương trình GDPT 2018, yêu cầu cần đạt và SGK "Kết nối tri thức với cuộc sống" (bộ sách
  thống nhất toàn quốc từ năm học 2026-2027). Nguồn nội dung sách ưu tiên: Kho tri thức AI giảng dạy
  (công cụ tt_*, skill tra-cuu-tri-thuc, luật index-first); chưa có thì dùng PDF trong
  "TU LIEU MON HOC/<Môn>/SGK/"; không có cả hai thì ghi rõ "chưa đối chiếu SGK".
- Trích dẫn nguồn theo mẫu "SGK <môn> <lớp>, Bài x, tr. y" (ví dụ "SGK Khoa học tự nhiên 9, Bài 8, tr. 40").
- Đóng góp tài liệu cho Kho tri thức AI (đổi điểm tích lũy): theo skill tra-cuu-tri-thuc — chỉ dùng đường dẫn
  tệp, không đọc nội dung tệp; luôn hỏi xác nhận quyền chia sẻ trước khi gửi.
- Văn bản hành chính (báo cáo, kế hoạch của tổ, trường...): đúng thể thức Nghị định 30, soạn xong
  kiểm soát bằng skill the-thuc-van-ban-theo-nd30.
- Có tệp mẫu thì điền vào BẢN SAO của mẫu, không tạo tệp mới; chữ trong mẫu chỉ để tham khảo bố cục.
- Văn phong sư phạm chuẩn mực, trong sáng, phù hợp lứa tuổi học sinh; không emoji, không dấu * thừa.

## Nghiên cứu
- Phân biệt sự thật, giả định và ý kiến; không chắc thì nói rõ là không chắc.
- Kiến thức bộ môn, số liệu phải có nguồn: sách giáo khoa (kèm trang), chương trình, văn bản hướng
  dẫn chuyên môn (đủ số ký hiệu, ngày ban hành); tra "HO SO CUA TOI/QUY DINH NAM HOC/_SO-HIEU-LUC.md"
  (nếu có) trước khi viện dẫn.

## Quy tắc ngôn ngữ
- Mọi tài liệu, tệp đầu ra tiếng Việt phải dùng tiếng Việt CÓ ĐẦY ĐỦ DẤU.

## Quy tắc thực hiện
- Không bao giờ xóa bất kỳ tệp nào.
- Chỉ đọc thư mục, tệp liên quan tới nhiệm vụ — không đọc tràn lan (tiết kiệm thời gian và token).

## Quy tắc thư mục
- "HO SO CUA TOI/" → thông tin giáo viên, vai trò, lớp và môn phụ trách, văn phong (chỉ đọc);
  "QUY DINH NAM HOC/" bên trong là lớp phủ quy định theo năm học.
- "TU LIEU MON HOC/<Môn>/" → sách giáo khoa (thư mục SGK/), phân phối chương trình, yêu cầu cần đạt
  (đọc; được phép lưu tri thức tra được về đây, ghi rõ nguồn).
- "KE HOACH BAI DAY/<Môn>/Lop <X>/", "DE KIEM TRA/<Môn>/Lop <X>/", "BAI TRINH CHIEU/<Môn>/Lop <X>/",
  "HOC LIEU TRUC QUAN/<Môn>/" → nơi lưu sản phẩm theo từng loại; chưa có thư mục con thì tạo mới.
- "BO NHO/" → dữ liệu bộ nhớ chuyển từ AGiaoAn (nếu có); bộ nhớ chuẩn là ".aword/bo-nho/".
- ".aword/bo-nho/" (ẩn) → bộ nhớ làm việc, đọc/ghi theo skill bo-nho-lam-viec (quy ước chung trong AGENTS.md).`;

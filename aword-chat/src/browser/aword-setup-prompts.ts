// Các prompt "Thiết lập ban đầu" dùng ở trang chào mừng: nút bấm sao chép prompt vào clipboard
// rồi mở khung chat Claude để người dùng dán và gửi. Hai nhánh theo vai trò — GIÁO VIÊN (ít việc
// hành chính) và CÔNG CHỨC, VIÊN CHỨC làm công tác hành chính — mỗi nhánh có bộ câu hỏi, cấu trúc
// thư mục và CLAUDE.md riêng; cả hai cùng khởi tạo bộ nhớ làm việc (skill bo-nho-lam-viec).
// LƯU Ý khi sửa: trong template literal phải viết "\\" cho mỗi dấu "\" của đường dẫn Windows.

// Nhóm kỹ năng — dùng chung cho bước chọn nhóm ở cả hai nhánh và nút "Bật/tắt nhóm kỹ năng".
const NHOM_KY_NANG = `Các nhóm kỹ năng của AWord:
- Nền tảng (LUÔN BẬT, không tắt): bo-nho-lam-viec, doc-van-ban-local, docx, xlsx, pptx, pdf.
- Nghiệp vụ hành chính: the-thuc-van-ban-theo-nd30, so-gd-cds-tao-van-ban, ioffice-vanban-den, xu-ly-van-ban-den-xlc, nghiep-vu-tong-hop-bao-cao, internal-comms, doc-coauthoring.
- Giáo dục, dạy học: soan-ke-hoach-bai-day, ra-de-kiem-tra, soan-bai-trinh-chieu, tao-hoc-lieu-truc-quan, tham-dinh-ho-so-day-hoc, academic-pptx.
- Thiết kế và trình bày: design, design-system, brand, brand-guidelines, banner-design, canvas-design, theme-factory, slides, ui-styling, ui-ux-pro-max, frontend-design.
- Lập trình và kỹ thuật (ít dùng cho văn phòng): claude-api, mcp-builder, webapp-testing, web-artifacts-builder, skill-creator, slack-gif-creator, algorithmic-art.
Phụ thuộc: nếu GIỮ nhóm Giáo dục thì KHÔNG tắt canvas-design, frontend-design, web-artifacts-builder, slack-gif-creator, webapp-testing (skill dạy học dùng kèm).`;

const CACH_BAT_TAT_KY_NANG = `TẮT một skill = chuyển thư mục %USERPROFILE%\\.claude\\skills\\<tên> sang %USERPROFILE%\\.claude\\skills-tat\\<tên>; BẬT lại = chuyển ngược về (PowerShell Move-Item). TUYỆT ĐỐI không xóa thư mục skill nào. Skill đã tắt sẽ không bị bộ cài AWord cài lại khi cập nhật.`;

function buocChonNhomKyNang(goiY: string): string {
    return `Hỏi tôi bằng AskUserQuestion (chọn nhiều) có muốn TẮT bớt nhóm kỹ năng không dùng tới để Claude gọn và tiết kiệm token không. MẶC ĐỊNH GIỮ TẤT CẢ — tôi không chọn tắt nhóm nào thì không đụng tới. Gợi ý cho vai trò của tôi: ${goiY}
${NHOM_KY_NANG}
Cách làm: ${CACH_BAT_TAT_KY_NANG}`;
}

// Quy tắc làm việc ghi vào CLAUDE.md ở gốc thư mục làm việc — nhánh CÔNG CHỨC HÀNH CHÍNH (cũng là
// bản mặc định khi AWord tự tạo Documents\AWord ở lần chạy đầu).
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
- ".aword/bo-nho/" (ẩn) → bộ nhớ làm việc, đọc/ghi theo skill bo-nho-lam-viec (quy ước chung trong AGENTS.md).`;

// Quy tắc làm việc ghi vào CLAUDE.md — nhánh GIÁO VIÊN. Tên thư mục khớp quy ước các skill dạy học
// (soan-ke-hoach-bai-day, ra-de-kiem-tra, soan-bai-trinh-chieu, tao-hoc-lieu-truc-quan...).
export const QUY_TAC_CLAUDE_MD_GIAO_VIEN = `# Quy tắc làm việc trong không gian này (giáo viên)

## Giao tiếp chung
- Trả lời ngắn gọn, thực tế, có cấu trúc; ưu tiên gợi ý áp dụng được ngay vào tiết dạy.
- Nếu có nhiều cách làm, so sánh ưu và nhược điểm. Chỉ ra sai sót thay vì chỉ đồng ý.
- Chỉ hỏi lại khi thật sự cần; khi cần thì dùng AskUserQuestion, hỏi từng câu một.

## Soạn tài liệu dạy học
- Kế hoạch bài dạy, đề kiểm tra, bài trình chiếu, học liệu số, thẩm định hồ sơ: dùng đúng skill
  tương ứng (soan-ke-hoach-bai-day, ra-de-kiem-tra, soan-bai-trinh-chieu, tao-hoc-lieu-truc-quan,
  tham-dinh-ho-so-day-hoc).
- Bám Chương trình GDPT 2018, yêu cầu cần đạt và bộ sách giáo khoa giáo viên đang dùng (ghi trong
  "HO SO CUA TOI/").
- Văn bản hành chính (báo cáo, kế hoạch của tổ, trường...): đúng thể thức Nghị định 30, soạn xong
  kiểm soát bằng skill the-thuc-van-ban-theo-nd30.
- Có tệp mẫu thì điền vào BẢN SAO của mẫu, không tạo tệp mới; chữ trong mẫu chỉ để tham khảo bố cục.
- Văn phong sư phạm chuẩn mực, trong sáng, phù hợp lứa tuổi học sinh; không emoji, không dấu * thừa.

## Nghiên cứu
- Phân biệt sự thật, giả định và ý kiến; không chắc thì nói rõ là không chắc.
- Kiến thức bộ môn, số liệu phải có nguồn: sách giáo khoa, chương trình, văn bản hướng dẫn chuyên
  môn (đủ số ký hiệu, ngày ban hành).

## Quy tắc ngôn ngữ
- Mọi tài liệu, tệp đầu ra tiếng Việt phải dùng tiếng Việt CÓ ĐẦY ĐỦ DẤU.

## Quy tắc thực hiện
- Không bao giờ xóa bất kỳ tệp nào.
- Chỉ đọc thư mục, tệp liên quan tới nhiệm vụ — không đọc tràn lan (tiết kiệm thời gian và token).

## Quy tắc thư mục
- "HO SO CUA TOI/" → thông tin giáo viên, lớp và môn phụ trách, bộ SGK, văn phong (chỉ đọc).
- "TU LIEU MON HOC/<Môn>/" → sách giáo khoa (thư mục SGK/), phân phối chương trình, yêu cầu cần đạt (chỉ đọc).
- "KE HOACH BAI DAY/<Môn>/Lop <X>/", "DE KIEM TRA/<Môn>/Lop <X>/", "BAI TRINH CHIEU/<Môn>/Lop <X>/",
  "HOC LIEU TRUC QUAN/<Môn>/" → nơi lưu sản phẩm theo từng loại; chưa có thư mục con thì tạo mới.
- "CLAUDE OUTPUTS/" → sản phẩm khác không thuộc các loại trên.
- ".aword/bo-nho/" (ẩn) → bộ nhớ làm việc, đọc/ghi theo skill bo-nho-lam-viec (quy ước chung trong AGENTS.md).`;

const MO_DAU_CHUNG = `Nếu tôi CHƯA mở thư mục làm việc nào, hãy nhắc tôi mở trước (menu Tệp → Mở thư mục) rồi mới tiếp tục.
Hỏi TỪNG CÂU MỘT — tuyệt đối không hỏi nhiều câu cùng lúc. Câu có phương án chọn thì dùng AskUserQuestion; câu cần tự nhập (họ tên, tên đơn vị...) thì hỏi bằng tin nhắn thường, kèm ví dụ để tôi tham khảo. Không xóa hay ghi đè tệp đã có (trừ CLAUDE.md theo bước bên dưới); thư mục đã tồn tại thì giữ nguyên.`;

// Nhánh 1: GIÁO VIÊN — ít việc hành chính, trọng tâm là tài liệu dạy học.
export const PROMPT_THIET_LAP_GIAO_VIEN = `Hãy giúp tôi thiết lập không gian làm việc AWord dành cho GIÁO VIÊN.
${MO_DAU_CHUNG}

1. Thu thập thông tin (lần lượt từng câu):
   a) Họ tên; trường, đơn vị công tác; tỉnh/thành phố.
   b) Cấp học: mầm non, tiểu học, THCS, THPT hay GDTX.
   c) Môn dạy và các lớp, khối phụ trách năm học này.
   d) Bộ sách giáo khoa đang dùng (Kết nối tri thức với cuộc sống, Chân trời sáng tạo, Cánh diều...).
   e) Nhiệm vụ kiêm nhiệm (chủ nhiệm lớp, tổ trưởng chuyên môn, phụ trách thiết bị, thư viện...).
   f) Việc muốn AWord hỗ trợ nhiều nhất (soạn kế hoạch bài dạy, ra đề kiểm tra, bài trình chiếu, học liệu và mô phỏng, thẩm định hồ sơ, văn bản của tổ/trường, nhận xét học sinh...).
   g) Thói quen soạn bài: mức độ chi tiết, phương pháp và kĩ thuật dạy học hay dùng, điều muốn tránh.
   h) Văn phong mong muốn; ví dụ một đoạn giáo án hoặc nhận xét tôi thấy ưng ý (nếu có).

2. Tạo cấu trúc thư mục: "HO SO CUA TOI/" (ghi profile.md và van-phong.md từ câu trả lời), "TU LIEU MON HOC/<Môn>/SGK/" cho từng môn tôi dạy, "KE HOACH BAI DAY/", "DE KIEM TRA/", "BAI TRINH CHIEU/", "HOC LIEU TRUC QUAN/", "CLAUDE OUTPUTS/".

3. Hướng dẫn ngắn gọn để tôi bỏ vào "TU LIEU MON HOC/<Môn>/": bản PDF sách giáo khoa (thư mục SGK/), phân phối chương trình, văn bản yêu cầu cần đạt — tư liệu càng đủ thì giáo án, đề kiểm tra càng bám sát.

4. Ghi CLAUDE.md ở gốc thư mục làm việc với NGUYÊN VĂN nội dung dưới đây (đã có CLAUDE.md thì thay toàn bộ nội dung bằng bản này):
---
${QUY_TAC_CLAUDE_MD_GIAO_VIEN}
---

5. Khởi tạo bộ nhớ làm việc theo skill bo-nho-lam-viec (thư mục ẩn .aword/bo-nho/ và tệp AGENTS.md). Ghi vào dai-han.md các ý chính: tên, trường, cấp học, môn và lớp phụ trách, bộ sách giáo khoa, việc cần hỗ trợ nhiều nhất.

6. ${buocChonNhomKyNang('giữ Nền tảng + Giáo dục + Thiết kế và trình bày; nhóm Nghiệp vụ hành chính và Lập trình có thể tắt nếu tôi không dùng.')}

Bắt đầu bằng câu hỏi đầu tiên ngay bây giờ.`;

// Nhánh 2: CÔNG CHỨC, VIÊN CHỨC công sở — nhiều việc hành chính, văn bản Nghị định 30.
export const PROMPT_THIET_LAP_HANH_CHINH = `Hãy giúp tôi thiết lập không gian làm việc AWord dành cho CÔNG CHỨC, VIÊN CHỨC làm công tác HÀNH CHÍNH.
${MO_DAU_CHUNG}

1. Thu thập thông tin (lần lượt từng câu):
   a) Họ tên; chức vụ.
   b) Cơ quan, đơn vị — nêu rõ là cơ quan Đảng hay cơ quan nhà nước, đơn vị sự nghiệp (để áp đúng thể thức văn bản).
   c) Phòng, ban và nhiệm vụ được phân công hiện tại.
   d) Loại văn bản hay soạn nhất (công văn, tờ trình, kế hoạch, báo cáo, quyết định, giấy mời...) và mức độ thường xuyên.
   e) Hệ thống đang dùng: phần mềm quản lý văn bản (VNPT iOffice...), Kho dữ liệu cơ quan của AWord đã kết nối chưa.
   f) Đối tượng hay làm việc (lãnh đạo, đơn vị cấp dưới, người dân, doanh nghiệp...) và mục tiêu dùng AWord.
   g) Giọng văn mong muốn, điều thích và không thích trong văn phong; ví dụ văn bản mẫu ưng ý (nếu có).

2. Tạo cấu trúc thư mục: "ABOUT ME/" (ghi profile.md và writing-style.md từ câu trả lời), "TEMPLATES/", "PROJECTS/", "CLAUDE OUTPUTS/".

3. Mẫu văn bản cho "TEMPLATES/": nếu MCP "khodulieu" (Kho dữ liệu cơ quan) đang kết nối — dùng kho_mau_list / kho_mau_goi_y chọn mẫu thật của cơ quan, kho_mau_tai_ve(id) tải FILE MẪU GỐC (giải mã base64, lưu .docx vào TEMPLATES/, giữ nguyên 100% thể thức), kèm kho_mau_noi_dung(id) để viết TEMPLATES/README.md mô tả cấu trúc; trong README ghi chú: khi soạn văn bản thật thì điền TRỰC TIẾP vào bản sao của file mẫu gốc, không dựng file mới, không dùng file_path (đường dẫn máy chủ kho). Chưa kết nối kho thì tự soạn khung mẫu chuẩn Nghị định 30 cho các loại văn bản ở câu d).

4. Ghi CLAUDE.md ở gốc thư mục làm việc với NGUYÊN VĂN nội dung dưới đây (đã có CLAUDE.md thì thay toàn bộ nội dung bằng bản này):
---
${QUY_TAC_CLAUDE_MD}
---

5. Khởi tạo bộ nhớ làm việc theo skill bo-nho-lam-viec (thư mục ẩn .aword/bo-nho/ và tệp AGENTS.md). Ghi vào dai-han.md các ý chính: tên, chức vụ, cơ quan (Đảng hay chính quyền), phòng ban và nhiệm vụ, loại văn bản thường soạn, hệ thống đang dùng.

6. ${buocChonNhomKyNang('giữ Nền tảng + Nghiệp vụ hành chính + Thiết kế và trình bày; nhóm Giáo dục và Lập trình có thể tắt nếu tôi không dùng.')}

Bắt đầu bằng câu hỏi đầu tiên ngay bây giờ.`;

// Bật/tắt nhóm kỹ năng bất cứ lúc nào (không cần thiết lập lại).
export const PROMPT_CHON_NHOM_KY_NANG = `Hãy giúp tôi bật/tắt các nhóm kỹ năng (skill) của AWord cho phù hợp công việc, để Claude gọn và tiết kiệm token hơn.
1. Liệt kê skill đang BẬT (thư mục con có SKILL.md trong %USERPROFILE%\\.claude\\skills\\) và đang TẮT (%USERPROFILE%\\.claude\\skills-tat\\), xếp theo các nhóm bên dưới; skill không thuộc nhóm nào ghi là "khác" và không đụng tới.
2. Hỏi tôi bằng AskUserQuestion (chọn nhiều) muốn giữ BẬT những nhóm nào; gợi ý theo vai trò của tôi nếu bộ nhớ làm việc hoặc hồ sơ có ghi. Tôi không chọn thay đổi thì giữ nguyên.
3. Thực hiện: ${CACH_BAT_TAT_KY_NANG}
4. Báo ngắn gọn đã bật, tắt những skill nào và nhắc tôi mở cuộc trò chuyện mới để áp dụng.

${NHOM_KY_NANG}`;

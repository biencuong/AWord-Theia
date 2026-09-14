// Các prompt "Thiết lập ban đầu" dùng ở trang chào mừng: nút bấm sao chép prompt vào clipboard
// rồi mở khung chat Claude để người dùng dán và gửi. Hai nhánh theo vai — GIÁO VIÊN (thư mục
// Documents\AWord\GIAO VIEN, quy tắc vai Giáo viên do AWord nạp vào CLAUDE.md cấp người dùng khi chọn
// vai ở trang Chào mừng) và CÔNG CHỨC, VIÊN CHỨC làm công tác hành chính — mỗi nhánh có bộ câu hỏi,
// cấu trúc thư mục và CLAUDE.md riêng; cả hai cùng khởi tạo bộ nhớ làm việc (skill bo-nho-lam-viec).
// LƯU Ý khi sửa: trong template literal phải viết "\\" cho mỗi dấu "\" của đường dẫn Windows.
import { QUY_TAC_CLAUDE_MD, QUY_TAC_CLAUDE_MD_GIAO_VIEN } from '../common/quy-tac-workspace';

// Hai hằng quy tắc workspace nay nằm ở common/ (backend cũng dùng) — tái xuất để mã cũ import từ đây vẫn chạy.
export { QUY_TAC_CLAUDE_MD, QUY_TAC_CLAUDE_MD_GIAO_VIEN };

// Nhóm kỹ năng — dùng chung cho bước chọn nhóm ở cả hai nhánh và nút "Bật/tắt nhóm kỹ năng".
const NHOM_KY_NANG = `Các nhóm kỹ năng của AWord:
- Nền tảng (LUÔN BẬT, không tắt): bo-nho-lam-viec, doc-van-ban-local, docx, xlsx, pptx, pdf.
- Nghiệp vụ hành chính: the-thuc-van-ban-theo-nd30, so-gd-cds-tao-van-ban, ioffice-vanban-den, xu-ly-van-ban-den-xlc, nghiep-vu-tong-hop-bao-cao, internal-comms, doc-coauthoring.
- Giáo dục, dạy học: soan-ke-hoach-bai-day, ra-de-kiem-tra, soan-bai-trinh-chieu, tao-hoc-lieu-truc-quan, tham-dinh-ho-so-day-hoc, cap-nhat-quy-dinh-nam-hoc, tra-cuu-sgk, academic-pptx.
- Thiết kế và trình bày: design, design-system, brand, brand-guidelines, banner-design, canvas-design, theme-factory, slides, ui-styling, ui-ux-pro-max, frontend-design.
- Lập trình và kỹ thuật (ít dùng cho văn phòng): claude-api, mcp-builder, webapp-testing, web-artifacts-builder, skill-creator, slack-gif-creator, algorithmic-art.
Phụ thuộc: nếu GIỮ nhóm Giáo dục thì KHÔNG tắt canvas-design, frontend-design, web-artifacts-builder, slack-gif-creator, webapp-testing (skill dạy học dùng kèm).`;

const CACH_BAT_TAT_KY_NANG = `TẮT một skill = chuyển thư mục %USERPROFILE%\\.claude\\skills\\<tên> sang %USERPROFILE%\\.claude\\skills-tat\\<tên>; BẬT lại = chuyển ngược về (PowerShell Move-Item). TUYỆT ĐỐI không xóa thư mục skill nào. Skill đã tắt sẽ không bị bộ cài AWord cài lại khi cập nhật.`;

function buocChonNhomKyNang(goiY: string): string {
    return `Hỏi tôi bằng AskUserQuestion (chọn nhiều) có muốn TẮT bớt nhóm kỹ năng không dùng tới để Claude gọn và tiết kiệm token không. MẶC ĐỊNH GIỮ TẤT CẢ — tôi không chọn tắt nhóm nào thì không đụng tới. Gợi ý cho vai trò của tôi: ${goiY}
${NHOM_KY_NANG}
Cách làm: ${CACH_BAT_TAT_KY_NANG}`;
}

const MO_DAU_CHUNG = `Nếu tôi CHƯA mở thư mục làm việc nào, hãy nhắc tôi mở trước (menu Tệp → Mở thư mục) rồi mới tiếp tục.
Hỏi TỪNG CÂU MỘT — tuyệt đối không hỏi nhiều câu cùng lúc. Câu có phương án chọn thì dùng AskUserQuestion; câu cần tự nhập (họ tên, tên đơn vị...) thì hỏi bằng tin nhắn thường, kèm ví dụ để tôi tham khảo. Không xóa hay ghi đè tệp đã có (trừ CLAUDE.md theo bước bên dưới); thư mục đã tồn tại thì giữ nguyên.`;

// Nhánh 1: GIÁO VIÊN — không gian Documents\AWord\GIAO VIEN (AWord tạo sẵn khi chọn vai Giáo viên).
export const PROMPT_THIET_LAP_GIAO_VIEN = `Hãy giúp tôi thiết lập không gian làm việc AWord dành cho GIÁO VIÊN.
${MO_DAU_CHUNG}
Thư mục giáo viên là Documents\\AWord\\GIAO VIEN (AWord đã tạo sẵn khi tôi chọn vai Giáo viên ở trang Chào mừng). Nếu thư mục làm việc đang mở là Documents\\AWord thì MỌI thư mục, tệp dưới đây nằm trong thư mục con "GIAO VIEN/"; nếu tôi đang mở thẳng thư mục GIAO VIEN thì nằm ở gốc. Nếu chưa có thư mục GIAO VIEN thì tạo.

1. Thu thập thông tin (lần lượt từng câu):
   a) Họ tên; trường, đơn vị công tác; tỉnh/thành phố.
   b) VAI TRÒ chính: giáo viên bộ môn / giáo viên chủ nhiệm / tổ trưởng-tổ phó chuyên môn / cán bộ quản lý (BGH) / giáo sinh-giáo viên mới vào nghề (vai trò quyết định cách bạn phục vụ tôi: giáo sinh cần giải thích lý do sư phạm như người hướng dẫn; tổ trưởng cần thêm góc thẩm định, hồ sơ tổ; quản lý cần góc duyệt và chuẩn hóa).
   c) Cấp học: mầm non, tiểu học, THCS, THPT hay GDTX (mầm non thì hỏi nhóm lớp - độ tuổi thay cho môn).
   d) Môn dạy và các khối lớp phụ trách năm học này.
   e) Nhiệm vụ kiêm nhiệm (chủ nhiệm lớp, tổ trưởng chuyên môn, phụ trách thiết bị, thư viện...).
   f) Việc muốn AWord hỗ trợ nhiều nhất (soạn kế hoạch bài dạy, ra đề kiểm tra, bài trình chiếu, học liệu và mô phỏng, thẩm định hồ sơ, văn bản của tổ/trường, nhận xét học sinh...).
   g) Thói quen soạn bài: mức độ chi tiết, phương pháp và kĩ thuật dạy học hay dùng, thiết bị sẵn có ở trường, điều muốn tránh.
   h) Văn phong mong muốn; ví dụ một đoạn giáo án hoặc nhận xét tôi thấy ưng ý (nếu có).
   Về SGK: KHÔNG cần hỏi — từ năm học 2026-2027 cả nước dùng thống nhất bộ "Kết nối tri thức với cuộc sống" (Quyết định 3588/QĐ-BGDĐT ngày 26/12/2025); chỉ hỏi lại nếu tôi nói đang soạn theo học liệu khác.

2. Tạo cấu trúc thư mục (thiếu cái nào tạo cái đó): "HO SO CUA TOI/" (ghi ho-so-giao-vien.md — toàn bộ thông tin phỏng vấn, mon-lop.md — bảng môn × khối lớp, van-phong.md), "TU LIEU MON HOC/<Môn>/SGK/" cho từng môn tôi dạy (kèm README nhắc bỏ phân phối chương trình, sách giáo viên vào đúng thư mục môn), "KE HOACH BAI DAY/", "DE KIEM TRA/", "BAI TRINH CHIEU/", "HOC LIEU TRUC QUAN/", "BO NHO/". Ghi "HO SO CUA TOI/tri-thuc-cua-toi.md": chỉ mục cho biết với cấp học và các môn của tôi thì mỗi skill dạy học cần đọc đúng file/mục references nào (khung KHBD theo cấp, mục môn trong ppdh-bo-mon.md và ppdh-cap-*.md).

3. Kho SGK: nếu trong phiên có các công cụ sgk_* thì gọi sgk_trang_thai và cho tôi biết trạng thái bản quyền (chưa kích hoạt thì nói tôi có thể bảo "kiểm tra trạng thái Kho SGK" bất cứ lúc nào để thanh toán QR ngay trong chat, giá 50.000 đ/máy/năm). Nếu KHÔNG có công cụ sgk_*: nói ngắn gọn rằng muốn Claude tự tra SGK thì chạy "Kết nối Kho SGK (AWord)" trong Start Menu rồi mở lại AWord — không bắt buộc; không có kho thì tôi tự bỏ PDF SGK vào "TU LIEU MON HOC/<Môn>/SGK/".

4. Hỏi tôi (AskUserQuestion) có muốn NẠP NGAY yêu cầu cần đạt không: với từng môn × khối lớp đã khai, tra web chương trình môn học GDPT 2018 (Thông tư 32/2018/TT-BGDĐT) và lưu "TU LIEU MON HOC/<Môn>/yeu-cau-can-dat-lop-<X>.md" (ghi rõ nguồn) để soạn bài dùng offline. Mất vài phút; tôi có thể để sau (khi soạn bài đầu tiên Claude sẽ tự tra).

5. Ghi CLAUDE.md trong thư mục giáo viên (GIAO VIEN/CLAUDE.md, hoặc gốc nếu tôi đang mở thẳng GIAO VIEN) với NGUYÊN VĂN nội dung dưới đây (đã có thì thay toàn bộ nội dung bằng bản này):
---
${QUY_TAC_CLAUDE_MD_GIAO_VIEN}
---

6. Khởi tạo bộ nhớ làm việc theo skill bo-nho-lam-viec (thư mục ẩn .aword/bo-nho/ và tệp AGENTS.md ở gốc thư mục làm việc đang mở). Ghi vào dai-han.md các ý chính: tên, trường, vai trò, cấp học, môn và lớp phụ trách, việc cần hỗ trợ nhiều nhất, thiết bị sẵn có. Nếu "BO NHO/" đã có nội dung (chuyển từ AGiaoAn) thì đọc và gộp các ý bền vững vào dai-han.md.

7. ${buocChonNhomKyNang('giữ Nền tảng + Giáo dục + Thiết kế và trình bày; nhóm Nghiệp vụ hành chính và Lập trình có thể tắt nếu tôi không dùng.')}

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

// Kiểm tra trạng thái Kho SGK (bản quyền theo mã máy, thanh toán QR ngay trong chat).
export const PROMPT_KIEM_TRA_KHO_SGK = `Kiểm tra trạng thái Kho SGK cho tôi theo skill tra-cuu-sgk:
- Nếu có công cụ sgk_trang_thai: gọi nó và báo rõ mã máy, trạng thái bản quyền, hạn dùng, phiên bản kho đang dùng/mới nhất, giá, và chuyển NGUYÊN VĂN mọi thông báo (thong_bao) nếu có.
- Chưa kích hoạt hoặc hết hạn: gọi sgk_thanh_toan, hiện đầy đủ số tiền, ngân hàng, số tài khoản, chủ tài khoản, NỘI DUNG CHUYỂN KHOẢN chính xác, ảnh QR hoặc đường dẫn QR và trang thanh toán, hạn của đơn; sau khi tôi báo đã chuyển khoản thì gọi sgk_kiem_tra_thanh_toan(ma_don) và cho tôi biết kết quả.
- Nếu KHÔNG có công cụ sgk_* nào: hướng dẫn tôi chạy "Kết nối Kho SGK (AWord)" trong Start Menu (hoặc tệp Ket_Noi_KhoSGK.cmd trong thư mục cài AWord), nhấn Enter nhận địa chỉ mặc định, rồi mở lại AWord.`;

// "Bắt đầu nhanh" cho vai Giáo viên — bấm nút, dán vào chat là dùng được; chỗ [trong ngoặc] tự thay.
export interface PromptNhanh {
    icon: string;
    ten: string;
    prompt: string;
}

export const PROMPT_NHANH_GIAO_VIEN: PromptNhanh[] = [
    {
        icon: '📝',
        ten: 'Soạn kế hoạch bài dạy',
        prompt: 'Soạn kế hoạch bài dạy: môn [Toán], lớp [7], bài "[Số hữu tỉ]", thời lượng [1] tiết, SGK Kết nối tri thức với cuộc sống. Có Kho SGK (công cụ sgk_*) thì tra theo skill tra-cuu-sgk (sgk_muc_luc → sgk_bai) để bám đúng bài và trích dẫn "Theo SGK ... tr. ...". Soạn đúng khung quy định cho cấp học của tôi, bám yêu cầu cần đạt của chương trình GDPT 2018, tự kiểm theo tiêu chí Công văn 5555 rồi báo kết quả.'
    },
    {
        icon: '📋',
        ten: 'Ra đề kiểm tra',
        prompt: 'Ra đề kiểm tra [giữa kỳ I] môn [Toán] lớp [7], thời gian [90] phút: lập ma trận và bản đặc tả theo Công văn 7991/BGDĐT-GDTrH, rồi biên soạn đề + đáp án + hướng dẫn chấm, bám yêu cầu cần đạt các bài đã học. Có Kho SGK thì lấy phần bài tập, ghi nhớ của các bài trong phạm vi (sgk_bai với phan="bai-tap"/"ghi-nho") và sách bài tập làm ngân hàng câu hỏi.'
    },
    {
        icon: '📽️',
        ten: 'Soạn bài trình chiếu từ KHBD',
        prompt: 'Soạn bài trình chiếu (.pptx) cho kế hoạch bài dạy "[tên bài]" đã có trong thư mục KE HOACH BAI DAY — slide bám đúng tiến trình các hoạt động của bài, chữ to rõ phù hợp học sinh, câu hỏi tương tác đặt trước đáp án; hình minh họa lấy từ Kho SGK (sgk_hinh_theo_bai, tải bằng url_tai) nếu có.'
    },
    {
        icon: '🧪',
        ten: 'Tạo mô phỏng thí nghiệm ảo',
        prompt: 'Tạo mô phỏng thí nghiệm ảo (tệp HTML mở bằng trình duyệt, chạy offline) cho bài "[Sự nở vì nhiệt]" môn [KHTN] lớp [6] theo SGK Kết nối tri thức: đúng dụng cụ và hiện tượng như SGK mô tả (tra Kho SGK nếu có), có bảng điều khiển cho học sinh thay đổi tham số.'
    },
    {
        icon: '📚',
        ten: 'Kiểm tra trạng thái Kho SGK',
        prompt: PROMPT_KIEM_TRA_KHO_SGK
    },
    {
        icon: '📖',
        ten: 'Đọc, tóm tắt tài liệu',
        prompt: 'Đọc và tóm tắt giúp tôi tệp [kéo-thả hoặc gõ @ để chọn tệp] — nêu các ý chính, những việc giáo viên phải làm và mốc thời gian (nếu có).'
    }
];

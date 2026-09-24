---
name: thiet-ke-trinh-chieu
description: Thiết kế bài trình chiếu (.pptx) cho ĐẸP và chuyên nghiệp — chọn bộ màu, phông chữ, bố cục từng slide, cách trình bày số liệu, hình ảnh, biểu đồ; rà lỗi trình bày trước khi giao. Dùng khi người dùng nói "thiết kế slide", "làm slide cho đẹp", "trình chiếu chuyên nghiệp", "chỉnh lại bài trình chiếu", "slide báo cáo/hội nghị/tập huấn", hoặc khi tạo .pptx mà chưa có mẫu bắt buộc.
---

# Thiết kế bài trình chiếu

Kỹ năng này lo phần NHÌN của bài trình chiếu: màu, chữ, bố cục, hình, số liệu. Ba việc khác do skill khác lo:

| Việc | Skill |
|---|---|
| Kỹ thuật tạo/sửa tệp .pptx (python-pptx, pptxgenjs, đọc tệp có sẵn) | `pptx` — đọc trước khi dựng tệp |
| Nội dung và trình tự sư phạm của bài dạy | `soan-bai-trinh-chieu` |
| Báo cáo khoa học, hội thảo chuyên ngành (tiếng Anh) | `academic-pptx` |

Có mẫu bắt buộc của cơ quan (tệp .pptx/.potx nhận diện, bìa theo quy định) thì DÙNG MẪU ĐÓ, kỹ năng này chỉ
dùng để chọn bố cục và rà lỗi trình bày. Không tự đổi logo, màu nhận diện của cơ quan.

## Bước 1 — Hỏi đủ 4 điều (nếu người dùng chưa nói)

Hỏi gọn trong MỘT lượt, không hỏi lắt nhắt:

1. **Mục đích và thông điệp chính** — người nghe cần nhớ điều gì, cần quyết định gì.
2. **Người nghe và bối cảnh** — hội nghị ngành, họp nội bộ, tập huấn, lớp học, khách hàng; hội trường lớn hay phòng họp nhỏ.
3. **Thời lượng** — suy ra số slide: 1 slide cho 1–1,5 phút nói. 15 phút ≈ 10–14 slide.
4. **Ràng buộc nhận diện** — có mẫu/logo/màu cơ quan bắt buộc không; in ra giấy hay chỉ chiếu.

Người dùng đã đưa sẵn nội dung (văn bản, báo cáo, giáo án) thì đọc nội dung đó trước, chỉ hỏi phần còn thiếu.

## Bước 2 — Chọn bộ màu và phông chữ

Đọc `references/bang-mau-phong-chu.md`: 5 bộ màu dựng sẵn kèm mã màu và vai trò từng màu, phông chữ có sẵn
trên máy Windows tiếng Việt, thang cỡ chữ, cách kiểm tương phản. Chọn MỘT bộ màu rồi dùng nhất quán cả bài.

## Bước 3 — Dàn slide theo loại bài

| Loại bài | Dàn mặc định |
|---|---|
| Báo cáo sơ kết / tổng kết | Bìa → Nội dung chính (3–4 ý) → Kết quả nổi bật (số liệu) → Phân tích theo lĩnh vực → Tồn tại, hạn chế → Nguyên nhân → Phương hướng → Kiến nghị → Cảm ơn |
| Kế hoạch / đề án | Bìa → Căn cứ → Thực trạng → Mục tiêu (định lượng) → Nhiệm vụ, giải pháp → Lộ trình theo mốc → Nguồn lực → Phân công → Cảm ơn |
| Tập huấn / hướng dẫn nghiệp vụ | Bìa → Mục tiêu buổi tập huấn → Sơ đồ tổng thể → Từng bước (mỗi bước 1–2 slide, có ảnh màn hình) → Lỗi thường gặp → Thực hành → Hỏi đáp |
| Giới thiệu sản phẩm, giải pháp | Bìa → Vấn đề đang gặp → Cách giải quyết → Tính năng chính (3 thẻ) → Kết quả, minh chứng → Chi phí → Bước tiếp theo |

Mọi bài: sau bìa nên có 1 slide mục lục (3–5 mục), mỗi mục lớn có 1 slide phân cách.

## Bước 4 — Bố cục từng slide

Đọc `references/bo-cuc-slide.md`: lưới 12 cột, vùng an toàn, và 12 bố cục mẫu (bìa, mục lục, phân cách, một cột,
hai cột, ba thẻ, số liệu nổi bật, biểu đồ kèm nhận xét, ảnh lớn, dòng thời gian, bảng, kết luận) kèm tọa độ
theo inch để dựng thẳng bằng python-pptx.

## Bước 5 — Dựng tệp

Đọc `references/dung-bang-python-pptx.md`: bộ hàm dựng sẵn cho từng bố cục, biểu đồ, ảnh cắt đúng khung, bảng,
số trang, và cách xuất PDF. Kỹ thuật chung vẫn theo skill `pptx`.

## Bước 6 — Tự rà trước khi giao

Xuất PDF rồi **render vài trang thành ảnh và nhìn** (pymupdf có sẵn trên máy AWord) — đừng giao bài chỉ vì mã chạy xong.

- [ ] Mỗi slide một ý; tiêu đề slide là một câu khẳng định, không phải nhãn chung chung.
- [ ] Không quá 6 dòng, mỗi dòng không quá 12 chữ; không có đoạn văn dán nguyên từ báo cáo.
- [ ] Chữ nhỏ nhất ≥ 20pt (hội trường lớn ≥ 24pt); số liệu và nhãn biểu đồ ≥ 14pt.
- [ ] Tương phản chữ trên nền ≥ 4,5:1.
- [ ] Không chữ nào tràn khung hay đè lên hình; lề trái mọi slide thẳng hàng.
- [ ] Màu dùng đúng bộ đã chọn; màu nhấn chỉ dùng cho điểm cần chú ý.
- [ ] Ảnh đủ nét (không kéo giãn méo), có nguồn nếu lấy từ ngoài.
- [ ] Số liệu trên slide khớp số liệu trong văn bản gốc; biểu đồ có đơn vị, năm.
- [ ] Tiếng Việt đủ dấu, viết hoa đúng, không lỗi gõ; tên cơ quan viết đúng.
- [ ] Có số trang; slide cuối có lời cảm ơn và thông tin liên hệ nếu cần.

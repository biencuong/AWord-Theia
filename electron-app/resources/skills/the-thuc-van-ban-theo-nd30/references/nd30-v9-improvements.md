# V9 improvements

Đúc kết từ 1 phiên soạn thảo báo cáo NĐ30 thực tế (dựng lại từ mẫu nguồn có sẵn qua nhiều vòng sửa
theo phản hồi cụ thể) — xem `nd30-known-pitfalls-checklist.md` cho danh sách pitfall và
`nd30-end-to-end-drafting-workflow.md` cho quy trình tổng quát.

## Scripts mới
- `scripts/nd30_shape_and_measure.py` — đo font-metrics thật, Shape Line (VML), table fixed-layout,
  landscape appendix section, phát hiện/sửa từ mồ côi
- `scripts/compose_preserve_fixed_blocks.py` — chiến lược replicate opt-in giữ nguyên khối cố định
  (`--replicate-strategy preserve-fixed-blocks`)

## Refactor
- `ensure_page_numbers`/`set_run_tracking` chuyển từ `create_nd30_docx.py` sang `nd30_docx_tools.py`
  (thư viện dùng chung); `ensure_page_numbers` nhận thêm tham số `sections=` để bật số trang cho
  1 section cụ thể
- `nd30_docx_tools.reset_section_page_setup` mới — đặt lại tường minh khổ giấy/lề cho 1 section,
  bắt buộc gọi sau khi xoá hàng loạt nội dung trong văn bản nhiều section
- `compose_from_source_docx.clear_body_preserve_sections` tự chụp và khôi phục geometry section đầu
  trước/sau khi xoá, vá lỗi kế thừa nhầm sectPr của section sau

## Reference mới
- `nd30-replicate-fixed-block-preservation.md`, `nd30-line-rules-and-vml-shapes.md`,
  `nd30-table-fixed-layout.md`, `nd30-landscape-appendix-section.md`,
  `nd30-page-numbering-technique.md`, `nd30-orphan-word-control.md`,
  `nd30-spacing-and-line-rules.md`, `nd30-safe-iterative-build-workflow.md`,
  `nd30-end-to-end-drafting-workflow.md`, `nd30-known-pitfalls-checklist.md`

## Dọn dẹp
- Xoá tham chiếu tới `assets/templates/internal/`, `assets/profiles/internal/`,
  `assets/internal-corpus/` (không tồn tại trên đĩa) trong `SKILL.md` và
  `internal-template-library.md`

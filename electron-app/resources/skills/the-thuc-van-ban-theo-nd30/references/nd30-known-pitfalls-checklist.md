# Known pitfalls quick index

Mỗi dòng là 1 pitfall đã gặp thực tế. Không viết dạng nhật ký/ngày tháng/tường thuật. Nếu 1
pitfall đã có file chủ đề riêng, chỉ ghi 1 dòng trỏ sang đó. Khi thêm dòng mới trùng ý với dòng đã
có, sửa dòng cũ thay vì thêm dòng mới.

- Xoá paragraph chứa section-break làm mất orientation của section trước → xem
  `nd30-landscape-appendix-section.md`
- Ghi đè `cell.text = ""` phá format "Nơi nhận" có nhiều kiểu run khác nhau trong cùng ô → xem
  `nd30-replicate-fixed-block-preservation.md`
- Condense character spacing quá mạnh (>0.5pt) làm chữ dính/lồng vào nhau → xem
  `nd30-orphan-word-control.md`
- Chỉ set `cell.width` mà không set `tblLayout=fixed` khiến Word tự autofit lại, bảng không đúng
  độ rộng đã định → xem `nd30-table-fixed-layout.md`
- Dùng ký tự Unicode (`─`/`___`) làm đường kẻ khiến độ dài không khớp chữ phía trên → xem
  `nd30-line-rules-and-vml-shapes.md`
- Ước lượng độ dài chữ bằng mắt/đếm ký tự thay vì đo font thật → sai lệch đáng kể, xem
  `nd30-line-rules-and-vml-shapes.md`
- `generate_replicate_shell()` rebuild toàn bộ khối cố định bằng width cột cứng, không giữ tỷ lệ
  mẫu nguồn → xem `nd30-replicate-fixed-block-preservation.md`
- Số trang đặt/hiện sai vị trí (footer thay vì header giữa lề trên, hoặc hiện cả ở trang đầu) → xem
  `nd30-page-numbering-technique.md`
- Sửa file `.docx` đang mở trong Word gây `PermissionError` khi lưu, cần bắt lỗi và yêu cầu đóng
  file → xem `nd30-safe-iterative-build-workflow.md`

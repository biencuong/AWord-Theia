# Bảng màu và phông chữ

## 1. Năm bộ màu dựng sẵn

Mỗi bộ gồm 5 vai trò. Dùng ĐÚNG vai trò, không đảo lung tung:

- **Nền** — nền slide nội dung (gần như luôn là màu sáng; nền tối chỉ dùng cho bìa và slide phân cách).
- **Chữ** — chữ nội dung trên nền.
- **Chủ đạo** — tiêu đề, thanh tiêu đề, nền slide phân cách.
- **Nhấn** — điểm cần chú ý: số liệu nổi bật, gạch chân tiêu đề, cột quan trọng trong biểu đồ. Mỗi slide chỉ nhấn 1–2 chỗ.
- **Phụ** — đường kẻ, khung, chữ chú thích, cột "phần còn lại" trong biểu đồ.

| Bộ | Dùng cho | Nền | Chữ | Chủ đạo | Nhấn | Phụ |
|---|---|---|---|---|---|---|
| Hành chính trang trọng | Hội nghị ngành, báo cáo trước lãnh đạo, sơ kết – tổng kết | `#FFFFFF` | `#1A1A1A` | `#0B3D91` | `#C81E2B` | `#5B6B7C` |
| Giáo dục | Tập huấn giáo viên, hội thảo chuyên môn, bài giảng cấp THCS – THPT | `#FFFFFF` | `#1F2933` | `#0F6E3F` | `#F2A900` | `#6B7A86` |
| Chuyển đổi số | Đề án, giải pháp công nghệ, giới thiệu phần mềm | `#F7F9FC` | `#17212B` | `#1565C0` | `#00B8A9` | `#7B8794` |
| Số liệu | Báo cáo nhiều biểu đồ, bảng thống kê | `#FFFFFF` | `#22262A` | `#37474F` | `#E4572E` | `#90A4AE` |
| Tươi sáng (tiểu học) | Bài giảng tiểu học, hoạt động trải nghiệm | `#FFFDF7` | `#2B2B2B` | `#E4572E` | `#2E9CCA` | `#F4A259` |

Slide bìa và slide phân cách của mọi bộ: nền màu **chủ đạo**, chữ trắng `#FFFFFF`.

Dãy màu cho biểu đồ nhiều cột (dùng theo thứ tự, không dùng quá 5 màu trên một biểu đồ):
`#0B3D91`, `#1565C0`, `#4A90D9`, `#8AB6E8`, `#C6DAF3` — cùng một tông, đậm dần về trước. Cần phân biệt mạnh
(ví dụ đạt / chưa đạt) thì dùng màu **nhấn** cho phần cần chú ý và màu **phụ** cho phần còn lại.

## 2. Phông chữ

Chỉ dùng phông chắc chắn có trên máy Windows tiếng Việt — phông lạ khi mở máy khác sẽ bị thay, vỡ bố cục:

| Phông | Có sẵn | Dùng |
|---|---|---|
| Segoe UI | Windows 10/11 | Mặc định cho slide: tiêu đề và nội dung |
| Arial | Windows, Office | Thay thế an toàn nhất khi gửi máy khác |
| Calibri | Office | Nội dung, đỡ cứng hơn Arial |
| Times New Roman | Windows, Office | Chỉ dùng khi trích nguyên văn bản hành chính trên slide |

Không dùng quá 2 phông trong một bài. Chữ trên slide luôn để **không nghiêng**, nghiêng chỉ dùng cho trích dẫn.

## 3. Thang cỡ chữ (slide 16:9)

| Thành phần | Phòng họp | Hội trường lớn |
|---|---|---|
| Tiêu đề bìa | 40–44pt | 44–54pt |
| Tiêu đề slide | 28–32pt | 32–36pt |
| Nội dung cấp 1 | 20–24pt | 24–28pt |
| Nội dung cấp 2 | 18–20pt | 22–24pt |
| Số liệu nổi bật | 54–72pt | 60–80pt |
| Nhãn biểu đồ, chú thích ảnh | 14–16pt | 16–18pt |
| Chân slide, số trang | 10–12pt | 12–14pt |

Không dùng chữ dưới 14pt trên slide. Nội dung dài quá khung thì TÁCH SLIDE, không thu nhỏ chữ.

## 4. Kiểm tương phản

Chữ trên nền phải đạt tỷ lệ tương phản ≥ 4,5:1 (chữ lớn ≥ 24pt đậm: ≥ 3:1). Kiểm nhanh bằng Python:

```python
def do_sang(mau):  # mau: '#RRGGBB'
    def kenh(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(mau[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * kenh(r) + 0.7152 * kenh(g) + 0.0722 * kenh(b)

def tuong_phan(mau1, mau2):
    a, b = sorted((do_sang(mau1), do_sang(mau2)), reverse=True)
    return round((a + 0.05) / (b + 0.05), 2)

print(tuong_phan('#1A1A1A', '#FFFFFF'))  # 18.1 — đạt
print(tuong_phan('#F2A900', '#FFFFFF'))  # 1.96 — KHÔNG đạt, màu nhấn này chỉ dùng làm nền hoặc khối màu
```

Màu nhấn sáng (vàng, cam, xanh ngọc) thường KHÔNG đạt khi làm chữ trên nền trắng — dùng nó cho khối màu,
đường gạch chân, cột biểu đồ; chữ vẫn để màu chữ hoặc màu chủ đạo.

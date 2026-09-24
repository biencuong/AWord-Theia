# Khuôn SVG theo môn

> Chép khuôn rồi **tính lại toạ độ theo số liệu bài** — khuôn chỉ định hình cách dựng, không phải số liệu đúng.

## 0. Khung chung mọi hình

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" width="420" height="300"
     font-family="'Times New Roman', 'Source Serif Pro', serif" font-size="14">
  <rect width="420" height="300" fill="#fff"/>
  <g stroke="#000" stroke-width="1.6" fill="none" stroke-linecap="round">

    <!-- nét vẽ ở đây -->

  </g>
  <g fill="#000" stroke="none" font-style="italic">
    <!-- nhãn điểm ở đây -->
  </g>
</svg>
```

**Quy ước dùng chung**
- Nét chính `stroke-width="1.6"`; nét phụ/đường dẫn `1.0`; đường phụ chứng minh `1.2` + `stroke-dasharray="7 4"`.
- Nhãn điểm: `font-style="italic"`, cỡ 14 (khổ A4 in ra ~ 9–10 pt).
- Chấm điểm: `<circle cx="…" cy="…" r="2.6" fill="#000"/>`.
- Mũi tên: dùng `<marker>` khai báo một lần trong `<defs>` (xem khuôn lực).
- Đặt `viewBox` sát nội dung — thừa nhiều lề thì hình in ra bị nhỏ.

## 1. Hình học — tam giác có đường cao

Chọn toạ độ sao cho hình cân đối trong khung. Ví dụ A(60,240) B(340,240) C(180,60):

```svg
<polygon points="60,240 340,240 180,60"/>
<!-- chân đường cao từ C xuống AB: H=(180,240) vì AB nằm ngang -->
<line x1="180" y1="60" x2="180" y2="240" stroke-dasharray="7 4" stroke-width="1.2"/>
<!-- ký hiệu vuông tại H: cạnh 12px, nằm trong góc -->
<path d="M180,228 h12 v12" stroke-width="1.2"/>
<circle cx="180" cy="240" r="2.6" fill="#000" stroke="none"/>
```

Nhãn: `A` đặt tại (46,256), `B` tại (346,256), `C` tại (176,50), `H` tại (188,258).

**Kiểm ràng buộc trước khi giao:**
- Vuông: `(A−H)·(C−H) = 0` → với số trên: `(60−180)(180−180) + (240−240)(60−240) = 0` ✔
- Trung điểm M của BC: `((340+180)/2, (240+60)/2) = (260,150)` — tính, không đặt mắt.

**Đường tròn ngoại tiếp:** tâm là giao hai đường trung trực — giải hệ, rồi vẽ `circle` với bán kính = khoảng
cách từ tâm tới một đỉnh (kiểm cả ba đỉnh cho bằng nhau).

## 2. Biểu diễn lực

```svg
<defs>
  <marker id="mt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
    <path d="M0,0 L10,5 L0,10 z" fill="#000"/>
  </marker>
</defs>
<!-- vật: hình chữ nhật -->
<rect x="150" y="150" width="120" height="70"/>
<!-- trọng lực: từ trọng tâm (210,185) xuống -->
<line x1="210" y1="185" x2="210" y2="265" marker-end="url(#mt)"/>
<text x="218" y="250" font-style="italic">P</text>
<!-- phản lực: từ mặt tiếp xúc lên, dài BẰNG P vì cùng độ lớn -->
<line x1="210" y1="220" x2="210" y2="140" marker-end="url(#mt)"/>
<text x="218" y="145" font-style="italic">N</text>
```

**Bắt buộc:** độ dài mũi tên **tỉ lệ độ lớn**; ghi tỉ xích dưới hình, ví dụ `1 cm ↔ 20 N`.

## 3. Mạch điện

```svg
<!-- khung mạch chữ nhật: (60,60) → (360,240) -->
<path d="M60,60 H200 M240,60 H360 V240 H60 V60" />
<!-- nguồn ở cạnh trái, giữa (60,150): vạch dài = cực dương -->
<line x1="52" y1="140" x2="68" y2="140" stroke-width="1.4"/>   <!-- dài -->
<line x1="56" y1="160" x2="64" y2="160" stroke-width="3.2"/>   <!-- ngắn, đậm -->
<text x="30" y="146">+</text><text x="30" y="168">−</text>
<!-- điện trở trên cạnh ngang -->
<rect x="200" y="52" width="40" height="16" fill="#fff"/>
<text x="215" y="44">R₁</text>
<!-- ampe kế nối tiếp: vòng tròn có A -->
<circle cx="300" cy="60" r="14" fill="#fff"/><text x="294" y="65">A</text>
<!-- khoá K trên cạnh phải -->
<circle cx="360" cy="120" r="2.4" fill="#000"/><circle cx="360" cy="150" r="2.4" fill="#000"/>
<line x1="360" y1="120" x2="372" y2="105"/>
<text x="376" y="112">K</text>
```

Chỗ nối dây: chấm đặc `r="2.2"`. Dây **vuông góc**, không chéo.

## 4. Quang học — thấu kính hội tụ

```svg
<!-- trục chính: nét chấm gạch -->
<line x1="20" y1="150" x2="400" y2="150" stroke-dasharray="12 4 2 4" stroke-width="1"/>
<!-- thấu kính tại x=210 -->
<line x1="210" y1="60" x2="210" y2="240" stroke-width="1.8"/>
<path d="M210,60 l-6,-10 M210,60 l6,-10" stroke-width="1.8"/>   <!-- mũi tên ra ngoài: hội tụ -->
<path d="M210,240 l-6,10 M210,240 l6,10" stroke-width="1.8"/>
<!-- quang tâm O, tiêu điểm F (x=210-90=120) và F' (x=300) -->
<circle cx="210" cy="150" r="2.6" fill="#000"/><text x="214" y="166">O</text>
<circle cx="120" cy="150" r="2.4" fill="#000"/><text x="114" y="168">F</text>
<circle cx="300" cy="150" r="2.4" fill="#000"/><text x="294" y="168">F′</text>
<!-- vật: mũi tên thẳng đứng tại x=150, cao 60 -->
<line x1="150" y1="150" x2="150" y2="90" marker-end="url(#mt)"/><text x="134" y="84">A</text><text x="134" y="166">B</text>
```

**Kiểm bằng công thức:** $\frac{1}{f}=\frac{1}{d}+\frac{1}{d'}$ với $f=90$. Vật $d=60$ → $d'=\frac{90\cdot60}{60-90}=-180$
→ ảnh **ảo**, cùng chiều, cao gấp $\frac{|d'|}{d}=3$ lần. Vẽ ảnh bằng mũi tên **nét đứt** tại $x=150-180=-30$
(không lọt khung thì phải tăng `viewBox` hoặc giảm $d$).

## 5. Đồ thị hàm số

```svg
<!-- hệ trục: gốc O(60,240), Ox dài 320, Oy cao 200 -->
<line x1="60" y1="240" x2="390" y2="240" marker-end="url(#mt)"/>
<line x1="60" y1="240" x2="60" y2="30" marker-end="url(#mt)"/>
<text x="394" y="246" font-style="italic">x</text><text x="42" y="28" font-style="italic">y</text>
<text x="44" y="256" font-style="italic">O</text>
<!-- parabol y = x²/4 - 2x + 3 vẽ bằng path trơn, tính ≥ 7 điểm -->
<path d="M60,180 C100,120 140,80 180,60 C220,40 260,60 300,120" fill="none" stroke-width="1.8"/>
```

Thang chia **đều nhau**: mỗi 40 px = 1 đơn vị thì đánh số 1, 2, 3… đúng vị trí. Ghi nhãn trục và đơn vị.

## 6. Xuất PNG để chèn vào Word/PowerPoint

Giữ `.svg` làm bản nguồn (sửa được), xuất thêm `.png` 300 dpi:

```powershell
# Cách chắc chắn nhất: mở SVG bằng trình duyệt rồi chụp ở tỉ lệ 3x
# Hoặc dùng Python (cairosvg) nếu máy đã cài:
python -c "import cairosvg; cairosvg.svg2png(url='hinh.svg', write_to='hinh.png', scale=3)"
```

Không có `cairosvg` thì dùng `rsvg-convert`, hoặc mở SVG trong Chrome → in PDF → cắt ảnh. **Đừng chụp
màn hình** — nét sẽ nhoè khi in.

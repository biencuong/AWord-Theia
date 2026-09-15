# Ảnh AWord Web chạy Linux

Mỗi tài khoản AWord Web chạy trong **một container riêng** tạo từ ảnh này. Bộ điều phối (`src/dieu-phoi/`, trình
`docker`) tự tạo, đánh thức, cho ngủ và xóa container — quản trị chỉ cần build ảnh và chuẩn bị mạng/tường lửa.

> **Trạng thái:** Dockerfile CHƯA được build thử (máy phát triển chưa có Docker). Lần build đầu trên WSL2/Ubuntu cần
> kiểm tra kỹ các mục ở phần [Chưa kiểm chứng](#chưa-kiểm-chứng).

## Build

```bash
# chạy ở THƯ MỤC GỐC repo AWord-Theia (ngữ cảnh build = cả repo)
docker build -f aword-web-server/docker/Dockerfile -t aword-web:latest .
# máy chủ ARM:
docker build -f aword-web-server/docker/Dockerfile --build-arg CLAUDE_CODE_NEN_TANG=linux-arm64 -t aword-web:latest .
```

- Cần BuildKit (mặc định từ Docker 23) để dùng `Dockerfile.dockerignore` nằm cạnh Dockerfile. Builder cũ: chép tệp đó
  thành `.dockerignore` ở gốc repo.
- Tên ảnh phải khớp `AWORD_WEB_ANH` của máy chủ (mặc định `aword-web:latest`). Build ảnh mới rồi cho các phiên ngủ/đánh
  thức lại là người dùng nhận bản mới (container luôn được tạo lại khi đánh thức).

### Các tầng

| Tầng | Việc |
|---|---|
| `build` (`node:24-bookworm`) | `npm ci --ignore-scripts` → tải plugin Claude Code **linux-x64** (đổi URL `win32-x64` trong `theiaPlugins` của browser-app) + chạy `scripts/localize-claude-code-vi.cjs` → `npm rebuild` (native module build trên Linux) → gói tiếng Việt (`sync-i18n-vi.mjs`) → build `aword-chat` → `theia build --mode production` |
| `runtime` (`node:24-bookworm-slim`) | `browser-app/{package.json,lib,plugins}` (backend đã được esbuild gói kèm native module trong `lib/backend/native`), tài nguyên vai Giáo viên + `hook_trithuc.mjs`, Python 3 + python-docx/openpyxl/xlrd/pypdf/pymupdf/pdfplumber/pillow, LibreOffice writer/calc không giao diện, git, ripgrep, phông DejaVu/Liberation |

Người dùng trong container: `aword` (uid/gid **1000**, không root), home `/home/aword`, cổng **3000**. `ENTRYPOINT`
(`entrypoint.sh`) tạo cây thư mục home, nối skill hệ thống rồi chạy
`node lib/backend/main.js --hostname=0.0.0.0 --port=3000 --plugins=local-dir:... /home/aword/Documents/AWord`.

## Container do bộ điều phối tạo

Tương đương lệnh (để chạy thử bằng tay):

```bash
docker network create --driver bridge \
  -o com.docker.network.bridge.enable_icc=false \
  -o com.docker.network.bridge.name=br-aword-phien aword-phien

docker run -d --name aword-phien-7 --hostname aword-phien-7 \
  --label aword.tai-khoan=7 --label aword.he-thong=aword-web \
  --user 1000:1000 --init \
  -v /srv/aword/du-lieu/tai-khoan/7:/home/aword:rw \
  -v /srv/aword/du-lieu/he-thong:/opt/aword-he-thong:ro \
  --memory 2g --memory-swap 2g --cpus 2 --pids-limit 512 \
  --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m \
  --network aword-phien --add-host host.docker.internal:host-gateway \
  -e ANTHROPIC_BASE_URL=http://host.docker.internal:8080/ai -e ANTHROPIC_AUTH_TOKEN=<token Cổng AI> \
  -e HOME=/home/aword -e AWORD_HOME=/home/aword \
  -e CLAUDE_CONFIG_DIR=/home/aword/.claude -e THEIA_CONFIG_DIR=/home/aword/.theia \
  aword-web:latest
```

- **Ngủ = stop + xóa container; đánh thức = tạo lại.** Token Cổng AI đổi mỗi lần khởi động mà biến môi trường của
  container không sửa được; tạo lại cũng nhận ngay ảnh mới. Mọi dữ liệu người dùng nằm ở thư mục gắn vào nên an toàn.
- Container trùng tên nhưng thiếu nhãn `aword.tai-khoan=<id>` → bộ điều phối từ chối, không tự xóa.
- Địa chỉ phiên = IP container trong mạng `aword-phien`, cổng 3000. Máy chủ AWord Web phải gọi được IP đó: chạy máy chủ
  trên chính máy Docker (hoặc trong container gắn vào mạng `aword-phien`). Trên máy Windows + WSL2, chạy máy chủ TRONG WSL.
- Tùy chỉnh bằng biến môi trường của máy chủ: `AWORD_DOCKER_BO_NHO_MB` (2048), `AWORD_DOCKER_CPU` (2), `AWORD_DOCKER_PIDS`
  (512), `AWORD_DOCKER_MANG` (aword-phien), `AWORD_DOCKER_MANG_NOI_BO=1`, `AWORD_DOCKER_PROXY`, `DOCKER_HOST`
  (`unix://`, `npipe://`, `tcp://` không TLS).

### Quyền thư mục

Người dùng trong container là uid 1000 nên thư mục `du-lieu/tai-khoan/<id>` trên máy chủ phải ghi được bởi uid 1000:
chạy máy chủ AWord Web bằng uid 1000, hoặc bằng root (bộ điều phối tự `chown 1000:1000` các thư mục khung khi chạy bằng
root). Tệp quản trị chép thẳng vào ổ người dùng bằng root thì phải `chown -R 1000:1000` sau khi chép.

## Mạng — chặn ra ngoài, chỉ cho Cổng AI và MCP

Mạng `aword-phien` luôn **tắt liên lạc giữa các container** (`enable_icc=false`): phiên của người này không gọi được
Theia của người khác (Theia có API tệp qua HTTP). Việc chặn Internet chọn một trong hai phương án:

### Phương án A (mặc định Giai đoạn 1): bridge thường + tường lửa máy chủ

Cổng AI chạy trên máy chủ, container gọi qua `host.docker.internal` (host-gateway). Luồng container → máy chủ đi qua
chuỗi `INPUT`; container → Internet đi qua `FORWARD`/`DOCKER-USER`.

```bash
BR=br-aword-phien
# Ra Internet: chặn hết, chỉ mở DNS và các máy MCP/Kho tri thức (IP cụ thể). Chèn theo thứ tự ngược (luật chèn sau nằm trên).
iptables -I DOCKER-USER -i $BR -j DROP
iptables -I DOCKER-USER -i $BR -d <IP kho dữ liệu MCP> -p tcp --dport 443 -j ACCEPT
iptables -I DOCKER-USER -i $BR -d <IP trithuc.aword.vn> -p tcp --dport 443 -j ACCEPT
iptables -I DOCKER-USER -i $BR -p udp --dport 53 -j ACCEPT
iptables -I DOCKER-USER -i $BR -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# Vào máy chủ: chỉ cổng của AWord Web (Cổng AI)
iptables -I INPUT -i $BR -j DROP
iptables -I INPUT -i $BR -p tcp --dport 8080 -j ACCEPT
iptables -I INPUT -i $BR -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
```

Lưu ý: máy chủ AWord Web phải nghe được trên giao diện docker (`AWORD_WEB_NGHE=0.0.0.0` hoặc IP gateway của bridge) —
mặc định `127.0.0.1` thì container không gọi được Cổng AI. Luật iptables mất sau khi khởi động lại máy: lưu bằng
`iptables-persistent`. **Phần còn thiếu:** lọc theo IP không theo kịp tên miền đổi IP (CDN); `pip install`, `git clone`,
tải mô hình... từ Internet sẽ bị chặn (thư viện đọc tài liệu đã cài sẵn trong ảnh).

### Phương án B: mạng internal + proxy lọc tên miền

`AWORD_DOCKER_MANG_NOI_BO=1` tạo mạng `Internal` (không có đường ra ngoài, không có host-gateway). Khi đó:

1. Cổng AI phải nằm TRONG mạng `aword-phien`: chạy máy chủ AWord Web trong container gắn vào mạng này
   (`AWORD_WEB_CONG_AI_CHO_PHIEN=http://aword-cong:8080/ai`) — hoặc một reverse proxy nhỏ trong mạng chuyển tới máy chủ.
2. Một container proxy (Squid/tinyproxy) gắn cả `aword-phien` và mạng ra Internet, chỉ cho phép danh sách tên miền
   (MCP, Kho tri thức AI, tùy chọn `pypi.org`, `files.pythonhosted.org`).
3. `AWORD_DOCKER_PROXY=http://aword-proxy:3128` → bộ điều phối đặt `HTTP(S)_PROXY`, `NO_PROXY=<host Cổng AI>` và
   `NODE_USE_ENV_PROXY=1` (fetch của Node 24 mới dùng proxy) cho mọi phiên.

**Phần còn thiếu:** cấu hình proxy mẫu, container máy chủ AWord Web, và kiểm thử trên Docker thật — dự kiến Giai đoạn 1b.

## Skill hệ thống

Đặt skill dùng chung ở `<AWORD_WEB_HE_THONG>/skills/<tên-skill>/SKILL.md` trên máy chủ (gắn chỉ đọc vào
`/opt/aword-he-thong`). Mỗi lần container khởi động, skill **chưa có** trong `~/.claude/skills` được tạo liên kết tới bản
hệ thống; skill người dùng đã có cùng tên được giữ nguyên. Liên kết tới skill hệ thống đã bị gỡ tự được dọn.
`AWORD_SKILL_CHEP=1`: sao chép thay vì liên kết.

## Hook Kho tri thức AI

`giao-vien/hook_trithuc.mjs` là bản Node của `electron-app/resources/giao-vien/hook_trithuc.ps1` (cùng tệp cấu hình
`~/.aword/trithuc.json`, cùng API, cùng thông điệp — kiểm thử so hành vi hai bản trong
`test/dieu-phoi-hook-trithuc.test.ts`). Ảnh chép nó vào `/opt/aword/electron-app/resources/giao-vien/`, nơi aword-chat
tìm tài nguyên vai Giáo viên. Đăng ký trong `settings.json`: `node "/home/aword/.aword/hook_trithuc.mjs"` (cần sửa
aword-chat — xem báo cáo).

## Chưa kiểm chứng

- Toàn bộ Dockerfile chưa build: `npm ci` với lockfile tạo trên Windows (gói native tùy chọn theo nền tảng), `npm rebuild`
  các module native, `theia download:plugins` với URL linux-x64, quyền thực thi của `native-binary/claude` sau giải nén.
- Tầng chạy KHÔNG chép `node_modules` (giống ảnh theia-ide: backend production đã gói bằng esbuild). Nếu backend báo
  `Cannot find module`, thêm `COPY --from=build /src/node_modules /opt/aword/node_modules` (ảnh nặng hơn nhiều).
- Theia truy cập qua cổng AWord Web ở `<tenMien>` và webview `{uuid}.webview.<tenMien>` (cần DNS wildcard
  `*.webview.<tenMien>` và chứng chỉ tương ứng ở Caddy/Nginx).
- Luật tường lửa phương án A và mạng internal phương án B chưa chạy thử.

## Xử lý sự cố

```bash
docker ps -a --filter label=aword.he-thong=aword-web     # các phiên
docker logs aword-phien-<id>                               # nhật ký Theia của phiên (container lỗi được giữ tới lần khởi động sau)
docker exec -it aword-phien-<id> bash                      # vào phiên (uid 1000)
```

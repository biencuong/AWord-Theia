# syntax=docker/dockerfile:1.7
# Ảnh AWord Web chạy Linux — mỗi tài khoản một container từ ảnh này (bộ điều phối trình "docker" tạo/xóa).
# Build từ THƯ MỤC GỐC repo (ngữ cảnh = repo; BuildKit tự dùng Dockerfile.dockerignore cạnh tệp này):
#   docker build -f aword-web-server/docker/Dockerfile -t aword-web:latest .
# Tham số: --build-arg CLAUDE_CODE_NEN_TANG=linux-arm64 (máy chủ ARM).

ARG NODE_MAJOR=24

############################ Tầng 1: build ############################
FROM node:${NODE_MAJOR}-bookworm AS build
ARG DEBIAN_FRONTEND=noninteractive

# Công cụ build module native cho Linux (node-pty, drivelist, @parcel/watcher...). Ảnh node:bookworm đã có python3/make/g++/git.
RUN apt-get update \
 && apt-get install -y --no-install-recommends pkg-config libsecret-1-dev libxkbfile-dev libx11-dev \
 && rm -rf /var/lib/apt/lists/*

# electron-app là một workspace trong lockfile: cài thư viện nhưng KHÔNG tải Electron.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    NODE_OPTIONS=--max-old-space-size=4096 \
    npm_config_fund=false \
    npm_config_audit=false

WORKDIR /src

# 1) Thư viện — lớp cache theo lockfile. --ignore-scripts: script "prepare" của repo cần mã nguồn; native build ở bước 3.
COPY package.json package-lock.json lerna.json ./
COPY aword-chat/package.json aword-chat/
COPY browser-app/package.json browser-app/
COPY electron-app/package.json electron-app/
RUN npm ci --ignore-scripts

# 2) Plugin Claude Code bản Linux (theiaPlugins của browser-app trỏ bản win32-x64 → đổi nền tảng) + Việt hóa phần khai báo.
#    Tách lớp riêng để đổi mã không phải tải lại plugin.
ARG CLAUDE_CODE_NEN_TANG=linux-x64
COPY scripts/localize-claude-code-vi.cjs scripts/
RUN node -e "const fs=require('fs');const f='browser-app/package.json';const p=JSON.parse(fs.readFileSync(f,'utf8'));for(const k of Object.keys(p.theiaPlugins||{})){p.theiaPlugins[k]=p.theiaPlugins[k].replace(/win32-x64/g,process.env.CLAUDE_CODE_NEN_TANG)}fs.writeFileSync(f,JSON.stringify(p,null,2))" \
 && grep -q "$CLAUDE_CODE_NEN_TANG" browser-app/package.json \
 && cd browser-app && npx --no-install theia download:plugins --parallel=false \
 && cd .. && node scripts/localize-claude-code-vi.cjs \
 && find browser-app/plugins -type f \( -path '*/native-binary/*' -o -path '*/ripgrep/*' -o -name '*.node' \) -exec chmod 755 {} + \
 && test -f browser-app/plugins/Anthropic.claude-code/extension/package.json

# 3) Mã nguồn → native module cho Node/Linux → gói tiếng Việt → aword-chat → browser-app production.
COPY . .
RUN npm rebuild \
 && node scripts/sync-i18n-vi.mjs \
 && npm --prefix aword-chat run build \
 && cd browser-app \
 && npx --no-install theia rebuild:browser --cacheRoot .. \
 && npx --no-install theia build --mode production \
 && test -f lib/backend/main.js

############################ Tầng 2: chạy ############################
FROM node:${NODE_MAJOR}-bookworm-slim AS runtime
ARG DEBIAN_FRONTEND=noninteractive

# Công cụ Claude Code dùng trong phiên + đọc tài liệu: Python (python-docx, openpyxl, xlrd, pypdf, pymupdf, pdfplumber,
# pillow), LibreOffice không giao diện (đọc/chuyển .doc/.xls cũ), git, ripgrep; phông có đủ dấu tiếng Việt.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates tzdata bash procps less \
      git ripgrep \
      python3 python3-pip python-is-python3 \
      libreoffice-writer-nogui libreoffice-calc-nogui \
      fonts-dejavu-core fonts-liberation2 \
      libsecret-1-0 libxkbfile1 \
 && rm -rf /var/lib/apt/lists/*

# Debian chặn pip cài vào Python hệ thống (PEP 668): cho phép — thư viện chung cài vào /usr/local (root), người dùng
# "pip install --user" vào ~/.local (nằm trên ổ riêng, còn sau khi container bị tạo lại).
ENV PIP_BREAK_SYSTEM_PACKAGES=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python3 -m pip install --no-cache-dir python-docx openpyxl xlrd pypdf pymupdf pdfplumber pillow

# Người dùng aword uid/gid 1000 (ảnh node có sẵn "node" 1000 → đổi tên).
RUN usermod -l aword -d /home/aword -m node \
 && groupmod -n aword node \
 && mkdir -p /opt/aword /opt/aword-he-thong

WORKDIR /opt/aword/browser-app
COPY --from=build /src/browser-app/package.json ./package.json
COPY --from=build /src/browser-app/lib ./lib
COPY --from=build /src/browser-app/plugins ./plugins
# Tài nguyên vai Giáo viên: aword-chat tìm ở <lib/backend>/../../../electron-app/resources/giao-vien → /opt/aword/electron-app/...
COPY electron-app/resources/giao-vien/ /opt/aword/electron-app/resources/giao-vien/
COPY aword-web-server/docker/giao-vien/hook_trithuc.mjs /opt/aword/electron-app/resources/giao-vien/hook_trithuc.mjs
COPY aword-web-server/docker/entrypoint.sh /usr/local/bin/aword-entrypoint
# Bỏ CR nếu mã nguồn được checkout trên Windows (core.autocrlf).
RUN sed -i 's/\r$//' /usr/local/bin/aword-entrypoint && chmod 755 /usr/local/bin/aword-entrypoint

ENV HOME=/home/aword \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=Asia/Ho_Chi_Minh \
    SHELL=/bin/bash \
    USE_LOCAL_GIT=true \
    AWORD_HE_THONG=/opt/aword-he-thong \
    THEIA_CONFIG_DIR=/home/aword/.theia \
    CLAUDE_CONFIG_DIR=/home/aword/.claude

USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/aword-entrypoint"]

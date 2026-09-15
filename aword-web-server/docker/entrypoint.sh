#!/bin/sh
# Điểm vào container phiên AWord Web: chuẩn bị home của người dùng rồi chạy backend Theia nghe 0.0.0.0:3000.
#   - /home/aword là ổ riêng của tài khoản (gắn đọc-ghi); /opt/aword-he-thong là thư mục hệ thống (gắn chỉ đọc).
#   - Skill hệ thống ($AWORD_HE_THONG/skills/<tên>) được nối vào ~/.claude/skills/<tên> NẾU người dùng chưa có skill
#     cùng tên — không bao giờ ghi đè bản người dùng tự cài/tự sửa. Mặc định tạo liên kết (cập nhật skill hệ thống là
#     có hiệu lực ngay); AWORD_SKILL_CHEP=1 thì sao chép.
set -eu

HOME="${HOME:-/home/aword}"
HE_THONG="${AWORD_HE_THONG:-/opt/aword-he-thong}"
LAM_VIEC="$HOME/Documents/AWord"
SKILLS="$HOME/.claude/skills"

mkdir -p "$LAM_VIEC" "$SKILLS" "$HOME/.aword" "$HOME/.theia"

if [ -d "$HE_THONG/skills" ]; then
    for nguon in "$HE_THONG/skills"/*/; do
        [ -d "$nguon" ] || continue
        ten="$(basename "$nguon")"
        dich="$SKILLS/$ten"
        if [ -e "$dich" ] || [ -L "$dich" ]; then
            continue
        fi
        if [ "${AWORD_SKILL_CHEP:-0}" = "1" ]; then
            cp -R "$HE_THONG/skills/$ten" "$dich"
        else
            ln -s "$HE_THONG/skills/$ten" "$dich"
        fi
    done
fi

# Skill hệ thống đã bị gỡ → bỏ liên kết hỏng trỏ vào thư mục hệ thống (không động tới thư mục thật của người dùng).
for lk in "$SKILLS"/*; do
    if [ -L "$lk" ] && [ ! -e "$lk" ]; then
        case "$(readlink "$lk")" in
            "$HE_THONG"/*) rm -f "$lk" ;;
        esac
    fi
done

cd /opt/aword/browser-app
exec node lib/backend/main.js --hostname=0.0.0.0 --port=3000 \
    --plugins=local-dir:/opt/aword/browser-app/plugins "$LAM_VIEC" "$@"

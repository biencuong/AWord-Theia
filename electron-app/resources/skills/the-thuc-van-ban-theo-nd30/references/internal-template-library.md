# Internal template library

Khi 1 mẫu của người dùng/cơ quan được xác nhận ổn định qua nhiều lần dùng thực tế (đã audit, đã
được người dùng chấp nhận theo đúng "Template admission workflow" trong `SKILL.md`), đăng ký nó
bằng `scripts/register_template_profile.py` và lưu trực tiếp dưới `assets/templates/` cùng profile
tương ứng dưới `assets/profiles/` — dùng đúng cấu trúc phẳng hiện có, chưa có subtree `internal/`
riêng.

Khi dùng 1 mẫu đã đăng ký cho replicate mode, ưu tiên đúng thứ tự chiến lược ở
`nd30-replicate-fixed-block-preservation.md` (clone-patch → preserve-fixed-blocks → shell-rebuild)
để giữ đúng định dạng gốc thay vì rebuild lại.

Nếu mẫu mang theo cảnh báo từ lần audit lúc đăng ký, báo lại cho người dùng trước khi dùng nó ở
replicate mode.

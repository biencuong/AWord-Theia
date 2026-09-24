// Giao thức RPC dùng chung frontend/backend cho tính năng "Cập nhật Claude Code":
// một nút trong AWord tải bản Claude Code do người duy trì AWord đã DUYỆT SẴN (đọc từ
// một tệp kê danh mục trên repo, KHÔNG phải mọi bản trên open-vsx.org), giải nén vào một
// thư mục plugin cá nhân của người dùng — không cần chờ đóng gói lại cả bản AWord mới.
// Theia tự chọn bản có số hiệu cao hơn giữa thư mục plugin đóng sẵn và thư mục này khi
// khởi động lại (xem PluginDeployer#findBestVersion) nên chỉ cần giải nén đúng chỗ là đủ.
export const CAP_NHAT_CLAUDE_CODE_PATH = '/services/aword-cap-nhat-claude-code';

export interface ThongTinBanDuocDuyet {
    phienBan: string;
    urlVsix: string;
    ghiChu?: string;
    // 'open-vsx': bản mới nhất Anthropic vừa phát hành (theo thời gian thực);
    // 'danh-muc': bản người duy trì AWord ghim trong danh mục (khi tắt tự động hoặc Open VSX không trả lời).
    nguon?: 'open-vsx' | 'danh-muc';
}

export interface CapNhatClaudeCodeServer {
    // Phiên bản Claude Code thực sự đang có hiệu lực trên máy này (bản đóng sẵn trong AWord,
    // hoặc bản đã cập nhật qua nút này nếu mới hơn) — undefined nếu không đọc được.
    layPhienBanDangDung(): Promise<string | undefined>;
    // Đọc bản Claude Code do người duy trì AWord đã DUYỆT (undefined nếu không đọc được
    // danh mục, hoặc danh mục chưa có gói cho nền tảng máy này).
    layBanDuocDuyet(): Promise<ThongTinBanDuocDuyet | undefined>;
    // Bản NÊN DÙNG theo thời gian thực: bản mới nhất trên Open VSX, trừ các bản danh mục ghi là
    // có lỗi (khongDung) và không vượt trần (toiDa) nếu danh mục đặt. Danh mục đặt tuDong=false
    // hoặc Open VSX không trả lời thì trả bản đã duyệt như layBanDuocDuyet().
    layBanMoiNhat(): Promise<ThongTinBanDuocDuyet | undefined>;
    // Tải VSIX của bản đã duyệt về và giải nén vào thư mục cập nhật cá nhân. Cần KHỞI ĐỘNG
    // LẠI AWord (không phải chỉ mở lại khung Claude) để bản mới có hiệu lực.
    // Bản tải về được Việt hoá và gỡ khung danh sách phiên như bản đóng gói sẵn.
    capNhat(thongTin: ThongTinBanDuocDuyet): Promise<void>;
    // Áp lại bảng dịch MỚI NHẤT lên bản Claude Code đã cập nhật (bản tải về trước khi có bản dịch mới, hoặc
    // trước khi AWord biết Việt hoá khung chat). Có hiệu lực từ lần mở AWord kế tiếp.
    vaLaiVietHoa(): Promise<void>;
}

export const CapNhatClaudeCodeServer = Symbol('CapNhatClaudeCodeServer');

// So sánh phiên bản dạng số cách nhau bằng dấu chấm (vd "2.1.211") — dùng chung
// frontend/backend, không phụ thuộc gói semver ngoài. >0 nếu a mới hơn b.
export function soSanhPhienBanSo(a: string, b: string): number {
    const pa = (a || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = (b || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) { return d; }
    }
    return 0;
}

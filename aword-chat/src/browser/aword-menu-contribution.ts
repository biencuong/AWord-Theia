import { injectable } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry,
    MenuContribution, MenuModelRegistry, MAIN_MENU_BAR, MutableCompoundMenuNode
} from '@theia/core';
import { CommonMenus, ConfirmDialog, Dialog } from '@theia/core/lib/browser';

export const AwordAboutCommand: Command = {
    id: 'aword:about',
    label: 'Giới thiệu AWord'
};

// Đường dẫn menu "Terminal" do @theia/terminal đăng ký: [...MAIN_MENU_BAR, '7_terminal'].
const TERMINAL_MENU_ID = '7_terminal';

const SERVICES = ['Tư vấn ứng dụng AI', 'Chuyển đổi số', 'Tự động hóa quy trình', 'Đào tạo & chuyển giao'];

function buildAboutMessageNode(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'aword-about-content';

    // Đầu trang: logo chữ A (màu thương hiệu cam, khớp icon app) + tên + phụ đề
    const header = document.createElement('div');
    header.className = 'aword-about-header';
    const logo = document.createElement('div');
    logo.className = 'aword-about-logo';
    logo.textContent = 'A';
    const titleBox = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'aword-about-title';
    title.textContent = 'AWord';
    const subtitle = document.createElement('div');
    subtitle.className = 'aword-about-subtitle';
    subtitle.textContent = 'Giải pháp AI & Chuyển đổi số';
    titleBox.appendChild(title);
    titleBox.appendChild(subtitle);
    header.appendChild(logo);
    header.appendChild(titleBox);
    wrap.appendChild(header);

    const tagline = document.createElement('p');
    tagline.className = 'aword-about-tagline';
    tagline.innerHTML = '<b>AWord</b> — Giải pháp AI &amp; Chuyển đổi số cho cơ quan, doanh nghiệp';
    wrap.appendChild(tagline);

    const lead = document.createElement('p');
    lead.textContent = 'AWord đồng hành cùng các cơ quan và doanh nghiệp đưa trí tuệ nhân tạo (AI) và chuyển đổi số '
        + 'vào công việc hằng ngày — tự động hóa quy trình, tiết kiệm thời gian, nâng cao hiệu quả và năng suất một cách bền vững.';
    wrap.appendChild(lead);

    const contact = document.createElement('p');
    contact.className = 'aword-about-contact';
    contact.innerHTML = '<b>Hotline / Zalo:</b> <a href="tel:0983606845">0983 606 845</a>';
    wrap.appendChild(contact);

    const services = document.createElement('div');
    services.className = 'aword-about-services';
    for (const s of SERVICES) {
        const chip = document.createElement('span');
        chip.className = 'aword-about-chip';
        chip.textContent = s;
        services.appendChild(chip);
    }
    wrap.appendChild(services);

    return wrap;
}

@injectable()
export class AwordMenuContribution implements CommandContribution, MenuContribution {

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AwordAboutCommand, {
            // Dựng ConfirmDialog trực tiếp (không qua DI) để tránh lỗi Inversify "asynchronous dependencies"
            // từng gặp khi bind một ReactDialog tuỳ biến làm service — xem ghi chú trong kế hoạch.
            execute: () => new ConfirmDialog({
                title: AwordAboutCommand.label!,
                msg: buildAboutMessageNode(),
                ok: Dialog.OK,
                cancel: ''
            }).open()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AwordAboutCommand.id,
            label: AwordAboutCommand.label,
            order: '0'
        });
        // Ẩn menu "Terminal" khỏi thanh menu chính — tính năng Terminal vẫn dùng được qua Command Palette (Ctrl+Shift+P).
        // Dùng onDidChange thay vì FrontendApplicationContribution.onStart() vì thứ tự đăng ký menu giữa các
        // extension không được đảm bảo; lắng nghe sự kiện đảm bảo gỡ đúng lúc menu Terminal xuất hiện, dù trước hay sau.
        this.hideTerminalMenu(menus);
        this.pruneHelpMenu(menus);
        menus.onDidChange(() => {
            this.hideTerminalMenu(menus);
            this.pruneHelpMenu(menus);
        });
    }

    private hideTerminalMenu(menus: MenuModelRegistry): void {
        const menuBar = menus.getMenu(MAIN_MENU_BAR);
        const terminalNode = menuBar?.children.find(child => child.id === TERMINAL_MENU_ID);
        if (terminalNode && menuBar && MutableCompoundMenuNode.is(menuBar)) {
            menuBar.removeNode(terminalNode);
        }
    }

    // Menu Trợ giúp chỉ giữ lại "Giới thiệu AWord"; gỡ mọi mục khác
    // (About mặc định của Theia, Getting Started, tài liệu online...).
    private pruneHelpMenu(menus: MenuModelRegistry): void {
        const help = menus.getMenu(CommonMenus.HELP);
        if (!help || !MutableCompoundMenuNode.is(help)) {
            return;
        }
        for (const child of [...help.children]) {
            if (child.id !== AwordAboutCommand.id) {
                help.removeNode(child);
            }
        }
    }
}

// Nối trang thống kê và chỉ báo thanh tiêu đề vào AWord Pro.

import { injectable, inject } from '@theia/core/shared/inversify';
import { Command, CommandRegistry, MenuModelRegistry } from '@theia/core';
import { AbstractViewContribution, CommonMenus, FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { AwordThongKeWidget } from './aword-thong-ke-widget';
import { AwordChiSoTokenWidget, LENH_MO_THONG_KE } from './aword-chi-so-token-widget';

export const AwordThongKeCommand: Command = {
    id: LENH_MO_THONG_KE,
    label: 'Thống kê token và chi phí'
};

@injectable()
export class AwordThongKeContribution extends AbstractViewContribution<AwordThongKeWidget> implements FrontendApplicationContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(AwordChiSoTokenWidget)
    protected readonly chiSoWidget!: AwordChiSoTokenWidget;

    constructor() {
        super({
            widgetId: AwordThongKeWidget.ID,
            widgetName: AwordThongKeWidget.LABEL,
            defaultWidgetOptions: { area: 'main' }
        });
    }

    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(AwordThongKeCommand, {
            execute: () => this.openView({ activate: true, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AwordThongKeCommand.id,
            label: AwordThongKeCommand.label,
            order: 'c1'
        });
    }

    /**
     * Cắm chỉ báo vào thanh tiêu đề — CHỈ khi có thanh tiêu đề tự vẽ.
     *
     * `#window-controls` do `ElectronMenuContribution` tạo và nó chỉ được bind trong mô-đun electron; bản
     * chạy trên trình duyệt ẩn hẳn `#theia-top-panel`. Thiếu chỗ cắm thì bỏ qua im lặng, và trang thống kê
     * vẫn mở được bằng menu Trợ giúp — chỉ báo không bao giờ là lối vào duy nhất.
     */
    async onStart(_app: FrontendApplication): Promise<void> {
        if (!document.getElementById('window-controls')) { return; }
        try {
            await this.shell.addWidget(this.chiSoWidget, { area: 'top' });
        } catch (e) {
            console.error('[aword] gắn chỉ báo token lên thanh tiêu đề', e);
        }
    }
}

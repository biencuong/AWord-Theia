// afterPack hook cua electron-builder: ky AD-HOC (codesign --sign -) cho app macOS.
// Ly do: khong co chung thu Apple Developer -> electron-builder bo qua ky; nhung app
// arm64 KHONG co chu ky nao se bi macOS tu choi chay ("Killed: 9"). Ky ad-hoc du de
// chay (nguoi dung van phai chuot phai > Open lan dau vi app khong notarize).
// Tren Windows/Linux hook nay khong lam gi.
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async function afterPack(context) {
    if (context.electronPlatformName !== 'darwin') { return; }
    const appName = context.packager.appInfo.productFilename + '.app';
    const appPath = path.join(context.appOutDir, appName);
    if (!fs.existsSync(appPath)) {
        console.warn('[adhoc-sign] Khong thay ' + appPath + ' - bo qua.');
        return;
    }
    console.log('[adhoc-sign] Ky ad-hoc: ' + appPath);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', appPath], { stdio: 'inherit' });
    console.log('[adhoc-sign] Xong.');
};

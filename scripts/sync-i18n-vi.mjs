// Sao chép gói ngôn ngữ tiếng Việt (i18n-vi-language-pack/) vào thư mục plugins/ của browser-app và electron-app.
// Cần chạy lại mỗi khi nội dung dịch trong i18n-vi-language-pack/ thay đổi, hoặc sau khi xoá thư mục plugins/ (bị .gitignore).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'i18n-vi-language-pack');

for (const app of ['browser-app', 'electron-app']) {
  const dest = path.join(root, app, 'plugins', 'aword.vi-language-pack');
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('Synced vi language pack ->', dest);
}

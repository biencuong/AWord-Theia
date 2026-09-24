async (page) => {
  // ĐĂNG NHẬP iOffice bằng Playwright MCP — mật khẩu KHÔNG đi qua hội thoại:
  // đọc auth.local.json bằng một tab file:/// ngay trong trình duyệt MCP (browser_run_code_unsafe không có require/fs).
  // Trả: da_dang_nhap_san | dang_nhap_ok | can_captcha | chua_vao_duoc | khong_thay_auth
  const URL = 'https://vpdttq.vnptioffice.vn/qlvbdh/main?lang=vi';
  // Đường dẫn tệp đăng nhập: SỬA cho đúng máy đang dùng trước khi chạy (thay <TEN_NGUOI_DUNG> bằng tên tài khoản
  // Windows, xem %USERPROFILE%). Tệp mẫu: auth.local.example.json trong thư mục skill này.
  const AUTH = [
    'file:///C:/Users/<TEN_NGUOI_DUNG>/.claude/skills/ioffice-vanban-den/auth.local.json',
  ];
  if (!page.url().includes('vnptioffice.vn')) await page.goto(URL);
  await page.waitForTimeout(1500);
  if (await page.locator('#m2766').count() > 0) return 'da_dang_nhap_san';
  let a = null;
  const p2 = await page.context().newPage();
  for (const u of AUTH) {
    try { await p2.goto(u); a = JSON.parse(await p2.locator('body').innerText()); if (a.username && a.password) break; } catch (e) { a = null; }
  }
  await p2.close();
  if (!a) return 'khong_thay_auth';
  await page.fill('input#userName', a.username);
  await page.fill('input#passWord', a.password);
  await page.locator('input#submitBtn').click();
  for (let i = 0; i < 20; i++) {
    if (await page.locator('#m2766').count() > 0) return 'dang_nhap_ok';
    await page.waitForTimeout(1000);
  }
  return (await page.locator('#txtMaXacNhan:visible').count()) ? 'can_captcha' : 'chua_vao_duoc';
}

async (page) => {
  // Liệt kê "Văn bản đến chờ xử lý" (m2766) theo VAI TRÒ — CHỈ ĐỌC, không tải file, không bấm nút đổi trạng thái.
  // Sửa VAI_TRO: 'xlc' (Xử lý chính) | 'ph' (Phối hợp). Chạy SAU login.js.
  const VAI_TRO = 'xlc', MAX_TRANG = 1;   // MAX_TRANG: số trang cần đọc (1 trang = mới nhất)
  const ROWS = "#dt_basic tbody tr[id^='vb_']";
  await page.evaluate(() => document.querySelector('#m2766').click());
  await page.waitForSelector(ROWS, {timeout: 30000});
  await page.waitForTimeout(1500);
  // BẮT BUỘC bấm legend lọc vai trò — danh sách mặc định trộn cả văn bản người khác là XLC.
  const first0 = await page.evaluate(s => document.querySelector(s)?.id || '', ROWS);
  await page.locator(`span.color_clk[c-val='${VAI_TRO}']`).first().click();
  for (let i = 0; i < 60; i++) { const c = await page.evaluate(s => document.querySelector(s)?.id || '', ROWS); if (c !== first0) break; await page.waitForTimeout(250); }
  await page.waitForTimeout(1500);
  const rowsJs = () => Array.from(document.querySelectorAll("#dt_basic tbody tr[id^='vb_']")).map(tr => {
    const g = n => (tr.getAttribute(n) || '').trim();
    const han = tr.querySelector('td.vanbanden_hienthi_han_xuly');
    return {doc_id: g('flyid') || tr.id.replace('vb_', ''), so_ky_hieu: g('so_ky_hieu'), trich_yeu: g('trich_yeu'),
            noi_gui: g('don_vi_ban_hanh'), ngay_den: g('ngay_den'), do_khan: g('do_khan'),
            han_xu_ly: han ? han.innerText.trim() : '', co_dinh_kem: !!tr.querySelector('a.btnDownloadAllFileVBDen')};
  });
  const out = []; const visited = new Set([1]); let pageNo = 1;
  while (true) {
    (await page.evaluate(rowsJs)).forEach((r, i) => out.push({...r, trang: pageNo, dong: i + 1}));
    if (pageNo >= MAX_TRANG) break;
    const avail = await page.evaluate(() => Array.from(document.querySelectorAll("ul.pagination a[onclick*='gotoPage']"))
      .map(a => +((a.getAttribute('onclick').match(/gotoPage\((\d+)\)/)||[])[1])).filter(Boolean));
    const nxt = avail.filter(p => !visited.has(p)).sort((a, b) => a - b);
    if (!nxt.length) break;
    const first = await page.evaluate(s => document.querySelector(s)?.id || '', ROWS);
    pageNo = nxt[0]; visited.add(pageNo);
    await page.evaluate(n => page.gotoPage(n), pageNo);
    for (let i = 0; i < 80; i++) { const c = await page.evaluate(s => document.querySelector(s)?.id || '', ROWS); if (c && c !== first) break; await page.waitForTimeout(250); }
    await page.waitForTimeout(1000);
  }
  return {vai_tro: VAI_TRO, so_dong: out.length, list: out};
}

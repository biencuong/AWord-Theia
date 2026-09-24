async (page) => {
  // Lấy Văn bản đi đã phát hành (m2796) theo NGÀY BAN HÀNH — SỬA 2 DÒNG DƯỚI mỗi kỳ.
  const TU = '25/08/2026', DEN = '24/09/2026';
  // Chạy SAU login.js. Chỉ đọc, không bấm nút đổi trạng thái.
  await page.evaluate(() => document.querySelector('#m2796').click());
  await page.waitForSelector("#tabale_dsvb tbody tr[id^='vbdi_']", {timeout: 30000});
  await page.waitForTimeout(1500);
  if (!(await page.locator('#a-search-start-ngaybanhanh').isVisible()))
    await page.getByText('Tìm kiếm nâng cao', {exact: true}).first().click();
  await page.waitForSelector('#a-search-start-ngaybanhanh', {state: 'visible', timeout: 10000});
  for (const [sel, v] of [['#a-search-start-ngaybanhanh', TU], ['#a-search-end-ngaybanhanh', DEN]]) {
    await page.fill(sel, v);
    await page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', {bubbles: true})); }, [sel, v]);
  }
  await page.keyboard.press('Escape');                 // đóng datepicker
  await page.evaluate(() => vbdi_quickSearch());       // nút "Tìm kiếm"
  await page.waitForTimeout(3000);
  // 34 th nhưng 36 td: td[22] = Người soạn thảo (lệch 2 so với tiêu đề).
  const rowsJs = () => Array.from(document.querySelectorAll("#tabale_dsvb tbody tr[id^='vbdi_']")).map(tr => {
    const c = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
    return {id: tr.getAttribute('tridrecord'), so: tr.getAttribute('so_ky_hieu'), ht: (tr.getAttribute('hinh_thuc')||'').trim(),
            ngay_vb: tr.getAttribute('ngay_van_ban'), ty: tr.getAttribute('trich_yeu'), nguoi_soan: c[22]};
  });
  const all = {}, visited = new Set([1]); let pageNo = 1;
  while (true) {
    for (const r of await page.evaluate(rowsJs)) all[r.id] = r;
    const avail = await page.evaluate(() => Array.from(document.querySelectorAll("ul.pagination a[onclick*='gotoPage']"))
      .map(a => +((a.getAttribute('onclick').match(/gotoPage\((\d+)\)/)||[])[1])).filter(Boolean));
    const nxt = avail.filter(p => !visited.has(p)).sort((a, b) => a - b);
    if (!nxt.length || pageNo > 30) break;
    const first = await page.evaluate(() => document.querySelector("#tabale_dsvb tbody tr[id^='vbdi_']")?.id || '');
    pageNo = nxt[0]; visited.add(pageNo);
    await page.evaluate(n => page.gotoPage(n), pageNo);
    for (let i = 0; i < 80; i++) {
      const cur = await page.evaluate(() => document.querySelector("#tabale_dsvb tbody tr[id^='vbdi_']")?.id || '');
      if (cur && cur !== first) break; await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1000);
  }
  const list = Object.values(all);
  return {ky: TU + ' - ' + DEN, tong: list.length, list};
}

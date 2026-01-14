// extractor.js
async function captureUrl(browser, page, nombre) {
  let popup1 = null, popup2 = null;
  try {
    const frameElement = await page.$('iframe');
    if (!frameElement) return null;
    const frame = await frameElement.contentFrame();

    const target1Promise = browser.waitForTarget(t => t.opener() === page.target(), { timeout: 30000 });
    
    const clickExitoso = await frame.evaluate((n) => {
      const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'));
      const found = links.find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
      if (found) {
        found.scrollIntoView({ behavior: 'smooth', block: 'center' });
        found.click();
        return true;
      }
      return false;
    }, nombre);

    if (!clickExitoso) return null;

    const target1 = await target1Promise;
    popup1 = await target1.page();
    
    if (popup1) {
      await popup1.waitForSelector('a.buyBtn', { visible: true, timeout: 20000 });
      const btns = await popup1.$$('a.buyBtn');
      
      if (btns.length >= 2) {
        const target2Promise = browser.waitForTarget(t => t.opener() === target1, { timeout: 30000 });
        await btns[1].click();
        const target2 = await target2Promise;
        popup2 = await target2.page();
        
        if (popup2) {
          await popup2.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          return popup2.url();
        }
      }
    }
  } catch (e) {
    console.log(`⚠️ Extractor: Link omitido para ${nombre}`);
  } finally {
    if (popup2) await popup2.close().catch(() => {});
    if (popup1) await popup1.close().catch(() => {});
  }
  return null;
}

module.exports = { captureUrl };

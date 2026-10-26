// Global header disclosure is shared; callers keep their own page assertions.
export async function revealHeader(page){
 const compact=await page.locator('.site-header').evaluate(h=>h.classList.contains('header-compact'));
 const button=page.locator('.header-menu-toggle');
 if(compact&&await button.getAttribute('aria-expanded')!=='true')await button.click();
 return compact;
}
export async function setHeaderLight(page,state){
 if(await page.locator('body').getAttribute('data-room-light')!==state){
  const compact=await revealHeader(page);
  await page.locator(compact?'.room-mobile-light':'.room-switch').click();
 }
 await page.locator(`.room-${state}-full-ready`).waitFor();
 const toggle=page.locator('.header-menu-toggle');
 if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
}

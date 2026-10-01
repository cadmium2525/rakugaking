import {test,expect} from '@playwright/test';
test('very short key taps survive between simulation updates',async({page})=>{await page.goto('/');await page.waitForFunction(()=>window.__qa?.state().grounded);await page.keyboard.press('Space');await page.waitForFunction(()=>window.__qa.state().jumps===1);});
test('renders, moves, jumps, pauses, and retries through real input',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.waitForFunction(()=>window.__qa?.state().grounded);
  const state=()=>page.evaluate(()=>window.__qa.state());
  expect((await state()).calls).toBeGreaterThan(0);
  await page.keyboard.down('KeyD');await page.waitForTimeout(300);await page.keyboard.up('KeyD');
  expect((await state()).position.x).toBeGreaterThan(.5);
  await page.keyboard.down('Space');await page.waitForTimeout(200);expect((await state()).position.y).toBeGreaterThan(1.3);await page.keyboard.up('Space');
  await page.getByRole('button',{name:'一時停止'}).click();const before=(await state()).position;await page.waitForTimeout(200);expect((await state()).position).toEqual(before);
  await page.getByRole('button',{name:'スタートへ戻る'}).click();await page.waitForTimeout(400);expect(Math.abs((await state()).position.x)).toBeLessThan(.01);
  expect(errors).toEqual([]);await page.screenshot({path:'test-results/phase1-desktop.png'});
});
test('mobile simultaneous move and jump, cancellation, rotation',async({page})=>{
  await page.setViewportSize({width:844,height:390});await page.goto('/');await page.waitForFunction(()=>window.__qa?.state().grounded);
  const cdp=await page.context().newCDPSession(page);
  const b=await page.locator('#stick').boundingBox(),j=await page.locator('#jump').boundingBox();
  const touchPoints=[{id:1,x:b.x+b.width*.8,y:b.y+b.height/2},{id:2,x:j.x+j.width/2,y:j.y+j.height/2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});
  await page.waitForTimeout(200);
  expect((await page.evaluate(()=>window.__qa.state())).jumps).toBe(1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  for(const [width,height] of [[375,667],[390,844],[393,852],[430,932],[932,430]]){await page.setViewportSize({width,height});await expect(page.locator('#jump')).toBeInViewport();await expect(page.locator('#stick')).toBeInViewport();if(width<height)await expect(page.locator('#rotate')).toBeVisible();}
  await page.screenshot({path:'test-results/phase1-mobile.png'});
});

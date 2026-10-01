import {test,expect} from '@playwright/test';
import {STAGES} from '../../src/game/stages.js';
export async function playStage(page,stage){
  let index=0;const tiles=stage.platforms,last=tiles.length-1;
  await page.keyboard.down('KeyW');
  for(let i=0;i<900;i++){
    const s=await page.evaluate(()=>window.__qa.state());if(s.complete)break;
    if(index===last&&s.position.z<stage.goal.z+.7)await page.keyboard.up('KeyW');
    if(i%6===0)await page.keyboard.press('KeyE');
    while(index<last&&s.position.z<tiles[index+1].z+tiles[index+1].d/2-.5&&s.grounded)index++;
    const target=tiles[Math.min(index+1,last)];
    for(const [key,condition] of [['KeyD',target.x-s.position.x>.2],['KeyA',target.x-s.position.x<-.2],['Space',s.grounded&&index<last&&s.position.z-tiles[index].z+tiles[index].d/2<1.1]]){if(condition)await page.keyboard.down(key);else await page.keyboard.up(key);}
    await page.waitForTimeout(35);
  }
  for(const key of ['KeyW','KeyA','KeyD','Space'])await page.keyboard.up(key);
  const state=await page.evaluate(()=>window.__qa.state());
  if(!state.complete){console.log('Failed course state',JSON.stringify(state));await page.screenshot({path:`test-results/stage-${stage.id}-failure.png`});}
  await expect(page.locator('#result')).toBeVisible();
  expect((await page.evaluate(()=>window.__qa.state())).deaths).toBe(0);
}
test('full adventure unlocks and clears all five stages with keyboard input',async({page})=>{
  test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/ranking-config.json',route=>route.fulfill({json:{endpoint:'http://127.0.0.1:8787'}}));await page.goto('/');await page.locator('#adventure').click();await expect(page.locator('[data-stage="2"]')).toBeDisabled();
  for(const stage of STAGES){await page.locator(`[data-stage="${stage.id}"]`).click();await playStage(page,stage);await page.screenshot({path:`test-results/stage-${stage.id}-clear.png`});await page.locator('#select-next').click();}
  await expect(page.locator('#player-level')).toContainText('LV.5');await expect(page.locator('#player-level')).toContainText('1200 EXP');expect(errors).toEqual([]);
  await page.locator('[data-close]').click();await page.locator('#time-attack').click();
  const initial=await page.evaluate(()=>window.__qa.state().run);
  await page.getByLabel('一時停止').click();const pausedTime=await page.evaluate(()=>window.__qa.state().run.total);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__qa.state().run.total)).toBeGreaterThan(pausedTime+.2);await page.locator('#resume').click();
  for(const stage of STAGES){await playStage(page,stage);const state=await page.evaluate(()=>window.__qa.state());expect(state.run.splits.length).toBe(stage.id);expect(state.run.stats).toEqual(initial.stats);const total=state.run.total;await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__qa.state().run.total)).toBe(total);if(stage.id<5)await page.locator('#select-next').click();}
  const final=await page.evaluate(()=>window.__qa.state());expect(final.records).toBe(1);expect(final.best).toBeGreaterThan(25);expect(final.run.valid).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:'test-results/time-attack-finish.png'});
  const player=`QA-${Date.now()}`;await page.locator('#player-name').fill(player);await page.locator('#submit-score').click();await expect(page.locator('#submit-status')).toContainText('登録しました');
  await page.locator('#select-next').click();await page.locator('[data-close]').click();await page.locator('#ranking-open').click();await expect(page.locator('.ranking-status')).toContainText('自分のベスト');await expect(page.locator('.ranking-table')).toContainText(player);await page.screenshot({path:'test-results/ranking.png'});
  await page.reload();await page.waitForFunction(()=>window.__qa);const restored=await page.evaluate(()=>window.__qa.state());expect(restored.run).toBeNull();expect(restored.best).toBe(final.best);expect(restored.exp).toBe(1400);expect(restored.records).toBe(1);
});

import {test,expect} from '@playwright/test';
import {STAGES} from '../../src/game/stages.js';
for(const stage of STAGES)test(`stage ${stage.id} can be cleared using keyboard input only`,async({page})=>{
  test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#adventure').click();await page.locator(`[data-stage="${stage.id}"]`).click();
  let index=0;const tiles=stage.platforms,last=tiles.length-1;
  await page.keyboard.down('KeyW');
  for(let i=0;i<900;i++){const s=await page.evaluate(()=>window.__qa.state());if(s.complete)break;if(index===last&&s.position.z<stage.goal.z+.7)await page.keyboard.up('KeyW');if(i%6===0)await page.keyboard.press('KeyE');while(index<last&&s.position.z<tiles[index+1].z+tiles[index+1].d/2-.5&&s.grounded)index++;const target=tiles[Math.min(index+1,last)];for(const [key,condition] of [['KeyD',target.x-s.position.x>.2],['KeyA',target.x-s.position.x<-.2],['Space',s.grounded&&index<last&&s.position.z-tiles[index].z+tiles[index].d/2<1.1]]){if(condition)await page.keyboard.down(key);else await page.keyboard.up(key);}await page.waitForTimeout(35);}
  await page.keyboard.up('KeyW');await expect(page.locator('#result')).toBeVisible();expect((await page.evaluate(()=>window.__qa.state())).deaths).toBe(0);expect(errors).toEqual([]);await page.screenshot({path:`test-results/stage-${stage.id}-clear.png`});
});

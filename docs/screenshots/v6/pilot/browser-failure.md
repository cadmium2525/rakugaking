# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: course.spec.js >> full adventure unlocks and clears all five stages with keyboard input
- Location: tests\browser\course.spec.js:54:1

# Error details

```
Error: {"position":{"x":0,"y":1.793888807296753,"z":8},"grounded":false,"jumps":0,"deaths":1,"paused":false,"elapsed":363.91666666666436,"stage":1,"complete":false,"collected":0,"checkpoint":-1,"field":{"rewards":[],"runes":[],"enemies":[{"x":-26,"z":-15,"hp":0,"phase":"patrol"},{"x":-18,"z":-13,"hp":0,"phase":"patrol"},{"x":-22,"z":-24,"hp":30,"phase":"patrol"}],"bossHP":150,"bossPhase":"sleep","bossAttack":null,"selected":"orchard"},"combat":{"attacking":false,"combo":0,"airborne":false,"name":"","elapsed":0,"duration":1,"windup":0,"active":0,"phase":"idle","facing":{"x":0.0000020399866907288716,"z":0.9999999999979192},"reach":2.1479999999999997,"buffered":false,"hurt":0},"combatEvents":[],"practiceHits":0,"camera":{"yaw":-1.4567416845679553,"intentYaw":0,"pitch":0,"position":{"x":-13.435572475969035,"y":10.203265120869009,"z":5.253633667621344}},"version":"6.0.0","exp":1200,"characters":1,"name":"らくがきくん","run":{"splits":[],"total":32.893699999809265,"valid":true,"level":5,"stats":{"hp":122,"power":20,"defense":17.2,"speed":5.938947718078047,"jump":8.689254904677462,"weight":1.5512418255375628,"reach":1.448,"actionCooldown":0.6069129130354868,"luck":0,"analysis":{"volume":0.32187208054912964,"bodyArea":0.2803763767849561,"legLength":0.72,"armArea":0.16822582607097367,"colors":{"#ed8063":1,"#659dcc":0,"#83b782":0,"#ebc85b":0,"#a68dc9":0,"#344d48":0},"centerOfMass":1.3}}},"best":null,"records":0,"calls":96,"triangles":27178,"geometries":146,"quality":"medium","resolution":{"width":1280,"height":720}}

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic:
  - generic:
    - generic "3Dアクションの世界" [ref=e1]
    - banner [ref=e2]:
      - link "RAKUGA ラクガキの冒険" [ref=e3] [cursor=pointer]:
        - /url: ./
        - text: RAKUGA
        - generic [ref=e4]: ラクガキの冒険
      - generic [ref=e5]: 01 / こもれびの大樹の里
      - button "一時停止" [active] [ref=e6] [cursor=pointer]: Ⅱ
    - status [ref=e7]: この端末に保存しました
    - generic [ref=e8]: STAGE 0:32.88 · TOTAL 0:32.88 · BEST —
    - generic: 0/3 紋章 · 果樹園の敵を3体倒す · ACTIONで攻撃・起動
    - status [ref=e9]: HP 122 · ↑ IN THE AIR · 0.0 m/s
    - generic: v6.0.0
    - generic [ref=e10]:
      - text: HP 122/122
      - meter "体力" [ref=e11]
    - button "視点を北へ戻す" [ref=e12] [cursor=pointer]:
      - text: ↻
      - generic [ref=e13]: 北へ
    - generic: リズムよくACTIONで3連撃 · 空中ではスピン
    - generic:
      - generic [ref=e14]:
        - generic "移動スティック" [ref=e15]
        - generic [ref=e16]: MOVE
      - generic [ref=e17]:
        - button "✦ ACTION" [ref=e18] [cursor=pointer]:
          - text: ✦
          - generic [ref=e19]: ACTION
        - button "↑ JUMP" [ref=e20] [cursor=pointer]:
          - text: ↑
          - generic [ref=e21]: JUMP
    - contentinfo [ref=e22]: 好きな順で3つのミッションへ。ACTIONで攻撃・仕掛けを起動。紋章を拾うと北の門が開く。
  - complementary [ref=e23]:
    - group [ref=e24]:
      - generic "紋章 0/3 · 地図" [ref=e25] [cursor=pointer]
      - generic [ref=e26]:
        - generic "北が上のフィールド地図" [ref=e27]
        - generic [ref=e28]:
          - button "1 果樹園 · 2/3" [pressed] [ref=e29] [cursor=pointer]
          - button "2 古代遺跡 · 0/3" [ref=e30] [cursor=pointer]
          - button "3 大樹の闘技場 · HP 150" [ref=e31] [cursor=pointer]
        - paragraph [ref=e32]: ミッションを選ぶと目的地を強調
    - paragraph [ref=e33]: ✦ 0/9 · 半分で★★ / 全回収★★★
    - paragraph [ref=e34]: ↙ 果樹園 · 33m
```

# Test source

```ts
  1   | import { expect } from '@playwright/test';
  2   | import { fieldControls } from './field-driver.js';
  3   | import { STAGES } from '../../src/game/stages.js';
  4   | import { cameraMovement } from '../../src/core/camera.js';
  5   | export const viewControls = (input, state) => cameraMovement(input, -(state.camera?.yaw || 0));
  6   | export async function playField(page, screenshots = false, order) {
  7   |   const held = new Set(),
  8   |     captured = new Set();
  9   |   for (let i = 0; i < 4500; i++) {
  10  |     const state = await page.evaluate(() => window.__qa.state());
  11  |     if (i % 400 === 0)
  12  |       console.log(
  13  |         'Field pilot',
  14  |         JSON.stringify({
  15  |           stage: state.stage,
  16  |           position: state.position,
  17  |           elapsed: state.field,
  18  |           calls: state.calls,
  19  |           triangles: state.triangles,
  20  |         }),
  21  |       );
> 22  |     expect(state.deaths, JSON.stringify(state)).toBe(0);
      |                                                 ^ Error: {"position":{"x":0,"y":1.793888807296753,"z":8},"grounded":false,"jumps":0,"deaths":1,"paused":false,"elapsed":363.91666666666436,"stage":1,"complete":false,"collected":0,"checkpoint":-1,"field":{"rewards":[],"runes":[],"enemies":[{"x":-26,"z":-15,"hp":0,"phase":"patrol"},{"x":-18,"z":-13,"hp":0,"phase":"patrol"},{"x":-22,"z":-24,"hp":30,"phase":"patrol"}],"bossHP":150,"bossPhase":"sleep","bossAttack":null,"selected":"orchard"},"combat":{"attacking":false,"combo":0,"airborne":false,"name":"","elapsed":0,"duration":1,"windup":0,"active":0,"phase":"idle","facing":{"x":0.0000020399866907288716,"z":0.9999999999979192},"reach":2.1479999999999997,"buffered":false,"hurt":0},"combatEvents":[],"practiceHits":0,"camera":{"yaw":-1.4567416845679553,"intentYaw":0,"pitch":0,"position":{"x":-13.435572475969035,"y":10.203265120869009,"z":5.253633667621344}},"version":"6.0.0","exp":1200,"characters":1,"name":"らくがきくん","run":{"splits":[],"total":32.893699999809265,"valid":true,"level":5,"stats":{"hp":122,"power":20,"defense":17.2,"speed":5.938947718078047,"jump":8.689254904677462,"weight":1.5512418255375628,"reach":1.448,"actionCooldown":0.6069129130354868,"luck":0,"analysis":{"volume":0.32187208054912964,"bodyArea":0.2803763767849561,"legLength":0.72,"armArea":0.16822582607097367,"colors":{"#ed8063":1,"#659dcc":0,"#83b782":0,"#ebc85b":0,"#a68dc9":0,"#344d48":0},"centerOfMass":1.3}}},"best":null,"records":0,"calls":96,"triangles":27178,"geometries":146,"quality":"medium","resolution":{"width":1280,"height":720}}
  23  |     if (state.complete) break;
  24  |     if (screenshots) {
  25  |       const label =
  26  |         state.stage === 4 &&
  27  |         state.field.runes.length > 0 &&
  28  |         state.field.runes.length < 4 &&
  29  |         !captured.has('timer-active')
  30  |           ? 'timer-active'
  31  |           : state.stage === 3 &&
  32  |               [0, 1, 2].every((i) => state.field.runes.includes(i)) &&
  33  |               !captured.has('water-drained')
  34  |             ? 'water-drained'
  35  |             : state.field.bossPhase === 'windup'
  36  |               ? 'boss-warning'
  37  |               : state.field.rewards.length === 3
  38  |                 ? 'gate-open'
  39  |                 : null;
  40  |       if (label && !captured.has(label)) {
  41  |         await page.screenshot({
  42  |           path:
  43  |             typeof screenshots === 'string'
  44  |               ? `test-results/expedition/${screenshots}-${label}.png`
  45  |               : `test-results/field-${label}.png`,
  46  |         });
  47  |         captured.add(label);
  48  |         if (label === 'timer-active')
  49  |           await expect(page.locator('#objective')).toContainText('残り');
  50  |       }
  51  |     }
  52  |     const stage = STAGES.find((s) => s.id === state.stage);
  53  |     let input = fieldControls(state, i * 4, order || stage.missions.map((m) => m.id), stage);
  54  |     if (state.stage === 3 && typeof screenshots === 'string') {
  55  |       const drained = [0, 1, 2].every((i) => state.field.runes.includes(i)),
  56  |         dx = 25 - state.position.x,
  57  |         dz = -27 - state.position.z,
  58  |         d = Math.hypot(dx, dz);
  59  |       if (!drained && d < 11 && !captured.has('water-before')) {
  60  |         await page.screenshot({
  61  |           path: `test-results/expedition/${screenshots}-water-before.png`,
  62  |         });
  63  |         captured.add('water-before');
  64  |       }
  65  |       if (drained && !captured.has('water-after')) {
  66  |         input = { x: dx / Math.max(1, d), z: dz / Math.max(1, d), jump: false, action: false };
  67  |         if (d < 2) {
  68  |           await page.screenshot({
  69  |             path: `test-results/expedition/${screenshots}-water-after.png`,
  70  |           });
  71  |           captured.add('water-after');
  72  |         }
  73  |       }
  74  |     }
  75  |     input = viewControls(input, state);
  76  |     for (const [key, on] of [
  77  |       ['KeyA', input.x < -0.1],
  78  |       ['KeyD', input.x > 0.1],
  79  |       ['KeyW', input.z < -0.1],
  80  |       ['KeyS', input.z > 0.1],
  81  |       ['Space', input.jump],
  82  |     ]) {
  83  |       if (on && !held.has(key)) {
  84  |         await page.keyboard.down(key);
  85  |         held.add(key);
  86  |       } else if (!on && held.has(key)) {
  87  |         await page.keyboard.up(key);
  88  |         held.delete(key);
  89  |       }
  90  |     }
  91  |     if (input.action) await page.keyboard.press('KeyE');
  92  |     await page.waitForTimeout(35);
  93  |   }
  94  |   for (const key of held) await page.keyboard.up(key);
  95  |   const final = await page.evaluate(() => window.__qa.state());
  96  |   await expect(page.locator('#result'), JSON.stringify(final)).toBeVisible();
  97  |   expect(final.field.rewards).toHaveLength(3);
  98  |   expect(final.deaths).toBe(0);
  99  | }
  100 | 
```
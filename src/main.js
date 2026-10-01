import './style.css';
import { initPhysics, Simulation, DT } from './core/controller.js';
import { prototypePlatforms } from './game/prototype.js';
import { GameView } from './game/view.js';
import { Input } from './ui/input.js';
import { Editor } from './ui/editor.js';

document.querySelector('#app').innerHTML=`<canvas id="world" aria-label="3Dアクションの練習場"></canvas><header><a class="brand" href="./">RAKU<span>GA</span><small>ラクガキの冒険</small></a><div class="stage-label"><i></i> PLAYGROUND <span>はじまりの広場</span></div><button id="pause" aria-label="一時停止">Ⅱ</button></header><section class="intro"><p class="eyebrow">YOUR LITTLE BIG ADVENTURE</p><h1>まずは、<br>動いてみよう。</h1><p>走って、跳んで。冒険の準備をしよう。</p><div class="pill">01 / 操作プロトタイプ</div></section><aside id="status" role="status">世界を準備しています…</aside><div class="controls"><div><div id="stick" aria-label="移動スティック"><span></span></div><label>MOVE</label></div><div class="buttons"><button id="action">↺<small>ACTION</small></button><button id="jump">↑<small>JUMP</small></button></div></div><footer>WASD / 矢印キーで移動 <b>·</b> SPACEでジャンプ <b>·</b> Eでリトライ</footer><div id="rotate">↻<strong>横向きにすると、もっと遊びやすい。</strong><span>スマートフォンを横向きにしてください</span></div><dialog id="pause-dialog"><p class="eyebrow">TAKE A BREATH</p><h2>ちょっと、ひとやすみ。</h2><button id="resume" class="primary">冒険にもどる →</button><button id="reset">スタートへ戻る</button></dialog>`;
const $=s=>document.querySelector(s);
try {
  await initPhysics();
  const sim=new Simulation(prototypePlatforms);
  const view=new GameView($('#world'),prototypePlatforms);
  const input=new Input($('#stick'),$('#jump'),$('#action'));
  const drawButton=document.createElement('button');drawButton.id='draw-open';drawButton.textContent='✎ ラクガキを描く';document.querySelector('#app').append(drawButton);
  const editor=new Editor((drawing,name)=>{view.setCharacter(drawing);editor.root.close();sim.reset();document.querySelector('.intro h1').textContent=`${name}、誕生！`;document.querySelector('.intro>p:not(.eyebrow)').textContent='きみのラクガキで、動いてみよう。';});
  drawButton.onclick=()=>{paused=true;input.clear();editor.open();};
  editor.root.addEventListener('close',()=>{paused=false;last=performance.now();});
  let paused=false,last=performance.now(),accumulator=0,actionHeld=false,elapsed=0;
  const pause=()=>{paused=true;input.clear();if(!$('#pause-dialog').open)$('#pause-dialog').showModal();};
  $('#pause').onclick=pause;
  $('#resume').onclick=()=>{$('#pause-dialog').close();paused=false;last=performance.now();};
  $('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();$('#resume').click();});
  $('#reset').onclick=()=>{sim.reset();$('#resume').click();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('resize',()=>view.resize());
  function frame(now){const delta=Math.min((now-last)/1000,.1);last=now;if(!paused){accumulator+=delta;while(accumulator>=DT){const controls=input.read();if(controls.action&&!actionHeld)sim.reset();actionHeld=controls.action;sim.step(controls);accumulator-=DT;elapsed+=DT;}}else accumulator=0;view.render(sim,delta);$('#status').textContent=`${sim.grounded?'● ON GROUND':'↑ IN THE AIR'}  ·  ${Math.hypot(sim.vx,sim.vz).toFixed(1)} m/s`;requestAnimationFrame(frame);}
  if(import.meta.env.DEV)window.__qa={state:()=>({position:{...sim.position},grounded:sim.grounded,jumps:sim.jumps,deaths:sim.deaths,paused,elapsed,calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles}),reset:()=>sim.reset()};
  requestAnimationFrame(frame);
}catch(error){$('#status').textContent='起動できませんでした。WebGL対応ブラウザで再読み込みしてください。';console.error(error);}

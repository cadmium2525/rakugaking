import {Simulation,DT} from '../core/controller.js';
import {prototypePlatforms} from './prototype.js';
import {GameView} from './view.js';
import {Input} from '../ui/input.js';
import {Editor} from '../ui/editor.js';
import {calculateStats,statRows} from '../core/stats.js';
import {defaultDrawing} from '../core/drawing.js';
import {STAGES,getStage} from './stages.js';
import {Course} from '../core/course.js';
import {createStageSelect} from '../ui/stage-select.js';
import {newPlayer,levelFromExp,awardClear,levelStats} from '../core/progression.js';
import {RunTimer,formatTime} from '../core/timer.js';
import {$} from '../ui/shell.js';
import {sanitizeDrawing} from '../core/shape.js';
import {RankingPanel} from '../ui/ranking-panel.js';

export class GameApp {
  constructor(){
    this.player=newPlayer();this.drawing=defaultDrawing();this.name='らくがきくん';this.best=null;this.records=[];
    this.sim=new Simulation(prototypePlatforms);this.course=null;this.run=null;
    this.view=new GameView($('#world'),prototypePlatforms);
    this.input=new Input($('#stick'),$('#jump'),$('#action'));
    this.paused=false;this.last=performance.now();this.accumulator=0;this.actionHeld=false;this.elapsed=0;
    this.editor=new Editor((drawing,name)=>this.birth(drawing,name));
    this.ranking=new RankingPanel();this.ranking.dialog.addEventListener('close',()=>this.resume());
    $('#ranking-open').onclick=()=>{this.paused=true;this.input.clear();this.ranking.open();};
    $('#submit-score').onclick=async()=>{const button=$('#submit-score');button.disabled=true;$('#submit-status').textContent='記録を送信しています…';try{await this.ranking.submit(this.records.at(-1),$('#player-name').value.trim());$('#submit-status').textContent='登録しました。広場のランキングで確認できます。';}catch(error){$('#submit-status').textContent=error.message;}finally{button.disabled=false;}};
    this.editor.root.addEventListener('close',()=>this.resume());
    this.select=createStageSelect(STAGES,id=>this.startStage(id));
    this.select.addEventListener('close',()=>{if(this.course?.complete)this.goHome();else this.resume();});
    $('#draw-open').onclick=()=>{this.paused=true;this.input.clear();this.editor.open();};
    $('#adventure').onclick=()=>this.openStages();
    $('#time-attack').onclick=()=>this.startRun();
    $('#pause').onclick=()=>this.pause();
    $('#resume').onclick=()=>{$('#pause-dialog').close();this.resume();};
    $('#reset').onclick=()=>{if(this.course)this.course.retry();else this.sim.reset();$('#resume').click();};
    $('#home').onclick=()=>{$('#pause-dialog').close();this.goHome();};
    $('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();$('#resume').click();});
    $('#result').addEventListener('cancel',e=>e.preventDefault());
    $('#select-next').onclick=()=>{ $('#result').close();if(this.run&&!this.run.timer.finished)this.startStage(this.run.timer.splits.length+1);else{this.run=null;this.openStages();}};
    document.addEventListener('visibilitychange',()=>{this.input.clear();if(document.hidden&&this.course&&!this.course.complete){this.run?.timer.invalidate('バックグラウンドに移動したため記録対象外');this.pause();}});
    window.addEventListener('resize',()=>this.view.resize());
    this.refreshPlayer();
    this.frame=this.frame.bind(this);
    if(import.meta.env.DEV)window.__qa={state:()=>this.state(),reset:()=>this.sim.reset()};
    requestAnimationFrame(this.frame);
  }
  refreshPlayer(){this.select.refresh(this.player.unlocked);$('#player-level').textContent=`PLAYER LV.${levelFromExp(this.player.exp)} · ${this.player.exp} EXP`;$('#time-attack').disabled=!this.player.cleared.includes(5);$('#time-attack').textContent=this.player.cleared.includes(5)?'ALL STAGES TIME ATTACK →':'TIME ATTACK · 5ステージクリアで解放';}
  birth(drawing,name){this.drawing=drawing;this.name=name;this.view.setCharacter(drawing);this.sim.stats=levelStats(calculateStats(drawing),levelFromExp(this.player.exp));this.editor.root.close();this.sim.reset();$('.intro h1').textContent=`${name}、誕生！`;$('.intro>p:not(.eyebrow)').textContent='きみのラクガキで、動いてみよう。';$('.pill').textContent=statRows(this.sim.stats).map(([k,v])=>`${k} ${v}`).join(' · ');}
  openStages(){this.paused=true;this.input.clear();this.select.showModal();}
  startRun(){if(!this.player.cleared.includes(5))return;const drawing=sanitizeDrawing(this.drawing);this.run={timer:new RunTimer(),drawing,stats:levelStats(calculateStats(drawing),levelFromExp(this.player.exp)),name:this.name,level:levelFromExp(this.player.exp)};this.startStage(1);}
  startStage(id){
    if(!this.run&&id>this.player.unlocked)return;
    this.sim.dispose();this.course=new Course(getStage(id),this.run?.stats||levelStats(calculateStats(this.drawing),levelFromExp(this.player.exp)));this.sim=this.course.sim;
    this.view.setStage(this.course.stage);this.view.setCharacter(this.run?.drawing||this.drawing);
    this.accumulator=0;this.input.clear();this.resume();
    document.body.classList.add('playing');$('.stage-label').textContent=`0${id} / ${this.course.stage.name}`;$('footer').textContent=this.course.stage.hint;
    $('#run-hud').hidden=!this.run;
    this.run?.timer.startStage(id);
  }
  goHome(){this.run=null;this.course=null;this.sim.dispose();this.sim=new Simulation(prototypePlatforms);this.view.setStage({...STAGES[0],platforms:prototypePlatforms,goal:{x:0,y:0,z:100}});this.view.setCharacter(this.drawing);document.body.classList.remove('playing');$('.stage-label').textContent='PLAYGROUND / はじまりの広場';$('#run-hud').hidden=true;this.resume();}
  pause(){this.paused=true;this.input.clear();$('#pause-note').textContent=this.run?'タイムアタックの時計は一時停止中も進みます。':'';if(!document.querySelector('dialog[open]'))$('#pause-dialog').showModal();}
  resume(){this.paused=false;this.last=performance.now();this.accumulator=0;}
  finish(){
    this.paused=true;this.input.clear();
    const gained=awardClear(this.player,this.course.stage.id);this.refreshPlayer();
    let time=this.course.elapsed;
    if(this.run){time=this.run.timer.endStage(this.course.stage.id);if(this.run.timer.finished){const record={id:crypto.randomUUID(),version:'1.0.0',character:this.run.name,level:this.run.level,stats:this.run.stats,drawing:this.run.drawing,splits:[...this.run.timer.splits],total:this.run.timer.total(),valid:this.run.timer.valid,reason:this.run.timer.reason};this.records.push(record);if(record.valid&&(this.best===null||record.total<this.best))this.best=record.total;}}
    $('#result-title').textContent=this.run?.timer.finished?'5つの世界を、きみの形で。':'ステージクリア！';
    $('#clear-time').textContent=`${formatTime(time)} · 落下 ${this.sim.deaths} 回 · +${gained} EXP`;
    $('#splits').textContent=this.run?this.run.timer.splits.map((t,i)=>`STAGE ${i+1}  ${formatTime(t)}`).join(' / ')+(this.run.timer.valid?'':` / ${this.run.timer.reason}`):'';
    $('#select-next').textContent=this.run&&!this.run.timer.finished?'次のステージへ →':'ステージを選ぶ →';$('#result').showModal();
    $('#ranking-submit').hidden=!this.run?.timer.finished||!this.run?.timer.valid;$('#submit-status').textContent='';
  }
  frame(now){
    const delta=Math.min((now-this.last)/1000,.1);this.last=now;
    if(!this.paused){this.accumulator+=delta;while(this.accumulator>=DT){const controls=this.input.read();if(controls.action&&!this.actionHeld&&!this.course)this.sim.reset();this.actionHeld=controls.action;const event=this.course?this.course.step(controls):this.sim.step(controls);this.accumulator-=DT;this.elapsed+=DT;if(event==='complete'){this.finish();break;}}}else this.accumulator=0;
    if(this.course)this.view.updateCourse(this.course);this.view.render(this.sim,this.paused?0:delta);
    $('#status').textContent=`${this.course?`HP ${Math.ceil(this.course.hp)} · `:''}${this.sim.grounded?'● ON GROUND':'↑ IN THE AIR'} · ${Math.hypot(this.sim.vx,this.sim.vz).toFixed(1)} m/s`;
    if(this.run)$('#run-hud').textContent=`STAGE ${formatTime(this.run.timer.stageTime())} · TOTAL ${formatTime(this.run.timer.total())} · BEST ${formatTime(this.best)}${this.run.timer.valid?'':' · 記録対象外'}`;
    requestAnimationFrame(this.frame);
  }
  state(){return {position:{...this.sim.position},grounded:this.sim.grounded,jumps:this.sim.jumps,deaths:this.sim.deaths,paused:this.paused,elapsed:this.elapsed,stage:this.course?.stage.id,complete:this.course?.complete,exp:this.player.exp,run:this.run?{splits:[...this.run.timer.splits],total:this.run.timer.total(),valid:this.run.timer.valid,level:this.run.level,stats:this.run.stats}:null,best:this.best,records:this.records.length,calls:this.view.renderer.info.render.calls,triangles:this.view.renderer.info.render.triangles};}
}

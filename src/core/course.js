import {Simulation,DT} from './controller.js';
export class Course {
  constructor(stage,stats){this.stage=stage;this.sim=new Simulation(stage.platforms,stage.spawn,stats);this.elapsed=0;this.complete=false;this.activated=!stage.requiresAction;this.sealHP=stage.sealHP||1;this.actionHeld=false;this.nextAction=0;this.nextDamage=0;this.destroyed=new Set();this.collected=new Set();this.hp=stats.hp||100;this.collapseTimes=stage.platforms.map(()=>null);}
  step(input){if(this.complete)return 'complete';this.elapsed+=DT;this.updatePlatforms();const event=this.sim.step(input,this.environment());if(event==='death')this.restore();const p=this.sim.position,g=this.stage.goal,stats=this.sim.stats;const distance=Math.hypot(p.x-g.x,p.z-g.z);const attack=input.action&&!this.actionHeld&&this.elapsed>=this.nextAction;this.actionHeld=!!input.action;
    if(attack){this.nextAction=this.elapsed+(stats.actionCooldown||.6)-(stats.luck||0)*.8;if(distance<(stats.reach||1)+1){this.sealHP-=stats.power||20;if(this.sealHP<=0)this.activated=true;}}
    for(const [i,h] of (this.stage.hazards||[]).entries()){if(this.destroyed.has(i))continue;const d=Math.hypot(p.x-h.x,p.z-h.z,p.y-h.y);if(attack&&d<(stats.reach||1)+.7)this.destroyed.add(i);else if(d<.8&&this.elapsed>=this.nextDamage){this.hp-=Math.max(4,25-(stats.defense||8)*.6);this.nextDamage=this.elapsed+1;if(this.hp<=0){this.sim.deaths++;this.retry();return 'death';}}}
    if(distance<1.1&&Math.abs(p.y-(g.y+.8))<1.2&&this.activated){this.complete=true;return 'complete';}return event;}
  updatePlatforms(){const p=this.sim.position;for(const [i,t] of this.stage.platforms.entries()){if(!t.collapse)continue;if(this.collapseTimes[i]===null&&this.sim.grounded&&Math.abs(p.x-t.x)<t.w/2&&Math.abs(p.z-t.z)<t.d/2&&Math.abs(p.y-.8-t.y-t.h/2)<.15)this.collapseTimes[i]=this.elapsed;if(this.collapseTimes[i]!==null&&this.elapsed-this.collapseTimes[i]>t.collapse)this.sim.platforms[i].setEnabled(false);}}
  restore(){this.hp=this.sim.stats.hp||100;this.collapseTimes.fill(null);this.sim.platforms.forEach(p=>p.setEnabled(true));this.destroyed.clear();}
  retry(){this.restore();this.sim.reset();}
  environment(){const p=this.sim.position,w=this.stage.wind,water=this.stage.water;return {windZ:w&&p.z>w.minZ&&p.z<w.maxZ?5.7+Math.sin(this.elapsed*1.4)*2.5:0,water:!!water&&p.z>water.minZ&&p.z<water.maxZ&&p.y<water.surface+1.2};}
  dispose(){this.sim.dispose();}
}

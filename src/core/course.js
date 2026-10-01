import {Simulation,DT} from './controller.js';
export class Course {
  constructor(stage,stats){this.stage=stage;this.sim=new Simulation(stage.platforms,stage.spawn,stats);this.elapsed=0;this.complete=false;this.activated=!stage.requiresAction;this.actionHeld=false;this.collected=new Set();this.hp=stats.hp||100;}
  step(input){if(this.complete)return 'complete';this.elapsed+=DT;const event=this.sim.step(input,this.environment());if(event==='death')this.hp=this.sim.stats.hp||100;const p=this.sim.position,g=this.stage.goal;const distance=Math.hypot(p.x-g.x,p.z-g.z);if(input.action&&!this.actionHeld&&distance<(this.sim.stats.reach||1)+1)this.activated=true;this.actionHeld=!!input.action;if(distance<1.1&&Math.abs(p.y-(g.y+.8))<1.2&&this.activated){this.complete=true;return 'complete';}return event;}
  environment(){const p=this.sim.position,w=this.stage.wind,water=this.stage.water;return {windZ:w&&p.z>w.minZ&&p.z<w.maxZ?5.7+Math.sin(this.elapsed*1.4)*2.5:0,water:!!water&&p.z>water.minZ&&p.z<water.maxZ&&p.y<water.surface+1.2};}
  dispose(){this.sim.dispose();}
}

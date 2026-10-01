import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics} from '../src/core/controller.js';
import {Course} from '../src/core/course.js';
import {STAGES} from '../src/game/stages.js';
before(initPhysics);
const builds={STANDARD:{speed:6,jump:8.5,weight:1,hp:100},HEAVY:{speed:4.3,jump:7.5,weight:2.6,hp:180},SPEED:{speed:7.5,jump:8,weight:.8,hp:90},JUMP:{speed:5.5,jump:10,weight:1,hp:110},POWER:{speed:5,jump:8,weight:1.8,hp:130},EXTREME:{speed:4.3,jump:7.5,weight:.7,hp:80}};
export function drive(course){let index=0;for(let frame=0;frame<3600&&!course.complete;frame++){const p=course.sim.position,tiles=course.stage.platforms;while(index<tiles.length-1&&p.z<tiles[index+1].z+tiles[index+1].d/2-.5&&course.sim.grounded)index++;const current=tiles[index],target=tiles[Math.min(index+1,tiles.length-1)];const nearEdge=p.z-current.z+current.d/2<1;course.step({x:Math.max(-.6,Math.min(.6,(target.x-p.x)*.8)),z:-1,jump:nearEdge&&index<tiles.length-1&&course.sim.grounded,action:frame%12===0});if(course.sim.deaths)index=0;}return {time:course.elapsed,deaths:course.sim.deaths};}
for(const stage of STAGES)test(`stage ${stage.id}: all six builds reach goal twice`,()=>{const report=[];for(const [name,stats] of Object.entries(builds))for(let run=0;run<2;run++){const c=new Course(stage,stats),result=drive(c);assert.ok(c.complete,`${name} failed at ${JSON.stringify(c.sim.position)}`);assert.equal(result.deaths,0,`${name} fell`);report.push({name,...result});c.dispose();}console.log(JSON.stringify({stage:stage.id,runs:report}));});

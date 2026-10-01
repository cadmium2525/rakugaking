import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,initPhysics} from '../src/core/controller.js';
before(initPhysics);
const floor={x:0,y:-.5,z:0,w:30,h:1,d:30};
function steps(s,n,input={}){for(let i=0;i<n;i++)s.step(input);}
test('floor supports capsule without sinking for 10 seconds',()=>{const s=new Simulation([floor]);steps(s,600);assert.ok(s.grounded);assert.ok(Math.abs(s.position.y-.82)<.03);s.dispose();});
test('holding jump never repeats; mid-air repress cannot double jump',()=>{const s=new Simulation([floor]);steps(s,90);steps(s,15,{jump:true});const y=s.position.y;steps(s,1);steps(s,15,{jump:true});assert.equal(s.jumps,1);assert.ok(y>1);steps(s,180,{jump:true});assert.equal(s.jumps,1);assert.ok(s.grounded);steps(s,1);steps(s,1,{jump:true});assert.equal(s.jumps,2);s.dispose();});
test('wall cannot be crossed, including at maximum speed',()=>{const s=new Simulation([floor,{x:3,y:2,z:0,w:.5,h:5,d:30}],undefined,{speed:16});steps(s,300,{x:1});assert.ok(s.position.x<2.42);assert.ok(s.position.x>2);s.dispose();});
test('diagonal movement is normalized',()=>{const a=new Simulation([floor]),b=new Simulation([floor]);steps(a,90);steps(b,90);steps(a,60,{x:1});steps(b,60,{x:1,z:1});assert.ok(Math.abs(a.position.x-Math.hypot(b.position.x,b.position.z))<.01);a.dispose();b.dispose();});
test('slope climbs without falling through',()=>{const s=new Simulation([floor,{x:2,y:.65,z:0,w:5,h:.3,d:3,angle:.3}],{x:-1,y:2,z:0});steps(s,90);steps(s,38,{x:1});assert.ok(s.position.y>1.2);assert.ok(s.position.x>0);s.dispose();});
test('fall respawns; invalid input cannot introduce NaN',()=>{const s=new Simulation([{...floor,w:2,d:2}]);steps(s,600,{x:1});assert.ok(s.deaths>0);steps(s,1,{x:NaN,z:Infinity});assert.ok(Number.isFinite(s.position.x));s.dispose();});

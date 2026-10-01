import {test} from 'node:test';
import assert from 'node:assert/strict';
import {levelFromExp,newPlayer,awardClear,levelStats} from '../src/core/progression.js';
import {calculateStats} from '../src/core/stats.js';
import {defaultDrawing} from '../src/core/drawing.js';
test('EXP boundaries, unlock progression, repeated clear rewards',()=>{assert.equal(levelFromExp(0),1);assert.equal(levelFromExp(99),1);assert.equal(levelFromExp(100),2);assert.equal(levelFromExp(NaN),1);const p=newPlayer();for(let s=1;s<=5;s++)awardClear(p,s);assert.equal(p.unlocked,5);assert.equal(p.exp,1200);assert.equal(levelFromExp(p.exp),5);awardClear(p,1);assert.equal(p.exp,1240);assert.equal(p.cleared.length,5);});
test('level bonuses preserve shape differences and weight even at level 20',()=>{const d=defaultDrawing(),a=calculateStats(d);d.body[0].points=d.body[0].points.map(p=>({x:.5+(p.x-.5)*1.5,y:.5+(p.y-.5)*1.5}));const b=calculateStats(d);for(const l of [1,2,5,20]){const x=levelStats(a,l),y=levelStats(b,l);assert.ok(y.weight>x.weight&&y.hp>x.hp&&y.speed<x.speed);assert.equal(x.weight,a.weight);assert.ok(Math.abs((y.speed-x.speed)-(b.speed-a.speed))<1e-10);}});

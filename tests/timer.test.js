import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RunTimer,formatTime} from '../src/core/timer.js';
test('monotonic time excludes transitions but includes pauses and retries',()=>{let now=0;const t=new RunTimer(()=>now);for(let id=1;id<=5;id++){t.startStage(id);now+=10000;assert.equal(t.stageTime(),10);now+=2500;t.endStage(id);now+=60000;}assert.equal(t.total(),62.5);assert.deepEqual(t.splits,[12.5,12.5,12.5,12.5,12.5]);assert.ok(t.finished);assert.throws(()=>t.startStage(6));});
test('stage skipping, duplicate finish, and background runs cannot be ranked',()=>{let now=0;const t=new RunTimer(()=>now);assert.throws(()=>t.startStage(2));t.startStage(1);assert.throws(()=>t.startStage(1));now=1200;t.endStage(1);assert.throws(()=>t.endStage(1));t.invalidate('background');assert.equal(t.valid,false);assert.equal(t.reason,'background');});
test('formatting is stable at minute boundaries',()=>{assert.equal(formatTime(59.999),'0:59.99');assert.equal(formatTime(60),'1:00.00');assert.equal(formatTime(null),'—');});

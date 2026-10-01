import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DrawingHistory,PARTS} from '../src/core/drawing.js';
test('history preserves independent parts and branches after undo',()=>{const h=new DrawingHistory(),original=structuredClone(h.data);h.change(d=>d.head=[]);h.change(d=>d.body=[]);h.undo();assert.deepEqual(h.data.body,original.body);h.redo();assert.deepEqual(h.data.body,[]);h.undo();h.change(d=>d.armLeft=[]);assert.equal(h.redoStack.length,0);assert.equal(Object.keys(h.data).length,PARTS.length);});
test('history bounded to 40 complete snapshots',()=>{const h=new DrawingHistory();for(let i=0;i<100;i++)h.change(d=>d.head=[]);assert.equal(h.undoStack.length,40);});

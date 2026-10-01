export const PARTS=['body','head','armLeft','armRight','legLeft','legRight'];
export const LABELS={body:'からだ',head:'あたま',armLeft:'左うで',armRight:'右うで',legLeft:'左あし',legRight:'右あし'};
export const COLORS=['#ed8063','#659dcc','#83b782','#ebc85b','#a68dc9','#344d48'];
export const copy=value=>structuredClone(value);
export function defaultDrawing(){const result={};for(const part of PARTS){const points=[];const arm=part.includes('arm'),leg=part.includes('leg');for(let i=0;i<28;i++){const a=i/28*Math.PI*2;points.push({x:.5+Math.cos(a)*(arm?.15:leg?.18:.3),y:.5+Math.sin(a)*(arm||leg?.36:.3)});}result[part]=[{color:COLORS[0],points}];}return result;}
export class DrawingHistory{
  constructor(drawing=defaultDrawing()){this.data=copy(drawing);this.undoStack=[];this.redoStack=[];}
  change(fn){this.undoStack.push(copy(this.data));if(this.undoStack.length>40)this.undoStack.shift();this.redoStack=[];fn(this.data);}
  undo(){if(!this.undoStack.length)return;this.redoStack.push(copy(this.data));this.data=this.undoStack.pop();}
  redo(){if(!this.redoStack.length)return;this.undoStack.push(copy(this.data));this.data=this.redoStack.pop();}
}

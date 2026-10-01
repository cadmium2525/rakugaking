import {PARTS,COLORS,defaultDrawing} from './drawing.js';
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function area(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p.x*q.y-q.x*p.y;}return Math.abs(a)/2;}
const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
function hull(points){const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),lower=[],upper=[];for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of sorted.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return [...lower.slice(0,-1),...upper.slice(0,-1)];}
function intersects(points){for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){if(i===0&&j===points.length-1)continue;const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;}return false;}
export function bounds(points){return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
export function sanitizeStroke(stroke){
  let points=Array.isArray(stroke?.points)?stroke.points.slice(0,1024).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:clamp(p.x,0,1),y:clamp(p.y,0,1)})):[];
  points=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>.004);
  if(points.length>64){const input=points;points=Array.from({length:64},(_,i)=>input[Math.floor(i*input.length/64)]);}
  if(!points.length)points=[{x:.5,y:.5}];
  const b=bounds(points);
  if(points.length<3||area(points)<.0008||b.maxX-b.minX<.025||b.maxY-b.minY<.025){
    const cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2,rx=Math.max(.03,(b.maxX-b.minX)/2),ry=Math.max(.03,(b.maxY-b.minY)/2);
    points=Array.from({length:20},(_,i)=>({x:cx+Math.cos(i/20*Math.PI*2)*rx,y:cy+Math.sin(i/20*Math.PI*2)*ry}));
  }else if(intersects(points))points=hull(points);
  return {color:COLORS.includes(stroke?.color)?stroke.color:COLORS[0],points};
}
export function sanitizeDrawing(raw){const fallback=defaultDrawing(),out={};for(const part of PARTS){const strokes=Array.isArray(raw?.[part])?raw[part].slice(0,12):[];out[part]=(strokes.length?strokes:fallback[part]).map(sanitizeStroke);}return out;}
export function describeDrawing(raw){const drawing=sanitizeDrawing(raw),parts={};for(const p of PARTS){const strokes=drawing[p];const b=bounds(strokes.flatMap(s=>s.points));parts[p]={width:b.maxX-b.minX,height:b.maxY-b.minY,area:clamp(strokes.reduce((s,v)=>s+area(v.points),0),.002,1),bounds:b};}return {drawing,parts};}

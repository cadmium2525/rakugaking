export class RunTimer {
  constructor(now=()=>performance.now()){this.now=now;this.splits=[];this.started=null;this.valid=true;this.reason='';this.finished=false;}
  startStage(id){if(this.started!==null||this.finished||id!==this.splits.length+1)throw new Error('Invalid stage order');this.started=this.now();}
  stageTime(){return this.started===null?0:Math.max(0,(this.now()-this.started)/1000);}
  total(){return this.splits.reduce((a,b)=>a+b,0)+this.stageTime();}
  endStage(id){if(this.started===null||id!==this.splits.length+1)throw new Error('Invalid finish');const time=this.stageTime();this.splits.push(time);this.started=null;this.finished=this.splits.length===5;return time;}
  invalidate(reason){this.valid=false;this.reason=reason;}
}
export function formatTime(seconds){if(!Number.isFinite(seconds))return '—';const hundredths=Math.floor(Math.max(0,seconds)*100);return `${Math.floor(hundredths/6000)}:${String(Math.floor(hundredths/100)%60).padStart(2,'0')}.${String(hundredths%100).padStart(2,'0')}`;}

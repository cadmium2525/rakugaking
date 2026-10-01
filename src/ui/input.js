export class Input {
  constructor(stick, jump, action) {
    this.keys=new Set(); this.x=0;this.z=0;this.jump=false;this.action=false;this.pointer=null;
    this.abort=new AbortController(); const options={signal:this.abort.signal};
    this.on=(node,type,fn)=>node.addEventListener(type,fn,options);
    this.on(window,'keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys.add(e.code);});
    this.on(window,'keyup',e=>this.keys.delete(e.code));
    this.on(window,'blur',()=>this.clear());
    this.on(document,'visibilitychange',()=>this.clear());
    this.on(window,'resize',()=>this.clear());
    this.stick=stick;
    const move=e=>{if(e.pointerId!==this.pointer)return;const b=stick.getBoundingClientRect(),r=b.width*.34;const dx=(e.clientX-b.left-b.width/2)/r,dz=(e.clientY-b.top-b.height/2)/r;const m=Math.max(1,Math.hypot(dx,dz));this.x=dx/m;this.z=dz/m;stick.firstElementChild.style.transform=`translate(${this.x*r}px,${this.z*r}px)`;};
    this.on(stick,'pointerdown',e=>{if(this.pointer!==null)return;this.pointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
    this.on(stick,'pointermove',move);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.on(stick,type,e=>{if(e.pointerId===this.pointer){this.pointer=null;this.x=0;this.z=0;stick.firstElementChild.style.transform='';}});
    for(const [button,key] of [[jump,'jump'],[action,'action']]){
      const pointers=new Set();
      this.on(button,'pointerdown',e=>{button.setPointerCapture(e.pointerId);pointers.add(e.pointerId);this[key]=true;});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])this.on(button,type,e=>{pointers.delete(e.pointerId);this[key]=pointers.size>0;});
    }
  }
  read(){return {x:this.x+(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0),z:this.z+(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0),jump:this.jump||this.keys.has('Space'),action:this.action||this.keys.has('KeyE')};}
  clear(){this.keys.clear();this.x=0;this.z=0;this.jump=false;this.action=false;this.pointer=null;if(this.stick)this.stick.firstElementChild.style.transform='';}
  dispose(){this.abort.abort();}
}

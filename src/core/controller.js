import RAPIER from '@dimforge/rapier3d-compat';

export const DT = 1 / 60;
export const HALF_HEIGHT = 0.8;
let initialization;
export async function initPhysics() { initialization ??= RAPIER.init(); await initialization; }

export class Simulation {
  constructor(platforms, spawn = {x:0,y:2,z:0}, stats = {}) {
    this.world = new RAPIER.World({x:0,y:-22,z:0});
    this.world.timestep = DT;
    this.platforms = platforms.map(p => {
      const desc = RAPIER.ColliderDesc.cuboid(p.w/2,p.h/2,p.d/2).setTranslation(p.x,p.y,p.z);
      if (p.angle) desc.setRotation({x:0,y:0,z:Math.sin(p.angle/2),w:Math.cos(p.angle/2)});
      return this.world.createCollider(desc);
    });
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x,spawn.y,spawn.z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(.45,.35),this.body);
    this.controller = this.world.createCharacterController(.02);
    this.controller.enableAutostep(.25,.3,false);
    // Gravity maintains contact without a second downward correction.
    // Rapier is pinned to 0.19.3: 0.21.0 failed the floor/diagonal regressions.
    this.controller.setMaxSlopeClimbAngle(Math.PI/4);
    this.controller.setMinSlopeSlideAngle(Math.PI/3);
    this.spawn = {...spawn};
    this.stats = {speed:6,jump:8.5,weight:1,...stats};
    this.vx=0; this.vz=0; this.vy=0; this.grounded=false; this.jumpHeld=false; this.jumps=0; this.deaths=0;
    this.motion={x:0,y:0,z:0}; this.next={x:0,y:0,z:0};
    this.world.step();
  }
  get position() { return this.body.translation(); }
  reset() {
    this.body.setTranslation(this.spawn,true); this.body.setNextKinematicTranslation(this.spawn);
    this.vx=0; this.vy=0; this.vz=0; this.grounded=false; this.jumpHeld=false;
    this.world.step();
  }
  step(input = {}, environment = {}) {
    let x=Number.isFinite(input.x)?input.x:0, z=Number.isFinite(input.z)?input.z:0;
    const length=Math.hypot(x,z); if(length>1){x/=length;z/=length;}
    const jumping=!!input.jump&&!this.jumpHeld;
    this.jumpHeld=!!input.jump;
    if(jumping&&this.grounded){this.vy=this.stats.jump;this.grounded=false;this.jumps++;}
    const acceleration=1-Math.exp(-DT*(this.grounded?14:6)/Math.sqrt(this.stats.weight));
    const water=environment.water? .65:1;
    this.vx+=(x*this.stats.speed*water-this.vx)*acceleration;
    this.vz+=(z*this.stats.speed*water-this.vz)*acceleration;
    this.vy=Math.max(-30,this.vy-(environment.water?12:22)*DT);
    this.motion.x=(this.vx+(environment.wind||0)/this.stats.weight)*DT;
    this.motion.y=this.vy*DT; this.motion.z=this.vz*DT;
    this.controller.computeColliderMovement(this.collider,this.motion);
    const move=this.controller.computedMovement();
    this.grounded=this.controller.computedGrounded();
    if(this.grounded&&this.vy<0) this.vy=0;
    if(this.motion.y>0&&move.y<this.motion.y-.001) this.vy=0;
    const p=this.position;
    this.next.x=p.x+move.x;this.next.y=p.y+move.y;this.next.z=p.z+move.z;
    this.body.setNextKinematicTranslation(this.next);
    this.world.step();
    if(this.position.y < -12){this.deaths++;this.reset();return 'death';}
    return this.grounded?'ground':'air';
  }
  dispose(){this.world.free();}
}

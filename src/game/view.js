import * as THREE from 'three';
import { HALF_HEIGHT } from '../core/controller.js';
import { buildCharacter, disposeCharacter } from './character.js';
import { animateCharacter } from './animation.js';

export class GameView {
  constructor(canvas, platforms) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setClearColor(0xdcebe5);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xdcebe5,30,65);
    this.camera=new THREE.PerspectiveCamera(48,1,.1,100);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x52635b,2.6));
    const sun=new THREE.DirectionalLight(0xfff2d0,3);sun.position.set(-5,12,8);this.scene.add(sun);
    this.world=new THREE.Group();this.scene.add(this.world);
    for(const p of platforms){const mesh=new THREE.Mesh(new THREE.BoxGeometry(p.w,p.h,p.d),new THREE.MeshStandardMaterial({color:p.color||0xa5cc77,roughness:.95}));mesh.position.set(p.x,p.y,p.z);mesh.rotation.z=p.angle||0;this.world.add(mesh);}
    this.avatar=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.7,4,8),new THREE.MeshStandardMaterial({color:0xfe8f70,roughness:.7}));
    body.position.y=.8;this.avatar.add(body);
    for(const x of [-.12,.12]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0x243a37}));eye.position.set(x,1.13,.29);this.avatar.add(eye);}
    this.scene.add(this.avatar);
    this.target=new THREE.Vector3();this.cameraTarget=new THREE.Vector3();this.look=new THREE.Vector3();this.initial=true;
    this.resize();
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  setCharacter(drawing){this.scene.remove(this.avatar);disposeCharacter(this.avatar);this.avatar=buildCharacter(drawing);this.scene.add(this.avatar);}
  setStage(stage){this.scene.remove(this.world);disposeCharacter(this.world);this.world=new THREE.Group();this.scene.add(this.world);this.renderer.setClearColor(stage.sky);this.scene.fog.color.setHex(stage.sky);this.platformMeshes=[];for(const [i,p] of stage.platforms.entries()){const mesh=new THREE.Mesh(new THREE.BoxGeometry(p.w,p.h,p.d),new THREE.MeshStandardMaterial({color:p.color||stage.color,roughness:.95}));mesh.position.set(p.x,p.y,p.z);this.world.add(mesh);this.platformMeshes.push(mesh);const top=new THREE.Mesh(new THREE.BoxGeometry(p.w+.04,.12,p.d+.04),new THREE.MeshStandardMaterial({color:p.color||stage.color,roughness:1}));top.position.set(0,p.h/2,0);mesh.add(top);for(let n=0;n<3;n++){const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(.2+n*.07,0),new THREE.MeshStandardMaterial({color:0xf1db9c}));stone.position.set(p.x+p.w/2-.7,p.y+p.h/2+.3,p.z+(n-1)*.7);this.world.add(stone);}if(i%2===0){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,1.2,5),new THREE.MeshStandardMaterial({color:0x8d8162}));trunk.position.set(p.x-p.w/2+.6,p.y+p.h/2+.6,p.z);const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(.8,0),new THREE.MeshStandardMaterial({color:0x668e6c}));leaves.position.y=1;trunk.add(leaves);this.world.add(trunk);}}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.1,8,24),new THREE.MeshStandardMaterial({color:0xffd478,emissive:0xc78629,emissiveIntensity:.3}));ring.position.set(stage.goal.x,stage.goal.y+1.2,stage.goal.z);this.world.add(ring);this.goalRing=ring;this.initial=true;
    if(stage.wind){for(let i=0;i<8;i++){const vane=new THREE.Mesh(new THREE.ConeGeometry(.15,.8,4),new THREE.MeshStandardMaterial({color:0xf9fcf4}));vane.rotation.x=Math.PI/2;vane.position.set((i%2?1:-1)*1.7,1,-6-i*2);this.world.add(vane);}}
    if(stage.water){const w=stage.water;const water=new THREE.Mesh(new THREE.PlaneGeometry(7,w.maxZ-w.minZ),new THREE.MeshStandardMaterial({color:0x4cbdcf,transparent:true,opacity:.48,roughness:.3,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.set(0,w.surface,(w.minZ+w.maxZ)/2);this.world.add(water);}
  }
  render(sim,dt){const p=sim.position;this.avatar.position.set(p.x,p.y-HALF_HEIGHT,p.z);animateCharacter(this.avatar,sim,dt);const speed=Math.hypot(sim.vx,sim.vz);if(speed>.2)this.avatar.rotation.y=Math.atan2(sim.vx,sim.vz);this.cameraTarget.set(p.x,p.y+7,p.z+12);this.camera.position.lerp(this.cameraTarget,this.initial?1:1-Math.exp(-dt*5));this.look.set(p.x,p.y+.3,p.z);this.camera.lookAt(this.look);this.initial=false;this.renderer.render(this.scene,this.camera);}
  dispose(){this.scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});this.renderer.dispose();}
}

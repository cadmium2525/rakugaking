import * as THREE from 'three';
import { HALF_HEIGHT } from '../core/controller.js';

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
  render(sim,dt){const p=sim.position;this.avatar.position.set(p.x,p.y-HALF_HEIGHT,p.z);const speed=Math.hypot(sim.vx,sim.vz);if(speed>.2)this.avatar.rotation.y=Math.atan2(sim.vx,sim.vz);this.cameraTarget.set(p.x,p.y+7,p.z+12);this.camera.position.lerp(this.cameraTarget,this.initial?1:1-Math.exp(-dt*5));this.look.set(p.x,p.y+.3,p.z);this.camera.lookAt(this.look);this.initial=false;this.renderer.render(this.scene,this.camera);}
  dispose(){this.scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});this.renderer.dispose();}
}

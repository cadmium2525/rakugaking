const tile=(x,z,top,w=6,d=5,extra={})=>({x,z,y:top-.6,w,h:1.2,d,...extra});
export const STAGES=[{
  id:1,name:'はじまりの草原',subtitle:'風にゆれる、最初の一歩。',theme:'MEADOW',color:0x93b982,sky:0xdcebe5,
  hint:'左スティックで移動。足場の端でJUMP！ 金色の輪がゴール。',
  platforms:[tile(0,0,0,9,7),tile(0,-7,.2),tile(1,-13.5,.45),tile(-1,-20,.2),tile(0,-27,.6,8,7)],
  spawn:{x:0,y:1.8,z:1},goal:{x:0,y:.6,z:-28},
},{
  id:2,name:'強風の谷',subtitle:'重さを味方に、風をこえて。',theme:'WIND VALLEY',color:0xb5b8a2,sky:0xd6e5eb,
  hint:'白い橋は向かい風。重量があるほど進みやすい。風の弱い間がチャンス。',
  platforms:[tile(0,0,0,8,8),tile(0,-14,0,5,22,{wind:true}),tile(0,-29,.1,6,5),tile(1,-36,.4,8,7)],
  spawn:{x:0,y:1.8,z:1},goal:{x:1,y:.4,z:-37},wind:{minZ:-23,maxZ:-5},
},{
  id:3,name:'水没神殿',subtitle:'水面の下に、眠る道。',theme:'SUNKEN TEMPLE',color:0x8fbabc,sky:0xd2e9e9,
  hint:'水の中は小さく軽い体が得意。ゴールの輪でACTIONを押して封印を解こう。',
  platforms:[tile(0,0,0,8,8),tile(0,-12,-.3,7,16),tile(1,-24,.1,6,5),tile(-1,-31,.3,6,5),tile(0,-38,.5,8,7)],
  spawn:{x:0,y:1.8,z:1},goal:{x:0,y:.5,z:-39},water:{minZ:-19,maxZ:-5,surface:.6},requiresAction:true,
}];
export function getStage(id){return STAGES.find(s=>s.id===id)||STAGES[0];}

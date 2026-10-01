import {defaultDrawing} from './drawing.js';
import {sanitizeDrawing} from './shape.js';
import {newPlayer} from './progression.js';
import {validateRecord} from './ranking.js';
export const SAVE_VERSION=2;
const finite=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function freshSave(){return {version:SAVE_VERSION,player:newPlayer(),characters:[{id:'starter',name:'らくがきくん',drawing:defaultDrawing()}],active:'starter',records:[],best:null,settings:{quality:'medium'}};}
export function migrateSave(raw){
  if(!raw)return {data:freshSave(),notice:''};
  if(typeof raw!=='object'||Array.isArray(raw))return {data:freshSave(),notice:'破損したセーブを退避し、新しいデータで起動しました。',backup:true};
  if(raw.version>SAVE_VERSION)return {data:freshSave(),notice:'新しいバージョンのセーブです。元データを保護するため保存を停止しています。',readOnly:true};
  let notice='';
  if(raw.version===1){raw={version:2,player:{exp:raw.exp||0,cleared:Array.from({length:Math.max(0,Math.min(4,(raw.unlocked||1)-1))},(_,i)=>i+1)},characters:[{id:'legacy',name:raw.name||'らくがき',drawing:raw.drawing}],active:'legacy',records:[],settings:raw.settings};notice='旧セーブをバージョン2に移行しました。';}
  if(raw.version!==2)return {data:freshSave(),notice:'セーブ形式を確認できません。元データは退避しました。',backup:true};
  const data=freshSave();data.player.exp=Math.floor(finite(raw.player?.exp,0,200000,0));
  data.player.cleared=[...new Set((Array.isArray(raw.player?.cleared)?raw.player.cleared:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=5))];
  data.player.unlocked=1;while(data.player.unlocked<5&&data.player.cleared.includes(data.player.unlocked))data.player.unlocked++;
  const characters=(Array.isArray(raw.characters)?raw.characters:[]).slice(0,24).filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string').map(c=>({id:c.id.slice(0,80),name:c.name.slice(0,20)||'ななし',drawing:sanitizeDrawing(c.drawing)}));
  data.characters=characters.filter((c,i)=>characters.findIndex(x=>x.id===c.id)===i);if(!data.characters.length)data.characters=freshSave().characters;
  data.active=data.characters.some(c=>c.id===raw.active)?raw.active:data.characters[0].id;
  data.records=(Array.isArray(raw.records)?raw.records:[]).slice(-20).filter(r=>validateRecord({...r,player:r?.player||'ゲスト'}).length===0);
  data.best=data.records.length?Math.min(...data.records.map(r=>r.total)):null;
  data.settings.quality=['low','medium','high'].includes(raw.settings?.quality)?raw.settings.quality:'medium';
  return {data,notice};
}
export class SaveStore {
  constructor(options={}){try{this.idb=Object.hasOwn(options,'idb')?options.idb:globalThis.indexedDB;}catch{this.idb=null;}try{this.storage=Object.hasOwn(options,'storage')?options.storage:globalThis.localStorage;}catch{this.storage=null;}this.db=null;this.mode='indexeddb';this.readOnly=false;this.pending=Promise.resolve();}
  async open(){if(this.db)return this.db;if(!this.idb)throw new Error('IndexedDB unavailable');return new Promise((resolve,reject)=>{let finished=false;const request=this.idb.open('rakuga-db',1);const timer=setTimeout(()=>{finished=true;reject(new Error('IndexedDB timeout'));},1500);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves');};request.onerror=()=>{clearTimeout(timer);reject(request.error);};request.onblocked=()=>{clearTimeout(timer);finished=true;reject(new Error('IndexedDB blocked'));};request.onsuccess=()=>{clearTimeout(timer);if(finished){request.result.close();return;}this.db=request.result;this.db.onversionchange=()=>{this.db.close();this.db=null;};resolve(this.db);};});}
  async dbRead(){const db=await this.open();return new Promise((resolve,reject)=>{const request=db.transaction('saves').objectStore('saves').get('main');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async dbWrite(data,key='main'){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(data,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('aborted'));});}
  async load(){let raw,notice='';try{raw=await this.dbRead();}catch{this.mode='localstorage';notice='IndexedDBが使えないため代替保存を使用します。';}
    let localText;try{localText=this.storage?.getItem('rakuga.save');if(localText){const local=JSON.parse(localText);if(!raw||(local?.savedAt||0)>(raw?.savedAt||0))raw=local;}}catch{notice='代替セーブを読み込めません。破損データを退避します。';try{if(localText)this.storage?.setItem('rakuga.save.backup',localText);}catch{notice+=' 退避できないため代替セーブの上書きを停止します。';this.readOnly=true;}if(this.mode!=='indexeddb')this.mode='memory';}
    const result=migrateSave(raw);this.readOnly=this.readOnly||!!result.readOnly;if(result.backup){try{if(this.mode==='indexeddb')await this.dbWrite(raw,'backup');else this.storage?.setItem('rakuga.save.backup',JSON.stringify(raw));}catch{notice+=' 破損データの退避にも失敗しました。';this.readOnly=true;}}
    return {data:result.data,notice:result.notice||notice};
  }
  save(data){const snapshot={...structuredClone(data),savedAt:Date.now()};const job=this.pending.then(async()=>{if(this.readOnly)return '元のセーブを保護するため保存していません。';if(this.mode==='indexeddb'){try{await this.dbWrite(snapshot);return 'この端末に保存しました';}catch{this.mode='localstorage';}}
      try{if(!this.storage)throw new Error('Storage unavailable');this.storage.setItem('rakuga.save',JSON.stringify(snapshot));this.mode='localstorage';return 'この端末に保存しました（代替保存）';}catch{this.mode='memory';return '保存できません。容量・ブラウザ設定を確認してください。このタブ内でのみ保持します。';}});this.pending=job.catch(()=>{});return job;}
}

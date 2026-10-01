import {calculateStats} from './stats.js';
import {levelStats} from './progression.js';
import {PARTS,COLORS} from './drawing.js';
export const GAME_VERSION='1.0.0';
export const STAT_KEYS=['hp','power','defense','speed','jump','weight'];
export function validateRecord(record){
  const errors=[];
  if(!record||typeof record!=='object')return ['記録がありません'];
  if(record.version!==GAME_VERSION)errors.push('ゲームバージョンが異なります');
  if(record.valid!==true)errors.push('中断された走行は登録できません');
  if(!Number.isInteger(record.level)||record.level<1||record.level>20)errors.push('レベルが不正です');
  for(const key of ['player','character'])if(typeof record[key]!=='string'||record[key].trim().length<1||record[key].length>20||/[\x00-\x1f<>]/.test(record[key]))errors.push('名前は1〜20文字で入力してください');
  if(!Array.isArray(record.splits)||record.splits.length!==5||record.splits.some(t=>!Number.isFinite(t)||t<2||t>3600))errors.push('スプリットが不正です');
  if(!Number.isFinite(record.total)||record.total<20||record.total>18000||!Array.isArray(record.splits)||Math.abs(record.splits.reduce((a,b)=>a+b,0)-record.total)>.02)errors.push('合計タイムが不正です');
  const d=record.drawing;
  const shapeOK=d&&PARTS.every(part=>Array.isArray(d[part])&&d[part].length>0&&d[part].length<=12&&d[part].every(s=>s&&COLORS.includes(s.color)&&Array.isArray(s.points)&&s.points.length>=3&&s.points.length<=64&&s.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=2&&Math.abs(p.y)<=2)));
  if(!shapeOK)errors.push('キャラクター形状が不正です');
  if(shapeOK&&Number.isInteger(record.level)){
    const expected=levelStats(calculateStats(d),record.level);
    if(STAT_KEYS.some(k=>!Number.isFinite(record.stats?.[k])||Math.abs(record.stats[k]-expected[k])>.001))errors.push('形状と能力が一致しません');
  }
  return errors;
}

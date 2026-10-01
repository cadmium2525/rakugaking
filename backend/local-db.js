import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function localDatabase(file=':memory:'){
  const db=new DatabaseSync(file);db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  return {close:()=>db.close(),prepare(sql){const statement=db.prepare(sql);const prepare=(args=[])=>({bind:(...values)=>prepare(values),async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}});return prepare();}};
}

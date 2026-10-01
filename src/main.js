import './style.css';
import {initPhysics} from './core/controller.js';
import {GameApp} from './game/app.js';
import {shell,$} from './ui/shell.js';
import {SaveStore} from './core/save.js';
document.querySelector('#app').innerHTML=shell;
try{const store=new SaveStore();const [loaded]=await Promise.all([store.load(),initPhysics()]);new GameApp(store,loaded.data,loaded.notice);}
catch(error){$('#status').textContent='起動できませんでした。WebGL対応ブラウザで再読み込みしてください。';console.error(error);}

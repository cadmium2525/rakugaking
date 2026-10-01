import './style.css';
import {initPhysics} from './core/controller.js';
import {GameApp} from './game/app.js';
import {shell,$} from './ui/shell.js';
document.querySelector('#app').innerHTML=shell;
try{await initPhysics();new GameApp();}
catch(error){$('#status').textContent='起動できませんでした。WebGL対応ブラウザで再読み込みしてください。';console.error(error);}

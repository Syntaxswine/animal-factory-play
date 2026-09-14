import {starter,connectExample,TYPES,GOODS,allPorts,missingInputs,recipeText,line,key,COLS,ROWS} from './engine.js';
import {project,unproject,footprint} from './isometric.js';
import {renderFarm} from './renderer.js';
import {efficiency} from './people.js';
const canvas=document.querySelector('#farm'),ctx=canvas.getContext('2d');
let farm=starter(),tool='belt',direction=0,hover=null,drag=null,pan=null,selected=null,paused=false,speed=1,last=0,history=[];
const view={x:0,y:0,tile:30,width:0,height:0};
const $=s=>document.querySelector(s),arrows=['↘','↙','↖','↗'],names=['SE','SW','NW','NE'];
const machineArt={},characterArt={};
for(const type of Object.keys(TYPES)){const img=new Image();img.src=`assets/machines/${TYPES[type].sprite||type+'.png'}`;machineArt[type]=img;}
for(const name of ['horse','donkey','cow','sheep','goat','hen','pig-foreman','pig-director']){const img=new Image();img.src=`assets/characters/${name}.png`;characterArt[name]=img;}
for(const [group,title] of [['bread','Bread & grain'],['alcohol','Fruit & alcohol'],['cakes','Milk & cakes'],['workers','Worker provisions']]){
 const details=document.createElement('details');details.className='tool-group';details.open=group==='bread'||group==='workers';
 const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
 for(const [type,t] of Object.entries(TYPES).filter(([,t])=>t.group===group)){
  const button=document.createElement('button');button.className='tool';button.dataset.tool=type;button.setAttribute('aria-pressed','false');
  const img=document.createElement('img');img.className='machine-icon';img.src=`assets/machines/${TYPES[type].sprite||type+'.png'}`;img.alt='';
  const text=document.createElement('span'),name=document.createElement('b'),desc=document.createElement('small');name.textContent=t.name;desc.textContent=recipeText(type);text.append(name,desc);button.append(img,text);details.append(button);
 }
 $('#building-tools').append(details);
}
function message(s){$('#message').textContent=s;}
function checkpoint(){history.push(farm.snapshot());if(history.length>40)history.shift();$('#undo').disabled=false;}
function setTool(t){tool=t;selected=null;drag=null;for(const b of document.querySelectorAll('[data-tool]')){b.classList.toggle('selected',b.dataset.tool===t);b.setAttribute('aria-pressed',b.dataset.tool===t);}report();}
function rotate(){direction=(direction+1)%4;$('#direction').textContent=`${names[direction]} ${arrows[direction]}`;}
function report(){
 const b=farm.buildings.find(b=>b.id===selected),type=b?.type||(TYPES[tool]?tool:null);
 if(type){
  const t=TYPES[type];$('#inspect-title').textContent=t.name;$('#inspect-description').textContent=recipeText(type)+(t.note?' '+t.note:'');
  let text='';
  if(b){text=type==='house'?Object.entries(farm.delivered).map(([g,n])=>`${n} ${GOODS[g].name.toLowerCase()}`).concat(`${b.output} rations ready`,`${Math.floor((b.rationReserve||0)/5)} queued`,`${farm.rationsEaten} worker meals`).join(' · '):Object.keys(t.recipe||{}).map(g=>`${GOODS[g].name}: ${b.inventory[g]||0}/8`).concat(`Output: ${b.output}/4`,b.output>=4?'Output blocked':missingInputs(b).length?'Waiting for '+missingInputs(b).map(g=>GOODS[g].name.toLowerCase()).join(', '):'Working').join(' · ');}
  if(b&&type==='depot')text=`Stockpile: ${b.inventory.ration||0}/${t.capacity} rations · ${b.mealsServed||0} meals served · Leave open ground beside the depot for pickup.`;
  if(b&&type!=='house'){const worker=farm.people.find(p=>p.home===b.id&&!p.pig);if(worker)text+=` · Worker: ${Math.round(worker.satiety)}% fed · ${Math.round(efficiency(farm,b)*100)}% productivity · ${worker.status}`;}
  $('#inspect-detail').textContent=text;return;
 }
 const info={belt:['Conveyor','Drag a straight line; the drag sets direction. Start the next segment on the last tile to turn a corner.'],inspect:['Inspect','Select a machine to inspect production and its worker. Point at an animal or colored port for details.'],erase:['Remove','Click a building or drag to remove conveyors. The farmhouse stays in place.']};
 $('#inspect-title').textContent=info[tool][0];$('#inspect-description').textContent=info[tool][1];$('#inspect-detail').textContent='';
}
function resize(){const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);view.width=r.width;view.height=r.height;ctx.setTransform(d,0,0,d,0,0);if(!last)fit();}
function fit(){
 const points=farm.buildings.flatMap(b=>{const front=project(b.x+3,b.y+3);return [...footprint(b.x,b.y,3),{x:front.x-3.3,y:front.y-6.4},{x:front.x+3.3,y:front.y+2}];});
 for(const b of Object.values(farm.belts))points.push(...footprint(b.x,b.y));
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 view.tile=Math.max(8,Math.min((view.width-55)/(maxX-minX+2),(view.height-60)/(maxY-minY+1),60));
 view.x=view.width/2-(minX+maxX)/2*view.tile;view.y=(view.height+20)/2-(minY+maxY)/2*view.tile;
}
function zoom(factor,cx=view.width/2,cy=view.height/2){const next=Math.min(85,Math.max(8,view.tile*factor)),ratio=next/view.tile;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.tile=next;}
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function tile(e){const p=point(e),world=unproject(p.x-view.x,p.y-view.y,view.tile);return{x:Math.floor(world.x),y:Math.floor(world.y)};}
function draw(){renderFarm(ctx,farm,view,{machineArt,characterArt,hover,drag,pan,tool,direction,selected});}
canvas.addEventListener('pointerdown',e=>{if(e.button===2||e.button===1||e.altKey){pan={...point(e),vx:view.x,vy:view.y};canvas.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;canvas.focus({preventScroll:true});hover=tile(e);canvas.setPointerCapture(e.pointerId);if(tool==='belt'||tool==='erase'){drag={...hover};}else if(tool==='inspect'){selected=farm.at(hover.x,hover.y)?.id??null;report();}else if(TYPES[tool]){if(!farm.canPlace(hover.x,hover.y)){message('That 3 × 3 footprint is blocked. Choose nine empty tiles.');return;}checkpoint();farm.place(tool,hover.x,hover.y,direction);message(`${TYPES[tool].name} placed. Connect its marked ports.`);}});
canvas.addEventListener('pointermove',e=>{hover=tile(e);if(pan){const p=point(e);view.x=pan.vx+p.x-pan.x;view.y=pan.vy+p.y-pan.y;}});
canvas.addEventListener('pointerup',e=>{if(pan){pan=null;return;}if(!drag)return;hover=tile(e);const cells=line(drag,hover,direction);drag=null;if(tool==='belt'){if(!farm.canLay(cells)){message('Line blocked: conveyors must stay outside building footprints. End beside the marked port.');return;}checkpoint();farm.lay(cells);direction=cells[0].dir;$('#direction').textContent=`${names[direction]} ${arrows[direction]}`;message(`${cells.length} conveyor tile${cells.length===1?'':'s'} placed, flowing ${names[direction].toLowerCase()}.`);}else if(tool==='erase'){if(!cells.some(c=>farm.belts[key(c.x,c.y)]||(farm.at(c.x,c.y)&&farm.at(c.x,c.y).type!=='house'))){message('Nothing to remove here. The farmhouse stays in place.');return;}checkpoint();farm.remove(cells);message('Removed. Undo restores the previous layout.');}});
canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;});canvas.addEventListener('pointerleave',()=>{if(!drag&&!pan)hover=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(e.deltaY<0?1.12:1/1.12,p.x,p.y);},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#rotate').onclick=rotate;
$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'▶ Resume':'Ⅱ Pause';$('#pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');};
$('#speed').onclick=()=>{speed=speed===1?2:speed===2?4:1;$('#speed').textContent=`${speed}×`;};
$('#undo').onclick=()=>{if(!history.length)return;farm.restore(history.pop());$('#undo').disabled=!history.length;$('#plan').value=farm.plan;selected=null;report();message('Previous layout restored.');};
$('#reset').onclick=()=>{checkpoint();farm=starter(false,farm.plan);selected=null;report();fit();message('Starter layout restored. Connect outputs to the matching ingredient ports.');};
$('#plan').onchange=()=>{checkpoint();farm=starter(false,$('#plan').value);selected=null;drag=null;fit();report();document.querySelectorAll('.tool-group').forEach((d,i)=>d.open=i===3||i===['bread','alcohol','cakes'].indexOf(farm.plan));message('Starter layout changed. Connect it yourself or use Connect the example.');};
$('#example').onclick=()=>{const snapshot=farm.snapshot();if(!connectExample(farm)){message('Starter buildings or belt paths have changed. Use Reset first, or connect them manually.');return;}history.push(snapshot);if(history.length>40)history.shift();$('#undo').disabled=false;fit();message('Example connected: the farmhouse sends rations to the depot. Workers collect meals from its stockpile.');};
$('#zoom-in').onclick=()=>zoom(1.2);$('#zoom-out').onclick=()=>zoom(1/1.2);$('#fit').onclick=fit;
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const n=Number(e.key);if(n>=1&&n<=6)setTool(['belt','field','mill','bakery','inspect','erase'][n-1]);if(e.key.toLowerCase()==='r')rotate();if(e.key==='Escape'){drag=null;setTool('inspect');}if(e.code==='Space'&&e.target===canvas){e.preventDefault();$('#pause').click();}if(e.target===canvas&&e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')view.x+=40;if(e.key==='ArrowRight')view.x-=40;if(e.key==='ArrowUp')view.y+=40;if(e.key==='ArrowDown')view.y-=40;}if(e.key==='+'||e.key==='=')zoom(1.2);if(e.key==='-')zoom(1/1.2);});
new ResizeObserver(resize).observe(canvas);report();resize();let reportAt=0;
function frame(now){if(last&&!paused)farm.advance(Math.min((now-last)/1000,.1)*speed);last=now;draw();if(now-reportAt>200){for(const good of ['bread','alcohol','cake'])$('#'+good).textContent=farm.delivered[good];const workers=farm.people.filter(p=>!p.pig);$('#worker-count').textContent=workers.length;$('#worker-food').textContent=workers.length?Math.round(workers.reduce((n,p)=>n+p.satiety,0)/workers.length)+'%':'—';$('#worker-meals').textContent=farm.rationsEaten;report();reportAt=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);

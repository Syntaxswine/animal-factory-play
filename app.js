import {starter,connectExample,TYPES,GOODS,allPorts,missingInputs,recipeText,line,key,COLS,ROWS} from './engine.js';
const canvas=document.querySelector('#farm'),ctx=canvas.getContext('2d');
let farm=starter(),tool='belt',direction=0,hover=null,drag=null,pan=null,selected=null,paused=false,speed=1,last=0,history=[];
const view={x:0,y:0,tile:30,width:0,height:0};
const $=s=>document.querySelector(s),arrows=['→','↓','←','↑'],names=['EAST','SOUTH','WEST','NORTH'];
const colors=Object.fromEntries(Object.entries(GOODS).map(([k,g])=>[k,g.color]));
const machineArt={},characterArt={};
for(const type of Object.keys(TYPES)){const img=new Image();img.src=`assets/machines/${type}.png`;machineArt[type]=img;}
for(const name of ['horse','donkey','cow','sheep','goat','hen','pig-foreman','pig-director']){const img=new Image();img.src=`assets/characters/${name}.png`;characterArt[name]=img;}
for(const [group,title] of [['bread','Bread & grain'],['alcohol','Fruit & alcohol'],['cakes','Milk & cakes']]){
 const details=document.createElement('details');details.className='tool-group';details.open=group==='bread';
 const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
 for(const [type,t] of Object.entries(TYPES).filter(([,t])=>t.group===group)){
  const button=document.createElement('button');button.className='tool';button.dataset.tool=type;button.setAttribute('aria-pressed','false');
  const img=document.createElement('img');img.className='machine-icon';img.src=`assets/machines/${type}.png`;img.alt='';
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
  if(b){text=type==='house'?Object.entries(farm.delivered).map(([g,n])=>`${n} ${GOODS[g].name.toLowerCase()}`).join(' · '):Object.keys(t.recipe||{}).map(g=>`${GOODS[g].name}: ${b.inventory[g]||0}/8`).concat(`Output: ${b.output}/4`,b.output>=4?'Output blocked':missingInputs(b).length?'Waiting for '+missingInputs(b).map(g=>GOODS[g].name.toLowerCase()).join(', '):'Working').join(' · ');}
  $('#inspect-detail').textContent=text;return;
 }
 const info={belt:['Conveyor','Drag a straight line; the drag sets direction. Start the next segment on the last tile to turn a corner.'],inspect:['Inspect','Select a machine or point at a colored port to see which ingredient it accepts.'],erase:['Remove','Click a building or drag to remove conveyors. The farmhouse stays in place.']};
 $('#inspect-title').textContent=info[tool][0];$('#inspect-description').textContent=info[tool][1];$('#inspect-detail').textContent='';
}
function resize(){const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);view.width=r.width;view.height=r.height;ctx.setTransform(d,0,0,d,0,0);if(!last)fit();}
function fit(){
 const minX=Math.min(...farm.buildings.map(b=>b.x)),maxX=Math.max(...farm.buildings.map(b=>b.x+3)),minY=Math.min(...farm.buildings.map(b=>b.y)),maxY=Math.max(...farm.buildings.map(b=>b.y+3));
 view.tile=Math.max(8,Math.min((view.width-40)/(maxX-minX+4),(view.height-110)/(maxY-minY+6),50));
 view.x=view.width/2-(minX+maxX)/2*view.tile;view.y=(view.height+40)/2-(minY+maxY)/2*view.tile;
}
function zoom(factor,cx=view.width/2,cy=view.height/2){const next=Math.min(85,Math.max(8,view.tile*factor)),ratio=next/view.tile;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.tile=next;}
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function tile(e){const p=point(e);return{x:Math.floor((p.x-view.x)/view.tile),y:Math.floor((p.y-view.y)/view.tile)};}
function drawText(s,x,y,size,color='#eee4bd',align='center',font='sans-serif'){ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`600 ${size}px ${font}`;ctx.fillText(s,x,y);}
function draw(){const t=view.tile;ctx.clearRect(0,0,view.width,view.height);ctx.fillStyle='#697659';ctx.fillRect(0,0,view.width,view.height);ctx.save();ctx.translate(view.x,view.y);
 // Keep footprints and ports readable beneath the painted art.
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ctx.fillStyle=(x+y)%2?'#6c795b':'#707d5e';ctx.fillRect(x*t,y*t,t,t);ctx.strokeStyle='#5b6c5070';ctx.lineWidth=.7;ctx.strokeRect(x*t,y*t,t,t);}
 ctx.strokeStyle='#344f36';ctx.lineWidth=2;ctx.strokeRect(0,0,COLS*t,ROWS*t);
 for(const belt of Object.values(farm.belts)){const x=belt.x*t,y=belt.y*t;ctx.fillStyle='#314037';ctx.fillRect(x+1,y+1,t-2,t-2);ctx.strokeStyle='#c5b36d';ctx.lineWidth=Math.max(1,t*.05);if(belt.dir%2===0){ctx.beginPath();ctx.moveTo(x,y+t*.18);ctx.lineTo(x+t,y+t*.18);ctx.moveTo(x,y+t*.82);ctx.lineTo(x+t,y+t*.82);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(x+t*.18,y);ctx.lineTo(x+t*.18,y+t);ctx.moveTo(x+t*.82,y);ctx.lineTo(x+t*.82,y+t);ctx.stroke();}drawText(arrows[belt.dir],x+t/2,y+t/2,t*.52,'#899780');}
 for(const b of [...farm.buildings].sort((a,b)=>a.y-b.y))drawBuilding(b);
 for(const belt of Object.values(farm.belts)){if(!belt.item)continue;const x=(belt.x+.5)*t,y=(belt.y+.5)*t;ctx.fillStyle='#172b28';ctx.fillRect(x-t*.21+2,y-t*.21+2,t*.42,t*.42);ctx.fillStyle=colors[belt.item];ctx.fillRect(x-t*.21,y-t*.21,t*.42,t*.42);ctx.strokeStyle='#fce9b2';ctx.lineWidth=1;ctx.strokeRect(x-t*.21,y-t*.21,t*.42,t*.42);}
 if(hover&&farm.inside(hover.x,hover.y)&&!pan){if(tool==='belt'||tool==='erase'){const cells=drag?line(drag,hover,direction):[{...hover,dir:direction}],valid=tool==='erase'||farm.canLay(cells);for(const c of cells){ctx.fillStyle=valid?(tool==='erase'?'#b5403ea0':'#e4c77690'):'#e0525690';ctx.fillRect(c.x*t+1,c.y*t+1,t-2,t-2);if(tool==='belt')drawText(arrows[c.dir],(c.x+.5)*t,(c.y+.5)*t,t*.6,'#20372b');}if(drag)drawText(`${cells.length} TILES`,(cells.at(-1).x+.5)*t,(cells.at(-1).y-.5)*t,Math.max(11,t*.4),'#fff0c2');}else if(TYPES[tool]){const valid=farm.canPlace(hover.x,hover.y);drawBuilding({type:tool,x:hover.x,y:hover.y,dir:direction,progress:0,inventory:{},output:0},true);ctx.fillStyle=valid?'#d5df9a25':'#dd2e4277';ctx.fillRect(hover.x*t,hover.y*t,3*t,3*t);ctx.strokeStyle=valid?'#f5dfa2':'#ff9898';ctx.lineWidth=2;ctx.strokeRect(hover.x*t,hover.y*t,3*t,3*t);}else{ctx.strokeStyle='#ffe5a1';ctx.lineWidth=2;ctx.strokeRect(hover.x*t,hover.y*t,t,t);}}
 ctx.restore();}
function drawCharacter(name,x,y,frame=0,flip=false,height=1.3){
 const img=characterArt[name];if(!img?.complete||!img.naturalWidth)return;
 const t=view.tile,h=t*height,w=h*.75;ctx.save();ctx.translate(x*t,y*t);if(flip)ctx.scale(-1,1);
 ctx.drawImage(img,frame*192,0,192,256,-w/2,-h,w,h);ctx.restore();
}
function drawBuilding(b,ghost=false){
 const t=view.tile,x=b.x*t,y=b.y*t,def=TYPES[b.type];ctx.save();if(ghost)ctx.globalAlpha=.65;
 ctx.fillStyle=def.color+'55';ctx.fillRect(x+1,y+1,3*t-2,3*t-2);ctx.strokeStyle='#31452e';ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,3*t-2,3*t-2);
 ctx.strokeStyle='#31452e40';for(let n=1;n<3;n++){ctx.beginPath();ctx.moveTo(x+n*t,y);ctx.lineTo(x+n*t,y+3*t);ctx.moveTo(x,y+n*t);ctx.lineTo(x+3*t,y+n*t);ctx.stroke();}
 const art=machineArt[b.type];if(art?.complete&&art.naturalWidth)ctx.drawImage(art,x+.05*t,y-.1*t,t*2.9,t*2.9);
 else drawText(def.name,x+1.5*t,y+1.5*t,Math.max(10,t*.36),'#f2e3b4');
 if(!ghost){
  const working=def.out&&b.output<4&&!missingInputs(b).length,phase=(farm.clock+b.id*1.7)%8;
  const frame=b.type==='house'?(farm.delivered.bread+farm.delivered.cake>0?3:0):working?(phase<2?1+Math.floor(phase*3)%2:3):0;
  drawCharacter(def.worker,b.x+2.35+(working&&phase<2?Math.sin(phase*Math.PI)*.18:0),b.y+2.75,frame,false,def.worker==='hen'?1.05:1.35);
  if(b.type==='house')drawCharacter('pig-foreman',b.x+.6,b.y+2.6,3,true,1.1);
  if(def.out){ctx.fillStyle='#1c322c';ctx.fillRect(x+.45*t,y+2.8*t,2.1*t,.12*t);ctx.fillStyle='#f1cc6a';ctx.fillRect(x+.45*t,y+2.8*t,2.1*t*Math.min(1,b.progress/def.time),.12*t);}
 }
 for(const p of allPorts(b)){
  ctx.fillStyle=p.role==='input'?'#79b9cbe8':'#f2c763ec';ctx.fillRect((p.x+.08)*t,(p.y+.08)*t,.84*t,.84*t);
  ctx.strokeStyle='#243930';ctx.lineWidth=1.5;ctx.strokeRect((p.x+.08)*t,(p.y+.08)*t,.84*t,.84*t);
  drawText(arrows[p.dir],(p.x+.5)*t,(p.y+.39)*t,t*.54,'#233b34');drawText(GOODS[p.good].mark,(p.x+.5)*t,(p.y+.77)*t,Math.max(7,t*.26),'#233b34');
  if(hover?.x===p.x&&hover?.y===p.y&&!ghost){const label=`${p.role==='input'?'IN':'OUT'}: ${GOODS[p.good].name}`;ctx.font='600 13px sans-serif';const w=ctx.measureText(label).width+16;ctx.fillStyle='#20362ef5';ctx.fillRect((p.x+.5)*t-w/2,(p.y-1)*t-8,w,25);drawText(label,(p.x+.5)*t,(p.y-1)*t+5,13,'#fff0bf');}
 }
 if(b.id===selected){ctx.strokeStyle='#fff0b8';ctx.lineWidth=3;ctx.strokeRect(x-3,y-3,3*t+6,3*t+6);}
 if(!ghost){drawText(def.name,x+1.5*t,y+3.35*t,Math.max(10,t*.32),'#233c2d');const status=b.type==='house'?'BREAD · ALCOHOL · CAKE':b.output>=4?'OUTPUT FULL':missingInputs(b).length?'NEEDS '+missingInputs(b).map(g=>GOODS[g].name.toUpperCase()).join(' + '):'WORKING';drawText(status,x+1.5*t,y+3.85*t,Math.max(8,t*.23),'#324b35');}
 ctx.restore();
}
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
$('#plan').onchange=()=>{checkpoint();farm=starter(false,$('#plan').value);selected=null;drag=null;fit();report();document.querySelectorAll('.tool-group').forEach((d,i)=>d.open=i===['bread','alcohol','cakes'].indexOf(farm.plan));message('Starter layout changed. Connect it yourself or use Connect the example.');};
$('#example').onclick=()=>{const snapshot=farm.snapshot();if(!connectExample(farm)){message('Starter buildings or belt paths have changed. Use Reset first, or connect them manually.');return;}history.push(snapshot);if(history.length>40)history.shift();$('#undo').disabled=false;message('Example connected. Follow the goods through each stage to the farmhouse.');};
$('#zoom-in').onclick=()=>zoom(1.2);$('#zoom-out').onclick=()=>zoom(1/1.2);$('#fit').onclick=fit;
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const n=Number(e.key);if(n>=1&&n<=6)setTool(['belt','field','mill','bakery','inspect','erase'][n-1]);if(e.key.toLowerCase()==='r')rotate();if(e.key==='Escape'){drag=null;setTool('inspect');}if(e.code==='Space'&&e.target===canvas){e.preventDefault();$('#pause').click();}if(e.target===canvas&&e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')view.x+=40;if(e.key==='ArrowRight')view.x-=40;if(e.key==='ArrowUp')view.y+=40;if(e.key==='ArrowDown')view.y-=40;}if(e.key==='+'||e.key==='=')zoom(1.2);if(e.key==='-')zoom(1/1.2);});
new ResizeObserver(resize).observe(canvas);report();resize();let reportAt=0;
function frame(now){if(last&&!paused)farm.advance(Math.min((now-last)/1000,.1)*speed);last=now;draw();if(now-reportAt>200){for(const good of ['bread','alcohol','cake'])$('#'+good).textContent=farm.delivered[good];report();reportAt=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);

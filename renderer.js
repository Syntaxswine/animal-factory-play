import {COLS,ROWS,TYPES,GOODS,DIRS,allPorts,missingInputs,line,key} from './engine.js';
import {project,footprint} from './isometric.js';

export function renderFarm(ctx,farm,view,ui) {
  const {machineArt,characterArt,hover,drag,pan,tool,direction,selected}=ui;
  const s=view.tile;
  const point=(x,y)=>project(x,y,s);
  function polygon(points,fill,stroke,width=1) {
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function region(x,y,w,h,fill,stroke,width=1) {
    polygon([point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)],fill,stroke,width);
  }
  function worldLine(a,b,color,width=1) {
    a=point(...a);b=point(...b);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function text(label,x,y,size=12,color='#f1e7c3') {
    ctx.font=`600 ${size}px "IBM Plex Sans",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(label,x,y);
  }
  function badge(label,p,color='#eaddb3') {
    ctx.font='600 12px "IBM Plex Sans",sans-serif';const width=ctx.measureText(label).width+14;
    ctx.fillStyle='#20372eee';ctx.fillRect(p.x-width/2,p.y-11,width,22);text(label,p.x,p.y,12,color);
  }
  function arrow(x,y,dir,color='#b2ba9b',size=.32) {
    const center=point(x,y),[dx,dy]=DIRS[dir],v=point(dx,dy),length=Math.hypot(v.x,v.y);
    const vx=v.x/length*s*size,vy=v.y/length*s*size;
    ctx.beginPath();ctx.moveTo(center.x-vx*.35-vy*.65,center.y-vy*.35+vx*.65);
    ctx.lineTo(center.x+vx*.65,center.y+vy*.65);ctx.lineTo(center.x-vx*.35+vy*.65,center.y-vy*.35-vx*.65);
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.3,s*.065);ctx.stroke();
  }
  function belt(b) {
    region(b.x+.03,b.y+.03,.94,.94,'#263c34','#819071',1);
    if(b.dir%2===0){worldLine([b.x,b.y+.16],[b.x+1,b.y+.16],'#c0aa6d',2);worldLine([b.x,b.y+.84],[b.x+1,b.y+.84],'#c0aa6d',2);}
    else{worldLine([b.x+.16,b.y],[b.x+.16,b.y+1],'#c0aa6d',2);worldLine([b.x+.84,b.y],[b.x+.84,b.y+1],'#c0aa6d',2);}
    const [dx,dy]=DIRS[b.dir],travel=(farm.clock*1.2)%1-.5;
    arrow(b.x+.5+dx*travel*.55,b.y+.5+dy*travel*.55,b.dir);
    if(b.item){const p=point(b.x+.5,b.y+.5),r=Math.max(3,s*.22);
      ctx.fillStyle='#183229';ctx.fillRect(p.x-r+1,p.y-r+2,r*2,r*2);
      ctx.fillStyle=GOODS[b.item].color;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);ctx.strokeStyle='#e7d6a0';ctx.lineWidth=1;ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);
      if(s>25)text(GOODS[b.item].mark,p.x,p.y,Math.max(9,s*.28),'#233c2c');
    }
  }
  function building(b,ghost=false) {
    const front=point(b.x+3,b.y+3),width=s*6.32,art=machineArt[b.type];
    ctx.save();if(ghost)ctx.globalAlpha=.6;
    if(art?.complete&&art.naturalWidth)ctx.drawImage(art,front.x-width/2,front.y-width*.975,width,width);
    else {polygon(footprint(b.x,b.y,3,s),TYPES[b.type].color,'#293f32');text(TYPES[b.type].name,front.x,front.y-s,12);}
    ctx.restore();
  }
  function person(p) {
    if(!p.cell)return;
    const img=characterArt[p.name];if(!img?.complete||!img.naturalWidth)return;
    const pos=point(p.x,p.y),height=s*(p.name==='hen'?1.7:p.pig?2.15:2.4),width=height*.75;
    const frame=p.moving?1+Math.floor(farm.clock*5.5)%2:p.status==='eating'?3:p.pig&&p.name==='pig-foreman'?3:0;
    ctx.fillStyle='#1c302841';ctx.beginPath();ctx.ellipse(pos.x,pos.y,width*.22,s*.12,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(pos.x,pos.y);if(p.flip)ctx.scale(-1,1);
    ctx.drawImage(img,192*frame,0,192,256,-width/2,-height*244/256,width,height);ctx.restore();
    if(!p.pig&&p.satiety<30){ctx.fillStyle='#382d22';ctx.fillRect(pos.x-10,pos.y-height-8,20,3);ctx.fillStyle='#e5a356';ctx.fillRect(pos.x-10,pos.y-height-8,20*p.satiety/30,3);}
    if(hover?.x===Math.floor(p.x)&&hover?.y===Math.floor(p.y)&&tool==='inspect')badge(`${p.name.replaceAll('-',' ')} · ${p.status}`,{x:pos.x,y:pos.y-height-17});
  }
  function port(p,b) {
    const [dx,dy]=DIRS[p.dir],sign=p.role==='output'?1:-1;
    const x=p.x+.5+dx*.75*sign,y=p.y+.5+dy*.75*sign;
    worldLine([p.x+.5,p.y+.5],[x,y],p.good==='ration'?'#ccd895':p.role==='input'?'#85c3cf':'#efc66c',Math.max(3,s*.18));
    region(x-.27,y-.27,.54,.54,p.good==='ration'?'#c4d88b':p.role==='input'?'#86beca':'#e9bc61','#203a30',1.5);
    arrow(x,y,p.dir,'#20392d',.26);
    const outside={x:p.x+dx*sign,y:p.y+dy*sign};
    if((hover&&(hover.x===p.x&&hover.y===p.y||hover.x===outside.x&&hover.y===outside.y))||selected===b.id){
      const pos=point(x,y);badge(`${p.role==='input'?'IN':'OUT'} · ${GOODS[p.good].name}`,{x:pos.x,y:pos.y-24},p.good==='ration'?'#d9eca2':'#f1e5bd');
    }
  }

  ctx.clearRect(0,0,view.width,view.height);ctx.fillStyle='#53664c';ctx.fillRect(0,0,view.width,view.height);
  ctx.save();ctx.translate(view.x,view.y);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    polygon(footprint(x,y,1,s),(x+y)%2?'#6c7b58':'#70805c','#566c4860',.65);
  }
  polygon([point(0,0),point(COLS,0),point(COLS,ROWS),point(0,ROWS)],null,'#334f36',2);
  for(const b of farm.buildings)polygon(footprint(b.x,b.y,3,s),'#8c876f70','#354b35',1.5);
  for(const b of Object.values(farm.belts))belt(b);
  const objects=farm.buildings.map(b=>({depth:b.x+b.y+3,building:b})).concat(farm.people.filter(p=>p.cell).map(p=>({depth:p.x+p.y,person:p})));
  objects.sort((a,b)=>a.depth-b.depth);
  for(const obj of objects)obj.building?building(obj.building):person(obj.person);
  for(const b of farm.buildings) {
    for(const p of allPorts(b))port(p,b);
    if(selected===b.id)polygon(footprint(b.x,b.y,3,s),null,'#f1d993',2.5);
    const front=point(b.x+3,b.y+3);
    if(s>15)text(TYPES[b.type].name,front.x,front.y+14,Math.max(10,Math.min(13,s*.52)),'#203b2d');
    if(b.type==='house')badge(`RATIONS OUT · ${b.output} ready`,{x:front.x,y:front.y+36},'#d3e5a4');
    else if(selected===b.id){const status=b.output>=4?'Output full':missingInputs(b).length?'Needs '+missingInputs(b).map(g=>GOODS[g].name).join(' + '):'Working';badge(status,{x:front.x,y:front.y+35});}
  }
  // Highlight parcels waiting at a return-belt endpoint.
  for(const b of Object.values(farm.belts)) {
    const [dx,dy]=DIRS[b.dir];
    if(b.item==='ration'&&!farm.belts[key(b.x+dx,b.y+dy)]&&!farm.at(b.x+dx,b.y+dy)){
      const p=point(b.x+.5,b.y+.5);badge('Ration pickup',{x:p.x,y:p.y+25},'#d3e5a4');
    }
  }
  if(hover&&farm.inside(hover.x,hover.y)&&!pan) {
    if(tool==='belt'||tool==='erase') {
      const cells=drag?line(drag,hover,direction):[{...hover,dir:direction}],valid=tool==='erase'||farm.canLay(cells);
      for(const c of cells){polygon(footprint(c.x,c.y,1,s),valid?(tool==='erase'?'#c5484690':'#efd18b90'):'#e3556490',valid?'#eed593':'#ff8c91',1.5);if(tool==='belt')arrow(c.x+.5,c.y+.5,c.dir,'#294034');}
      if(drag){const end=cells.at(-1),p=point(end.x+.5,end.y+.5);badge(`${cells.length} tiles`,{x:p.x,y:p.y-25});}
    }else if(TYPES[tool]){
      const valid=farm.canPlace(hover.x,hover.y),b={type:tool,x:hover.x,y:hover.y,dir:direction};building(b,true);
      polygon(footprint(b.x,b.y,3,s),valid?'#e7df9b30':'#e0546570',valid?'#f1d78d':'#ff8c91',2);
      for(const p of allPorts(b))port(p,b);
    }else polygon(footprint(hover.x,hover.y,1,s),null,'#efd18e',1.5);
  }
  ctx.restore();
}

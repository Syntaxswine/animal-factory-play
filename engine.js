import {syncPeople,advancePeople,efficiency} from './people.js';
export const COLS = 38, ROWS = 24;
export const DIRS = [[1,0],[0,1],[-1,0],[0,-1]];
export const GOODS = {
  ration:{name:'Worker ration',color:'#cbd897',mark:'R'},
  wheat:{name:'Wheat',color:'#f3c957',mark:'W'}, flour:{name:'Flour',color:'#ece5c9',mark:'F'}, bread:{name:'Bread',color:'#d48649',mark:'B'},
  fruit:{name:'Fruit',color:'#db7351',mark:'F'}, juice:{name:'Juice',color:'#e7a64e',mark:'J'}, fermented:{name:'Fermented juice',color:'#b88bb5',mark:'V'},
  alcohol:{name:'Alcohol',color:'#95b282',mark:'A'}, feed:{name:'Animal feed',color:'#b5a070',mark:'G'}, milk:{name:'Milk',color:'#e6f1ec',mark:'M'},
  sugar:{name:'Sugar',color:'#e4d7e9',mark:'S'}, cake:{name:'Cake',color:'#edb0a0',mark:'C'},
};
export const TYPES = {
  field:{name:'Wheat field',out:'wheat',time:3,color:'#b99a45',group:'bread',worker:'horse'},
  mill:{name:'Mill',recipe:{wheat:2},out:'flour',time:4,color:'#879a92',group:'bread',worker:'donkey'},
  bakery:{name:'Bakery',recipe:{flour:2},out:'bread',time:5,color:'#bb7051',group:'bread',worker:'sheep'},
  orchard:{name:'Fruit orchard',out:'fruit',time:3,color:'#88914b',group:'alcohol',worker:'hen'},
  press:{name:'Fruit press',recipe:{fruit:2},out:'juice',time:4,color:'#ae8355',group:'alcohol',worker:'horse'},
  fermenter:{name:'Fermentation barrels',recipe:{juice:2},out:'fermented',time:8,color:'#998171',group:'alcohol',worker:'goat'},
  bottler:{name:'Bottling works',recipe:{fermented:1},out:'alcohol',time:4,color:'#81988a',group:'alcohol',worker:'donkey'},
  feedmill:{name:'Feed mill',recipe:{wheat:2},out:'feed',time:4,color:'#a9945c',group:'cakes',worker:'goat'},
  dairy:{name:'Dairy',recipe:{feed:1},out:'milk',time:5,color:'#b6b69a',group:'cakes',worker:'cow'},
  sugarworks:{name:'Sugar works',out:'sugar',time:8,color:'#a49e78',group:'cakes',worker:'hen',note:'Grows and refines sugar beet on site.'},
  confectionery:{name:'Cake kitchen',recipe:{flour:1,milk:1,sugar:1},out:'cake',time:7,color:'#b48370',group:'cakes',worker:'sheep'},
  depot:{name:'Ration depot',accepts:['ration'],capacity:32,color:'#85935a',group:'workers',sprite:'depot.svg'},
  house:{name:'Farmhouse',accepts:['bread','alcohol','cake'],out:'ration',color:'#963f35',worker:'pig-director'},
};
export const key=(x,y)=>`${x},${y}`;
function rotatePoint(x,y,dir){for(let i=0;i<dir;i++) [x,y]=[2-y,x];return {x,y};}
export function allPorts(b){
  const def=TYPES[b.type],goods=def.accepts||Object.keys(def.recipe||{}),slots=[[0,1,0],[1,0,1],[1,2,3]];
  const list=goods.map((good,i)=>{const [x,y,dir]=slots[i],p=rotatePoint(x,y,b.dir);return{x:b.x+p.x,y:b.y+p.y,dir:(dir+b.dir)%4,good,role:'input'};});
  if(def.out){const p=rotatePoint(2,1,b.dir);list.push({x:b.x+p.x,y:b.y+p.y,dir:b.dir,good:def.out,role:'output'});}
  return list;
}
export function ports(b){const p=allPorts(b);return{input:p.find(p=>p.role==='input'),output:p.find(p=>p.role==='output')};}
export function line(a,b,fallback=0){let dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;const dir=dx>0?0:dy>0?1:dx<0?2:dy<0?3:fallback;const [sx,sy]=DIRS[dir];return Array.from({length:Math.max(Math.abs(dx),Math.abs(dy))+1},(_,i)=>({x:a.x+sx*i,y:a.y+sy*i,dir}));}
export function missingInputs(b){return Object.entries(TYPES[b.type].recipe||{}).filter(([good,n])=>(b.inventory[good]||0)<n).map(([good])=>good);}
export function recipeText(type){const t=TYPES[type];if(type==='depot')return 'Stores 32 rations. Feed the green input by conveyor; workers collect meals from the open ground around the depot.';if(t.accepts)return 'Returns 1 worker ration per 5 bread or cake deliveries. Send the green outlet to a ration depot or an accessible belt end. Deliveries continue when rations back up. Alcohol produces no rations.';const from=Object.entries(t.recipe||{}).map(([g,n])=>`${n} ${GOODS[g].name.toLowerCase()}`).join(' + ');return `${from?from+' → ':'Produces '}1 ${GOODS[t.out].name.toLowerCase()} / ${t.time}s`;}
export class Farm{
  constructor(){this.buildings=[];this.belts={};this.stats={wheat:0,flour:0,bread:0,alcohol:0,cake:0};this.produced={};this.delivered={bread:0,alcohol:0,cake:0};this.clock=0;this.stepClock=0;this.nextId=1;this.plan='bread';this.people=[];this.rationsEaten=0;}
  inside(x,y){return x>=0&&y>=0&&x<COLS&&y<ROWS;}
  at(x,y){return this.buildings.find(b=>x>=b.x&&x<b.x+3&&y>=b.y&&y<b.y+3);}
  canPlace(x,y){for(let j=y;j<y+3;j++)for(let i=x;i<x+3;i++)if(!this.inside(i,j)||this.at(i,j)||this.belts[key(i,j)])return false;return true;}
  place(type,x,y,dir=0){if(!TYPES[type]||!this.canPlace(x,y))return false;const b={id:this.nextId++,type,x,y,dir,inventory:{},output:0,progress:0};this.buildings.push(b);syncPeople(this,TYPES);return b;}
  canLay(cells){return cells.every(c=>this.inside(c.x,c.y)&&!this.at(c.x,c.y));}
  lay(cells){if(!this.canLay(cells))return false;for(const c of cells)this.belts[key(c.x,c.y)]={...c,item:this.belts[key(c.x,c.y)]?.item??null};syncPeople(this,TYPES);return true;}
  remove(cells){let n=0;for(const c of cells){const b=this.at(c.x,c.y);if(b&&b.type!=='house'){this.buildings=this.buildings.filter(a=>a!==b);n++;}if(this.belts[key(c.x,c.y)]){delete this.belts[key(c.x,c.y)];n++;}}syncPeople(this,TYPES);return n;}
  snapshot(){return JSON.stringify(this);}
  restore(s){Object.assign(this,JSON.parse(s));}
  advance(dt){this.clock+=dt;for(const b of this.buildings){const t=TYPES[b.type];if(b.type==='house'){if((b.rationReserve||0)>=5&&b.output<4){b.rationReserve-=5;b.output++;this.produced.ration=(this.produced.ration||0)+1;}continue;}if(!t.out||b.output>=4||missingInputs(b).length)continue;b.progress+=dt*efficiency(this,b);if(b.progress>=t.time){b.progress-=t.time;for(const [g,n]of Object.entries(t.recipe||{}))b.inventory[g]-=n;b.output++;this.produced[t.out]=(this.produced[t.out]||0)+1;if(t.out==='wheat'||t.out==='flour')this.stats[t.out]++;}}
    this.stepClock+=dt;while(this.stepClock>=.3){this.stepClock-=.3;this.move();}advancePeople(this,dt);}
  move(){
    const occupied=new Set(Object.entries(this.belts).filter(([,b])=>b.item).map(([k])=>k)),claimed=new Set(),moves=[];
    for(const b of Object.values(this.belts)){if(!b.item)continue;const[dx,dy]=DIRS[b.dir],nx=b.x+dx,ny=b.y+dy,nk=key(nx,ny),target=this.belts[nk];
      if(target&&!occupied.has(nk)&&!claimed.has(nk)){claimed.add(nk);moves.push(()=>{target.item=b.item;b.item=null;});continue;}
      const building=this.at(nx,ny);if(!building)continue;
      const port=allPorts(building).find(p=>p.role==='input'&&p.x===nx&&p.y===ny&&p.dir===b.dir&&p.good===b.item);
      if(!port||(building.type!=='house'&&(building.inventory[b.item]||0)>=(TYPES[building.type].capacity||8)))continue;
      if(building.type==='house'){const food=b.item==='bread'||b.item==='cake';this.delivered[b.item]++;this.stats[b.item]++;if(food)building.rationReserve=(building.rationReserve||0)+1;}else building.inventory[b.item]=(building.inventory[b.item]||0)+1;b.item=null;
    }
    for(const move of moves)move();
    for(const b of this.buildings){const t=TYPES[b.type];if(!t.out||!b.output)continue;const p=ports(b).output,[dx,dy]=DIRS[p.dir],target=this.belts[key(p.x+dx,p.y+dy)];if(target&&!target.item){target.item=t.out;b.output--;}}
  }
}
export const PLANS={
  bread:{buildings:[['field',3,10],['mill',11,10],['bakery',19,10],['house',29,10],['depot',31,17,2]],routes:[[[6,11],[10,11]],[[14,11],[18,11]],[[22,11],[28,11]]]},
  alcohol:{buildings:[['orchard',3,10],['press',10,10],['fermenter',17,10],['bottler',24,10],['house',31,10],['depot',31,17,2]],routes:[[[6,11],[9,11]],[[13,11],[16,11]],[[20,11],[23,11]],[[27,11],[29,11],[29,8],[32,8],[32,9]]]},
  cakes:{buildings:[['field',1,2],['feedmill',7,2],['dairy',13,2],['field',1,10],['mill',7,10],['sugarworks',18,18],['confectionery',23,10],['house',31,10],['depot',31,17,2]],routes:[[[4,3],[6,3]],[[10,3],[12,3]],[[16,3],[24,3],[24,9]],[[4,11],[6,11]],[[10,11],[22,11]],[[21,19],[24,19],[24,13]],[[26,11],[28,11],[28,15],[32,15],[32,13]]]}
};
export function starter(connected=false,plan='bread'){const f=new Farm();f.plan=plan;for(const[type,x,y,dir=0]of PLANS[plan].buildings)f.place(type,x,y,dir);if(connected)connectExample(f);return f;}
export function exampleCells(plan){const house=PLANS[plan].buildings.find(([type])=>type==='house');const routes=[...PLANS[plan].routes,[[house[1]+3,house[2]+1],[36,house[2]+1],[36,18],[34,18]]];return routes.flatMap(route=>route.slice(1).flatMap((p,i)=>line({x:route[i][0],y:route[i][1]},{x:p[0],y:p[1]})));}
export function connectExample(f){const plan=PLANS[f.plan];if(!plan.buildings.every(([type,x,y,dir=0])=>f.buildings.some(b=>b.type===type&&b.x===x&&b.y===y&&b.dir===dir)))return false;return f.lay(exampleCells(f.plan));}

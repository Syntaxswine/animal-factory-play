const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const cellKey = (x, y) => `${x},${y}`;

export function walkable(farm, x, y) {
  return farm.inside(x, y) && !farm.at(x, y) && (!farm.belts[cellKey(x, y)]||!!farm.roads[cellKey(x,y)]);
}

export function findPath(farm, start, goals, {preferRoads=true}={}) {
  const starts=(Array.isArray(start)?start:[start]).filter(p=>p&&walkable(farm,p.x,p.y));
  if(!starts.length||!goals.length)return null;
  const targets=new Set(goals.filter(p=>walkable(farm,p.x,p.y)).map(p=>cellKey(p.x,p.y)));
  if(!targets.size)return null;
  const queue=starts.map(p=>({...p,cost:0})),previous=new Map(starts.map(p=>[cellKey(p.x,p.y),null])),costs=new Map(starts.map(p=>[cellKey(p.x,p.y),0]));
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift(),k=cellKey(p.x,p.y);
    if(p.cost!==costs.get(k))continue;
    if(targets.has(k)){const path=[];let cursor=p;while(previous.get(cellKey(cursor.x,cursor.y))){path.push({x:cursor.x,y:cursor.y});cursor=previous.get(cellKey(cursor.x,cursor.y));}return path.reverse();}
    for(const [dx,dy] of STEPS){const x=p.x+dx,y=p.y+dy,nk=cellKey(x,y);if(!walkable(farm,x,y))continue;
      const cost=p.cost+(preferRoads&&farm.roads[nk]?.x!==undefined ? .5 : 1);
      if(cost<(costs.get(nk)??Infinity)){costs.set(nk,cost);previous.set(nk,p);queue.push({x,y,cost});}
    }
  }
  return null;
}

function nearbyGround(farm, x, y) {
  // Construction may cover a person. Relocate once to the nearest free tile.
  for (let radius = 0; radius < 64; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dy = radius - Math.abs(dx);
      for (const sign of dy ? [-1, 1] : [1]) {
        const p = {x: x + dx, y: y + dy * sign};
        if (walkable(farm, p.x, p.y)) return p;
      }
    }
  }
  return null;
}

export function perimeter(b) {
  const cells = [];
  for (let n = 0; n < 3; n++) {
    cells.push({x:b.x+n,y:b.y+3},{x:b.x+3,y:b.y+2-n},
      {x:b.x+2-n,y:b.y-1},{x:b.x-1,y:b.y+n});
  }
  return cells;
}

export function syncPeople(farm, types) {
  const wanted = [],species=['horse','donkey','sheep','cow','goat','hen'];
  for (const b of farm.buildings) {
    if(types[b.type].residents)for(let i=0;i<types[b.type].residents;i++)wanted.push({id:`${b.id}:resident:${i}`,home:b.id,job:null,name:species[(b.id+i)%species.length],pig:false});
    if(b.type==='house')for(const [role,name] of [['worker','pig-director'],['foreman','pig-foreman']])wanted.push({id:`${b.id}:${role}`,home:b.id,name,pig:true});
  }
  farm.people = wanted.map((spec, index) => {
    let person = farm.people.find(p => p.id === spec.id);
    const home = farm.buildings.find(b => b.id === spec.home);
    if (!person) {
      const spawn = perimeter(home).find(p => walkable(farm,p.x,p.y)) || nearbyGround(farm,home.x,home.y);
      person = {...spec,x:(spawn?.x??0)+.5,y:(spawn?.y??0)+.5,cell:spawn,
        satiety:55+(index%4)*5,meals:0,path:[],think:0,wait:0,trip:0,target:null,
        health:80,happiness:70,status:spawn?'strolling':'no space',moving:false,flip:false};
    }
    if (!person.cell || !walkable(farm,Math.floor(person.x),Math.floor(person.y)) ||
        !walkable(farm,person.cell.x,person.cell.y)) {
      const spawn=nearbyGround(farm,Math.floor(person.x),Math.floor(person.y));
      person.cell=spawn;
      if (spawn) {person.x=spawn.x+.5;person.y=spawn.y+.5;}
    } else {
      // Cancel partial segments when construction changes the walking graph.
      person.x=person.cell.x+.5;person.y=person.cell.y+.5;
    }
    person.path=[];person.target=null;person.think=0;person.moving=false;
    return person;
  });
  assignJobs(farm,types);farm.serviceClock=0;
}

export function rationPickups(farm) {
  return Object.values(farm.belts).filter(b => {
    if (b.item !== 'ration') return false;
    const [dx,dy]=STEPS[b.dir];
    return !farm.belts[cellKey(b.x+dx,b.y+dy)] && !farm.at(b.x+dx,b.y+dy);
  });
}

function chooseTrip(farm, p) {
  p.think=2;
  if (!p.cell) {p.status='no space';return;}
  if (!p.pig && p.satiety < 72) {
    // Reserve stocked portions rather than the whole depot, allowing several workers to visit.
    const depots=farm.buildings.filter(b=>(b.type==='depot'||b.type==='kitchen')&&(b.inventory.ration||0)>
      farm.people.filter(other=>other!==p&&other.target===`depot:${b.id}`).length)
      .map(b=>({b,path:findPath(farm,p.cell,perimeter(b))}))
      .filter(option=>option.path!==null).sort((a,b)=>a.path.length-b.path.length);
    if(depots.length){const {b,path}=depots[0];p.path=path;p.target=`depot:${b.id}`;p.status='going to depot';return;}
    const reserved=new Set(farm.people.filter(other=>other!==p&&other.target).map(other=>other.target));
    const options=rationPickups(farm).filter(b=>!reserved.has(cellKey(b.x,b.y)))
      .sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y));
    for (const belt of options) {
      const goals=STEPS.map(([dx,dy])=>({x:belt.x+dx,y:belt.y+dy}));
      const path=findPath(farm,p.cell,goals);
      if (path) {p.path=path;p.target=cellKey(belt.x,belt.y);p.status='going to rations';return;}
    }
  }
  p.target=null;
  const onShift=farm.clock%180<140;
  const destination=!p.pig&&p.job&&onShift?p.job:p.home;
  const home=farm.buildings.find(b=>b.id===destination);
  if(!home)return;
  if(!p.pig){
    const path=findPath(farm,p.cell,perimeter(home));
    if(path===null){p.status='blocked journey';return;}
    p.path=path;p.journey=destination;
    p.status=path.length?(destination===p.job?'commuting':'going home'):(destination===p.job?'working':'resting');
    if(!path.length)p.wait=2;
    return;
  }

  const ring=perimeter(home),offset=(p.trip++*5+p.home)%ring.length;
  for(let i=0;i<ring.length;i++) {
    const goal=ring[(offset+i)%ring.length];
    if(goal.x===p.cell.x&&goal.y===p.cell.y)continue;
    const path=findPath(farm,p.cell,[goal]);
    if(path?.length){p.path=path;p.status=p.pig?'inspecting':'strolling';return;}
  }
  p.status=p.satiety<30&&!p.pig?'hungry · no path':'no path';
}

function eat(farm,p) {
  if(!p.target||p.path.length||!p.cell)return false;
  const depot=targetDepot(farm,p.target),b=farm.belts[p.target];
  const atDepot=depot&&(depot.inventory.ration||0)>0&&perimeter(depot).some(c=>c.x===p.cell.x&&c.y===p.cell.y);
  const atBelt=b?.item==='ration'&&Math.abs(p.cell.x-b.x)+Math.abs(p.cell.y-b.y)===1;
  if(atDepot||atBelt){
    if(atDepot){depot.inventory.ration--;depot.mealsServed=(depot.mealsServed||0)+1;}else b.item=null;
    const cooked=atDepot&&depot.type==='kitchen'&&farm.people.some(cook=>cook.job===depot.id&&cook.status==='working'&&!cook.moving&&cook.cell&&perimeter(depot).some(c=>c.x===cook.cell.x&&c.y===cook.cell.y))&&farm.clock%180<140;
    p.satiety=Math.min(100,p.satiety+(cooked?40:25));p.meals++;farm.rationsEaten++;
    p.status='eating';p.journey=null;p.wait=2.5;p.target=null;p.think=3;return true;
  }
  p.target=null;p.think=0;return false;
}

function targetDepot(farm,target){return target?.startsWith('depot:')?farm.buildings.find(b=>(b.type==='depot'||b.type==='kitchen')&&`depot:${b.id}`===target):null;}
function targetAvailable(farm,target){const depot=targetDepot(farm,target);return depot?(depot.inventory.ration||0)>0:farm.belts[target]?.item==='ration';}

export function advancePeople(farm,dt) {
  for(const p of farm.people) {
    p.moving=false;p.think-=dt;
    if(!p.pig)p.satiety=Math.max(0,p.satiety-dt*.075);
    if(p.wait>0){p.wait-=dt;continue;}
    if(p.target&&!targetAvailable(farm,p.target)){p.target=null;p.path=p.path.slice(0,1);p.journey=null;p.think=0;}
    if(!p.path.length) {
      if(eat(farm,p))continue;
      if(p.think<=0)chooseTrip(farm,p);
      if(eat(farm,p))continue;
    }
    let time=dt;
    while(time>0&&p.path.length) {
      const next=p.path[0];
      if(!walkable(farm,next.x,next.y)){p.path=[];p.target=null;p.think=0;break;}
      const dx=next.x+.5-p.x,dy=next.y+.5-p.y,length=Math.hypot(dx,dy);
      const speed=(p.pig?.7:1.2)*(farm.roads[cellKey(next.x,next.y)]?2:1),step=Math.min(time*speed,length);
      if(length>0){p.x+=dx/length*step;p.y+=dy/length*step;p.flip=dx-dy<0;p.moving=true;}
      time-=step/speed;
      if(length<=step+.00001){p.x=next.x+.5;p.y=next.y+.5;p.cell={...next};p.path.shift();}
      else break;
    }
    if(!p.path.length&&!eat(farm,p)&&p.moving){p.wait=1.5;p.think=2;if(!p.pig&&p.journey)p.status=p.journey===p.job?'working':'resting';}
  }
}

export function efficiency(farm,b) {
  const p=farm.people.find(p=>p.job===b.id&&!p.pig);
  const present=farm.clock%180<140&&p?.cell&&!p.moving&&p.status==='working'&&perimeter(b).some(c=>c.x===p.cell.x&&c.y===p.cell.y);
  return present ? (.5+.5*Math.min(1,p.satiety/30))*(.6+.4*(p.health??100)/100)*(.7+.3*(p.happiness??100)/100) : 0;
}

export function assignJobs(farm,types){
  const jobs=farm.buildings.filter(b=>types[b.type].worker&&b.type!=='house');
  const workers=farm.people.filter(p=>!p.pig),claimed=new Set();
  const reach=(p,b)=>{const home=farm.buildings.find(home=>home.id===p.home);return home?findPath(farm,perimeter(home),perimeter(b),{preferRoads:false}):null;};
  for(const p of workers){const b=jobs.find(b=>b.id===p.job),path=b&&reach(p,b);if(!b||path===null||path.length>36||claimed.has(b.id))p.job=null;else claimed.add(b.id);}
  const options=[];
  for(const p of workers.filter(p=>!p.job))for(const b of jobs.filter(b=>!claimed.has(b.id))){const path=reach(p,b);if(path&&path.length<=36)options.push({p,b,distance:path.length});}
  options.sort((a,b)=>a.distance-b.distance||a.b.id-b.b.id);
  for(const {p,b} of options)if(!p.job&&!claimed.has(b.id)){p.job=b.id;claimed.add(b.id);}
}

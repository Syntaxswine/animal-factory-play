const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const cellKey = (x, y) => `${x},${y}`;

export function walkable(farm, x, y) {
  return farm.inside(x, y) && !farm.at(x, y) && !farm.belts[cellKey(x, y)];
}

export function findPath(farm, start, goals) {
  if (!walkable(farm, start.x, start.y) || !goals.length) return null;
  const targets = new Set(goals.filter(p => walkable(farm, p.x, p.y)).map(p => cellKey(p.x, p.y)));
  if (!targets.size) return null;
  const queue = [start], previous = new Map([[cellKey(start.x, start.y), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], k = cellKey(p.x, p.y);
    if (targets.has(k)) {
      const path = []; let cursor = p;
      while (previous.get(cellKey(cursor.x, cursor.y))) {
        path.push(cursor); cursor = previous.get(cellKey(cursor.x, cursor.y));
      }
      return path.reverse();
    }
    for (const [dx, dy] of STEPS) {
      const x = p.x + dx, y = p.y + dy, next = cellKey(x, y);
      if (!previous.has(next) && walkable(farm, x, y)) {
        previous.set(next, p); queue.push({x, y});
      }
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
  const wanted = [];
  for (const b of farm.buildings) {
    const name = types[b.type].worker;
    if (name) wanted.push({id:`${b.id}:worker`,home:b.id,name,pig:b.type==='house'});
    if (b.type==='house') wanted.push({id:`${b.id}:foreman`,home:b.id,name:'pig-foreman',pig:true});
  }
  farm.people = wanted.map((spec, index) => {
    let person = farm.people.find(p => p.id === spec.id);
    const home = farm.buildings.find(b => b.id === spec.home);
    if (!person) {
      const spawn = perimeter(home).find(p => walkable(farm,p.x,p.y)) || nearbyGround(farm,home.x,home.y);
      person = {...spec,x:(spawn?.x??0)+.5,y:(spawn?.y??0)+.5,cell:spawn,
        satiety:55+(index%4)*5,meals:0,path:[],think:0,wait:0,trip:0,target:null,
        status:spawn?'strolling':'no space',moving:false,flip:false};
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
  const home=farm.buildings.find(b=>b.id===p.home);
  if (!home) return;
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
  const b=farm.belts[p.target];
  if(b?.item==='ration'&&Math.abs(p.cell.x-b.x)+Math.abs(p.cell.y-b.y)===1){
    b.item=null;p.satiety=Math.min(100,p.satiety+25);p.meals++;farm.rationsEaten++;
    p.status='eating';p.wait=2.5;p.target=null;p.think=3;return true;
  }
  p.target=null;p.think=0;return false;
}

export function advancePeople(farm,dt) {
  for(const p of farm.people) {
    p.moving=false;p.think-=dt;
    if(!p.pig)p.satiety=Math.max(0,p.satiety-dt*.075);
    if(p.wait>0){p.wait-=dt;continue;}
    if(p.target&&farm.belts[p.target]?.item!=='ration'){p.target=null;p.path=[];p.think=0;}
    if(!p.path.length) {
      if(eat(farm,p))continue;
      if(p.think<=0)chooseTrip(farm,p);
      if(eat(farm,p))continue;
    }
    let distance=dt*(p.pig?.7:1.2);
    while(distance>0&&p.path.length) {
      const next=p.path[0];
      if(!walkable(farm,next.x,next.y)){p.path=[];p.target=null;p.think=0;break;}
      const dx=next.x+.5-p.x,dy=next.y+.5-p.y,length=Math.hypot(dx,dy);
      const step=Math.min(distance,length);
      if(length>0){p.x+=dx/length*step;p.y+=dy/length*step;p.flip=dx-dy<0;p.moving=true;}
      distance-=step;
      if(length<=step+.00001){p.x=next.x+.5;p.y=next.y+.5;p.cell={...next};p.path.shift();}
      else break;
    }
    if(!p.path.length&&!eat(farm,p)&&p.moving){p.wait=1.5;p.think=2;}
  }
}

export function efficiency(farm,b) {
  const p=farm.people.find(p=>p.home===b.id&&!p.pig);
  return p ? .5 + .5*Math.min(1,p.satiety/30) : 1;
}

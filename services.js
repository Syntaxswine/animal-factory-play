import {findPath,perimeter,efficiency} from './people.js';

export function refreshServices(farm){
 const wells=farm.buildings.filter(b=>b.type==='well');
 const clinics=farm.buildings.filter(b=>b.type==='clinic'&&efficiency(farm,b)>0);
 const reaches=(home,sites)=>sites.some(site=>{const path=findPath(farm,perimeter(home),perimeter(site),{preferRoads:false});return path!==null&&path.length<=12;});
 for(const home of farm.buildings.filter(b=>b.type==='residence'))home.services={water:reaches(home,wells),clinic:reaches(home,clinics)};
}

export function advanceServices(farm,dt){
 farm.serviceClock=(farm.serviceClock??0)-dt;
 if(farm.serviceClock<=0){refreshServices(farm);farm.serviceClock=2;}
 for(const p of farm.people.filter(p=>!p.pig)){
  const home=farm.buildings.find(b=>b.id===p.home),services=home?.services||{};
  const change=(services.water?.015:-.015)+(services.clinic?.10:0)-(p.satiety<20?.08:0);
  p.health=Math.max(20,Math.min(100,(p.health??80)+change*dt));
  const target=Math.max(5,Math.min(100,35+Math.min(35,p.satiety*.5)+(services.water?15:0)+(services.clinic?10:0)+(p.job?5:-10)-Math.max(0,20-farm.rationShare)*.5-(farm.estate.level-1)*6-Math.max(0,60-farm.estate.approval)*.1));
  p.happiness=Math.max(0,Math.min(100,(p.happiness??70)+(target-(p.happiness??70))*Math.min(1,dt/45)));
 }
}

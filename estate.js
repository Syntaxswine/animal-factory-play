import {efficiency} from './people.js';
export const newEstate=()=>({level:1,stock:{bread:0,alcohol:0,cake:0},approval:60,lastDay:0,lastReport:'First allowance due at the end of day one.'});
export const estateDemand=level=>level===1?{bread:4}:level===2?{bread:6,alcohol:2}:{bread:8,alcohol:3,cake:2};
const costs=[null,{bread:20,alcohol:5},{bread:35,alcohol:10,cake:8}];
export function estateOffer(farm){
 const {level,stock}=farm.estate;
 if(level===3)return {ready:false,reason:'Estate complete. Keep the pigs supplied and residents healthy.'};
 const cost=costs[level],attendants=farm.buildings.filter(b=>b.type==='pavilion'&&farm.people.some(p=>p.job===b.id)).length;
 const ready=attendants>=level&&Object.entries(cost).every(([g,n])=>stock[g]+1e-8>=n);
 return {ready,cost,reason:`Level ${level+1}: ${Object.entries(cost).map(([g,n])=>`${n} ${g}`).join(' + ')} and ${level} staffed pavilion${level===1?'':'s'} (${attendants} staffed). Daily demands increase; privilege lowers worker contentment.`};
}
export function expandEstate(farm){
 const offer=estateOffer(farm);if(!offer.ready)return false;
 for(const [g,n] of Object.entries(offer.cost))farm.estate.stock[g]=Math.max(0,farm.estate.stock[g]-n);
 farm.estate.level++;farm.estate.lastReport='Expansion approved. New demands apply at the next day end.';return true;
}
export function setRationShare(farm,value){if(![10,20,40].includes(value))return false;farm.rationShare=value;return true;}
export function advanceEstate(farm,dt=0){
 const estate=farm.estate,day=Math.floor(farm.clock/180);
 while(estate.lastDay<day){
  const demand=estateDemand(estate.level);let supplied=0,total=0;
  for(const [g,n] of Object.entries(demand)){const used=Math.min(n,estate.stock[g]);estate.stock[g]-=used;supplied+=used;total+=n;}
  const attendants=farm.buildings.filter(b=>b.type==='pavilion').reduce((n,b)=>n+Math.min(1,(b.attendedToday||0)/60),0);
  const service=estate.level===1?1:Math.min(1,attendants/(estate.level-1));
  const fulfillment=supplied/total*service;
  estate.approval=Math.max(0,Math.min(100,estate.approval+(fulfillment>=.999?8:-12*(1-fulfillment))));
  estate.lastDay++;estate.lastReport=`Day ${estate.lastDay}: ${Math.round(fulfillment*100)}% of the pigs’ allowance and service met. ${fulfillment<.999?'Shortfalls increase pressure on residents.':'The pigs are satisfied.'}`;
  for(const b of farm.buildings.filter(b=>b.type==='pavilion'))b.attendedToday=0;
 }
 for(const b of farm.buildings.filter(b=>b.type==='pavilion'))if(efficiency(farm,b)>0)b.attendedToday=(b.attendedToday||0)+dt;
}

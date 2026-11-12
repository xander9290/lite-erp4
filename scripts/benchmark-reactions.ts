import { performance } from "node:perf_hooks";
import { Model,Fields,defineModel,onchange,type ReactionValues,type ReactionContext } from "../src/lib/orm";
const context={actor:{id:"benchmark",sessionVersion:0},tx:{}} as ReactionContext;
class Explicit extends Model {name=Fields.Text();readonly onchange=[{method:"upper",fields:["name"],writes:["name"]}];upper(values:ReactionValues){return {name:String(values.name).toUpperCase()};}}
class Decorated extends Model {name=Fields.Text();@onchange({fields:["name"],writes:["name"]}) upper(values:ReactionValues){return {name:String(values.name).toUpperCase()};}}
async function measure(Declaration:new()=>Model){
  const start=performance.now();const model=defineModel(Declaration,{name:"BenchmarkReaction",table:"benchmark_reactions"});const registration=performance.now()-start;
  for(let i=0;i<500;i++)await model.react("name",{name:"warmup"},context);
  const times:number[]=[];
  for(let i=0;i<5000;i++){const begin=performance.now();await model.react("name",{name:"abc"},context);times.push(performance.now()-begin);}
  times.sort((a,b)=>a-b);
  return {registrationMs:registration,p50Ms:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)]};
}
console.log("Microbenchmark local del motor: 500 warmups + 5000 invocaciones. Sin HTTP, BD, autorización ni renderizado; no representa latencia del formulario.");
// Alternate ordering to expose JIT/order effects rather than reporting a single favorable run.
for(const [name,Declaration] of [["explicit",Explicit],["decorated",Decorated],["decorated",Decorated],["explicit",Explicit]] as const) console.log(name,JSON.stringify(await measure(Declaration)));

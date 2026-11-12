import type { ReactionLoader,ReactionRule } from "@/lib/orm/reactions.types";
export type FormReactions={rules:readonly ReactionRule[];load:ReactionLoader;debounceMs?:number};
export type ReactionState={preview:Record<string,string|number|boolean|null>;pending:boolean;error:string|null};
export type ReactionAdapter={
  getValues:()=>Record<string,unknown>;
  setValue:(name:string,value:unknown,options:{shouldDirty:boolean;shouldValidate:boolean})=>void;
  watch:(callback:(values:unknown,event:{name?:string})=>void)=>{unsubscribe:()=>void};
};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function createModelReactionEngine(methods:ReactionAdapter,config:FormReactions,publishState:(state:ReactionState)=>void){
    let mounted=true,epoch=0,applying=false;
    let preview:ReactionState["preview"]={};
    const errors=new Map<string,string>(),lastInputs=new Map<string,string>();
    const jobs=new Map<string,Promise<void>>(),versions=new Map<string,number>();
    const publish=()=>{if(mounted)publishState({preview:{...preview},pending:jobs.size>0,error:errors.values().next().value??null});};
    const run=(field:string,initial=false,retry=false)=>{
      const rules=config.rules.filter(rule=>rule.fields.includes(field));
      if(!rules.length) return;
      const group=rules.map(rule=>config.rules.indexOf(rule)).join(",");
      const generation=epoch,all=methods.getValues();
      const reads=[...new Set(rules.flatMap(rule=>rule.reads))];
      const writes=[...new Set(rules.flatMap(rule=>rule.writes))];
      const values=Object.fromEntries(reads.map(name=>[name,all[name]??null]));
      const key=JSON.stringify({values,id:all.id,revision:all.revision});
      if(!retry&&lastInputs.get(group)===key&&!errors.has(group))return;
      lastInputs.set(group,key);
      const version=(versions.get(group)??0)+1;versions.set(group,version);
      const targets=Object.fromEntries(writes.map(name=>[name,all[name]]));
      for(const key of rules.flatMap(rule=>rule.preview)) delete preview[key];
      errors.delete(group);
      const job=(async()=>{
        await new Promise(resolve=>setTimeout(resolve,initial?0:config.debounceMs??120));
        if(!mounted||generation!==epoch||versions.get(group)!==version)return;
        const identity:{id?:string;revision?:string}={};
        for(const key of ["id","revision"] as const) if(all[key]!==undefined){
          if(typeof all[key]!=="string")throw new Error("Identidad inválida del formulario.");
          identity[key]=all[key];
        }
        const result=await config.load({field,values,...identity});
        if(!mounted||generation!==epoch||versions.get(group)!==version||reads.some(name=>!equal(methods.getValues()[name]??null,values[name])))return;
        if(!result.ok){errors.set(group,result.error);return;}
        const allowedWrites=new Set(writes),allowedPreview=new Set(rules.flatMap(rule=>rule.preview));
        if(Object.keys(result.patch).some(name=>!allowedWrites.has(name))||Object.keys(result.preview).some(name=>!allowedPreview.has(name))) {errors.set(group,"La respuesta de la reacción no es válida.");return;}
        applying=true;
        try {
          if(!initial) for(const [name,value] of Object.entries(result.patch)) {
            if(equal(methods.getValues()[name],targets[name])) methods.setValue(name,value,{shouldDirty:true,shouldValidate:true});
          }
          preview={...preview,...result.preview};
        } finally{applying=false;}
      })().catch(()=>{if(mounted&&generation===epoch&&versions.get(group)===version)errors.set(group,"No se pudo consultar la reacción. Reintenta.");}).finally(()=>{if(jobs.get(group)===job)jobs.delete(group);publish();});
      jobs.set(group,job);publish();
    };
    const initialize=()=>{for(const field of new Set(config.rules.filter(rule=>rule.preview.length).map(rule=>rule.fields[0])))run(field,true);};
    const subscription=methods.watch((_values,event)=>{
      if(applying)return;
      if(!event.name) {epoch++;versions.clear();jobs.clear();preview={};errors.clear();lastInputs.clear();queueMicrotask(()=>{if(mounted){initialize();publish();}});return;}
      run(event.name);
    });
    const controls={settle:async()=>{while(jobs.size) await Promise.all([...jobs.values()]);return !errors.size;},retry:()=>{for(const field of new Set(config.rules.flatMap(rule=>rule.fields)))run(field,false,true);}};
    queueMicrotask(()=>{if(mounted)initialize();});
    return {...controls,dispose:()=>{mounted=false;epoch++;subscription.unsubscribe();}};
}

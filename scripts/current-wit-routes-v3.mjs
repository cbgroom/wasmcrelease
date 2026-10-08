// Bounded selected-world WIT closure for current product reopen.
const routeFail=m=>{throw Error('current WIT: '+m);};
const text=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
function witTokens(bytes){
  if(bytes.length>1048576)routeFail('WIT byte bound');
  const source=text(bytes),tokens=[];let at=0;
  while(at<source.length){
    if(/\s/.test(source[at])){at++;continue;}
    if(source.startsWith('//',at)){const end=source.indexOf('\n',at+2);at=end<0?source.length:end+1;continue;}
    if(source.startsWith('/*',at)){at+=2;let depth=1;while(at<source.length&&depth){if(source.startsWith('/*',at)){depth++;at+=2;}else if(source.startsWith('*/',at)){depth--;at+=2;}else at++;}if(depth)routeFail('unclosed WIT comment');continue;}
    const match=/^(?:->|%?[A-Za-z_][A-Za-z0-9_-]*|[0-9]+|[{}()<>,:;=@.\[\]\/])/.exec(source.slice(at));
    if(!match)routeFail('unsupported WIT token');tokens.push(match[0]);if(tokens.length>131072)routeFail('WIT token bound');at+=match[0].length;
  }
  if(tokens.length>131072)routeFail('WIT token bound');return tokens;
}
const witName=value=>{if(!/^%?[A-Za-z][A-Za-z0-9-]*$/.test(value??''))routeFail('WIT name rejected');return value.replace(/^%/,'');};
function group(tokens,at,open,close){
  if(tokens[at]!==open)routeFail('WIT group required');
  const stack=[close],pairs={'{':'}','(':')','<':'>'};let end=at+1;
  for(;end<tokens.length&&stack.length;end++){
    const value=tokens[end];if(Object.hasOwn(pairs,value))stack.push(pairs[value]);else if(['}',')','>'].includes(value)){if(stack.pop()!==value)routeFail('WIT unbalanced');}
  }
  if(stack.length)routeFail('WIT unbalanced');return {body:tokens.slice(at+1,end-1),end};
}
function statements(tokens){
  const rows=[];let start=0,at=0;
  while(at<tokens.length){if(['{','(','<'].includes(tokens[at])){const close={'{':'}','(':')','<':'>'}[tokens[at]];at=group(tokens,at,tokens[at],close).end;}else if(tokens[at]===';'){rows.push(tokens.slice(start,at));start=++at;}else at++;}
  if(start!==tokens.length)routeFail('WIT statement terminator required');return rows;
}
function splitTypes(tokens){
  const rows=[];let start=0,at=0;
  while(at<tokens.length){if(['(','<'].includes(tokens[at]))at=group(tokens,at,tokens[at],tokens[at]==='('?')':'>').end;else if(tokens[at]===','){rows.push(tokens.slice(start,at));start=++at;}else at++;}
  if(start<tokens.length)rows.push(tokens.slice(start));return rows;
}
function witType(tokens,resources){
  let at=0;
  const parse=()=>{
    const name=tokens[at++];if(name==='_')return '_';const id=witName(name);
    if(tokens[at]!=='<')return name==='result'?'result<_,_>':resources.has(id)?`own<${id}>`:id;
    at++;const args=[];
    if(['own','borrow'].includes(id)){args.push(witName(tokens[at++]));}
    else {args.push(parse());while(tokens[at]===','){at++;args.push(parse());}}
    if(tokens[at++]!=='>')routeFail('WIT type unbalanced');
    const limits={list:[1,1],option:[1,1],result:[1,2],tuple:[1,64],own:[1,1],borrow:[1,1]};
    if(!Object.hasOwn(limits,id)||args.length<limits[id][0]||args.length>limits[id][1]||(['own','borrow'].includes(id)&&!resources.has(args[0])))routeFail('unsupported WIT type');
    if(id==='result'&&args.length===1)args.push('_');
    return `${id}<${args.join(',')}>`;
  };
  const result=parse();if(at!==tokens.length)routeFail('unsupported WIT type');return result;
}
function witFunction(tokens,resources,{name,resource=null,kind=null}){
  let at=0;if(kind==='constructor'){if(tokens[at++]!=='constructor')routeFail('WIT constructor required');}
  else {if(witName(tokens[at++])!==name||tokens[at++]!==':')routeFail('WIT function rejected');if(kind==='static'&&tokens[at++]!=='static')routeFail('WIT static required');if(tokens[at++]!=='func')routeFail('WIT func required');}
  const params=group(tokens,at,'(',')');at=params.end;const seen=new Set();
  const parameters=splitTypes(params.body).map(row=>{const id=witName(row[0]);if(row[1]!==':'||seen.has(id))routeFail('WIT parameter rejected');seen.add(id);return `${id}:${witType(row.slice(2),resources)}`;});
  if(kind==='method'){if(seen.has('self'))routeFail('WIT receiver collision');parameters.unshift(`self:borrow<${resource}>`);}
  let result='->_';
  if(kind==='constructor'){if(at!==tokens.length)routeFail('WIT constructor result rejected');result=`->own<${resource}>`;}
  else if(at<tokens.length){if(tokens[at++]!=='->')routeFail('WIT function result rejected');
    if(tokens[at]==='(')routeFail('unsupported named WIT results');
    result='->'+witType(tokens.slice(at),resources);at=tokens.length;
    if(at!==tokens.length)routeFail('WIT result trailing tokens');
  }
  return `${name}:func(${parameters.join(',')})${result}`;
}
export function witModel(bytes){
  const tokens=witTokens(bytes),interfaces=new Map(),worlds=new Map();let at=0;
  if(tokens[at++]!=='package')routeFail('WIT package missing');const end=tokens.indexOf(';',at);if(end<0)routeFail('WIT package missing');
  const identity=tokens.slice(at,end).join('');if(!/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+@\d+\.\d+\.\d+$/.test(identity))routeFail('WIT package rejected');at=end+1;
  const dependencies=new Map();
  while(at<tokens.length){
    const kind=tokens[at++];
    if(kind==='package'){
      const open=tokens.indexOf('{',at);if(open<0)routeFail('WIT dependency group required');
      const id=tokens.slice(at,open).join(''),body=group(tokens,open,'{','}');at=body.end;
      const model=witModel(new TextEncoder().encode('package '+id+'; '+body.body.join(' ')));
      if(model.identity===identity||dependencies.has(model.identity)||model.dependencies.size)routeFail('duplicate/nested WIT dependency');
      dependencies.set(model.identity,model);continue;
    }
    const name=witName(tokens[at++]);if(!['interface','world'].includes(kind))routeFail('unsupported WIT top-level declaration '+kind+' '+name+' at '+at);
    const value=group(tokens,at,'{','}');at=value.end;const map=kind==='interface'?interfaces:worlds;
    if(map.has(name))routeFail('WIT duplicate declaration');map.set(name,value.body);
  }
  return {identity,interfaces,worlds,dependencies,typeCache:new Map()};
}
function interfaceTypes(model,iface,models){
  if(model.typeCache.has(iface))return model.typeCache.get(iface);
  const body=model.interfaces.get(iface);if(!body)routeFail('WIT use interface missing');const types=new Map();model.typeCache.set(iface,types);let p=0;
  const add=(name,value)=>{if(types.has(name))routeFail('WIT duplicate type');types.set(name,value);};
  while(p<body.length){const start=p,kind=body[p];
    if(['resource','record','enum','variant','flags'].includes(kind)){p++;const name=witName(body[p++]);add(name,{kind:kind==='resource'?'resource':'value'});if(body[p]===';'&&kind==='resource')p++;else {p=group(body,p,'{','}').end;if(body[p]===';')p++;}}
    else {
      while(p<body.length&&body[p]!==';'){if(['{','(','<'].includes(body[p]))p=group(body,p,body[p],{'{':'}','(':')','<':'>'}[body[p]]).end;else p++;}if(body[p++]!==';')routeFail('WIT declaration terminator required');const row=body.slice(start,p-1);
      if(kind==='type'){const name=witName(row[1]);if(row[2]!=='=')routeFail('WIT alias rejected');add(name,{kind:'alias',target:row.slice(3)});}
      if(kind==='use'){
        const open=row.indexOf('{');if(open<2||row[open-1]!=='.')routeFail('WIT use rejected');const members=group(row,open,'{','}');if(members.end!==row.length)routeFail('WIT use trailing tokens');const path=row.slice(1,open-1).join('');let owner=model,sourceIface;
        if(row.slice(1,open-1).length===1)sourceIface=witName(row[1]);
        else {const match=/^([A-Za-z0-9_-]+:[A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)@(\d+\.\d+\.\d+)$/.exec(path);if(!match)routeFail('unsupported external WIT use');owner=models.get(`${match[1]}@${match[3]}`);sourceIface=match[2];if(!owner)routeFail('external WIT use must bind selected package identity');}
        for(const member of splitTypes(members.body)){const original=witName(member[0]),name=member.length===1?original:member.length===3&&member[1]==='as'?witName(member[2]):routeFail('WIT use member rejected');add(name,{kind:'use',owner,iface:sourceIface,original});}
      }
    }
  }
  return types;
}
function resourceType(model,iface,name,models,seen=new Set()){
  const key=`${model.identity}/${iface}/${name}`;if(seen.has(key))routeFail('cyclic WIT resource alias');seen.add(key);
  const value=interfaceTypes(model,iface,models).get(name);if(!value)routeFail('WIT imported type missing');
  if(value.kind==='resource')return true;
  if(value.kind==='use')return resourceType(value.owner,value.iface,value.original,models,seen);
  if(value.kind==='alias'&&value.target.length===1){const target=witName(value.target[0]);if(interfaceTypes(model,iface,models).has(target))return resourceType(model,iface,target,models,seen);}
  return false;
}
export function selectedWitRoutes(model,worldName,models){
  const {identity,interfaces,worlds}=model;
  const world=worlds.get(witName(worldName));if(!world)routeFail('selected WIT world missing');
  const exports=new Set();for(const declaration of statements(world)){
    if(declaration[0]==='import'){if(declaration.length<2)routeFail('WIT import rejected');continue;}
    if(declaration[0]!=='export'||declaration.length!==2)routeFail('unsupported selected WIT export');const name=witName(declaration[1]);if(exports.has(name)||!interfaces.has(name))routeFail('selected WIT interface missing/duplicate');exports.add(name);
  }
  if(!exports.size)routeFail('selected WIT exports missing');const routes=new Map();
  for(const iface of exports){const body=interfaces.get(iface),resources=new Set([...interfaceTypes(model,iface,models).keys()].filter(name=>resourceType(model,iface,name,models))),decls=[];let p=0;
    while(p<body.length){const start=p;
      if(['resource','record','enum','variant','flags'].includes(body[p])){
        const kind=body[p++],name=witName(body[p++]);
        if(body[p]===';'&&kind==='resource'){p++;continue;}
        const value=group(body,p,'{','}');p=value.end;if(body[p]===';')p++;if(kind==='resource')decls.push({resource:name,body:value.body});
      }else {
        while(p<body.length&&body[p]!==';'){if(['{','(','<'].includes(body[p]))p=group(body,p,body[p],{'{':'}','(':')','<':'>'}[body[p]]).end;else p++;}
        if(body[p++]!==';')routeFail('WIT interface terminator required');const row=body.slice(start,p-1);
        if(!['use','type'].includes(row[0]))decls.push({tokens:row});
      }
    }
    const add=(name,signature)=>{const key=`${identity}/${iface}#${name}`;if(routes.has(key))routeFail('WIT duplicate API');routes.set(key,signature);};
    for(const declaration of decls){
      if(declaration.resource){for(const row of statements(declaration.body)){const constructor=row[0]==='constructor';const kind=constructor?'constructor':row[2]==='static'?'static':'method';const method=constructor?null:witName(row[0]),name=constructor?`[constructor]${declaration.resource}`:`[${kind}]${declaration.resource}.${method}`;add(name,witFunction(row,resources,{name:constructor?name:method,resource:declaration.resource,kind}).replace(/^[^:]+:/,`${name}:`));}}
      else {const name=witName(declaration.tokens[0]);add(name,witFunction(declaration.tokens,resources,{name}));}
    }
  }
  return {identity,routes};
}

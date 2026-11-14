import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const url='https://avatars.githubusercontent.com/u/203362695?s=640&v=4';
await mkdir('capture-review',{recursive:true});
const response=await fetch(url,{headers:{'Accept':'image/*','User-Agent':'ZaionPortfolioAssetReview/1.0'},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Avatar HTTP '+response.status);
const mime=(response.headers.get('content-type')||'').split(';')[0];
if(!mime.startsWith('image/'))throw new Error('Avatar did not return image data.');
const original=Buffer.from(await response.arrayBuffer());
if(!original.length||original.length>4*1024*1024)throw new Error('Unexpected avatar size.');
await writeFile('capture-review/github-avatar-original.bin',original);
const metadata=JSON.parse(execFileSync('python',['-c',[
 'from PIL import Image',
 'import json',
 'im=Image.open("capture-review/github-avatar-original.bin")',
 'info={"width":im.width,"height":im.height,"format":im.format,"mode":im.mode}',
 'p=im.convert("RGB")',
 'p.thumbnail((320,320))',
 'p.save("capture-review/github-avatar-preview.jpg",format="JPEG",quality=88)',
 'print(json.dumps(info))'
].join('\n')],{encoding:'utf8'}));
console.log('AVATAR_METADATA='+JSON.stringify({...metadata,url,mime,bytes:original.length,source:'Public original GitHub avatar, read only; identity or matching not asserted'}));
function emit(name,bytes){
 const encoded=bytes.toString('base64');
 console.log(name+'_BEGIN='+encoded.length);
 for(let offset=0,index=0;offset<encoded.length;offset+=12000,index++)console.log(name+'_'+String(index).padStart(3,'0')+'='+encoded.slice(offset,offset+12000));
 console.log(name+'_END');
}
emit('AVATAR_ORIGINAL',original);
emit('AVATAR_PREVIEW',await readFile('capture-review/github-avatar-preview.jpg'));

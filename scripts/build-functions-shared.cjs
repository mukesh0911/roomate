const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'..'));
const {transformSync}=require('../app/node_modules/esbuild');
for(const [name,out] of [['matching','sharedMatching'],['userIntent','sharedUserIntent']]){
 const source=fs.readFileSync(`app/src/lib/${name}.ts`,'utf8');
 const output=`// Generated from src/lib/${name}.ts (${crypto.createHash('sha256').update(source).digest('hex')}).\n`+transformSync(source,{loader:'ts',format:'cjs',target:'node22',legalComments:'none'}).code;
 const file=`app/functions/${out}.js`;
 if(process.argv.includes('--check')){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==output)throw Error('Regenerate shared Functions contracts: node scripts/build-functions-shared.cjs');}
 else fs.writeFileSync(file,output);
}

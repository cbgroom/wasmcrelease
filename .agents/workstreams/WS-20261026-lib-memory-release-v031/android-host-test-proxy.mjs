import {spawn} from 'node:child_process';
const child=spawn(process.argv[2],process.argv.slice(3),{stdio:'inherit'});
child.on('error',()=>{process.exitCode=1;});child.on('close',(code)=>{process.exitCode=code??1;});

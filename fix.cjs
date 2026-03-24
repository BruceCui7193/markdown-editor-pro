
const fs = require('fs');
let code = fs.readFileSync('src/main/index.ts', 'utf8');

code = code.replace(/executeJavaScript<ExportSnapshot \| null>\(/g, 'executeJavaScript(');
code = code.replace(/executeJavaScript<\{\n\s*width: number;\n\s*height: number;\n\s*\} \| null>\(/g, 'executeJavaScript(');

code = code.replace(/browserWindow \?\? undefined/g, 'browserWindow as any');
code = code.replace(/showOpenDialog\(parentWindow,/g, 'showOpenDialog(parentWindow as any,');
code = code.replace(/showSaveDialog\(parentWindow \?\? undefined/g, 'showSaveDialog(parentWindow as any');
code = code.replace(/exportWindowAsPdf\(targetWindow\)/g, 'exportWindowAsPdf(targetWindow as any)');
code = code.replace(/exportWindowAsImage\(targetWindow\)/g, 'exportWindowAsImage(targetWindow as any)');
code = code.replace(/_item, browserWindow\)/g, '_item, browserWindow: any)');

fs.writeFileSync('src/main/index.ts', code);
console.log('done2');


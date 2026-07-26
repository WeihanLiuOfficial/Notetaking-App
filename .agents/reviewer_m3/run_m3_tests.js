const fs = require('fs');
const path = require('path');
const ts = require('E:/Program Files/PyCharm 2025.2.1.1/plugins/javascript-plugin/jsLanguageServicesImpl/external/typescript.js');

const rootDir = path.resolve(__dirname, '../../');

function transpileFile(srcRelPath, outRelPath) {
  const fullSrc = path.join(rootDir, srcRelPath);
  const fullOut = path.join(__dirname, outRelPath);
  const code = fs.readFileSync(fullSrc, 'utf8');
  
  // Replace .ts imports with .js imports
  let modifiedCode = code.replace(/from\s+['"](.+?)\.ts['"]/g, "from '$1.js'");
  
  const transpiled = ts.transpileModule(modifiedCode, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      removeComments: false,
    },
  }).outputText;

  fs.mkdirSync(path.dirname(fullOut), { recursive: true });
  fs.writeFileSync(fullOut, transpiled, 'utf8');
  console.log(`Transpiled ${srcRelPath} -> ${outRelPath}`);
}

transpileFile('src/types/canvas.ts', 'types/canvas.js');
transpileFile('src/types/storage.ts', 'types/storage.js');
transpileFile('src/services/storage/database.ts', 'services/storage/database.js');
transpileFile('src/services/storage/__tests__/run_tests.ts', 'services/storage/__tests__/run_tests.js');

console.log('\n--- Running Unit Test Suite ---\n');
require('./services/storage/__tests__/run_tests.js');

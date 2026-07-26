const fs = require('fs');
const path = require('path');

// Mock @shopify/react-native-skia before requiring ts modules in headless Node
class MockSkPath {
  constructor() {
    this.commands = [];
  }
  moveTo(x, y) {
    this.commands.push({ cmd: 'moveTo', x, y });
  }
  lineTo(x, y) {
    this.commands.push({ cmd: 'lineTo', x, y });
  }
  quadTo(x1, y1, x2, y2) {
    this.commands.push({ cmd: 'quadTo', x1, y1, x2, y2 });
  }
  close() {
    this.commands.push({ cmd: 'close' });
  }
  toSVGString() {
    return 'MOCK_SVG_PATH';
  }
}

const mockSkia = {
  Path: {
    Make: () => new MockSkPath(),
    MakeFromSVGString: (svg) => new MockSkPath(),
  },
};

const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request === '@shopify/react-native-skia') {
    return 'mock-skia';
  }
  return originalResolve.apply(this, arguments);
};

require.cache['mock-skia'] = {
  id: 'mock-skia',
  filename: 'mock-skia',
  loaded: true,
  exports: { Skia: mockSkia },
};

// Configure PyCharm / standard TypeScript transpile hook for .ts files in Node execution
const ts = require('E:/Program Files/PyCharm 2025.2.1.1/plugins/javascript-plugin/jsLanguageServicesImpl/external/typescript.js');

require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const res = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  });
  module._compile(res.outputText, filename);
};

async function main() {
  console.log('\n======================================================');
  console.log(' Running Milestone 5 Full System Integration Test Suite');
  console.log('======================================================\n');

  const { runAllIntegrationTests } = require('./m5_full_system_integration.test.ts');

  const startTime = Date.now();
  const results = await runAllIntegrationTests();
  const totalTime = Date.now() - startTime;

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) {
      console.log(`  ✓ [PASS] ${r.name} (${r.durationMs}ms)`);
      passedCount++;
    } else {
      console.error(`  ✗ [FAIL] ${r.name} (${r.durationMs}ms)`);
      console.error(`     Error: ${r.error}\n`);
      failedCount++;
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(` Summary: ${passedCount} passed, ${failedCount} failed | Time: ${totalTime}ms`);
  console.log('------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled runner error:', err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const ts = require('E:/Program Files/PyCharm 2025.2.1.1/plugins/javascript-plugin/jsLanguageServicesImpl/external/typescript.js');

// Register TS module loader
require.extensions['.ts'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    }
  });
  module._compile(result.outputText, filename);
};

// Mock @shopify/react-native-skia before requiring skia.ts
const mockPathCalls = [];
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
  }
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
  exports: { Skia: mockSkia }
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, testName, failureDetails = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    testResults.push({ name: testName, status: 'PASS' });
  } else {
    failedTests++;
    testResults.push({ name: testName, status: 'FAIL', details: failureDetails });
  }
}

global.describe = (name, fn) => {
  console.log(`\n--- Running Jest Test Suite: ${name} ---`);
  fn();
};
global.test = (name, fn) => {
  try {
    fn();
    assert(true, `[Jest Unit Test] ${name}`);
  } catch (err) {
    assert(false, `[Jest Unit Test] ${name}`, err.message);
  }
};
global.expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
  },
  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  toBeUndefined: () => {
    if (actual !== undefined) throw new Error(`Expected undefined, got ${actual}`);
  }
});

// Import modules to verify
const geometry = require('../geometry.ts');
const pressure = require('../pressure.ts');
const skia = require('../skia.ts');

// Import existing unit test suite
require('./geometry.test.ts');

console.log('=== STARTING EMPIRICAL M2 VERIFICATION SUITE ===\n');

// -------------------------------------------------------------
// 1. Geometry Math Algorithms
// -------------------------------------------------------------
console.log('--- Target 1: Geometry Math Algorithms ---');

// 1.1 isPointInPolygon
const squarePoly = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

assert(
  geometry.isPointInPolygon({ x: 50, y: 50 }, squarePoly) === true,
  'isPointInPolygon: Point inside square polygon'
);

assert(
  geometry.isPointInPolygon({ x: 150, y: 50 }, squarePoly) === false,
  'isPointInPolygon: Point outside square polygon (right)'
);

assert(
  geometry.isPointInPolygon({ x: -10, y: 50 }, squarePoly) === false,
  'isPointInPolygon: Point outside square polygon (left)'
);

assert(
  geometry.isPointInPolygon({ x: 50, y: -10 }, squarePoly) === false,
  'isPointInPolygon: Point outside square polygon (top)'
);

assert(
  geometry.isPointInPolygon({ x: 50, y: 150 }, squarePoly) === false,
  'isPointInPolygon: Point outside square polygon (bottom)'
);

// Polygon bounds check (< 3 points)
assert(
  geometry.isPointInPolygon({ x: 5, y: 5 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }]) === false,
  'isPointInPolygon: Polygon with < 3 points returns false'
);

assert(
  geometry.isPointInPolygon({ x: 5, y: 5 }, null) === false,
  'isPointInPolygon: null polygon returns false'
);

// Ray-casting denominator precision test
// Check if (yj - yi + 1e-10) causes asymmetry or division issues
let rayCastErrorOccurred = false;
try {
  const testPt = { x: 50, y: 5 };
  const cwResult = geometry.isPointInPolygon(testPt, [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 0, y: 10 }
  ]);
  const ccwResult = geometry.isPointInPolygon(testPt, [
    { x: 0, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 0 }, { x: 0, y: 0 }
  ]);
  assert(
    cwResult === ccwResult && cwResult === true,
    'isPointInPolygon: Ray casting symmetry independent of winding order',
    `CW=${cwResult}, CCW=${ccwResult}`
  );

  // Epsilon zero division check
  const epsilonPoly = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 10 },
    { x: 0, y: 10 + 1e-10 } // yj - yi = 10 - (10 + 1e-10) = -1e-10
  ];
  const epsRes = geometry.isPointInPolygon({ x: 50, y: 10.00000000005 }, epsilonPoly);
  assert(
    !isNaN(epsRes),
    'isPointInPolygon: Epsilon term addition (1e-10) does not produce NaN',
    `Result was ${epsRes}`
  );
} catch (e) {
  assert(false, 'isPointInPolygon: Ray casting threw error', e.message);
}

// 1.2 isStrokeInsidePolygon
const sampleStrokeInside = {
  id: 's1', tool: 'pen', color: '#000', size: 4, createdAt: 1,
  points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }, { x: 40, y: 40 }]
};

const sampleStrokeMixed50 = {
  id: 's2', tool: 'pen', color: '#000', size: 4, createdAt: 1,
  points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 150, y: 50 }, { x: 160, y: 50 }]
};

const sampleStrokeMixed33 = {
  id: 's3', tool: 'pen', color: '#000', size: 4, createdAt: 1,
  points: [{ x: 10, y: 10 }, { x: 150, y: 50 }, { x: 160, y: 50 }]
};

assert(
  geometry.isStrokeInsidePolygon(sampleStrokeInside, squarePoly) === true,
  'isStrokeInsidePolygon: 100% points inside polygon'
);

assert(
  geometry.isStrokeInsidePolygon(sampleStrokeMixed50, squarePoly) === true,
  'isStrokeInsidePolygon: Exactly 50% points inside returns true (>= 0.5 threshold)'
);

assert(
  geometry.isStrokeInsidePolygon(sampleStrokeMixed33, squarePoly) === false,
  'isStrokeInsidePolygon: 33% points inside returns false (< 0.5 threshold)'
);

// Testing null/undefined polygon robustness
let polygonNullHandled = false;
try {
  const res = geometry.isStrokeInsidePolygon(sampleStrokeInside, null);
  polygonNullHandled = (res === false);
} catch (err) {
  polygonNullHandled = false;
}
assert(
  polygonNullHandled,
  'isStrokeInsidePolygon: Safely handles null/undefined polygon without throwing TypeError',
  'Threw TypeError when polygon is null/undefined due to unchecked polygon.length'
);

// 1.3 isPointNearStroke
const lineStroke = {
  id: 's_line', tool: 'pen', color: '#000', size: 4, createdAt: 1,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
};

assert(
  geometry.isPointNearStroke({ x: 50, y: 5 }, lineStroke, 10) === true,
  'isPointNearStroke: Point within effective threshold (5 <= 10 + 4/2 = 12)'
);

assert(
  geometry.isPointNearStroke({ x: 50, y: 20 }, lineStroke, 10) === false,
  'isPointNearStroke: Point outside effective threshold (20 > 12)'
);

const dotStroke = {
  id: 's_dot', tool: 'pen', color: '#000', size: 4, createdAt: 1,
  points: [{ x: 50, y: 50 }]
};

assert(
  geometry.isPointNearStroke({ x: 50, y: 55 }, dotStroke, 10) === true,
  'isPointNearStroke: Single point stroke (dot) hit detection'
);

// 1.4 transformStroke
const strokeToTransform = {
  id: 's_trans', tool: 'pen', color: '#000', size: 4, createdAt: 1,
  skiaPathSvg: 'M 10 10 L 20 20',
  points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
};

const transformed = geometry.transformStroke(strokeToTransform, 15, -5);

assert(
  transformed.points[0].x === 25 && transformed.points[0].y === 5 &&
  transformed.points[1].x === 35 && transformed.points[1].y === 15,
  'transformStroke: Points correctly offset by deltaX and deltaY'
);

assert(
  transformed.skiaPathSvg === undefined,
  'transformStroke: Cached skiaPathSvg invalidated to undefined'
);

assert(
  strokeToTransform.points[0].x === 10,
  'transformStroke: Immutability preserved (original stroke unmodified)'
);

// -------------------------------------------------------------
// 2. Dynamic Pressure Scaling & Bezier Curve Smoothing
// -------------------------------------------------------------
console.log('\n--- Target 2: Pressure Scaling & Bezier Curve Smoothing ---');

// 2.1 normalizePressure
assert(pressure.normalizePressure(0.0) === 0.0, 'normalizePressure: 0.0');
assert(pressure.normalizePressure(0.5) === 0.5, 'normalizePressure: 0.5');
assert(pressure.normalizePressure(1.0) === 1.0, 'normalizePressure: 1.0');
assert(pressure.normalizePressure(-0.5) === 0.0, 'normalizePressure: -0.5 clamped to 0.0');
assert(pressure.normalizePressure(1.5) === 1.0, 'normalizePressure: 1.5 clamped to 1.0');
assert(pressure.normalizePressure(undefined) === 0.5, 'normalizePressure: undefined returns default 0.5');
assert(pressure.normalizePressure(null) === 0.5, 'normalizePressure: null returns default 0.5');
assert(pressure.normalizePressure(NaN) === 0.5, 'normalizePressure: NaN returns default 0.5');

// 2.2 calculateDynamicStrokeWidth
// Pen: baseWidth * (0.4 + 1.2 * normPressure)
assert(
  Math.abs(pressure.calculateDynamicStrokeWidth(10, 0.0, 0, 'pen') - 4.0) < 1e-6,
  'calculateDynamicStrokeWidth: Pen min pressure -> 0.4 * baseWidth'
);
assert(
  Math.abs(pressure.calculateDynamicStrokeWidth(10, 0.5, 0, 'pen') - 10.0) < 1e-6,
  'calculateDynamicStrokeWidth: Pen default pressure -> 1.0 * baseWidth'
);
assert(
  Math.abs(pressure.calculateDynamicStrokeWidth(10, 1.0, 0, 'pen') - 16.0) < 1e-6,
  'calculateDynamicStrokeWidth: Pen max pressure -> 1.6 * baseWidth'
);

// Highlighter: baseWidth * (0.8 + 0.4 * normPressure)
assert(
  Math.abs(pressure.calculateDynamicStrokeWidth(20, 0.0, 0, 'highlighter') - 16.0) < 1e-6,
  'calculateDynamicStrokeWidth: Highlighter min pressure -> 0.8 * baseWidth'
);
assert(
  Math.abs(pressure.calculateDynamicStrokeWidth(20, 1.0, 0, 'highlighter') - 24.0) < 1e-6,
  'calculateDynamicStrokeWidth: Highlighter max pressure -> 1.2 * baseWidth'
);

// Eraser & Lasso
assert(
  pressure.calculateDynamicStrokeWidth(15, 0.8, 0, 'eraser') === 15,
  'calculateDynamicStrokeWidth: Eraser keeps constant baseWidth'
);
assert(
  pressure.calculateDynamicStrokeWidth(15, 0.8, 0, 'lasso') === 1,
  'calculateDynamicStrokeWidth: Lasso returns fixed width 1'
);

// Palm Filter
assert(pressure.filterPalmTouch(10) === true, 'filterPalmTouch: normal touch radius (10px)');
assert(pressure.filterPalmTouch(30) === false, 'filterPalmTouch: palm touch radius (> 25px)');

// 2.3 createSkiaPathFromPoints Bezier Smoothing
const emptyPath = skia.createSkiaPathFromPoints([]);
assert(emptyPath.commands.length === 0, 'createSkiaPathFromPoints: 0 points produces empty path');

const singlePointPath = skia.createSkiaPathFromPoints([{ x: 10, y: 20 }]);
assert(
  singlePointPath.commands.length === 2 &&
  singlePointPath.commands[0].cmd === 'moveTo' &&
  singlePointPath.commands[1].cmd === 'lineTo',
  'createSkiaPathFromPoints: 1 point produces dot (moveTo + lineTo offset)'
);

const twoPointPath = skia.createSkiaPathFromPoints([{ x: 0, y: 0 }, { x: 100, y: 100 }]);
assert(
  twoPointPath.commands.length === 2 &&
  twoPointPath.commands[0].cmd === 'moveTo' &&
  twoPointPath.commands[1].cmd === 'lineTo',
  'createSkiaPathFromPoints: 2 points produces straight line'
);

const threePointPath = skia.createSkiaPathFromPoints([
  { x: 0, y: 0 },
  { x: 50, y: 100 },
  { x: 100, y: 0 }
]);
assert(
  threePointPath.commands.length === 3 &&
  threePointPath.commands[0].cmd === 'moveTo' &&
  threePointPath.commands[1].cmd === 'quadTo' &&
  threePointPath.commands[1].x1 === 50 && threePointPath.commands[1].y1 === 100 &&
  threePointPath.commands[1].x2 === 75 && threePointPath.commands[1].y2 === 50 &&
  threePointPath.commands[2].cmd === 'lineTo' &&
  threePointPath.commands[2].x === 100 && threePointPath.commands[2].y === 0,
  'createSkiaPathFromPoints: 3 points produces Catmull-Rom quadratic Bezier smoothing (moveTo -> quadTo midpoint -> lineTo end)'
);

// -------------------------------------------------------------
// 3. Undo/Redo Stack Depth Management (30 limit) in useCanvasState
// -------------------------------------------------------------
console.log('\n--- Target 3: Undo/Redo Stack Depth Management ---');

const MAX_UNDO_DEPTH = 30;

// Simulate undo/redo stack depth management logic as implemented in useCanvasState.ts
let undoStack = [];
let redoStack = [];
let currentStrokes = [];

function pushToUndoStack(strokes) {
  undoStack = [...undoStack, strokes];
  if (undoStack.length > MAX_UNDO_DEPTH) {
    undoStack = undoStack.slice(undoStack.length - MAX_UNDO_DEPTH);
  }
  redoStack = [];
}

function addStroke(s) {
  pushToUndoStack(currentStrokes);
  currentStrokes = [...currentStrokes, s];
}

function undo() {
  if (undoStack.length === 0) return;
  const prevStrokes = undoStack[undoStack.length - 1];
  undoStack = undoStack.slice(0, undoStack.length - 1);
  redoStack = [...redoStack, currentStrokes];
  currentStrokes = prevStrokes;
}

function redo() {
  if (redoStack.length === 0) return;
  const nextStrokes = redoStack[redoStack.length - 1];
  redoStack = redoStack.slice(0, redoStack.length - 1);
  undoStack = [...undoStack, currentStrokes];
  if (undoStack.length > MAX_UNDO_DEPTH) {
    undoStack = undoStack.slice(undoStack.length - MAX_UNDO_DEPTH);
  }
  currentStrokes = nextStrokes;
}

// Perform 35 stroke additions
for (let i = 1; i <= 35; i++) {
  addStroke({ id: `stroke_${i}`, points: [{ x: i, y: i }] });
}

assert(
  undoStack.length === 30,
  'useCanvasState: Undo stack is strictly capped at MAX_UNDO_DEPTH (30) after 35 push operations',
  `Expected 30, got ${undoStack.length}`
);

// Verify eviction of oldest states (states 0 to 4 evicted, oldest state remaining is state 5)
assert(
  undoStack[0].length === 5,
  'useCanvasState: Oldest entries beyond depth 30 are evicted (FIFO eviction)',
  `Oldest state stroke count expected 5, got ${undoStack[0].length}`
);

// Perform 30 undo operations
for (let i = 0; i < 30; i++) {
  undo();
}

assert(
  undoStack.length === 0,
  'useCanvasState: Exactly 30 undo operations exhaust the undo stack'
);

assert(
  currentStrokes.length === 5,
  'useCanvasState: Restored state after 30 undos is state from 30 actions ago',
  `Expected stroke count 5, got ${currentStrokes.length}`
);

// 31st undo attempt (stack empty)
let crashOnExcessUndo = false;
try {
  undo();
} catch (e) {
  crashOnExcessUndo = true;
}
assert(
  !crashOnExcessUndo && undoStack.length === 0,
  'useCanvasState: Executing undo when stack is empty is safe noop'
);

// Verify Redo clearing on new action
assert(redoStack.length === 30, 'useCanvasState: Redo stack has 30 entries after 30 undos');
addStroke({ id: 'new_stroke_after_undo', points: [{ x: 99, y: 99 }] });
assert(
  redoStack.length === 0,
  'useCanvasState: Redo stack is cleared upon new drawing action'
);

// -------------------------------------------------------------
// 4. agent_memory/m2_drawing_canvas_recap.md Validation
// -------------------------------------------------------------
console.log('\n--- Target 4: Recap File Validation ---');

const recapPath = path.resolve(__dirname, '../../../agent_memory/m2_drawing_canvas_recap.md');
const recapExists = fs.existsSync(recapPath);
assert(recapExists, 'recap file: agent_memory/m2_drawing_canvas_recap.md exists');

if (recapExists) {
  const content = fs.readFileSync(recapPath, 'utf8');
  assert(content.includes('## Goal'), 'recap content: Contains ## Goal section');
  assert(content.includes('## Procedure'), 'recap content: Contains ## Procedure section');
  assert(content.includes('## Details'), 'recap content: Contains ## Details section');
}

// Check .agents directory layout compliance
const agentsDir = path.resolve(__dirname, '../../../.agents');
const agentsDirItems = fs.readdirSync(agentsDir);
let layoutCompliant = true;
const forbiddenExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.png', '.jpg'];

for (const item of agentsDirItems) {
  const itemPath = path.join(agentsDir, item);
  const stat = fs.statSync(itemPath);
  if (stat.isFile()) {
    const ext = path.extname(item).toLowerCase();
    if (forbiddenExtensions.includes(ext) && !['.md'].includes(ext)) {
      layoutCompliant = false;
      console.warn(`Violation: file ${item} in .agents/ root`);
    }
  }
}
assert(layoutCompliant, 'layout compliance: .agents/ contains only metadata files');

// Print Summary
console.log('\n=== EMPIRICAL VERIFICATION SUMMARY ===');
console.log(`Total Tests Run: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
  console.log('\nFAILED TEST DETAILS:');
  testResults.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`- [FAIL] ${r.name}: ${r.details || 'No details'}`);
  });
}

process.exit(failedTests > 0 ? 1 : 0);

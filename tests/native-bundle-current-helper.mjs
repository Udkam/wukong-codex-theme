import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';

const require = createRequire(import.meta.url);
export const key = node => node?.name ?? node?.value;
export const text = node => node?.type === 'Literal' ? String(node.value)
  : node?.type === 'TemplateLiteral' ? node.quasis.map(part => part.value.cooked).join(' ') : '';
export const prop = (node, name) => node?.type === 'ObjectExpression'
  ? node.properties.find(item => item.type === 'Property' && key(item.key) === name)?.value : undefined;
export const nodes = tree => {
  const result = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') result.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(tree);
  return result;
};
export const ownNodes = tree => {
  const result = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') result.push(node);
    if (node !== tree && /^(?:Function|ArrowFunction)/.test(node.type || '')) return;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(tree);
  return result;
};

// Rspack may place a presentation renderer directly in Object.assign rather
// than declaring a minified function at module scope. Select its innermost AST
// owner, keeping the source and offsets together.
export const nativeFunction = (record, anchor) => {
  const at = typeof anchor === 'number' ? anchor : record.source.indexOf(anchor);
  assert.ok(at >= 0, `Native presentation anchor changed: ${anchor}`);
  const ast = nodes(record.ast).filter(node => /^(?:Function|ArrowFunction)/.test(node.type) &&
    node !== record.ast && node.start <= at && node.end > at)
    .sort((left, right) => left.end - left.start - (right.end - right.start))[0];
  assert.ok(ast, `Native presentation owner changed: ${anchor}`);
  return { ast, source: record.source.slice(ast.start, ast.end), nodes: nodes(ast), record };
};

export const nativeObject = (record, expression) => {
  const definitions = new Map();
  for (const node of ownNodes(record.ast)) {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') definitions.set(node.id.name, node.init);
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') definitions.set(node.left.name, node.right);
  }
  const resolve = (node, seen = new Set()) => {
    if (node?.type === 'Literal') return node.value;
    if (node?.type === 'TemplateLiteral' && !node.expressions.length) return text(node);
    if (node?.type === 'Identifier' && !seen.has(node.name)) return resolve(definitions.get(node.name), new Set([...seen, node.name]));
    if (node?.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(item => {
      assert.equal(item.type, 'Property', 'Only native static presentation maps may be resolved');
      return [key(item.key), resolve(item.value, seen)];
    }));
    assert.fail(`Native static presentation map changed: ${node?.type}`);
  };
  return resolve(expression);
};

export const presentationHarness = bundle => {
  const contexts = new Map(), loaded = new Map(), createdContexts = [];
  const element = (tag, props) => {
    assert.notEqual(tag, undefined, 'An unaudited presentation dependency reached JSX');
    return typeof tag === 'function' ? tag(props) : ({ tag, props });
  };
  const jsx = { jsx: element, jsxs: element, Fragment: '#fragment' };
  const pass = props => props.children;
  const noop = () => {};
  const react = { createContext: value => {
    const context = Object.assign(pass.bind(null), { defaultValue: value, Provider: pass });
    createdContexts.push(context); return context;
  },
    useContext: value => contexts.has(value) ? contexts.get(value) : value?.defaultValue,
    useRef: value => ({ current: value }), useId: () => 'native-fixture', useLayoutEffect: noop, useEffect: noop,
    useEffectEvent: value => value, useState: value => [value, noop], createElement: element,
    cloneElement: (child, props) => ({ ...child, props: { ...child.props, ...props } }),
    Activity: pass, Fragment: '#fragment', Children: { map: children => children, toArray: children => [children].flat() },
    isValidElement: child => !!child?.props };
  const motion = tag => props => {
    const style = { ...props.style };
    for (const [name, value] of Object.entries(props.animate || {})) {
      if (['top', 'right', 'bottom', 'left', 'borderTopWidth', 'borderBottomWidth'].includes(name)) style[name] = `${value}px`;
      else if (['opacity', 'gridTemplateRows'].includes(name)) style[name] = value;
    }
    return { tag, props: { ...props, style } };
  };
  const surfaceContext = react.createContext({ hasComposerSurface: false, shouldAnimate: false, isFloatingChatSurface: false });
  const chromeContext = react.createContext('default');
  const modules = {
    ABep: jsx, QosV: { c: length => Array(length).fill(Symbol.for('react.memo_cache_sentinel')) },
    on57: { A: (...values) => values.flat(Infinity).filter(value => typeof value === 'string' && value).join(' ') },
    zd8w: react, LIss: { P: { div: motion('div'), aside: motion('aside'), section: motion('section') } },
    El6m: { CW: chromeContext, zN: surfaceContext }, DNYL: { m: Object.assign(pass, { DefaultsProvider: pass }) },
    a6Zv: { Y: () => true }, eFJR: { Y: noop }, K45w: { d: () => '28px' }, HgLj: { P: noop },
    T1PX: { I: () => true }, iodE: { tF: () => true, N: pass, q: pass }, V8uZ: { Wu: [0, 0, 1, 1] },
    v7qY: { createPortal: (children, target) => ({ tag: '#portal', props: { children, target } }) },
    RNul: { y: () => null }, mT2q: { V: pass }, JzLx: { G: pass },
    vi3X: { V: react.createContext(undefined) }, y5DF: { Ul: () => false },
    KUum: { _: () => () => null }, oyxz: { A: props => props.defaultMessage },
    RGWz: { er: () => null, pM: pass }, EGCJ: { a: pass },
    TxOL: { l: props => props.readOnlyContent ?? props.children },
    ibLK: { U: () => false }, nsuH: { wY: () => noop },
    h6hS: { o: pass }, l2oX: { x: pass },
    suct: { N: pass },
  };
  const pure = new Set(['osar', 'cI4i', 'rsCP', 'uWmg', 'ygO2', 'Ips7', 'FmJi']);
  const load = id => {
    if (Object.hasOwn(modules, id)) return modules[id];
    if (loaded.has(id)) return loaded.get(id);
    const record = bundle.module(id), exported = bundle.exports(record);
    // CSS module exports are resolved without running a factory.
    if (!Object.keys(bundle.imports(record)).length && exported.A?.type === 'ObjectExpression') {
      const value = { A: nativeObject(record, exported.A) }; loaded.set(id, value); return value;
    }
    assert.ok(pure.has(id), `Presentation module must be audited before execution: ${id}`);
    const result = {}; loaded.set(id, result);
    const require = dependency => {
      if (Object.hasOwn(modules, dependency) || pure.has(dependency)) return load(dependency);
      const candidate = bundle.module(dependency), exports = bundle.exports(candidate);
      if (!Object.keys(bundle.imports(candidate)).length && exports.A?.type === 'ObjectExpression') return load(dependency);
      // Unused imports stay empty: calling an unaudited transport/hook fails
      // with a missing member instead of executing native application code.
      return {};
    };
    require.j = 348410;
    require.d = (target, getters, constants = {}) => {
      for (const [name, getter] of Object.entries(getters)) Object.defineProperty(target, name, { get: getter, enumerable: true });
      Object.assign(target, constants);
    };
    new Function(`return (${record.source})`)()({}, result, require);
    return result;
  };
  const compile = (fn, additions = {}) => {
    const bindings = {};
    for (const [name, imported] of Object.entries(bundle.imports(fn.record))) {
      let value = {};
      if (Object.hasOwn(modules, imported.id) || pure.has(imported.id)) value = load(imported.id);
      else {
        const record = bundle.module(imported.id), exported = bundle.exports(record);
        if (!Object.keys(bundle.imports(record)).length && exported.A?.type === 'ObjectExpression') value = load(imported.id);
      }
      bindings[name] = imported.exported ? value[imported.exported] : value;
    }
    Object.assign(bindings, additions);
    return new Function(...Object.keys(bindings), `return (${fn.source});`)(...Object.values(bindings));
  };
  return { load, compile, modules, contexts, createdContexts, react, jsx, motion, surfaceContext, chromeContext };
};

const bundles = new Map();
export const loadNativeBundle = (options = {}) => {
  const lock = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
  const archive = options.archive || process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
  if (bundles.has(archive)) return bundles.get(archive);
  assert.ok(fs.existsSync(archive), 'Requires the audited installed native ASAR');
  const asar = require(path.join(process.env.APPDATA || '', 'npm/node_modules/asar'));
  const entries = asar.listPackage(archive).map(entry => entry.replace(/^[/\\]/, '').replaceAll('\\', '/'));
  const assets = entries.filter(entry => /^webview\/assets\/.+\.js$/.test(entry));
  const stylesheets = entries.filter(entry => /^webview\/assets\/.+\.css$/.test(entry));
  const content = new Map(), moduleRecords = new Map(), parsedAssets = new Map();
  const read = (entry, cache = true) => {
    const name = entry.replace(/^[/\\]/, '').replaceAll('\\', '/');
    if (content.has(name)) return content.get(name);
    const source = asar.extractFile(archive, path.normalize(name)).toString('utf8');
    if (cache) content.set(name, source);
    return source;
  };
  const index = read('webview/index.html');
  const entryScripts = [...index.matchAll(/<script\b[^>]*\bsrc="([^"?#]+\.js)"[^>]*>/g)].map(match => `webview/${match[1].replace(/^\//, '')}`);
  const layerOrder = index.match(/@layer\s+theme,\s*base,\s*components,\s*utilities\s*;/)?.[0];
  assert.ok(layerOrder && entryScripts.length, 'Native entrypoint/CSS layer prelude changed');
  const entrySource = entryScripts.map(entry => read(entry)).join('\n');
  const modulesInAsset = asset => {
    if (parsedAssets.has(asset)) return parsedAssets.get(asset);
    const source = read(asset), ast = parseAst(source), objects = [];
    for (const statement of ast.body) {
      const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
      if (declaration?.type !== 'VariableDeclaration') continue;
      for (const variable of declaration.declarations) {
        if (variable.init?.type !== 'ObjectExpression') continue;
        if (variable.init.properties.some(property => property.type === 'Property' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(property.value.type))) objects.push(variable.init);
      }
    }
    const records = objects.flatMap(object => object.properties.filter(property => property.type === 'Property' && property.value.type === 'FunctionExpression').map(property => {
      const fn = property.value;
      // Method shorthand is normalized once so all returned AST offsets refer
      // to this exact factory source, never to the enclosing chunk's offsets.
      const factorySource = `function nativeModule(${fn.params.map(parameter => source.slice(parameter.start, parameter.end)).join(',')})${source.slice(fn.body.start, fn.body.end)}`;
      const factoryAst = parseAst(factorySource).body[0];
      const record = { id: String(key(property.key)), asset, source: factorySource, ast: factoryAst,
        bodySource: factorySource.slice(factoryAst.body.start + 1, factoryAst.body.end - 1) };
      if (!moduleRecords.has(record.id)) moduleRecords.set(record.id, record);
      return moduleRecords.get(record.id);
    }));
    parsedAssets.set(asset, records);
    return records;
  };
  const findModules = needles => {
    const list = Array.isArray(needles) ? needles : [needles];
    const matches = (source, needle) => typeof needle === 'string' ? source.includes(needle) : new RegExp(needle.source, needle.flags.replace('g', '')).test(source);
    const results = new Map();
    for (const asset of assets) {
      const source = read(asset, false);
      if (!list.every(needle => matches(source, needle))) continue;
      for (const record of modulesInAsset(asset)) if (list.every(needle => matches(record.source, needle))) results.set(record.id, record);
    }
    return [...results.values()];
  };
  const module = id => {
    if (moduleRecords.has(id)) return moduleRecords.get(id);
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const candidate = new RegExp(`(?:^|[,{}])(?:${escaped}|["']${escaped}["'])\\s*(?:\\(|:)`);
    for (const asset of assets) {
      if (!candidate.test(read(asset, false))) continue;
      modulesInAsset(asset);
      if (moduleRecords.has(id)) return moduleRecords.get(id);
    }
    assert.fail(`Native module unavailable: ${id}`);
  };
  const imports = record => {
    const requireName = record.ast.params[2]?.name, result = {};
    for (const node of ownNodes(record.ast)) {
      if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier') continue;
      const expression = node.init?.type === 'MemberExpression' ? node.init.object : node.init;
      if (expression?.type === 'CallExpression' && expression.callee.name === requireName && typeof expression.arguments[0]?.value === 'string') {
        result[node.id.name] = { id: expression.arguments[0].value,
          exported: node.init.type === 'MemberExpression' ? key(node.init.property) : undefined };
      }
    }
    return result;
  };
  const exports = record => {
    const requireName = record.ast.params[2]?.name, exportName = record.ast.params[1]?.name, result = {};
    for (const node of ownNodes(record.ast)) {
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.name === requireName && key(node.callee.property) === 'd' && node.arguments[0]?.name === exportName) {
        for (const argument of node.arguments.slice(1)) if (argument.type === 'ObjectExpression') for (const property of argument.properties) {
          if (property.type === 'Property') result[key(property.key)] = property.value.type === 'ArrowFunctionExpression' ? property.value.body : property.value;
        }
      }
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.name === exportName) result[key(node.left.property)] = node.right;
    }
    return result;
  };
  const stylesheetAssets = needles => {
    const list = Array.isArray(needles) ? needles : [needles];
    return stylesheets.filter(asset => list.every(needle => typeof needle === 'string' ? read(asset).includes(needle) : needle.test(read(asset))));
  };
  const baseStylesheets = () => stylesheets.filter(asset => {
    const source = read(asset);
    return source.includes('tailwindcss v') && source.includes('--composer-radius:') && source.includes('@layer base');
  });
  const css = (needles = []) => {
    const requested = needles.length ? stylesheetAssets(needles) : stylesheets;
    return `${layerOrder}\n${[...new Set([...baseStylesheets(), ...requested])].map(asset => read(asset)).join('\n')}`;
  };
  const result = { archive, entries, assets, stylesheets, read, index, entryScripts, entrySource, layerOrder,
    modulesInAsset, module, findModules, imports, exports, stylesheetAssets, baseStylesheets, css };
  bundles.set(archive, result);
  return result;
};

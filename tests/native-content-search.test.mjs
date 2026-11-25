import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { key, loadNativeBundle, nativeFunction, nodes, ownNodes, presentationHarness, prop, text } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const selector = '[data-content-search-bar="true"] > div[class~="bg-surface-secondary"]';
assert.equal(theme.split(selector).length - 1, 1, 'The find material must target exactly its native direct paint owner');
const previousTheme = theme.replace(`  ${selector},\n`, '').replace(`  ${selector},\r\n`, '');
assert.notEqual(previousTheme, theme, 'The old-theme negative control must remove the one new selector');
const lock = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
const skip = !fs.existsSync(archive) && 'Requires the audited installed native ASAR';
const jsxImport = (bundle, record, call) => {
  const component = call?.arguments?.[0];
  assert.equal(component?.type, 'MemberExpression', 'Native presentation import changed');
  const imported = bundle.imports(record)[component.object.name];
  assert.ok(imported, 'Native presentation must resolve its imported component');
  return { ...imported, name: key(component.property), local: component.object.name };
};
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const descendants = tree => tree == null || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(descendants) : [tree, ...descendants(tree.props?.children)];
let cached;
const loadNative = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle({ archive });
  const callers = bundle.findModules(['data-content-search-bar', 'data-content-search-overlay', 'codex.threadFindBar.placeholder']);
  assert.equal(callers.length, 1, 'Native conversation-find caller changed');
  const caller = callers[0], frame = nativeFunction(caller, 'data-content-search-bar');
  const marker = frame.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'data-content-search-bar')) === 'true');
  assert.equal(text(prop(marker.arguments[1], 'className')), 'contents');
  const surfaceCall = prop(marker.arguments[1], 'children'), surfaceImport = jsxImport(bundle, caller, surfaceCall);
  const surfaceRecord = bundle.module(surfaceImport.id), surfaceAst = bundle.exports(surfaceRecord)[surfaceImport.name];
  assert.equal(surfaceAst.type, 'FunctionExpression');
  const surface = nativeFunction(surfaceRecord, surfaceAst.start);
  const surfaceClass = surface.nodes.map(text).find(value => value.includes('bg-surface-secondary'));
  assert.ok(['w-[340px]', 'rounded-[20px]', 'overflow-hidden', 'pointer-events-auto', 'border-[0.5px]'].every(value => surfaceClass.split(/\s+/).includes(value)));
  const inputCaller = nativeFunction(caller, 'codex.threadFindBar.placeholder');
  const inputCall = inputCaller.nodes.find(node => node.type === 'CallExpression' && ['onChange', 'onEnter', 'onEscape', 'placeholder'].every(name => prop(node.arguments[1], name)));
  const inputImport = jsxImport(bundle, caller, inputCall), primitives = bundle.module(inputImport.id);
  const input = nativeFunction(primitives, 'data-codex-find-input');
  assert.equal(bundle.exports(primitives)[inputImport.name], input.ast, 'The actual chat input must use the extracted native primitive');
  const closeCaller = nativeFunction(caller, 'codex.threadFindBar.close');
  const closeCall = closeCaller.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'onClose'));
  const closeImport = jsxImport(bundle, caller, closeCall);
  const navigationCaller = nativeFunction(caller, 'codex.threadFindBar.previousResult');
  const navigationCall = navigationCaller.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'onPrevious'));
  const navigationImport = jsxImport(bundle, caller, navigationCall);
  assert.equal(closeImport.id, primitives.id); assert.equal(navigationImport.id, primitives.id);
  const close = nativeFunction(primitives, bundle.exports(primitives)[closeImport.name].start);
  const navigation = nativeFunction(primitives, bundle.exports(primitives)[navigationImport.name].start);
  const buttonCall = close.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'size')) === 'icon');
  const buttonImport = jsxImport(bundle, primitives, buttonCall), buttonRecord = bundle.module(buttonImport.id);
  assert.ok(nodes(buttonRecord.ast).some(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'button'), 'Find controls must use the actual shared native Button');
  const harness = presentationHarness(bundle, [buttonImport.id]);
  // Only selected presentation functions execute. State, browser-controller,
  // search and localization services remain explicit fixture transports.
  const compile = (fn, additions = {}) => {
    const imports = bundle.imports(fn.record), used = new Set(fn.nodes.filter(node => node.type === 'Identifier').map(node => node.name));
    const declarations = ownNodes(fn.record.ast).filter(node => node.type === 'VariableDeclarator' && imports[node.id.name] && used.has(node.id.name) && !Object.hasOwn(additions, node.id.name));
    const record = { ...fn.record, ast: { ...fn.record.ast, body: { ...fn.record.ast.body, body: [{ type: 'VariableDeclaration', declarations }] } } };
    return harness.compile({ ...fn, record }, additions);
  };
  const bindingsFor = (record, id, value) => Object.fromEntries(Object.entries(bundle.imports(record)).filter(([, imported]) => imported.id === id).map(([local]) => [local, value]));
  const iconImport = jsxImport(bundle, primitives, input.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'asset')));
  // Glyph assets are source-bound; the SVG transport leaves its supplied class
  // and accessibility untouched. Search/button renderers remain native code.
  const icon = { [iconImport.name]: ({ asset, ...props }) => ({ tag: 'svg', props: { ...props, width: 16, height: 16, 'data-native-find-glyph': true } }) };
  const additions = { ...bindingsFor(primitives, buttonImport.id, harness.load(buttonImport.id)), ...bindingsFor(primitives, iconImport.id, icon) };
  const renderInput = compile(input, additions), renderClose = compile(close, additions), renderNavigation = compile(navigation, additions);
  const resultCalls = nodes(caller.ast).filter(node => node.type === 'CallExpression' && ['active', 'hasQuery', 'isPending', 'totalMatches'].every(name => prop(node.arguments[1], name)));
  assert.equal(resultCalls.length, 1, 'The actual find result-label presentation call changed');
  const resultCall = resultCalls[0];
  const resultImport = jsxImport(bundle, caller, resultCall), resultRecord = bundle.module(resultImport.id);
  const result = nativeFunction(resultRecord, bundle.exports(resultRecord)[resultImport.name].start);
  const label = nativeFunction(primitives, 'text-codex-description pointer-events-none');
  const renderLabel = compile(label);
  const labelExport = Object.entries(bundle.exports(primitives)).find(([, value]) => value === label.ast)[0];
  const messages = { A: () => ({ formatMessage: (message, values = {}) => message.defaultMessage.replace(/\{(\w+)\}/g, (_, name) => values[name]) }) };
  const renderResult = compile(result, { ...bindingsFor(resultRecord, primitives.id, { [labelExport]: renderLabel }), ...bindingsFor(resultRecord, 'Wf1j', messages) });
  const renderSurface = compile(surface);
  const visibilityHook = frame.nodes.find(node => node.type === 'CallExpression' && key(node.callee.expressions?.at(-1)?.property) === 'useSyncExternalStore');
  assert.equal(visibilityHook?.arguments[2]?.type, 'Identifier');
  const member = call => call?.callee?.type === 'SequenceExpression' ? call.callee.expressions.at(-1) : call?.callee;
  const stateReader = frame.nodes.find(node => node.type === 'CallExpression' && key(member(node)?.property) === 'Ul');
  const stateImport = bundle.imports(caller)[member(stateReader)?.object?.name];
  assert.ok(stateImport && bundle.exports(bundle.module(stateImport.id)).Ul, 'Find visibility must use its actual native state transport export');
  const scopeReader = overlay => overlay.nodes.find(node => node.type === 'CallExpression' && key(member(node)?.property) === 'gh');
  const renderFrame = compile(frame, { [surfaceImport.local]: { [surfaceImport.name]: renderSurface },
    ...bindingsFor(caller, stateImport.id, { Ul: () => true }), ...bindingsFor(caller, 'zd8w', { useSyncExternalStore: () => false }), [visibilityHook.arguments[2].name]: () => false });
  const overlay = nativeFunction(caller, 'data-content-search-overlay');
  const closeState = { SY: () => {} }, scope = {};
  const scopeImport = bundle.imports(caller)[member(scopeReader(overlay))?.object?.name];
  assert.equal(scopeImport?.id, stateImport.id, 'Visibility and close scope retain their shared source-bound state transport');
  assert.ok(bundle.exports(bundle.module(scopeImport.id)).gh, 'The native close-scope transport must still exist');
  const renderOverlay = compile(overlay, { ...bindingsFor(caller, scopeImport.id, { gh: () => scope }), ...bindingsFor(caller, 'TwSq', closeState) });
  const parameterCallbacks = Object.fromEntries(input.nodes.filter(node => node.type === 'ObjectPattern').flatMap(node => node.properties.filter(item => item.type === 'Property' && key(item.key).startsWith('on')).map(item => [item.value.name, key(item.key)])));
  const callbacks = Object.fromEntries(['onChange', 'onEnter', 'onEscape', 'onFocus', 'onNext', 'onPrevious', 'onClose'].map(name => [name, Object.assign(() => {}, { eventName: name })]));
  const render = ({ expanded = false, matches = 4 } = {}) => renderOverlay({ children: renderFrame({ children: [
    renderInput({ id: 'find-input', label: 'Find in chat', placeholder: 'Search chat…', value: '', ...callbacks }),
    renderNavigation({ isVisible: expanded, matches, nextLabel: 'Next result', previousLabel: 'Previous result', ...callbacks }),
    renderResult({ active: 1, hasQuery: expanded, totalMatches: matches }),
    renderClose({ label: 'Close find', ...callbacks })
  ] }) });
  const css = [bundle.layerOrder, ...bundle.baseStylesheets().map(asset => bundle.read(asset))].join('\n');
  return cached = { bundle, css, caller, input, overlay, close, navigation, render, callbacks, parameterCallbacks, closeState, scope };
};

test('native conversation find binds its real frame, paint owner and input/navigation/close event semantics', { skip }, () => {
  const native = loadNative(), tree = native.render({ expanded: true }), elements = descendants(tree);
  const input = elements.find(node => node.props['data-codex-find-input']);
  assert.equal(input.props.type, 'text'); assert.equal(input.props.autoFocus, true);
  assert.ok(input.props.className.split(/\s+/).includes('bg-transparent'));
  const calls = [];
  const bindings = Object.fromEntries(Object.entries(native.parameterCallbacks).map(([local, name]) => [local, (...args) => calls.push([name, ...args])]));
  const invoke = (handler, event) => new Function(...Object.keys(bindings), `return (${handler.toString()});`)(...Object.values(bindings))(event);
  const event = (key, extra = {}) => ({ key, shiftKey: false, nativeEvent: {}, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra });
  invoke(input.props.onChange, { target: { value: 'needle' } });
  for (const shiftKey of [false, true]) { const e = event('Enter', { shiftKey }); invoke(input.props.onKeyDown, e); assert.equal(e.prevented, true); }
  const escapeEvent = event('Escape'); invoke(input.props.onKeyDown, escapeEvent); assert.ok(escapeEvent.prevented && escapeEvent.stopped);
  for (const key of ['Enter', 'Escape']) { const e = event(key, { nativeEvent: { isComposing: true } }); invoke(input.props.onKeyDown, e); assert.equal(e.stopped, true); assert.equal(e.prevented, undefined); }
  const ime = event('Enter', { nativeEvent: { keyCode: 229 } }); invoke(input.props.onKeyDown, ime); assert.equal(ime.stopped, true);
  assert.deepEqual(calls, [['onChange', 'needle'], ['onEnter', false], ['onEnter', true], ['onEscape']]);
  const overlay = elements.find(node => node.props.role === 'search'), dismissals = [];
  native.closeState.SY = scope => dismissals.push(scope);
  const outerEscape = event('Escape'); overlay.props.onKeyDown(outerEscape);
  assert.ok(outerEscape.prevented && outerEscape.stopped);
  assert.deepEqual(dismissals, [native.scope]);
  overlay.props.onKeyDown(event('Enter')); overlay.props.onKeyDown(event('Escape', { nativeEvent: { isComposing: true } }));
  assert.equal(dismissals.length, 1, 'The native overlay must close only on a non-composing Escape');
  const controls = elements.filter(node => node.tag === 'button');
  assert.deepEqual(controls.map(node => node.props['aria-label']), ['Previous result', 'Next result', 'Close find']);
  assert.ok(controls.every(node => node.props.type === 'button'));
  assert.ok(descendants(native.render({ expanded: true, matches: 0 })).filter(node => node.tag === 'button').slice(0, 2).every(node => node.props.disabled === true));
});

test('conversation find paints only its native surface in both themes and retains expanded geometry, controls and restore', { skip }, async () => {
  const native = loadNative(), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) for (const expanded of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 900, height: 600 }, colorScheme: mode });
      const events = [], handlers = [];
      const html = tree => {
        if (tree == null || tree === false) return '';
        if (typeof tree !== 'object') return escape(tree);
        if (Array.isArray(tree)) return tree.map(html).join('');
        const { tag, props } = tree;
        if (tag === '#fragment') return html(props.children);
        const index = handlers.length; handlers.push(props);
        const attrs = Object.entries(props).filter(([name, value]) => !['children', 'style'].includes(name) && !name.startsWith('on') && value !== undefined && value !== false)
          .map(([name, value]) => `${name === 'className' ? 'class' : name === 'autoFocus' ? 'autofocus' : name}="${escape(value === true ? '' : value)}"`).join(' ');
        return `<${tag} data-fixture-node="${index}" ${attrs}>${html(props.children)}</${tag}>`;
      };
      await page.setContent(`<html data-theme="${mode}" data-forge-native-theme="${mode}"><head><style>${native.css}</style><style>body{margin:0;background:linear-gradient(90deg,#253a54,#c6d7cb);height:600px}#fixture{position:relative;height:240px}#ordinary{width:180px;height:30px;margin-top:280px}</style></head><body><div id="fixture">${html(native.render({ expanded }))}</div><div id="ordinary" class="bg-surface-secondary">Native negative</div></body></html>`);
      await page.exposeFunction('recordFindEvent', (...args) => { events.push(args); });
      for (const [index, props] of handlers.entries()) for (const [name, handler] of Object.entries(props).filter(([name, value]) => name.startsWith('on') && typeof value === 'function')) {
        const direct = Object.entries(native.callbacks).find(([, value]) => value === handler)?.[0];
        const bindings = native.parameterCallbacks;
        // Real input handler closures execute synchronously in the page, so
        // preventDefault/IME/propagation behavior is not replaced by a proxy.
        if (!direct && name !== 'onChange' && name !== 'onKeyDown') continue;
        if (props.role === 'search') continue; // independently audited above; input owns keyboard handling here
        await page.locator(`[data-fixture-node="${index}"]`).evaluate((element, { name, source, bindings, direct }) => {
          const record = eventName => (...args) => window.recordFindEvent(eventName, ...args.map(value => value instanceof Event ? value.type : value));
          const callback = direct ? record(direct) : new Function(...Object.keys(bindings), `return (${source});`)(...Object.values(bindings).map(record));
          element.addEventListener(name === 'onChange' ? 'input' : name.slice(2).toLowerCase(), event => {
            Object.defineProperty(event, 'nativeEvent', { value: event }); callback(event);
          });
        }, { name, source: handler.toString(), bindings, direct });
      }
      const read = () => page.locator('#fixture *,#ordinary').evaluateAll(elements => elements.map(element => {
        const s = getComputedStyle(element), r = element.getBoundingClientRect();
        return { geometry: [r.x, r.y, r.width, r.height, s.position, s.padding, s.margin, s.borderWidth, s.borderRadius, s.font, s.overflow, s.pointerEvents],
          material: [s.backgroundColor, s.backgroundImage, s.backdropFilter, s.boxShadow],
          controls: [element.getAttribute('aria-label'), element.disabled, element.getAttribute('type')] };
      }));
      const before = await read();
      const owner = page.locator(selector), overlay = page.locator('[data-content-search-overlay]'), input = page.locator('[data-codex-find-input]');
      assert.equal(await owner.evaluate(element => element.getBoundingClientRect().width), 340);
      assert.equal(await owner.evaluate(element => getComputedStyle(element).borderRadius), '20px');
      assert.equal(await input.evaluate(element => element.parentElement.getBoundingClientRect().height), 44);
      const [height, border] = await owner.evaluate(element => { const s = getComputedStyle(element); return [element.getBoundingClientRect().height, parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth)]; });
      assert.ok(expanded ? height > 44 + border : height === 44 + border, `${mode}/${expanded}: native result-row height is ${height}`);
      await page.addStyleTag({ content: previousTheme });
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      assert.equal(await owner.evaluate(element => getComputedStyle(element).backdropFilter), 'none', 'The old CSS must expose the missed find surface');
      await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
      const sheet = await page.addStyleTag({ content: theme });
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const after = await read();
      assert.deepEqual(after.map(value => value.geometry), before.map(value => value.geometry), `${mode}/${expanded}: native geometry is unchanged`);
      assert.deepEqual(after.map(value => value.controls), before.map(value => value.controls));
      assert.match(await owner.evaluate(element => getComputedStyle(element).backdropFilter), /blur\(/);
      assert.notEqual(await owner.evaluate(element => getComputedStyle(element).backgroundImage), 'none');
      for (const element of [overlay, input]) assert.deepEqual(await element.evaluate(element => { const s = getComputedStyle(element); return [s.backgroundColor, s.backgroundImage, s.backdropFilter]; }), ['rgba(0, 0, 0, 0)', 'none', 'none']);
      assert.equal(await page.locator('#fixture *').evaluateAll(elements => elements.filter(element => getComputedStyle(element).backdropFilter !== 'none').length), 1);
      assert.deepEqual(after.at(-1), before.at(-1), 'Unrelated bg-surface-secondary remains native');
      await input.fill('fixture query'); await input.press('Enter'); await input.press('Shift+Enter'); await input.press('Escape');
      assert.equal(await input.inputValue(), 'fixture query'); assert.equal(await input.evaluate(element => element === document.activeElement), true);
      if (expanded) { await page.getByRole('button', { name: 'Previous result', exact: true }).click(); await page.getByRole('button', { name: 'Next result', exact: true }).click(); }
      await page.getByRole('button', { name: 'Close find', exact: true }).click();
      await page.waitForFunction(() => true);
      assert.ok(events.some(event => event[0] === 'onChange' && event[1] === 'fixture query'));
      assert.ok(events.some(event => event[0] === 'onEnter' && event[1] === false)); assert.ok(events.some(event => event[0] === 'onEnter' && event[1] === true));
      assert.ok(events.some(event => event[0] === 'onEscape')); assert.ok(events.some(event => event[0] === 'onClose'));
      if (expanded) for (const name of ['onPrevious', 'onNext']) assert.ok(events.some(event => event[0] === name));
      await input.blur(); await page.mouse.move(0, 400);
      await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
      await sheet.evaluate(element => element.remove());
      assert.deepEqual(await read(), before, `${mode}/${expanded}: restoring the theme restores the native presentation`);
      await page.close();
    }
  } finally { await browser.close(); }
});

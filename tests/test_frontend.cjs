const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('frappe_notify_plus/public/js/notify_plus.js', 'utf8');
const key = 'notify-plus-sound:test@example.com';
function boot(saved = new Map(), blocked = false, options = {}) {
    const ready = [], jqueryHandlers = {};
    const elements = [], handlers = {}, windowHandlers = {}, routes = [], contexts = [];
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.classList = {add() {}}; elements.push(this); }
        append(...children) { for (const child of children) { child.parent = this; child.isConnected = true; this.children.push(child); } }
        setAttribute() {}
        remove() { this.parent.children = this.parent.children.filter(x => x !== this); }
        matches() { return false; }
        contains() { return false; }
        closest(tag) { return this.tag === tag ? this : this.parent?.closest(tag); }
    }
    class AudioContext {
        constructor() { this.state = blocked ? 'suspended' : 'running'; contexts.push(this); }
        resume() { if (blocked) return new Promise(() => {}); this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
    }
    const document = {createElement: tag => new Element(tag), body: new Element('body'),
        getElementById: id => elements.find(x => x.id === id), addEventListener: (event, fn) => handlers[event] = fn};
    const frappe = {session: options.session ?? {user: 'test@example.com'}, boot: options.boot, realtime: {on() {}}, set_route: (...args) => routes.push(args)};
    vm.runInNewContext(source, {frappe, document, window: {AudioContext, addEventListener: (event, fn) => windowHandlers[event] = fn},
        localStorage: {getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v)},
        __: x => x, $: value => {
            if (typeof value === 'function') { if (options.deferred) ready.push(value); else value(); }
            else return {on: (event, fn) => jqueryHandlers[event] = fn};
        }, setTimeout, clearTimeout, URL, location: {origin: 'https://erp.test'}});
    return {frappe, elements, contexts, handlers, windowHandlers, routes, ready, jqueryHandlers,
        get control() { return elements.find(x => x.className === 'np-audio-control'); }};
}
test('enable, mute, unmute survive reload and blocked autoplay', () => {
    const saved = new Map();
    let app = boot(saved, true);
    assert.equal(app.control.textContent, 'Enable sound');
    app.control.onclick();
    assert.equal(saved.get(key), 'enabled');
    app = boot(saved, true);
    assert.equal(app.control.textContent, 'Mute notifications');
    assert.equal(app.contexts.length, 1);
    app.handlers.pointerdown();
    assert.equal(saved.get(key), 'enabled');
    app.control.onclick();
    assert.equal(saved.get(key), 'muted');
    app = boot(saved);
    assert.equal(app.control.textContent, 'Unmute notifications');
    assert.equal(app.contexts.length, 0);
    app.control.onclick();
    assert.equal(saved.get(key), 'enabled');
    assert.equal(boot(saved).control.textContent, 'Mute notifications');
});
test('legacy preference and cross-tab changes are respected', () => {
    const saved = new Map([['notify-plus-muted:test@example.com', '1']]);
    const app = boot(saved);
    assert.equal(app.control.textContent, 'Unmute notifications');
    saved.set(key, 'enabled'); app.windowHandlers.storage({key});
    assert.equal(app.control.textContent, 'Mute notifications');
    saved.set(key, 'muted'); app.windowHandlers.storage({key});
    assert.equal(app.control.textContent, 'Unmute notifications');
});
test('body and action navigate to record; close does not navigate', () => {
    const app = boot();
    app.frappe.notify_plus.show({id:'LOG-1', document_type:'Sales Invoice', document_name:'INV/0001', duration:0, sound:'None'});
    const toast = app.elements.find(x => x.tag === 'article');
    const title = app.elements.find(x => x.className === 'np-title');
    toast.onclick({target:title});
    assert.deepEqual(app.routes[0], ['Form', 'Sales Invoice', 'INV/0001']);
    const close = app.elements.find(x => x.className === 'np-close');
    toast.onclick({target:close});
    assert.equal(app.routes.length, 1);
    const open = app.elements.find(x => x.className === 'np-open');
    open.onclick();
    assert.deepEqual(app.routes[1], ['Form', 'Sales Invoice', 'INV/0001']);
});
test('missing or incomplete reference falls back to notification log', () => {
    for (const reference of [{}, {document_type:'ToDo'}]) {
        const app = boot();
        app.frappe.notify_plus.show({id:'LOG-2', ...reference, duration:0, sound:'None'});
        app.elements.find(x => x.className === 'np-open').onclick();
        assert.deepEqual(app.routes[0], ['Form', 'Notification Log', 'LOG-2']);
    }
});
test('preview renders even if audio unlock is pending and keeps mute', () => {
    for (const preference of ['disabled', 'muted']) {
        const saved = new Map([[key, preference]]);
        const app = boot(saved, true);
        app.frappe.notify_plus.preview({duration:0, sound:'None'});
        assert.ok(app.elements.find(x => x.tag === 'article'));
        assert.equal(saved.get(key), preference === 'muted' ? 'muted' : 'enabled');
        assert.equal(app.elements.find(x => x.className === 'np-open'), undefined);
    }
});

test('cold reload resolves user after Desk startup instead of using undefined key', () => {
    const saved = new Map([[key, 'enabled']]);
    const app = boot(saved, true, {session: {}, deferred: true});
    assert.equal(app.control, undefined);
    app.frappe.session.user = 'test@example.com';
    app.ready.forEach(fn => fn());
    assert.equal(app.control.textContent, 'Mute notifications');
    app.control.onclick();
    assert.equal(saved.get(key), 'muted');
    assert.equal(saved.has('notify-plus-sound:undefined'), false);
    app.jqueryHandlers.app_ready();
    assert.equal(app.elements.filter(x => x.className === 'np-audio-control').length, 1);
    assert.equal(boot(saved).control.textContent, 'Unmute notifications');
});
test('late user initialization retries on app_ready and uses boot identity', () => {
    const saved = new Map([[key, 'enabled'], ['notify-plus-sound:someone-else', 'muted']]);
    const app = boot(saved, true, {session: {}});
    assert.equal(app.control, undefined);
    app.frappe.boot = {user: {name: 'test@example.com'}};
    app.frappe.session.user = 'someone-else';
    app.jqueryHandlers.app_ready();
    assert.equal(app.control.textContent, 'Mute notifications');
    app.control.onclick();
    assert.equal(saved.get(key), 'muted');
});

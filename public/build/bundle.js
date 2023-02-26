
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    class Store {
      constructor(initData) {
        this.store = writable(initData);
        this.defaultData = JSON.parse(JSON.stringify(initData));
      }

      setValue(path, value) {
        const lastKey = path[[path.length - 1]];
        const target = { ...get_store_value(this.getData()) };

        path.slice(0, -1).reduce((acc, key) => acc[key], target)[lastKey] = value;

        this.store.set(target);
      }

      getValue(path) {
        return derived(this.store, ($data) =>
          path.reduce((obj, key) => obj && obj[key], $data)
        )
      }

      getValueCopy(path) {
        return get_store_value(this.getValue(path))
      }

      getDefaultValue(path) {
        return path.reduce((obj, key) => obj && obj[key], this.defaultData)
      }

      isChanged(path) {
        return (
          JSON.stringify(this.getValue(path)) !==
          JSON.stringify(this.getDefaultValue(path))
        )
      }

      get isDirty() {
        return JSON.stringify(this.getData()) !== JSON.stringify(this.defaultData)
      }

      getData() {
        return derived(this.store, ($data) => $data)
      }
    }

    /* src/components/FormInput.svelte generated by Svelte v3.55.1 */

    const file$4 = "src/components/FormInput.svelte";

    function create_fragment$4(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "placeholder", /*placeholder*/ ctx[3]);
    			attr_dev(input, "type", /*type*/ ctx[4]);
    			attr_dev(input, "class", /*className*/ ctx[2]);
    			input.value = /*$value*/ ctx[6];
    			add_location(input, file$4, 10, 0, 177);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_handler*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*placeholder*/ 8) {
    				attr_dev(input, "placeholder", /*placeholder*/ ctx[3]);
    			}

    			if (dirty & /*type*/ 16) {
    				attr_dev(input, "type", /*type*/ ctx[4]);
    			}

    			if (dirty & /*className*/ 4) {
    				attr_dev(input, "class", /*className*/ ctx[2]);
    			}

    			if (dirty & /*$value*/ 64 && input.value !== /*$value*/ ctx[6]) {
    				prop_dev(input, "value", /*$value*/ ctx[6]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let value;

    	let $value,
    		$$unsubscribe_value = noop,
    		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(6, $value = $$value)), value);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormInput', slots, []);
    	let { store } = $$props;
    	let { path } = $$props;
    	let { className = "" } = $$props;
    	let { placeholder = "" } = $$props;
    	let { type = "text" } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (store === undefined && !('store' in $$props || $$self.$$.bound[$$self.$$.props['store']])) {
    			console.warn("<FormInput> was created without expected prop 'store'");
    		}

    		if (path === undefined && !('path' in $$props || $$self.$$.bound[$$self.$$.props['path']])) {
    			console.warn("<FormInput> was created without expected prop 'path'");
    		}
    	});

    	const writable_props = ['store', 'path', 'className', 'placeholder', 'type'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormInput> was created with unknown prop '${key}'`);
    	});

    	const input_handler = e => store.setValue(path, e.target.value);

    	$$self.$$set = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    		if ('className' in $$props) $$invalidate(2, className = $$props.className);
    		if ('placeholder' in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ('type' in $$props) $$invalidate(4, type = $$props.type);
    	};

    	$$self.$capture_state = () => ({
    		store,
    		path,
    		className,
    		placeholder,
    		type,
    		value,
    		$value
    	});

    	$$self.$inject_state = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    		if ('className' in $$props) $$invalidate(2, className = $$props.className);
    		if ('placeholder' in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ('type' in $$props) $$invalidate(4, type = $$props.type);
    		if ('value' in $$props) $$subscribe_value($$invalidate(5, value = $$props.value));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*store, path*/ 3) {
    			$$subscribe_value($$invalidate(5, value = store.getValue(path)));
    		}
    	};

    	return [store, path, className, placeholder, type, value, $value, input_handler];
    }

    class FormInput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			store: 0,
    			path: 1,
    			className: 2,
    			placeholder: 3,
    			type: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormInput",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get store() {
    		throw new Error("<FormInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set store(value) {
    		throw new Error("<FormInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get path() {
    		throw new Error("<FormInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<FormInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get className() {
    		throw new Error("<FormInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<FormInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get placeholder() {
    		throw new Error("<FormInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<FormInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error("<FormInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<FormInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Item.svelte generated by Svelte v3.55.1 */
    const file$3 = "src/components/Item.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let forminput0;
    	let t0;
    	let forminput1;
    	let t1;
    	let forminput2;
    	let t2;
    	let forminput3;
    	let t3;
    	let forminput4;
    	let t4;
    	let current;

    	forminput0 = new FormInput({
    			props: {
    				placeholder: "Před",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "before"]
    			},
    			$$inline: true
    		});

    	forminput1 = new FormInput({
    			props: {
    				placeholder: "Název",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "title"]
    			},
    			$$inline: true
    		});

    	forminput2 = new FormInput({
    			props: {
    				type: "number",
    				placeholder: "Cena",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "price"]
    			},
    			$$inline: true
    		});

    	forminput3 = new FormInput({
    			props: {
    				placeholder: "Alergeny",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "alergens"]
    			},
    			$$inline: true
    		});

    	forminput4 = new FormInput({
    			props: {
    				placeholder: "Jednotka",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "unit"]
    			},
    			$$inline: true
    		});

    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(forminput0.$$.fragment);
    			t0 = space();
    			create_component(forminput1.$$.fragment);
    			t1 = space();
    			create_component(forminput2.$$.fragment);
    			t2 = space();
    			create_component(forminput3.$$.fragment);
    			t3 = space();
    			create_component(forminput4.$$.fragment);
    			t4 = space();
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "item");
    			add_location(div, file$3, 7, 0, 103);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(forminput0, div, null);
    			append_dev(div, t0);
    			mount_component(forminput1, div, null);
    			append_dev(div, t1);
    			mount_component(forminput2, div, null);
    			append_dev(div, t2);
    			mount_component(forminput3, div, null);
    			append_dev(div, t3);
    			mount_component(forminput4, div, null);
    			append_dev(div, t4);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const forminput0_changes = {};
    			if (dirty & /*store*/ 1) forminput0_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput0_changes.path = [.../*path*/ ctx[1], "before"];
    			forminput0.$set(forminput0_changes);
    			const forminput1_changes = {};
    			if (dirty & /*store*/ 1) forminput1_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput1_changes.path = [.../*path*/ ctx[1], "title"];
    			forminput1.$set(forminput1_changes);
    			const forminput2_changes = {};
    			if (dirty & /*store*/ 1) forminput2_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput2_changes.path = [.../*path*/ ctx[1], "price"];
    			forminput2.$set(forminput2_changes);
    			const forminput3_changes = {};
    			if (dirty & /*store*/ 1) forminput3_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput3_changes.path = [.../*path*/ ctx[1], "alergens"];
    			forminput3.$set(forminput3_changes);
    			const forminput4_changes = {};
    			if (dirty & /*store*/ 1) forminput4_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput4_changes.path = [.../*path*/ ctx[1], "unit"];
    			forminput4.$set(forminput4_changes);

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(forminput0.$$.fragment, local);
    			transition_in(forminput1.$$.fragment, local);
    			transition_in(forminput2.$$.fragment, local);
    			transition_in(forminput3.$$.fragment, local);
    			transition_in(forminput4.$$.fragment, local);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(forminput0.$$.fragment, local);
    			transition_out(forminput1.$$.fragment, local);
    			transition_out(forminput2.$$.fragment, local);
    			transition_out(forminput3.$$.fragment, local);
    			transition_out(forminput4.$$.fragment, local);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(forminput0);
    			destroy_component(forminput1);
    			destroy_component(forminput2);
    			destroy_component(forminput3);
    			destroy_component(forminput4);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Item', slots, ['default']);
    	let { store } = $$props;
    	let { path } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (store === undefined && !('store' in $$props || $$self.$$.bound[$$self.$$.props['store']])) {
    			console.warn("<Item> was created without expected prop 'store'");
    		}

    		if (path === undefined && !('path' in $$props || $$self.$$.bound[$$self.$$.props['path']])) {
    			console.warn("<Item> was created without expected prop 'path'");
    		}
    	});

    	const writable_props = ['store', 'path'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Item> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ FormInput, store, path });

    	$$self.$inject_state = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [store, path, $$scope, slots];
    }

    class Item extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { store: 0, path: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Item",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get store() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set store(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get path() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const BEFORE = [
      "",
      "1.",
      "2.",
      "3.",
      "4.",
      "5.",
      "6.",
      "7.",
      "De",
      "D",
      "",
    ];
    const PRICE = ["", "129", "139", "149", "159", "169", "185", "69", "49"];
    const UNIT = "Kč";

    var Defaults = /*#__PURE__*/Object.freeze({
        __proto__: null,
        BEFORE: BEFORE,
        PRICE: PRICE,
        UNIT: UNIT
    });

    /* src/components/Section.svelte generated by Svelte v3.55.1 */

    const { console: console_1 } = globals;
    const file$2 = "src/components/Section.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (35:2) {#each $items as item, i}
    function create_each_block$2(ctx) {
    	let item;
    	let current;

    	item = new Item({
    			props: {
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "items", /*i*/ ctx[8]]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(item.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(item, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const item_changes = {};
    			if (dirty & /*store*/ 1) item_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) item_changes.path = [.../*path*/ ctx[1], "items", /*i*/ ctx[8]];
    			item.$set(item_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(item.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(item.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(item, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(35:2) {#each $items as item, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let forminput;
    	let t0;
    	let button;
    	let t2;
    	let current;
    	let mounted;
    	let dispose;

    	forminput = new FormInput({
    			props: {
    				className: "section-title",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "title"]
    			},
    			$$inline: true
    		});

    	let each_value = /*$items*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(forminput.$$.fragment);
    			t0 = space();
    			button = element("button");
    			button.textContent = "Přidat položku";
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(button, file$2, 33, 2, 717);
    			attr_dev(div, "class", "section");
    			add_location(div, file$2, 31, 0, 617);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(forminput, div, null);
    			append_dev(div, t0);
    			append_dev(div, button);
    			append_dev(div, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const forminput_changes = {};
    			if (dirty & /*store*/ 1) forminput_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput_changes.path = [.../*path*/ ctx[1], "title"];
    			forminput.$set(forminput_changes);

    			if (dirty & /*store, path, $items*/ 7) {
    				each_value = /*$items*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(forminput.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(forminput.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(forminput);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $items,
    		$$unsubscribe_items = noop,
    		$$subscribe_items = () => ($$unsubscribe_items(), $$unsubscribe_items = subscribe(items, $$value => $$invalidate(2, $items = $$value)), items);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_items());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Section', slots, []);
    	let { store } = $$props;
    	let { path } = $$props;

    	function add(lastIndex) {
    		store.setValue([...path, "items"], [
    			...store.getValueCopy([...path, "items"]),
    			{
    				before: BEFORE[lastIndex],
    				title: "",
    				alergens: "",
    				price: PRICE[lastIndex],
    				unit: UNIT
    			}
    		]);
    	}

    	let items;

    	$$self.$$.on_mount.push(function () {
    		if (store === undefined && !('store' in $$props || $$self.$$.bound[$$self.$$.props['store']])) {
    			console_1.warn("<Section> was created without expected prop 'store'");
    		}

    		if (path === undefined && !('path' in $$props || $$self.$$.bound[$$self.$$.props['path']])) {
    			console_1.warn("<Section> was created without expected prop 'path'");
    		}
    	});

    	const writable_props = ['store', 'path'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Section> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => add($items.length);

    	$$self.$$set = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    	};

    	$$self.$capture_state = () => ({
    		Item,
    		Defaults,
    		FormInput,
    		store,
    		path,
    		add,
    		items,
    		$items
    	});

    	$$self.$inject_state = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    		if ('items' in $$props) $$subscribe_items($$invalidate(3, items = $$props.items));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*store, path, $items*/ 7) {
    			{
    				$$subscribe_items($$invalidate(3, items = store.getValue([...path, "items"])));
    				console.log($items);
    			}
    		}
    	};

    	return [store, path, $items, items, add, click_handler];
    }

    class Section extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { store: 0, path: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get store() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set store(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get path() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Page.svelte generated by Svelte v3.55.1 */
    const file$1 = "src/components/Page.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (27:2) {#each $sections as section, i}
    function create_each_block$1(ctx) {
    	let section;
    	let current;

    	section = new Section({
    			props: {
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "sections", /*i*/ ctx[8]]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section_changes = {};
    			if (dirty & /*store*/ 1) section_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) section_changes.path = [.../*path*/ ctx[1], "sections", /*i*/ ctx[8]];
    			section.$set(section_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(27:2) {#each $sections as section, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let forminput;
    	let t0;
    	let button;
    	let t2;
    	let current;
    	let mounted;
    	let dispose;

    	forminput = new FormInput({
    			props: {
    				className: "page-title",
    				store: /*store*/ ctx[0],
    				path: [.../*path*/ ctx[1], "title"]
    			},
    			$$inline: true
    		});

    	let each_value = /*$sections*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(forminput.$$.fragment);
    			t0 = space();
    			button = element("button");
    			button.textContent = "Přidat sekci";
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(button, file$1, 24, 4, 528);
    			attr_dev(div0, "class", "row");
    			add_location(div0, file$1, 22, 2, 431);
    			attr_dev(div1, "class", "page");
    			add_location(div1, file$1, 21, 0, 410);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(forminput, div0, null);
    			append_dev(div0, t0);
    			append_dev(div0, button);
    			append_dev(div1, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const forminput_changes = {};
    			if (dirty & /*store*/ 1) forminput_changes.store = /*store*/ ctx[0];
    			if (dirty & /*path*/ 2) forminput_changes.path = [.../*path*/ ctx[1], "title"];
    			forminput.$set(forminput_changes);

    			if (dirty & /*store, path, $sections*/ 11) {
    				each_value = /*$sections*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(forminput.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(forminput.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(forminput);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $sections,
    		$$unsubscribe_sections = noop,
    		$$subscribe_sections = () => ($$unsubscribe_sections(), $$unsubscribe_sections = subscribe(sections, $$value => $$invalidate(3, $sections = $$value)), sections);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_sections());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Page', slots, []);
    	let { store } = $$props;
    	let { path } = $$props;

    	function add() {
    		store.setValue([...path, "sections"], [
    			...store.getValueCopy([...path, "sections"]),
    			{ title: "Added section", items: [] }
    		]);
    	}

    	let sections;

    	$$self.$$.on_mount.push(function () {
    		if (store === undefined && !('store' in $$props || $$self.$$.bound[$$self.$$.props['store']])) {
    			console.warn("<Page> was created without expected prop 'store'");
    		}

    		if (path === undefined && !('path' in $$props || $$self.$$.bound[$$self.$$.props['path']])) {
    			console.warn("<Page> was created without expected prop 'path'");
    		}
    	});

    	const writable_props = ['store', 'path'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Page> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => add();

    	$$self.$$set = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    	};

    	$$self.$capture_state = () => ({
    		Section,
    		FormInput,
    		store,
    		path,
    		add,
    		sections,
    		$sections
    	});

    	$$self.$inject_state = $$props => {
    		if ('store' in $$props) $$invalidate(0, store = $$props.store);
    		if ('path' in $$props) $$invalidate(1, path = $$props.path);
    		if ('sections' in $$props) $$subscribe_sections($$invalidate(2, sections = $$props.sections));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*store, path*/ 3) {
    			$$subscribe_sections($$invalidate(2, sections = store.getValue([...path, "sections"])));
    		}
    	};

    	return [store, path, sections, $sections, add, click_handler];
    }

    class Page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { store: 0, path: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Page",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get store() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set store(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get path() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.55.1 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (18:0) {#each $pages as page, i}
    function create_each_block(ctx) {
    	let page;
    	let current;

    	page = new Page({
    			props: {
    				store: /*store*/ ctx[2],
    				path: ["pages", /*i*/ ctx[7]]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(page.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(page, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(page.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(page.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(page, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(18:0) {#each $pages as page, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let button;
    	let t1;
    	let each_1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*$pages*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Add page";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			add_location(button, file, 16, 0, 368);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler*/ ctx[4]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*store, $pages*/ 6) {
    				each_value = /*$pages*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $pages,
    		$$unsubscribe_pages = noop,
    		$$subscribe_pages = () => ($$unsubscribe_pages(), $$unsubscribe_pages = subscribe(pages, $$value => $$invalidate(1, $pages = $$value)), pages);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_pages());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	const store = new Store({
    			pages: [{ sections: [], title: "hello" }]
    		});

    	let pages;

    	function add() {
    		store.setValue(["pages"], [store.getValueCopy(["pages"]), { title: "Added page", sections: [] }]);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => add();
    	$$self.$capture_state = () => ({ Store, Page, store, pages, add, $pages });

    	$$self.$inject_state = $$props => {
    		if ('pages' in $$props) $$subscribe_pages($$invalidate(0, pages = $$props.pages));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$subscribe_pages($$invalidate(0, pages = store.getValue(["pages"])));
    	return [pages, $pages, store, add, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      props: {},
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

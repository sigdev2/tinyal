((global) => {
	const DIRECTIVE_APP = 'ng-app';
	const DIRECTIVE_CONTROLLER = 'ng-controller';
	
	const DIRECTIVE_INIT = 'ng-init';
	const DIRECTIVE_FPS = 'ng-fps';
	
	const DIRECTIVE_MODEL = 'ng-model';
	const DIRECTIVE_BIND = 'ng-bind';
	
	const DIRECTIVE_OPTIONS = 'ng-options';
	
	const DIRECTIVE_SHOW = 'ng-show';
	const DIRECTIVE_HIDE = 'ng-hide';
	const DIRECTIVE_DISABLED = 'ng-disabled';

	const DIRECTIVE_CLICK = 'ng-click';
	const DIRECTIVE_DBLCHANGE = 'ng-dblclick';
	const DIRECTIVE_CHANGE = 'ng-change';
	const DIRECTIVE_INPUT = 'ng-input';
	const DIRECTIVE_FOCUS = 'ng-focus';
	const DIRECTIVE_KEYDOWN = 'ng-keydown';
	const DIRECTIVE_KEYPRESS = 'ng-keypress';
	const DIRECTIVE_KEYUP = 'ng-keyup';
	const DIRECTIVE_MOUSEDOWN = 'ng-mousedown';
	const DIRECTIVE_MOUSEUP = 'ng-mouseup';
	const DIRECTIVE_MOUSEENTER = 'ng-mouseenter';
	const DIRECTIVE_MOUSELEAVE = 'ng-mouseleave';
	const DIRECTIVE_MOUSEMOVE = 'ng-mousemove';
	const DIRECTIVE_MOUSEOVER = 'ng-mouseover';
	const DIRECTIVE_TOUCHSTART = 'ng-touchstart';
	const DIRECTIVE_TOUCHMOVE = 'ng-touchmove';

	const DIRECTIVE_CHILDREN = 'ng-children';
	const DIRECTIVE_INNERIF = 'ng-innerif';

	const events = [DIRECTIVE_CLICK, DIRECTIVE_DBLCHANGE, DIRECTIVE_CHANGE, DIRECTIVE_INPUT, DIRECTIVE_FOCUS, DIRECTIVE_KEYDOWN,
		DIRECTIVE_KEYPRESS, DIRECTIVE_KEYUP, DIRECTIVE_MOUSEDOWN, DIRECTIVE_MOUSEUP, DIRECTIVE_MOUSEENTER,
		DIRECTIVE_MOUSELEAVE, DIRECTIVE_MOUSEMOVE, DIRECTIVE_MOUSEOVER, DIRECTIVE_TOUCHSTART, DIRECTIVE_TOUCHMOVE];

	const BIND_RX = /\{\{([^\}]*)\}\}/gm;
	const FOR_VAR_NAME_RX = /^\s*(?:[A-z0-9_]+\s+)?(\[(?:[A-z0-9_\.]+\,?\s*)+\]|[_A-z0-9\.]+)(?:\s+in|\s+of|\s*;|\s*=|\s*$)/gm;

	const DEFAULT_RENDER_TIMEOUT = 16; // 60 FPS

	function getStyles() {
        return '.ng-hide { display: none !important; } .ng-show { display: initial !important; }';
	}

	function addGlobalStyle() {
        const css = getStyles(),
			head = document.head || document.getElementsByTagName('head')[0],
			style = document.createElement('style');

		head.appendChild(style);
		style.appendChild(document.createTextNode(css));
	}

	function bindEvents(data, element) {
        for (const eventAttr of events) {
			if (element.hasAttribute(eventAttr)) {
				const code = element.getAttribute(eventAttr);
				element.removeAttribute(eventAttr);
				const eventName = eventAttr.replace('ng-', '');
				element.addEventListener(eventName, (e) => {
					try {
						const ret = evalExpressionFunc(code).apply(data, [e]);
						if (typeof ret == 'function')
							ret.apply(element);
					} catch(e) {
						console.warn(e.message);
					}
				});
			}
		}
	}

	function uuidv4() {
		return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
		  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}

	function getProperty(obj, path) {
        const chain = path.split('.');
		for (const part of chain) {
			if (!(part in obj))
			    return undefined;
			obj = obj[part];
		}

		return obj;
	}
	
	function setProperty(obj, path, value) {
        const chain = path.split('.');
		for (const [index, part] of chain.entries()) {
			if (part in obj)
			    obj = obj[part];
			else
			    obj[part] = (chain.length - 1 == index ? value : {});
		}
	}

	function isTemplateNode(element) {
		return (element.nodeType == Node.TEXT_NODE && element.nodeValue.replace(/\u00a0/g, '_').trim().length != 0) ||
		       (element.nodeType == Node.ELEMENT_NODE) ||
			   element.nodeType == Node.DOCUMENT_FRAGMENT_NODE;
	}

	function evalExpressionFunc(expression) {
		return new Function('return function() { return (' + expression + '); }')();
	}

	function forExpressionFunc(expression, itemNames) {
		return new Function('return function(bodyFunc) { for (' + expression + ') { bodyFunc.apply(' + itemNames + ') }; }')();
	}

	function textExpressionFunc(data, template, element) {
		data = new Proxy(data, staticReadOnly);
        return () => {
			return template.replaceAll(BIND_RX, (match, p1) => {
				try {
				    return evalExpressionFunc(p1).apply(data);
				} catch(e) {
					console.warn(e.message);
				}
				return '';
			});
		}
	}

	function textAttributeExpressionFunc(data, attr, value, element) {
		data = new Proxy(data, staticReadOnly);
        return () => {
			const newValue = value.replaceAll(BIND_RX, (match, p1) => {
				try {
				    return evalExpressionFunc(p1).apply(data);
				} catch(e) {
					console.warn(e.message);
				}
				return '';
			});

			element.setAttribute(attr, newValue);
		}
	}

	function boolExpressionFunc(data, code) {
		data = new Proxy(data, staticReadOnly);
        return () => {
			try {
			    return Boolean(evalExpressionFunc(code).apply(data));
			} catch(e) {
				console.warn(e.message);
			}
			return false;
		}
	}
	
	function showExpressionFunc(data, code, element) {
	    const boolExpression =  boolExpressionFunc(data, code);
		return () => {
			if (boolExpression()) {
				if ('ng-hide' in element.classList) {
					element.classList.remove('ng-hide');
				} else if (element.style.display == 'none') {
                    element.classList.add('ng-show');
				}
			} else {
				if ('ng-show' in element.classList) {
					element.classList.remove('ng-show');
				} else if (element.style.display != 'none') {
                    element.classList.add('ng-hide');
				}
			}
		}
	}

	function hideExpressionFunc(data, code, element) {
	    const boolExpression =  boolExpressionFunc(data, code);
		return () => {
			if (boolExpression()) {
				if ('ng-show' in element.classList)
					element.classList.remove('ng-show');
				else if (element.style.display != 'none')
                    element.classList.add('ng-hide');
			} else {
				if ('ng-hide' in element.classList)
					element.classList.remove('ng-hide');
				else if (element.style.display == 'none')
                    element.classList.add('ng-show');
			}
		}
	}
	
	function disabledExpressionFunc(data, expression, element) {
	    const boolExpression =  boolExpressionFunc(data, expression);
		return () => {
			if (boolExpression())
			    element.setAttribute('disabled', '');
			else
				element.removeAttribute('disabled');
		}
	}

	function parseForArgumentsNames(expression) {
		let m = FOR_VAR_NAME_RX.exec(expression);
		if (m.length <= 1)
			return [];
		return [ m[1] ];
	}
	
	function childrenExpressionFunc(data, expression, element) {
		const args = parseForArgumentsNames(expression);
        const argsExprAarry = "[" + args.join() + "]";

		const fragment = [];
		for (const child of element.childNodes)
		    if (isTemplateNode(child))
			fragment.push(child.cloneNode(true));

		const forExpression = forExpressionFunc(expression, argsExprAarry);
		return () => {
			let inner = [];
			try {
				forExpression.apply(data, [function() {
					const context = {};
					for (const [index, val] of this.entries())
						context[args[index]] = val;
					for (const node of fragment) {
						const elementClone = node.cloneNode(true);
						subTemplate = new TinyAlTemplateNode(context, elementClone);
						subTemplate.merge(elementClone);
						inner.push(elementClone);
					}
				}]);
			} catch(e) {
				console.warn(e.message);
			}
			return inner;
		}
	}

	function optionsExpressionFunc(data, expression, element) {
		const baseElement = document.createElement('<option value="{{key}}">{{value}}</>');
		const expressionFunc = evalExpressionFunc(expression);
		return () => {
			let inner = '';
			try {
				const items = expressionFunc.apply(data);
				if (items instanceof Array) {
					for (const item of items) {
						const elementClone = baseElement.cloneNode(true);
						const context = new Map([['key', item], ['value', item]]);
						const subTemplate = new TinyAlTemplateNode(context, elementClone);
						subTemplate.merge(elementClone);
						inner += elementClone.innerHTML;
					}
				} else if (items instanceof Object) {
					for (const [key, val] of items) {
						const elementClone = baseElement.cloneNode(true);
						const context = new Map([['key', key], ['value', val]]);
						const subTemplate = new TinyAlTemplateNode(context, elementClone);
						subTemplate.merge(elementClone);
						inner += elementClone.innerHTML;
					}
				} else {
					const elementClone = baseElement.cloneNode(true);
					const strVal = items.toString();
					const context = new Map([['key', strVal], ['value', strVal]]);
					const subTemplate = new TinyAlTemplateNode(context, elementClone);
					subTemplate.merge(elementClone);
					inner = elementClone.innerHTML;
				}
			} catch(e) {
				console.warn(e.message);
			}
			return inner;
		}
	}

	function innerifExpressionFunc(data, expression, element) {
		const items = [];
		for (const child of element.childNodes) {
			if (isTemplateNode(child)) {
				const elementClone = child.cloneNode(true);
				items.push([elementClone, new TinyAlTemplateNode(data, elementClone)]);
			}
		}
	    const boolExpression =  boolExpressionFunc(data, expression);
		return () => {
			if (!boolExpression())
			    return '';
			let inner = '';
			for (const item of items) {
			    item[1].merge(item[0]);
				inner += item[0].innerHTML;
			}
			return inner;
		}
	}

	function parseInitDirective(json, obj) {
		try {
			const attrs = JSON.parse(json);
			Object.assign(obj, attrs);
		} catch(e) {
			console.warn('Can\'t parse init as json!');
		}
	}

	function parseFps(fps) {
		try {
			const value = parseInt(fps);
			if (value > 0)
				return Math.round(1000.0 / value);
		} catch(e) {
			console.warn('Can\'t parse fps as int!');
			return 0;
		}
	}

	function prepareAppAttributes(element, props) {
		if (element.nodeType != Node.ELEMENT_NODE)
		    return DEFAULT_RENDER_TIMEOUT;
		element.removeAttribute(DIRECTIVE_APP);
		if (element.hasAttribute(DIRECTIVE_INIT)) {
			parseInitDirective('{' + element.getAttribute(DIRECTIVE_INIT) + '}', props);
			element.removeAttribute(DIRECTIVE_INIT);
		}
		if (element.hasAttribute(DIRECTIVE_FPS)) {
			const renderTime = parseFps(element.getAttribute(DIRECTIVE_FPS));
			element.removeAttribute(DIRECTIVE_FPS);
			return renderTime;
		}

		return DEFAULT_RENDER_TIMEOUT;
	}
	
	const staticArrayMethods = new Set('pop', 'push', 'shift', 'unshift', 'splice', 'reverse', 'sort');

	class TinyAlChildArrayRenderer {
        #app = null;

		constructor(app) {
			this.#app = app;
		}

		set(arr, attr, value) {
            const result = Reflect.set(arr, attr, value);
			if (result && this.#app)
			    this.#app.render();
			return result;
		}

		get(arr, attr) {
            if (attr in staticArrayMethods) {
				return function() {
					const result = Reflect.get(arr, attr).apply(arr, arguments);
					if (this.#app)
						this.#app.render();
                    return result;
				}
			}

			const item = Reflect.get(arr, attr);
			if (item.constructor.name === 'Object')
				return new Proxy(item, new TinyAlChildObjectRenderer(this.#app))
			if (item.constructor.name === 'Array')
				return new Proxy(item, new TinyAlChildArrayRenderer(this.#app))
			return item;
		}
	}

	class TinyAlChildObjectRenderer {
        #app = null;

		constructor(app) {
			this.#app = app;
		}

		set(obj, attr, value) {
            const result = Reflect.set(obj, attr, value);
			if (result && this.#app)
			    this.#app.render();
			return result;
		}

		get(obj, attr) {
			const item = Reflect.get(obj, attr);
			if (item.constructor.name === 'Object')
				return new Proxy(item, new TinyAlChildObjectRenderer(this.#app))
			if (item.constructor.name === 'Array')
				return new Proxy(item, new TinyAlChildArrayRenderer(this.#app))
			return item;
		}
	}

	class TinyAlRenderer {
		set(app, attr, value) {
            const result = Reflect.set(app, attr, value);
			if (result)
			    app.render();
			return result;
		}

		get(app, attr) {
			const item = Reflect.get(app, attr);
			if (item.constructor.name === 'Object')
				return new Proxy(item, new TinyAlChildObjectRenderer(app))
			if (item.constructor.name === 'Array')
				return new Proxy(item, new TinyAlChildArrayRenderer(app))
			return item;
		}
	}
	
	class TinyAlReadOnlyProxy {
		set(app, attr, value) {
            console.warn('Can\'t write to read only object!');
		}
	}

	const staticRenderer = new TinyAlRenderer();
	const staticReadOnly = new TinyAlReadOnlyProxy();

	class TinyAlTemplateNode {
        #children = [];
		#template = null;
		#modifyers = [];
		#text = false;
		#nodeName = null;
		#object = null;

		#parseInnerHtmlDirective(directive, callback, element) {
			if (element.hasAttribute(directive)) {
				this.#template = callback(this.#object, element.getAttribute(directive), element);
				element.removeAttribute(directive);
				element.innerHTML = '';
				return true;
			}
			return false;
		}

		#parseTextAttributes(element) {
			for (const attr of element.attributes) {
				if (attr.specified && attr.name.startsWith('ng-') && BIND_RX.test(attr.value)) {
					this.#modifyers.push(textAttributeExpressionFunc(this.#object, attr.name.slice(3), attr.value, element));
					element.removeAttribute(attr.name);
				}
			}
		}

		constructor(obj, element) {
			if (!isTemplateNode(element))
			    return;
			if (element.nodeType == Node.TEXT_NODE) {
				this.#object = obj;
				this.#text = true;
				if (BIND_RX.test(element.nodeValue)) {
					this.#template = textExpressionFunc(this.#object, element.nodeValue);
					element.nodeValue = '';
				}
			} else if (element.nodeType == Node.DOCUMENT_FRAGMENT_NODE) {
				this.#object = obj;
				for (const child of element.childNodes)
					if (isTemplateNode(child))
						this.#children.push(new TinyAlTemplateNode(this.#object, child));
			} else {
				const subApp = element.hasAttribute(DIRECTIVE_APP);
				const subControl = element.hasAttribute(DIRECTIVE_CONTROLLER);
				if (subApp || subControl) {
					const appName = (subApp ? element.getAttribute(DIRECTIVE_APP) : element.getAttribute(DIRECTIVE_CONTROLLER));
					if (appName in obj)
						obj = obj[appName];
				}

				this.#object = obj;
				
			    this.#nodeName = element.name;

				const bindContext = (this.#object instanceof TinyAlApp ? new Proxy(this.#object, staticRenderer) : this.#object);
				bindEvents(bindContext, element);

				if (element.hasAttribute(DIRECTIVE_SHOW)) {
					this.#modifyers.push(showExpressionFunc(this.#object, element.getAttribute(DIRECTIVE_SHOW), element));
					element.removeAttribute(DIRECTIVE_SHOW);
				} else if (element.hasAttribute(DIRECTIVE_HIDE)) {
					this.#modifyers.push(hideExpressionFunc(this.#object, element.getAttribute(DIRECTIVE_HIDE), element));
					element.removeAttribute(DIRECTIVE_HIDE);
				}
				
				if (element.hasAttribute(DIRECTIVE_DISABLED)) {
					this.#modifyers.push(disabledExpressionFunc(this.#object, element.getAttribute(DIRECTIVE_DISABLED), element));
					element.removeAttribute(DIRECTIVE_DISABLED);
				}

				const input = (this.#nodeName == 'input');
				const select = (this.#nodeName == 'select');
				if (input || select) {
					if (element.hasAttribute(DIRECTIVE_MODEL)) {
						const path = element.getAttribute(DIRECTIVE_MODEL);
						const data = this.#object;
						element.removeAttribute(DIRECTIVE_MODEL);
						element.addEventListener('change', () => setProperty(data, path, element.value));
						this.#modifyers.push(() => {
							const val = getProperty(data, path);
							if (val != undefined)
								element.value = val;
						})
					}
				}

				do {
					if (input)
						break;
					if (select) {
						if (this.#parseInnerHtmlDirective(DIRECTIVE_OPTIONS, optionsExpressionFunc, element))
						    break;
					} else {
						if (this.#parseInnerHtmlDirective(DIRECTIVE_INNERIF, innerifExpressionFunc, element))
						    break;
						if (this.#parseInnerHtmlDirective(DIRECTIVE_BIND, textExpressionFunc, element))
						    break;
					}
					if (this.#parseInnerHtmlDirective(DIRECTIVE_CHILDREN, childrenExpressionFunc, element))
					    break;

					for (const child of element.childNodes)
						if (isTemplateNode(child))
							this.#children.push(new TinyAlTemplateNode(this.#object, child));
				} while (false);
				
				this.#parseTextAttributes(element);
			}
		}

		merge(element) {
            if (!isTemplateNode(element))
			    return;

			const text = this.#text && element.nodeType == Node.TEXT_NODE;
			const node = this.#nodeName == element.name && element.nodeType == Node.ELEMENT_NODE;
			if (text || node) {
				for (const mod of this.#modifyers)
					mod();
				
				if (this.#template != null) {
					const value = this.#template();
					if (Array.isArray(value)) {
						if (!text)
						    element.innerHTML = '';
						for (const el of value) {
							if (text)
								element.nodeValue += el.outerHTML;
							else if (node)
								element.appendChild(el);
						}
					} else {
						if (text)
							element.nodeValue = value;
						else if (node)
							element.innerHTML = value;
					}
				}
			}

			let pos = 0;
			for (const child of element.childNodes) {
				if (!isTemplateNode(child) || this.#children[pos] === undefined)
				    continue;
				this.#children[pos].merge(child);
				pos += 1;
			}
		}
	}
	
	class TinyAlApp {
        #element = null;
        #template = [];
		#lastRenderTime = 0;
		#renderTimeout = DEFAULT_RENDER_TIMEOUT;
		#renderQueue = false;
		#appId = '';

	    constructor(appId, element, props = null) {
			this.#appId = appId;
            this.#element = element;
			if (props != null)
			    Object.assign(this, props);
			this.#renderTimeout = prepareAppAttributes(this.#element, this);
			
			this.#template = new TinyAlTemplateNode(this, this.#element);

			const self = this;

			this.appId = function() {
				return self.#appId;
			}

			this.setRenderTimeout = function(timeout) {
				self.#renderTimeout = timeout;
			}

			this.element = function() {
				return self.#element;
			}

			this.template = function() {
				return self.#template;
			}

			this.render = function() {
				if (!self.#renderQueue) {
					const diff = Date.now() - self.#lastRenderTime;
					if (diff >= self.#renderTimeout) {
						window.requestAnimationFrame((msec) => {
							self.#lastRenderTime = msec;
							self.#template.merge(self.#element);
						});
					} else {
						self.#renderQueue = true;
						setTimeout(() => {
							self.#renderQueue = false;
							self.render();
						}, 1);
					}
				}
			}

			this.render();
		}
	}

	class TinyAl {
        #apps = new Map();

		#gnerateAppId() {
			let appId = null
			do {
				appId = uuidv4();
			} while(this.#apps.has(name));
			return appId;
		}

		#createWebComponent(obj, appId = null) {
			let tag = null;
			let render = '';
			let props = {};
			for (const [key, value] of Object.entries(obj)) {
				if ((key == 'style' || key == 's' || key == 'css') && value.length > 0)
					render += '<style>' + value + '</style>';
				else if (key == 'ng' || key == 'rend' || key == 'render' || key == 'r' || key == 'html' || key == 'content')
					render += value;
				else if (key == 'element' || key == 'el' || key == 'tag' || key == 't')
					tag = value;
				else
					props[key] = value;
			}
	
			if (tag != null) {
				let template = document.createElement('template');
				if (render.length > 0) {
					render += '<style>' + getStyles() + '</style>';
					template.innerHTML = render;
				}
				const creator = this;
				customElements.define(tag, class extends HTMLElement {
					#appId = null;

					appId() {
						return this.#appId;
					}
			
					connectedCallback() {
						const oldDisplay = this.style.display;
						this.style.display = 'none';
						const shadowRoot = this.attachShadow({mode: 'closed'});
						shadowRoot.innerHTML = template.innerHTML;
						this.#appId = creator.add(shadowRoot, null, props).appId();
						const app = creator.get(this.#appId);
			            app.setRenderTimeout(prepareAppAttributes(this, app));
						this.style.display = oldDisplay;
					}
			
					disconnectedCallback() {
						creator.remove(this.#appId);
					}
				});
				return null;
			}

			return add(document.createElement('div'), appId, false, props);
		}

		init() {
			addGlobalStyle();
			const apps = document.querySelectorAll('*:not([' + DIRECTIVE_APP + ']) *[' + DIRECTIVE_APP + '], *:not([' + DIRECTIVE_CONTROLLER + ']) *[' + DIRECTIVE_APP + ']');
			for (const app of apps)
				this.add(app);
		}

		find(appId) {
			return this.#apps[appId];
		}

		get(appId) {
			const apps = this.#apps[appId];
			if (apps.length <= 0)
			    return null;
			return apps[0];
		}

		remove(appId) {
			this.#apps.delete(appId);
		}

		add(template, appId = null, props = null) {
            if (template.constructor.name === 'Object')
			    return this.#createWebComponent(template, appId);

			if (!appId && template.nodeType == Node.ELEMENT_NODE)
				appId = template.getAttribute(DIRECTIVE_APP);
			if (!appId)
				appId = this.#gnerateAppId();

			const app = new Proxy(new TinyAlApp(appId, template, props), staticRenderer);

			if (this.#apps.has(appId)) {
			    this.#apps[appId].push(app);
			} else {
			    this.#apps[appId] = [app];
			}
			
			return app;
		}
	}

	const staticTinyAl = new TinyAl();

	if ('browser_module' in global) {
        global['browser_module'].export('tinyal', () => {
			return staticTinyAl;
		});
    } else {
        if ('tinyal' in global) {
            console.warn('Module "tinyal" is already exported! Ignore loading!');
		} else {
            global['tinyal'] = staticTinyAl;
		}
    }
})(this);
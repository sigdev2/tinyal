((global) => {
	const DIRECTIVE_INIT = 'ng-init';
	const DIRECTIVE_FPS = 'ng-fps';
	
	const DIRECTIVE_MODEL = 'ng-model';
	const DIRECTIVE_BIND = 'ng-bind';
	
	const DIRECTIVE_OPTIONS = 'ng-options';
	
	const DIRECTIVE_SHOW = 'ng-show';
	const DIRECTIVE_HIDE = 'ng-hide';
	const DIRECTIVE_DISABLED = 'ng-disabled';

	const DIRECTIVE_CHILDREN = 'ng-children';
	const DIRECTIVE_INNERIF = 'ng-innerif';

	const EVENTS_DIRECTIVES = ['ng-click', 'ng-dblclick', 'ng-change', 'ng-input', 'ng-focus', 'ng-keydown',
	                           'ng-contextmenu',
	                           'ng-keypress', 'ng-keyup', 'ng-mousedown', 'ng-mouseup', 'ng-mouseenter',
	                           'ng-mouseleave', 'ng-mousemove', 'ng-mouseover', 'ng-touchstart', 'ng-touchmove', 'ng-touchend'];

	const BIND_RX = /\{\{([^\}]*)\}\}/gm;
	const FOR_VAR_NAME_RX = /^\s*(?:[A-z0-9_]+\s+)?(\[(?:[A-z0-9_\.]+\,?\s*)+\]|[_A-z0-9\.]+)(?:\s+in|\s+of|\s*;|\s*=|\s*$)/gm;

	const DEFAULT_RENDER_TIMEOUT = 16; // 60 FPS

	function isObject(value) {
		const type = typeof value;
		return value != null && (type == 'object');
	}

	function isPlainObject(value) {
		return isObject(value) && value.constructor === Object;
	}

	function isFunction(value) {
		return typeof value === 'function';
	}

	function getrx(rx) {
		rx.lastIndex = 0;
		return rx;
	}

	function simpleDeepClone(obj, stack) {
		if (!isObject(obj))
		    return obj;

		let copy = new obj.constructor();

		stack || (stack = new Map);
		const stacked = stack.get(obj);
		if (stacked)
			return stacked;
		stack.set(obj, copy);

		if (obj.constructor === Set) {
			obj.forEach((subValue) => {
				copy.add(simpleDeepClone(subValue, stack));
			});
		} else if (obj.constructor === Map) {
			obj.forEach((subValue, key) => {
				copy.set(key, simpleDeepClone(subValue, stack));
			});
		} else if (Array.isArray(obj)) {
			obj.forEach((subValue) => {
				copy.push(simpleDeepClone(subValue, stack));
			});
		} else if (obj.constructor === Object) {
			Object.setPrototypeOf(copy, simpleDeepClone(Object.getPrototypeOf(obj)));
			for (const key in obj)
				if (obj.hasOwnProperty(key))
					copy[key] = simpleDeepClone(obj[key], stack);
		} else {
			return obj;
		}
	  
		return copy;
	  }

	function getStyles() {
        return '.ng-hide { display: none !important; } .ng-show { display: initial !important; }';
	}

	function bindEvents(data, element) {
        for (const eventAttr of EVENTS_DIRECTIVES) {
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

	function isEmptyNodeValue(element) {
		return element.nodeValue.replace(/\u00a0/g, '_').trim().length == 0;
	}

	function isNotEmptyTextNode(element) {
        return element.nodeType == Node.TEXT_NODE && !isEmptyNodeValue(element);
	}

	function isEmptyTextNode(element) {
        return element.nodeType == Node.TEXT_NODE && isEmptyNodeValue(element);
	}

	function isTemplateNode(element) {
		return isNotEmptyTextNode(element) ||
		       element.nodeType == Node.ELEMENT_NODE ||
			   element.nodeType == Node.DOCUMENT_FRAGMENT_NODE;
	}

	function isNodeForMerge(element) {
		return element.nodeType == Node.TEXT_NODE ||
		       element.nodeType == Node.ELEMENT_NODE ||
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
			return template.replaceAll(getrx(BIND_RX), (match, p1) => {
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
			const newValue = value.replaceAll(getrx(BIND_RX), (match, p1) => {
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
				if (element.classList.contains('ng-hide')) {
					element.classList.remove('ng-hide');
				} else if (element.style.display == 'none') {
                    element.classList.add('ng-show');
				}
			} else {
				if (element.classList.contains('ng-show')) {
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
				if (element.classList.contains('ng-show'))
					element.classList.remove('ng-show');
				else if (element.style.display != 'none')
                    element.classList.add('ng-hide');
			} else {
				if (element.classList.contains('ng-hide'))
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
		let m = getrx(FOR_VAR_NAME_RX).exec(expression);
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

	class TinyAlRenderer {
		#target = null;

		#targetRender(app) {
			if (this.#target !== null)
				this.#target.render();
			else
				app.render();
		}

		constructor(target) {
			if (target)
				this.#target = target;
		}

		set(app, attr, value) {
			const oldvalue = Reflect.get(app, attr);
			if (oldvalue == value)
			    return true;
            const result = Reflect.set(app, attr, value);
			if (result)
			    this.#targetRender(app);
			return result;
		}

		get(app, attr) {
			const value = Reflect.get(app, attr);
			if (!value)
			    return value;

			const self = this;
            if (isFunction(value)) {
				return function() {
					const result = value.apply(app, arguments);
					if (isObject(result) && isFunction(result.then)) {
						return new Promise(function (resolve) {
							result.then(function () {
								resolve(...arguments);
								self.#targetRender(app);
							});
						});
					}

					self.#targetRender(app);
					return result;
				}
			}

			if (isObject(item))
				return new Proxy(item, new TinyAlRenderer(app));
			return item;
		}
	}

	class TinyAlReadOnlyProxy {
		get(app, attr) {
			if (attr == 'render' || attr == 'setState' || attr == 'getState')
                console.error('Can\'t rendering in template!');
			return Reflect.get(app, attr);
		}
	}

	const staticRenderer = new TinyAlRenderer();
	const staticReadOnly = new TinyAlReadOnlyProxy();
	const nullPrototype = Object.getPrototypeOf({});

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
				if (attr.specified && attr.name.startsWith('ng-') && getrx(BIND_RX).test(attr.value)) {
					this.#modifyers.push(textAttributeExpressionFunc(this.#object, attr.name.slice(3), attr.value, element));
					element.removeAttribute(attr.name);
				}
			}
		}

		constructor(obj, element) {
			this.#object = obj;
			if (element.nodeType == Node.TEXT_NODE) {
				this.#text = true;
				if (getrx(BIND_RX).test(element.nodeValue)) {
					this.#template = textExpressionFunc(this.#object, element.nodeValue);
					element.nodeValue = '';
				}
			} else if (element.nodeType == Node.DOCUMENT_FRAGMENT_NODE) {
				for (const child of element.childNodes)
					if (isTemplateNode(child))
						this.#children.push(new TinyAlTemplateNode(this.#object, child));
			} else {
			    this.#nodeName = element.name;

				bindEvents(this.#object, element);

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
            if (!isNodeForMerge(element))
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
				if (!isNodeForMerge(child))
				    continue;
				const template = this.#children[pos];
				if (template === undefined)
				    continue;

				if (isEmptyTextNode(child) && !template.#text)
				    continue;

				template.merge(child);
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

	    constructor(element, fps) {
            this.#element = element;
			this.#renderTimeout = fps;
			
			const self = this;


			this.setRenderTimeout = function(timeout) {
				self.#renderTimeout = timeout;
			}

			this.element = function() {
				return self.#element;
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

			this.setState = function() {
				if (isPlainObject(self.state)) {
					if (arguments.length == 1) {
					    if (isPlainObject(arguments[0]))
						    Object.assign(self.state, arguments[0]);
					} else if (arguments.length == 2) {
						self.state[arguments[0]] = arguments[1];
					}
				} else {
					if (arguments.length == 1) {
						self.state = arguments[0];
					} else if (arguments.length == 2) {
						const key = arguments[0];
						self.state = { key : arguments[1] };
					}
				}
				self.render();
			}
			
			this.getState = function() {
				return new Proxy(self, staticRenderer);
			}
			
			this.#template = new TinyAlTemplateNode(this, this.#element);
		}
	}

	class TinyAl {
        #props = new Map();

		#add(tag, config, cloned) {
			if (!tag) {
				console.error('Component register error: tag is not specified!');
			    return;
			}

			tag = tag.toLowerCase();

			if (!tag.includes('-')) {
				console.error('Component register error: tag name "' + tag + '" is not valid!');
			    return;
			}

			if (this.#props.has(tag) || customElements.get(tag) !== undefined) {
				console.error('Component register error: tag "' + tag + '" already registred!');
			    return;
			}

            if (!isPlainObject(config)) {
				console.error('Component register error: for tag "' + tag + '" config is not object!');
			    return;
			}

			let source = (cloned ? config : simpleDeepClone(config));
			if (!Object.isFrozen(source))
			    Object.freeze(source);
			this.#props.set(tag, source);

			let render = '';
			let style = '';
			let props = {};
			let init = function() {};
			let fps = DEFAULT_RENDER_TIMEOUT;
			for (const [key, value] of Object.entries(source)) {
				if ((key == 'style' || key == 's' || key == 'css') && !!value)
				    style = value;
				else if (key == 'ng' || key == 'rend' || key == 'render' || key == 'r' || key == 'html' || key == 'content')
					render = value;
				else if (key == 'init' || key == 'create' || key == 'construct' && typeof value === 'function')
				    init = value;
				else if (key == 'fps' && typeof value === 'number')
				    fps = value;
				else
					props[key] = simpleDeepClone(value);
			}

			let template = document.createElement('template');
			const hasContent = !!render;
			if (hasContent || !!style)
				template.innerHTML = '<style>' + (hasContent ? getStyles() : '') + style + '</style>' + render;

			const creator = this;
			customElements.define(tag, class extends HTMLElement {
				#app = null;

				app() {
					return this.#app;
				}
		
				connectedCallback() {
					const oldDisplay = this.style.display;
					this.style.display = 'none';

					const shadowRoot = this.attachShadow({mode: 'closed'});
					shadowRoot.innerHTML = template.innerHTML;

					this.#app = new TinyAlApp(shadowRoot, fps);
					Object.setPrototypeOf(this.#app, props);
					init.apply(this.#app);
	
					if (this.hasAttribute(DIRECTIVE_INIT)) {
						const code = this.getAttribute(DIRECTIVE_INIT);
						this.removeAttribute(DIRECTIVE_INIT);
						try {
							evalExpressionFunc(code).apply(this.#app);
						} catch(e) {
							console.warn(e.message);
						}
					}

					if (this.hasAttribute(DIRECTIVE_FPS)) {
						const renderTime = parseFps(this.getAttribute(DIRECTIVE_FPS));
						this.removeAttribute(DIRECTIVE_FPS);
						this.#app.setRenderTimeout(renderTime);
					}

					this.#app.render();

					this.style.display = oldDisplay;
				}
		
				disconnectedCallback() {
					this.#app = null;
				}
			});
		}
		
		add(tag, config) {
			this.#add(tag, config, false);
		}

		extends(tag, parent, config = null) {
			if (config !== undefined && config !== null && !isPlainObject(config)) {
				console.error('Component register error: for tag "' + tag + '" config is not object!');
				return;
			}

			if (!isPlainObject(parent)) {
				if (!parent) {
					console.error('Component register error: tag "' + tag + '" can\'t extends not specified parent tag!');
					return;
				}

				parent = parent.toLowerCase();
				
				if (!this.#props.has(parent)) {
					console.error('Component register error: tag "' + tag + '" can\'t extends not registred in tinyal parent tag "' + parent + '"!');
					return;
				}

				parent = this.#props.get(parent);
			}

			if (config === null || config === undefined) {
				this.#add(tag, parent, true);
				return;
			}

			const actual = simpleDeepClone(config);
			let proto = actual;
            while (proto != nullPrototype)
				proto = Object.getPrototypeOf(proto);
			Object.setPrototypeOf(proto, parent);

            this.add(tag, actual, true);
		}
	}

	const staticTinyAl = new TinyAl();

	if ('browser_module' in global) {
        global['browser_module'].export('tinyal', () => {
			return staticTinyAl;
		});
    } else {
        if ('tinyal' in global)
            console.warn('Module "tinyal" is already exported! Ignore loading!');
		else
            global['tinyal'] = staticTinyAl;
    }
})(this);
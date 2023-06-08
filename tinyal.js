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

	const DIRECTIVE_CHILDREN = 'ng-children';
	const DIRECTIVE_INNERIF = 'ng-innerif';

	const events = [DIRECTIVE_CLICK, DIRECTIVE_DBLCHANGE, DIRECTIVE_CHANGE, DIRECTIVE_FOCUS, DIRECTIVE_KEYDOWN,
		DIRECTIVE_KEYPRESS, DIRECTIVE_KEYUP, DIRECTIVE_MOUSEDOWN, DIRECTIVE_MOUSEUP, DIRECTIVE_MOUSEENTER,
		DIRECTIVE_MOUSELEAVE, DIRECTIVE_MOUSEMOVE, DIRECTIVE_MOUSEOVER];

	const BIND_RX = /\{\{([^\}]*)\}\}/gm;
	const FOR_VAR_NAME_RX = /^\s*(?:[A-z0-9_]+\s+)?(\[(?:[A-z0-9_\.]+\,?\s*)+\]|[_A-z0-9\.]+)(?:\s+in|\s+of|\s*;|\s*=|\s*$)/gm;

	function bindEvents(data, element) {
        for (const eventAttr of events) {
			if (element.hasAttribute(eventAttr)) {
				const code = element.getAttribute(eventAttr);
				element.removeAttribute(eventAttr);
				const eventName = eventAttr.replace('ng-', '');
				element.addEventListener(eventName, () => {
					try {
						const ret = evalExpressionFunc(code).apply(data);
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
        const chain = path.splut('.');
		for (const [index, part] of chain) {
			if (!(part in obj))
			    return undefined;
			obj = obj[part];
		}

		return obj;
	}
	
	function setProperty(obj, path, value) {
        const chain = path.splut('.');
		for (const [index, part] of chain) {
			if (part in obj)
			    obj = obj[part];
			else
			    obj[part] = (chain.length - 1 == index ? value : {});
		}
	}

	function isTemplateNode(element) {
		return element.nodeType == Node.TEXT_NODE || (element.nodeType == Node.ELEMENT_NODE && element.name != 'br');
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
			    element.classList.remove('ng-hide');
                element.classList.add('ng-show');
			} else {
			    element.classList.remove('ng-show');
                element.classList.add('ng-hide');
			}
		}
	}

	function hideExpressionFunc(data, code, element) {
	    const boolExpression =  boolExpressionFunc(data, code);
		return () => {
			if (boolExpression()) {
			    element.classList.remove('ng-show');
                element.classList.add('ng-hide');
			} else {
			    element.classList.remove('ng-hide');
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
		const match = FOR_VAR_NAME_RX.match(expression);
		if (match.length <= 1)
		    return '[]';
		return '[' + match[1] + ']';
	}

	function parseForArgumentsValues(expression) {
		try {
		    return JSON.parse(expression);
		} catch(e) {
			console.warn('Can\'t parse for expression args!');
		}
		return [];
	}
	
	function childrenExpressionFunc(data, expression, element) {
        let itemNames = parseForArgumentsNames(expression);
		let args = parseForArgumentsValues(itemNames);

		const items = [];
		for (const child of element.childNodes)
		    items.push(child.cloneNode(true));

		const forExpression = forExpressionFunc(expression);
		return () => {
			let inner = '';
			try {
				forExpression.apply(data, itemNames, [() => {
					const context = new Map();
					for (const [index, val] of this)
						context[args[index]] = val;
					for (const item of items) {
						const elementClone = item.cloneNode(true);
						const subTemplate = new TinyAlTemplateNode(context, elementClone);
						subTemplate.merge(elementClone);
						inner += elementClone.innerHTML;
					}
				}]);
			} catch(e) {
				console.warn(e.message);
			}
			return inner;
		}
	}

	function optionsExpressionFunc(data, expression, element) {
		let baseElement = document.createElement('<option value="{{key}}">{{value}}</>');
		const expressionFunc = evalExpressionFunc(expression);
		return () => {
			let inner = '';
			try {
				let items = expressionFunc.apply(data);
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
			const elementClone = child.cloneNode(true);
			items.push([elementClone, new TinyAlTemplateNode(data, elementClone)]);
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
			let attrs = JSON.parse(json);
			for (const [attr, val] of Object.entries(attrs))
			    obj[attr] = val;
		} catch(e) {
			console.warn('Can\'t parse init as json!');
		}
	}

	class TinyAlRenderer {
		set(app, attr, value) {
            app[attr] = value;
			app.render();
		}
	}
	
	class TinyAlReadOnlyProxy {
		set(app, attr, value) {
            console.warn('Can\'t write to read only object!');
		}
	}

	let staticRenderer = new TinyAlRenderer();
	let staticReadOnly = new TinyAlReadOnlyProxy();

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
				
				for (const attr of element.attributes)
					if (attr.specified && attr.name.startsWith('ng-') && BIND_RX.test(attr.value))
						this.#modifyers.push(textAttributeExpressionFunc(this.#object, attr.name, attr.value, element));

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

				let input = (this.#nodeName == 'input');
				let select = (this.#nodeName == 'select');
				if (input || select) {
					if (element.hasAttribute(DIRECTIVE_MODEL)) {
						let path = element.getAttribute(DIRECTIVE_MODEL);
						let data = this.#object;
						element.removeAttribute(DIRECTIVE_MODEL);
						element.addEventListener('change', () => setProperty(data, path, element.value));
						this.#modifyers.push(() => {
							let val = getProperty(data, path);
							if (val != undefined)
								element.value = val;
						})
					}

					if (input)
						return;
				}

				if (select) {
					if (this.#parseInnerHtmlDirective(DIRECTIVE_OPTIONS, optionsExpressionFunc, element))
					    return;
				} else {
					if (this.#parseInnerHtmlDirective(DIRECTIVE_INNERIF, innerifExpressionFunc, element))
						return;
					if (this.#parseInnerHtmlDirective(DIRECTIVE_BIND, textExpressionFunc, element))
						return;
				}
				if (this.#parseInnerHtmlDirective(DIRECTIVE_CHILDREN, childrenExpressionFunc, element))
					return;

				for (const child of element.childNodes)
					if (isTemplateNode(child))
						this.#children.push(new TinyAlTemplateNode(this.#object, child));
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
					if (text)
						element.nodeValue = this.#template();
					else if (node)
						element.innerHTML = this.#template();
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
		#renderTime = 0;
		#renderQueue = false;

		#parseFps(fps) {
			try {
				let value = parseInt(fps);
				if (value > 0)
				    this.#renderTime = Math.round(1000.0 / value);
		    } catch(e) {
				console.warn('Can\'t parse fps as int!');
			}
		}

	    constructor(element) {
            this.#element = element;
            this.#element.removeAttribute(DIRECTIVE_APP);
			if (this.#element.hasAttribute(DIRECTIVE_INIT)) {
				parseInitDirective('{' + this.#element.getAttribute(DIRECTIVE_INIT) + '}', this);
				this.#element.removeAttribute(DIRECTIVE_INIT);
			}
			if (this.#element.hasAttribute(DIRECTIVE_FPS)) {
				this.#parseFps(this.#element.getAttribute(DIRECTIVE_FPS));
				this.#element.removeAttribute(DIRECTIVE_FPS);
			}
			
			this.#template = new TinyAlTemplateNode(this, this.#element);
			this.render();
		}

		element() {
			return this.#element;
		}

		template() {
			return this.#template;
		}

		render() {
			if (!this.#renderQueue) {
				let diff = Date.now() - this.#lastRenderTime;
				if (diff >= this.#renderTime) {
					window.requestAnimationFrame((msec) => {
						this.#lastRenderTime = msec;
						this.#template.merge(this.#element);
					});
				} else {
                    this.#renderQueue = true;
					setTimeout(() => {
						this.#renderQueue = false;
                        this.render();
					});
				}
		    }
		}
	}

	
	class TinyAlAppProxy extends TinyAlApp {
		constructor(element) {
			super(element);
			return new Proxy(this, staticRenderer);
		}
	}

	class TinyAl {
        #apps = new Map();

        constructor() { }

		init() {
			let apps = document.querySelectorAll('*:not([' + DIRECTIVE_APP + ']) *[' + DIRECTIVE_APP + '], *:not([' + DIRECTIVE_CONTROLLER + ']) *[' + DIRECTIVE_APP + ']');
			for (const app of apps)
				this.add(app);
		}

		find(appId) {
			return this.#apps[appId];
		}

		add(template, appId = null) {
			if (!appId) {
				let name = template.getAttribute(DIRECTIVE_APP);
				if (!name)
					do {
						name = uuidv4();
					} while(this.#apps.has(name));
				appId = name;
			}

			let app = new TinyAlAppProxy(template);
			template.style.display = null;

			if (this.#apps.has(appId)) {
			    this.#apps[appId].push(app);
			} else {
			    this.#apps[appId] = [app];
			}
			
			return app;
		}
	}

	let staticTinyAl = new TinyAl();

	function addGlobalStyle() {
        var css = '.ng-hide { display: none; } .ng-show { display: initial; }',
			head = document.head || document.getElementsByTagName('head')[0],
			style = document.createElement('style');

		head.appendChild(style);
		style.appendChild(document.createTextNode(css));
	}

	if ('browser_module' in global) {
        global['browser_module'].export('tinyal', () => {
			addGlobalStyle();
			return staticTinyAl;
		});
    } else {
        if ('tinyal' in global) {
            console.warn('Module "tinyal" is already exported! Ignore loading!');
		} else {
			addGlobalStyle();
            global['tinyal'] = staticTinyAl;
		}
    }
})(this);
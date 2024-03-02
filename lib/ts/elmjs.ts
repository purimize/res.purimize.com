declare global {
	interface ExportedElementMap {[key:string]:HTMLElement}

	interface Element {
		exportedElements:ExportedElementMap;
		getExportedElement<ElementType=Element>(id:string):ElementType|null;
	}

	interface DocumentFragment {
		exportedElements:ExportedElementMap;
		getExportedElement<ElementType=Element>(id:string):ElementType|null;
	}

	interface EventTarget {
		on<EventType extends Event=Event>(event:string, callback:EventBusEventListener<EventType>):symbol;
		off(symbol:symbol):void;
		off(event:string, callback:{(e:Event):void}):void;
		off(arg1:symbol|string, arg2?:{(e:Event):void}|undefined):void;
		emit(event:string, data?:{[key:string]:any}, bubbles?:boolean):void;
	}
}

{
	const Ref:WeakMap<Element, ExportedElementMap> = new WeakMap;

	Object.defineProperty(Element.prototype, 'exportedElements', {
		configurable: true, enumerable:false,
		get: function():ExportedElementMap {
			let ref = Ref.get(this);
			if ( !ref ) {
				Ref.set(this, ref={});
			}
			
			return ref;
		}
	});
	
	Object.defineProperty(Element.prototype, 'getExportedElement', {
		configurable:true, enumerable:false, writable:true,
		value: function<ElementType=Element>(id:string):ElementType|null {
			const element = this.exportedElements[id];
			return element ? (element as ElementType) : null;
		}
	});

	Object.defineProperty(DocumentFragment.prototype, 'exportedElements', {
		configurable: true, enumerable:false,
		get: function():ExportedElementMap {
			let ref = Ref.get(this);
			if ( !ref ) {
				Ref.set(this, ref={});
			}
			
			return ref;
		}
	});
	
	Object.defineProperty(DocumentFragment.prototype, 'getExportedElement', {
		configurable:true, enumerable:false, writable:true,
		value: function<ElementType=Element>(id:string):ElementType|null {
			const element = this.exportedElements[id];
			return element ? (element as ElementType) : null;
		}
	});
}

{
	Object.defineProperties(EventTarget.prototype, {
		on: {
			configurable:true, enumerable:false, writable:true,
			value: function(event:string, callback:EventBusEventListener):symbol {
				const handler_symbol = Symbol(handler_count++);
				HandlerRef.set(handler_symbol, {event, func:callback});
				
				this.addEventListener(event, callback);
				return handler_symbol;
			}
		},
		off: {
			configurable:true, enumerable:false, writable:true,
			value: function(arg1:symbol|string, arg2?:{(e:Event):void}|undefined):void {
				if ( typeof arg1 === "string" ) {
					this.removeEventListener(arg1, arg2!);
					return;
				}
				
				const ref = HandlerRef.get(arg1);
				if ( !ref ) return;
		
				HandlerRef.delete(arg1);
				this.removeEventListener(ref.event, ref.func);
			}
		},
		emit: {
			configurable:true, enumerable:false, writable:true,
			value: function(event:string, data?:{[key:string]:any}, bubbles:boolean=true):void {
				this.dispatchEvent(Object.assign(new Event(event, {bubbles}), data||{}))
			}
		}
	});
}






export interface EventBusEventListener<EventType extends Event = Event> {(e:EventType):void}


let handler_count:number = 0;
const HandlerRef:Map<Symbol, {event:string; func:EventBusEventListener<any>}> = new Map();
const ModuleRef:WeakMap<any, {template:string|null}> = new WeakMap();
export class HTMLModule extends HTMLElement {
	#init:boolean = false;
	#template:DocumentFragment|null = null;

	constructor() {
		super();
		const {template} = ModuleRef.get(this.constructor)||{};
		if ( template ) {
			const temp_elm = document.createElement('template');
			temp_elm.innerHTML = template;
			this.#template = temp_elm.content;
		}
	}
	
	get template() {
		return this.#template;
	}
	
	connectedCallback() {
		if ( !this.#init ) {
			this.init();
			this.#init = true;
		}
		this.mounted();
	}
	adoptedCallback() { this.remounted(); }
	disconnectedCallback() { this.unmounted(); }
	attributeChangedCallback(attr:string, prev:string, curr:string) {
		this.propchanged(attr, prev, curr);
	}

	
	init() {

	}
	mounted() {

	}
	remounted() {
		
	}
	unmounted() {

	}
	propchanged(attr:string, prev:string, curr:string) {

	}
}

interface RegisterOptions { tagName:string; tmpl?:string; };
export class ElmJS {
	static get HTMLModule() { return HTMLModule }
	
	static createElement<ElementType extends Element=Element>(html:string, resolve_exports:boolean=true):ElementType|null {
		const template = document.createElement('template');
		template.innerHTML = html.trim();
		if ( template.content.children.length > 1 ) {
			throw new RangeError("Given html string must contains only one element!");
		}

		const element = template.content.children[0] as ElementType;
		if ( !element ) return null;

		template.content.removeChild(element);

		// @ts-ignore
		return resolve_exports ? element : ElmResolve(element);
	}
	static createElements(html:string, resolve_exports:boolean=true):DocumentFragment {
		const template = document.createElement('template');
		template.innerHTML = html.trim();
		return resolve_exports ? template.content : this.resolveExports(template.content);
	}
	static createElementsAtAnchor(anchor_selector:string, html:string, options:{resolveExports?:boolean, keepAnchor?:boolean}={}):void {
		const resolve_exports = options.resolveExports === undefined ? true : !!options.resolveExports;
		const keep_anchor = options.keepAnchor === undefined ? false : !!options.keepAnchor;


		const anchor = document.querySelector(anchor_selector)!;
		const fragment = this.createElements(html, resolve_exports);

		
		let looper = anchor;
		for(const frag of Array.prototype.slice.call(fragment.children)) {
			looper.insertAdjacentElement('afterend', frag as HTMLElement);
			looper = frag;
		}
	
		if ( !keep_anchor ) {
			anchor.remove();
		}
	}

	static resolveExports<ElementType extends Element=Element>(root_element:ElementType):ElementType;
	static resolveExports(root_element:DocumentFragment):DocumentFragment;
	static resolveExports(root_element:Element|DocumentFragment):Element|DocumentFragment {
		if ( !(root_element instanceof Element) && !(root_element instanceof DocumentFragment) ) {
			throw new TypeError("Given argument must be an Element or a DocumentFragment or an Element array");
		}
	
		Object.keys(root_element.exportedElements).forEach((key)=>delete root_element.exportedElements[key]);
		RecursiveParseRelations(root_element, root_element.exportedElements);
	
		return root_element;
	}

	static registerModule(class_inst:typeof HTMLModule, options:RegisterOptions&ElementDefinitionOptions):typeof HTMLModule {
		const extended = (typeof options.extends === "undefined") ? {extends:options.extends} : undefined;
		ModuleRef.set(class_inst, {template:options.tmpl||null});
		window.customElements.define(options.tagName, class_inst, extended);

		return class_inst;
	}
}




function RecursiveParseRelations(root:Element|DocumentFragment, root_map:ExportedElementMap):void {
	for(const element of root.children) {
		const export_name = (element.getAttribute('elm-export')||'').trim();
		const var_name = (element.getAttribute('elm-var')||'').trim();

		if ( export_name ) root_map[export_name] = element as HTMLElement;
		if ( var_name ) root.exportedElements[var_name] = element as HTMLElement;
	}

	for(const element of root.children) {
		const is_root = element.hasAttribute('elm-root');

		if ( !is_root ) {
			RecursiveParseRelations(element, root_map)
		}
		else {
			Object.keys(element.exportedElements).forEach((key)=>delete element.exportedElements[key]);
			RecursiveParseRelations(element, element.exportedElements);
		}
	}
}

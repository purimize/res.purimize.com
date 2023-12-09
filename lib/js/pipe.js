/**
 * Created by JCloudYu on 5/10/16.
 */
(function() {
	var
	__prevPipe = window.pipe,
	__pipeInst = window.pipe = function( dependencies, passive ) {
		if ( !Array.isArray( dependencies ) ) return false;
		
		var __chainHead = ___CREATE_PIPE( dependencies, !passive );
		__chainHead.pipe = ___CREATE_PIPE_CHAIN( __chainHead );
		return __chainHead;
	};
	
	
	
	// INFO: Extensions
	(function(){
		__pipeInst.passive		= function( dependencies ){
			return __pipeInst( dependencies, true );
		};
		__pipeInst.loadResource = function( resList, immediate ){
			return ___RESOURCE_FETCHER( resList, arguments.length > 1 ? !!immediate : true );
		};
	})();
	(function(){
		var __compBasePath = './components';
	
		__pipeInst.components	= function( components ){
	
			if ( !Array.isArray( components ) ) return false;

			var __promiseGenerator, __promise = Promise.resolve(), __promises = [];
			components.forEach(function( item ){

				var purge = false, async = true, args = [];

				if ( typeof item === "string" )
					args.push( item );
				else
				{
					async = item.hasOwnProperty('async') ? !!item.async : async;
					purge = item.hasOwnProperty('remove-anchor') ? !!item[ 'remove-anchor' ] : purge;
					args.push( item.name, item.basePath || __compBasePath, item.anchor );
				}


				__promiseGenerator = (function( args, anchor, purge ){ return function(){
					return ___LOAD_COMPONENT.apply( null, args ).then(function(){
						if ( !purge || !anchor || anchor == "" ) return;
						
						$( anchor ).remove();
					});
				};})( args, item.anchor, purge );
				
				
				if ( !async )
					__promise = __promise.then(__promiseGenerator);
				else
					__promises.push(__promiseGenerator);
			});

			return __promise.then(function(){
				var promiseQueue = [];
				__promises.forEach(function(doPromise){ promiseQueue.push( doPromise() ); });
				return Promise.all( promiseQueue );
			});
		};
		__pipeInst.components.base_path = function( path ){
			__compBasePath = path || './components';
		};
	})();
	
	

	// INFO: Kernel APIs
	function ___LOAD_COMPONENT( componentName, basePath, anchor ) {

		basePath = basePath || './components';
		anchor	 = anchor || null;

		return new Promise(function( fulfill, reject ){

			var
			modulePath = basePath + '/' + componentName + '/';

			$.getJSON( modulePath + 'component.json?' + (((new Date()).getTime() / 1000) | 0), function( descriptor ) {
				var trigger, promiseGenerator,
				scripts = [], styles = [],
				comps	 = descriptor[ 'components' ] || [],
				basePromise = (new Promise(function(fulfill){ trigger = fulfill; })),
				earlyPool = [], laterPool = [];



				comps.forEach(function( comp ) {
					var fPath,
					async	= (comp.hasOwnProperty('async') ? !!comp.async : true),
					caching = comp.hasOwnProperty( 'cache' ) ? !!comp.cache : true,
					targetAnchor = !!comp.anchor ? comp.anchor : anchor;
					
					
					// Load view
					comp.view = comp.html || comp.view;
					if ( comp.view ) {
						
						promiseGenerator = (function( fPath, anchor, cache ){
							return function() {
								return new Promise(function(complete, failure) {
									var
									target	 = $( anchor || 'body' ),
									targetOp = anchor ? target.before : target.prepend;
								
									$.get( fPath + ( cache ? '' : '?' + (((new Date()).getTime() / 1000) | 0) ), function( htmlText ){
										$( htmlText ).each(function(idx, tag){ targetOp.call( target, tag ); });
		
										complete();
									}, 'text').fail(failure);
								});
							}
						})( modulePath + comp.view, targetAnchor, caching );
					
						if ( !async )
							basePromise = basePromise.then(promiseGenerator);
						else
							earlyPool.push(promiseGenerator);
					}
					
					
					
					// Load css
					comp.style = comp.css || comp.style;
					if ( comp.style ) {
						fPath = modulePath + comp.style + ( caching ? '' : '?' + (((new Date()).getTime() / 1000) | 0) );
						if ( $.inArray( fPath, styles ) < 0 )
						{
							promiseGenerator = (function( fPath, anchor ){
								return function(){ return ___LOAD_RESOURCE( fPath, 'css', anchor ); };
							})( fPath, targetAnchor );
							styles.push( fPath );
							
							if ( !async )
								basePromise = basePromise.then(promiseGenerator);
							else
								earlyPool.push(promiseGenerator);
						}
					}



					// Load js
					comp.script = comp.js || comp.script;
					if ( comp.script ) {
					
						if ( !comp.modulize )
						{
							fPath = modulePath + comp.script + ( caching ? '' : '?' + (((new Date()).getTime() / 1000) | 0) );
							if ( $.inArray( fPath, scripts ) < 0 )
							{
								promiseGenerator = (function( fPath, anchor ){
									return function(){ return ___LOAD_RESOURCE( fPath, 'js', anchor, true, !!comp.important ); };
								})( fPath, targetAnchor );
								
								scripts.push( fPath );
							}
						}
						else
						{
							promiseGenerator = (function( fPath, cache ){
								return function(){ return ___LOAD_MODULE( fPath + ( cache ? '' : '?' + (((new Date()).getTime() / 1000) | 0) ), null, !!comp.important ); }
							})( modulePath + comp.script, caching );
						}
						
						
						if ( !async )
							basePromise = basePromise.then(promiseGenerator);
						else
							laterPool.push(promiseGenerator);
					}
				});
				
				if ( earlyPool.length == 0 ) earlyPool.push(function(){ return Promise.resolve(); });
				if ( laterPool.length == 0 ) laterPool.push(function(){ return Promise.resolve(); });


				basePromise.then(function(){
					var promises = [];
					earlyPool.forEach(function(initiator){ promises.push( initiator() ); });
					return Promise.all(promises);
				})
				.then(function(){
					var promises = [];
					laterPool.forEach(function(initiator){ promises.push( initiator() ); });
					return Promise.all(promises);
				}).then( fulfill ).catch( reject );
				
				// Start promise chain
				trigger();
			}).fail( reject );
		});
	}
	function ___LOAD_RESOURCE( src, type, anchor, late , important) {
		var args = Array.prototype.slice.call( arguments );
	
		return new Promise(function( fulfill, reject ) {
			var tag, target,
			ajax = false,
			required = (args.length > 4 ? !!important : true);

			switch ( type )
			{
				case "css":
					if ( !!__pipeInst.__CSS_USE_SPECIAL_TREATMENT )
						ajax = true;
					else
					{
						tag = document.createElement( 'link' );
						tag.rel = "stylesheet";
						tag.type = "text/css";
						tag.href = src;
					}
					break;

				case "js":
					tag = document.createElement( 'script' );
					tag.type = "application/javascript";
					tag.src = src;
					break;

				case "html":
					ajax = true;
					break;
				
				case "img":
					anchor = false;
					tag = new Image();
					tag.src = src;
					tag.onload  = fulfill;
					tag.onerror = processErr;
					return;

				default:
					return null;
			}


			
			if ( anchor ) anchor = $(anchor);
			if ( anchor && anchor.length > 0 )
			{
				anchor	 = anchor[0];
				target	 = anchor.parentElement;
			}
			else
			{
				anchor	 = null;
				target	 = $( type == "css" ? 'head' : 'body' )[0];
			}



			if ( !ajax )
			{
				tag.onload  = fulfill;
				tag.onerror = processErr;
	
				if ( late )
					setTimeout(function(){ target.insertBefore( tag, anchor ); }, 0);
				else
					target.insertBefore( tag, anchor );
			}
			else
			{
				$.get( src, function( context ) {
					if ( type == "css" )
						context = "<style>" + context + "</style>";
				
					$( context ).each(function(idx, tag) {
						if ( late )
							setTimeout(function(){ target.insertBefore( tag, anchor ); }, 0);
						else
							target.insertBefore( tag, anchor );
					});

					fulfill();
				}, 'text')
				.fail(processErr);
			}
			
			function processErr(){ (required ? reject : fulfill).call( null, Array.prototype.slice.call( arguments ) ); }
		});
	}
	function ___LOAD_MODULE( src, overwrites, important ) {
		var args = Array.prototype.slice.call( arguments );
	
		return new Promise(function( fulfill, reject ) {
			var
			variables	= [],
			values		= [],
			required	= (args.length > 2 ? !!important : true);
			if ( args.length > 1 && !!overwrites )
			{
				for( var prop in overwrites )
				{
					if ( prop !== "module" && overwrites.hasOwnProperty( prop ) )
					{
						variables.push( prop );
						values.push( overwrites[ prop ] );
					}
				}
			}
			
		
			$.get( src, function( jsContext ){
				var moduleCtrl = {};
				
				variables.push( 'module', jsContext );
				values.push( moduleCtrl );
				(Function.apply( null, variables )).apply( {}, values );
				
				Promise.resolve(moduleCtrl.signal).then(fulfill).catch(reject);
			}, 'text')
			.fail(function(){
				(required ? reject : fulfill).call( null, Array.prototype.slice.call( arguments ) );
			});
		});
	}
	function ___RESOURCE_FETCHER( resList, loadImmediately ) {
		var
		fileList = Array.isArray( resList ) ? resList : [ resList ],
		loader = function() {
			var __promises	= [];
			fileList.forEach(function( item ) {
				var itemAddr, itemType, promise, important, caching = true, isModulized, moduleOverwite = {};
				
				if ( item === Object(item) )
				{
					if ( !item.path ) return;
					
					itemAddr		= item.path;
					itemType		= item.type || 'js';
					isModulized		= !!item.modulize;
					moduleOverwite	= item.overwrites || {};
					caching			= item.hasOwnProperty( 'cache' ) ? !!item[ 'cache' ] : true;
					important		= item.hasOwnProperty( 'important' ) ? !!item[ 'important' ] : true;
				}
				else
				{
					itemAddr	= item;
					itemType	= 'js';
					isModulized = false;
					important	= true;
				}
				
				itemAddr = itemAddr + ( caching ? '' : '?' + (((new Date()).getTime() / 1000) | 0) );
				promise = ( itemType == 'js' && isModulized ) ? ___LOAD_MODULE( itemAddr, moduleOverwite, important ) : ___LOAD_RESOURCE( itemAddr, itemType, null, null, important );
				__promises.push( promise );
			});
			
			
			return Promise.all( __promises );
		};
		return ( !!loadImmediately ) ? loader() : loader;
	}
	function ___CREATE_PIPE_CHAIN( prevChain ) {
		return function( dependencies ) {
			if ( !Array.isArray( dependencies ) ) return false;
			var newChain = prevChain.then(___CREATE_PIPE( dependencies, false ));
			newChain.pipe = ___CREATE_PIPE_CHAIN( newChain );
			return newChain;
		};
	}
	function ___CREATE_PIPE( dependencies, immediate ) {

		var __trigger,
		__resources = [],
		__chainHead = new Promise(function( fulfill ){ __trigger = fulfill; });



		dependencies.forEach(function( item ) {
			if ( typeof item === 'string' ) {
				__resources.push( item );
				return;
			}
			
			// INFO: Pure object
			if ( (item === Object(item)) && !Array.isArray(item) && ( typeof item !== 'function' ) && item.path )
			{
				__resources.push( item );
				return;
			}


			if ( __resources.length > 0 )
			{
				__chainHead = __chainHead.then(___RESOURCE_FETCHER( __resources ));
				__resources = [];
			}


			if ( typeof item === 'function' ) {
				__chainHead = __chainHead.then(item);
			}
		});

		if ( __resources.length > 0 )
			__chainHead = __chainHead.then(___RESOURCE_FETCHER(__resources));


		
		if ( !immediate )
		{
			return function(){
				setTimeout(__trigger, 0);
				return __chainHead;
			};
		}

		setTimeout(__trigger, 0);
		return __chainHead;
	}
})();

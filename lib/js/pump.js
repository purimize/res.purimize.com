(function() {
	"use strict";

	// INFO: Environmental information collectors
	var ___isNode = (new Function( "try{return this===global}catch(e){return false}" ))();



	// region [ Main pump logic ]
	var __ACCESS_POINT;
	(function() {
		var
		// INFO: Global ID System
		__NAMED_PUMPS	= {},
		__ID_CANDIDATES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
		__CANDIDATE_LEN = __ID_CANDIDATES.length,
		__ID_GENERATOR	 = (function(){
			var uniqueId, i, val, carriage, idRunner = [ 0 ];

			return function( baseId ) {
				baseId = baseId || '';



				uniqueId = ""; i = val = 0; carriage = 1;

				while( carriage > 0 )
				{
					val = idRunner[ i ] + carriage;
					if ( val >= __CANDIDATE_LEN )
					{
						idRunner[ i ] = val - __CANDIDATE_LEN;
						idRunner[ i + 1 ] = idRunner[ i + 1 ] || 0;
						carriage = 1;
					}
					else
					{
						idRunner[ i ] = val;
						break;
					}

					i++;
				}



				for ( i=0; i < idRunner.length; i++ )
					uniqueId = __ID_CANDIDATES.charAt( idRunner[i] ) + uniqueId;

				return baseId + uniqueId;
			};
		})(),
		__PUMP_FACTORY	 = function( injectTarget ){

			var
			__instMap	= {},
			__instances	= {},
			__baseId	= (function(){
				var id = '', count = 5;
				while ( count-- > 0 )
					id += __ID_CANDIDATES.charAt( (__CANDIDATE_LEN * Math.random()) | 0 );
				return id;
			})(),



			// INFO: Internal APIs
			__fireEvent		= function( src, dest, type, args ) {
				var inst, promises = [];

				if ( !dest )
				{
					for( var key in __instances )
					{
						if ( !__instances.hasOwnProperty( key ) ) continue;
						
						inst = __instances[key];
						promises.push( inst.__fireEvent( { type:type, target:null, source:src }, args ) );
					}
				}
				else
				if ( inst = __getInstance( dest ) )
				{
					promises.push( inst.__fireEvent( { type:type, target:null, source:src }, args ) );
				}
				
				
				
				if ( promises.length == 0 ) promises.push( Promise.resolve( null ) );
				return Promise.all( promises );
			},
			__registerEvent = function( srcId, type, cb ) {
				srcId	= srcId || '';
				type	= type || null;
				cb		= ___IS_CALLABLE(cb) ? cb : null;


				var _interface = __instances[ srcId ];
				if ( !_interface || !type || !cb ) return false;

				_interface.__regEvent( type, cb );
				return true;
			},
			__getInstance	= function( targetId ) {
				return __instMap[ targetId ] || __instances[ targetId ] || null;
			},




			// INFO: Instance Generator
			__INTERFACE_WRAPPER	= function() {
				var evtQueues = {};

				return {
					__fireEvent: function( event, args ) {
						var
						evtTypes = [ '*', event.type ],
						promises = [];
						

						evtTypes.forEach(function( evtType )
						{
							var queue = evtQueues[evtType];
							if ( !Array.isArray( queue ) ) return;

							queue.forEach(function(desc){
								promises.push(Promise.resolve( desc.cb( event, args ) ));
							});
						});
						
						
						
						if ( promises.length == 0 ) promises.push( Promise.resolve( true ) );
						return Promise.all( promises );
					},
					__regEvent: function( eventType, callback ) {
						eventType.split( ',' ).forEach(function( type ){
							if ( !evtQueues.hasOwnProperty( type ) )
								evtQueues[ type ] = [];

							evtQueues[ type ].push({ cb: callback });
						});
					}
				};
			},
			__KERNEL_JUNCTION	= function( uniqueId ) {
				var junction = {
					getId: function(){ return uniqueId; },
					on: function( eventType, callback ) {
						var
						args	= Array.prototype.slice.call( arguments ),
						events  = [], params = [],
						paramMode = false;


						while ( args.length > 0 )
						{
							var arg = args.shift();

							if ( !paramMode && !___IS_CALLABLE( arg ) )
								events.push( arg );
							else
							{
								paramMode = paramMode || true;
								params.push( arg );
							}
						}

						params.unshift( (events.length > 0) ? events.join( ',' ) : null );
						params.unshift( uniqueId );

						__registerEvent.apply( null, params );
						return this;
					},
					fire: function( eventType, args ) {
						var promise = Promise.resolve(this).then(function(){
							return __fireEvent( uniqueId, null, eventType, args );
						});
						
						return ___IMPRINT( junction, promise, true );
					},
					fireTarget: function( target, eventType, args ) {
						var promise = Promise.resolve(this).then(function(){
							return __fireEvent( uniqueId, target, eventType, args );
						});
							
						return ___IMPRINT( junction, promise, true );
					}
				};
				return junction;
			},
			__INSTANTIATOR		= function( instanceId, interfaceGenerator ) {

				// INFO: Parameter normalization
				if ( ___IS_CALLABLE(instanceId) )
				{
					interfaceGenerator = instanceId;
					instanceId = undefined;
				}



				// INFO: Request linker for instance's api interface
				// INFO: Expose kernel interface to linker, wrap up and register api interface
				var
				hasLinker	= ___IS_CALLABLE( interfaceGenerator ),
				linkFunc	= hasLinker ? interfaceGenerator : ___DO_NOTHING,
				uniqueId	= __ID_GENERATOR( __baseId ),
				junction	= __KERNEL_JUNCTION( uniqueId );

				__instances[uniqueId] = __INTERFACE_WRAPPER();
				__instances[uniqueId]._interface = linkFunc(junction) || {};



				// INFO: Hook the generated instance onto global instance map
				var instId = instanceId || null;
				if ( instId ) __instMap[ instId ] = __instances[uniqueId];


				return junction;
			};


			injectTarget = injectTarget || {};
			injectTarget.instantiate = __INSTANTIATOR;
			injectTarget.fire = function( eventType, args ) {
				var promise = Promise.resolve(this).then(function() {
					return __fireEvent( null, null, eventType, args );
				});
				
				return ___IMPRINT( injectTarget, promise, true );
			};
			injectTarget.fireTarget = function( target, eventType, args ){
				var promise = Promise.resolve(this).then(function() {
					return __fireEvent( null, target, eventType, args );
				});
				
				return ___IMPRINT( injectTarget, promise, true );
			};
			injectTarget.instance = function( targetId ){
				var inst = __getInstance( targetId );
				return (!inst) ? null : inst._interface;
			};

			return injectTarget;
		},
		__DEFAULT_PUMP	 = __PUMP_FACTORY();


		// INFO: Define __ACCESS_POINT Factory
		// INFO: And Map default pump's api onto __ACCESS_POINT
		__ACCESS_POINT	 = function( pumpId ){

			if ( !(this instanceof __ACCESS_POINT) )
				return ( arguments.length > 0 ) ? (__NAMED_PUMPS[ pumpId ] = __NAMED_PUMPS[ pumpId ] || new pump()) : __DEFAULT_PUMP;
	
			__PUMP_FACTORY( this );
		};
		___IMPRINT( __DEFAULT_PUMP, __ACCESS_POINT, true );




		// INFO: Register __ACCESS_POINT
		if ( ___isNode ) {
			module.exports = __ACCESS_POINT;
			return;
		}


		__ACCESS_POINT.prevPump = (function( pump ){ return function(){ return pump; }; })( window.pump || undefined );
		window.pump = __ACCESS_POINT;
	})();
	// endregion



	// region [ Internal assistive tool ]
	function ___DO_NOTHING() {}
	function ___IS_CALLABLE ( value ) {
		return (typeof value === 'function');
	}
	function ___IMPRINT( a, b, overwrite ) {
		overwrite = overwrite || false;

		for( var key in a ) {
			if ( !a.hasOwnProperty( key ) ) continue;
			if ( !b.hasOwnProperty(key) || overwrite ) b[ key ] = a [ key ];
		}
		
		return b;
	}
	// endregion
})();

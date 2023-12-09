(function(){
	var
	__Promise		= window.Promise,
	__idGenerator	= 0,
	__idPool		= [],
	__prevClear		= window.clearInterval,
	__prevSet		= window.setInterval;

	window.clearInterval = function( timerId )
	{
		if ( __idPool[ timerId ] )
			delete __idPool[ timerId ];
	};
	window.clearInterval.original = __prevClear;



	window.setIntervalArgs = function( timerId, args ) {
		if ( !timerId || !__idPool[ timerId ] ) return;

		var
		inputArgs = Array.prototype.slice.call( arguments );
		inputArgs.shift();

		__idPool[ timerId ].args = inputArgs;
	};



	window.setInterval = function( func, interval, repeats, immediate, args )
	{
		repeats = ( arguments.length > 2 ) ? repeats : null;

		var
		___inputArgs = Array.prototype.slice.call( arguments ),
		___baseId	 = ++__idGenerator,
		___repeat	 = function(){
			if ( !__idPool[ ___baseId ] || (repeats !== null && repeats-- <= 0) )
				return;

			try {
				if ( !__Promise )
				{
					func.apply( null, __idPool[ ___baseId ].args );
					__idPool[ ___baseId ].id = setTimeout( ___repeat, interval );
				}
				else
				{
					__Promise.resolve( func.apply( null, __idPool[ ___baseId ].args ) ).then(function(){
						__idPool[ ___baseId ].id = setTimeout( ___repeat, interval );
					});
				}
			}
			catch(e)
			{
				delete __idPool[ ___baseId ];
				throw e;
			}
		};



		___inputArgs.splice( 0, 4 );
		__idPool[ ___baseId ] = {
			args: ___inputArgs,
			id: setTimeout(___repeat, immediate ? 0 : interval)
		};

		return ___baseId;
	};
	window.setInterval.original = __prevSet;
})();

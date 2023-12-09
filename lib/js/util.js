(function() {
	"use strict";

	var
	___CORE_TO_STR	= {}.toString,
	___UNIQUE_ID	= (function(){
		var hexStr = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f' ];
		return function( base, time, seq, rand ) {
			var
			result = '',
			bytes = [
				(base >> 8) & 255,
				(base	  ) & 255,

				(time >> 24) & 255,
				(time >> 16) & 255,
				(time >> 8 ) & 255,
				(time	   ) & 255,

				seq & 255,

				(rand >> 8) & 255,
				rand & 255
			];

			bytes.forEach(function( value ){ result += hexStr[ (value >> 4) & 15 ] + hexStr[ value & 15 ]; });

			return result;
		};
	})(),
	___PREV			= window.utility;

	window.$U = window.utility = function( targetObject ){};
	window.$U.prev = ___PREV;



	___MERGE( window.$U, {
		type: function( val ){ return ___CORE_TO_STR.call(val); },
		merge: ___MERGE,
		uniqueId: (function(){
			var
			base = (Math.random() * 65536) | 0,
			seq	 = 0;

			return function(){
				return ___UNIQUE_ID( base, (new Date()).getTime() | 0, seq = (seq + 1) & 255, (Math.random() * 65536) );
			};
		})()
	}, true, true);
	function ___MERGE( obj1, obj2, overwrite, iterated ) {

		overwrite	= arguments.length > 2 ? !!overwrite : false;
		iterated	= arguments.length > 3 ? !!iterated : true;

		var prop, isObj1, isObj2, isAry1, isAry2, isFunc1, isFunc2;

		for ( prop in obj2 )
		{
			if ( !obj2.hasOwnProperty( prop ) ) continue;
			isAry2	= Array.isArray(obj2[prop]);
			isFunc2 = ___CORE_TO_STR.call(obj2[prop]) === '[object Function]';


			if ( obj1.hasOwnProperty( prop ) )
			{
				isAry1	= Array.isArray(obj1[prop]);
				isFunc1 = ___CORE_TO_STR.call(obj1[prop]) === '[object Function]';
				
			
			
				isObj1 = ((obj1[prop] === Object(obj1[prop])) && !isAry1 && !isFunc1 );
				isObj2 = ((obj2[prop] === Object(obj2[prop])) && !isAry2 && !isFunc2 );

				if ( isObj1 && isObj2 && iterated )
				{
					___MERGE( obj1[prop], obj2[prop], overwrite, iterated );
					continue;
				}

				if ( !overwrite ) continue;
			}


			if ( obj2[ prop ] === undefined )
				delete obj1[ prop ];
			else
				obj1[ prop ] = !isAry2 ? obj2[ prop ] : obj2[ prop ].slice();
		}

		return obj1;
	}
})();

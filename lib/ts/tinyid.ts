// #region [ Types ]
type TypedArray = Uint8Array|Uint8ClampedArray|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array|Float64Array;
type RuntimeState = {SEQ:number; IDENTITY:Uint8Array|null};
// #endergion


// See http://www.isthe.com/chongo/tech/comp/fnv/#FNV-param for the definition of these parameters;
const FNV_PRIME_HIGH = 0x0100, FNV_PRIME_LOW = 0x0193;	// 16777619 0x01000193
const OFFSET_BASIS = new Uint8Array([0xC5, 0x9D, 0x1C, 0x81]);	// 2166136261 [0x81, 0x1C, 0x9D, 0xC5]
const IS_NODEJS = typeof Buffer !== "undefined";
const TIME_SEPARATOR = 0xFFFFFFFF+1;



const RUNTIME:RuntimeState = {
	SEQ: Math.floor(Math.random() * 0xFFFFFF),
	IDENTITY: null
};

if ( IS_NODEJS ) {
	const Threads = require('worker_threads');
	const MID = require('os').hostname();
	const SID = `${process.pid.toString().padStart(5, '0')}#${process.ppid.toString().padStart(5, '0')}.` + (Threads.isMainThread ? 1 : Threads.threadId).toString().padStart(5, '0');
	RUNTIME.IDENTITY = fnv1a32(UTF8Encode(`${MID}#${SID}`));
}
else  {
	const STR_CANDIDATE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWZYZ_-";


	let hostname = '';
	if ( typeof location === "object" && typeof location.hostname === "string" ) { // Browser
		hostname = location.hostname;
	}
	else { // Randomly generates one	
		let count = Math.random() * 30 + 30;
		while(count-- > 0) {
			hostname += STR_CANDIDATE[(Math.random() * STR_CANDIDATE.length)|0]
		}
	}


	let sid_key = '';
	{
		let count = Math.random() * 30 + 30;
		while(count-- > 0) {
			sid_key += STR_CANDIDATE[(Math.random() * STR_CANDIDATE.length)|0]
		}
	}

	RUNTIME.IDENTITY = fnv1a32(UTF8Encode(`${hostname}#${sid_key}`));
}



const PRIVATE:WeakMap<TinyId, {buffer:Uint8Array}> = new WeakMap();
export class TinyId {
	static _base(machine_id:string, session_id:string) {
		RUNTIME.IDENTITY = fnv1a32(UTF8Encode(`${machine_id}#${session_id}`));
	}

	constructor(id?:TinyId|ArrayBuffer|TypedArray) {
		let input_buffer:Uint8Array|null = null;

		if ( id instanceof TinyId ) {
			input_buffer = PRIVATE.get(id)!.buffer;
		}
		else
		// Uint8Array & NodeJS Buffer
		if ( id instanceof Uint8Array ) {
			input_buffer = id;
		}
		else
		if ( ArrayBuffer.isView(id) ) {
			input_buffer = new Uint8Array(id.buffer);
		}
		else
		if ( id instanceof ArrayBuffer ) {
			input_buffer = new Uint8Array(id);
		}
		
		
		
		let result_buffer = null;
		if ( !input_buffer ) {
			// Prepare required values
			let time;
			if ( typeof id === "number") {
				if ( id < 0 ) {
					throw new RangeError("Input number must be greater or equal to 0");
				}

				time = Math.floor(id);
			}
			else {
				time = Math.floor(Date.now()/1000);
			}



			const time_upper = Math.floor(time/TIME_SEPARATOR);
			const time_lower = time%TIME_SEPARATOR;
			const inc = RUNTIME.SEQ	= (RUNTIME.SEQ + 1) & 0xFFFF;
			const identity = RUNTIME.IDENTITY!;



			// Build up TrimId
			const buff	= new Uint8Array(11);
			
			// 5-byte long timestamp
			buff[ 0]  = time_upper & 0xFF;
			buff[ 1]  = (time_lower>>>24) & 0xFF;
			buff[ 2]  = (time_lower>>>16) & 0xFF;
			buff[ 3]  = (time_lower>>>8) & 0xFF;
			buff[ 4]  = time_lower & 0xFF;
			
			// 4-byte long identity
			buff[ 5]  = identity[0];
			buff[ 6]  = identity[1];
			buff[ 7]  = identity[2];
			buff[ 8]  = identity[3];

			// 2-byte long sequence number
			buff[ 9] = (inc>>>8) & 0xFF;
			buff[10] = inc & 0xFF;
			
			
			
			
			result_buffer = buff;
		}
		else {
			if ( input_buffer.length < 11 ) {
				throw new TypeError( "Given input buffer must be at least 11 bytes long!" );
			}
			
			// Prevent unexpected pre-allocated bytes from NodeJS Buffer
			result_buffer = new Uint8Array(input_buffer.slice(0, 11));
		}
		
		
		
		const _UniqueId = Object.create(null);
		_UniqueId.buffer = result_buffer;
		
		PRIVATE.set(this, _UniqueId);
	}
	toString(radix:32|36=36) {
		if ( radix === 32 ) {
			return Base32HexEncode(PRIVATE.get(this)!.buffer);
		}

		return Base36Encode(PRIVATE.get(this)!.buffer);
	}
	
	get bytes() {
		return PRIVATE.get(this)!.buffer;
	}
	get timestamp() {
		const bytes = PRIVATE.get(this)!.buffer;
		const upper = bytes[0] * TIME_SEPARATOR;
		const lower = (((bytes[1] << 24)|(bytes[2] << 16)|(bytes[3] << 8)|bytes[4]) >>> 0);
		return upper + lower;
	}
	get identity() {
		const bytes = PRIVATE.get(this)!.buffer;
		return (((bytes[5] << 24)|(bytes[6] << 16)|(bytes[7] << 8)|bytes[8]) >>> 0);
	}
	get seq() {
		const bytes = PRIVATE.get(this)!.buffer;
		return (((bytes[9] << 8)|bytes[10]) >>> 0);
	}
	
	
	
	static get NEW() {
		return new TinyId();
	}
	static from():TinyId;
	static from(input:string|TinyId|ArrayBuffer|TypedArray):TinyId|null;
	static from(input:string|TinyId|ArrayBuffer|TypedArray):TinyId|null;
	static from(input:string, radix:32|36):TinyId|null;
	static from(input?:string|TinyId|ArrayBuffer|TypedArray, radix:32|36=36):TinyId|null {
		try {
			if ( typeof input === "string" ) {
				if ( radix === 32 ) {
					input = Base32HexDecode(input);
				}
				else {
					input = Base36Decode(input);
				}
			}
			return new TinyId(input);
		} catch(e) { return null; }
	}
}



const BASE36_ENCODE_CHAR = '0123456789abcdefghijklmnopqrstuvwxyz';
function Base36Encode(bytes:Uint8Array):string {
	if ( bytes.length < 1 ) return '';
	return bytes.reduce((p, c)=>{return ((p<<8n) + BigInt(c))}, 0n).toString(36);
}
function Base36Decode(input:string):Uint8Array {
	input = input.toLowerCase();

	const keyspaceLength = BigInt(BASE36_ENCODE_CHAR.length);
	const raw_hex = input.split('').reduce((p, c)=>{
		const value = BASE36_ENCODE_CHAR.indexOf(c);
		if (value === -1) throw new Error("invalid string");
		return p * keyspaceLength + BigInt(value);
	}, 0n).toString(16);
	const hex = raw_hex.padStart((raw_hex.length + (raw_hex.length%2)), '0');
	const result = new Uint8Array(Math.floor(hex.length/2));
	for(let i=0; i<result.length; i++) {
		result[i] = Number.parseInt(hex.slice(i, i+2));
	}

	return result;
}



// Base32
const BASE32_ENCODE_CHAR = "0123456789abcdefghijklmnopqrstuv".split('');
const BASE32_DECODE_CHAR:{[char:string]:number} = {
	'0':  0, '1':  1, '2':  2, '3':  3, '4':  4, '5':  5, '6':  6, '7':  7, '8':  8, '9':  9, 
	'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17, 'I': 18, 'J': 19, 'K': 20, 'L': 21, 'M': 22,
	'N': 23, 'O': 24, 'P': 25, 'Q': 26, 'R': 27, 'S': 28, 'T': 29, 'U': 30, 'V': 31, 
	'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15, 'g': 16, 'h': 17, 'i': 18, 'j': 19, 'k': 20, 'l': 21, 'm': 22,
	'n': 23, 'o': 24, 'p': 25, 'q': 26, 'r': 27, 's': 28, 't': 29, 'u': 30, 'v': 31,
};

function Base32HexEncode(bytes:Uint8Array):string {
	if ( bytes.length < 1 ) return '';
	
	
	// Run complete bundles
	let encoded = '';
	let begin, loop = Math.floor(bytes.length/5);
	for (let run=0; run<loop; run++) {
		begin = run * 5;
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+2] & 0x0F) << 1 | (bytes[begin+3] >> 7)];	// 4
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x7C) >> 2];								// 5
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x03) << 3 | (bytes[begin+4] >> 5)];	// 6
		encoded += BASE32_ENCODE_CHAR[  bytes[begin+4] & 0x1F];										// 7
	}
	
	// Run remains
	let remain = bytes.length % 5;
	if ( remain === 0 ) { return encoded; }
	
	
	begin = loop*5;
	if ( remain === 1 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2];								// 1
	}
	else
	if ( remain === 2 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4];								// 3
	}
	else
	if ( remain === 3 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+2] & 0x0F) << 1];								// 4
	}
	else
	if ( remain === 4 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+2] & 0x0F) << 1 | (bytes[begin+3] >> 7)];	// 4
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x7C) >> 2];								// 5
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x03) << 3];								// 6
	}
	
	return encoded;
}
function Base32HexDecode(input:string):Uint8Array {
	let remain = input.length % 8;
	if ( [0, 2, 4, 5, 7].indexOf(remain) < 0 ) {
		throw new Error( "Given input string is not base32hex encoded!" );
	}
	
	let decoded = new Uint8Array(Math.floor(input.length * 5 / 8));
	
	
	
	
	// Run complete bundles
	let dest, begin, loop = Math.floor(input.length/8);
	for (let run=0; run<loop; run++) {
		begin = run * 8;
		dest  = run * 5;

		const v1 = BASE32_DECODE_CHAR[input[begin]];
		const v2 = BASE32_DECODE_CHAR[input[begin+1]];
		const v3 = BASE32_DECODE_CHAR[input[begin+2]];
		const v4 = BASE32_DECODE_CHAR[input[begin+3]];
		const v5 = BASE32_DECODE_CHAR[input[begin+4]];
		const v6 = BASE32_DECODE_CHAR[input[begin+5]];
		const v7 = BASE32_DECODE_CHAR[input[begin+6]];
		const v8 = BASE32_DECODE_CHAR[input[begin+7]];
		if ( v1 === undefined || v2 === undefined || v3 === undefined || v4 === undefined || v5 === undefined || v6 === undefined || v7 === undefined || v8 === undefined ) {
			throw new RangeError("Given input string is not base32hex encoded!");
		}


		decoded[dest] 	=  v1 << 3 | v2 >> 2;					// 0
		decoded[dest+1] = (v2 & 0x03) << 6 | v3 << 1 | v4 >> 4;	// 1
		decoded[dest+2] = (v4 & 0x0F) << 4 | v5 >> 1;			// 2
		decoded[dest+3] = (v5 & 0x01) << 7 | v6 << 2 | v7 >> 3;	// 3
		decoded[dest+4] = (v7 & 0x07) << 5 | v8;				// 4
	}
	
	if ( remain === 0 ) { return decoded; }
	
	
	
	{
		begin = loop*8;
		dest  = loop*5;

		const v1 = BASE32_DECODE_CHAR[input[begin]];
		const v2 = BASE32_DECODE_CHAR[input[begin+1]];
		const v3 = BASE32_DECODE_CHAR[input[begin+2]];
		const v4 = BASE32_DECODE_CHAR[input[begin+3]];
		const v5 = BASE32_DECODE_CHAR[input[begin+4]];
		const v6 = BASE32_DECODE_CHAR[input[begin+5]];
		const v7 = BASE32_DECODE_CHAR[input[begin+6]];
		if ( remain >= 2 ) {
			if ( v1 === undefined || v2 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}
			decoded[dest] =  v1 << 3 | v2 >> 2;						// 0
		}
		
		if ( remain >= 4 ) {
			if ( v3 === undefined || v4 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}
			decoded[dest+1] = (v2 & 0x03) << 6 | v3 << 1 | v4 >> 4;	// 1
		}
		
		if ( remain >= 5 ) {
			if ( v5 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}
			decoded[dest+2] = (v4 & 0x0F) << 4 | v5 >> 1;			// 2
		}
		
		if ( remain === 7 ) {
			if ( v6 === undefined || v7 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}
			decoded[dest+3] = (v5 & 0x01) << 7 | v6 << 2 | v7 >> 3;	// 3
		}
	}
	
	return decoded;
}

// Helper
function UTF8Encode(str:string):Uint8Array {
	if ( typeof str !== "string" ) {
		throw new TypeError( "Given input argument must be a js string!" );
	}

	let codePoints = [];
	let i=0;
	while( i < str.length ) {
		let codePoint = str.codePointAt(i);
		if ( codePoint === undefined ) {
			throw new Error( `Invalid codepoint at index#${i}!` );
		}
		
		// 1-byte sequence
		if( (codePoint & 0xffffff80) === 0 ) {
			codePoints.push(codePoint);
		}
		// 2-byte sequence
		else if( (codePoint & 0xfffff800) === 0 ) {
			codePoints.push(
				0xc0 | (0x1f & (codePoint >> 6)),
				0x80 | (0x3f & codePoint)
			);
		}
		// 3-byte sequence
		else if( (codePoint & 0xffff0000) === 0 ) {
			codePoints.push(
				0xe0 | (0x0f & (codePoint >> 12)),
				0x80 | (0x3f & (codePoint >> 6)),
				0x80 | (0x3f & codePoint)
			);
		}
		// 4-byte sequence
		else if( (codePoint & 0xffe00000) === 0 ) {
			codePoints.push(
				0xf0 | (0x07 & (codePoint >> 18)),
				0x80 | (0x3f & (codePoint >> 12)),
				0x80 | (0x3f & (codePoint >> 6)),
				0x80 | (0x3f & codePoint)
			);
		}
		
		i += (codePoint>0xFFFF) ? 2 : 1;
	}
	return new Uint8Array(codePoints);
}
function fnv1a32(octets:Uint8Array):Uint8Array {
	const U8RESULT		= OFFSET_BASIS.slice(0);
	const U32RESULT		= new Uint32Array(U8RESULT.buffer);
	const RESULT_PROC	= new Uint16Array(U8RESULT.buffer);
	for( let i = 0; i < octets.length; i += 1 ) {
		U32RESULT[0] = U32RESULT[0] ^ octets[i];
		
		let hash_low = RESULT_PROC[0], hash_high = RESULT_PROC[1];
		
		RESULT_PROC[0] = hash_low * FNV_PRIME_LOW;
		RESULT_PROC[1] = hash_low * FNV_PRIME_HIGH + hash_high * FNV_PRIME_LOW + (RESULT_PROC[0]>>>16);
	}
	return U8RESULT;
}

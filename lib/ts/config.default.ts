import path from "path";	
import fs from "fs";	



// Type to the configurable fiels	
interface Config {	
	serve: { host:string, port:number }	
}	

// The default values	
const config:Config = {
	serve: { host:'127.0.0.1', port:60080 }	
};



export type ConfigFormat = Partial<Config>;
export default config;






// Convert absolute path for require
function ConvertAbsPath(path:string):string {
	return path;
}

// Loads additional configuration files to overwrite default values
{
	const VERBOSE = Number(process.env['DYNAMIC_CONF_VERBOSE']||'0') !== 0;
	const GLOBAL_PATHS = (process.env['DYNAMIC_CONF_PATHS']||process.env['DYNCONF_SEARCH_PATHS']||'').split(',').map(v=>v.trim()).filter((v)=>v.trim()!=='');
	const CONFIG_PATHS:string[] = [ ...GLOBAL_PATHS, './config.js' ];
	for(const candidate of CONFIG_PATHS) {
		const script_path = path.resolve(__dirname, candidate)
		try {
			fs.accessSync(script_path, fs.constants.F_OK|fs.constants.R_OK);
		}
		catch(e:any) {
			const error:NodeJS.ErrnoException = e;
			if ( error.code === 'ENOENT' ) {
				if ( VERBOSE ) {
					console.log(`No configuration file found at ${script_path}! Skipping...`);
				}
				continue;
			}
			throw e;
		}

		let imported = require(ConvertAbsPath(script_path));
		if ( IsPlainObject(imported) && imported.__esModule && imported['default'] !== undefined ) {
			imported = imported['default'];	
		}

		if ( !IsPlainObject(imported) ) {
			if ( VERBOSE ) {
				console.error(`File "${script_path}" contains none-object configurations! Skipping...`);
			}
			continue;
		}
		
		DeepMerge(config, imported);
	}
}

function IsPlainObject(d:any) { return Object(d) === d && !Array.isArray(d); }
function DeepMerge(receiver:{[key:string]:any}, ...sources:any[]):{[key:string]:any}|undefined {
	if ( !IsPlainObject(receiver) ) return undefined;
	for(const source of sources) {
		if ( !IsPlainObject(source) ) continue;
		const keys = Object.keys(source);
		for(const key of keys) {
			const src_val = source[key];
			if ( IsPlainObject(src_val) && IsPlainObject(receiver[key]) ) {
				receiver[key] = DeepMerge(receiver[key], src_val);
			}
			else {
				receiver[key] = src_val;
			}
		}
	}

	return receiver;
}

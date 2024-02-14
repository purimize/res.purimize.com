export function JSONDecode<DataType=JSONType>(json_str:string):DataType|undefined {
	try {
		return JSON.parse(json_str);
	} catch(e) { return undefined; }
}

export function JSONEncode<DataType=JSONType>(data:DataType):string {
	return JSON.stringify(data);
}

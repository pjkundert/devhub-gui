const { Logger }			= require('@whi/weblogger');
const log				= new Logger("common");


const _debounce_timers			= {};


module.exports = {
    sort_by_object_key ( list_of_objects, key ) {
	return list_of_objects.sort( (a,b) => {
	    if ( a[key] === undefined )
		return b[key] === undefined ? 0 : -1;
	    return a[key] < b[key]
		? -1
		: a[key] > b[key] ? 1 : 0;
	} );
    },

    copy ( src, dest = {}, ...keys ) {
	log.trace("Copying object keys: %s", () => [ (keys.length ? keys : Object.keys(src)).join(", ") ]);

	if ( keys.length === 0 ) // intention is to copy the whole source
	    return Object.assign( dest, src );

	let fkey			= keys.pop();

	keys.forEach( key => {
	    if ( src === null || typeof src !== "object" )
		log.error("Source object is type '%s'; must be an object", typeof src );
	    if ( dest === null || typeof dest !== "object" )
		log.error("Destination object is type '%s'; must be an object", typeof dest );

	    src				= src[key];

	    if ( dest[key] === undefined ) // create the path for destination object
		dest[key]		= {};

	    dest			= dest[key];
	});

	dest[fkey]			= src[fkey];

	return dest;
    },

    load_file ( file ) {
	log.normal("Load file:", file );
	return new Promise((f,r) => {
	    let reader			= new FileReader();

	    reader.readAsArrayBuffer( file );
	    reader.onerror		= function (err) {
		log.error("FileReader error event:", err );

		r( err );
	    };
	    reader.onload		= function (evt) {
		log.info("FileReader load event:", evt );
		let result		= new Uint8Array( evt.target.result );
		log.debug("FileReader result:", result );

		f( result );
	    };
	    reader.onprogress		= function (p) {
		log.trace("progress:", p );
	    };
	});
    },

    download ( filename, ...bytes ) {
	const blob			= new Blob( bytes );
	log.normal("Downloading bytes (%s bytes) as '%s'", blob.size, filename );

	const link			= document.createElement("a");
	link.href			= URL.createObjectURL( blob );
	link.download			= filename;

	link.click();
    },

    debounce ( callback, delay = 1_000, id ) {
	if ( id === undefined )
	    id			= String(callback);

	const toid		= _debounce_timers[id];

	if ( toid ) {
	    clearTimeout( toid );
	    delete _debounce_timers[id];
	}

	_debounce_timers[id] = setTimeout( () => {
	    callback.bind(this);
	    delete _debounce_timers[id];
	}, delay );
    },
};
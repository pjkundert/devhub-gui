const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happs");

const { HoloHashes }			= require('@holochain/devhub-entities');
const { AgentPubKey,
	EntryHash }			= HoloHashes;
const msgpack				= require('@msgpack/msgpack');
let sha256, gzip;

function unpack_bundle ( zipped_bytes ) {
    let msgpack_bytes			= gzip.unzip( zipped_bytes );
    let bundle				= msgpack.decode( msgpack_bytes );

    // for ( let path in bundle.resources ) {
    // 	bundle.resources[path]		= Buffer.from( bundle.resources[path] );
    // }

    return bundle;
}


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": (await import("./templates/happs/list.html")).default,
	    "data": function() {
		const agent_hash	= PersistentStorage.getItem("LIST_FILTER");
		return {
		    "agent_search": agent_hash || null,
		    "agent_filter": agent_hash ? new AgentPubKey( agent_hash ) : null,
		    "order_by": "published_at",
		};
	    },
	    async created () {
		this.refresh();
	    },
	    "computed": {
		title () {
		    return this.agent === "me" ? "My hApps" : "hApps found";
		},
		agent () {
		    return this.agent_filter || "me";
		},
		happs () {
		    const happs		= this.$store.getters.happs( this.agent ).collection;
		    return this.sort_by_object_key( happs, this.order_by );
		},
		$happs () {
		    return this.$store.getters.happs( this.agent ).metadata;
		},
	    },
	    "methods": {
		refresh () {
		    if ( this.happs.length === 0 )
			this.fetchHapps();
		},
		updateAgent ( input ) {
		    if ( input === "" )
			this.agent_filter = null;
		    else if ( this.isAgentPubKey( input ) )
			this.agent_filter	= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_filter );

		    if ( !this.happs.length )
			this.fetchHapps();
		},
		async fetchHapps () {
		    try {
			await this.$store.dispatch("fetchHapps", { "agent": this.agent });
		    } catch (err) {
			log.error("Failed to get happs: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": (await import("./templates/happs/create.html")).default,
	    "data": function() {
		return {
		    "error": null,
		    "input": {
			"title": null,
			"subtitle": null,
			"description": null,
		    },
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
	    },
	    "methods": {
		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			const happ	= await this.$store.dispatch("createHapp", this.input );

			this.$store.dispatch("fetchHapps", { "agent": "me" });
			this.$router.push( "/happs/" + happ.$id );
		    } catch ( err ) {
			log.error("Failed to create Happ:", err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": (await import("./templates/happs/update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {},
		    "validated": false,
		};
	    },
	    "computed": {
		happ () {
		    return this.$store.getters.happ( this.id ).entity;
		},
		$happ () {
		    return this.$store.getters.happ( this.id ).metadata;
		},
		form () {
		    return this.$refs["form"];
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		if ( !this.happ )
		    this.fetchHapp();
	    },
	    "methods": {
		async fetchHapp () {
		    try {
			await this.$store.dispatch("fetchHapp", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateHapp", [ this.id, this.input ] );

			this.$router.push( "/happs/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update Happ (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": (await import("./templates/happs/single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "deprecation": {
			"message": null,
		    },
		    "validated": false,
		    "release": null,
		};
	    },
	    async created () {
		window.View		= this;
		this.id			= this.getPathId("id");

		this.refresh();
	    },
	    "computed": {
		happ () {
		    return this.$store.getters.happ( this.id ).entity;
		},
		$happ () {
		    return this.$store.getters.happ( this.id ).metadata;
		},
		releases () {
		    return this.$store.getters.happ_releases( this.id ).collection;
		},
		$releases () {
		    return this.$store.getters.happ_releases( this.id ).metadata;
		},
		form () {
		    return this.$refs["form"];
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		unpublishModal () {
		    return this.$refs["unpublishModal"].modal;
		},
		deprecated () {
		    return !!( this.happ && this.happ.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    if ( !this.happ )
			this.fetchHapp();

		    if ( this.releases.length === 0 )
			this.fetchHappReleases();
		},
		async fetchHapp () {
		    try {
			await this.$store.dispatch("fetchHapp", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchHappReleases () {
		    try {
			await this.$store.dispatch("fetchReleasesForHapp", this.id );
		    } catch (err) {
			log.error("Failed to get releases for happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async deprecate () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    await this.$store.dispatch("deprecateHapp", [ this.id, this.deprecation ] );

		    this.deprecation	= {
			"message": null,
		    };

		    this.modal.hide();

		    this.$store.dispatch("fetchHapps", { "agent": "me" });
		},
		promptUnpublish ( release ) {
		    this.release	= release;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishHappRelease", this.release.$id );

		    this.unpublishModal.hide();
		    this.fetchHappReleases();
		},
	    },
	};
    };

    async function upload () {
	return {
	    "template": (await import("./templates/happs/upload.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {
			"name": "",
			"description": "",
			"manifest": null,
			"dnas": [
			    // dnas[].role_id	String
			    // dnas[].dna	EntryHash
			    // dnas[].version	EntryHash
			    // dnas[].wasm_hash	String
			],
		    },
		    "bundle": null,
		    "bundle_file": null,
		    "bundle_unpacking": false,
		    "release_hash_exists": null,
		    "release_name_exists": null,
		    "dnas": {},
		    "zomes": {},
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		happ () {
		    return this.$store.getters.happ( this.id ).entity;
		},
		$happ () {
		    return this.$store.getters.happ( this.id ).metadata;
		},
		releases () {
		    return this.$store.getters.happ_releases( this.id ).collection;
		},
		$releases () {
		    return this.$store.getters.happ_releases( this.id ).metadata;
		},
		happ_release () {
		    if ( this.latest_release )
			return this.$store.getters.happ_release( String(this.latest_release.$id) ).entity;
		},
		$happ_release () {
		    if ( this.latest_release )
			return this.$store.getters.happ_release( String(this.latest_release.$id) ).metadata;
		    else
			return this.$store.getters.happ_release("").metadata;
		},
		dna_version () {
		    return ( id ) => {
			return this.$store.getters.dna_version( String(id) ).entity;
		    };
		},
		$dna_version () {
		    return ( id ) => {
			return this.$store.getters.dna_version( String(id) ).metadata;
		    };
		},
		latest_release () {
		    return this.releases.reduce( (acc, release, i) => {
			if ( acc === null )
			    return release;

			if ( release.published_at > acc.published_at )
			    return release;

			return acc;
		    }, null );
		},
		file_valid_feedback () {
		    const file		= this.bundle_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		this.refresh();

		if ( sha256 === undefined )
		    sha256			= (await import("./lazyload_sha256.js")).default;
		gzip				= (await import("./lazyload_gzip.js")).default;

		console.log( sha256 );
		console.log( msgpack );
		console.log( gzip );
	    },
	    "methods": {
		async refresh () {
		    if ( !this.happ )
			this.fetchHapp();

		    if ( this.releases.length === 0 )
			await this.fetchHappReleases();

		    if ( !this.latest_release )
			return;

		    await this.$store.dispatch("fetchHappRelease", this.latest_release.$id );
		    log.info("Latest hApp release:", this.happ_release );

		    this.input.name		= this.happ_release.name;

		    await Promise.all( this.happ_release.dnas.map(async dna => {
			let dna_sources		= this.dnas[ dna.role_id ] = {
			    "last": {
				"wasm_hash": dna.wasm_hash,
				"dna_id": dna.dna,
				"dna_version_id": dna.version,
			    },
			    "upload": null,
			    "zomes": {},
			};
			dna_sources.last.dna_version = await this.$store.dispatch("fetchDnaVersion", dna.version );

			dna_sources.last.dna_version.zomes.map( zome => {
			    if ( dna_sources.zomes[ zome.name ] === undefined ) {
				dna_sources.zomes[ zome.name ] = {
				    "last": null,
				    "upload": null,
				};
			    }
			    const zome_sources	= dna_sources.zomes[ zome.name ];

			    zome_sources.last	= {
				"zome_id": zome.zome,
				"zome_version_id": zome.version,
				"zome_version": zome,
				"resource": zome.resource,
				"wasm_resource_hash": zome.resource_hash,
			    };
			});
		    }) );

		    for ( let slot of this.happ_release.manifest.slots ) {
			// We should be able to assume the ID exists from the previous loop
			this.dnas[ slot.id ].last.uid		= slot.dna.uid;
			this.dnas[ slot.id ].last.properties	= slot.dna.properties;
		    }

		    console.log( this.dnas );

		    // On page init
		    //
		    //   1. Get the hApp context
		    //   2. Get the latest Release context
		    //   3. Restructure release information and fetch DNAs
		    //
		    // On bundle upload
		    //
		    //   1. Dissect bundle and calculate deltas
		    //     1. Is the release DNA hash?
		    //     2. If not, which DNA's WASM hashes are different?
		    //     3. For each different WASM hash, which zomes are different?
		    //
		    // Safe Assumptions
		    //
		    //   - Any difference in a hash means somewhere the zome WASM changed
		    //
		},
		async fetchHapp () {
		    try {
			await this.$store.dispatch("fetchHapp", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchHappReleases () {
		    try {
			await this.$store.dispatch("fetchReleasesForHapp", this.id );
			log.debug("Releases for this hApp:", this.releases );
			log.trace("Release with latest published_at:", this.latest_release );
		    } catch (err) {
			log.error("Failed to get releases for happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		reset_file () {
		    this.bundle			= null;
		    this.bundle_file		= null;
		    this.release_exists		= null;

		    for ( let sources of Object.values(this.dnas) ) {
			sources.upload		= null;
		    }
		},
		missing_zome_version ( dna ) {
		    for ( let zome_sources of Object.values( dna.zomes ) ) {
			if ( !zome_sources.upload.zome_version_id )
			    return true;
		    }
		    return false;
		},
		select_dna_version ( dna_sources, dna_version ) {
		    dna_sources.dna_id		= dna_version.for_dna;
		    dna_sources.dna_version_id	= dna_version.$id;
		    dna_sources.dna_version	= dna_version;
		},
		select_dna ( dna_sources, dna ) {
		    dna_sources.dna_id		= dna.$id;
		    dna_sources.dna		= dna;
		},
		select_zome_version ( zome_sources, zome_version ) {
		    zome_sources.zome_id		= zome_version.for_zome;
		    zome_sources.zome_version_id	= zome_version.$id;
		    zome_sources.zome_version		= zome_version;
		    zome_sources.resource		= zome_version.mere_memory_addr;
		    zome_sources.wasm_resource_hash	= zome_version.mere_memory_hash;
		},
		select_zome ( zome_sources, zome ) {
		    zome_sources.zome_id	= zome.$id;
		    zome_sources.zome		= zome;
		},

		async file_selected ( event ) {
		    const files			= event.target.files;
		    const file			= files[0];

		    if ( file === undefined ) {
			return;
		    }

		    function array_compare ( a, b ) {
			let i = 0;
			while ( a[i] == b[i] ) {
			    if ( a[i] === undefined || b[i] === undefined )
				break;

			    i++;
			}

			if ( a[i] == b[i] )
			    return 0;

			return a[i] > b[i] ? 1 : -1;
		    }

		    this.bundle_file		= file;
		    this.bundle_unpacking	= true;
		    const zipped_bytes		= await this.load_file( file );
		    const bundle		= unpack_bundle( zipped_bytes );
		    const dna_hashes		= [];

		    if ( !this.input.name )
			this.input.name		= "v0.1.0";

		    this.input.manifest		= bundle.manifest;

		    for ( let slot of bundle.manifest.slots ) {
			if ( this.dnas[ slot.id ] === undefined ) {
			    this.dnas[ slot.id ]	= {
				"last": null,
				"upload": null,
				"zomes": {},
			    };
			}

			const dna_sources	= this.dnas[ slot.id ];
			const dna_bundle	= unpack_bundle( bundle.resources[ slot.dna.bundled ] );
			const wasm_hashes	= [];
			const zomes		= {};

			for ( let zome of dna_bundle.manifest.zomes ) {
			    const wasm_bytes	= dna_bundle.resources[ zome.bundled ];
			    const hash		= sha256.create();

			    hash.update( wasm_bytes );

			    const digest	= hash.digest();
			    const digest_hex	= this.toHex( digest );

			    if ( dna_sources.zomes[ zome.name ] === undefined ) {
				dna_sources.zomes[ zome.name ] = {
				    "last": null,
				    "upload": null,
				};
			    }
			    const zome_sources	= dna_sources.zomes[ zome.name ];

			    console.log("Check if zome changed: %s", digest_hex, zome_sources.last );
			    if ( zome_sources.last
				 && zome_sources.last.wasm_resource_hash === digest_hex ) {
				zome_sources.changed	= false;
				zome_sources.upload	= {
				    "bytes": wasm_bytes,
				};
				Object.assign( zome_sources.upload, zome_sources.last );
				console.log("Used previous zome info:", zome_sources.upload );
			    }
			    else {
				zome_sources.changed	= true;
				zome_sources.upload	= {
				    "wasm_resource_hash": digest_hex,
				    "bytes": wasm_bytes,
				};
			    }

			    wasm_hashes.push( digest );
			}

			const wasm_hash			= sha256.create();
			wasm_hashes.sort(array_compare).map( i => wasm_hash.update(i) );
			const digest			= wasm_hash.digest();
			const digest_hex		= this.toHex( digest );

			if ( dna_sources.last
			     && dna_sources.last.wasm_hash === digest_hex ) {
			    dna_sources.changed		= false;
			    dna_sources.upload		= {
				"wasm_hash": digest_hex,
				"dna_id": dna_sources.last.dna_id,
				"dna_version_id": dna_sources.last.dna_version_id,
				"dna_version": dna_sources.last.dna_version,
				"properties": null,
				"uid": null,
				"bundle": dna_bundle,
			    };
			}
			else {
			    dna_sources.changed		= true;
			    dna_sources.upload		= {
				"wasm_hash": digest_hex,
				"dna_id": null,
				"dna_version_id": null,
				"properties": null,
				"uid": null,
				"bundle": dna_bundle,
			    };
			}

			dna_hashes.push( digest );

			console.log( dna_bundle.manifest );
		    }

		    const dna_hash		= sha256.create();
		    dna_hashes.sort(array_compare).map( i => dna_hash.update(i) );
		    const digest		= dna_hash.digest();
		    const digest_hex		= this.toHex( digest );

		    this.happ_changed		= !this.happ_release || this.happ_release.dna_hash !== digest_hex;

		    if ( this.happ_changed ) {
			await Promise.all( Object.entries(this.dnas).map(async ([dna_name, dna_sources]) => {
			    log.debug("Searching for DNA version with hash:", dna_sources.upload.wasm_hash );
			    try {
				const dna_versions		= await this.$client.call(
				    "dnarepo", "dna_library", "get_dna_versions_by_filter", {
					"filter": "uniqueness_hash",
					"keyword": dna_sources.upload.wasm_hash,
				    }
				);
				dna_sources.exists			= dna_versions.length > 0;
				dna_sources.dna_version_search_results	= dna_versions;
			    } catch (err) {
				console.log("Catching cornercase", err );
			    }

			    if ( dna_sources.exists === false ) {
				log.debug("Searching for DNA context by name:", dna_name );
				const dnas		= await this.$client.call(
				    "dnarepo", "dna_library", "get_dnas_by_filter", {
					"filter": "name",
					"keyword": dna_name.toLowerCase(),
				    }
				);
				dna_sources.name_exists	= dnas.length > 0;

				if ( dna_sources.name_exists )
				    dna_sources.upload.dna_id = dnas[0].$id;
			    }

			    Object.entries(dna_sources.zomes).map(async ([name, zome]) => {
				log.debug("Searching for zome version with hash:", zome.upload.wasm_resource_hash );
				const zome_versions	= await this.$client.call(
				    "dnarepo", "dna_library", "get_zome_versions_by_filter", {
					"filter": "wasm_hash",
					"keyword": zome.upload.wasm_resource_hash,
				    }
				);
				zome.exists		= zome_versions.length > 0;
				zome.zome_version_search_results	= zome_versions;
				console.log("After searching for zome version matches:", zome );

				if ( zome.exists === false ) {
				    log.debug("Searching for zome context by name:", name );
				    const zomes		= await this.$client.call(
					"dnarepo", "dna_library", "get_zomes_by_filter", {
					    "filter": "name",
					    "keyword": name.toLowerCase(),
					}
				    );
				    zome.name_exists	= zomes.length > 0;

				    if ( zome.name_exists )
					zome.upload.zome_id = zomes[0].$id;
				}
			    });
			}) );
		    }

		    bundle.manifest.dna_hash	= digest_hex;

		    console.log( bundle.manifest );
		    console.log( this.dnas );

		    this.bundle			= bundle;
		    this.bundle_unpacking	= false;

		    const releases		= await this.$client.call(
			"happs", "happ_library", "get_happ_releases_by_filter", {
			    "filter": "uniqueness_hash",
			    "keyword": digest_hex,
			}
		    );

		    this.release_hash_exists	= releases.length > 0;

		    const happs			= await this.$client.call(
			"happs", "happ_library", "get_happs_by_filter", {
			    "filter": "title",
			    "keyword": bundle.manifest.name.toLowerCase(),
			}
		    );

		    this.release_name_exists	= happs.length > 0;
		},

		async create_zome_version ( name, zome_info ) {
		    zome_info.saving		= true;
		    await this.delay();

		    const upload		= zome_info.upload;

		    if ( !upload.zome_id ) {
			log.debug("Create zome context:", name );
			const zome			= await this.$client.call(
			    "dnarepo", "dna_library", "create_zome", {
				"name": name,
				"description": "",
			    }
			);
			upload.zome_id		= zome.$id;
			zome_info.name_exists	= true;
		    }

		    let next_version_number;
		    if ( zome_info.last ) {
			console.log("Calculate next version number", zome_info );
			const last_version	= await this.$store.dispatch("fetchZomeVersion", zome_info.last.zome_version_id );
			next_version_number	= last_version.version + 1;
		    }
		    else {
			next_version_number	= 1;
		    }

		    log.debug("Create zome version #1: (%s bytes) %s", upload.bytes.length, upload.wasm_resource_hash );
		    const version		= await this.$client.call(
			"dnarepo", "dna_library", "create_zome_version", {
			    "for_zome": upload.zome_id,
			    "version": next_version_number,
			    "zome_bytes": upload.bytes,
			}
		    );
		    upload.zome_version_id	= version.$id;
		    upload.resource		= version.mere_memory_addr;
		    upload.wasm_resource_hash	= version.mere_memory_hash;
		    upload.zome_version		= version;

		    zome_info.exists		= true;
		    zome_info.saving		= false;
		},

		async create_dna_version ( dna_info ) {
		    dna_info.saving		= true;
		    const name			= dna_info.upload.bundle.manifest.name;
		    const upload		= dna_info.upload;

		    console.log( name, upload, dna_info );

		    if ( !upload.dna_id ) {
			log.debug("Create DNA context:", name );
			const dna			= await this.$client.call(
			    "dnarepo", "dna_library", "create_dna", {
				"name": name,
				"description": "",
			    }
			);
			upload.dna_id		= dna.$id;
			dna_info.name_exists	= true;
		    }

		    const next_dna_version_number = dna_info.last
			  ? dna_info.last.dna_version.version + 1
			  : 1;
		    const zome_list		= Object.entries( dna_info.zomes );
		    log.debug("Create DNA version #1: (%s zomes) %s", zome_list.length, upload.wasm_resource_hash );
		    const input			= {
			"for_dna": upload.dna_id,
			"version": next_dna_version_number,
			"zomes": zome_list.map( ([zome_name, zome_sources]) => {
			    return {
				"name":			zome_name,
				"zome":			zome_sources.upload.zome_id,
				"version":		zome_sources.upload.zome_version_id,
				"resource":		zome_sources.upload.resource,
				"resource_hash":	zome_sources.upload.wasm_resource_hash,
			    };
			}),
		    };

		    console.log( input );
		    const version		= await this.$client.call(
			"dnarepo", "dna_library", "create_dna_version", input
		    );
		    upload.dna_version_id	= version.$id;
		    upload.wasm_hash		= version.wasm_hash;
		    upload.dna_version		= version;

		    dna_info.exists		= true;
		    dna_info.saving		= false;
		},

		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			Object.entries(this.dnas).map(async ([hash, dna_sources]) => {
			    const dna		= dna_sources.upload;
			    this.input.dnas.push({
				"role_id":	dna.bundle.manifest.name,
				"dna":		dna.dna_id,
				"version":	dna.dna_version_id,
				"wasm_hash":	dna.wasm_hash,
			    });
			});

			console.log("Input for create happ", this.id, this.input );
			const release	= await this.$store.dispatch("createHappRelease", [ this.id, this.input ] );

			this.$store.dispatch("fetchReleasesForHapp", this.id );
			this.$router.push( `/happs/${this.id}/releases/${release.$id}` );
		    } catch ( err ) {
			log.error("Failed to create hApp Release:", err, err.data );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
	    },
	};
    };

    return {
	list,
	create,
	update,
	single,
	upload,
    };
};

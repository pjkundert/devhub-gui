const path			= require('path');
const webpack			= require('webpack');
const TerserPlugin		= require("terser-webpack-plugin");
const fs			= require('fs');

const Copy			= require('copy-webpack-plugin');

const DNAREPO_HASH		= fs.readFileSync("./tests/DNAREPO_HASH",	"utf8").trim();
const HAPPS_HASH		= fs.readFileSync("./tests/HAPPS_HASH",		"utf8").trim();
const WEBASSETS_HASH		= fs.readFileSync("./tests/WEBASSETS_HASH",	"utf8").trim();
const WEBPACK_MODE		= "production"; // production | development


module.exports = {
    target: "web",
    mode: WEBPACK_MODE,
    entry: [ "./src/index.js" ],
    resolve: {
	mainFields: ["main"],
    },
    output: {
	publicPath: "/",
	filename: "webpacked.app.js"
    },
    module: {
	rules: [
	    {
		test: /\.m?js$/,
		exclude: /(node_modules|bower_components)/,
		use: {
		    loader: "babel-loader",
		    options: {
			presets: ["@babel/preset-env"],
			plugins: [
			    ["@babel/plugin-transform-runtime", {
				"regenerator": true,
			    }],
			    ["@babel/plugin-transform-modules-commonjs", {
				"allowTopLevelThis": true,
			    }],
			],
		    }
		}
	    },
	    {
		test: /\.html$/,
		exclude: /node_modules/,
		use: {
		    loader: "html-loader",
		    options: {
			sources: false, // prevents 'not found' errors for HTML references
		    },
		}
	    },
	],
    },
    plugins: [
	new Copy({
	    patterns: [
		{
		    from: "./src/static/",
		    globOptions: {
			gitignore: true,
			ignore: ["**/*~"],
		    },
		},
		{ from: "./node_modules/vue/dist/vue.global.prod.js", to: "vue.prod.js" },
		{ from: "./node_modules/vuex/dist/vuex.global.prod.js", to: "vuex.prod.js" },
		{ from: "./node_modules/vue-router/dist/vue-router.global.prod.js", to: "vue-router.prod.js" },
		// { from: "./node_modules/showdown/dist/showdown.min.js", to: "showdown.min.js" },
	    ],
	}),
	new webpack.DefinePlugin({
	    // Vue says to do this - https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
	    "WEBPACK_MODE":		JSON.stringify( WEBPACK_MODE ),
	    "__VUE_OPTIONS_API__":	JSON.stringify( true ),
	    "__VUE_PROD_DEVTOOLS__":	JSON.stringify( false ),
	    "process.env": {
		"DNAREPO_HASH":		JSON.stringify( DNAREPO_HASH ),
		"HAPPS_HASH":		JSON.stringify( HAPPS_HASH ),
		"WEBASSETS_HASH":	JSON.stringify( WEBASSETS_HASH ),
	    },
	}),
    ],
    stats: {
	colors: true,
	errorDetails: true,
    },
    devtool: "source-map",
    optimization: {
	minimizer: [
	    new TerserPlugin({
		terserOptions: {
		    keep_classnames: true,
		},
	    }),
	],
    },
    performance: {
	maxEntrypointSize:	300_000, // 300kb
	maxAssetSize:		300_000, // 300kb
    },
};
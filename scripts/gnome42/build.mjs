// Bundle the tsc output (GNOME 45+ ES modules) into GNOME 42 legacy scripts.
//
// GNOME 42 loads extension.js and prefs.js through the legacy `imports` importer and
// calls their top-level init() functions. This script bundles each entry point into
// a single file, maps `gi://` and `resource:///org/gnome/shell/...` imports onto
// `imports.*` (or onto the shims in compat/gnome42) and lowers syntax to GJS 1.72.
//
// usage: node scripts/gnome42/build.mjs <tsc-out-dir> <dist-dir>
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [inDir, outDir] = process.argv.slice(2);
const compatDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../compat/gnome42');

// Modules that do not exist in GNOME 42 and are replaced by shims
const SHIMMED_MODULES = {
	'resource:///org/gnome/shell/extensions/extension.js': 'extension.js',
	'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js': 'prefs.js',
};

// GI namespaces that need a compatibility layer
const SHIMMED_NAMESPACES = {
	Adw: 'adw.js',
	GObject: 'gobject.js',
	GioUnix: 'gioUnix.js',
	Gtk: 'gtk.js',
	Soup: 'soup.js',
};

// Legacy module expression for a module specifier, or null if it is not a legacy module
function legacyModule(specifier) {
	switch (specifier) {
		// Split out of misc/util.js in GNOME 45
		case 'resource:///org/gnome/shell/misc/animationUtils.js':
		case 'resource:///org/gnome/shell/misc/dateUtils.js':
			return 'imports.misc.util';
		case 'cairo':
		case 'gettext':
		case 'system':
			return `imports.${specifier}`;
	}

	const match = specifier.match(/^resource:\/\/\/org\/gnome\/shell\/(ui|misc)\/(\w+)\.js$/);
	return match ? `imports.${match[1]}.${match[2]}` : null;
}

function destructure(namedImports) {
	return namedImports
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2'))
		.join(', ');
}

// Rewrite static imports of legacy modules into `const X = imports.ui.x;` so property
// accesses stay live (e.g. Main.panel) instead of copying exports at bundle evaluation.
function rewriteLegacyImports(source, file) {
	return source.replace(/^import\s+([^'";]+?)\s+from\s+'([^']+)';?/gm, (statement, clause, specifier) => {
		const module = legacyModule(specifier);
		if (!module) return statement;

		let match;
		if ((match = clause.match(/^\*\s+as\s+(\w+)$/)) || (match = clause.match(/^(\w+)$/)))
			return `const ${match[1]} = ${module};`;
		if ((match = clause.match(/^\{([^}]*)\}$/))) return `const { ${destructure(match[1])} } = ${module};`;
		if ((match = clause.match(/^(\w+)\s*,\s*\{([^}]*)\}$/)))
			return `const ${match[1]} = ${module}; const { ${destructure(match[2])} } = ${module};`;

		throw new Error(`${file}: unsupported import clause: ${statement}`);
	});
}

const gnome42Plugin = {
	name: 'gnome42',
	setup(build) {
		build.onResolve({ filter: /^gi:\/\// }, (args) => ({ path: args.path, namespace: 'gi' }));
		build.onLoad({ filter: /.*/, namespace: 'gi' }, (args) => {
			const [, ns, version] = args.path.match(/^gi:\/\/(\w+)(?:\?version=([\d.]+))?$/);
			if (SHIMMED_NAMESPACES[ns]) {
				const shim = path.join(compatDir, SHIMMED_NAMESPACES[ns]);
				return { contents: `export { default } from ${JSON.stringify(shim)};`, resolveDir: compatDir };
			}

			const lines = version ? [`imports.gi.versions.${ns} = ${JSON.stringify(version)};`] : [];
			lines.push(`export default imports.gi.${ns};`);
			return { contents: lines.join('\n') };
		});

		build.onResolve({ filter: /^resource:\/\/\// }, (args) => {
			const shim = SHIMMED_MODULES[args.path];
			if (shim) return { path: path.join(compatDir, shim) };
			return { errors: [{ text: `No GNOME 42 mapping for ${args.path}` }] };
		});

		build.onLoad({ filter: /\.js$/ }, async (args) => {
			if (args.path.startsWith(compatDir)) return undefined;
			const source = await fs.promises.readFile(args.path, 'utf8');
			return { contents: rewriteLegacyImports(source, args.path), loader: 'js' };
		});
	},
};

async function bundle(entry, globalName, footer) {
	await esbuild.build({
		entryPoints: [path.join(inDir, entry)],
		outfile: path.join(outDir, entry),
		bundle: true,
		format: 'iife',
		globalName,
		platform: 'neutral',
		target: 'firefox91', // GJS 1.72 (SpiderMonkey 91)
		charset: 'utf8',
		legalComments: 'none',
		plugins: [gnome42Plugin],
		banner: { js: '// Copyous, bundled for GNOME Shell 42 (legacy extension format)' },
		footer: { js: footer },
		logLevel: 'warning',
	});
}

await bundle(
	'extension.js',
	'CopyousExtension',
	`
function init(extension) {
    return new CopyousExtension.default(extension);
}`,
);

await bundle(
	'prefs.js',
	'CopyousPreferences',
	`
let preferences = null;

function init(metadata) {
    preferences = new CopyousPreferences.default(metadata);
}

function fillPreferencesWindow(window) {
    Promise.resolve(preferences.fillPreferencesWindow(window)).catch((e) => logError(e, 'Copyous preferences'));
}`,
);

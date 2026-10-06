// GObject as seen by the bundle. GJS 1.72 rejects null nick/blurb in ParamSpec
// constructors, which newer GJS versions accept; substitute empty strings.
const GObject = imports.gi.GObject;

const ParamSpec = new Proxy(GObject.ParamSpec, {
	get(target, prop) {
		const value = Reflect.get(target, prop);
		if (typeof value !== 'function' || prop === 'prototype' || prop === 'constructor') return value;
		return (name, nick, blurb, ...args) => value.call(target, name, nick ?? '', blurb ?? '', ...args);
	},
});

export default new Proxy(GObject, {
	get: (target, prop) => (prop === 'ParamSpec' ? ParamSpec : Reflect.get(target, prop)),
});

// Helpers shared by the GNOME 42 shims of the GNOME 45+ extension base classes.
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const ExtensionUtils = imports.misc.extensionUtils;

export function getCurrentExtension() {
	const extension = ExtensionUtils.getCurrentExtension();
	if (!extension) throw new Error('Could not determine the current extension');
	return extension;
}

export function getSettings(extension, schema) {
	schema ??= extension.metadata['settings-schema'];

	const GioSSS = Gio.SettingsSchemaSource;
	const schemaDir = extension.dir.get_child('schemas');
	const schemaSource = schemaDir.query_exists(null)
		? GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false)
		: GioSSS.get_default();

	const schemaObj = schemaSource.lookup(schema, true);
	if (!schemaObj) throw new Error(`Schema ${schema} could not be found for extension ${extension.metadata.uuid}`);

	return new Gio.Settings({ settings_schema: schemaObj });
}

let domain = null;

function getDomain() {
	if (domain === null) {
		const extension = getCurrentExtension();
		const name = extension.metadata['gettext-domain'] ?? extension.uuid;
		const localeDir = extension.dir.get_child('locale');
		if (localeDir.query_exists(null)) Gettext.bindtextdomain(name, localeDir.get_path());
		domain = Gettext.domain(name);
	}
	return domain;
}

export function gettext(str) {
	return getDomain().gettext(str);
}

export function ngettext(str, strPlural, n) {
	return getDomain().ngettext(str, strPlural, n);
}

export function pgettext(context, str) {
	return getDomain().pgettext(context, str);
}

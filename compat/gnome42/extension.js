// GNOME 42 shim for resource:///org/gnome/shell/extensions/extension.js
import { getCurrentExtension, getSettings, gettext, ngettext, pgettext } from './common.js';

export { gettext, ngettext, pgettext } from './common.js';

export class Extension {
	constructor(extension) {
		// GNOME 42 passes the extension object to init()
		extension = extension?.metadata ? extension : getCurrentExtension();
		this.metadata = extension.metadata;
		this.uuid = extension.uuid;
		this.dir = extension.dir;
		this.path = extension.path;
	}

	getSettings(schema) {
		return getSettings(this, schema);
	}

	gettext(str) {
		return gettext(str);
	}

	ngettext(str, strPlural, n) {
		return ngettext(str, strPlural, n);
	}

	pgettext(context, str) {
		return pgettext(context, str);
	}

	openPreferences() {
		imports.ui.main.extensionManager.openExtensionPrefs(this.uuid, '', {});
	}

	enable() {}

	disable() {}
}

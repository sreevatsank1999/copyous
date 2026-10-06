// GNOME 42 shim for resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js
import { adaptPreferencesWindow } from './adw.js';
import { getCurrentExtension, getSettings, gettext, ngettext, pgettext } from './common.js';

export { gettext, ngettext, pgettext } from './common.js';

export class ExtensionPreferences {
	constructor(metadata) {
		// The GNOME 42 prefs dialog overrides getCurrentExtension() to return this extension
		const extension = getCurrentExtension();
		this.metadata = metadata ?? extension.metadata;
		this.uuid = extension.uuid;
		this.dir = extension.dir;
		this.path = extension.path;

		// Add the libadwaita 1.4 API the preferences use to the GNOME 42 preferences window
		const fillPreferencesWindow = this.fillPreferencesWindow;
		this.fillPreferencesWindow = (window) => {
			adaptPreferencesWindow(window);
			return fillPreferencesWindow.call(this, window);
		};
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

	fillPreferencesWindow(_window) {}
}

// GTK 4.10+ APIs used by the preferences, implemented on top of GTK 4.6 (GNOME 42).
const { Gdk, Gio, GLib, Gtk } = imports.gi;

const toSnakeCase = (key) =>
	key
		.replace(/-/g, '_')
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toLowerCase();

/**
 * Split construct properties into the ones in `names` (as snake_case) and the rest
 */
export function takeProps(params, names) {
	const taken = {};
	const rest = {};
	for (const [key, value] of Object.entries(params ?? {})) {
		const name = toSnakeCase(key);
		if (names.includes(name)) taken[name] = value;
		else rest[key] = value;
	}
	return [taken, rest];
}

function rootWindow(widget) {
	const root = widget instanceof Gtk.Widget ? widget.get_root() : null;
	return root instanceof Gtk.Window ? root : null;
}

// Gtk.FileDialog (4.10) on top of Gtk.FileChooserNative
class FileDialog {
	constructor(params = {}) {
		const [props] = takeProps(params, [
			'title',
			'modal',
			'accept_label',
			'initial_file',
			'initial_folder',
			'initial_name',
			'default_filter',
			'filters',
		]);
		this.title = props.title ?? '';
		this.modal = props.modal ?? true;
		this.accept_label = props.accept_label ?? null;
		this.initial_file = props.initial_file ?? null;
		this.initial_folder = props.initial_folder ?? null;
		this.initial_name = props.initial_name ?? null;
		this.default_filter = props.default_filter ?? null;
		this.filters = props.filters ?? null;
	}

	open(parent, cancellable, callback) {
		this._run(Gtk.FileChooserAction.OPEN, parent, cancellable, callback);
	}

	open_finish(result) {
		return this._finish(result);
	}

	select_folder(parent, cancellable, callback) {
		this._run(Gtk.FileChooserAction.SELECT_FOLDER, parent, cancellable, callback);
	}

	select_folder_finish(result) {
		return this._finish(result);
	}

	save(parent, cancellable, callback) {
		this._run(Gtk.FileChooserAction.SAVE, parent, cancellable, callback);
	}

	save_finish(result) {
		return this._finish(result);
	}

	_run(action, parent, cancellable, callback) {
		const chooser = new Gtk.FileChooserNative({
			title: this.title,
			action,
			modal: this.modal,
			transient_for: rootWindow(parent) ?? parent ?? null,
		});
		if (this.accept_label) chooser.accept_label = this.accept_label;

		const filters = [];
		if (this.filters) {
			for (let i = 0; i < this.filters.get_n_items(); i++) filters.push(this.filters.get_item(i));
		}
		if (this.default_filter && !filters.includes(this.default_filter)) filters.unshift(this.default_filter);
		filters.forEach((filter) => chooser.add_filter(filter));
		if (this.default_filter) chooser.filter = this.default_filter;

		try {
			if (this.initial_file && action !== Gtk.FileChooserAction.SAVE) chooser.set_file(this.initial_file);
			else if (this.initial_folder) chooser.set_current_folder(this.initial_folder);
			if (this.initial_name && action === Gtk.FileChooserAction.SAVE) chooser.set_current_name(this.initial_name);
		} catch {
			// The initial file or folder may not exist
		}

		let done = false;
		const finish = (result) => {
			if (done) return;
			done = true;
			chooser.destroy();
			callback?.(this, result);
		};

		chooser.connect('response', (_chooser, response) => {
			if (response === Gtk.ResponseType.ACCEPT) finish({ file: chooser.get_file() });
			else finish({ error: new GLib.Error(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED, 'Dismissed by user') });
		});
		cancellable?.connect('cancelled', () => {
			chooser.hide();
			finish({ error: new GLib.Error(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED, 'Cancelled') });
		});

		chooser.show();
	}

	_finish(result) {
		if (result.error) throw result.error;
		return result.file;
	}
}

// Gtk.FileLauncher (4.10) on top of Gtk.show_uri()
class FileLauncher {
	constructor(params = {}) {
		const [props] = takeProps(params, ['file', 'always_ask', 'writable']);
		this.file = props.file ?? null;
	}

	launch(parent, cancellable, callback) {
		this._show(this.file, parent, callback);
	}

	launch_finish(result) {
		if (result.error) throw result.error;
		return true;
	}

	open_containing_folder(parent, cancellable, callback) {
		this._show(this.file?.get_parent() ?? null, parent, callback);
	}

	open_containing_folder_finish(result) {
		return this.launch_finish(result);
	}

	_show(file, parent, callback) {
		let result = {};
		try {
			Gtk.show_uri(rootWindow(parent), file.get_uri(), Gdk.CURRENT_TIME);
		} catch (error) {
			result = { error };
		}

		if (callback) {
			GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
				callback(this, result);
				return GLib.SOURCE_REMOVE;
			});
		}
	}
}

// Gtk.ColorDialog (4.10): only holds the options used by ColorDialogButton
class ColorDialog {
	constructor(params = {}) {
		const [props] = takeProps(params, ['title', 'modal', 'with_alpha']);
		this.title = props.title ?? '';
		this.modal = props.modal ?? true;
		this.with_alpha = props.with_alpha ?? true;
	}
}

// Gtk.ColorDialogButton (4.10): a Gtk.ColorButton configured from a ColorDialog
class ColorDialogButton {
	constructor(params = {}) {
		const [props, rest] = takeProps(params, ['dialog', 'rgba']);
		const button = new Gtk.ColorButton(rest);
		const dialog = props.dialog ?? new ColorDialog();
		button.use_alpha = dialog.with_alpha;
		button.modal = dialog.modal;
		if (dialog.title) button.title = dialog.title;
		if (props.rgba) button.rgba = props.rgba;
		return button;
	}
}

// Gtk.FileFilter: the patterns, mime-types and suffixes properties were added in GTK 4.10
const FileFilter = Gtk.FileFilter.find_property('patterns')
	? Gtk.FileFilter
	: new Proxy(Gtk.FileFilter, {
			construct(target, [params = {}]) {
				const [props, rest] = takeProps(params, ['patterns', 'mime_types', 'suffixes']);
				const filter = new target(rest);
				(props.patterns ?? []).forEach((pattern) => filter.add_pattern(pattern));
				(props.mime_types ?? []).forEach((mimeType) => filter.add_mime_type(mimeType));
				(props.suffixes ?? []).forEach((suffix) => filter.add_suffix(suffix));
				return filter;
			},
		});

// Gtk.CenterBox: start-widget, center-widget and end-widget are not properties in GTK 4.6
const CENTER_BOX_CHILDREN = ['start', 'center', 'end'];
const CenterBox = Gtk.CenterBox.find_property('center-widget')
	? Gtk.CenterBox
	: new Proxy(Gtk.CenterBox, {
			construct(target, [params = {}]) {
				const [props, rest] = takeProps(
					params,
					CENTER_BOX_CHILDREN.map((c) => `${c}_widget`),
				);
				const box = new target(rest);
				for (const child of CENTER_BOX_CHILDREN) {
					const accessor = {
						get: () => box[`get_${child}_widget`](),
						set: (widget) => box[`set_${child}_widget`](widget),
						configurable: true,
					};
					Object.defineProperty(box, `${child}_widget`, accessor);
					Object.defineProperty(box, `${child}Widget`, accessor);
					if (props[`${child}_widget`] !== undefined) box[`set_${child}_widget`](props[`${child}_widget`]);
				}
				return box;
			},
		});

const overrides = {
	FileDialog: Gtk.FileDialog ?? FileDialog,
	FileLauncher: Gtk.FileLauncher ?? FileLauncher,
	ColorDialog: Gtk.ColorDialog ?? ColorDialog,
	ColorDialogButton: Gtk.ColorDialogButton ?? ColorDialogButton,
	FileFilter,
	CenterBox,
};

export default new Proxy(Gtk, {
	get: (target, prop) => (prop in overrides ? overrides[prop] : Reflect.get(target, prop)),
	has: (target, prop) => prop in overrides || Reflect.has(target, prop),
});

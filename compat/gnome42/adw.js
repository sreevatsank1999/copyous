// libadwaita 1.2-1.6 APIs used by the preferences, implemented on top of libadwaita 1.1 (GNOME 42).
import { takeProps } from './gtk.js';

const { Adw, Gdk, GLib, GObject, Gtk } = imports.gi;

const READWRITE = GObject.ParamFlags.READWRITE;

let cssProvider = null;

function ensureCss() {
	if (cssProvider) return;

	cssProvider = new Gtk.CssProvider();
	cssProvider.load_from_data(`
        .compat-dialog-backdrop { background-color: alpha(black, 0.25); }
        .compat-dialog {
            background-color: @window_bg_color;
            border-radius: 12px;
            margin: 12px;
            box-shadow: 0 1px 4px 1px alpha(black, 0.13), 0 1px 10px 5px alpha(black, 0.09), 0 0 0 1px alpha(black, 0.05);
        }
        .compat-alert-dialog { background-color: @popover_bg_color; }
        .compat-alert-dialog .compat-alert-content { margin: 24px 24px 20px 24px; }
        .compat-alert-dialog .compat-response-area button { border-radius: 0; min-height: 44px; margin: 0; }
        .compat-alert-dialog .compat-response-area button:not(:first-child) { border-left: 1px solid alpha(currentColor, 0.15); }
        .compat-alert-dialog .compat-response-area button.suggested-action { background: none; color: @accent_color; }
        .compat-alert-dialog .compat-response-area button.destructive-action { background: none; color: @destructive_color; }
        .compat-alert-dialog .compat-response-area button:hover { background-color: alpha(currentColor, 0.07); }
    `);
	Gtk.StyleContext.add_provider_for_display(
		Gdk.Display.get_default(),
		cssProvider,
		Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
	);
}

function findDescendant(widget, predicate) {
	for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) {
		if (predicate(child)) return child;
		const found = findDescendant(child, predicate);
		if (found) return found;
	}
	return null;
}

// Adw.ResponseAppearance (1.2)
const ResponseAppearance = Adw.ResponseAppearance ?? { DEFAULT: 0, SUGGESTED: 1, DESTRUCTIVE: 2 };

// Adw.ActionRow: subtitle-selectable was added in 1.3
const ActionRow = GObject.registerClass(
	class ActionRow extends Adw.ActionRow {
		constructor(params = {}) {
			const [, rest] = takeProps(params, ['subtitle_selectable']);
			super(rest);
		}
	},
);

// Adw.ExpanderRow.add_suffix() was added in 1.4 (add_action() before)
const ExpanderRow = GObject.registerClass(
	class ExpanderRow extends Adw.ExpanderRow {
		add_suffix(widget) {
			this.add_action(widget);
		}
	},
);

// Adw.SwitchRow (1.4)
const SwitchRow = GObject.registerClass(
	{
		Properties: {
			active: GObject.ParamSpec.boolean('active', '', '', READWRITE, false),
		},
	},
	class SwitchRow extends Adw.ActionRow {
		constructor(params = {}) {
			const [props, rest] = takeProps(params, ['active']);
			super(rest);

			this._switch = new Gtk.Switch({
				valign: Gtk.Align.CENTER,
				can_focus: false,
				active: props.active ?? false,
			});
			this._switch.connect('notify::active', () => this.notify('active'));
			this.add_suffix(this._switch);
			this.activatable_widget = this._switch;
		}

		get active() {
			return this._switch?.active ?? false;
		}

		set active(active) {
			if (this._switch && this._switch.active !== active) this._switch.active = active;
		}
	},
);

// Adw.SpinRow (1.4)
const SpinRow = GObject.registerClass(
	{
		Properties: {
			'adjustment': GObject.ParamSpec.object('adjustment', '', '', READWRITE, Gtk.Adjustment.$gtype),
			'climb-rate': GObject.ParamSpec.double('climb-rate', '', '', READWRITE, 0, Number.MAX_VALUE, 0),
			'digits': GObject.ParamSpec.uint('digits', '', '', READWRITE, 0, 20, 0),
			'numeric': GObject.ParamSpec.boolean('numeric', '', '', READWRITE, false),
			'snap-to-ticks': GObject.ParamSpec.boolean('snap-to-ticks', '', '', READWRITE, false),
			'value': GObject.ParamSpec.double('value', '', '', READWRITE, -Number.MAX_VALUE, Number.MAX_VALUE, 0),
			'wrap': GObject.ParamSpec.boolean('wrap', '', '', READWRITE, false),
		},
	},
	class SpinRow extends Adw.ActionRow {
		constructor(params = {}) {
			const names = [
				'adjustment',
				'climb_rate',
				'digits',
				'numeric',
				'snap_to_ticks',
				'value',
				'wrap',
				'update_policy',
			];
			const [props, rest] = takeProps(params, names);
			super(rest);

			this._spin = new Gtk.SpinButton({
				valign: Gtk.Align.CENTER,
				adjustment: props.adjustment ?? new Gtk.Adjustment(),
				climb_rate: props.climb_rate ?? 0,
				digits: props.digits ?? 0,
				numeric: props.numeric ?? false,
				snap_to_ticks: props.snap_to_ticks ?? false,
				wrap: props.wrap ?? false,
			});
			if (props.update_policy !== undefined) this._spin.update_policy = props.update_policy;
			if (props.value !== undefined) this._spin.value = props.value;

			for (const name of ['adjustment', 'climb-rate', 'digits', 'numeric', 'snap-to-ticks', 'value', 'wrap'])
				this._spin.connect(`notify::${name}`, () => this.notify(name));

			this.add_suffix(this._spin);
			this.activatable_widget = this._spin;
		}

		get adjustment() {
			return this._spin?.adjustment ?? null;
		}
		set adjustment(adjustment) {
			if (this._spin) this._spin.adjustment = adjustment;
		}
		get climb_rate() {
			return this._spin?.climb_rate ?? 0;
		}
		set climb_rate(rate) {
			if (this._spin) this._spin.climb_rate = rate;
		}
		get digits() {
			return this._spin?.digits ?? 0;
		}
		set digits(digits) {
			if (this._spin) this._spin.digits = digits;
		}
		get numeric() {
			return this._spin?.numeric ?? false;
		}
		set numeric(numeric) {
			if (this._spin) this._spin.numeric = numeric;
		}
		get snap_to_ticks() {
			return this._spin?.snap_to_ticks ?? false;
		}
		set snap_to_ticks(snap) {
			if (this._spin) this._spin.snap_to_ticks = snap;
		}
		get wrap() {
			return this._spin?.wrap ?? false;
		}
		set wrap(wrap) {
			if (this._spin) this._spin.wrap = wrap;
		}

		get value() {
			return this._spin?.value ?? 0;
		}

		set value(value) {
			if (this._spin && this._spin.value !== value) this._spin.value = value;
		}

		get_value() {
			return this.value;
		}
		set_value(value) {
			this.value = value;
		}
		get_adjustment() {
			return this.adjustment;
		}
		set_adjustment(adjustment) {
			this.adjustment = adjustment;
		}

		configure(adjustment, climbRate, digits) {
			this._spin.configure(adjustment, climbRate, digits);
		}

		update() {
			this._spin.update();
		}
	},
);

// Adw.EntryRow (1.2): a row with an entry instead of a floating title
const EntryRow = GObject.registerClass(
	{
		Properties: {
			'text': GObject.ParamSpec.string('text', '', '', READWRITE, ''),
			'show-apply-button': GObject.ParamSpec.boolean('show-apply-button', '', '', READWRITE, false),
			'activates-default': GObject.ParamSpec.boolean('activates-default', '', '', READWRITE, false),
		},
		Signals: {
			'changed': {},
			'apply': {},
			'entry-activated': {},
		},
	},
	class EntryRow extends Adw.ActionRow {
		constructor(params = {}) {
			const [props, rest] = takeProps(params, [
				'text',
				'show_apply_button',
				'activates_default',
				'input_purpose',
				'input_hints',
			]);
			super(rest);

			this._entry = new Gtk.Entry({
				valign: Gtk.Align.CENTER,
				hexpand: true,
				text: props.text ?? '',
				activates_default: props.activates_default ?? false,
			});
			if (props.input_purpose !== undefined) this._entry.input_purpose = props.input_purpose;
			if (props.input_hints !== undefined) this._entry.input_hints = props.input_hints;

			this._entry.connect('changed', () => {
				this.notify('text');
				this.emit('changed');
			});
			this._entry.connect('activate', () => {
				this.emit('entry-activated');
				this.emit('apply');
			});
			this._entry.connect('notify::activates-default', () => this.notify('activates-default'));

			this.add_suffix(this._entry);
			this.activatable_widget = this._entry;
		}

		get text() {
			return this._entry?.text ?? '';
		}

		set text(text) {
			if (this._entry && this._entry.text !== text) this._entry.text = text ?? '';
		}

		get show_apply_button() {
			return false;
		}
		set show_apply_button(_show) {}
		get activates_default() {
			return this._entry?.activates_default ?? false;
		}
		set activates_default(activates) {
			if (this._entry) this._entry.activates_default = activates;
		}

		get_text() {
			return this.text;
		}
		set_text(text) {
			this.text = text;
		}

		grab_focus() {
			return this._entry.grab_focus();
		}

		select_region(start, end) {
			this._entry.select_region(start, end);
		}
	},
);

// Adw.ToolbarView (1.4)
const ToolbarView = GObject.registerClass(
	{
		Properties: {
			'content': GObject.ParamSpec.object('content', '', '', READWRITE, Gtk.Widget.$gtype),
			'extend-content-to-top-edge': GObject.ParamSpec.boolean(
				'extend-content-to-top-edge',
				'',
				'',
				READWRITE,
				false,
			),
			'extend-content-to-bottom-edge': GObject.ParamSpec.boolean(
				'extend-content-to-bottom-edge',
				'',
				'',
				READWRITE,
				false,
			),
			'reveal-top-bars': GObject.ParamSpec.boolean('reveal-top-bars', '', '', READWRITE, true),
			'reveal-bottom-bars': GObject.ParamSpec.boolean('reveal-bottom-bars', '', '', READWRITE, true),
		},
	},
	class ToolbarView extends Gtk.Box {
		constructor(params = {}) {
			const [props, rest] = takeProps(params, [
				'content',
				'extend_content_to_top_edge',
				'extend_content_to_bottom_edge',
				'reveal_top_bars',
				'reveal_bottom_bars',
				'top_bar_style',
				'bottom_bar_style',
			]);
			super({ ...rest, orientation: Gtk.Orientation.VERTICAL });

			this._topBars = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
			this.append(this._topBars);

			this._contentBin = new Adw.Bin({ hexpand: true, vexpand: true });
			this.append(this._contentBin);

			this._bottomBars = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
			this.append(this._bottomBars);

			if (props.content) this.content = props.content;
		}

		get content() {
			return this._contentBin?.child ?? null;
		}

		set content(content) {
			if (!this._contentBin || this._contentBin.child === content) return;
			this._contentBin.child = content;
			this.notify('content');
		}

		get extend_content_to_top_edge() {
			return false;
		}
		set extend_content_to_top_edge(_extend) {}
		get extend_content_to_bottom_edge() {
			return false;
		}
		set extend_content_to_bottom_edge(_extend) {}
		get reveal_top_bars() {
			return this._topBars?.visible ?? true;
		}
		set reveal_top_bars(reveal) {
			if (this._topBars) this._topBars.visible = reveal;
		}
		get reveal_bottom_bars() {
			return this._bottomBars?.visible ?? true;
		}
		set reveal_bottom_bars(reveal) {
			if (this._bottomBars) this._bottomBars.visible = reveal;
		}

		get_content() {
			return this.content;
		}
		set_content(content) {
			this.content = content;
		}

		add_top_bar(widget) {
			this._topBars.append(widget);
		}

		add_bottom_bar(widget) {
			this._bottomBars.append(widget);
		}
	},
);

// Adw.NavigationPage (1.4), shown with PreferencesWindow.push_subpage() (see adaptPreferencesWindow)
const NavigationPage = GObject.registerClass(
	{
		Properties: {
			'title': GObject.ParamSpec.string('title', '', '', READWRITE, ''),
			'tag': GObject.ParamSpec.string('tag', '', '', READWRITE, null),
			'can-pop': GObject.ParamSpec.boolean('can-pop', '', '', READWRITE, true),
		},
		Signals: {
			showing: {},
			shown: {},
			hiding: {},
			hidden: {},
		},
	},
	class NavigationPage extends Adw.Bin {
		constructor(params = {}) {
			const [props, rest] = takeProps(params, ['title', 'tag', 'can_pop']);
			super(rest);
			this._title = props.title ?? '';
			this._tag = props.tag ?? null;
			this._canPop = props.can_pop ?? true;
		}

		get title() {
			return this._title ?? '';
		}
		set title(title) {
			if (this._title !== title) {
				this._title = title;
				this.notify('title');
			}
		}
		get tag() {
			return this._tag ?? null;
		}
		set tag(tag) {
			if (this._tag !== tag) {
				this._tag = tag;
				this.notify('tag');
			}
		}
		get can_pop() {
			return this._canPop ?? true;
		}
		set can_pop(canPop) {
			if (this._canPop !== canPop) {
				this._canPop = canPop;
				this.notify('can-pop');
			}
		}

		get_title() {
			return this.title;
		}
		set_title(title) {
			this.title = title;
		}
	},
);

// Adw.Dialog (1.5). Like libadwaita, dialogs are shown inside their window (in an overlay above
// the window content) instead of as separate windows; see adaptPreferencesWindow().
const Dialog = GObject.registerClass(
	{
		Properties: {
			'title': GObject.ParamSpec.string('title', '', '', READWRITE, ''),
			'content-width': GObject.ParamSpec.int('content-width', '', '', READWRITE, -1, GLib.MAXINT32, -1),
			'content-height': GObject.ParamSpec.int('content-height', '', '', READWRITE, -1, GLib.MAXINT32, -1),
			'can-close': GObject.ParamSpec.boolean('can-close', '', '', READWRITE, true),
			'follows-content-size': GObject.ParamSpec.boolean('follows-content-size', '', '', READWRITE, false),
			'focus-widget': GObject.ParamSpec.object('focus-widget', '', '', READWRITE, Gtk.Widget.$gtype),
		},
		Signals: {
			'closed': {},
			'close-attempt': {},
		},
	},
	class Dialog extends Adw.Bin {
		constructor(params = {}) {
			const [props, rest] = takeProps(params, [
				'title',
				'content_width',
				'content_height',
				'can_close',
				'follows_content_size',
				'presentation_mode',
				'focus_widget',
			]);
			super({ focusable: true, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER, ...rest });
			this.add_css_class('compat-dialog');
			this.overflow = Gtk.Overflow.HIDDEN;

			this._title = props.title ?? '';
			this._canClose = props.can_close ?? true;
			this._followsContentSize = props.follows_content_size ?? false;
			this._focusWidget = props.focus_widget ?? null;
			this._contentWidth = props.content_width ?? -1;
			this._contentHeight = props.content_height ?? -1;
			this.set_size_request(this._contentWidth, this._contentHeight);

			this._layer = null;
			this._overlay = null;
			this._window = null;
			this._previousFocus = null;

			const keyController = new Gtk.EventControllerKey();
			keyController.connect('key-pressed', (_controller, keyval, _keycode, state) => {
				if (keyval !== Gdk.KEY_Escape || (state & Gtk.accelerator_get_default_mod_mask()) !== 0)
					return Gdk.EVENT_PROPAGATE;
				this.close();
				return Gdk.EVENT_STOP;
			});
			this.add_controller(keyController);
		}

		get title() {
			return this._title ?? '';
		}
		set title(title) {
			if (this._title !== title) {
				this._title = title ?? '';
				this.notify('title');
			}
		}
		get content_width() {
			return this._contentWidth ?? -1;
		}
		set content_width(width) {
			this._contentWidth = width;
			this.set_size_request(width, this.content_height);
			this.notify('content-width');
		}
		get content_height() {
			return this._contentHeight ?? -1;
		}
		set content_height(height) {
			this._contentHeight = height;
			this.set_size_request(this.content_width, height);
			this.notify('content-height');
		}
		get can_close() {
			return this._canClose ?? true;
		}
		set can_close(canClose) {
			this._canClose = canClose;
			this.notify('can-close');
		}
		get follows_content_size() {
			return this._followsContentSize ?? false;
		}
		set follows_content_size(follows) {
			this._followsContentSize = follows;
			this.notify('follows-content-size');
		}
		get focus_widget() {
			return this._focusWidget ?? null;
		}
		set focus_widget(widget) {
			this._focusWidget = widget;
			if (this._layer) widget?.grab_focus();
			this.notify('focus-widget');
		}

		get_title() {
			return this.title;
		}
		set_title(title) {
			this.title = title;
		}

		present(parent = null) {
			if (this._layer) return;

			ensureCss();
			this._adaptHeaderBars();

			const window = parent instanceof Gtk.Widget ? parent.get_root() : null;
			this._layer = new Adw.Bin({ child: this, css_classes: ['compat-dialog-backdrop'] });
			this._overlay = window?._compatDialogOverlay ?? null;

			if (this._overlay) {
				// Block the window content while the dialog is open
				this._window = window;
				this._previousFocus = window.get_focus();
				this._overlay._compatDialogs = (this._overlay._compatDialogs ?? 0) + 1;
				this._overlay.get_child().can_focus = false;
				this._overlay.add_overlay(this._layer);
			} else {
				// Fallback: show the dialog in its own window
				this._window = new Adw.Window({
					modal: true,
					resizable: false,
					transient_for: window instanceof Gtk.Window ? window : null,
					content: this._layer,
					title: this.title,
				});
				this._window.connect('close-request', () => {
					this.close();
					return true;
				});
				this._window.present();
			}

			GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
				if (this._layer && !(this._focusWidget?.grab_focus() ?? false))
					this.child?.child_focus(Gtk.DirectionType.TAB_FORWARD) || this.grab_focus();
				return GLib.SOURCE_REMOVE;
			});
		}

		close() {
			if (!this._layer) return;
			if (!this._canClose) {
				this.emit('close-attempt');
				return;
			}
			this.force_close();
		}

		force_close() {
			const layer = this._layer;
			if (!layer) return;
			this._layer = null;

			if (this._overlay) {
				const overlay = this._overlay;
				overlay.remove_overlay(layer);
				overlay._compatDialogs -= 1;
				if (overlay._compatDialogs === 0) overlay.get_child().can_focus = true;
				this._previousFocus?.grab_focus();
			} else if (this._window) {
				this._window.set_content(null);
				this._window.destroy();
			}

			this._overlay = null;
			this._window = null;
			this._previousFocus = null;
			layer.child = null;
			this.emit('closed');
		}

		// Header bars in dialogs close the dialog instead of the window
		_adaptHeaderBars() {
			const headerBars = [];
			const collect = (widget) => {
				for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) {
					if (child instanceof Adw.HeaderBar) headerBars.push(child);
					collect(child);
				}
			};
			collect(this);

			for (const headerBar of headerBars) {
				if (headerBar._compatDialogHeaderBar) continue;
				headerBar._compatDialogHeaderBar = true;
				headerBar.show_start_title_buttons = false;
				headerBar.show_end_title_buttons = false;

				const close = new Gtk.Button({
					icon_name: 'window-close-symbolic',
					valign: Gtk.Align.CENTER,
					css_classes: ['circular'],
				});
				close.connect('clicked', () => this.close());
				headerBar.pack_end(close);

				const title = new Adw.WindowTitle({ title: this.title });
				this.bind_property('title', title, 'title', GObject.BindingFlags.SYNC_CREATE);
				headerBar.title_widget = title;
			}
		}
	},
);

// Adw.AlertDialog (1.5)
const AlertDialog = GObject.registerClass(
	{
		Properties: {
			'heading': GObject.ParamSpec.string('heading', '', '', READWRITE, ''),
			'body': GObject.ParamSpec.string('body', '', '', READWRITE, ''),
			'heading-use-markup': GObject.ParamSpec.boolean('heading-use-markup', '', '', READWRITE, false),
			'body-use-markup': GObject.ParamSpec.boolean('body-use-markup', '', '', READWRITE, false),
			'extra-child': GObject.ParamSpec.object('extra-child', '', '', READWRITE, Gtk.Widget.$gtype),
			'default-response': GObject.ParamSpec.string('default-response', '', '', READWRITE, null),
			'close-response': GObject.ParamSpec.string('close-response', '', '', READWRITE, 'close'),
			'prefer-wide-layout': GObject.ParamSpec.boolean('prefer-wide-layout', '', '', READWRITE, false),
		},
		Signals: {
			response: { param_types: [GObject.TYPE_STRING], flags: GObject.SignalFlags.RUN_LAST },
		},
	},
	class AlertDialog extends Dialog {
		constructor(params = {}) {
			const [props, rest] = takeProps(params, [
				'heading',
				'body',
				'heading_use_markup',
				'body_use_markup',
				'extra_child',
				'default_response',
				'close_response',
				'prefer_wide_layout',
			]);
			super(rest);
			this.add_css_class('compat-alert-dialog');

			this._responses = new Map();
			this._responding = false;

			const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
			const content = new Gtk.Box({
				orientation: Gtk.Orientation.VERTICAL,
				spacing: 10,
				width_request: 300,
				css_classes: ['compat-alert-content'],
			});
			box.append(content);

			this._headingLabel = new Gtk.Label({
				css_classes: ['title-2'],
				wrap: true,
				max_width_chars: 30,
				justify: Gtk.Justification.CENTER,
				visible: false,
			});
			content.append(this._headingLabel);

			this._bodyLabel = new Gtk.Label({
				wrap: true,
				max_width_chars: 40,
				justify: Gtk.Justification.CENTER,
				visible: false,
			});
			content.append(this._bodyLabel);

			this._extraBin = new Adw.Bin({ margin_top: 8, visible: false });
			content.append(this._extraBin);

			box.append(new Gtk.Separator());
			this._responseArea = new Gtk.Box({ homogeneous: true, css_classes: ['compat-response-area'] });
			box.append(this._responseArea);
			this.child = box;

			this._closeResponse = props.close_response ?? 'close';
			this._defaultResponse = props.default_response ?? null;
			this.heading = props.heading ?? '';
			this.body = props.body ?? '';
			this.heading_use_markup = props.heading_use_markup ?? false;
			this.body_use_markup = props.body_use_markup ?? false;
			this.extra_child = props.extra_child ?? null;

			// Enter activates the default response
			const keyController = new Gtk.EventControllerKey();
			keyController.connect('key-pressed', (_controller, keyval) => {
				if (keyval !== Gdk.KEY_Return && keyval !== Gdk.KEY_KP_Enter && keyval !== Gdk.KEY_ISO_Enter)
					return Gdk.EVENT_PROPAGATE;
				if (!this._defaultResponse || !this.get_response_enabled(this._defaultResponse))
					return Gdk.EVENT_PROPAGATE;
				this._respond(this._defaultResponse);
				return Gdk.EVENT_STOP;
			});
			this.add_controller(keyController);
		}

		get heading() {
			return this._heading ?? '';
		}
		set heading(heading) {
			this._heading = heading ?? '';
			this._headingLabel.label = this._heading;
			this._headingLabel.visible = this._heading !== '';
			this.notify('heading');
		}

		get body() {
			return this._body ?? '';
		}
		set body(body) {
			this._body = body ?? '';
			this._bodyLabel.label = this._body;
			this._bodyLabel.visible = this._body !== '';
			this.notify('body');
		}

		get heading_use_markup() {
			return this._headingLabel?.use_markup ?? false;
		}
		set heading_use_markup(useMarkup) {
			this._headingLabel.use_markup = useMarkup;
			this.notify('heading-use-markup');
		}
		get body_use_markup() {
			return this._bodyLabel?.use_markup ?? false;
		}
		set body_use_markup(useMarkup) {
			this._bodyLabel.use_markup = useMarkup;
			this.notify('body-use-markup');
		}

		get extra_child() {
			return this._extraBin?.child ?? null;
		}
		set extra_child(child) {
			this._extraBin.child = child;
			this._extraBin.visible = child !== null;
			this.notify('extra-child');
		}

		get default_response() {
			return this._defaultResponse ?? null;
		}
		set default_response(response) {
			this._defaultResponse = response;
			for (const [id, { button }] of this._responses ?? []) {
				if (id === response) button.add_css_class('default');
				else button.remove_css_class('default');
			}
			this.notify('default-response');
		}

		get close_response() {
			return this._closeResponse ?? 'close';
		}
		set close_response(response) {
			this._closeResponse = response;
			this.notify('close-response');
		}

		get prefer_wide_layout() {
			return false;
		}
		set prefer_wide_layout(_prefer) {}

		get_heading() {
			return this.heading;
		}
		set_heading(heading) {
			this.heading = heading;
		}
		get_body() {
			return this.body;
		}
		set_body(body) {
			this.body = body;
		}
		get_extra_child() {
			return this.extra_child;
		}
		set_extra_child(child) {
			this.extra_child = child;
		}
		get_default_response() {
			return this.default_response;
		}
		set_default_response(response) {
			this.default_response = response;
		}
		get_close_response() {
			return this.close_response;
		}
		set_close_response(response) {
			this.close_response = response;
		}

		add_response(id, label) {
			const button = new Gtk.Button({ label, use_underline: true, hexpand: true, css_classes: ['flat'] });
			button.connect('clicked', () => this._respond(id));
			this._responseArea.append(button);
			this._responses.set(id, { button, enabled: true, appearance: ResponseAppearance.DEFAULT });
		}

		remove_response(id) {
			const response = this._responses.get(id);
			if (!response) return;
			this._responseArea.remove(response.button);
			this._responses.delete(id);
		}

		has_response(id) {
			return this._responses.has(id);
		}

		get_response_label(id) {
			return this._responses.get(id)?.button.label ?? null;
		}

		set_response_label(id, label) {
			const response = this._responses.get(id);
			if (response) response.button.label = label;
		}

		get_response_appearance(id) {
			return this._responses.get(id)?.appearance ?? ResponseAppearance.DEFAULT;
		}

		set_response_appearance(id, appearance) {
			const response = this._responses.get(id);
			if (!response) return;
			response.appearance = appearance;
			response.button.remove_css_class('suggested-action');
			response.button.remove_css_class('destructive-action');
			if (appearance === ResponseAppearance.SUGGESTED) response.button.add_css_class('suggested-action');
			else if (appearance === ResponseAppearance.DESTRUCTIVE) response.button.add_css_class('destructive-action');
		}

		get_response_enabled(id) {
			return this._responses.get(id)?.enabled ?? false;
		}

		set_response_enabled(id, enabled) {
			const response = this._responses.get(id);
			if (!response) return;
			response.enabled = enabled;
			response.button.sensitive = enabled;
		}

		// Adw.AlertDialog.choose(); resolves after the response signal (and on_response) ran
		choose(parent, cancellable, callback) {
			let responseId = 0;
			let cancelledId = 0;
			responseId = this.connect_after('response', (_dialog, response) => {
				this.disconnect(responseId);
				if (cancelledId) cancellable.disconnect(cancelledId);
				callback?.(this, response);
			});
			if (cancellable) cancelledId = cancellable.connect('cancelled', () => this.close());

			this.present(parent);
		}

		choose_finish(result) {
			return result;
		}

		// Closing the dialog (Escape) responds with the close response
		close() {
			if (this._layer && !this._responding && this.can_close) this._respond(this._closeResponse, true);
			super.close();
		}

		_respond(id, fromClose = false) {
			if (this._responding) return;

			const response = this._responses.get(id);
			if (!fromClose && response && !response.enabled) return;

			this._responding = true;
			try {
				this.emit('response', id);
				if (!fromClose) this.force_close();
			} finally {
				this._responding = false;
			}
		}
	},
);

/**
 * Libadwaita 1.1's PreferencesWindow presents subpages with present_subpage() and has no
 * push_subpage(); NavigationPage header bars also need their own back button and title.
 */
export function adaptPreferencesWindow(window) {
	if (window.push_subpage) return;

	// Overlay to show dialogs in
	const content = window.get_content();
	const overlay = new Gtk.Overlay();
	window.set_content(overlay);
	overlay.set_child(content);
	window._compatDialogOverlay = overlay;

	window.push_subpage = (page) => {
		if (!page._compatSubpage) {
			page._compatSubpage = true;
			const headerBar = findDescendant(page, (widget) => widget instanceof Adw.HeaderBar);
			if (headerBar) {
				const back = new Gtk.Button({ icon_name: 'go-previous-symbolic', valign: Gtk.Align.CENTER });
				back.connect('clicked', () => window.close_subpage());
				headerBar.pack_start(back);

				const title = new Adw.WindowTitle({ title: page.title ?? '' });
				page.bind_property?.('title', title, 'title', GObject.BindingFlags.SYNC_CREATE);
				headerBar.title_widget = title;
			}
		}
		window.present_subpage(page);
	};
	window.pop_subpage = () => window.close_subpage();
}

const overrides = {
	ActionRow,
	AlertDialog: Adw.AlertDialog ?? AlertDialog,
	Dialog: Adw.Dialog ?? Dialog,
	EntryRow: Adw.EntryRow ?? EntryRow,
	ExpanderRow,
	NavigationPage: Adw.NavigationPage ?? NavigationPage,
	ResponseAppearance,
	SpinRow: Adw.SpinRow ?? SpinRow,
	SwitchRow: Adw.SwitchRow ?? SwitchRow,
	ToolbarView: Adw.ToolbarView ?? ToolbarView,
};

export default new Proxy(Adw, {
	get: (target, prop) => (prop in overrides ? overrides[prop] : Reflect.get(target, prop)),
	has: (target, prop) => prop in overrides || Reflect.has(target, prop),
});

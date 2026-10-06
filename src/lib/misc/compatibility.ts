import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import type St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';

export const VERSION: number = Number(Config.PACKAGE_VERSION.split('.')[0]);

/**
 * In GNOME 45 and older, St.ScrollView only connects its adjustments to a child that is added
 * through Clutter.Container.add_actor()
 */
export function setScrollViewChild(scrollView: St.ScrollView, child: St.Scrollable & Clutter.Actor) {
	const container = scrollView as St.ScrollView & { add_actor?(actor: Clutter.Actor): void };
	if (container.add_actor) container.add_actor(child);
	else scrollView.set_child(child);
}

/**
 * Clutter in GNOME 42 only marks x/y-expand as explicitly set when the value changes, so setting
 * it to its default (false) does not stop the expand flags of children from propagating
 */
export function setExpand(actor: Clutter.Actor, orientation: 'x' | 'y', expand: boolean) {
	const property = orientation === 'x' ? 'x_expand' : 'y_expand';
	if (!expand) actor[property] = true;
	actor[property] = expand;
}

/**
 * Clutter.Text in GNOME 42 reports the descent of the first line instead of its height as the minimum
 * height of wrapped and ellipsized text, so use the height of the first line as the minimum height
 */
export function getLabelPreferredHeight(label: St.Label, forWidth: number): [number, number] {
	const [min, nat] = label.get_preferred_height(forWidth);
	const text = label.clutter_text;
	if (!text.line_wrap || text.single_line_mode || text.ellipsize === Pango.EllipsizeMode.NONE) return [min, nat];

	const [, logical] = text.get_layout().get_iter().get_line_extents();
	if (!logical) return [min, nat];

	const padding = label.get_theme_node().get_vertical_padding();
	const lineHeight = Math.ceil(logical.height / Pango.SCALE / text.get_resource_scale()) + padding;
	return [Math.max(min, Math.min(lineHeight, nat)), nat];
}

/**
 * Event vfuncs receive the specific event struct (Clutter.KeyEvent, Clutter.ButtonEvent, ...) in GNOME 42,
 * which has no methods; use the event that is currently being processed instead
 */
export function getEvent(vfuncEvent: Clutter.Event): Clutter.Event {
	return vfuncEvent instanceof Clutter.Event ? vfuncEvent : (Clutter.get_current_event() ?? vfuncEvent);
}

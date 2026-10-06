import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import St from 'gi://St';

import { gettext as _, ngettext } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import type CopyousExtension from '../../extension.js';
import { ItemType } from '../common/constants.js';
import { registerClass } from '../common/gjs.js';
import { Icon, loadIcon } from '../common/icons.js';
import { ClipboardEntry } from '../database/database.js';
import { normalizeIndentation, trim } from '../ui/components/label.js';
import { commonDirectory } from '../ui/items/filesItem.js';
import { VERSION } from './compatibility.js';

interface NotificationParams {
	source: MessageTray.Source;
	title: string;
	body: string;
	gicon: Gio.Icon | St.ImageContent;
	isTransient?: boolean;
}

// GNOME 45 and older use positional arguments for message tray sources and notifications
function createSource(title: string, icon: Gio.Icon): MessageTray.Source {
	if (VERSION >= 46) return new MessageTray.Source({ title, icon });

	const LegacySource = MessageTray.Source as unknown as new (
		title: string,
		iconName: string | null,
	) => MessageTray.Source & { getIcon(): Gio.Icon };
	const source = new LegacySource(title, null);
	source.getIcon = () => icon;
	return source;
}

function createNotification(params: NotificationParams): MessageTray.Notification {
	if (VERSION >= 46) return new MessageTray.Notification(params);

	const LegacyNotification = MessageTray.Notification as unknown as new (
		source: MessageTray.Source,
		title: string,
		banner: string,
		params: { gicon: Gio.Icon | St.ImageContent },
	) => MessageTray.Notification & { setTransient(isTransient: boolean): void };
	const notification = new LegacyNotification(params.source, params.title, params.body, { gicon: params.gicon });
	notification.setTransient(params.isTransient ?? false);
	return notification;
}

function addNotification(source: MessageTray.Source, notification: MessageTray.Notification) {
	if (VERSION >= 46) source.addNotification(notification);
	else (source as unknown as { showNotification(n: MessageTray.Notification): void }).showNotification(notification);
}

@registerClass()
export class NotificationManager extends GObject.Object {
	private _source: MessageTray.Source | null = null;

	constructor(private ext: CopyousExtension) {
		super();
	}

	private get source() {
		if (this._source) return this._source;

		this._source = createSource(this.ext.metadata.name, loadIcon(this.ext, Icon.Clipboard));

		this._source.connect('destroy', () => (this._source = null));
		Main.messageTray.add(this._source);
		return this._source;
	}

	public warning(title: string, body: string, ...actions: [label: string, callback: () => void][]) {
		const source = this.source;
		const notification = createNotification({
			source,
			title,
			body,
			gicon: loadIcon(this.ext, Icon.Warning),
		});

		for (const [label, callback] of actions) {
			notification.addAction(label, callback);
		}

		addNotification(source, notification);
	}

	public textNotification(text: string) {
		if (!this.ext.settings.get_boolean('send-notification')) return;

		const source = this.source;
		const notification = createNotification({
			source,
			title: _('Copied Text'),
			body: text,
			gicon: loadIcon(this.ext, Icon.Text),
			isTransient: true,
		});
		addNotification(source, notification);
	}

	private createImageContent(pixbuf: GdkPixbuf.Pixbuf): St.ImageContent {
		const pixels = pixbuf.get_pixels();
		const content = new St.ImageContent({
			preferred_width: pixbuf.width,
			preferred_height: pixbuf.height,
		});

		// The cogl context argument was added in GNOME 47
		const stage = global.stage as typeof global.stage & { context?: typeof global.stage.context };
		if (stage.context) {
			const context = stage.context.get_backend().get_cogl_context();
			content.set_bytes(
				context,
				pixels,
				Cogl.PixelFormat.RGBA_8888,
				pixbuf.width,
				pixbuf.height,
				pixbuf.rowstride,
			);
		} else {
			const legacy = content as unknown as {
				set_bytes(data: Uint8Array, format: Cogl.PixelFormat, w: number, h: number, stride: number): boolean;
			};
			legacy.set_bytes(pixels, Cogl.PixelFormat.RGBA_8888, pixbuf.width, pixbuf.height, pixbuf.rowstride);
		}
		return content;
	}

	public imageNotification(bytes: GLib.Bytes | Uint8Array, width: number, height: number) {
		if (!this.ext.settings.get_boolean('send-notification')) return;

		let gicon: Gio.Icon | St.ImageContent;
		try {
			const stream = Gio.MemoryInputStream.new_from_bytes(bytes);
			const pixbuf = GdkPixbuf.Pixbuf.new_from_stream_at_scale(stream, 256, 256, true, null);
			gicon = this.createImageContent(pixbuf);
		} catch (error) {
			this.ext.logger.error(error);
			return;
		}

		const source = this.source;
		const notification = createNotification({
			source,
			title: _('Copied Image'),
			body: _('Size: %d×%d px').format(width, height),
			gicon,
			isTransient: true,
		});
		addNotification(source, notification);
	}

	public notification(entry: ClipboardEntry) {
		if (!this.ext.settings.get_boolean('send-notification')) return;

		let title: string;
		let body: string | null = normalizeIndentation(trim(entry.content), 4);
		let gicon: Gio.Icon | St.ImageContent;
		switch (entry.type) {
			case ItemType.Text:
				title = _('Copied Text');
				gicon = loadIcon(this.ext, Icon.Text);
				break;
			case ItemType.Code:
				title = _('Copied Code');
				gicon = loadIcon(this.ext, Icon.Code);
				break;
			case ItemType.Image: {
				const file = body.substring('file://'.length);
				title = _('Copied Image');

				try {
					const [, width, height] = GdkPixbuf.Pixbuf.get_file_info(file);
					const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file, 256, 256, true);
					gicon = this.createImageContent(pixbuf);
					body = _('Size: %d×%d px').format(width, height);
				} catch (error) {
					this.ext.logger.error(error);
					return;
				}

				break;
			}
			case ItemType.File:
			case ItemType.Files: {
				const files = body.split('\n').map((f) => Gio.file_new_for_uri(f));
				const common = files.length === 1 ? files[0]! : commonDirectory(files);

				title = ngettext('Copied %d File', 'Copied %d Files', files.length).format(files.length);
				body = common.get_path() ?? '';
				gicon = loadIcon(this.ext, files.length === 1 ? Icon.File : Icon.Folder);
				break;
			}
			case ItemType.Link:
				title = _('Copied Link');
				gicon = loadIcon(this.ext, Icon.Link);
				break;
			case ItemType.Character:
				title = _('Copied Character');
				gicon = loadIcon(this.ext, Icon.Character);
				break;
			case ItemType.Color:
				title = _('Copied Color');
				gicon = loadIcon(this.ext, Icon.Color);
				break;
		}

		const source = this.source;
		const notification = createNotification({ source, title, body, gicon, isTransient: true });
		addNotification(source, notification);
	}
}

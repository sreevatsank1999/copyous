// libsoup 3 style API on top of libsoup 2.4. GNOME Shell 42 on Ubuntu loads libsoup 2.4
// (via libgweather-3), and loading libsoup 3 into the same process aborts it.
imports.gi.versions.Soup = '2.4';
const { Gio, GLib, Soup } = imports.gi;

// Not a GObject subclass: libsoup 2.4 only applies the defaults of a plain session (thread
// default main context, TLS database, proxy resolver, content decoder) to SoupSession itself.
class Session {
	constructor(params = {}) {
		this._session = new Soup.Session(params);
	}

	send_async(message, priority, cancellable, callback) {
		if (!callback) return this._promise('send', message, priority, cancellable);
		this._session.send_async(message, cancellable, (_session, res) => callback(this, res));
		return undefined;
	}

	send_finish(result) {
		return this._session.send_finish(result);
	}

	send_and_read_async(message, priority, cancellable, callback) {
		if (!callback) return this._promise('send_and_read', message, priority, cancellable);
		this._session.send_async(message, cancellable, (_session, res) => {
			let stream;
			try {
				stream = this._session.send_finish(res);
			} catch (error) {
				callback(this, { error });
				return;
			}

			const output = Gio.MemoryOutputStream.new_resizable();
			output.splice_async(
				stream,
				Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
				priority,
				cancellable,
				(_output, spliceRes) => {
					try {
						output.splice_finish(spliceRes);
						callback(this, { bytes: output.steal_as_bytes() });
					} catch (error) {
						callback(this, { error });
					}
				},
			);
		});
	}

	send_and_read_finish(result) {
		if (result.error) throw result.error;
		return result.bytes;
	}

	abort() {
		this._session.abort();
	}

	// GNOME Shell promisifies these methods on Soup.Session.prototype, so callers may omit the callback
	_promise(name, message, priority, cancellable) {
		return new Promise((resolve, reject) => {
			this[`${name}_async`](message, priority, cancellable, (_session, res) => {
				try {
					resolve(this[`${name}_finish`](res));
				} catch (error) {
					reject(error);
				}
			});
		});
	}
}

const Message = new Proxy(Soup.Message, {
	get(target, prop) {
		if (prop === 'new_from_uri')
			return (method, uri) => Soup.Message.new(method, uri instanceof GLib.Uri ? uri.to_string() : uri);
		return Reflect.get(target, prop);
	},
});

export default new Proxy(Soup, {
	get(target, prop) {
		if (prop === 'Session') return Session;
		if (prop === 'Message') return Message;
		return Reflect.get(target, prop);
	},
});

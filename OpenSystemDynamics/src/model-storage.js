/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).

*/

// Saves models in the browser instead of to a file. Useful in StochSD Web,
// where every save otherwise goes through the download folder, but the store is
// available in all environments.
//
// Entries are kept one per key so that a single large model cannot make the
// whole list unreadable, and so a quota error only loses the model being saved.

var ModelStorage = {
	keyPrefix: "stochsd.model.",

	_key(name) {
		return this.keyPrefix + name;
	},

	// Returns [{name, savedAt, size}], most recently saved first.
	list() {
		let models = [];
		for (let i = 0; i < localStorage.length; i++) {
			let key = localStorage.key(i);
			if (key === null || !key.startsWith(this.keyPrefix)) {
				continue;
			}
			let entry = this._read(key);
			if (entry === null) {
				continue;
			}
			models.push({
				name: entry.name,
				savedAt: entry.savedAt,
				size: entry.xml.length
			});
		}
		models.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
		return models;
	},

	_read(key) {
		let raw = localStorage.getItem(key);
		if (raw === null) {
			return null;
		}
		try {
			let entry = JSON.parse(raw);
			if (typeof entry.name !== "string" || typeof entry.xml !== "string") {
				return null;
			}
			return entry;
		} catch (error) {
			// A model saved by an older version, or something else entirely.
			do_global_log("Ignoring unreadable stored model " + key);
			return null;
		}
	},

	exists(name) {
		return this._read(this._key(name)) !== null;
	},

	// Returns the model xml, or null if there is no such model.
	load(name) {
		let entry = this._read(this._key(name));
		return entry === null ? null : entry.xml;
	},

	// Throws if the browser refuses the write, so callers can report why.
	save(name, xml) {
		let entry = {
			name: name,
			xml: xml,
			savedAt: new Date().toISOString()
		};
		try {
			localStorage.setItem(this._key(name), JSON.stringify(entry));
		} catch (error) {
			if (this._isQuotaError(error)) {
				throw new Error(
					"There is not enough room left in the browser storage for this model. " +
					"Delete a stored model and try again."
				);
			}
			throw error;
		}
	},

	_isQuotaError(error) {
		// Firefox and Chrome disagree on the name, and older browsers only set the code.
		return error instanceof DOMException && (
			error.name === "QuotaExceededError" ||
			error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
			error.code === 22
		);
	},

	remove(name) {
		localStorage.removeItem(this._key(name));
	}
};

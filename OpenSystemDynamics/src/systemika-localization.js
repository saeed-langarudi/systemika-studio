"use strict";

/*
 * Systemika localization helper.
 *
 * This is intentionally small. Systemika currently ships with English UI text,
 * but keeping text lookup behind one helper lets translations be added later
 * without coupling the editor to a particular localization framework.
 */

var translations = Object.create(null);

function getText(source) {
	let text = Object.prototype.hasOwnProperty.call(translations, source)
		? translations[source]
		: source;

	for (let index = 1; index < arguments.length; index += 1) {
		text = text.replace("%s", String(arguments[index]));
	}
	return text;
}

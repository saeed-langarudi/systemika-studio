var preferencesTemplate = {
	"promptTimeUnitDialogOnStart": {
		default: true,
		type: "boolean",
		title: "Ask for a time unit when starting a new model",
		description: "Show the Time Unit dialog when a new model starts."
	},
	"forceTimeUnit": {
		default: true,
		type: "boolean",
		title: "Require a model time unit",
		description: "Require a time unit before model editing begins."
	},
	"showFunctionHelper": {
		default: false,
		type: "boolean",
		title: "Show equation function helper",
		description: "Show function arguments and notes while editing equations.",
		image: "./graphics/showArgumentHelper.png",
	},
	"showConverterPlotPreview": {
		default: true,
		type: "boolean",
		title: "Show Lookup plot preview",
		description: "Show a plot preview while editing Lookup values."
	}
	// primitiveFontSize
	// showArgumentHelper
	// theme (classic/modern)
}

class Preferences {
	static setup() {
		const prefs = Preferences.get()
		Object.entries(preferencesTemplate).forEach(([key, info]) => {
			if (prefs[key] == undefined)
				prefs[key] = info.default
		})
		Preferences.store(prefs)
	}
	static get(key) {
		const prefsString = localStorage.getItem("preferences")
		const prefs = prefsString ? JSON.parse(prefsString) : {}
		return key ? prefs[key] : prefs
	}
	static set(key, value) {
		const prefs = Preferences.get()
		prefs[key] = value
		Preferences.store(prefs)
	}
	static store(object) {
		localStorage.setItem("preferences", JSON.stringify(object))
	}
}
"use strict";

/*
 * Systemika entity definitions.
 *
 * Canonical model terminology:
 *   Stock, Flow, Link, Auxiliary, Constant, Lookup, Ghost
 *
 * The .ssd format predates Systemika and stores Auxiliary/Constant as
 * <Variable> and Lookup as <Converter>. Those storage tags remain supported
 * so existing .ssd files continue to open, but they are not Systemika's
 * user-facing terminology.
 */

var graph;
var primitiveBank = Object.create(null);
var defaultSolver = '{"enabled": false, "algorithm": "RK1", "timeStep": 1}';
var doc = document.implementation.createDocument("", "", null);

const SYSTEMIKA_ENTITY_TYPES = Object.freeze({
	STOCK: "Stock",
	FLOW: "Flow",
	LINK: "Link",
	AUXILIARY: "Auxiliary",
	CONSTANT: "Constant",
	LOOKUP: "Lookup",
	GHOST: "Ghost"
});

const SYSTEMIKA_STORAGE_TYPES = Object.freeze({
	Stock: "Stock",
	Flow: "Flow",
	Link: "Link",
	Auxiliary: "Variable",
	Constant: "Variable",
	Lookup: "Converter",
	Ghost: "Ghost"
});

function systemikaTypeName(primitiveOrType) {
	if (primitiveOrType && typeof primitiveOrType === "object" && primitiveOrType.value) {
		const nodeType = primitiveOrType.value.nodeName;
		if (nodeType === "Variable") {
			return primitiveOrType.getAttribute("isConstant") === "true"
				? SYSTEMIKA_ENTITY_TYPES.CONSTANT
				: SYSTEMIKA_ENTITY_TYPES.AUXILIARY;
		}
		if (nodeType === "Converter") return SYSTEMIKA_ENTITY_TYPES.LOOKUP;
		return nodeType;
	}

	if (primitiveOrType === "Variable") return SYSTEMIKA_ENTITY_TYPES.AUXILIARY;
	if (primitiveOrType === "Converter") return SYSTEMIKA_ENTITY_TYPES.LOOKUP;
	return String(primitiveOrType || "");
}

function systemikaStorageType(canonicalType) {
	return SYSTEMIKA_STORAGE_TYPES[canonicalType] || canonicalType;
}

function createTemplate(tagName, attributes) {
	const element = doc.createElement(tagName);
	Object.entries(attributes || {}).forEach(([name, value]) => {
		element.setAttribute(name, value);
	});
	return element;
}

function addValueAttributes(element) {
	const attributes = {
		Units: "Unitless",
		MaxConstraintUsed: false,
		MinConstraintUsed: false,
		MaxConstraint: "100",
		MinConstraint: "0",
		ShowSlider: false,
		SliderMax: 100,
		SliderMin: 0,
		SliderStep: ""
	};
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	return element;
}

function addVisualAttributes(element, labelPosition) {
	element.setAttribute("Image", "None");
	element.setAttribute("FlipHorizontal", false);
	element.setAttribute("FlipVertical", false);
	element.setAttribute("LabelPosition", labelPosition || "Middle");
	element.setAttribute("Color", "black");
	return element;
}

function createValuedTemplate(tagName, attributes) {
	return addValueAttributes(createTemplate(tagName, attributes));
}

// Model entities -----------------------------------------------------------

primitiveBank.stock = addVisualAttributes(createValuedTemplate("Stock", {
	name: getText("New Stock"),
	Note: "",
	InitialValue: "",
	StockMode: "Store",
	NonNegative: false
}), "Middle");

primitiveBank.flow = createValuedTemplate("Flow", {
	name: getText("Flow"),
	Note: "",
	MiddlePoints: "",
	RotateName: 0,
	ValveIndex: 0,
	VariableSide: false,
	FlowRate: "",
	// Legacy .ssd compatibility attribute. Systemika flows are never clamped.
	OnlyPositive: false,
	TimeIndependent: false,
	Color: "black"
});

primitiveBank.link = createTemplate("Link", {
	name: getText("Link"),
	Note: "",
	BiDirectional: false,
	Polarity: "",
	Color: "black"
});

// .ssd compatibility tag: Variable. Systemika term: Auxiliary.
primitiveBank.variable = addVisualAttributes(createValuedTemplate("Variable", {
	name: getText("New Auxiliary"),
	Note: "",
	Equation: "",
	isConstant: false
}), "Middle");

// .ssd compatibility tag: Converter. Systemika term: Lookup.
primitiveBank.converter = addVisualAttributes(createValuedTemplate("Converter", {
	name: getText("New Lookup"),
	Note: "",
	Source: "Time",
	Data: "",
	Interpolation: "Linear"
}), "Middle");

primitiveBank.ghost = createTemplate("Ghost", {
	Color: "black",
	Source: ""
});

// Simulation settings ------------------------------------------------------

primitiveBank.setting = createTemplate("Setting", {
	Note: "",
	Version: "36",
	Throttle: "1",
	TimeLength: "100",
	TimeStart: "0",
	TimeStep: "1",
	TimeUnits: "",
	Units: "",
	SolutionAlgorithm: "RK1",
	BackgroundColor: "white",
	Macros: "",
	SensitivityPrimitives: "",
	SensitivityRuns: 50,
	SensitivityBounds: "50, 80, 95, 100",
	SensitivityShowRuns: false,
	StrictUnits: true,
	StrictLinks: true,
	StrictAgentResolution: true,
	StyleSheet: "{}"
});

// Display and annotation entities -----------------------------------------

primitiveBank.generic = addValueAttributes(createTemplate("Generic", {}));

primitiveBank.numberbox = addValueAttributes(createTemplate("Numberbox", {
	RoundToZero: false,
	RoundToZeroAtValue: 1e-12,
	NumberLength: JSON.stringify({ usePrecision: true, precision: 4, decimal: 2 }),
	HideFrame: false,
	Color: "black"
}));

primitiveBank.table = addValueAttributes(createTemplate("Table", {
	Primitives: "",
	TableLimits: JSON.stringify({
		start: { value: 0, auto: true },
		end: { value: 100, auto: true },
		step: { value: 1, auto: true }
	}),
	RoundToZero: false,
	RoundToZeroAtValue: 1e-12,
	NumberLength: JSON.stringify({ usePrecision: true, precision: 4, decimal: 2 }),
	TableDecimals: JSON.stringify({}),
	Color: "black"
}));

// Legacy type-based line settings are retained only for old .ssd files. New
// Systemika plots use per-entity LineStyles, with one uniform default style.
const plotLineOptions = JSON.stringify({
	stock: { pattern: [1], width: 2 },
	flow: { pattern: [1], width: 2 },
	variable: { pattern: [1], width: 2 },
	constant: { pattern: [1], width: 2 },
	converter: { pattern: [1], width: 2 }
});

primitiveBank.timeplot = addValueAttributes(createTemplate("TimePlot", {
	PlotPages: "",
	PlotPageIndex: 0,
	Primitives: "",
	Sides: "",
	AxisLimits: JSON.stringify({
		timeaxis: { min: 0, max: 100, auto: true },
		leftaxis: { min: 0, max: 1, auto: true },
		rightaxis: { min: 0, max: 1, auto: true }
	}),
	PlotPer: 1,
	AutoPlotPer: true,
	LineOptions: plotLineOptions,
	LineStyles: "{}",
	TitleLabel: "",
	LeftAxisLabel: "",
	RightAxisLabel: "",
	HasNumberedLines: true,
	ColorFromPrimitive: false,
	ShowHighlighter: true,
	Color: "black"
}));

primitiveBank.compareplot = addValueAttributes(createTemplate("ComparePlot", {
	PlotPages: "",
	PlotPageIndex: 0,
	Primitives: "",
	RunNames: JSON.stringify([""]),
	AxisLimits: JSON.stringify({
		timeaxis: { min: 0, max: 100, auto: true },
		yaxis: { min: 0, max: 1, auto: true }
	}),
	PlotPer: 1,
	AutoPlotPer: true,
	LineOptions: plotLineOptions,
	LineStyles: "{}",
	TitleLabel: "",
	LeftAxisLabel: "",
	HasNumberedLines: true,
	ColorFromPrimitive: false,
	ShowHighlighter: true,
	Color: "black"
}));

primitiveBank.xyplot = addValueAttributes(createTemplate("XyPlot", {
	PlotPages: "",
	PlotPageIndex: 0,
	Primitives: "",
	RunNames: JSON.stringify([""]),
	AxisLimits: JSON.stringify({
		xaxis: { min: 0, max: 1, auto: true },
		yaxis: { min: 0, max: 1, auto: true }
	}),
	PlotPer: 1,
	AutoPlotPer: true,
	ShowLine: true,
	// ShowMarker is retained only for legacy .ssd compatibility. New Systemika XY plots use numbered curves instead.
	ShowMarker: false,
	ShowNumber: false,
	MarkStart: false,
	MarkEnd: false,
	LineWidth: 2,
	TitleLabel: "",
	XLogScale: false,
	YLogScale: false,
	ShowHighlighter: false,
	Color: "black"
}));

primitiveBank.histoplot = addValueAttributes(createTemplate("HistoPlot", {
	PlotPages: "",
	PlotPageIndex: 0,
	Primitives: "",
	RunNames: JSON.stringify([""]),
	NumberOfBars: 10,
	NumberOfBarsAuto: true,
	LowerBound: 0,
	LowerBoundAuto: true,
	UpperBound: 1,
	UpperBoundAuto: true,
	ScaleType: "Histogram",
	Color: "black"
}));

primitiveBank.textarea = addValueAttributes(createTemplate("TextArea", {
	HideFrame: false,
	Color: "black"
}));

primitiveBank.rectangle = addValueAttributes(createTemplate("Rectangle", {
	StrokeWidth: "1",
	StrokeDashArray: "",
	Color: "black"
}));

primitiveBank.ellipse = addValueAttributes(createTemplate("Ellipse", {
	StrokeWidth: "1",
	StrokeDashArray: "",
	Color: "black"
}));

primitiveBank.line = addValueAttributes(createTemplate("Line", {
	ArrowHeadStart: false,
	ArrowHeadEnd: true,
	StrokeWidth: "2",
	StrokeDashArray: "",
	Color: "black"
}));

// Legacy display types are retained only so older .ssd files remain loadable.
primitiveBank.text = createTemplate("Text", {
	name: getText("Text Area"),
	LabelPosition: "Middle"
});
primitiveBank.diagram = addValueAttributes(createTemplate("Diagram", { Primitives: "" }));
primitiveBank.display = createTemplate("Display", {
	name: getText("Default Display"),
	Note: "",
	Type: "Time Series",
	xAxis: getText("Time") + " (%u)",
	yAxis: "",
	yAxis2: "",
	showMarkers: false,
	showLines: true,
	showArea: false,
	ThreeDimensional: false,
	Primitives: "",
	Primitives2: "",
	AutoAddPrimitives: false,
	ScatterplotOrder: "X Primitive, Y Primitive",
	Image: "Display",
	FlipHorizontal: false,
	FlipVertical: false,
	LabelPosition: "Bottom",
	legendPosition: "Automatic"
});

// The order is significant: connectors are saved after the objects they can
// reference. The historical misspelled name remains as a compatibility alias
// until makexml/editor are migrated in a later independence pass.
const savablePrimitiveTypes = [
	"TextArea", "Rectangle", "Ellipse", "Line", "Setting",
	"Stock", "Variable", "Converter", "Ghost", "Flow", "Link", "Text",
	"Numberbox", "Table", "TimePlot", "ComparePlot", "XyPlot", "HistoPlot"
];
const saveblePrimitiveTypes = savablePrimitiveTypes;
const allPrimitiveTypes = ["Generic"].concat(savablePrimitiveTypes);
const allModelTypes = ["Stock", "Variable", "Converter", "Flow"];

if (typeof window !== "undefined") {
	window.SystemikaTerminology = Object.freeze({
		entities: SYSTEMIKA_ENTITY_TYPES,
		storageTypes: SYSTEMIKA_STORAGE_TYPES,
		nameFor: systemikaTypeName,
		storageTypeFor: systemikaStorageType
	});
}


class DefinitionError {
    static init() {
        this.isDefErr = (defErr) => {
            return (typeof defErr === "object") && ("id" in defErr);
        }

        this.messageTable = {
            "1": (defErr) => "Empty Definition",
            "2": (defErr) => `Unknown reference ${defErr["unknownRef"]}`,
            "3": (defErr) => `Unused link from ${getName(findID(defErr["unusedId"]))}`,
            "4": (defErr) => `No ingoing link`, // only for converter
            "5": (defErr) => `More than one ingoing link`, // only for converter 
            "6": (defErr) => `Unmatched ${defErr["openBracket"]}`, // opening bracket unmatched
            "7": (defErr) => `Unmatched ${defErr["closeBracket"]}`, // closing bracket unmatched
            "8": (defErr) => `Unmatched brackets`, // unmatching open and closing brackets  
            // open and close brackets not disclosed to user in order not to confuse.
            // uncomment below if
            // "8": (defErr) => `Unmatched brackets "${defErr["openBracket"]}...${defErr["closeBracket"]}"`,
            "9": (defErr) =>  `Unclear converter definition`, // only for converters
            "10": (defErr) => `Input values not in ascending order: ${defErr["Xpre"]} &gt; ${defErr["Xpost"]}`, // only for converters 
        }

        this.checkFunctions = [
            (prim, defString) => {
                // check empty string 
                if (defString === "") return { "id": 1 };
            },
            (prim, defString) => {
                // Check matching brackets across the complete definition. A function
                // may legitimately open on one line and close on another.
                return checkBracketErrors(defString);
            },
            (prim, defString) => {
                // check links  
                let primType = prim.value.nodeName;
	            let linkedIds = findLinkedInPrimitives(prim.id).map(getID);
	            if (primType === "Stock" || primType === "Variable" || primType === "Flow") {
                    // 2. Unknown reference / 3. Unused link. The native parser
                    // accepts both Systemika bare identifiers (Population) and legacy
                    // bracketed references ([Population]). Function names are not
                    // mistaken for model references.
                    let definitionRefs = getDefinitionReferences(defString);
                    if (definitionRefs === null) return; // syntax errors are reported by the engine
                    let linkedRefs = linkedIds.map(id => getName(findID(id)));
                    let linkedLower = linkedRefs.map(ref => ref.toLowerCase());
                    for (let ref of definitionRefs) {
                        if (linkedLower.includes(String(ref).toLowerCase()) === false) {
                            return { "id": "2", "unknownRef": ref };
                        }
                    }

                    for(let i = 0; i < linkedIds.length; i++) {
                        let ref = linkedRefs[i];
                        if (definitionRefs.some(item => String(item).toLowerCase() === ref.toLowerCase()) === false) {
                            return { "id": "3", "unusedId": linkedIds[i] };
                        }
                    }
	            } else if (primType === "Converter") {
	    	        if (linkedIds.length === 0) {
			            // 4. No ingoing link 
			            return { "id": "4"};
		            } else if (linkedIds.length > 1) {
			            // 5. More then one ingoing link 
			            return {"id": "5", "linkedIds": linkedIds};
		            }
	            }
            },
            (prim, defString) => {
                if (prim.value.nodeName === "Converter") {
                    let rows = defString.split(";").map(row => row.split(","));
                    for (let i in rows) {
                        let row = rows[i];
                        if (row.length !== 2) {
                            // unclear definition
                            return {"id": "9"};
                        }
                        if (row[0].trim() === "" || row[1].trim() === "") {
                            return {"id": "9"};
                        }
                        if (isNaN(row[0]) || isNaN(row[1])) {
                            return {"id": "9"};
                        }
                        if (i > 0) {
                            if (Number(rows[i-1][0]) > Number(rows[i][0])) {
                                // not sorted inputs order 
                                return {"id": "10", "Xpre": Number(rows[i-1][0]), "Xpost": Number(rows[i][0]) };
                            }
                        }
                    }
                }
            }
        ]
    }

    static check(prim) {
        if (! isPrimitiveGhost(prim)) {
            for (let fn of this.checkFunctions) {
                let defErr = fn(prim, getValue(prim));
                if (defErr) {
                    prim.setAttribute("DefinitionError", JSON.stringify(defErr));
                    return true;
                }
            }
        }
        prim.setAttribute("DefinitionError", JSON.stringify({}));
        return false;
    }

    static has(prim) {
        try {
            const defErr = JSON.parse(prim.getAttribute("DefinitionError"));
            return this.isDefErr(defErr);
        } catch(err) {
            return false;
        }
    }

    static getMessage(prim) {
        if (this.has(prim)) {
            const defErr = JSON.parse(prim.getAttribute("DefinitionError"));
            return this.messageTable[defErr["id"]](defErr);
        }
        return "";
    }

    static getAllPrims() {
        let defErrPrims = primitives().filter(p => this.has(p)).filter(v => ! isPrimitiveGhost(v));
        return defErrPrims;
    }
}

DefinitionError.init();

function LineColToString(pos) {
    return `Line: ${pos["line"]}, Col: ${pos["col"]}`;
}

/**
 * checks for bracket errors and returns value error
 * Input should only be one row
 */
function getDefinitionReferences(definition) {
    try {
        if (typeof SystemikaEngine !== "undefined" && SystemikaEngine.parseExpression && SystemikaEngine.collectReferences) {
            return Array.from(SystemikaEngine.collectReferences(SystemikaEngine.parseExpression(definition)));
        }
    } catch (_error) {
        return null;
    }
    const refs = [];
    const add = value => {
        value = String(value || "").trim();
        if (value && !refs.some(item => item.toLowerCase() === value.toLowerCase())) refs.push(value);
    };
    let match;
    const bracket = /\[([^\]]+)\]/g;
    while ((match = bracket.exec(definition))) add(match[1]);
    return refs;
}

/**
 * Checks matching (), {}, and legacy [] brackets across a complete multiline
 * definition. Newlines are whitespace in Systemika expressions and therefore
 * do not reset bracket matching.
 */
function checkBracketErrors(string) {
    const openBrackets = ["(", "{", "["];
    const closeBrackets = [")", "}", "]"];
    const bracketStack = [];
    const text = String(string == null ? "" : string);
    let line = 1;
    let col = 0;
    let inComment = false;

    for (let pos = 0; pos < text.length; pos++) {
        const char = text[pos];
        if (char === "\n") {
            line++;
            col = 0;
            inComment = false;
            continue;
        }
        col++;
        if (inComment) continue;
        if (char === "#") {
            inComment = true;
            continue;
        }
        if (openBrackets.includes(char)) {
            const index = openBrackets.indexOf(char);
            bracketStack.push({ bracket: char, index, pos: { line, col } });
            continue;
        }
        if (!closeBrackets.includes(char)) continue;

        const index = closeBrackets.indexOf(char);
        if (!bracketStack.length) {
            return { id: "7", openBracket: openBrackets[index], closeBracket: char, closePos: { line, col } };
        }
        const top = bracketStack[bracketStack.length - 1];
        if (top.index !== index) {
            return {
                id: "8", openBracket: top.bracket, closeBracket: char,
                openPos: top.pos, closePos: { line, col }
            };
        }
        bracketStack.pop();
    }

    if (!bracketStack.length) return "";
    const top = bracketStack[bracketStack.length - 1];
    return {
        id: "6", openBracket: top.bracket, closeBracket: closeBrackets[top.index], openPos: top.pos
    };
}

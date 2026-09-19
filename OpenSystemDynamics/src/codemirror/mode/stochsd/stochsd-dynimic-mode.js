CodeMirror.defineMode("stochsd-dynamic-mode", () => {

  function getPrimitiveByName(primitiveName) {
    const primitives = findName(primitiveName)
    return Array.isArray(primitives) ? primitives.find(p => !isPrimitiveGhost(p)) : primitives
  }

  function getColorFromPrimitive(primitiveName) {
    return getPrimitiveByName(primitiveName)?.getAttribute("Color")
  }


  function tokenStart(stream, state) {
    if (stream.match(/"(?:[^\\]|\\.)*?(?:"|$)/)) {
      return "string";
    } else if (stream.match(/0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i)) {
      return "number";
    } else if (stream.match(/\[[A-Za-z_]+[A-Za-z_0-9]*\]/)) {
      const primitiveName = stream.current().slice(1, -1);
      const color = getColorFromPrimitive(primitiveName)
      return `primitive ${color}`;
    } else if (stream.match(/#.*/)) {
      return "comment";
    } else if (stream.match(/[\w]+(?=\()/)) {
      return "functioncall";
    } else if (stream.match(/[A-Za-z_][A-Za-z_0-9]*/)) {
      const primitiveName = stream.current();
      const primitive = getPrimitiveByName(primitiveName);
      if (primitive) {
        const color = primitive.getAttribute("Color");
        return `primitive ${color || ""}`.trim();
      }
      return null;
    }
    stream.next();
  }

  function tokenComment(stream, state) {
    if (stream.match(/.*?\*\//)) {
      state.currentState = "start"; // Return to 'start' state
      return "comment";
    }
    stream.skipToEnd();
    return "comment";
  }

  return {
    startState: function () {
      return { currentState: "start" };
    },
    token: function (stream, state) {
      if (state.currentState === "start") {
        return tokenStart(stream, state);
      }
      if (state.currentState === "comment") {
        return tokenComment(stream, state);
      }

      stream.next();
      return null;
    }
  }
});
// PhotoStudio pure helpers — Design System 0520 M14 (subsystem A, phase 4).
// Loaded both by vitest unit tests and by photo-studio.js Alpine factory in
// the browser (re-exported onto window.PhotoStudioHelpers from page mount).

/**
 * Append a shape to the working set + clear the redo stack (any new edit
 * invalidates the previous "redo" timeline — classic undo semantics).
 */
export function addShape(state, shape) {
    return { shapes: [...state.shapes, shape], redo: [] };
}

/**
 * Pop the most-recent shape off `shapes` onto `redo`. No-op when empty.
 */
export function undoLast(state) {
    if (state.shapes.length === 0) return state;
    const last = state.shapes[state.shapes.length - 1];
    return {
        shapes: state.shapes.slice(0, -1),
        redo:   [...state.redo, last],
    };
}

/**
 * Pop the most-recent redo entry back onto `shapes`. No-op when empty.
 */
export function redoLast(state) {
    if (state.redo.length === 0) return state;
    const next = state.redo[state.redo.length - 1];
    return {
        shapes: [...state.shapes, next],
        redo:   state.redo.slice(0, -1),
    };
}

/**
 * Full clear — both stacks. Used by the "Reset" one-click action (after
 * confirmation dialog in the factory).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function resetShapes(_state) {
    return { shapes: [], redo: [] };
}

/**
 * Wrap the shape array in the on-wire JSON envelope. `version` lets future
 * format changes coexist with old saved data.
 */
export function serialize(shapes) {
    return JSON.stringify({ version: 1, shapes });
}

/**
 * Parse a stored annotations JSON string. Tolerant: returns `[]` for empty
 * / null / malformed input so the factory never throws on corrupt data.
 */
export function deserialize(json) {
    if (!json || typeof json !== 'string') return [];
    try {
        const parsed = JSON.parse(json);
        if (!parsed || !Array.isArray(parsed.shapes)) return [];
        return parsed.shapes;
    } catch {
        return [];
    }
}

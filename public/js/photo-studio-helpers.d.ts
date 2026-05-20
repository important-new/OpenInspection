export interface Shape {
    type: 'circle' | 'arrow' | 'freehand' | 'label';
    [key: string]: unknown;
}

export interface UndoState {
    shapes: Shape[];
    redo:   Shape[];
}

export function addShape(state: UndoState, shape: Shape): UndoState;
export function undoLast(state: UndoState): UndoState;
export function redoLast(state: UndoState): UndoState;
export function resetShapes(state: UndoState): UndoState;
export function serialize(shapes: Shape[]): string;
export function deserialize(json: string | null | undefined): Shape[];

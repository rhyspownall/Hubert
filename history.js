import {
    signals,
    gates,
    wires,
    workspace
} from "./state.js";
import {
    renderInputSignal,
    renderOutputSignal,
    syncSignalCounters
} from "./signals.js";
import {
    renderANDGate,
    renderORGate,
    renderNOTGate,
    renderNANDGate,
    renderNORGate,
    renderXORGate,
    renderXNORGate
} from "./gates.js";

// Undo works by snapshotting the entire circuit (every gate, signal,
// and wire) right before a mutating action, rather than trying to
// track/invert each specific action individually. This keeps every
// call site's "undo support" down to a single recordHistory() call,
// and restore() just repopulates the app from a snapshot the same way
// clearWorkspace()/render*() already do.
const MAX_HISTORY = 100;
const undoStack = [];
const redoStack = [];

// Bumped while restore() is rebuilding state from a snapshot, so that
// none of the render calls it makes accidentally get recorded as a
// brand new history entry.
let suppressCapture = 0;

function cloneGate(gate) {
    return {
        ...gate,
        inputs: gate.inputs.map(port => ({ ...port })),
        outputs: gate.outputs.map(port => ({ ...port }))
    };
}

function snapshot() {
    return {
        signals: signals.map(s => ({ ...s })),
        gates: gates.map(cloneGate),
        wires: wires.map(w => ({ ...w }))
    };
}

export function recordHistory() {
    if (suppressCapture) return;
    undoStack.push(snapshot());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // A fresh action branches off from wherever undo() had brought the
    // circuit back to, so any previously-undone states can no longer
    // be "redone" back to sensibly - clear them out, same as any other
    // undo/redo implementation (e.g. a text editor).
    redoStack.length = 0;
}

const gateRenderers = {
    AND: renderANDGate,
    OR: renderORGate,
    NOT: renderNOTGate,
    NAND: renderNANDGate,
    NOR: renderNORGate,
    XOR: renderXORGate,
    XNOR: renderXNORGate
};

// Removes every placed gate/signal element from the workspace, but
// leaves the wires canvas itself alone - wires.js owns that element
// and redraws onto it every animation frame regardless.
function clearWorkspaceDom() {
    Array.from(workspace.children).forEach(el => {
        if (el.id !== "workspace-canvas") el.remove();
    });
}

function restore(snap) {
    suppressCapture++;

    signals.length = 0;
    gates.length = 0;
    wires.length = 0;
    clearWorkspaceDom();

    snap.gates.forEach(g => {
        const gateCopy = cloneGate(g);
        gates.push(gateCopy);
        const renderFn = gateRenderers[gateCopy.type];
        if (renderFn) renderFn(gateCopy);
    });

    snap.signals.forEach(s => {
        const signalCopy = { ...s };
        signals.push(signalCopy);
        if (signalCopy.type === "input") {
            renderInputSignal(signalCopy);
        } else {
            renderOutputSignal(signalCopy);
        }
    });

    snap.wires.forEach(w => wires.push({ ...w }));

    // Re-sync the "next id" counters against the restored signals so a
    // freshly-added signal after an undo can't collide with an id that
    // undo just brought back.
    syncSignalCounters();

    suppressCapture--;
}

export function undo() {
    if (undoStack.length === 0) return;
    // Snapshot where we currently are *before* stepping back, so redo()
    // has somewhere to return to.
    redoStack.push(snapshot());
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    const snap = undoStack.pop();
    restore(snap);
}

export function redo() {
    if (redoStack.length === 0) return;
    // Mirror image of undo(): stash the current (pre-redo) state back
    // onto the undo stack so the person can undo the redo itself.
    undoStack.push(snapshot());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    const snap = redoStack.pop();
    restore(snap);
}

document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();

    if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if (key === "y" || (key === "z" && e.shiftKey)) {
        // Ctrl+Y is the common Windows convention for redo; Ctrl+Shift+Z
        // covers macOS and browsers/editors that use that instead.
        e.preventDefault();
        redo();
    }
});
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

const MAX_HISTORY = 100;
const undoStack = [];
const redoStack = [];
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
    syncSignalCounters();
    suppressCapture--;
}

export function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshot());
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    const snap = undoStack.pop();
    restore(snap);
}

export function redo() {
    if (redoStack.length === 0) return;
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
        e.preventDefault();
        redo();
    }
});

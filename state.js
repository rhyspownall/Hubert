export let signals = [];
export let gates = [];
export let wires = [];

// Live binding, same pattern as deleteModeActive below: other modules
// can read gridSize directly (and always see the current value, since
// `let` exports are live bindings), but only setGridSize() should ever
// reassign it, so every place that cares (settings.js's rescale logic)
// goes through one function instead of each module tracking its own
// stale copy.
export let gridSize = 25;
export function setGridSize(value) {
    gridSize = value;
}

// "normal" animates a wire's on/off transition travelling along its
// length (see wires.js's drawAllWires); "instant" flips the whole wire
// straight away, which is how the app behaved before this setting
// existed. Live binding, same pattern as gridSize/deleteModeActive
// above - only setSimulationSpeed() should ever reassign it.
export let simulationSpeed = "normal";
export function setSimulationSpeed(value) {
    simulationSpeed = value;
}

// Every placed component is sized in whole grid cells (see the
// .and-Gate/.input-signals/etc rules in style.css, which use these
// same multiples via calc(var(--grid-size) * N)). Centralising the
// multiples here means gates.js's collision detection and settings.js's
// rescale-on-change logic can't drift out of sync with what the CSS
// actually renders.
export const GATE_CELLS = { AND: [3, 2], OR: [3, 2], NAND: [3, 2], NOR: [3, 2], XOR: [3, 2], XNOR: [3, 2], NOT: [2, 2] };
export function gateSize(type) {
    const [w, h] = GATE_CELLS[type] || [3, 2];
    return { width: w * gridSize, height: h * gridSize };
}

export let isDragging = false;

// Whether "delete mode" is currently switched on (toggled from the
// Delete button in the bottom bar). This lives here, rather than as a
// private variable inside delete-mode.js, because wires.js also needs
// to know about it - both to stop a stray click from starting a new
// wire while the person is trying to delete something, and to know
// when it should let clicks on empty canvas delete a wire. Only
// setDeleteModeActive should change it: plain `let` exports are live
// bindings that other modules can read, but only the declaring module
// can assign to them.
export let deleteModeActive = false;
export function setDeleteModeActive(value) {
    deleteModeActive = value;
}

export const workspace = document.getElementById("workspace");
export const addInputSignalButton = document.getElementById("addInputButton");
export const addOutputSignalButton = document.getElementById("addOutputButton");
export const addANDGateButton = document.getElementById("addANDButton");
export const addORGateButton = document.getElementById("addORButton");
export const addNOTGateButton = document.getElementById("addNOTButton");
export const addNANDGateButton = document.getElementById("addNANDButton");
export const addNORGateButton = document.getElementById("addNORButton");
export const addXORGateButton = document.getElementById("addXORButton");
export const addXNORGateButton = document.getElementById("addXNORButton");
export const clearCanvas = document.getElementById("clearCanvas");
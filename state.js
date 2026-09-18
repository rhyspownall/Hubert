export let signals = [];
export let gates = [];
export let wires = [];
export let gridSize = 25;
export function setGridSize(value) {
    gridSize = value;
}

export let simulationSpeed = "normal";
export function setSimulationSpeed(value) {
    simulationSpeed = value;
}
export const GATE_CELLS = { AND: [3, 2], OR: [3, 2], NAND: [3, 2], NOR: [3, 2], XOR: [3, 2], XNOR: [3, 2], NOT: [2, 2] };
export function gateSize(type) {
    const [w, h] = GATE_CELLS[type] || [3, 2];
    return { width: w * gridSize, height: h * gridSize };
}
export let isDragging = false;
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

import {
    gates,
    gridSize,
    gateSize,
    addANDGateButton,
    addORGateButton,
    addNOTGateButton,
    addNANDGateButton,
    addNORGateButton,
    addXORGateButton,
    addXNORGateButton
} from "./state.js"
import {
    dragElement,
    snapToGrid
} from "./workspace.js"
import { recordHistory } from "./history.js"

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// Picks the next id of the form `${type}${n}` that isn't already in use.
// A plain "count of this type + 1" would collide once a gate has been
// deleted (e.g. deleting AND1 while AND2 still exists, then adding a
// new AND gate would otherwise try to reuse the id "AND2").
function nextGateId(type) {
    let n = gates.filter(g => g.type === type).length + 1;
    while (gates.some(g => g.id === `${type}${n}`)) n++;
    return `${type}${n}`;
}

function isPositionFree(x, y, w, h) {
    return !gates.some(g => {
        const el = document.getElementById(g.id);
        const fallback = gateSize(g.type);
        const gw = el ? el.offsetWidth : fallback.width;
        const gh = el ? el.offsetHeight : fallback.height;
        return rectsOverlap(x, y, w, h, g.x, g.y, gw, gh);
    });
}

// Picks a random grid-snapped spot that doesn't overlap an existing
// gate. Falls back to the last tried spot if it can't find a free one
// within a reasonable number of attempts (e.g. workspace is crowded).
function findFreePosition(w, h) {
    let x, y, tries = 0;
    do {
        x = snapToGrid(Math.floor(Math.random() * 400) + 50);
        y = snapToGrid(Math.floor(Math.random() * 300) + 50);
        tries++;
    } while (!isPositionFree(x, y, w, h) && tries < 100);
    return { x, y };
}

// ---- Two-input gates (AND, OR, NAND, NOR, XOR, XNOR) ----------------
// They all share the same shape (two inputs, one output), so a single
// creator/renderer is reused for all six instead of repeating the same
// DOM-building code over and over.

function bindTwoInputGateButton(button, type, renderFn) {
    button.addEventListener("click", () => {
        const baseId = nextGateId(type);
        const { width, height } = gateSize(type);
        const pos = findFreePosition(width, height);
        const newGate = {
            type,
            name: type,
            id: baseId,
            x: pos.x,
            y: pos.y,
            inputs: [
                { id: `${baseId}_INP1`, state: false, connectedTo: null },
                { id: `${baseId}_INP2`, state: false, connectedTo: null }
            ],
            outputs: [
                { id: `${baseId}_OUT1`, state: false, connectedTo: null }
            ]
        };
        recordHistory();
        gates.push(newGate);
        renderFn(newGate);
    });
}

function renderTwoInputGate(gate, className) {
    const element = document.createElement("div");
    element.appendChild(document.createTextNode(gate.name));
    element.id = gate.id;
    element.classList.add(className);
    element.style.top = gate.y + "px";
    element.style.left = gate.x + "px";
    element.style.zIndex = "1";

    const i1node = document.createElement("div");
    i1node.id = gate.inputs[0].id;
    i1node.classList.add("inputNodeTop");
    i1node.style.zIndex = "2";
    element.appendChild(i1node);

    const i2node = document.createElement("div");
    i2node.id = gate.inputs[1].id;
    i2node.classList.add("inputNodeBottom");
    i2node.style.zIndex = "2";
    element.appendChild(i2node);

    const o1node = document.createElement("div");
    o1node.id = gate.outputs[0].id;
    o1node.classList.add("outputNode");
    o1node.style.zIndex = "2";
    element.appendChild(o1node);

    dragElement(element);
    document.getElementById("workspace").appendChild(element);
}

export function renderANDGate(gate) { renderTwoInputGate(gate, "and-Gate"); }
export function renderORGate(gate) { renderTwoInputGate(gate, "or-Gate"); }
export function renderNANDGate(gate) { renderTwoInputGate(gate, "nand-Gate"); }
export function renderNORGate(gate) { renderTwoInputGate(gate, "nor-Gate"); }
export function renderXORGate(gate) { renderTwoInputGate(gate, "xor-Gate"); }
export function renderXNORGate(gate) { renderTwoInputGate(gate, "xnor-Gate"); }

bindTwoInputGateButton(addANDGateButton, "AND", renderANDGate);
bindTwoInputGateButton(addORGateButton, "OR", renderORGate);
bindTwoInputGateButton(addNANDGateButton, "NAND", renderNANDGate);
bindTwoInputGateButton(addNORGateButton, "NOR", renderNORGate);
bindTwoInputGateButton(addXORGateButton, "XOR", renderXORGate);
bindTwoInputGateButton(addXNORGateButton, "XNOR", renderXNORGate);

// ---- NOT gate (single input, kept separate from the shared builder) --

addNOTGateButton.addEventListener("click", () => {
    const baseId = nextGateId("NOT");
    const { width, height } = gateSize("NOT");
    const pos = findFreePosition(width, height);
    const newGate = {
        type: "NOT",
        name: "NOT",
        id: baseId,
        x: pos.x,
        y: pos.y,
        inputs: [
            { id: `${baseId}_INP1`, state: false, connectedTo: null }
        ],
        outputs: [
            { id: `${baseId}_OUT1`, state: false, connectedTo: null }
        ]
    };
    recordHistory();
    gates.push(newGate);
    renderNOTGate(newGate);
});

export function renderNOTGate(gate) {
    const element = document.createElement("div");
    element.appendChild(document.createTextNode(gate.name));
    element.id = gate.id;
    element.classList.add("not-Gate");
    element.style.top = gate.y + "px";
    element.style.left = gate.x + "px";
    element.style.zIndex = "1";

    const i1node = document.createElement("div");
    i1node.id = gate.inputs[0].id;
    i1node.classList.add("inputNodeSingle");
    i1node.style.zIndex = "2";
    element.appendChild(i1node);

    const o1node = document.createElement("div");
    o1node.id = gate.outputs[0].id;
    o1node.classList.add("outputNode");
    o1node.style.zIndex = "2";
    element.appendChild(o1node);

    dragElement(element);
    document.getElementById("workspace").appendChild(element);
}
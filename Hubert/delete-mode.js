import {
    gates,
    signals,
    wires,
    workspace,
    deleteModeActive,
    setDeleteModeActive
} from "./state.js";
import { recordHistory } from "./history.js";

const deleteButton = document.getElementById("deleteModeButton");

// Any DOM element that represents a placed gate or signal. Kept as one
// selector so the click-to-delete handler, the CSS hover affordance,
// and wires.js (which needs to know when a click landed on a component
// rather than empty canvas) can all target exactly the same set of
// elements.
export const COMPONENT_SELECTOR = [
    ".and-Gate", ".or-Gate", ".not-Gate",
    ".nand-Gate", ".nor-Gate", ".xor-Gate", ".xnor-Gate",
    ".input-signals", ".output-signals"
].join(", ");

function setDeleteMode(active) {
    setDeleteModeActive(active);
    deleteButton.classList.toggle("is-active", active);
    deleteButton.setAttribute("aria-pressed", String(active));
    workspace.classList.toggle("delete-mode", active);
}

deleteButton.addEventListener("click", () => {
    setDeleteMode(!deleteModeActive);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && deleteModeActive) setDeleteMode(false);
});

// Looks up the underlying gate or signal data object behind a placed
// component element, by matching its DOM id.
function findComponentOwner(el) {
    const gate = gates.find(g => g.id === el.id);
    if (gate) return { kind: "gate", data: gate };
    const signal = signals.find(s => s.id === el.id);
    if (signal) return { kind: "signal", data: signal };
    return null;
}

// Removes any wire touching one of the given node dom ids, so deleting
// a component never leaves a dangling wire pointing at nothing.
function removeWiresTouching(domIds) {
    for (let i = wires.length - 1; i >= 0; i--) {
        if (domIds.includes(wires[i].fromDomId) || domIds.includes(wires[i].toDomId)) {
            wires.splice(i, 1);
        }
    }
}

function deleteComponent(owner) {
    if (owner.kind === "gate") {
        const gate = owner.data;
        const domIds = [...gate.inputs.map(i => i.id), ...gate.outputs.map(o => o.id)];
        removeWiresTouching(domIds);
        gates.splice(gates.indexOf(gate), 1);
    } else {
        const signal = owner.data;
        removeWiresTouching([`${signal.id}-node`]);
        signals.splice(signals.indexOf(signal), 1);
    }
    const el = document.getElementById(owner.data.id);
    if (el) el.remove();
}

// Intercept as early as possible, on the mousedown capture phase, so
// that in delete mode a click on a gate/signal never reaches the
// existing drag (workspace.js), wire-drag (wires.js), or input-toggle
// (signals.js) handlers - it only deletes the component.
document.addEventListener("mousedown", (e) => {
    if (!deleteModeActive) return;

    const componentEl = e.target.closest(COMPONENT_SELECTOR);
    if (!componentEl) return;

    e.preventDefault();
    e.stopPropagation();

    const owner = findComponentOwner(componentEl);
    if (owner) {
        recordHistory();
        deleteComponent(owner);
    }
}, true);

// Touch mirror of the mousedown handler above, same capture-phase/
// stopPropagation trick so a tap on a component while in delete mode
// deletes it outright instead of also being picked up as the start of
// a drag or wire connection by workspace.js/wires.js. Registered
// non-passive so preventDefault can suppress the synthetic mouse/click
// events a touch would otherwise still fire afterwards.
document.addEventListener("touchstart", (e) => {
    if (!deleteModeActive) return;

    const componentEl = e.target.closest(COMPONENT_SELECTOR);
    if (!componentEl) return;

    e.preventDefault();
    e.stopPropagation();

    const owner = findComponentOwner(componentEl);
    if (owner) {
        recordHistory();
        deleteComponent(owner);
    }
}, { capture: true, passive: false });
import {
    signals,
    gates,
    wires,
    workspace,
    clearCanvas,
    gridSize,
} from "./state.js";
import { resetSignalCounters } from "./signals.js";
import { recordHistory } from "./history.js";

export function snapToGrid(value) {
    return Math.round(value / gridSize) * gridSize;
}

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// Checks whether placing a gate (identified by selfId) at x,y with the
// given size would overlap any other existing gate.
function isOverlappingOtherGate(selfId, x, y, w, h) {
    return gates.some(g => {
        if (g.id === selfId) return false;
        const el = document.getElementById(g.id);
        if (!el) return false;
        return rectsOverlap(x, y, w, h, g.x, g.y, el.offsetWidth, el.offsetHeight);
    });
}

export function dragElement (gate) {
    let isDragging = false; 
    let offsetX, offsetY;
    // Tracks whether this particular drag has actually moved the gate
    // yet, so we record at most one history entry per drag - right
    // before the first real position change - rather than one per
    // mousemove/touchmove event.
    let movedDuringDrag = false;

    // Mouse and single-finger touch dragging share the exact same
    // logic once you have a clientX/clientY to work with - only how
    // each event type hands over those coordinates differs (see the
    // touch handlers below), so the actual start/move/end behaviour is
    // written once here and both input types just call into it.
    const startDrag = (clientX, clientY) => {
        isDragging = true;
        movedDuringDrag = false;

        offsetX = clientX - gate.offsetLeft;
        offsetY = clientY - gate.offsetTop;

        gate.style.zIndex = '1000';
        gate.style.opacity  = '0.8';
        gate.style.cursor = 'grabbing';
    };

    const moveDrag = (clientX, clientY) => {
        if (!isDragging) return;
        let newX = clientX - offsetX;
        let newY = clientY - offsetY

        newX = snapToGrid(newX);
        newY = snapToGrid(newY);

        const workspaceRect = workspace.getBoundingClientRect();
        const gateRect = gate.getBoundingClientRect();
 
        newX = Math.max(0, Math.min(newX, workspaceRect.width - gateRect.width));
        newY = Math.max(0, Math.min(newY, workspaceRect.height - gateRect.height));

        newX = snapToGrid(newX);
        newY = snapToGrid(newY);

        if (isOverlappingOtherGate(gate.id, newX, newY, gateRect.width, gateRect.height)) {
            return; // blocked - would land on top of another gate
        }

        const gateObj = gates.find(g => g.id === gate.id);

        if (!movedDuringDrag && gateObj && (gateObj.x !== newX || gateObj.y !== newY)) {
            recordHistory();
            movedDuringDrag = true;
        }

        gate.style.left = newX + 'px';
        gate.style.top = newY + 'px';

        if (gateObj) {
            gateObj.x = newX;
            gateObj.y = newY;
        }
    }

    const endDrag = () => {
        if(isDragging) {
            isDragging = false;
            gate.style.zIndex = '2';
            gate.style.opacity = '1';
            gate.style.cursor = 'move';
        }
    }

    const mouseDownHandler = (e) => {
        e.preventDefault(); //stops selecting text when moving
        startDrag(e.clientX, e.clientY);
    };
    const mouseMoveHandler = (e) => moveDrag(e.clientX, e.clientY);
    const mouseUpHandler = () => endDrag();

    // Touch mirrors the mouse handlers above, but only for a single
    // finger - a second finger touching down mid-drag (e.g. the start
    // of a pinch) bails out rather than fighting over which touch
    // point should be driving the gate. preventDefault() on both
    // touchstart and touchmove (registered non-passive) stops the page
    // from scrolling/text-selecting while a gate is being dragged.
    const touchStartHandler = (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        startDrag(t.clientX, t.clientY);
    };
    const touchMoveHandler = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        moveDrag(t.clientX, t.clientY);
    };
    const touchEndHandler = () => endDrag();

    gate.addEventListener('mousedown', mouseDownHandler);
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    gate.addEventListener('touchstart', touchStartHandler, { passive: false });
    window.addEventListener('touchmove', touchMoveHandler, { passive: false });
    window.addEventListener('touchend', touchEndHandler);
    window.addEventListener('touchcancel', touchEndHandler);
} 


clearCanvas.addEventListener("click", () => {
    recordHistory();
    clearWorkspace();
});
export function clearWorkspace() {
    signals.length = 0;
    gates.length = 0;
    // Wires reference gate/signal ports by DOM id (e.g. "IN1-node"),
    // and those ids get reused by the next circuit's first input/output
    // signals. Leaving old wires in place meant a fresh circuit could
    // "inherit" connections from whatever was wired up before the
    // clear, purely by id coincidence - this is what was lighting up
    // outputs with nothing actually wired to them.
    wires.length = 0;

    // Remove only the placed gates/signals, not the whole workspace
    // subtree - #workspace-canvas lives here too, and wires.js keeps a
    // reference to it that it draws to every frame. Wiping it out via
    // innerHTML would silently break wire rendering for the rest of
    // the session.
    Array.from(workspace.children).forEach(el => {
        if (el.id !== "workspace-canvas") el.remove();
    });

    resetSignalCounters();

    const truthTableWrapper = document.getElementById("truthTableWrapper");
    if (truthTableWrapper) {
        truthTableWrapper.classList.remove("is-visible");
        truthTableWrapper.innerHTML = "";
    }
}
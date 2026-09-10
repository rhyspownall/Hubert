import {
    wires,
    gates,
    signals,
    workspace,
    deleteModeActive,
    simulationSpeed
} from "./state.js"
import {
    snapToGrid
} from "./workspace.js"
import {
    renderOutputSignal
} from "./signals.js"
import {
    COMPONENT_SELECTOR
} from "./delete-mode.js"
import { recordHistory } from "./history.js"

const canvas = document.getElementById("workspace-canvas");
const ctx = canvas.getContext("2d");

const WIRE_OFF_COLOUR = "#8a8a8a";
const WIRE_ON_COLOUR = "#ff0000be";
// Pulled from the CSS custom property so the "about to delete this
// wire" highlight always matches the app's delete-accent colour used
// everywhere else (the delete button, hover outlines, etc.).
const WIRE_DELETE_HOVER_COLOUR = getComputedStyle(document.documentElement)
    .getPropertyValue("--delete-accent").trim() || "#E0704F";
const WIRE_HIT_THRESHOLD = 8;

// The "wire in progress" preview drawn while dragging a new connection
// needs to read against whatever the canvas background currently is -
// a fixed colour looks fine on the dark theme's near-black workspace
// but disappears against the light theme's near-white one (and vice
// versa). --text-colour already flips between light/dark per theme
// for exactly this kind of contrast, so reuse it here instead of a
// hardcoded value. Cached against the current data-theme attribute
// rather than re-read via getComputedStyle on every animation frame,
// since the theme can change live via the Settings panel.
let cachedThemeAttr = null;
let cachedDragPreviewColour = "#ffffffcc";
function getDragPreviewColour() {
    const themeAttr = document.documentElement.getAttribute("data-theme");
    if (themeAttr !== cachedThemeAttr) {
        cachedThemeAttr = themeAttr;
        const value = getComputedStyle(document.documentElement).getPropertyValue("--text-colour").trim();
        cachedDragPreviewColour = value || "#ffffffcc";
    }
    return cachedDragPreviewColour;
}

// Now that #workspace can scroll (a circuit with lots of inputs/outputs
// or far-flung gates no longer just runs off the edge), the canvas has
// to cover the *entire* scrollable content area, not just whatever's
// currently in view - otherwise wires below the fold would have no
// canvas to be drawn on at all. This scans the live gate/signal data
// for the furthest-out edge in each direction and pads it a little.
function getContentExtent() {
    let maxBottom = 0;
    let maxRight = 0;

    signals.forEach(s => {
        maxBottom = Math.max(maxBottom, s.y + 25);
    });

    gates.forEach(g => {
        const el = document.getElementById(g.id);
        const w = el ? el.offsetWidth : 75;
        const h = el ? el.offsetHeight : 50;
        maxBottom = Math.max(maxBottom, g.y + h);
        maxRight = Math.max(maxRight, g.x + w);
    });

    return { maxBottom, maxRight };
}

// Keep the canvas sized to cover both the visible workspace pane and
// any content that extends past it (so scrolling down still shows
// correctly drawn wires), and stacked so it doesn't block clicks/drags
// on gates, signals, or their nodes.
function resizeCanvas() {
    const rect = workspace.getBoundingClientRect();
    const { maxBottom, maxRight } = getContentExtent();
    canvas.width = Math.max(rect.width, maxRight + 40);
    canvas.height = Math.max(rect.height, maxBottom + 40);
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "1";
    canvas.style.pointerEvents = "none";
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Which "role" a node plays for connection purposes: an output node
// produces a signal, an input node receives one. Gate outputs and
// input-signal nodes are outputs; gate inputs and output-signal nodes
// are inputs.
function classifyNode(el) {
    if (!el || !el.classList) return null;
    if (
        el.classList.contains("inputNodeTop") ||
        el.classList.contains("inputNodeBottom") ||
        el.classList.contains("inputNodeSingle")
    ) return "input";
    if (el.classList.contains("outputNode")) return "output";
    if (el.classList.contains("input-signal-node")) return "output";
    if (el.classList.contains("output-signal-node")) return "input";
    return null;
}

// Finds the underlying data object (gate port or signal) for a given
// node element's DOM id, plus its connection role. For both gate ports
// and signals, `port` always has a `.state` boolean, so callers can
// treat them uniformly.
function findNodeOwner(domId) {
    for (const g of gates) {
        const inp = g.inputs.find(i => i.id === domId);
        if (inp) return { owner: g, port: inp, io: "input", domId };
        const out = g.outputs.find(o => o.id === domId);
        if (out) return { owner: g, port: out, io: "output", domId };
    }
    for (const s of signals) {
        if (`${s.id}-node` === domId) {
            const io = s.type === "input" ? "output" : "input";
            return { owner: s, port: s, io, domId };
        }
    }
    return null;
}

// Positions are measured against the canvas's own bounding rect rather
// than the outer #workspace panel. #workspace itself never moves (only
// its *contents* scroll), but the canvas is one of those scrolling
// contents, so its rect naturally shifts with scroll right along with
// every gate/signal - keeping this math scroll-position-independent.
function getNodeCenter(nodeEl) {
    const nodeRect = nodeEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
        x: nodeRect.left + nodeRect.width / 2 - canvasRect.left,
        y: nodeRect.top + nodeRect.height / 2 - canvasRect.top
    };
}

// ---- Connection limits --------------------------------------------

// Every node can carry any number of wires except an output-signal
// terminal, which only ever makes sense with a single incoming wire.
function getConnectionCount(domId) {
    return wires.filter(w => w.fromDomId === domId || w.toDomId === domId).length;
}

function canAcceptConnection(info) {
    if (info.owner.type === "output") {
        return getConnectionCount(info.domId) === 0;
    }
    return true;
}

// ---- Circuit evaluation (AND / OR / NOT) ----------------------------

function getNodeValue(domId) {
    const info = findNodeOwner(domId);
    return info ? !!info.port.state : false;
}

function getIncomingValues(domId) {
    return wires.filter(w => w.toDomId === domId).map(w => getNodeValue(w.fromDomId));
}

function computeGateOutput(gate) {
    const inputValues = gate.inputs.map(inp => {
        // A gate input can have more than one wire feeding it; treat it
        // as "on" if any connected source is on.
        const val = getIncomingValues(inp.id).some(v => v);
        inp.state = val;
        return val;
    });

    switch (gate.type) {
        case "AND": return inputValues.every(v => v);
        case "OR": return inputValues.some(v => v);
        case "NOT": return !inputValues[0];
        case "NAND": return !inputValues.every(v => v);
        case "NOR": return !inputValues.some(v => v);
        case "XOR": return inputValues.filter(v => v).length % 2 === 1;
        case "XNOR": return inputValues.filter(v => v).length % 2 === 0;
        default: return false;
    }
}

export function evaluateCircuit() {
    // Re-run several passes so values propagate through chained gates
    // regardless of the order gates/wires were created in.
    const passes = gates.length + 1;
    for (let p = 0; p < passes; p++) {
        gates.forEach(gate => {
            gate.outputs[0].state = computeGateOutput(gate);
        });
    }

    // Feed the result into output-signal terminals so their indicator
    // lights up to match whatever is wired into them.
    signals.filter(s => s.type === "output").forEach(signal => {
        const newVal = getIncomingValues(`${signal.id}-node`).some(v => v);
        if (signal.state !== newVal) {
            signal.state = newVal;
            renderOutputSignal(signal);
        }
    });
}

// ---- Drawing ----------------------------------------------------------

// Builds the orthogonal, Manhattan-style "Z" path (horizontal-vertical-
// horizontal) between two points as a list of [x1,y1,x2,y2] segments,
// with the middle vertical segment snapped to the grid. Shared by the
// simple full-stroke draw below, the propagation animation's partial
// strokes, and the hit-testing segments used for delete-mode.
function buildWireSegments(x1, y1, x2, y2) {
    const midX = snapToGrid((x1 + x2) / 2);
    return [
        [x1, y1, midX, y1],
        [midX, y1, midX, y2],
        [midX, y2, x2, y2]
    ];
}

function strokeSegments(segments) {
    ctx.beginPath();
    ctx.moveTo(segments[0][0], segments[0][1]);
    segments.forEach(([, , x2, y2]) => ctx.lineTo(x2, y2));
    ctx.stroke();
}

function segmentsLength(segments) {
    return segments.reduce((sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1), 0);
}

// Strokes only the portion of a polyline lying between arc-length
// startDist and endDist (both measured from the start of the path).
// Used to paint the "already switched" and "not yet switched" halves
// of a wire mid-animation as two separate coloured strokes.
function strokeSegmentSpan(segments, startDist, endDist) {
    let traveled = 0;
    let penDown = false;
    ctx.beginPath();

    segments.forEach(([x1, y1, x2, y2]) => {
        const segLen = Math.hypot(x2 - x1, y2 - y1);
        const segStart = traveled;
        const segEnd = traveled + segLen;

        if (segEnd >= startDist && segStart <= endDist) {
            const tStart = segLen ? Math.max(0, (startDist - segStart) / segLen) : 0;
            const tEnd = segLen ? Math.min(1, (endDist - segStart) / segLen) : 1;
            const ax = x1 + (x2 - x1) * tStart;
            const ay = y1 + (y2 - y1) * tStart;
            const bx = x1 + (x2 - x1) * tEnd;
            const by = y1 + (y2 - y1) * tEnd;

            if (!penDown) {
                ctx.moveTo(ax, ay);
                penDown = true;
            }
            ctx.lineTo(bx, by);
        }

        traveled = segEnd;
    });

    if (penDown) ctx.stroke();
}

// Draws an orthogonal, Manhattan-style "Z" path (horizontal-vertical-
// horizontal) between two points, with the middle vertical segment
// snapped to the grid.
function drawWirePath(x1, y1, x2, y2) {
    strokeSegments(buildWireSegments(x1, y1, x2, y2));
}

// ---- Wire propagation animation (Settings > Simulation Speed) --------
// When the setting is "normal", a wire's on/off transition travels
// along its length from the output end to the input end rather than
// flipping instantly. Keyed by wire object identity via a WeakMap, so
// a deleted wire (or one wholesale-replaced by an undo/redo snapshot
// in history.js) simply drops its animation state instead of leaking
// or colliding with an unrelated wire that happens to reuse the same
// id.
const wireAnimStates = new WeakMap();

const WIRE_TRAVEL_SPEED = 0.5; // px per millisecond
const WIRE_ANIM_MIN_MS = 120;
const WIRE_ANIM_MAX_MS = 700;

function getWireAnimState(wire, value, segments) {
    const now = performance.now();
    let anim = wireAnimStates.get(wire);

    if (!anim) {
        // First time this wire has been drawn - settle immediately at
        // whatever its value already is, so nothing animates in out of
        // nowhere (e.g. right after an undo/redo restores a snapshot,
        // or when a brand new wire is created already carrying a value).
        anim = { value, previousValue: value, animating: false, startTime: now, duration: 0 };
        wireAnimStates.set(wire, anim);
        return anim;
    }

    if (value !== anim.value) {
        anim.previousValue = anim.value;
        anim.value = value;
        anim.animating = true;
        anim.startTime = now;
        anim.duration = Math.min(
            WIRE_ANIM_MAX_MS,
            Math.max(WIRE_ANIM_MIN_MS, segmentsLength(segments) / WIRE_TRAVEL_SPEED)
        );
    }

    if (anim.animating && now - anim.startTime >= anim.duration) {
        anim.animating = false;
    }

    return anim;
}

// ---- Wire hit-testing (used for the delete-mode hover highlight and
// click-to-delete below) ------------------------------------------------

// Same three-segment "Z" shape as drawWirePath, but as plain
// coordinates instead of an immediate canvas draw, so distances can be
// measured against it.
function getWireSegments(wire) {
    const fromEl = document.getElementById(wire.fromDomId);
    const toEl = document.getElementById(wire.toDomId);
    if (!fromEl || !toEl) return null;

    const p1 = getNodeCenter(fromEl);
    const p2 = getNodeCenter(toEl);
    return buildWireSegments(p1.x, p1.y, p2.x, p2.y);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
}

function distanceToWire(wire, x, y) {
    const segments = getWireSegments(wire);
    if (!segments) return Infinity;
    return Math.min(...segments.map(([x1, y1, x2, y2]) => distanceToSegment(x, y, x1, y1, x2, y2)));
}

// Returns the closest wire to (x, y) within WIRE_HIT_THRESHOLD, or null
// if nothing is close enough - so an imprecise click doesn't grab the
// wrong wire out of several nearby ones.
function findWireNear(x, y) {
    let closest = null;
    let closestDist = WIRE_HIT_THRESHOLD;
    wires.forEach(wire => {
        const d = distanceToWire(wire, x, y);
        if (d < closestDist) {
            closestDist = d;
            closest = wire;
        }
    });
    return closest;
}

function drawAllWires() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([]);

    wires.forEach(wire => {
        const fromEl = document.getElementById(wire.fromDomId);
        const toEl = document.getElementById(wire.toDomId);
        if (!fromEl || !toEl) return;

        const p1 = getNodeCenter(fromEl);
        const p2 = getNodeCenter(toEl);
        const segments = buildWireSegments(p1.x, p1.y, p2.x, p2.y);
        const value = getNodeValue(wire.fromDomId);

        if (simulationSpeed === "instant") {
            ctx.strokeStyle = value ? WIRE_ON_COLOUR : WIRE_OFF_COLOUR;
            strokeSegments(segments);
            return;
        }

        const anim = getWireAnimState(wire, value, segments);

        if (!anim.animating) {
            ctx.strokeStyle = anim.value ? WIRE_ON_COLOUR : WIRE_OFF_COLOUR;
            strokeSegments(segments);
            return;
        }

        // The travelling front (advancing from the output/source end)
        // already reflects the new value; everything past it still
        // shows the old one, until the front reaches the far end.
        const totalLen = segmentsLength(segments);
        const progress = Math.min(1, (performance.now() - anim.startTime) / anim.duration);
        const frontDist = totalLen * progress;

        ctx.strokeStyle = anim.value ? WIRE_ON_COLOUR : WIRE_OFF_COLOUR;
        strokeSegmentSpan(segments, 0, frontDist);
        ctx.strokeStyle = anim.previousValue ? WIRE_ON_COLOUR : WIRE_OFF_COLOUR;
        strokeSegmentSpan(segments, frontDist, totalLen);
    });

    if (dragState) {
        ctx.strokeStyle = getDragPreviewColour();
        ctx.setLineDash([6, 4]);
        drawWirePath(dragState.start.x, dragState.start.y, dragState.current.x, dragState.current.y);
        ctx.setLineDash([]);
    }

    // In delete mode, show which wire a click would remove - without
    // this, empty-canvas wire deletion has no visual feedback at all
    // and would feel like it was doing nothing until the mouse happened
    // to land in exactly the right spot.
    if (deleteModeActive && hoverPos) {
        const hovered = findWireNear(hoverPos.x, hoverPos.y);
        if (hovered) {
            const fromEl = document.getElementById(hovered.fromDomId);
            const toEl = document.getElementById(hovered.toDomId);
            if (fromEl && toEl) {
                const p1 = getNodeCenter(fromEl);
                const p2 = getNodeCenter(toEl);
                ctx.strokeStyle = WIRE_DELETE_HOVER_COLOUR;
                ctx.lineWidth = 3;
                drawWirePath(p1.x, p1.y, p2.x, p2.y);
                ctx.lineWidth = 2;
            }
        }
    }
}

// Redraw (and re-evaluate the circuit) continuously so wires stay
// attached and colour-accurate while gates are dragged and signals
// toggled.
function animationLoop() {
    resizeCanvas();
    evaluateCircuit();
    drawAllWires();
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// ---- Dragging / connecting wires --------------------------------------

let dragState = null;
let hoverPos = null;

workspace.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    hoverPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});
workspace.addEventListener("mouseleave", () => {
    hoverPos = null;
});

// Clicking empty canvas in delete mode removes whichever wire is under
// the cursor, without touching the gates/signals it connects. Clicks
// that land on an actual component are left alone here - delete-mode.js
// already handles those (and deletes the whole component instead).
workspace.addEventListener("mousedown", (e) => {
    if (!deleteModeActive) return;
    if (e.target.closest(COMPONENT_SELECTOR)) return;
    if (classifyNode(e.target)) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = findWireNear(x, y);
    if (hit) {
        recordHistory();
        wires.splice(wires.indexOf(hit), 1);
    }
});

// Touch mirror of the above: tapping empty canvas in delete mode
// removes whichever wire is under the tap. delete-mode.js's touchstart
// handler (also capture-phase) already claims taps that land on an
// actual component and stops the event there, so by the time this
// bubble-phase listener runs, a tap that reaches here can only have
// hit empty canvas or a wire.
workspace.addEventListener("touchstart", (e) => {
    if (!deleteModeActive) return;
    if (e.target.closest(COMPONENT_SELECTOR)) return;
    if (classifyNode(e.target)) return;
    if (e.touches.length !== 1) return;

    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;

    const hit = findWireNear(x, y);
    if (hit) {
        e.preventDefault();
        recordHistory();
        wires.splice(wires.indexOf(hit), 1);
    }
});

// Prevents a click (used elsewhere to toggle input signals) from firing
// right after a mousedown/mouseup pair was actually a wire drag.
function suppressNextClick(el) {
    const handler = (e) => {
        e.stopPropagation();
        el.removeEventListener("click", handler, true);
    };
    el.addEventListener("click", handler, true);
}

// Capture phase is important here: gates have their own mousedown
// listener (for dragging the gate) attached directly to the gate
// element, which sits between a node and `document` in the bubble
// path. Listening on the bubble phase meant the gate's drag handler
// always fired first. Listening on the capture phase lets us intercept
// and stop the event before it ever reaches the gate.
document.addEventListener("mousedown", (e) => {
    if (deleteModeActive) return;

    const io = classifyNode(e.target);
    if (!io) return;

    const info = findNodeOwner(e.target.id);
    if (!info || !canAcceptConnection(info)) return;

    e.preventDefault();
    e.stopPropagation();
    suppressNextClick(e.target);

    const start = getNodeCenter(e.target);
    dragState = {
        nodeId: e.target.id,
        io,
        start,
        current: start
    };

    document.addEventListener("mousemove", onWireMouseMove);
    document.addEventListener("mouseup", onWireMouseUp);
}, true);

function onWireMouseMove(e) {
    if (!dragState) return;
    const rect = canvas.getBoundingClientRect();
    dragState.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function onWireMouseUp(e) {
    document.removeEventListener("mousemove", onWireMouseMove);
    document.removeEventListener("mouseup", onWireMouseUp);
    if (!dragState) return;

    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    finishWireDrag(targetEl);
}

// Touch mirror of the block above: starting a wire drag from a node,
// tracking the finger as it moves, and completing (or abandoning) the
// connection on lift. Kept as separate handlers rather than merging
// with the mouse versions, since touch events hand coordinates over
// differently (touches/changedTouches arrays instead of clientX/Y
// directly on the event) and touchend's target is always the original
// touchstart element rather than whatever is under the finger now -
// elementFromPoint has to be used explicitly to find the drop target.
document.addEventListener("touchstart", (e) => {
    if (deleteModeActive) return;
    if (e.touches.length !== 1) return;

    const io = classifyNode(e.target);
    if (!io) return;

    const info = findNodeOwner(e.target.id);
    if (!info || !canAcceptConnection(info)) return;

    e.preventDefault();
    e.stopPropagation();
    suppressNextClick(e.target);

    const start = getNodeCenter(e.target);
    dragState = {
        nodeId: e.target.id,
        io,
        start,
        current: start
    };

    document.addEventListener("touchmove", onWireTouchMove, { passive: false });
    document.addEventListener("touchend", onWireTouchEnd);
    document.addEventListener("touchcancel", onWireTouchCancel);
}, { capture: true, passive: false });

function onWireTouchMove(e) {
    if (!dragState || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    dragState.current = {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top
    };
}

function onWireTouchEnd(e) {
    document.removeEventListener("touchmove", onWireTouchMove);
    document.removeEventListener("touchend", onWireTouchEnd);
    document.removeEventListener("touchcancel", onWireTouchCancel);
    if (!dragState) return;

    const t = e.changedTouches[0];
    const targetEl = t ? document.elementFromPoint(t.clientX, t.clientY) : null;
    finishWireDrag(targetEl);
}

function onWireTouchCancel() {
    document.removeEventListener("touchmove", onWireTouchMove);
    document.removeEventListener("touchend", onWireTouchEnd);
    document.removeEventListener("touchcancel", onWireTouchCancel);
    dragState = null;
}

// Shared by both the mouse and touch drag-end handlers: given whatever
// element the pointer/finger ended up over, either completes the wire
// connection or just drops the in-progress drag if the drop target
// isn't a valid opposite-role node.
function finishWireDrag(targetEl) {
    const targetIO = classifyNode(targetEl);

    if (targetEl && targetIO && targetIO !== dragState.io && targetEl.id !== dragState.nodeId) {
        const fromInfo = findNodeOwner(dragState.nodeId);
        const toInfo = findNodeOwner(targetEl.id);

        if (fromInfo && toInfo && canAcceptConnection(fromInfo) && canAcceptConnection(toInfo)) {
            createWire(fromInfo, toInfo);
        }
    }

    dragState = null;
}

function createWire(fromInfo, toInfo) {
    const outputInfo = fromInfo.io === "output" ? fromInfo : toInfo;
    const inputInfo = fromInfo.io === "input" ? fromInfo : toInfo;

    // Skip if this exact connection already exists.
    const alreadyWired = wires.some(w =>
        w.fromDomId === outputInfo.domId && w.toDomId === inputInfo.domId
    );
    if (alreadyWired) return;

    recordHistory();

    const newWire = {
        id: "WIRE" + (wires.length + 1),
        type: "output-input",
        fromDomId: outputInfo.domId,
        toDomId: inputInfo.domId,
        state: false
    };

    wires.push(newWire);
}
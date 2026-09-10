import { signals, gates, wires } from "./state.js";

const createButton = document.getElementById("createEquationButton");
const panel = document.getElementById("equationPanel");
const body = document.getElementById("equationBody");

createButton.addEventListener("click", () => {
    generateEquations();
});

// ---- Expression tree helpers -------------------------------------------
// Every expression is { text, prec }, where prec is a precedence tier
// used to decide whether a child needs parentheses when it's dropped
// into a lower-precedence context:
//   0 = OR combination        (lowest binding: "A + B")
//   1 = XOR combination       ("A \u2295 B")
//   2 = AND combination       ("A\u00B7B")
//   4 = atom / complement     (a variable, a literal, or anything
//                              already wrapped as a single unit, e.g. "A'")
const ATOM = 4, AND_LEVEL = 2, XOR_LEVEL = 1, OR_LEVEL = 0;

function wrap(expr, minPrec) {
    return expr.prec < minPrec ? `(${expr.text})` : expr.text;
}

function combineOr(list) {
    if (list.length === 0) return { text: "0", prec: ATOM };
    if (list.length === 1) return list[0];
    return { text: list.map(e => wrap(e, OR_LEVEL)).join(" + "), prec: OR_LEVEL };
}

function combineAnd(list) {
    if (list.length === 0) return { text: "0", prec: ATOM };
    if (list.length === 1) return list[0];
    return { text: list.map(e => wrap(e, AND_LEVEL)).join("\u00B7"), prec: AND_LEVEL };
}

function combineXor(list) {
    if (list.length === 0) return { text: "0", prec: ATOM };
    if (list.length === 1) return list[0];
    return { text: list.map(e => wrap(e, XOR_LEVEL)).join(" \u2295 "), prec: XOR_LEVEL };
}

function complement(expr) {
    if (expr.prec >= ATOM) return { text: `${expr.text}'`, prec: ATOM };
    return { text: `(${expr.text})'`, prec: ATOM };
}

// Cycle guard: a gate feeding back into its own input (directly or
// through others) would otherwise recurse forever. `visited` tracks
// gate ids seen along the *current* path only, so the same gate can
// still legitimately appear twice via two different branches (a
// diamond, not a loop) without tripping this.
function computeGateExpr(gate, visited) {
    if (visited.has(gate.id)) {
        return { text: "\u22EF", prec: ATOM };
    }
    const nextVisited = new Set(visited);
    nextVisited.add(gate.id);

    const inputExprs = gate.inputs.map(port => {
        const sources = wires
            .filter(w => w.toDomId === port.id)
            .map(w => resolveSource(w.fromDomId, nextVisited));
        return combineOr(sources);
    });

    switch (gate.type) {
        case "AND": return combineAnd(inputExprs);
        case "OR": return combineOr(inputExprs);
        case "NOT": return complement(inputExprs[0] ?? { text: "0", prec: ATOM });
        case "NAND": return complement(combineAnd(inputExprs));
        case "NOR": return complement(combineOr(inputExprs));
        case "XOR": return combineXor(inputExprs);
        case "XNOR": return complement(combineXor(inputExprs));
        default: return { text: "0", prec: ATOM };
    }
}

// Resolves whatever is feeding a wire's source end - either a gate
// output (recurse into that gate) or an input-signal node (a leaf
// variable, named after the signal).
function resolveSource(domId, visited) {
    const gate = gates.find(g => g.outputs.some(o => o.id === domId));
    if (gate) return computeGateExpr(gate, visited);

    const signal = signals.find(s => s.type === "input" && `${s.id}-node` === domId);
    if (signal) {
        const name = signal.name && signal.name.trim() ? signal.name.trim() : signal.id;
        return { text: name, prec: ATOM };
    }

    return { text: "0", prec: ATOM };
}

function buildEquations() {
    const outputs = signals.filter(s => s.type === "output");
    return outputs.map(out => {
        const sources = wires
            .filter(w => w.toDomId === `${out.id}-node`)
            .map(w => resolveSource(w.fromDomId, new Set()));
        const expr = combineOr(sources);
        const label = out.name && out.name.trim() ? out.name.trim() : out.id;
        return { label, text: expr.text };
    });
}

function generateEquations() {
    const equations = buildEquations();

    body.innerHTML = "";

    if (equations.length === 0) {
        const message = document.createElement("p");
        message.classList.add("equation-placeholder");
        message.textContent = "Add at least one output signal to see its equation.";
        body.appendChild(message);
        panel.classList.add("is-active");
        return;
    }

    equations.forEach(eq => {
        const row = document.createElement("div");
        row.classList.add("equation-row");

        const label = document.createElement("span");
        label.classList.add("equation-label");
        label.textContent = eq.label;
        row.appendChild(label);

        const op = document.createElement("span");
        op.classList.add("equation-op");
        op.textContent = "=";
        row.appendChild(op);

        const expr = document.createElement("span");
        expr.classList.add("equation-expr");
        expr.textContent = eq.text;
        row.appendChild(expr);

        body.appendChild(row);
    });

    panel.classList.add("is-active");
}

const closeBtn = document.getElementById("equationClose");
if (closeBtn) {
    closeBtn.addEventListener("click", () => {
        panel.classList.remove("is-active");
        body.innerHTML = "";
    });
}
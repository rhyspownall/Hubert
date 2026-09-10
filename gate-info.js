const GATE_INFO = {
    AND: {
        summary: "Outputs true only when every connected input is true. Think of it as a strict \u201Call conditions must be met\u201D gate.",
        cols: ["A", "B", "Y"],
        rows: [
            [0, 0, 0],
            [0, 1, 0],
            [1, 0, 0],
            [1, 1, 1]
        ]
    },
    OR: {
        summary: "Outputs true when at least one connected input is true. Useful whenever any single condition should trigger a result.",
        cols: ["A", "B", "Y"],
        rows: [
            [0, 0, 0],
            [0, 1, 1],
            [1, 0, 1],
            [1, 1, 1]
        ]
    },
    NOT: {
        summary: "Inverts its single input \u2014 true becomes false, and false becomes true. Often called an inverter.",
        cols: ["A", "Y"],
        rows: [
            [0, 1],
            [1, 0]
        ]
    },
    NAND: {
        summary: "The opposite of AND: outputs false only when every input is true. Equivalent to an AND gate followed by an inverter.",
        cols: ["A", "B", "Y"],
        rows: [
            [0, 0, 1],
            [0, 1, 1],
            [1, 0, 1],
            [1, 1, 0]
        ]
    },
    NOR: {
        summary: "The opposite of OR: outputs true only when every input is false. Equivalent to an OR gate followed by an inverter.",
        cols: ["A", "B", "Y"],
        rows: [
            [0, 0, 1],
            [0, 1, 0],
            [1, 0, 0],
            [1, 1, 0]
        ]
    },
    XOR: {
        summary: "Outputs true when its inputs differ from each other, and false when they match. Handy for detecting a difference between two signals.",
        cols: ["A", "B", "Y"],
        rows: [
            [0, 0, 0],
            [0, 1, 1],
            [1, 0, 1],
            [1, 1, 0]
        ]
    },
    XNOR: {
        summary: "The opposite of XOR: outputs true when its inputs match each other, and false when they differ.",
        cols: ["A", "B", "Y"],
        rows: [
            [0, 0, 1],
            [0, 1, 0],
            [1, 0, 0],
            [1, 1, 1]
        ]
    },
    // These two don't describe a gate's truth table - they describe
    // what the corresponding bottom-bar action button does - so they
    // carry a `label` for the popover title instead of the default
    // "TYPE gate" heading, and no cols/rows (buildPopover skips the
    // table entirely when those are absent).
    EQUATION: {
        label: "Boolean Equation",
        summary: "Walks every gate and wire currently on the canvas and derives a boolean algebra expression for each output, written in terms of your input names."
    },
    TRUTHTABLE: {
        label: "Truth Table",
        summary: "Cycles through every combination of your input signals and records what each output does for each one, laying the results out as a full truth table. Capped at 10 inputs to stay responsive."
    }
};

let openPopover = null;
let openButton = null;

function closePopover() {
    if (openPopover) {
        openPopover.remove();
        openPopover = null;
        openButton = null;
    }
}

function buildPopover(type) {
    const info = GATE_INFO[type];
    if (!info) return null;

    const popover = document.createElement("div");
    popover.classList.add("gate-info-popover", `gate-info-popover--${type.toLowerCase()}`);

    const title = document.createElement("div");
    title.classList.add("gate-info-popover-title");
    title.textContent = info.label || `${type} gate`;
    popover.appendChild(title);

    const desc = document.createElement("p");
    desc.classList.add("gate-info-popover-desc");
    desc.textContent = info.summary;
    popover.appendChild(desc);

    if (info.cols && info.rows) {
        const table = document.createElement("table");
        table.classList.add("gate-info-table");

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        info.cols.forEach(col => {
            const th = document.createElement("th");
            th.textContent = col;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        info.rows.forEach(row => {
            const tr = document.createElement("tr");
            row.forEach((val, i) => {
                const td = document.createElement("td");
                td.textContent = val;
                if (val === 1 && i === row.length - 1) td.classList.add("is-on");
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        popover.appendChild(table);
    }

    return popover;
}

// The popover is fixed to the viewport (not nested inside the sidebar),
// so it always paints above every panel regardless of stacking context,
// and we position/clamp it manually against the button's screen rect.
function positionPopover(popover, btn) {
    const margin = 10;
    const rect = btn.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    let left = rect.right + 14;
    if (left + popoverRect.width > window.innerWidth - margin) {
        left = rect.left - popoverRect.width - 14;
        popover.classList.add("gate-info-popover--flipped");
    } else {
        popover.classList.remove("gate-info-popover--flipped");
    }
    left = Math.max(margin, left);

    let top = rect.top;
    if (top + popoverRect.height > window.innerHeight - margin) {
        top = window.innerHeight - popoverRect.height - margin;
    }
    top = Math.max(margin, top);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}

function togglePopover(e, btn) {
    e.stopPropagation();
    e.preventDefault();

    const wasOpenForThis = openButton === btn;
    closePopover();
    if (wasOpenForThis) return;

    const popover = buildPopover(btn.dataset.gateType);
    if (!popover) return;

    document.body.appendChild(popover);
    positionPopover(popover, btn);

    openPopover = popover;
    openButton = btn;
}

document.querySelectorAll(".gate-info-btn").forEach(btn => {
    btn.addEventListener("click", (e) => togglePopover(e, btn));
    btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            togglePopover(e, btn);
        }
    });
});

document.addEventListener("click", (e) => {
    if (openPopover && !e.target.closest(".gate-info-popover") && !e.target.closest(".gate-info-btn")) {
        closePopover();
    }
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
});
window.addEventListener("resize", closePopover);

// If the sidebar itself scrolls (it can now that there are more gate
// buttons than fit in short viewports), the button the popover was
// anchored to moves, so just close it rather than leaving it stranded.
const sideBar = document.getElementById("side-bar");
if (sideBar) {
    sideBar.addEventListener("scroll", closePopover);
}
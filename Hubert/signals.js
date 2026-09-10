import {
    signals,
    addInputSignalButton,
    addOutputSignalButton,
    gridSize
} from "./state.js";
import { recordHistory } from "./history.js";

let inputSignalCount = 0;
let outputSignalCount = 0;

export function resetSignalCounters() {
    inputSignalCount = 0;
    outputSignalCount = 0;
}

export function syncSignalCounters() {
    let maxIn = 0;
    let maxOut = 0;
    signals.forEach(s => {
        if (s.type === "input") {
            const n = parseInt(s.id.replace("IN", ""), 10);
            if (!isNaN(n)) maxIn = Math.max(maxIn, n);
        } else if (s.type === "output") {
            const n = parseInt(s.id.replace("OU", ""), 10);
            if (!isNaN(n)) maxOut = Math.max(maxOut, n);
        }
    });
    inputSignalCount = maxIn;
    outputSignalCount = maxOut;
}

function letterName(n) {
    let label = "";
    while (n > 0) {
        const remainder = (n - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        n = Math.floor((n - 1) / 26);
    }
    return label;
}

addInputSignalButton.addEventListener("click", () => {
    inputSignalCount++;
    const n = inputSignalCount;
    const newInputSignal = {
        type: "input",
        name: letterName(n),
        id: `IN${n}`,
        state: false,
        node: false,
        nodeId: `IN(N)${n}`,
        x: 0,
        y: ((n - 1) * gridSize) + (gridSize / 2)
    };
    recordHistory();
    signals.push(newInputSignal);
    renderInputSignal(newInputSignal);
});
addOutputSignalButton.addEventListener("click", () => {
    outputSignalCount++;
    const n = outputSignalCount;
    const newOutputSignal = {
        type: "output",
        name: `Y${n}`,
        id: `OU${n}`,
        state: false,
        node: false,
        nodeId: `OU(N)${n}`,
        x: 0,
        y: ((n - 1) * gridSize) + (gridSize / 2)
    };
    recordHistory();
    signals.push(newOutputSignal);
    renderOutputSignal(newOutputSignal);
});

export function renderInputSignal (signal) {
    let element;
    let node;
    let label;

    if(!document.getElementById(signal.id)) {
        element = document.createElement("div");
        element.classList.add("input-signals");
        element.id = signal.id;
        element.style.top = signal.y + "px";
        element.style.left = signal.x + "px";
        element.style.zIndex = "3";
        element.style.position = "absolute";
        element.title = "Click to toggle";

        label = document.createElement("span");
        label.classList.add("signal-label");
        element.appendChild(label);

        node = document.createElement("div");
        node.id = `${signal.id}-node`;
        node.classList.add("input-signal-node");
        node.style.zIndex = "2";
        element.appendChild(node);

        document.getElementById("workspace").appendChild(element);

        element.addEventListener("click", () => {
            toggleInputState(signal);
        });
    } else {
        element = document.getElementById(signal.id);
        node = document.getElementById(`${signal.id}-node`);
        label = element.querySelector(".signal-label");
    }

    if (label) label.textContent = signal.name;

    if (signal.state == false) {
        element.style.backgroundColor = "rgb(90, 0, 0)";
        if (node) node.style.backgroundColor = "rgb(90, 0, 0)";
    } else if (signal.state == true) {
        element.style.backgroundColor = "rgb(182, 1, 1)";
        if (node) node.style.backgroundColor = "rgb(182, 1, 1)";
    }
}

export function renderOutputSignal(signal) {
    let element;
    let node;
    let label;

    if(!document.getElementById(signal.id)) {
        element = document.createElement("div");
        element.classList.add("output-signals");
        element.id = signal.id;
        element.style.top = signal.y + "px";
        element.style.right = signal.x + "px";

        label = document.createElement("span");
        label.classList.add("signal-label");
        element.appendChild(label);

        node = document.createElement("div");
        node.id = `${signal.id}-node`;
        node.classList.add("output-signal-node");
        node.style.zIndex = "2";
        element.appendChild(node);

        document.getElementById("workspace").appendChild(element);
    } else {
        element = document.getElementById(signal.id);
        node = document.getElementById(`${signal.id}-node`);
        label = element.querySelector(".signal-label");
    }

    if (label) label.textContent = signal.name;

    if (signal.state == false) {
        element.style.backgroundColor = "rgb(90, 0, 0)";
        if (node) node.style.backgroundColor = "rgb(90, 0, 0)";
    } else if (signal.state == true) {
        element.style.backgroundColor = "rgb(182, 1, 1)";
        if (node) node.style.backgroundColor = "rgb(182, 1, 1)";
    }
}

export function toggleInputState(signal) {
    signal.state = !signal.state;
    signal.node = !signal.node;
    renderInputSignal(signal)
}
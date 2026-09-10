import { signals } from "./state.js";
import { evaluateCircuit } from "./wires.js";

const createButton = document.getElementById("createTruthTable");
const wrapper = document.getElementById("truthTableWrapper");

createButton.addEventListener("click", () => {
    generateTruthTable();
});

function generateTruthTable() {
    const inputs = signals.filter(s => s.type === "input");
    const outputs = signals.filter(s => s.type === "output");

    if (inputs.length === 0 || outputs.length === 0) {
        renderEmptyState();
        return;
    }

    // Every extra input doubles the row count, so beyond a handful of
    // inputs this would generate an enormous table (2^20 rows for 20
    // inputs) and lock up the tab. Cap it rather than let that happen.
    if (inputs.length > 10) {
        renderTooManyInputsState(inputs.length);
        return;
    }

    // Remember the live states so the user's actual circuit is restored
    // once we're done cycling through every combination.
    const savedStates = inputs.map(inp => inp.state);

    const rowCount = 2 ** inputs.length;
    const rows = [];

    for (let i = 0; i < rowCount; i++) {
        inputs.forEach((inp, idx) => {
            const bit = (i >> (inputs.length - 1 - idx)) & 1;
            inp.state = !!bit;
        });

        evaluateCircuit();

        rows.push({
            inputValues: inputs.map(inp => inp.state),
            outputValues: outputs.map(out => out.state)
        });
    }

    inputs.forEach((inp, idx) => { inp.state = savedStates[idx]; });
    evaluateCircuit();

    renderTable(inputs, outputs, rows);
}

function renderEmptyState() {
    wrapper.innerHTML = "";
    wrapper.appendChild(buildToolbar());

    const message = document.createElement("p");
    message.classList.add("truth-table-empty");
    message.textContent = "Add at least one input and one output signal to generate a truth table.";
    wrapper.appendChild(message);

    wrapper.classList.add("is-visible");
}

function renderTooManyInputsState(count) {
    wrapper.innerHTML = "";
    wrapper.appendChild(buildToolbar());

    const message = document.createElement("p");
    message.classList.add("truth-table-empty");
    message.textContent = `Truth tables are capped at 10 inputs to keep things responsive (this circuit has ${count}).`;
    wrapper.appendChild(message);

    wrapper.classList.add("is-visible");
}

function renderTable(inputs, outputs, rows) {
    wrapper.innerHTML = "";
    wrapper.appendChild(buildToolbar());

    const scrollContainer = document.createElement("div");
    scrollContainer.classList.add("truth-table-scroll");

    const table = document.createElement("table");
    table.classList.add("truth-table");

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    inputs.forEach(inp => {
        const th = document.createElement("th");
        th.textContent = inp.name || inp.id;
        headRow.appendChild(th);
    });
    outputs.forEach((out, idx) => {
        const th = document.createElement("th");
        th.textContent = out.name || `Y${idx + 1}`;
        th.classList.add("truth-table-output-col");
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach(row => {
        const tr = document.createElement("tr");
        row.inputValues.forEach(v => {
            const td = document.createElement("td");
            td.textContent = v ? "1" : "0";
            if (v) td.classList.add("is-on");
            tr.appendChild(td);
        });
        row.outputValues.forEach(v => {
            const td = document.createElement("td");
            td.textContent = v ? "1" : "0";
            td.classList.add("truth-table-output-col");
            if (v) td.classList.add("is-on");
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    scrollContainer.appendChild(table);
    wrapper.appendChild(scrollContainer);
    wrapper.classList.add("is-visible");
}

function buildToolbar() {
    const toolbar = document.createElement("div");
    toolbar.classList.add("truth-table-toolbar");

    const title = document.createElement("span");
    title.classList.add("truth-table-title");
    title.textContent = "Truth Table";
    toolbar.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("truth-table-close");
    closeBtn.setAttribute("aria-label", "Close truth table");
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", () => {
        wrapper.classList.remove("is-visible");
        wrapper.innerHTML = "";
    });
    toolbar.appendChild(closeBtn);

    return toolbar;
}
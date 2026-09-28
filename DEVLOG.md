Signals:
    -addInputSignalButton and addOutputSignalButton are defined in state.js for the buttons in the html, and imported into signals.js
    -each has its own click listener (no shared builder like the gates, as input and output signals differ slightly). On each click:
        -inputSignalCount / outputSignalCount is incremented to get n
        -a signal object is built with type, name, id (IN1, OU1 etc.), state, node, nodeId and x/y. Inputs are named by letter (A, B... AA) using letterName(n), outputs are Y1, Y2 etc. y is worked out from n and gridSize so signals stack down the side.
        -recordHistory() is called BEFORE signals.push() so undo has the previous state
        -renderInputSignal() or renderOutputSignal() then draws it
    -renderInputSignal and renderOutputSignal make a div with the signal's id, class and position, add a label span and a node div (id + "-node"), and append it to #workspace. Input signals are positioned with left and outputs with right, so they sit on opposite sides. Input signals also get a click listener that calls toggleInputState().
    -both render functions can be called again on an existing signal. If the div already exists they skip creating it and just update the label and colour (dark red for false, bright red for true). So they double as the update function, and are exported so loading a save or undo/redo can redraw signals from data.
    -toggleInputState(signal) flips signal.state and signal.node then re-renders it. Only inputs can be toggled, outputs are driven by the circuit.
    -inputSignalCount and outputSignalCount track the latest number used for ids. resetSignalCounters() sets both to 0, and syncSignalCounters() sets them to the highest existing IN/OU number in signals[], so new signals don't reuse an id after loading a save or undo.

    Gates:
    -add(GATE)Button are defined in state.js for each gate type, same as signals, and imported into gates.js
    -2 input gates (AND, OR, NAND, NOR, XOR, XNOR) are all set up by bindTwoInputGateButton(button, type, renderFn). It's called once per type when the file loads, and adds a click listener to that button. Each listener remembers its own type and renderFn.
    -On each click:
        -nextGateId(type) makes a unique id (e.g. AND3)
        -findFreePosition() picks a random grid-snapped spot that doesn't overlap another gate
        -a gate object is built with the id, x/y, two inputs (_INP1, _INP2) and one output (_OUT1)
        -recordHistory() is called BEFORE gates.push(newGate) so undo has the previous state
        -renderFn(newGate) then draws it
    -renderANDGate, renderORGate etc. are thin wrappers around renderTwoInputGate(gate, className). It makes a div with the gate's id, class and position, adds the input and output node divs, makes it draggable with dragElement() and appends it to #workspace. They're exported so loading a save or undo/redo can redraw gates from data without the button.
    -The NOT gate is separate because it only has one input. Its click listener is written out directly with the same steps, and renderNOTGate does the same as renderTwoInputGate but with one input node (inputNodeSingle) and the "not-Gate" class.
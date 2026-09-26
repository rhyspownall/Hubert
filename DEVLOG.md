Signals: 
    -addInputSignalsButton and addOutputSignalsButton are both defined in state.js as the buttons with the buttons in html which will make them. These are imported into signals.js
    -these are both given arrow functions which detect a click. When clicked, the function pushes a new element into signals[]. It also calls renderOutputSignal().
    -renderOutputSignal makes a new div element with the id of signal.id and all the positionings etc.

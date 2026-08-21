// Global drag observation must not be blocked by application handlers that
// stop pointer events while the package owns the interaction.
export const globalPointerListenerCapture = true;

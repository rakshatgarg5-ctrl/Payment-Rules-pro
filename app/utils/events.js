/**
 * Safely read the current value from an event fired by a Polaris web component
 * (e.g. <s-text-field>, <s-select>, <s-number-field>, <s-search-field>). These
 * custom elements use Shadow DOM, so React's synthetic `event.currentTarget` can
 * be null inside the handler. Falling back to `event.target` avoids "Cannot read
 * properties of null (reading 'value')".
 */
export function readEventValue(event) {
  return event?.currentTarget?.value ?? event?.target?.value ?? "";
}

/**
 * Safely read `checked` from a Polaris <s-checkbox> event.
 * See `readEventValue` for context.
 */
export function readEventChecked(event) {
  return event?.currentTarget?.checked ?? event?.target?.checked ?? false;
}
import { useMemo, useState } from "react";
import { readEventValue } from "../utils/events.js";

/**
 * @param {{
 *   selected: string[],
 *   options: string[],
 *   onChange: (selected: string[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export function PaymentMethodPicker({
  selected,
  options,
  onChange,
  disabled = false,
}) {
  const [customName, setCustomName] = useState("");

  const optionSet = useMemo(() => new Set(options), [options]);
  const customSelected = selected.filter((name) => !optionSet.has(name));

  const toggle = (name) => {
    const key = name.toLowerCase();
    const isSelected = selected.some((item) => item.toLowerCase() === key);
    if (isSelected) {
      onChange(selected.filter((item) => item.toLowerCase() !== key));
      return;
    }
    onChange([...selected, name]);
  };

  const addCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (!selected.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...selected, trimmed]);
    }
    setCustomName("");
  };

  const removeCustom = (name) => {
    onChange(selected.filter((item) => item !== name));
  };

  return (
    <s-stack direction="block" gap="base">
      <s-paragraph>
        Select payment methods to hide at checkout. Names must match how they
        appear to customers. Matching is case-insensitive and partial.
      </s-paragraph>

      {options.length > 0 && (
        <s-stack direction="block" gap="small">
          <s-text type="strong">Known payment methods</s-text>
          {options.map((name) => (
            <s-checkbox
              key={name}
              label={name}
              checked={selected.some(
                (item) => item.toLowerCase() === name.toLowerCase(),
              )}
              disabled={disabled}
              onChange={() => toggle(name)}
            />
          ))}
        </s-stack>
      )}

      {customSelected.length > 0 && (
        <s-stack direction="block" gap="small">
          <s-text type="strong">Custom selections</s-text>
          {customSelected.map((name) => (
            <s-stack key={name} direction="inline" gap="base" alignItems="center">
              <s-text>{name}</s-text>
              <s-button
                tone="critical"
                variant="tertiary"
                disabled={disabled}
                onClick={() => removeCustom(name)}
              >
                Remove
              </s-button>
            </s-stack>
          ))}
        </s-stack>
      )}

      <s-stack direction="inline" gap="base" alignItems="end">
        <s-text-field
          label="Add custom payment method"
          value={customName}
          disabled={disabled}
          placeholder="Example: Cash on Delivery"
          autocomplete="off"
          onInput={(e) => setCustomName(readEventValue(e))}
        />
        <s-button disabled={disabled || !customName.trim()} onClick={addCustom}>
          Add
        </s-button>
      </s-stack>
    </s-stack>
  );
}

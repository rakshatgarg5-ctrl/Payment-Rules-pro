import { readEventValue } from "../utils/events.js";
import { PaymentMethodNameCombobox } from "./PaymentMethodNameCombobox.jsx";

export const RENAME_OPERATION_REPLACE = "replace";

/**
 * @param {{ name?: string, operation?: string, newName?: string }[]} renames
 */
function normalizeRows(renames) {
  if (Array.isArray(renames) && renames.length > 0) return renames;
  return [{ name: "", operation: RENAME_OPERATION_REPLACE, newName: "" }];
}

/**
 * @param {{ name?: string, operation?: string, newName?: string }} row
 */
function normalizeRow(row) {
  return {
    name: row?.name ?? "",
    operation: row?.operation || RENAME_OPERATION_REPLACE,
    newName: row?.newName ?? "",
  };
}

/**
 * Rename rows: current payment name, replace action, and the checkout name.
 *
 * @param {{
 *   renames: { name?: string, operation?: string, newName?: string }[],
 *   options: string[],
 *   onChange: (renames: { name: string, operation: string, newName: string }[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export function PaymentMethodRenameEditor({
  renames,
  options,
  onChange,
  disabled = false,
}) {
  const rows = normalizeRows(renames);

  const updateRow = (index, patch) => {
    onChange(
      rows.map((row, i) =>
        i === index ? { ...normalizeRow(row), ...patch } : normalizeRow(row),
      ),
    );
  };

  const removeRow = (index) => {
    const next = rows.filter((_, i) => i !== index).map(normalizeRow);
    onChange(
      next.length > 0
        ? next
        : [{ name: "", operation: RENAME_OPERATION_REPLACE, newName: "" }],
    );
  };

  const addRow = () => {
    onChange([
      ...rows.map(normalizeRow),
      { name: "", operation: RENAME_OPERATION_REPLACE, newName: "" },
    ]);
  };

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="block" gap="base">
        {rows.map((row, index) => (
          <s-stack key={index} direction="block" gap="small">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <PaymentMethodNameCombobox
                  value={row.name ?? ""}
                  options={options}
                  disabled={disabled}
                  placeholder="Select or manually enter a payment name"
                  onChange={(name) => updateRow(index, { name })}
                />
              </div>
              <s-clickable
                disabled={disabled}
                accessibilityLabel="Remove payment method"
                onClick={() => removeRow(index)}
              >
                <s-icon type="x-circle" />
              </s-clickable>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                paddingRight: "1.75rem",
              }}
            >
              <div style={{ width: "11rem", flexShrink: 0 }}>
                <s-select
                  label="Rename action"
                  labelAccessibilityVisibility="exclusive"
                  value={row.operation || RENAME_OPERATION_REPLACE}
                  disabled={disabled}
                  onChange={(e) =>
                    updateRow(index, { operation: readEventValue(e) })
                  }
                >
                  <s-option value={RENAME_OPERATION_REPLACE}>Replace</s-option>
                </s-select>
              </div>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <s-text-field
                  label="New payment name"
                  labelAccessibilityVisibility="exclusive"
                  value={row.newName ?? ""}
                  placeholder="New payment name"
                  disabled={disabled}
                  autocomplete="off"
                  onInput={(e) =>
                    updateRow(index, { newName: readEventValue(e) })
                  }
                />
              </div>
            </div>
          </s-stack>
        ))}
      </s-stack>

      <s-button disabled={disabled} onClick={addRow}>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type="plus" />
          <span>Add a payment method</span>
        </s-stack>
      </s-button>
    </s-stack>
  );
}

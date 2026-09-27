import { readEventValue } from "../utils/events.js";
import { PaymentMethodNameCombobox } from "./PaymentMethodNameCombobox.jsx";

/**
 * @param {{ name?: string, position?: string | number }[]} order
 */
function normalizeRows(order) {
  if (Array.isArray(order) && order.length > 0) return order;
  return [{ name: "", position: 1 }];
}

/**
 * Ordered payment method rows: position + name + remove, matching the sort UI.
 *
 * @param {{
 *   order: { name?: string, position?: string | number }[],
 *   options: string[],
 *   onChange: (order: { name: string, position: string | number }[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export function PaymentMethodSortEditor({
  order,
  options,
  onChange,
  disabled = false,
}) {
  const rows = normalizeRows(order);

  const updateRow = (index, patch) => {
    const next = rows.map((row, i) =>
      i === index
        ? {
            name: row.name ?? "",
            position: row.position ?? "",
            ...patch,
          }
        : {
            name: row.name ?? "",
            position: row.position ?? "",
          },
    );
    onChange(next);
  };

  const removeRow = (index) => {
    const next = rows
      .filter((_, i) => i !== index)
      .map((row) => ({
        name: row.name ?? "",
        position: row.position ?? "",
      }));
    onChange(next.length > 0 ? next : [{ name: "", position: 1 }]);
  };

  const addRow = () => {
    const maxPos = rows.reduce((max, row) => {
      const n = Number(row.position);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    onChange([
      ...rows.map((row) => ({
        name: row.name ?? "",
        position: row.position ?? "",
      })),
      { name: "", position: maxPos > 0 ? maxPos + 1 : 1 },
    ]);
  };

  return (
    <s-stack direction="block" gap="base">
      <s-text color="subdued">
        Lower numbers appear first (Position 1 appears first then 2, 3 and so on)
      </s-text>

      <s-stack direction="block" gap="small">
        {rows.map((row, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ width: "9rem", flexShrink: 0 }}>
              <s-text-field
                label="Position"
                labelAccessibilityVisibility="exclusive"
                value={row.position == null ? "" : String(row.position)}
                placeholder="Position (e.g. 5)"
                disabled={disabled}
                autocomplete="off"
                onInput={(e) =>
                  updateRow(index, { position: readEventValue(e) })
                }
              />
            </div>
            <div style={{ flex: "1 1 14rem", minWidth: "12rem" }}>
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

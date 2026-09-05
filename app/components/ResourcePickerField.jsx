import { useAppBridge } from "@shopify/app-bridge-react";
import { RemovableChip } from "./RemovableChip.jsx";

/**
 * @param {{
 *   type: "product" | "collection",
 *   label: string,
 *   selections: { id: string, title: string }[],
 *   onChange: (selections: { id: string, title: string }[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export function ResourcePickerField({
  type,
  label,
  selections,
  onChange,
  disabled = false,
}) {
  const shopify = useAppBridge();
  const isCollection = type === "collection";
  const placeholder = isCollection ? "Select collection" : "Select product";

  const openPicker = async () => {
    if (disabled) return;

    const result = await shopify.resourcePicker({
      type,
      multiple: true,
      selectionIds: selections.map((item) => ({ id: item.id })),
    });

    const selected = Array.isArray(result) ? result : result?.selection;
    if (!selected) return;

    onChange(
      selected.map((item) => ({
        id: item.id,
        title: item.title || item.id,
      })),
    );
  };

  const removeSelection = (id) => {
    onChange(selections.filter((item) => item.id !== id));
  };

  return (
    <s-stack direction="block" gap="base">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? "true" : "false"}
        aria-label={label}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void openPicker();
          }
        }}
        style={{
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <s-box
          padding="small"
          borderWidth="base"
          borderRadius="base"
          borderColor="subdued"
          background="base"
        >
          <s-text color="subdued">{placeholder}</s-text>
        </s-box>
      </div>

      {selections.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {selections.map((item) => (
            <RemovableChip
              key={item.id}
              label={item.title}
              onRemove={() => {
                if (!disabled) removeSelection(item.id);
              }}
            />
          ))}
        </div>
      )}
    </s-stack>
  );
}

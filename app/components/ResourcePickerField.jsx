import { useAppBridge } from "@shopify/app-bridge-react";

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

  const openPicker = async () => {
    const result = await shopify.resourcePicker({
      type,
      multiple: true,
      selectionIds: selections.map((item) => ({ id: item.id })),
    });

    const selected = Array.isArray(result) ? result : result?.selection;
    if (!selected?.length) return;

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
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-text type="strong">{label}</s-text>
        <s-button disabled={disabled} onClick={openPicker}>
          Browse {type === "product" ? "products" : "collections"}
        </s-button>
      </s-stack>

      {selections.length === 0 ? (
        <s-paragraph>No {type === "product" ? "products" : "collections"} selected.</s-paragraph>
      ) : (
        <s-stack direction="block" gap="small">
          {selections.map((item) => (
            <s-stack key={item.id} direction="inline" gap="base" alignItems="center">
              <s-text>{item.title}</s-text>
              <s-button
                tone="critical"
                variant="tertiary"
                disabled={disabled}
                onClick={() => removeSelection(item.id)}
              >
                Remove
              </s-button>
            </s-stack>
          ))}
        </s-stack>
      )}
    </s-stack>
  );
}

import { useEffect, useRef } from "react";

/**
 * A removable tag/chip with an "x" control for clearing a selection.
 *
 * @param {{
 *   label: string,
 *   onRemove: () => void,
 * }} props
 */
export function RemovableChip({ label, onRemove }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const handleRemove = () => onRemove();
    element.addEventListener("remove", handleRemove);
    return () => element.removeEventListener("remove", handleRemove);
  }, [onRemove]);

  return (
    <s-clickable-chip
      ref={ref}
      removable
      accessibilityLabel={label}
      onRemove={() => onRemove()}
    >
      {label}
    </s-clickable-chip>
  );
}

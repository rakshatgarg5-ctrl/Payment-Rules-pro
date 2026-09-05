import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { RemovableChip } from "./RemovableChip.jsx";
import { COUNTRIES, countryName } from "../utils/countries.js";
import { readEventValue } from "../utils/events.js";

const PANEL_MAX_HEIGHT = 280;
const PANEL_GAP = 4;

/**
 * @param {HTMLElement | null} container
 * @param {EventTarget | null} target
 */
function containerIncludesTarget(container, target) {
  if (!container || !target) return false;
  if (target instanceof Node && container.contains(target)) return true;

  if (target instanceof Element) {
    const root = target.getRootNode();
    if (root instanceof ShadowRoot && root.host instanceof Node) {
      return container.contains(root.host);
    }
  }

  return false;
}

/**
 * @param {DOMRect} anchorRect
 * @param {number} panelHeight
 */
function resolvePlacement(anchorRect, panelHeight) {
  const spaceAbove = anchorRect.top;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const needed = Math.min(panelHeight, PANEL_MAX_HEIGHT) + PANEL_GAP;

  if (spaceAbove >= needed) return "top";
  if (spaceBelow >= needed) return "bottom";
  return spaceBelow >= spaceAbove ? "bottom" : "top";
}

/**
 * Searchable multi-select country picker matching the payment method search UI.
 * Stores uppercase ISO 3166-1 alpha-2 codes. Does not allow adding custom values.
 *
 * @param {{
 *   selected: string[],
 *   onChange: (codes: string[]) => void,
 *   disabled?: boolean,
 * }} props
 */
function CountryPicker({ selected, onChange, disabled = false }) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [placement, setPlacement] = useState("top");

  const containerRef = useRef(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const searchFieldRef = useRef(null);

  const selectedSet = useMemo(
    () => new Set(selected.map((code) => String(code).toUpperCase())),
    [selected],
  );

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(q) ||
        country.code.toLowerCase().includes(q),
    );
  }, [trimmedQuery]);

  const toggle = (code) => {
    const upper = String(code).toUpperCase();
    if (selectedSet.has(upper)) {
      onChange(selected.filter((item) => String(item).toUpperCase() !== upper));
      return;
    }
    onChange([...selected, upper]);
  };

  const remove = (code) => {
    const upper = String(code).toUpperCase();
    onChange(selected.filter((item) => String(item).toUpperCase() !== upper));
  };

  const updatePanelPosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const panelHeight = panel?.offsetHeight || PANEL_MAX_HEIGHT;
    const nextPlacement = resolvePlacement(rect, panelHeight);

    setPlacement(nextPlacement);
    setPanelStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 1000,
      ...(nextPlacement === "top"
        ? { bottom: window.innerHeight - rect.top + PANEL_GAP }
        : { top: rect.bottom + PANEL_GAP }),
    });
  }, []);

  useEffect(() => {
    const element = searchFieldRef.current;
    if (!element || disabled) return undefined;

    const openPicker = () => setOpen(true);
    element.addEventListener("focus", openPicker);
    element.addEventListener("click", openPicker);
    return () => {
      element.removeEventListener("focus", openPicker);
      element.removeEventListener("click", openPicker);
    };
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }

    updatePanelPosition();

    const handleLayoutChange = () => updatePanelPosition();
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [open, filtered.length, updatePanelPosition]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (containerIncludesTarget(containerRef.current, target)) return;
      if (containerIncludesTarget(panelRef.current, target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = filtered.find((country) => !selectedSet.has(country.code));
    if (next) toggle(next.code);
  };

  const panelContent = (
    <s-box
      padding="small"
      borderWidth="base"
      borderRadius="base"
      borderColor="subdued"
      background="base"
    >
      <s-stack direction="block" gap="small">
        <s-text type="strong">Suggested countries</s-text>

        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          style={{ maxHeight: PANEL_MAX_HEIGHT - 48, overflowY: "auto" }}
        >
          {filtered.length === 0 ? (
            <s-paragraph>
              No countries match &ldquo;{query}&rdquo;.
            </s-paragraph>
          ) : (
            <s-stack direction="block" gap="none">
              {filtered.map((country) => (
                <s-checkbox
                  key={country.code}
                  label={`${country.name} (${country.code})`}
                  checked={selectedSet.has(country.code)}
                  disabled={disabled}
                  onChange={() => toggle(country.code)}
                />
              ))}
            </s-stack>
          )}
        </div>
      </s-stack>
    </s-box>
  );

  return (
    <s-stack direction="block" gap="base">
      <div ref={containerRef}>
        <div ref={anchorRef}>
          <s-box
            padding="small"
            borderWidth="base"
            borderRadius="base"
            borderColor="subdued"
            background="base"
          >
            <s-search-field
              ref={searchFieldRef}
              label="Countries"
              labelAccessibilityVisibility="exclusive"
              value={query}
              disabled={disabled}
              placeholder="Search countries by name or code"
              autocomplete="off"
              aria-expanded={open ? "true" : "false"}
              aria-controls={open ? listboxId : undefined}
              onInput={(e) => {
                setQuery(readEventValue(e));
                setOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </s-box>
        </div>
      </div>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {selected.map((code) => (
            <RemovableChip
              key={code}
              label={countryName(code) || code}
              onRemove={() => remove(code)}
            />
          ))}
        </div>
      )}

      {open &&
        !disabled &&
        panelStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              ...panelStyle,
              borderRadius: "0.5rem",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            }}
            data-placement={placement}
          >
            {panelContent}
          </div>,
          document.body,
        )}
    </s-stack>
  );
}

/**
 * Country condition fields: operator select plus searchable multi-select picker.
 *
 * @param {{
 *   item: { operator?: string, values?: string[] },
 *   index: number,
 *   updateCondition: (index: number, patch: object) => void,
 *   disabled?: boolean,
 * }} props
 */
export function CountryConditionFields({
  item,
  index,
  updateCondition,
  disabled = false,
}) {
  const selected = (item.values || []).map((value) =>
    String(value).toUpperCase(),
  );

  return (
    <>
      <s-select
        label="Operator"
        value={item.operator || "in"}
        disabled={disabled}
        onChange={(e) =>
          updateCondition(index, { operator: readEventValue(e) })
        }
      >
        <s-option value="in">Is one of</s-option>
        <s-option value="not_in">Is not one of</s-option>
      </s-select>

      <CountryPicker
        selected={selected}
        disabled={disabled}
        onChange={(values) => updateCondition(index, { values })}
      />
    </>
  );
}

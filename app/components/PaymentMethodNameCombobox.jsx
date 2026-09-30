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
import { readEventValue } from "../utils/events.js";
import { comparePaymentMethodNames } from "../utils/payment-method-options.js";

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
 * @param {string} name
 */
function normalizeKey(name) {
  return name.trim().toLowerCase();
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
 * Searchable single-select payment method field with a dropdown panel.
 *
 * @param {{
 *   value: string,
 *   options: string[],
 *   onChange: (name: string) => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 * }} props
 */
export function PaymentMethodNameCombobox({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Select or manually enter a payment name",
}) {
  const listboxId = useId();
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [placement, setPlacement] = useState("top");

  const containerRef = useRef(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const searchFieldRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const allOptions = useMemo(() => {
    const names = new Set(options);
    return [...names].sort(comparePaymentMethodNames);
  }, [options]);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    const key = normalizeKey(trimmedQuery);
    if (!key) return allOptions;
    return allOptions.filter((name) => normalizeKey(name).includes(key));
  }, [allOptions, trimmedQuery]);

  const canAddCustom = useMemo(() => {
    if (!trimmedQuery) return false;
    const key = normalizeKey(trimmedQuery);
    return !allOptions.some((name) => normalizeKey(name) === key);
  }, [allOptions, trimmedQuery]);

  const selectName = (name) => {
    const trimmed = name.trim();
    onChange(trimmed);
    setQuery(trimmed);
    setOpen(false);
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
  }, [open, filtered.length, canAddCustom, updatePanelPosition]);

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
    if (canAddCustom) {
      selectName(trimmedQuery);
      return;
    }
    if (filtered[0]) selectName(filtered[0]);
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
        <s-text type="strong">Suggested payment methods</s-text>

        <div
          id={listboxId}
          role="listbox"
          style={{ maxHeight: PANEL_MAX_HEIGHT - 48, overflowY: "auto" }}
        >
          {canAddCustom && (
            <s-clickable
              disabled={disabled}
              onClick={() => selectName(trimmedQuery)}
            >
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-icon type="plus-circle" />
                <s-text>Add &ldquo;{trimmedQuery}&rdquo;</s-text>
              </s-stack>
            </s-clickable>
          )}

          {filtered.length === 0 && !canAddCustom ? (
            <s-paragraph>
              No payment methods match &ldquo;{query}&rdquo;.
            </s-paragraph>
          ) : (
            <s-stack direction="block" gap="none">
              {filtered.map((name) => (
                <s-clickable
                  key={name}
                  disabled={disabled}
                  onClick={() => selectName(name)}
                >
                  <s-box padding="small">
                    <s-text>{name}</s-text>
                  </s-box>
                </s-clickable>
              ))}
            </s-stack>
          )}
        </div>
      </s-stack>
    </s-box>
  );

  return (
    <>
      <div ref={containerRef} style={{ width: "100%" }}>
        <div ref={anchorRef} style={{ width: "100%" }}>
          <s-box
            padding="small"
            borderWidth="base"
            borderRadius="base"
            borderColor="subdued"
            background="base"
          >
            <s-search-field
              ref={searchFieldRef}
              label="Payment method"
              labelAccessibilityVisibility="exclusive"
              value={query}
              disabled={disabled}
              placeholder={placeholder}
              autocomplete="off"
              aria-expanded={open ? "true" : "false"}
              aria-controls={open ? listboxId : undefined}
              onInput={(e) => {
                const next = readEventValue(e);
                setQuery(next);
                onChange(next);
                setOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </s-box>
        </div>
      </div>

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
    </>
  );
}

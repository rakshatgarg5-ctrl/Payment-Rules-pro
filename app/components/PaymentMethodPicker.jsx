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
import { readEventValue } from "../utils/events.js";

const PANEL_MAX_HEIGHT = 280;
const PANEL_GAP = 4;

export const MATCH_MODE_CONTAINS = "contains";
export const MATCH_MODE_EXACT = "exact";

export const ACTION_MODE_HIDE = "hide";
export const ACTION_MODE_SHOW = "show";
export const ACTION_MODE_HIDE_ALL = "hide_all";

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
 * @param {string[]} selected
 * @param {string} name
 */
function isSelected(selected, name) {
  return selected.some((item) => normalizeKey(item) === normalizeKey(name));
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
 * @param {{
 *   selected: string[],
 *   options: string[],
 *   onChange: (selected: string[]) => void,
 *   matchMode?: string,
 *   onMatchModeChange?: (mode: string) => void,
 *   actionMode?: string,
 *   onActionModeChange?: (mode: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export function PaymentMethodPicker({
  selected,
  options,
  onChange,
  matchMode = MATCH_MODE_CONTAINS,
  onMatchModeChange,
  actionMode = ACTION_MODE_HIDE,
  onActionModeChange,
  disabled = false,
}) {
  const listboxId = useId();
  const matchGroupId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [placement, setPlacement] = useState("top");

  const containerRef = useRef(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const searchFieldRef = useRef(null);

  const hidePicker = actionMode === ACTION_MODE_HIDE_ALL;

  const allOptions = useMemo(() => {
    const names = new Set(options);
    for (const name of selected) {
      names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [options, selected]);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    const key = normalizeKey(trimmedQuery);
    if (!key) return allOptions;
    return allOptions.filter((name) => normalizeKey(name).includes(key));
  }, [allOptions, trimmedQuery]);

  const canAddCustom = useMemo(() => {
    if (!trimmedQuery) return false;
    const key = normalizeKey(trimmedQuery);
    const exists = allOptions.some((name) => normalizeKey(name) === key);
    return !exists && !isSelected(selected, trimmedQuery);
  }, [allOptions, trimmedQuery, selected]);

  const toggle = (name) => {
    if (isSelected(selected, name)) {
      onChange(selected.filter((item) => item !== name));
      return;
    }
    onChange([...selected, name]);
  };

  const addCustom = (name) => {
    const trimmed = name.trim();
    if (!trimmed || isSelected(selected, trimmed)) return;
    onChange([...selected, trimmed]);
    setQuery("");
  };

  const remove = (name) => {
    onChange(selected.filter((item) => item !== name));
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
    if (hidePicker) setOpen(false);
  }, [hidePicker]);

  useEffect(() => {
    const element = searchFieldRef.current;
    if (!element || disabled || hidePicker) return undefined;

    const openPicker = () => setOpen(true);
    element.addEventListener("focus", openPicker);
    element.addEventListener("click", openPicker);
    return () => {
      element.removeEventListener("focus", openPicker);
      element.removeEventListener("click", openPicker);
    };
  }, [disabled, hidePicker]);

  useLayoutEffect(() => {
    if (!open || hidePicker) {
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
  }, [open, hidePicker, filtered.length, canAddCustom, updatePanelPosition]);

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
      addCustom(trimmedQuery);
      return;
    }
    const next = filtered.find((name) => !isSelected(selected, name));
    if (next) toggle(next);
  };

  const helpText =
    actionMode === ACTION_MODE_SHOW
      ? "Search payment methods to keep visible at checkout. All other methods will be hidden."
      : actionMode === ACTION_MODE_HIDE_ALL
        ? "All payment methods will be hidden at checkout when this rule matches."
        : "Search payment methods to hide at checkout. Pick from the list or add a custom name.";

  const searchLabel =
    actionMode === ACTION_MODE_SHOW
      ? "Payment methods to show"
      : "Payment methods to hide";

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
          aria-multiselectable="true"
          style={{ maxHeight: PANEL_MAX_HEIGHT - 48, overflowY: "auto" }}
        >
          {canAddCustom && (
            <s-clickable
              disabled={disabled}
              onClick={() => addCustom(trimmedQuery)}
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
                <s-checkbox
                  key={name}
                  label={name}
                  checked={isSelected(selected, name)}
                  disabled={disabled}
                  onChange={() => toggle(name)}
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
      <s-stack direction="block" gap="small">
        <s-text type="strong">Payment method</s-text>
        <s-stack direction="inline" gap="large">
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <input
              type="radio"
              name={matchGroupId}
              value={MATCH_MODE_CONTAINS}
              checked={matchMode !== MATCH_MODE_EXACT}
              disabled={disabled}
              onChange={() => onMatchModeChange?.(MATCH_MODE_CONTAINS)}
            />
            <s-text>Contains</s-text>
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <input
              type="radio"
              name={matchGroupId}
              value={MATCH_MODE_EXACT}
              checked={matchMode === MATCH_MODE_EXACT}
              disabled={disabled}
              onChange={() => onMatchModeChange?.(MATCH_MODE_EXACT)}
            />
            <s-text>Exact</s-text>
          </label>
        </s-stack>
      </s-stack>

      <s-select
        label="Action"
        labelAccessibilityVisibility="exclusive"
        value={
          actionMode === ACTION_MODE_SHOW ||
          actionMode === ACTION_MODE_HIDE_ALL
            ? actionMode
            : ACTION_MODE_HIDE
        }
        disabled={disabled}
        onChange={(e) => onActionModeChange?.(readEventValue(e))}
      >
        <s-option value={ACTION_MODE_HIDE}>Hide these Payment methods</s-option>
        <s-option value={ACTION_MODE_SHOW}>Show these Payment methods</s-option>
        <s-option value={ACTION_MODE_HIDE_ALL}>Hide all Payment methods</s-option>
      </s-select>

      <s-paragraph>{helpText}</s-paragraph>

      {!hidePicker && (
        <>
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
                  label={searchLabel}
                  labelAccessibilityVisibility="exclusive"
                  value={query}
                  disabled={disabled}
                  placeholder="Search or enter payment method to add"
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
              {selected.map((name) => (
                <RemovableChip
                  key={name}
                  label={name}
                  onRemove={() => remove(name)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {open &&
        !disabled &&
        !hidePicker &&
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

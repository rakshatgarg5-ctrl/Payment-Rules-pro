import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryName } from "../utils/countries.js";
import { readEventValue } from "../utils/events.js";

/**
 * A Polaris <s-chip> with a remove ("x") action. The web component dispatches a
 * native "remove" CustomEvent, so we subscribe with a ref listener (React does
 * not attach handlers to custom event names).
 */
function RemovableChip({ code, onRemove }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const handleRemove = () => onRemove(code);
    element.addEventListener("remove", handleRemove);
    return () => element.removeEventListener("remove", handleRemove);
  }, [code, onRemove]);

  return (
    <s-chip ref={ref} removable>
      {countryName(code) || code}
    </s-chip>
  );
}

/**
 * Searchable multi-select country picker.
 * Stores uppercase ISO 3166-1 alpha-2 codes, e.g. ["US", "CA"].
 *
 * @param {{
 *   selected: string[],
 *   onChange: (codes: string[]) => void,
 *   disabled?: boolean,
 * }} props
 */
function CountryPicker({ selected, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(q) ||
        country.code.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (code) => {
    const next = selected.includes(code)
      ? selected.filter((item) => item !== code)
      : [...selected, code];
    onChange(next);
  };

  return (
    <s-stack direction="block" gap="small">
      <s-button
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {selected.length === 0
          ? "Select countries"
          : `${selected.length} ${selected.length === 1 ? "country" : "countries"} selected`}
      </s-button>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {selected.map((code) => (
            <RemovableChip key={code} code={code} onRemove={toggle} />
          ))}
        </div>
      )}

      {open && (
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          borderColor="subdued"
          background="base"
        >
          <s-stack direction="block" gap="base">
            <s-search-field
              label="Search countries"
              value={query}
              placeholder="Search by name or code (e.g. France, FR)"
              onInput={(e) => setQuery(readEventValue(e))}
            />

            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <s-paragraph>No countries match “{query}”.</s-paragraph>
              ) : (
                <s-stack direction="block" gap="none">
                  {filtered.map((country) => (
                    <s-checkbox
                      key={country.code}
                      label={`${country.name} (${country.code})`}
                      checked={selected.includes(country.code)}
                      disabled={disabled}
                      onChange={() => toggle(country.code)}
                    />
                  ))}
                </s-stack>
              )}
            </div>

            <s-stack direction="inline" gap="base" alignItems="center">
              <s-button variant="primary" onClick={() => setOpen(false)}>
                Done
              </s-button>
              {selected.length > 0 && (
                <s-button
                  variant="tertiary"
                  tone="critical"
                  onClick={() => onChange([])}
                >
                  Clear all
                </s-button>
              )}
            </s-stack>
          </s-stack>
        </s-box>
      )}
    </s-stack>
  );
}

/**
 * "Country" condition fields: operator select plus the searchable multi-select
 * country picker.
 *
 * @param {{
 *   item: { operator?: string, values?: string[] },
 *   index: number,
 *   updateCondition: (index: number, patch: object) => void,
 * }} props
 */
export function CountryConditionFields({ item, index, updateCondition }) {
  const selected = (item.values || []).map((value) =>
    String(value).toUpperCase(),
  );

  return (
    <>
      <s-select
        label="Operator"
        value={item.operator || "in"}
        onChange={(e) =>
          updateCondition(index, { operator: readEventValue(e) })
        }
      >
        <s-option value="in">Is one of</s-option>
        <s-option value="not_in">Is not one of</s-option>
      </s-select>

      <CountryPicker
        selected={selected}
        onChange={(values) => updateCondition(index, { values })}
      />
    </>
  );
}
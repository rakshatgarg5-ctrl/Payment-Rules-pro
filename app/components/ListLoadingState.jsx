/**
 * @param {{ message?: string }} props
 */
export function ListLoadingState({ message = "Loading…" }) {
  return (
    <s-box padding="large" background="subdued" borderRadius="base">
      <s-stack gap="base" alignItems="center">
        <s-spinner accessibilityLabel={message} />
        <s-text tone="subdued">{message}</s-text>
      </s-stack>
    </s-box>
  );
}

export default function ExperimentalBanner() {
  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 16,
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,165,0,0.06)",
        fontSize: 13,
      }}
    >
      <b>v1 / Experimental:</b>{" "}
      usdc.bot is early infrastructure. Use small amounts and verify on-chain
      before relying on it.
    </div>
  );
}

const COORD = process.env.NEXT_PUBLIC_COORDINATOR as string;

export default function Footer() {
  return (
    <div
      style={{
        padding: 16,
        borderTop: "1px solid rgba(0,0,0,0.1)",
        marginTop: 32,
        fontSize: 12,
        opacity: 0.75,
      }}
    >
      <div>
        Current network: <b>Base Mainnet</b> • v1 / Experimental
      </div>

      <div style={{ marginTop: 6 }}>
        <a
          href={`https://basescan.org/address/${COORD}#code`}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Verified on Basescan
        </a>
      </div>
    </div>
  );
}

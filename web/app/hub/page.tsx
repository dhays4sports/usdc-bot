// web/app/hub/page.tsx
import Header from "@/components/Header";
import SmartCommand from "@/components/SmartCommand";

export default function HubHome() {
  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">HUB</div>
            <p style={{ marginTop: 10, opacity: 0.75 }}>
              One command → preview → route to the right surface.
            </p>

            <div style={{ marginTop: 14 }}>
              <SmartCommand />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

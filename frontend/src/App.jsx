import { useState } from "react";
import LoginPage from "./components/LoginPage";
import DashboardShell from "./components/DashboardShell";

function App() {
  const [screen, setScreen] = useState("login"); // "login" | "citizen" | "officer"

  const handleCitizenLogin = (data) => {
    console.log("Citizen login submitted:", data);
    setScreen("citizen");
  };

  const handleOfficerLogin = (data) => {
    console.log("Officer login submitted:", data);
    // Simple demo check for now — replace with real auth later
    setScreen("officer");
  };

  if (screen === "citizen") return <DashboardShell role="citizen" />;
  if (screen === "officer") return <DashboardShell role="officer" />;

  return (
    <LoginPage onCitizenLogin={handleCitizenLogin} onOfficerLogin={handleOfficerLogin} />
  );
}

export default App;
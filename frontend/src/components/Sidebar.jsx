import { Home, TrendingUp, FileText, HeartPulse, Satellite, Bell, Trophy, Settings } from "lucide-react";

const citizenMenu = [
  { label: "Home", icon: Home },
  { label: "Predictive Analysis", icon: TrendingUp },
  { label: "My Reports", icon: FileText },
  { label: "Health Advisory", icon: HeartPulse },
  { label: "Why Is My Area Polluted", icon: Satellite },
  { label: "Alerts & Subscriptions", icon: Bell },
  { label: "Community Impact", icon: Trophy },
  { label: "Settings", icon: Settings },
];

const officerMenu = [
  { label: "Home", icon: Home },
  { label: "Predictive Analysis", icon: TrendingUp },
  { label: "Source Attribution", icon: Satellite },
  { label: "Settings", icon: Settings },
];

function Sidebar({ role, activePage, setActivePage }) {
  const menu = role === "officer" ? officerMenu : citizenMenu;

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col py-6 px-4">
      <h1 className="text-2xl font-bold text-teal-800 mb-1 px-2">VAYU</h1>
      <p className="text-xs text-gray-400 px-2 mb-8">Clean Air, Enforced.</p>
      <nav className="flex-1 space-y-1">
        {menu.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActivePage(label)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activePage === label
                ? "bg-teal-50 text-teal-800"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
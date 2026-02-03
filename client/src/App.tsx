import { NavLink, Route, Routes } from "react-router-dom";
import GlobalTypes from "./routes/GlobalTypes";
import GlobalSpecies from "./routes/GlobalSpecies";
import GlobalAbilities from "./routes/GlobalAbilities";
import GlobalItems from "./routes/GlobalItems";
import Games from "./routes/Games";
import GameSetup from "./routes/GameSetup";
import GameDex from "./routes/GameDex";
import GameBox from "./routes/GameBox";
import GameTeam from "./routes/GameTeam";

const navItems = [
  { to: "/global/types", label: "Types & Chart" },
  { to: "/global/species", label: "Species" },
  { to: "/global/abilities", label: "Abilities" },
  { to: "/global/items", label: "Items" },
  { to: "/games", label: "Games" }
];

export default function App() {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="bg-ink text-white p-6 flex flex-col gap-6">
        <div>
          <div className="text-2xl font-semibold font-display">TeamForge</div>
          <div className="text-xs text-slate-300 uppercase tracking-[0.25em] mt-2">Local Dex Lab</div>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? "bg-white text-ink" : "text-slate-200 hover:bg-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto text-xs text-slate-400">
          Built for fast filtering and local-first team scoring.
        </div>
      </aside>
      <main className="p-8">
        <Routes>
          <Route path="/global/types" element={<GlobalTypes />} />
          <Route path="/global/species" element={<GlobalSpecies />} />
          <Route path="/global/abilities" element={<GlobalAbilities />} />
          <Route path="/global/items" element={<GlobalItems />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:id/setup" element={<GameSetup />} />
          <Route path="/games/:id/dex" element={<GameDex />} />
          <Route path="/games/:id/box" element={<GameBox />} />
          <Route path="/games/:id/team" element={<GameTeam />} />
          <Route path="*" element={<GlobalTypes />} />
        </Routes>
      </main>
    </div>
  );
}
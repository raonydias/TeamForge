import { NavLink, Route, Routes } from "react-router-dom";
import Packs from "./routes/Packs";
import PackTypes from "./routes/PackTypes";
import PackSpecies from "./routes/PackSpecies";
import PackAbilities from "./routes/PackAbilities";
import PackItems from "./routes/PackItems";
import Games from "./routes/Games";
import GameSetup from "./routes/GameSetup";
import GameDex from "./routes/GameDex";
import GameBox from "./routes/GameBox";
import GameTeam from "./routes/GameTeam";

const navItems = [
  { to: "/packs", label: "Packs" },
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
        <div className="mt-auto text-xs text-slate-400">Built for fast filtering and local-first team scoring.</div>
      </aside>
      <main className="p-8">
        <Routes>
          <Route path="/packs" element={<Packs />} />
          <Route path="/packs/:id/types" element={<PackTypes />} />
          <Route path="/packs/:id/species" element={<PackSpecies />} />
          <Route path="/packs/:id/abilities" element={<PackAbilities />} />
          <Route path="/packs/:id/items" element={<PackItems />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:id/setup" element={<GameSetup />} />
          <Route path="/games/:id/dex" element={<GameDex />} />
          <Route path="/games/:id/box" element={<GameBox />} />
          <Route path="/games/:id/team" element={<GameTeam />} />
          <Route path="*" element={<Packs />} />
        </Routes>
      </main>
    </div>
  );
}
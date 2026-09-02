// Import necessary components and functions from react-router-dom.

import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
    Navigate,
} from "react-router-dom";
import { Layout } from "./pages/Layout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import { Games } from "./pages/Games";
import { MyGames } from "./pages/MyGames";
import { Achievements } from "./pages/Achievements";
import { Search } from "./pages/Search";
import { PublicProfile } from "./pages/PublicProfile";
import { PublicGames } from "./pages/PublicGames";
import { PublicAchievements } from "./pages/PublicAchievements";

export const router = createBrowserRouter(
    createRoutesFromElements(
      // Login y Register van sin Navbar/Footer (pantalla split a pantalla completa).
      <>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<Layout />} errorElement={<h1>Not found!</h1>} >
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/games" element={<Games />} />
          <Route path="/profile/my-games" element={<MyGames />} />
          <Route path="/profile/achievements" element={<Achievements />} />

          {/* Perfil público: sin cuenta ni sesión, cualquier SteamID64 o vanity URL */}
          <Route path="/search" element={<Search />} />
          <Route path="/u/:steamId" element={<PublicProfile />} />
          <Route path="/u/:steamId/games" element={<PublicGames />} />
          <Route path="/u/:steamId/achievements" element={<PublicAchievements />} />
        </Route>
      </>
    )
);

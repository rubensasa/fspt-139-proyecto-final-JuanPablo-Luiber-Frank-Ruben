const BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "") + "/api";

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || data.msg || "Error de red");
  }
  return data;
}

export const api = {
  register: (payload) => request("/users", { method: "POST", body: payload }),
  login: (payload) => request("/login", { method: "POST", body: payload }),
  me: (token) => request("/me", { token }),
  searchUsers: (q, token) => request(`/users/search?q=${encodeURIComponent(q || "")}`, { token }),

  // amigos (reales, entre usuarios registrados)
  friends: (token) => request("/friends", { token }),
  friendsOf: (token) => request("/friends-of", { token }),
  addFriend: (friendId, token) => request(`/friends/${friendId}`, { method: "POST", token }),
  removeFriend: (friendId, token) => request(`/friends/${friendId}`, { method: "DELETE", token }),

  // vinculación con Steam (OpenID real)
  steamLoginUrl: (token) => request("/steam/login", { token }),
  steamAccount: (token) => request("/steam/account", { token }),
  unlinkSteam: (token) => request("/steam/account", { method: "DELETE", token }),
  steamProfile: (token) => request("/steam/profile", { token }),

  // juegos reales (sincronizados desde la Steam Web API)
  syncGames: (token) => request("/steam/sync-games", { method: "POST", token }),
  userGames: (userId, token) => request(`/users/${userId}/games`, { token }),

  // logros reales
  achievements: (appid, token) => request(`/achievements/${appid}`, { token }),

  // favoritos
  favorites: (token) => request("/favorites", { token }),
  addFavorite: (appid, token) => request(`/favorites/${appid}`, { method: "POST", token }),
  removeFavorite: (appid, token) => request(`/favorites/${appid}`, { method: "DELETE", token }),
};

import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";

export default function useFavorites(token) {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (!token) {
      setFavorites([]);
      return;
    }
    let cancelled = false;
    api.favorites(token).then((data) => {
      if (!cancelled) setFavorites(data.favorites || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const toggleFavorite = useCallback(async (appid) => {
    if (!token) return;
    const isFav = favorites.includes(appid);
    try {
      if (isFav) await api.removeFavorite(appid, token);
      else await api.addFavorite(appid, token);
      setFavorites((prev) => (isFav ? prev.filter((a) => a !== appid) : [...prev, appid]));
    } catch {
      // no-op: si falla la llamada, dejamos el estado como estaba
    }
  }, [favorites, token]);

  return { favorites, toggleFavorite };
}

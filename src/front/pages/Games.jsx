import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";
import useFavorites from "../hooks/useFavorites";
import { api } from "../services/api";
import { GameCard } from "../components/GameCard";

const FILTERS = [
	{ key: "all", label: "Todos" },
	{ key: "favorites", label: "Favoritos" },
	{ key: "recent", label: "Más jugados" },
];

export const Games = () => {
	const { store } = useGlobalReducer();
	const { favorites, toggleFavorite } = useFavorites(store.token);

	const [userGames, setUserGames] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (!store.user) return;
		setLoading(true);
		api.userGames(store.user.id, store.token).then((data) => {
			setUserGames(data.games || []);
		}).catch((err) => setError(err.message)).finally(() => setLoading(false));
	}, [store.user, store.token]);

	const filteredGames = useMemo(() => {
		let result = userGames;
		if (filter === "favorites") result = result.filter((ug) => favorites.includes(ug.game.appid));
		if (filter === "recent") result = [...result].sort((a, b) => b.playtime_forever - a.playtime_forever);
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			result = result.filter((ug) => ug.game.name.toLowerCase().includes(q));
		}
		return result;
	}, [userGames, filter, favorites, search]);

	if (!store.user) return <Navigate to="/login" replace />;

	return (
		<>
			<header className="sv-overview" style={{ padding: "2.5rem 0" }}>
				<div className="container">
					<p className="sv-label">BIBLIOTECA</p>
					<h2 className="sv-h2">TODOS LOS <span style={{ color: "var(--accent)" }}>JUEGOS</span></h2>
					<p className="sv-hint mt-2">{userGames.length} juegos en tu biblioteca</p>
				</div>
			</header>

			<div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
				<div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
					<div className="sv-filter-group">
						{FILTERS.map((f) => (
							<button key={f.key} className={`sv-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
								{f.label}
							</button>
						))}
					</div>
					<input
						type="text"
						className="form-control form-control-sm"
						style={{ maxWidth: 220, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
						placeholder="Buscar juego..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				{loading && <div className="sv-spinner"></div>}
				{error && <p className="sv-empty"><i className="fa-solid fa-triangle-exclamation"></i>{error}</p>}

				<div className="row g-3">
					{filteredGames.map((ug) => (
						<GameCard key={ug.id} userGame={ug} isFavorite={favorites.includes(ug.game.appid)} onToggleFavorite={toggleFavorite} />
					))}
				</div>
				{!loading && filteredGames.length === 0 && (
					<p className="sv-empty"><i className="fa-solid fa-gamepad"></i>No hay juegos que coincidan.</p>
				)}
			</div>
		</>
	);
};

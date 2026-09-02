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

// Página que usa exclusivamente los endpoints de juegos ya existentes en el
// repo del equipo: GET /api/users/<id>/games (listar) y
// POST /api/users/<id>/games (añadir/actualizar) — sin pasar por mis
// endpoints propios de sincronización con la Steam Web API.
export const MyGames = () => {
	const { store } = useGlobalReducer();
	const { favorites, toggleFavorite } = useFavorites(store.token);

	const [userGames, setUserGames] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");

	const [form, setForm] = useState({ appid: "", name: "", img_icon_url: "", playtime_forever: "" });
	const [formError, setFormError] = useState("");
	const [saving, setSaving] = useState(false);

	const loadGames = () => {
		if (!store.user) return;
		setLoading(true);
		api.userGames(store.user.id, store.token)
			.then((data) => setUserGames(data.games || []))
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	};

	useEffect(loadGames, [store.user?.id, store.token]);

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

	const stats = useMemo(() => {
		const totalMinutes = userGames.reduce((sum, ug) => sum + (ug.playtime_forever || 0), 0);
		return { games: userGames.length, hours: Math.round(totalMinutes / 60) };
	}, [userGames]);

	const handleFormChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

	const handleAddGame = async (e) => {
		e.preventDefault();
		setFormError("");

		const appid = Number(form.appid);
		if (!appid || !form.name.trim()) {
			setFormError("El AppID y el nombre del juego son obligatorios.");
			return;
		}

		setSaving(true);
		try {
			await api.addUserGames(store.user.id, [{
				appid,
				name: form.name.trim(),
				img_icon_url: form.img_icon_url.trim() || null,
				playtime_forever: Number(form.playtime_forever) || 0,
			}], store.token);

			setForm({ appid: "", name: "", img_icon_url: "", playtime_forever: "" });
			loadGames();
		} catch (err) {
			setFormError(err.message);
		} finally {
			setSaving(false);
		}
	};

	if (!store.user) return <Navigate to="/login" replace />;

	return (
		<>
			<header className="sv-overview">
				<div className="container">
					<p className="sv-label">BIBLIOTECA</p>
					<h2 className="sv-h2">MIS <span style={{ color: "var(--accent)" }}>JUEGOS</span></h2>
					<p className="sv-hint mt-2">Usando los endpoints de juegos del equipo (GET / POST /api/users/&lt;id&gt;/games)</p>

					<div className="sv-stats-row">
						<div className="sv-stat-tile"><div className="sv-stat-value">{stats.games}</div><div className="sv-stat-label">Juegos</div></div>
						<div className="sv-stat-tile"><div className="sv-stat-value">{stats.hours.toLocaleString("es-ES")}</div><div className="sv-stat-label">Horas jugadas</div></div>
						<div className="sv-stat-tile"><div className="sv-stat-value">{favorites.length}</div><div className="sv-stat-label">Favoritos</div></div>
					</div>
				</div>
			</header>

			{/* ---- AÑADIR JUEGO (POST /api/users/<id>/games) ---- */}
			<section className="sv-section" style={{ paddingTop: "3rem", paddingBottom: "3rem", background: "var(--bg-2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
				<div className="container">
					<p className="sv-label">AÑADIR MANUALMENTE</p>
					<h2 className="sv-h2 mb-4">SUMAR <span style={{ color: "var(--accent)" }}>UN JUEGO</span></h2>

					{formError && <div className="sv-auth-error">{formError}</div>}

					<form className="row g-3 align-items-end" onSubmit={handleAddGame}>
						<div className="col-6 col-md-2">
							<label className="form-label">AppID</label>
							<input type="number" className="form-control" placeholder="730" required
								value={form.appid} onChange={handleFormChange("appid")}
								style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
						</div>
						<div className="col-12 col-md-4">
							<label className="form-label">Nombre</label>
							<input type="text" className="form-control" placeholder="Counter-Strike 2" required
								value={form.name} onChange={handleFormChange("name")}
								style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
						</div>
						<div className="col-12 col-md-3">
							<label className="form-label">URL de imagen (opcional)</label>
							<input type="text" className="form-control" placeholder="https://..."
								value={form.img_icon_url} onChange={handleFormChange("img_icon_url")}
								style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
						</div>
						<div className="col-6 col-md-2">
							<label className="form-label">Minutos jugados</label>
							<input type="number" className="form-control" placeholder="0"
								value={form.playtime_forever} onChange={handleFormChange("playtime_forever")}
								style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
						</div>
						<div className="col-12 col-md-1">
							<button type="submit" className="btn sv-btn-accent w-100" disabled={saving}>
								{saving ? "…" : <i className="fa-solid fa-plus"></i>}
							</button>
						</div>
					</form>
				</div>
			</section>

			{/* ---- LISTA (GET /api/users/<id>/games) ---- */}
			<section className="sv-section">
				<div className="container">
					<div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
						<div>
							<p className="sv-label">TU BIBLIOTECA</p>
							<h2 className="sv-h2">TODOS TUS <span style={{ color: "var(--accent)" }}>JUEGOS</span></h2>
						</div>
						<div className="sv-filter-group">
							{FILTERS.map((f) => (
								<button key={f.key} className={`sv-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
									{f.label}
								</button>
							))}
						</div>
					</div>

					<div className="d-flex justify-content-end mb-4">
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

					{!loading && !error && (
						<>
							<div className="row g-3">
								{filteredGames.map((ug) => (
									<GameCard
										key={ug.id}
										userGame={ug}
										isFavorite={favorites.includes(ug.game.appid)}
										onToggleFavorite={toggleFavorite}
									/>
								))}
							</div>
							{filteredGames.length === 0 && (
								<p className="sv-empty">
									<i className="fa-solid fa-gamepad"></i>
									{userGames.length === 0 ? "Todavía no tienes juegos. Añade uno con el formulario de arriba." : "No hay juegos que coincidan con este filtro."}
								</p>
							)}
						</>
					)}
				</div>
			</section>
		</>
	);
};

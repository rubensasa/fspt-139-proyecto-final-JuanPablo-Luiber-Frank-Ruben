import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { GameCard } from "../components/GameCard";

export const PublicGames = () => {
	const { steamId } = useParams();
	const [profile, setProfile] = useState(null);
	const [games, setGames] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	useEffect(() => {
		setLoading(true);
		api.publicProfile(steamId).then((data) => {
			setProfile(data.profile);
			return api.publicGames(data.profile.steamid);
		}).then((data) => {
			setGames(data.games || []);
		}).catch((err) => setError(err.message)).finally(() => setLoading(false));
	}, [steamId]);

	const filteredGames = useMemo(() => {
		let result = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever);
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			result = result.filter((g) => g.name.toLowerCase().includes(q));
		}
		return result;
	}, [games, search]);

	if (loading) return <div className="sv-spinner"></div>;
	if (error) return <p className="sv-empty"><i className="fa-solid fa-triangle-exclamation"></i>{error}</p>;

	return (
		<>
			<header className="sv-overview" style={{ padding: "2.5rem 0" }}>
				<div className="container">
					<p className="sv-label">BIBLIOTECA</p>
					<h2 className="sv-h2">TODOS LOS <span style={{ color: "var(--accent)" }}>JUEGOS</span></h2>
					<p className="sv-hint mt-2">Perfil de {profile?.personaname} · {games.length} juegos</p>
				</div>
			</header>

			<div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
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

				<div className="row g-3">
					{filteredGames.map((g) => (
						<GameCard
							key={g.appid}
							userGame={{ id: g.appid, playtime_forever: g.playtime_forever, game: g }}
							achievementsLink={`/u/${steamId}/achievements?appid=${g.appid}`}
						/>
					))}
				</div>
				{filteredGames.length === 0 && (
					<p className="sv-empty"><i className="fa-solid fa-gamepad"></i>No hay juegos que coincidan.</p>
				)}
			</div>
		</>
	);
};

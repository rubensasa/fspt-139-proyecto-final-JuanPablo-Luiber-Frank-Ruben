import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { GameCard } from "../components/GameCard";

const STATUS_LABELS = ["Desconectado", "En línea", "Ocupado", "Ausente", "Durmiendo", "Buscando comerciar", "Buscando jugar"];

export const PublicProfile = () => {
	const { steamId } = useParams();
	const [profile, setProfile] = useState(null);
	const [games, setGames] = useState([]);
	const [loading, setLoading] = useState(true);
	const [gamesError, setGamesError] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		setLoading(true);
		setError("");
		setGamesError("");
		setProfile(null);

		let profileFetched = false;

		api.publicProfile(steamId).then((data) => {
			profileFetched = true;
			setProfile(data.profile);
			return api.publicGames(data.profile.steamid);
		}).then((data) => {
			setGames(data.games || []);
		}).catch((err) => {
			if (!profileFetched) setError(err.message);
			else setGamesError(err.message);
		}).finally(() => setLoading(false));
	}, [steamId]);

	if (loading) return <div className="sv-spinner"></div>;

	if (error) {
		return (
			<div className="sv-empty">
				<i className="fa-solid fa-triangle-exclamation"></i>
				<p>{error}</p>
				<Link to="/search" className="btn sv-btn-accent mt-2">Volver a buscar</Link>
			</div>
		);
	}

	const totalHours = Math.round(games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / 60);
	const topGames = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 8);

	return (
		<>
			<header className="sv-overview">
				<div className="container">
					<div className="row align-items-center g-4">
						<div className="col-auto">
							<img src={profile.avatarfull} alt="Avatar" className="sv-avatar" />
						</div>
						<div className="col">
							<div className="d-flex align-items-center gap-2 flex-wrap mb-1">
								<h1 className="sv-player-name mb-0">{profile.personaname}</h1>
								<span className="sv-badge-source registered">Perfil público de Steam</span>
							</div>
							<p className="sv-player-meta mb-0">
								<span className={`sv-status-dot ${profile.personastate > 0 ? "sv-status-online" : ""}`}></span>
								{STATUS_LABELS[profile.personastate ?? 0] || "Desconocido"}
								&nbsp;·&nbsp; SteamID: {profile.steamid}
							</p>
						</div>
					</div>

					<div className="sv-stats-row">
						<div className="sv-stat-tile"><div className="sv-stat-value">{games.length}</div><div className="sv-stat-label">Juegos</div></div>
						<div className="sv-stat-tile"><div className="sv-stat-value">{totalHours.toLocaleString("es-ES")}</div><div className="sv-stat-label">Horas jugadas</div></div>
						<div className="sv-stat-tile">
							<a href={profile.profileurl} target="_blank" rel="noreferrer" className="sv-btn-ghost btn btn-sm">
								<i className="fa-brands fa-steam"></i> Ver en Steam
							</a>
						</div>
					</div>
				</div>
			</header>

			<section className="sv-section">
				<div className="container">
					<div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
						<div>
							<p className="sv-label">BIBLIOTECA</p>
							<h2 className="sv-h2">JUEGOS <span style={{ color: "var(--accent)" }}>MÁS JUGADOS</span></h2>
						</div>
					</div>

					{gamesError && (
						<p className="sv-empty">
							<i className="fa-solid fa-lock"></i>
							No se pudo leer la biblioteca de juegos ({gamesError}). El perfil de Steam de este usuario podría ser privado.
						</p>
					)}

					{!gamesError && topGames.length === 0 && (
						<p className="sv-empty"><i className="fa-solid fa-gamepad"></i>Este perfil no tiene juegos públicos.</p>
					)}

					<div className="row g-3">
						{topGames.map((g) => (
							<GameCard
								key={g.appid}
								userGame={{ id: g.appid, playtime_forever: g.playtime_forever, game: g }}
								achievementsLink={`/u/${profile.steamid}/achievements?appid=${g.appid}`}
							/>
						))}
					</div>

					{games.length > 8 && (
						<div className="text-center mt-4">
							<Link to={`/u/${profile.steamid}/games`} className="btn sv-btn-outline">Ver todos los juegos <i className="fa-solid fa-arrow-right ms-1"></i></Link>
						</div>
					)}
				</div>
			</section>
		</>
	);
};

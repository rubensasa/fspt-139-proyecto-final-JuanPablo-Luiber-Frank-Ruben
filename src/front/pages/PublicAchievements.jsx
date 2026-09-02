import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../services/api";

export const PublicAchievements = () => {
	const { steamId } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();

	const [profile, setProfile] = useState(null);
	const [games, setGames] = useState([]);
	const [selectedAppid, setSelectedAppid] = useState(searchParams.get("appid") || "");
	const [detail, setDetail] = useState(null);
	const [loading, setLoading] = useState(true);
	const [detailLoading, setDetailLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		setLoading(true);
		api.publicProfile(steamId).then((data) => {
			setProfile(data.profile);
			return api.publicGames(data.profile.steamid);
		}).then((data) => {
			const gamesList = data.games || [];
			setGames(gamesList);
			if (!selectedAppid && gamesList.length) setSelectedAppid(String(gamesList[0].appid));
		}).catch((err) => setError(err.message)).finally(() => setLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [steamId]);

	useEffect(() => {
		if (!selectedAppid) return;
		setSearchParams({ appid: selectedAppid }, { replace: true });
		setDetailLoading(true);
		setDetail(null);
		api.publicAchievements(steamId, selectedAppid).then((data) => {
			setDetail(data);
		}).catch((err) => setError(err.message)).finally(() => setDetailLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedAppid, steamId]);

	if (loading) return <div className="sv-spinner"></div>;
	if (error && !profile) return <p className="sv-empty"><i className="fa-solid fa-triangle-exclamation"></i>{error}</p>;

	const total = detail?.achievements.length || 0;
	const unlocked = detail?.achievements.filter((a) => a.achieved === 1).length || 0;
	const pct = total ? Math.round((unlocked / total) * 100) : 0;
	const sorted = detail ? [...detail.achievements].sort((a, b) => b.achieved - a.achieved) : [];
	const selectedGame = games.find((g) => String(g.appid) === String(selectedAppid));

	return (
		<>
			<header className="sv-overview" style={{ padding: "2.5rem 0" }}>
				<div className="container">
					<p className="sv-label">LOGROS</p>
					<h2 className="sv-h2">LOGROS DE <span style={{ color: "var(--accent)" }}>{profile?.personaname}</span></h2>
				</div>
			</header>

			<div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
				{games.length === 0 && (
					<p className="sv-empty"><i className="fa-solid fa-trophy"></i>Este perfil no tiene juegos públicos.</p>
				)}

				{games.length > 0 && (
					<div className="row mb-3">
						<div className="col-md-5">
							<select className="form-select sv-game-select" value={selectedAppid} onChange={(e) => setSelectedAppid(e.target.value)}>
								{games.map((g) => <option key={g.appid} value={g.appid}>{g.name}</option>)}
							</select>
						</div>
					</div>
				)}

				{detailLoading && <div className="sv-spinner"></div>}

				{!detailLoading && total === 0 && selectedAppid && (
					<p className="sv-empty"><i className="fa-solid fa-trophy"></i>Este juego no tiene logros, o el perfil de Steam es privado.</p>
				)}

				{!detailLoading && total > 0 && (
					<>
						<div className="sv-ach-summary">
							<div className="sv-ach-ring" style={{ "--pct": pct }} data-pct={pct}></div>
							<div className="sv-ach-summary-text">
								<div className="sv-game-title" style={{ fontSize: "1.2rem" }}>{selectedGame?.name}</div>
								<div className="sv-hint">{unlocked} de {total} logros desbloqueados</div>
							</div>
						</div>

						{sorted.map((a) => (
							<div className={`sv-ach-item${a.achieved ? " unlocked" : ""}`} key={a.apiname}>
								<div className="sv-ach-icon"><i className={`fa-solid ${a.achieved ? "fa-trophy" : "fa-lock"}`}></i></div>
								<div className="sv-ach-text">
									<div className="sv-ach-name">{a.displayName}</div>
									<div className="sv-ach-desc">{a.description || (a.achieved ? "Logro desbloqueado" : "Logro bloqueado")}</div>
								</div>
								<div className="sv-ach-rarity">
									{a.globalPercentage != null && <><strong>{a.globalPercentage.toFixed(1)}%</strong>de los jugadores</>}
								</div>
							</div>
						))}
					</>
				)}
			</div>
		</>
	);
};

import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";
import { api } from "../services/api";

export const Achievements = () => {
	const { store } = useGlobalReducer();
	const [searchParams, setSearchParams] = useSearchParams();

	const [userGames, setUserGames] = useState([]);
	const [selectedAppid, setSelectedAppid] = useState(searchParams.get("appid") || "");
	const [detail, setDetail] = useState(null);
	const [loading, setLoading] = useState(true);
	const [detailLoading, setDetailLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!store.user) return;
		setLoading(true);
		api.userGames(store.user.id, store.token).then((data) => {
			const games = data.games || [];
			setUserGames(games);
			if (!selectedAppid && games.length) setSelectedAppid(String(games[0].game.appid));
		}).catch((err) => setError(err.message)).finally(() => setLoading(false));
	}, [store.user, store.token]);

	useEffect(() => {
		if (!selectedAppid) return;
		setSearchParams({ appid: selectedAppid }, { replace: true });
		setDetailLoading(true);
		setError("");
		api.achievements(selectedAppid, store.token).then((data) => {
			setDetail(data);
		}).catch((err) => setError(err.message)).finally(() => setDetailLoading(false));
	}, [selectedAppid, store.token]);

	if (!store.user) return <Navigate to="/login" replace />;
	if (loading) return <div className="sv-spinner"></div>;

	const total = detail?.achievements.length || 0;
	const unlocked = detail?.achievements.filter((a) => a.achieved === 1).length || 0;
	const pct = total ? Math.round((unlocked / total) * 100) : 0;
	const sorted = detail ? [...detail.achievements].sort((a, b) => b.achieved - a.achieved) : [];

	return (
		<>
			<header className="sv-overview" style={{ padding: "2.5rem 0" }}>
				<div className="container">
					<p className="sv-label">LOGROS</p>
					<h2 className="sv-h2">TUS <span style={{ color: "var(--accent)" }}>LOGROS</span></h2>
					<p className="sv-hint mt-2">Logros reales obtenidos en Steam</p>
				</div>
			</header>

			<div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
				{userGames.length === 0 && (
					<p className="sv-empty"><i className="fa-solid fa-trophy"></i>Sincroniza tu biblioteca de juegos desde tu perfil para ver logros.</p>
				)}

				{userGames.length > 0 && (
					<div className="row mb-3">
						<div className="col-md-5">
							<select className="form-select sv-game-select" value={selectedAppid} onChange={(e) => setSelectedAppid(e.target.value)}>
								{userGames.map((ug) => <option key={ug.game.appid} value={ug.game.appid}>{ug.game.name}</option>)}
							</select>
						</div>
					</div>
				)}

				{detailLoading && <div className="sv-spinner"></div>}
				{!detailLoading && error && <p className="sv-empty"><i className="fa-solid fa-triangle-exclamation"></i>{error}</p>}

				{!detailLoading && !error && detail && (
					total === 0 ? (
						<p className="sv-empty"><i className="fa-solid fa-trophy"></i>Este juego no tiene logros, o Steam no devolvió datos para tu cuenta (el perfil debe ser público).</p>
					) : (
						<>
							<div className="sv-ach-summary">
								<div className="sv-ach-ring" style={{ "--pct": pct }} data-pct={pct}></div>
								<div className="sv-ach-summary-text">
									<div className="sv-game-title" style={{ fontSize: "1.2rem" }}>{detail.gameName}</div>
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
					)
				)}
			</div>
		</>
	);
};

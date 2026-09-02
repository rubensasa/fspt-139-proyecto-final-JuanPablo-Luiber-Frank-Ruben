import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";
import useFavorites from "../hooks/useFavorites";
import { api } from "../services/api";
import { GameCard } from "../components/GameCard";

const FILTERS = [
	{ key: "all", label: "Todos" },
	{ key: "favorites", label: "Favoritos" },
	{ key: "recent", label: "Más jugados" },
];

export const Profile = () => {
	const { store, dispatch } = useGlobalReducer();
	const { favorites, toggleFavorite } = useFavorites(store.token);

	const [steamAccount, setSteamAccount] = useState(null);
	const [steamMessage, setSteamMessage] = useState("");
	const [steamError, setSteamError] = useState("");
	const [syncing, setSyncing] = useState(false);

	const [userGames, setUserGames] = useState([]);
	const [gamesLoading, setGamesLoading] = useState(true);
	const [filter, setFilter] = useState("all");

	const [friends, setFriends] = useState([]);
	const [friendQuery, setFriendQuery] = useState("");
	const [friendResults, setFriendResults] = useState([]);
	const [friendMsg, setFriendMsg] = useState("");

	// mensaje al volver de vincular Steam (?steam=connected)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("steam") === "connected") {
			setSteamMessage("¡Cuenta de Steam conectada correctamente!");
			window.history.replaceState({}, document.title, window.location.pathname);
		}
	}, []);

	// refrescamos el usuario (por si venimos de vincular/desvincular Steam) y su cuenta de Steam
	useEffect(() => {
		if (!store.token) return;
		api.me(store.token).then((data) => dispatch({ type: "set_user", payload: data.user })).catch(() => {});
		api.steamAccount(store.token).then((data) => {
			setSteamAccount(data.linked ? data.steam_account : null);
		}).catch(() => {});
	}, [store.token]);

	const loadGames = () => {
		if (!store.user) return;
		setGamesLoading(true);
		api.userGames(store.user.id, store.token).then((data) => {
			setUserGames(data.games || []);
		}).catch(() => {}).finally(() => setGamesLoading(false));
	};

	useEffect(loadGames, [store.user?.id, store.token]);

	useEffect(() => {
		if (!store.token) return;
		api.friends(store.token).then((data) => setFriends(data.friendships || [])).catch(() => {});
	}, [store.token]);

	const connectSteam = async () => {
		setSteamMessage(""); setSteamError("");
		try {
			const data = await api.steamLoginUrl(store.token);
			window.location.href = data.steam_login_url;
		} catch (err) {
			setSteamError(err.message);
		}
	};

	const unlinkSteam = async () => {
		setSteamMessage(""); setSteamError("");
		try {
			await api.unlinkSteam(store.token);
			setSteamAccount(null);
			setSteamMessage("Cuenta de Steam desvinculada correctamente.");
		} catch (err) {
			setSteamError(err.message);
		}
	};

	const syncGames = async () => {
		setSteamMessage(""); setSteamError(""); setSyncing(true);
		try {
			const data = await api.syncGames(store.token);
			setUserGames(data.games || []);
			setSteamMessage("Biblioteca de juegos sincronizada.");
		} catch (err) {
			setSteamError(err.message);
		} finally {
			setSyncing(false);
		}
	};

	const searchFriends = async (e) => {
		e.preventDefault();
		setFriendMsg("");
		try {
			const data = await api.searchUsers(friendQuery, store.token);
			setFriendResults(data.users || []);
		} catch (err) {
			setFriendMsg(err.message);
		}
	};

	const addFriend = async (id) => {
		try {
			await api.addFriend(id, store.token);
			const data = await api.friends(store.token);
			setFriends(data.friendships || []);
			setFriendMsg("Amigo añadido.");
		} catch (err) {
			setFriendMsg(err.message);
		}
	};

	const removeFriend = async (id) => {
		try {
			await api.removeFriend(id, store.token);
			setFriends((prev) => prev.filter((f) => f.id !== id));
		} catch (err) {
			setFriendMsg(err.message);
		}
	};

	const stats = useMemo(() => {
		const totalMinutes = userGames.reduce((sum, ug) => sum + (ug.playtime_forever || 0), 0);
		return {
			games: userGames.length,
			hours: Math.round(totalMinutes / 60),
			friends: friends.length,
		};
	}, [userGames, friends]);

	const filteredGames = useMemo(() => {
		let result = userGames;
		if (filter === "favorites") result = result.filter((ug) => favorites.includes(ug.game.appid));
		if (filter === "recent") result = [...result].sort((a, b) => b.playtime_forever - a.playtime_forever);
		return result.slice(0, 8);
	}, [userGames, filter, favorites]);

	if (!store.user) {
		return <Navigate to="/login" replace />;
	}

	return (
		<>
			<header className="sv-overview" id="overview">
				<div className="container">
					<div className="row align-items-center g-4">
						<div className="col-auto">
							<img
								src={store.user.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(store.user.nickname)}
								alt="Avatar" className="sv-avatar"
							/>
						</div>
						<div className="col">
							<div className="d-flex align-items-center gap-2 flex-wrap mb-1">
								<h1 className="sv-player-name mb-0">{store.user.nickname}</h1>
								<span className={`sv-badge-source ${steamAccount ? "registered" : "mock"}`}>
									{steamAccount ? "Steam vinculado" : "Steam sin vincular"}
								</span>
							</div>
							<p className="sv-player-meta mb-0">{store.user.email}</p>
						</div>
					</div>

					<div className="sv-stats-row">
						<div className="sv-stat-tile"><div className="sv-stat-value">{stats.games}</div><div className="sv-stat-label">Juegos</div></div>
						<div className="sv-stat-tile"><div className="sv-stat-value">{stats.hours.toLocaleString("es-ES")}</div><div className="sv-stat-label">Horas jugadas</div></div>
						<div className="sv-stat-tile"><div className="sv-stat-value">{stats.friends}</div><div className="sv-stat-label">Amigos</div></div>
					</div>
				</div>
			</header>

			{/* ---- VINCULAR STEAM ---- */}
			<section className="sv-section" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
				<div className="container">
					{steamMessage && <div className="sv-auth-success mb-3">{steamMessage}</div>}
					{steamError && <div className="sv-auth-error mb-3">{steamError}</div>}

					<div className={`sv-steam-card${steamAccount ? " linked" : ""}`}>
						<div className="sv-steam-icon"><i className="fa-brands fa-steam"></i></div>
						<div className="flex-grow-1">
							{steamAccount ? (
								<>
									<div className="sv-game-title" style={{ fontSize: "1.1rem" }}>Cuenta de Steam vinculada</div>
									<div className="sv-hint">SteamID: ********{steamAccount.steam_id.slice(-4)}</div>
								</>
							) : (
								<>
									<div className="sv-game-title" style={{ fontSize: "1.1rem" }}>Tu cuenta de Steam no está vinculada</div>
									<div className="sv-hint">Vincúlala para traer tu biblioteca de juegos y logros reales.</div>
								</>
							)}
						</div>
						<div className="d-flex gap-2 flex-wrap">
							{steamAccount ? (
								<>
									<button className="btn sv-btn-outline" onClick={syncGames} disabled={syncing}>
										<i className="fa-solid fa-rotate me-1"></i>{syncing ? "Sincronizando…" : "Sincronizar juegos"}
									</button>
									<button className="btn sv-btn-ghost" onClick={unlinkSteam}>Desvincular</button>
								</>
							) : (
								<button className="btn sv-btn-accent" onClick={connectSteam}>
									<i className="fa-brands fa-steam me-1"></i>Vincular Steam
								</button>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* ---- JUEGOS ---- */}
			<section className="sv-section" id="games" style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
				<div className="container">
					<div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
						<div>
							<p className="sv-label">BIBLIOTECA</p>
							<h2 className="sv-h2">MIS <span style={{ color: "var(--accent)" }}>JUEGOS</span></h2>
						</div>
						<div className="sv-filter-group">
							{FILTERS.map((f) => (
								<button key={f.key} className={`sv-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
									{f.label}
								</button>
							))}
						</div>
					</div>

					{gamesLoading && <div className="sv-spinner"></div>}

					{!gamesLoading && filteredGames.length === 0 && (
						<p className="sv-empty">
							<i className="fa-solid fa-gamepad"></i>
							{steamAccount ? "Todavía no has sincronizado tu biblioteca. Usa el botón de arriba." : "Vincula tu cuenta de Steam para ver tus juegos."}
						</p>
					)}

					<div className="row g-3">
						{filteredGames.map((ug) => (
							<GameCard key={ug.id} userGame={ug} isFavorite={favorites.includes(ug.game.appid)} onToggleFavorite={toggleFavorite} />
						))}
					</div>

					{userGames.length > 8 && (
						<div className="text-center mt-4">
							<Link to="/profile/games" className="btn sv-btn-outline">Ver todos los juegos <i className="fa-solid fa-arrow-right ms-1"></i></Link>
						</div>
					)}
				</div>
			</section>

			{/* ---- AMIGOS ---- */}
			<section className="sv-section" id="friends">
				<div className="container">
					<p className="sv-label">SOCIAL</p>
					<h2 className="sv-h2 mb-4">MIS <span style={{ color: "var(--accent)" }}>AMIGOS</span></h2>

					<div className="row g-4">
						<div className="col-lg-6">
							<h6 className="sv-hint mb-3">BUSCAR Y AÑADIR</h6>
							<form className="d-flex gap-2 mb-3" onSubmit={searchFriends}>
								<input type="text" className="form-control" placeholder="Nombre o email..."
									value={friendQuery} onChange={(e) => setFriendQuery(e.target.value)}
									style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
								<button type="submit" className="btn sv-btn-outline"><i className="fa-solid fa-magnifying-glass"></i></button>
							</form>
							{friendMsg && <p className="sv-hint">{friendMsg}</p>}
							<div className="d-flex flex-column gap-2">
								{friendResults.map((u) => (
									<div className="sv-friend-card" key={u.id}>
										<img className="sv-friend-avatar" src={u.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(u.nickname)} alt={u.nickname} />
										<div className="flex-grow-1">
											<div className="sv-friend-name">{u.nickname}</div>
											<div className="sv-friend-email">{u.email}</div>
										</div>
										<button className="btn btn-sm sv-btn-outline" onClick={() => addFriend(u.id)}>Añadir</button>
									</div>
								))}
							</div>
						</div>

						<div className="col-lg-6">
							<h6 className="sv-hint mb-3">MIS AMIGOS ({friends.length})</h6>
							{friends.length === 0 && <p className="sv-empty"><i className="fa-solid fa-users"></i>Todavía no tienes amigos añadidos.</p>}
							<div className="d-flex flex-column gap-2">
								{friends.map((f) => (
									<div className="sv-friend-card" key={f.id}>
										<img className="sv-friend-avatar" src={f.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(f.nickname)} alt={f.nickname} />
										<div className="flex-grow-1">
											<div className="sv-friend-name">{f.nickname}</div>
											<div className="sv-friend-email">{f.email}</div>
										</div>
										<button className="btn btn-sm sv-btn-ghost" onClick={() => removeFriend(f.id)}>Quitar</button>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>
		</>
	);
};

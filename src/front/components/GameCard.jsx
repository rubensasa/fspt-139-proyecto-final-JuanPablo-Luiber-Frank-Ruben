import { Link } from "react-router-dom";

export const GameCard = ({ userGame, isFavorite, onToggleFavorite, achievementsLink }) => {
	const { game, playtime_forever } = userGame;
	const hours = Math.round((playtime_forever / 60) * 10) / 10;

	return (
		<div className="col-6 col-md-4 col-lg-3">
			<div className="sv-game-card">
				{onToggleFavorite && (
					<button
						className={`sv-fav-btn${isFavorite ? " active" : ""}`}
						title="Marcar favorito"
						onClick={() => onToggleFavorite(game.appid)}
					>
						<i className={isFavorite ? "fa-solid fa-star" : "fa-regular fa-star"}></i>
					</button>
				)}
				<img
					src={game.img_icon_url || `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`}
					alt={game.name}
					loading="lazy"
					onError={(e) => { e.target.style.opacity = 0; }}
				/>
				<div className="sv-game-body">
					<div className="sv-game-title" title={game.name}>{game.name}</div>
					<div className="sv-game-hours"><i className="fa-regular fa-clock"></i> {hours} h jugadas</div>
					{achievementsLink && (
						<Link to={achievementsLink} className="sv-hint">
							Ver logros <i className="fa-solid fa-arrow-right ms-1"></i>
						</Link>
					)}
				</div>
			</div>
		</div>
	);
};

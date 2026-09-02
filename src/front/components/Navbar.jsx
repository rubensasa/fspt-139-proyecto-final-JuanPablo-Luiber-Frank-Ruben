import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";
import useTheme from "../hooks/useTheme";

export const Navbar = () => {
	const { store, dispatch } = useGlobalReducer();
	const { theme, toggleTheme } = useTheme();
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 30);
		window.addEventListener("scroll", onScroll);
		onScroll();
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const handleLogout = () => {
		dispatch({ type: "logout" });
		navigate("/login");
	};

	const closeMenu = () => setMenuOpen(false);

	return (
		<nav className={`sv-navbar${scrolled ? " scrolled" : ""}`}>
			<div className="container d-flex justify-content-between align-items-center">
				<Link to={store.user ? "/profile" : "/login"} className="sv-logo">
					<i className="fa-solid fa-gamepad"></i>STEAM<span>VIEW</span>
				</Link>

				<button
					className="sv-navbar-toggler"
					aria-label="Abrir menú"
					aria-expanded={menuOpen}
					onClick={() => setMenuOpen((v) => !v)}
				>
					<i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"}`}></i>
				</button>

				<div className={`sv-nav-collapse${menuOpen ? " show" : ""}`}>
					{store.user && (
						<ul className="sv-nav-links">
							<li><Link to="/profile" onClick={closeMenu}>Perfil</Link></li>
							<li><Link to="/profile/games" onClick={closeMenu}>Juegos</Link></li>
							<li><Link to="/profile/achievements" onClick={closeMenu}>Logros</Link></li>
							<li><Link to="/profile#friends" onClick={closeMenu}>Amigos</Link></li>
						</ul>
					)}

					<div className="sv-nav-actions">
						<button className="sv-theme-toggle" title="Cambiar tema" onClick={toggleTheme}>
							<i className={`fa-solid ${theme === "light" ? "fa-moon" : "fa-sun"}`}></i>
						</button>

						<div className="sv-nav-user-area">
							{store.user ? (
								<>
									<span className="sv-user-name-sm d-none d-sm-inline sv-nav-label">{store.user.nickname}</span>
									<button className="btn btn-sm sv-btn-outline" onClick={() => { handleLogout(); closeMenu(); }}>
										<i className="fa-solid fa-arrow-right-from-bracket"></i> <span className="sv-nav-label">Cerrar sesión</span>
									</button>
								</>
							) : (
								<>
									<Link to="/login" className="btn btn-sm sv-btn-ghost" onClick={closeMenu}>
										<i className="fa-solid fa-right-to-bracket"></i> <span className="sv-nav-label">Iniciar sesión</span>
									</Link>
									<Link to="/register" className="btn btn-sm sv-btn-outline" onClick={closeMenu}>
										<span className="sv-nav-label">Crear cuenta</span>
									</Link>
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
};

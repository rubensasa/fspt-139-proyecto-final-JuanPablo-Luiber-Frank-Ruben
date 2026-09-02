"""
Llamadas a la Steam Web API oficial de Valve (distinta de steamapis.com, que ya
se usa en /api/steam/profile). Se usa aquí para sincronizar la biblioteca de
juegos reales y consultar logros reales de un steam_id ya vinculado.

Requiere la variable de entorno STEAM_API_KEY (gratuita, se obtiene en
https://steamcommunity.com/dev/apikey).
"""
import os
import requests

STEAM_API_BASE = "https://api.steampowered.com"


class SteamAPIError(Exception):
    pass


def _get_api_key():
    api_key = os.getenv("STEAM_API_KEY")
    if not api_key:
        raise SteamAPIError("STEAM_API_KEY no está configurada en el servidor")
    return api_key


def resolve_vanity_url(identifier):
    """Si 'identifier' ya es un SteamID64 (17 dígitos) lo devuelve tal cual;
    si es un nombre de perfil (vanity URL), lo resuelve al SteamID64 real."""
    if identifier.isdigit() and len(identifier) == 17:
        return identifier

    api_key = _get_api_key()
    url = f"{STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/"
    res = requests.get(url, params={"key": api_key, "vanityurl": identifier}, timeout=10)
    if res.status_code != 200:
        raise SteamAPIError(f"Steam respondió {res.status_code} al resolver el perfil")

    data = res.json().get("response", {})
    if data.get("success") != 1:
        raise SteamAPIError("No se encontró ningún perfil de Steam con ese nombre")
    return data.get("steamid")


def fetch_player_summary(steam_id):
    """Datos públicos básicos de un perfil: nombre, avatar, estado, etc."""
    api_key = _get_api_key()
    url = f"{STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/"
    res = requests.get(url, params={"key": api_key, "steamids": steam_id}, timeout=10)
    if res.status_code != 200:
        raise SteamAPIError(f"Steam respondió {res.status_code} al pedir el perfil")

    players = res.json().get("response", {}).get("players", [])
    if not players:
        raise SteamAPIError("No se encontró ningún perfil de Steam con ese ID")
    return players[0]


def fetch_owned_games(steam_id):
    """Devuelve la lista de juegos que posee el steam_id, vía GetOwnedGames."""
    api_key = _get_api_key()
    url = f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/"
    params = {
        "key": api_key,
        "steamid": steam_id,
        "include_appinfo": 1,
        "include_played_free_games": 1,
    }
    res = requests.get(url, params=params, timeout=10)
    if res.status_code != 200:
        raise SteamAPIError(f"Steam respondió {res.status_code} al pedir los juegos")

    data = res.json()
    games = data.get("response", {}).get("games", [])
    return [
        {
            "appid": g.get("appid"),
            "name": g.get("name"),
            "img_icon_url": (
                f"https://media.steampowered.com/steamcommunity/public/images/apps/{g.get('appid')}/{g.get('img_icon_url')}.jpg"
                if g.get("img_icon_url") else None
            ),
            "playtime_forever": g.get("playtime_forever", 0),
        }
        for g in games
    ]


def fetch_player_achievements(steam_id, appid):
    """Logros del jugador para un juego (desbloqueados/no) — puede fallar si el juego no tiene logros."""
    api_key = _get_api_key()
    url = f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/"
    params = {"key": api_key, "steamid": steam_id, "appid": appid, "l": "spanish"}
    res = requests.get(url, params=params, timeout=10)
    if res.status_code != 200:
        return []
    data = res.json().get("playerstats", {})
    if not data.get("success", False):
        return []
    return data.get("achievements", [])


def fetch_global_achievement_percentages(appid):
    """% de jugadores que tienen cada logro, no requiere API key."""
    url = f"{STEAM_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/"
    res = requests.get(url, params={"gameid": appid}, timeout=10)
    if res.status_code != 200:
        return {}
    achievements = res.json().get("achievementpercentages", {}).get("achievements", [])
    return {a["name"]: float(a["percent"]) for a in achievements}


def fetch_game_schema(appid):
    """Nombres/descripciones legibles de los logros de un juego."""
    api_key = _get_api_key()
    url = f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/"
    res = requests.get(url, params={"key": api_key, "appid": appid, "l": "spanish"}, timeout=10)
    if res.status_code != 200:
        return {}
    achievements = res.json().get("game", {}).get("availableGameStats", {}).get("achievements", [])
    return {a["name"]: a for a in achievements}


def build_achievements_list(steam_id, appid):
    """Combina los tres endpoints anteriores en una lista lista para el frontend."""
    player_achievements = fetch_player_achievements(steam_id, appid)
    if not player_achievements:
        return []

    global_pct = fetch_global_achievement_percentages(appid)
    schema = fetch_game_schema(appid)

    result = []
    for a in player_achievements:
        api_name = a.get("apiname")
        schema_entry = schema.get(api_name, {})
        result.append({
            "apiname": api_name,
            "displayName": a.get("name") or schema_entry.get("displayName") or api_name,
            "description": schema_entry.get("description", ""),
            "achieved": a.get("achieved", 0),
            "unlocktime": a.get("unlocktime", 0),
            "globalPercentage": global_pct.get(api_name),
        })
    return result

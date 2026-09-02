"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import Flask, request, jsonify, url_for, Blueprint, redirect, session
from api.models import db, User, Game, UserGame, SteamAccount, Favorite
from api.utils import generate_sitemap, APIException
from api import steam_api
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import requests
from urllib.parse import urlencode
import os

api = Blueprint('api', __name__)


@api.route("/users", methods=["POST"])
def create_user():

    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    nickname = data.get("nickname")
    avatar_url = data.get("avatar_url")
    profile_url = data.get("profile_url")

    if not email or not password or not nickname:
        return jsonify({
            "error": "email, password and nickname are required"
        }), 400

    existing_user = db.session.execute(db.select(User).where(
        User.email == email)).scalar_one_or_none()
    if existing_user:
        return jsonify({"error": "User whith this email already exist"}), 400

    new_user = User(
        email=email,
        nickname=nickname,
        avatar_url=avatar_url,
        profile_url=profile_url
    )

    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=str(new_user.id))
    return jsonify({"msg": "User created succesfully", "token": access_token, "user": new_user.serialize()}), 201


@api.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user = db.session.get(User, get_jwt_identity())
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.serialize()}), 200


@api.route("/users/search", methods=["GET"])
@jwt_required()
def search_users():
    q = request.args.get("q", "").strip()
    current_user_id = int(get_jwt_identity())

    query = db.select(User).where(User.id != current_user_id)
    if q:
        like = f"%{q}%"
        query = query.where(db.or_(User.nickname.ilike(like), User.email.ilike(like)))

    users = db.session.execute(query.limit(20)).scalars().all()
    return jsonify({"users": [u.serialize() for u in users]}), 200


@api.route("/friends/<int:friend_id>", methods=["POST"])
@jwt_required()  # vigilante, sin pulsera no entras
def add_friend(friend_id):

    user_id = get_jwt_identity()

    user = db.session.get(User, user_id)
    friend = db.session.get(User, friend_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    if not friend:
        return jsonify({
            "error": "Friend not found"
        }), 404

    if user.id == friend.id:
        return jsonify({
            "error": "You cannot add yourself as a friend"
        }), 400

    if friend in user.friendships:
        return jsonify({
            "error": "User is already your friend"
        }), 400

    user.friendships.append(friend)

    db.session.commit()

    return jsonify({
        "msg": "Friend added successfully"
    }), 201


@api.route("/friends/<int:friend_id>", methods=["DELETE"])
@jwt_required()
def remove_friend(friend_id):

    user_id = get_jwt_identity()

    user = db.session.get(User, user_id)
    friend = db.session.get(User, friend_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    if not friend:
        return jsonify({
            "error": "Friend not found"
        }), 404

    if friend not in user.friendships:
        return jsonify({
            "error": "This user is not your friend"
        }), 404

    user.friendships.remove(friend)

    db.session.commit()

    return jsonify({
        "msg": "Friend removed successfully"
    }), 200


@api.route("/friends", methods=["GET"])
@jwt_required()
def get_friends():

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    return jsonify({
        "friendships": [friend.serialize() for friend in user.friendships]
    }), 200


@api.route("/friends-of", methods=["GET"])
@jwt_required()
def get_friends_of():

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    return jsonify({
        "friends_of": [friend.serialize() for friend in user.friends_of]
    }), 200


@api.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    existing_user = db.session.execute(db.select(User).where(
        User.email == email)).scalar_one_or_none()
    if existing_user is None:
        return jsonify({"error": "invalid email or password"}), 401

    if existing_user.check_password(password):
        access_token = create_access_token(identity=str(existing_user.id))
        return jsonify({"msg": "logeado correctamente", "token": access_token, "user": existing_user.serialize()}), 200
    else:
         return jsonify({"msg": "invalid email or password"}), 401


@api.route("/users/<int:user_id>/games", methods=["POST"])
@jwt_required()
def sync_user_games(user_id):

    current_user_id = get_jwt_identity()

    if str(current_user_id) != str(user_id):
        return jsonify({"error": "You cannot modify another user's games"}), 403

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    games_list = data.get("games")

    if not games_list:
        return jsonify({"error": "games list is required"}), 400

    for game_data in games_list:
        appid = game_data.get("appid")
        name = game_data.get("name")

        if not appid or not name:
            continue

        game = db.session.execute(db.select(Game).where(
            Game.appid == appid)).scalar_one_or_none()

        if not game:
            game = Game(
                appid=appid,
                name=name,
                img_icon_url=game_data.get("img_icon_url")
            )
            db.session.add(game)
            db.session.flush()

        user_game = db.session.execute(db.select(UserGame).where(
            UserGame.user_id == user_id,
            UserGame.game_id == game.id
        )).scalar_one_or_none()

        if not user_game:
            user_game = UserGame(user_id=user_id, game_id=game.id)
            db.session.add(user_game)

        user_game.playtime_forever = game_data.get("playtime_forever", 0)

    db.session.commit()

    return jsonify({"msg": "Games synced successfully"}), 201    

@api.route("/users/<int:user_id>/games", methods=["GET"])
@jwt_required()
def get_user_games(user_id):

    current_user_id = get_jwt_identity()

    if str(current_user_id) != str(user_id):
        return jsonify({"error": "You cannot view another user's games"}), 403

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user_games = db.session.execute(db.select(UserGame).where(
        UserGame.user_id == user_id)).scalars().all()

    return jsonify({
        "games": [user_game.serialize() for user_game in user_games]
    }), 200


@api.route("/steam/login", methods=["GET"])
@jwt_required()
def steam_login():

    user_id = get_jwt_identity()

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    session["steam_link_user_id"] = user_id

    return_url = os.getenv('STEAM_RETURN_URL')

    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": return_url,
        "openid.realm": return_url.rsplit("/api", 1)[0] + "/",
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
    }

    steam_url = "https://steamcommunity.com/openid/login?"

    steam_login_url = steam_url + urlencode(params)

    return jsonify({
        "steam_login_url": steam_login_url
    }), 200


@api.route("/steam/callback", methods=["GET"])
def steam_callback():

    user_id = session.get("steam_link_user_id")

    if not user_id:
        return jsonify({
            "error": "Steam linking session not found"
        }), 400

    steam_data = request.args.to_dict()

    verification_data = steam_data.copy()
    verification_data["openid.mode"] = "check_authentication"

    response = requests.post(
        "https://steamcommunity.com/openid/login",
        data=verification_data
    )

    if response.status_code != 200:
        return jsonify({
            "error": "Could not verify Steam authentication"
        }), 400

    if "is_valid:true" not in response.text:
        return jsonify({
            "error": "Invalid Steam authentication"
        }), 400

    claimed_id = steam_data.get("openid.claimed_id")

    if not claimed_id:
        return jsonify({
            "error": "Steam ID not received"
        }), 400

    steam_id = claimed_id.rsplit("/", 1)[-1]

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    existing_steam_account = db.session.execute(
        db.select(SteamAccount).where(
            SteamAccount.steam_id == steam_id
        )
    ).scalar_one_or_none()

    if existing_steam_account:
        return jsonify({
            "error": "This Steam account is already linked"
        }), 400

    steam_account = SteamAccount(
        steam_id=steam_id,
        user_id=user.id
    )

    db.session.add(steam_account)
    db.session.commit()

    session.pop("steam_link_user_id", None)

    frontend_url = os.getenv("VITE_FRONTEND_URL")

    return redirect(
        f"{frontend_url}/profile?steam=connected"
    )


@api.route("/steam/account", methods=["GET"])
@jwt_required()
def get_steam_account():

    user_id = get_jwt_identity()

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    steam_account = user.steam_account

    if not steam_account:
        return jsonify({
            "linked": False,
            "steam_account": None
        }), 200

    return jsonify({
        "linked": True,
        "steam_account": steam_account.serialize()
    }), 200


@api.route("/steam/account", methods=["DELETE"])
@jwt_required()
def unlink_steam():

    user_id = get_jwt_identity()

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    steam_account = user.steam_account

    if not steam_account:
        return jsonify({
            "error": "Steam account not linked"
        }), 404

    db.session.delete(steam_account)
    db.session.commit()

    return jsonify({
        "msg": "Steam account unlinked successfully"
    }), 200


@api.route("/steam/profile", methods=["GET"])
@jwt_required()
def get_steam_profile():

    user_id = get_jwt_identity()

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    steam_account = user.steam_account

    if not steam_account:
        return jsonify({
            "error": "Steam account not linked"
        }), 404

    steam_id = steam_account.steam_id

    api_key = os.getenv("API_KEY")

    response = requests.get(

        f"https://api.steamapis.com/v2/steam/users/{steam_id}",

        headers={
            "x-api-key": api_key
        }
    )

    if response.status_code != 200:
        return jsonify({
            "error": "Could not get Steam profile",
            "details": response.json()
        }), response.status_code

    data = response.json()

    return jsonify({
        "linked": True,
        "steam_account": steam_account.serialize(),
        "steam_profile": data
    }), 200


def _require_linked_steam_account(user):
    """Devuelve (steam_id, None) o (None, (response, status)) si no hay cuenta vinculada."""
    if not user.steam_account:
        return None, (jsonify({"error": "Steam account not linked"}), 404)
    return user.steam_account.steam_id, None


@api.route("/steam/sync-games", methods=["POST"])
@jwt_required()
def sync_games_from_steam():
    """Trae la biblioteca real de juegos del usuario desde la Steam Web API oficial
    (necesita STEAM_API_KEY) y la guarda/actualiza en Game/UserGame."""

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    steam_id, error = _require_linked_steam_account(user)
    if error:
        return error

    try:
        games_list = steam_api.fetch_owned_games(steam_id)
    except steam_api.SteamAPIError as e:
        return jsonify({"error": str(e)}), 502

    for game_data in games_list:
        appid = game_data.get("appid")
        name = game_data.get("name")
        if not appid or not name:
            continue

        game = db.session.execute(db.select(Game).where(
            Game.appid == appid)).scalar_one_or_none()

        if not game:
            game = Game(appid=appid, name=name, img_icon_url=game_data.get("img_icon_url"))
            db.session.add(game)
            db.session.flush()
        elif game.name != name or game.img_icon_url != game_data.get("img_icon_url"):
            game.name = name
            game.img_icon_url = game_data.get("img_icon_url")

        user_game = db.session.execute(db.select(UserGame).where(
            UserGame.user_id == int(user_id),
            UserGame.game_id == game.id
        )).scalar_one_or_none()

        if not user_game:
            user_game = UserGame(user_id=int(user_id), game_id=game.id)
            db.session.add(user_game)

        user_game.playtime_forever = game_data.get("playtime_forever", 0)

    db.session.commit()

    user_games = db.session.execute(db.select(UserGame).where(
        UserGame.user_id == int(user_id))).scalars().all()

    return jsonify({
        "msg": "Games synced successfully",
        "games": [ug.serialize() for ug in user_games]
    }), 200


@api.route("/achievements/<int:appid>", methods=["GET"])
@jwt_required()
def get_achievements(appid):
    """Logros reales (desbloqueados + % de rareza global) de un juego, para el
    steam_id vinculado del usuario actual."""

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    steam_id, error = _require_linked_steam_account(user)
    if error:
        return error

    game = db.session.execute(db.select(Game).where(Game.appid == appid)).scalar_one_or_none()

    try:
        achievements = steam_api.build_achievements_list(steam_id, appid)
    except steam_api.SteamAPIError as e:
        return jsonify({"error": str(e)}), 502

    return jsonify({
        "appid": appid,
        "gameName": game.name if game else None,
        "achievements": achievements,
    }), 200


# ============ FAVORITOS ============

@api.route("/favorites", methods=["GET"])
@jwt_required()
def get_favorites():
    user_id = int(get_jwt_identity())
    favs = db.session.execute(db.select(Favorite).where(Favorite.user_id == user_id)).scalars().all()
    return jsonify({"favorites": [f.appid for f in favs]}), 200


@api.route("/favorites/<int:appid>", methods=["POST"])
@jwt_required()
def add_favorite(appid):
    user_id = int(get_jwt_identity())
    existing = db.session.execute(db.select(Favorite).where(
        Favorite.user_id == user_id, Favorite.appid == appid)).scalar_one_or_none()
    if existing:
        return jsonify({"msg": "Already a favorite"}), 200

    db.session.add(Favorite(user_id=user_id, appid=appid))
    db.session.commit()
    return jsonify({"msg": "Added to favorites"}), 201


@api.route("/favorites/<int:appid>", methods=["DELETE"])
@jwt_required()
def remove_favorite(appid):
    user_id = int(get_jwt_identity())
    existing = db.session.execute(db.select(Favorite).where(
        Favorite.user_id == user_id, Favorite.appid == appid)).scalar_one_or_none()
    if not existing:
        return jsonify({"error": "Favorite not found"}), 404

    db.session.delete(existing)
    db.session.commit()
    return jsonify({"msg": "Removed from favorites"}), 200


# ============ PERFIL PÚBLICO (sin cuenta ni sesión) ============
# Cualquiera puede consultar un perfil de Steam por su SteamID64 o vanity URL,
# igual que en la propia steamcommunity.com. Requiere STEAM_API_KEY en el
# servidor, pero no requiere que quien mira tenga cuenta ni haya iniciado sesión.
# Si el perfil de Steam consultado es privado, Steam simplemente no devuelve
# los juegos/logros (no es un error nuestro).

@api.route("/steam/public/<identifier>", methods=["GET"])
def public_steam_profile(identifier):
    try:
        steam_id = steam_api.resolve_vanity_url(identifier)
        profile = steam_api.fetch_player_summary(steam_id)
    except steam_api.SteamAPIError as e:
        return jsonify({"error": str(e)}), 404

    return jsonify({"profile": profile}), 200


@api.route("/steam/public/<steam_id>/games", methods=["GET"])
def public_steam_games(steam_id):
    try:
        games = steam_api.fetch_owned_games(steam_id)
    except steam_api.SteamAPIError as e:
        return jsonify({"error": str(e)}), 404

    games.sort(key=lambda g: g.get("playtime_forever", 0), reverse=True)
    return jsonify({"games": games}), 200


@api.route("/steam/public/<steam_id>/achievements/<int:appid>", methods=["GET"])
def public_steam_achievements(steam_id, appid):
    try:
        achievements = steam_api.build_achievements_list(steam_id, appid)
    except steam_api.SteamAPIError as e:
        return jsonify({"error": str(e)}), 404

    return jsonify({"appid": appid, "achievements": achievements}), 200

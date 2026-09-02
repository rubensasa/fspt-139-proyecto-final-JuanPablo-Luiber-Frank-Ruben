export const initialStore = () => {
  let token = null;
  let user = null;
  try {
    token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("sv_user");
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    token = null;
    user = null;
  }

  return {
    message: null,
    token,
    user,
  };
};

export default function storeReducer(store, action = {}) {
  switch (action.type) {
    case "set_hello":
      return { ...store, message: action.payload };

    case "set_session": {
      const { token, user } = action.payload;
      localStorage.setItem("token", token);
      localStorage.setItem("sv_user", JSON.stringify(user));
      return { ...store, token, user };
    }

    case "set_user": {
      localStorage.setItem("sv_user", JSON.stringify(action.payload));
      return { ...store, user: action.payload };
    }

    case "logout": {
      localStorage.removeItem("token");
      localStorage.removeItem("sv_user");
      return { ...store, token: null, user: null };
    }

    default:
      throw Error("Unknown action.");
  }
}

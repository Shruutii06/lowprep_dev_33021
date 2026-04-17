import { create } from "zustand";

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem("user")) || null,
  token: localStorage.getItem("token") || null,

  login: (data) => {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    set({
      token: data.access_token,
      user: data.user,
    });
  },

  logout: () => {
    localStorage.clear();
    set({ token: null, user: null });
  },
}));

export default useAuthStore;
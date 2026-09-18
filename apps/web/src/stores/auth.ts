import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api, readToken, writeToken } from "@/api/client";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(readToken());
  const username = ref("");
  const busy = ref(false);
  const error = ref("");

  const loggedIn = computed(() => Boolean(token.value));

  function setToken(next: string) {
    token.value = next;
    writeToken(next);
  }

  async function login(user: string, password: string) {
    busy.value = true;
    error.value = "";
    try {
      const res = await api<{ token: string; username?: string }>("/v1/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password }),
        token: "",
      });
      setToken(res.token);
      username.value = res.username || user;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      busy.value = false;
    }
  }

  function logout() {
    setToken("");
    username.value = "";
  }

  async function refreshMe() {
    if (!token.value) return;
    try {
      const me = await api<{ username?: string }>("/v1/admin/me", { token: token.value });
      username.value = me.username || username.value;
    } catch {
      logout();
    }
  }

  return { token, username, busy, error, loggedIn, login, logout, refreshMe, setToken };
});

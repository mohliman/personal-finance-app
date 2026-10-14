import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { api } from "./api";
import "./account.css";
export interface User {
  id: string;
  name: string;
  email: string;
}
const AccountContext = createContext<{
  user: User;
  logout: () => Promise<void>;
} | null>(null);
export function AccountGate({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setUser((await api<{ user: User | null }>("/api/session")).user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const expire = () => {
      setUser(null);
      void api("/api/session").catch(() => {});
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ user: User }>(`/api/${mode}`, "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        demo,
      });
      setUser(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="account-loading" role="status">
        Opening your workspace…
      </main>
    );
  if (user)
    return (
      <AccountContext.Provider
        value={{
          user,
          logout: async () => {
            await api("/api/logout", "POST", {});
            setUser(null);
          },
        }}
      >
        {children}
      </AccountContext.Provider>
    );
  return (
    <main className="account-page">
      <section className="account-story">
        <a href="/" className="account-brand">
          {title}
          <span>✳</span>
        </a>
        <div>
          <p className="account-eyebrow">A PLACE FOR YOUR EVERYDAY WORK</p>
          <h1>{description}</h1>
          <p>One account. Your records, wherever you sign in.</p>
        </div>
        <p className="account-footnote">
          Thoughtfully built. Ready when you are.
        </p>
      </section>
      <section className="account-card">
        <p className="account-eyebrow">
          {mode === "login" ? "WELCOME BACK" : "YOUR NEXT CHAPTER"}
        </p>
        <h2>
          {mode === "login" ? "Sign in to your account" : "Create your account"}
        </h2>
        <p>
          {mode === "login"
            ? "Pick up where you left off."
            : "Make room for the things that matter."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Your name
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={12}
              maxLength={128}
              aria-describedby="password-hint"
            />
          </label>
          <small id="password-hint">Use at least 12 characters.</small>
          {mode === "register" && (
            <label className="account-checkbox">
              <input
                type="checkbox"
                checked={demo}
                onChange={(e) => setDemo(e.target.checked)}
              />
              Start with sample records
            </label>
          )}
          {error && (
            <div className="account-error" role="alert">
              {error}
              <button type="button" onClick={() => void load()}>
                Reconnect
              </button>
            </div>
          )}
          <button className="account-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <p className="account-toggle">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountGate required");
  return value;
}

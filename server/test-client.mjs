export async function launch(factory, options = {}) {
  const app = factory({ databasePath: ":memory:", ...options });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    const jar = new Map();
    let csrf = "";
    return {
      async request(path, method = "GET", body, headers = {}) {
        const response = await fetch(origin + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
            "X-CSRF-Token": csrf,
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const raw of response.headers.getSetCookie()) {
          const part = raw.split(";")[0];
          const index = part.indexOf("=");
          jar.set(part.slice(0, index), part.slice(index + 1));
        }
        const result = await response.json();
        if (result.csrf) csrf = result.csrf;
        return {
          status: response.status,
          body: result,
          headers: response.headers,
        };
      },
      async register(email, name = "Test User", demo = false) {
        await this.request("/api/session");
        return this.request("/api/register", "POST", {
          name,
          email,
          password: "correct horse battery staple",
          demo,
        });
      },
      cookie: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    };
  }
  return { app, origin, client };
}

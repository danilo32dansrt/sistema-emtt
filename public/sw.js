/* Service worker do aplicativo de ponto: permite abrir o app sem internet.
   As marcações offline ficam guardadas no aparelho e são enviadas pelo app quando a conexão volta. */
const VERSAO = "ponto-v2";
const ESSENCIAIS = ["/ponto", "/ponto/historico", "/ponto/justificativas", "/manifest.webmanifest", "/icone.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Arquivos estáticos do Next: cache primeiro
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".svg")) {
    evento.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((resp) => {
        const copia = resp.clone();
        caches.open(VERSAO).then((c) => c.put(req, copia));
        return resp;
      })),
    );
    return;
  }

  // Páginas do ponto: rede primeiro, cache se estiver sem internet
  if (req.mode === "navigate" && url.pathname.startsWith("/ponto")) {
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/ponto"))),
    );
  }
});

/* Notificações no celular (lembretes do ponto, DAE, pedidos de ajuste) */
self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { titulo: "Aviso", texto: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "Aviso", {
      body: dados.texto || "",
      icon: "/icone.svg",
      badge: "/icone.svg",
      tag: dados.tag,
      data: { link: dados.link || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const link = (evento.notification.data && evento.notification.data.link) || "/";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ("focus" in j) {
          j.navigate(link).catch(() => undefined);
          return j.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});

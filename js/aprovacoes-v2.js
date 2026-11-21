// =============================================================================
// aprovacoes-v2.js: nova tela de Aprovações do cliente.
// Abas Feed / Reels de teste / Stories, lista lateral do mês, grade 3 colunas e
// visualizador com carrossel deslizante (setas, pontinhos, arrastar, teclado).
// Carregar DEPOIS de cliente.js. Substitui TELAS_CLIENTE.aprovacoes e abrirViewer.
// Grava SÓ em "aprovacoes" (o banco faz o resto), igual à tela antiga.
// =============================================================================
(function () {
"use strict";
const P = window.__portal, R = P.R;
const { S, $, $$, esc, hojeISO, mesAtual, avisar, erroAmigavel } = P;
const { D, STATUS, tagS, nomeFormato, fmtDiaLongo, linkSeguro, navMes, TELAS_CLIENTE, rotear, rodadas, usadasRodadas } = R;

const CSS = `
.av2{--ameixa:#6E2E55;--ameixa-suave:#F4E8EF;--ameixa-escura:#3B1F30;--ease:cubic-bezier(.22,.61,.36,1);display:grid;grid-template-columns:270px minmax(0,1fr);gap:18px;align-items:start}
.av2 *:focus-visible,.av2v *:focus-visible{outline:2px solid #6E2E55;outline-offset:2px}
.av2-lat{background:var(--papel,#FFFDF9);border:1px solid var(--linha,#E4D8C8);border-radius:14px;padding:10px;position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto}
.av2-lat-topo{display:none}
.av2-dia{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cinza,#7A6E66);padding:10px 8px 4px}
.av2-it{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;text-align:left;padding:6px 8px;border-radius:10px;font:inherit;font-size:13.5px;color:var(--tinta,#2B2420);cursor:pointer;transition:background .18s}
.av2-it:hover{background:var(--creme,#F7F1E8)}
.av2-it.ativo{background:var(--ameixa);color:#fff}
.av2-th{width:34px;height:34px;flex:none;border-radius:6px;background:#EFE5D6 center/cover;display:grid;place-items:center;font-size:11px;color:#fff}
.av2-th.reel{background-color:var(--ameixa-escura)}
.av2-th.story{background:repeating-linear-gradient(135deg,#EFE5D6 0 5px,#F7F1E8 5px 10px)}
.av2-n{width:24px;height:24px;flex:none;border-radius:50%;background:#EFE5D6;display:grid;place-items:center;font-size:11px;font-weight:700}
.av2-it.ativo .av2-n{background:#fff;color:var(--ameixa)}
.av2-ic{width:14px;text-align:center;font-size:12px;opacity:.8}
.av2-lb{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.av2-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--ambar,#E0A100)}
.av2-dot.ok{background:var(--verde,#4F7A55)}.av2-dot.aj{background:var(--terra,#B5562E)}
.av2-abas{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 14px}
.av2-abas button{font:inherit;font-weight:600;font-size:14px;border-radius:999px;padding:8px 16px;border:1px solid transparent;background:#EFE5D6;color:var(--tinta,#2B2420);cursor:pointer}
.av2-abas button.ativa{background:var(--ameixa);border-color:var(--ameixa);color:#fff}
.av2-abas span{opacity:.7;font-weight:500;margin-left:4px}
.av2-sec{background:var(--papel,#FFFDF9);border:1px solid var(--linha,#E4D8C8);border-radius:16px;padding:16px;margin-bottom:14px}
.av2-sec-topo{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.av2-sec-topo h3{margin:0}
.av2-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.av2-tile{position:relative;aspect-ratio:1/1;border:0;padding:0;margin:0;overflow:hidden;border-radius:4px;background:#EFE5D6;cursor:pointer;display:block;width:100%}
.av2-tile.story{aspect-ratio:9/16}
.av2-cam{position:absolute;inset:0;background:center/cover;transition:transform .35s var(--ease)}
.av2-ph{position:absolute;inset:0;display:flex;align-items:flex-end;padding:12px 12px 40px;font-family:var(--fonte-titulo);font-weight:700;font-size:clamp(12px,1.5vw,16px);line-height:1.2;text-align:left}
.av2-ph.reel{background:var(--ameixa-escura);color:#FFFDF9}
.av2-ph.story{background:repeating-linear-gradient(135deg,#EFE5D6 0 10px,#F7F1E8 10px 20px);color:var(--tinta,#2B2420)}
.av2-ver{position:absolute;inset:0;display:grid;place-items:center;background:rgba(36,22,30,0);opacity:0;transition:opacity .25s ease,background .25s ease}
.av2-ver span{background:rgba(255,253,249,.95);color:var(--ameixa-escura);border-radius:999px;padding:6px 16px;font-weight:700;font-size:13px}
.av2-tile:hover .av2-cam,.av2-tile:focus-visible .av2-cam{transform:scale(1.045)}
.av2-tile:hover .av2-ver,.av2-tile:focus-visible .av2-ver{opacity:1;background:rgba(36,22,30,.38)}
.av2-bn,.av2-bi{position:absolute;top:7px;min-width:26px;height:26px;padding:0 7px;border-radius:999px;background:rgba(43,36,32,.8);color:#FFFDF9;font-size:12px;font-weight:700;display:grid;place-items:center}
.av2-bn{left:7px}.av2-bi{right:7px}
.av2-st{position:absolute;left:7px;bottom:7px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#FFFDF9;color:var(--tinta,#2B2420);box-shadow:inset 0 0 0 2px var(--ambar,#E0A100)}
.av2-st.ok{background:var(--verde,#4F7A55);color:#fff;box-shadow:none}.av2-st.aj{background:var(--terra,#B5562E);color:#fff;box-shadow:none}
.av2-lote{font:inherit;font-weight:600;font-size:14px;border-radius:999px;padding:8px 16px;cursor:pointer;border:1px solid var(--ameixa);background:var(--ameixa);color:#fff}
.av2-lote.feito{border-color:var(--verde,#4F7A55);background:#DDEBDD;color:#2f5535}
.av2v{position:fixed;inset:0;z-index:80;background:rgba(36,22,30,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:clamp(8px,3vw,32px)}
.av2v-box{position:relative;width:100%;max-width:1020px;max-height:100%;overflow:auto;background:var(--papel,#FFFDF9);border-radius:18px;box-shadow:0 24px 60px rgba(20,10,16,.35);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,1fr)}
.av2v-box.vert{max-width:880px;grid-template-columns:minmax(0,.9fr) minmax(300px,1fr)}
.av2v-x{position:absolute;right:10px;top:10px;z-index:3;width:38px;height:38px;border-radius:50%;border:0;background:rgba(43,36,32,.72);color:#FFFDF9;font-size:16px;cursor:pointer}
.av2v-mid{background:#1d1714;display:flex;align-items:center;justify-content:center;border-radius:18px 0 0 18px;overflow:hidden}
.av2v-car{position:relative;width:min(100%,calc((100vh - 64px)*.8));aspect-ratio:4/5;overflow:hidden;touch-action:pan-y;cursor:grab;user-select:none}
.av2v-trilho{display:flex;width:100%;height:100%;transition:transform .42s var(--ease,cubic-bezier(.22,.61,.36,1));will-change:transform}
.av2v-trilho.arrastando{transition:none}
.av2v-trilho img{flex:0 0 100%;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.av2v-cont{position:absolute;right:58px;top:12px;background:rgba(43,36,32,.72);color:#FFFDF9;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600}
.av2v-seta{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,253,249,.92);color:#2B2420;font-size:18px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.av2v-seta.e{left:10px}.av2v-seta.d{right:10px}.av2v-seta[hidden]{display:none}
.av2v-pts{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:6px}
.av2v-pts button{width:7px;height:7px;border-radius:999px;border:0;padding:0;cursor:pointer;background:rgba(255,253,249,.55);transition:width .3s var(--ease,ease)}
.av2v-pts button.at{width:18px;background:#FFFDF9}
.av2v-vert{position:relative;width:min(100%,calc((100vh - 64px)*.5625));aspect-ratio:9/16;overflow:hidden}
.av2v-play{position:absolute;inset:0;border:0;padding:28px;cursor:pointer;background:var(--ameixa-escura,#3B1F30) center/cover;color:#FFFDF9;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;text-align:left;gap:8px}
.av2v-play b{font-family:var(--fonte-titulo);font-size:clamp(20px,2.4vw,28px);line-height:1.15}
.av2v-play i{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:76px;height:76px;border-radius:50%;background:rgba(255,253,249,.95);color:#3B1F30;display:grid;place-items:center;font-size:26px;font-style:normal;padding-left:5px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.av2v-vert video,.av2v-vert iframe{width:100%;height:100%;border:0;display:block;background:#000;object-fit:contain}
.av2v-story{width:100%;height:100%;background:repeating-linear-gradient(135deg,#EFE5D6 0 12px,#F7F1E8 12px 24px) center/cover;display:flex;align-items:flex-end;padding:24px;font-family:var(--fonte-titulo);font-weight:700;font-size:24px;line-height:1.2;color:var(--tinta,#2B2420)}
.av2v-lado{padding:20px 20px 16px;display:flex;flex-direction:column;gap:12px;min-width:0}
.av2v-cab{padding-right:40px}
.av2v-rot{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cinza,#7A6E66)}
.av2v-leg{white-space:pre-wrap;font-size:14.5px;line-height:1.55;max-height:38vh;overflow:auto}
.av2v-leg .hs{color:var(--ameixa,#6E2E55);font-weight:600}
.av2v-dec{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding-top:8px;border-top:1px solid var(--linha,#E4D8C8)}
.av2v-dec .btn.primario{background:#6E2E55;border-color:#6E2E55}
.av2v-nav{display:flex;justify-content:space-between}
.av2v-nav button{border:0;background:none;color:#6E2E55;font:inherit;font-weight:600;font-size:13px;cursor:pointer;padding:4px 0}
.av2v-nav button:disabled{opacity:.35;cursor:default}
@media (max-width:820px){
  .av2{grid-template-columns:1fr}
  .av2-lat{position:sticky;top:60px;z-index:5;max-height:none;padding:6px 10px}
  .av2-lat-topo{display:flex;justify-content:space-between;align-items:center}
  .av2-lat-lista{display:none;max-height:60vh;overflow:auto}
  .av2-lat.aberta .av2-lat-lista{display:block}
  .av2v-box,.av2v-box.vert{grid-template-columns:1fr}
  .av2v-mid{border-radius:18px 18px 0 0}
  .av2v-leg{max-height:none}
}
@media (prefers-reduced-motion:reduce){.av2 *,.av2v *{transition:none!important}}`;
if (!document.getElementById("css-aprov-v2")) { const s = document.createElement("style"); s.id = "css-aprov-v2"; s.textContent = CSS; document.head.appendChild(s); }

const ICO = { carrossel: "⧉", reels: "▶", post: "▢", stories: "◌" };
const NOME = { carrossel: "Carrossel", reels: "Reel de teste", post: "Imagem", stories: "Story" };
const cat = (p) => (p.formato === "reels" ? "reels" : p.formato === "stories" ? "stories" : "feed");
const curto = (t) => String(t || "").replace(/^(Reels de teste \d+ · [^·]+ · |Story · )/, "").split(/[:.?!]/)[0].split(" ").slice(0, 3).join(" ");
const driveId = (u) => ((String(u || "").match(/\/d\/([\w-]+)/) || [])[1] || "");
const legHtml = (t) => esc(t || "").replace(/([#@][\wÀ-ú.]+)/g, '<span class="hs">$1</span>');
const stCls = (p) => (p.status === "aprovado" || p.status === "agendado" || p.status === "publicado" ? "ok" : p.status === "ajuste" ? "aj" : "");
const stTxt = (p) => (stCls(p) === "ok" ? "✓ Aprovado" : stCls(p) === "aj" ? "Ajuste pedido" : p.status === "aprovacao" ? "Aprovar" : (STATUS[p.status] || [p.status])[0]);
let ESTADO = { aba: "feed" };

async function midiasDe(p) {
  const ms = Array.isArray(p.midias) ? p.midias : [];
  return (await Promise.all(ms.map(async (m) => ({ tipo: m.tipo, src: m.src || m.url || (m.caminho ? await D.urlArquivo("midias", m.caminho).catch(() => "") : "") })))).filter((m) => m.src);
}

TELAS_CLIENTE.aprovacoes = async (el, args) => {
  const c = P.clienteAtual(), mes = args && /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : mesAtual(), nv = navMes(mes);
  const ps = await D.lista("posts", { ordem: "data", gte: { data: nv.ini }, lte: { data: nv.fim }, eq: { cliente_id: c.id, visivel_cliente: true } });
  const cont = { feed: 0, reels: 0, stories: 0 };
  ps.forEach((p) => { p._cat = cat(p); p._num = String(++cont[p._cat]).padStart(2, "0"); p._lbl = curto(p.tema); });
  const [mids, versoes] = await Promise.all([
    Promise.all(ps.map(midiasDe)),
    ps.length ? D.lista("post_versoes", { eq: { cliente_id: c.id }, in: { post_id: ps.map((p) => p.id) }, ordem: "created_at" }) : Promise.resolve([]),
  ]);
  ps.forEach((p, i) => { p._mid = mids[i]; p._img = mids[i].filter((m) => m.tipo !== "video"); p._vid = mids[i].find((m) => m.tipo === "video"); p._capa = (p._img[0] || {}).src || ""; p._versoes = versoes.filter((v) => v.post_id === p.id); });
  if (!ps.some((p) => p._cat === ESTADO.aba)) ESTADO.aba = ps.length ? ps[0]._cat : "feed";
  const pend = ps.filter((p) => p.status === "aprovacao");
  const prazo = pend.map((p) => p.prazo_aprovacao).filter(Boolean).sort()[0] || null;
  const dias = [...new Set(ps.map((p) => p.data))];
  const fundo = (p) => (p._capa ? `background-image:url('${esc(p._capa)}')` : "");
  const tile = (p) => `<button class="av2-tile ${p._cat === "stories" ? "story" : ""}" data-ver="${esc(p.id)}" aria-label="${esc(NOME[p.formato] + " " + p._num + ": " + p.tema)}">
      <span class="av2-cam" style="${fundo(p)}">${p._capa ? "" : `<span class="av2-ph ${p._cat === "reels" ? "reel" : "story"}">${esc(p.tema.replace(/^(Reels de teste \d+ · [^·]+ · |Story · )/, ""))}</span>`}</span>
      <span class="av2-ver"><span>ver</span></span><span class="av2-bn">${p._num}</span><span class="av2-bi" aria-hidden="true">${ICO[p.formato] || ""}</span>
      <span class="av2-st ${stCls(p)}">${esc(stTxt(p))}</span></button>`;
  const secoes = () => {
    const l = ps.filter((p) => p._cat === ESTADO.aba);
    if (!l.length) return `<div class="vazio">Nada nesta aba neste mês.</div>`;
    if (ESTADO.aba === "feed") return `<div class="av2-sec"><div class="av2-grade">${l.slice().reverse().map(tile).join("")}</div><div class="muted" style="margin-top:10px">O feed mostra o post mais novo primeiro, como no Instagram.</div></div>`;
    if (ESTADO.aba === "stories") return `<div class="av2-sec"><div class="av2-grade">${l.map(tile).join("")}</div></div>`;
    return dias.map((d) => { const r = l.filter((p) => p.data === d); if (!r.length) return "";
      const abertos = r.filter((p) => p.status === "aprovacao");
      return `<div class="av2-sec"><div class="av2-sec-topo"><div><h3>${esc(fmtDiaLongo(d))}</h3><div class="muted">${r.length} reels de teste · ${r.length - abertos.length} respondido(s)</div></div>
        ${abertos.length ? `<button class="av2-lote" data-lote="${esc(d)}">Aprovar os ${abertos.length} do dia</button>` : `<button class="av2-lote feito" disabled>✓ Dia respondido</button>`}</div>
        <div class="av2-grade">${r.map(tile).join("")}</div></div>`; }).join("");
  };
  const lista = () => dias.map((d) => `<div class="av2-dia">${esc(R.fmtDataCurta(d))}</div>${ps.filter((p) => p.data === d).map((p) => `<button class="av2-it" data-ver="${esc(p.id)}" data-it="${esc(p.id)}">
      <span class="av2-th ${p._capa ? "" : p._cat === "reels" ? "reel" : "story"}" style="${fundo(p)}">${!p._capa && p._cat === "reels" ? "▶" : ""}</span><span class="av2-n">${p._num}</span>
      <span class="av2-ic" aria-hidden="true">${ICO[p.formato] || ""}</span><span class="av2-lb">${esc(p._lbl)}</span><span class="av2-dot ${stCls(p)}"></span></button>`).join("")}`).join("");
  const abas = [["feed", "Feed"], ["reels", "Reels de teste"], ["stories", "Stories"]].filter(([k]) => ps.some((p) => p._cat === k));
  const desenhar = () => {
    el.innerHTML = `<h1>Aprovações</h1><p class="sub">Toque em um conteúdo para ver completo, ler a legenda e decidir.</p>
      <div class="topo-aprov"><div class="cartao"><div class="muted">Esperando você</div><b class="grande">${pend.length} conteúdo(s)</b></div>
        <div class="cartao"><div class="muted">Prazo de aprovação</div><b class="grande">${prazo ? esc(R.fmtDataCurta(prazo)) : "Nada pendente"}</b></div>
        <div class="cartao"><div class="muted">${esc(nv.nome)}</div><div class="linha"><a class="btn pequeno" href="#/aprovacoes/${nv.ant}">Mês anterior</a><a class="btn pequeno" href="#/aprovacoes/${nv.prox}">Próximo mês</a></div></div></div>
      <div class="av2"><aside class="av2-lat" id="av2-lat"><div class="av2-lat-topo"><b>${esc(c.nome)}</b><button class="btn pequeno" id="av2-menu" aria-expanded="false">☰ Posts do mês</button></div>
        <div class="av2-lat-lista">${lista() || `<div class="muted">Nenhum conteúdo neste mês.</div>`}</div></aside>
      <div><div class="av2-abas" role="tablist">${abas.map(([k, n]) => `<button role="tab" aria-selected="${ESTADO.aba === k}" class="${ESTADO.aba === k ? "ativa" : ""}" data-aba="${k}">${n}<span>${ps.filter((p) => p._cat === k && p.status === "aprovacao").length}</span></button>`).join("")}</div>
        ${secoes()}</div></div>`;
    $$("[data-aba]", el).forEach((b) => b.onclick = () => { ESTADO.aba = b.dataset.aba; desenhar(); });
    $$("[data-ver]", el).forEach((b) => b.onclick = () => { $("#av2-lat", el).classList.remove("aberta"); abrirViewer(ps, b.dataset.ver); });
    $("#av2-menu", el).onclick = (ev) => { const a = $("#av2-lat", el).classList.toggle("aberta"); ev.currentTarget.setAttribute("aria-expanded", a); };
    $$("[data-lote]", el).forEach((b) => b.onclick = () => aprovarLote(ps.filter((p) => p._cat === "reels" && p.data === b.dataset.lote && p.status === "aprovacao"), b));
  };
  desenhar();
};

async function aprovarLote(lista, bt) {
  if (!lista.length) return;
  bt.disabled = true; bt.textContent = "Aprovando...";
  try {
    for (const p of lista) await D.inserir("aprovacoes", { post_id: p.id, cliente_id: p.cliente_id, decisao: "aprovado", comentario: null, trecho: null, autor_id: S.usuario.id });
    avisar(`${lista.length} reels aprovados. A social media foi avisada.`, "ok"); rotear();
  } catch (e) { avisar(erroAmigavel(e), "erro"); rotear(); }
}

let teclas = null;
function fecharViewer() { const v = $("#av2v"); if (v) v.remove(); document.body.style.overflow = ""; if (teclas) document.removeEventListener("keydown", teclas); teclas = null; }

function abrirViewer(ps, id) {
  fecharViewer();
  const p = ps.find((x) => x.id === id); if (!p) return;
  const c = P.clienteAtual(), lista = ps.filter((x) => x._cat === p._cat), idx = lista.findIndex((x) => x.id === p.id);
  const imgs = p._img || [], n = imgs.length, pode = p.status === "aprovacao", usadas = usadasRodadas(p._versoes || []);
  const vert = p._cat !== "feed", did = driveId(p.link_drive);
  let media = "";
  if (p.formato === "reels") media = `<div class="av2v-vert" id="av2v-vid"><button class="av2v-play" id="av2v-play" style="${p._capa ? `background-image:url('${esc(p._capa)}')` : ""}" aria-label="Reproduzir vídeo">
      <span class="muted" style="color:#FFFDF9;opacity:.75;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Reel de teste</span><b>${esc(p.tema.replace(/^Reels de teste \d+ · [^·]+ · /, ""))}</b><i>▶</i></button></div>`;
  else if (p.formato === "stories" && !n) media = `<div class="av2v-vert"><div class="av2v-story">${esc(p.tema.replace(/^Story · /, ""))}</div></div>`;
  else if (n) media = `<div class="av2v-car" id="av2v-car" style="${vert ? "aspect-ratio:9/16;width:min(100%,calc((100vh - 64px)*.5625))" : ""}"><div class="av2v-trilho" id="av2v-tr">${imgs.map((m, k) => `<img src="${esc(m.src)}" alt="Slide ${k + 1} de ${n}" draggable="false">`).join("")}</div>
      ${n > 1 ? `<span class="av2v-cont" id="av2v-cont">1/${n}</span><button class="av2v-seta e" id="av2v-e" aria-label="Slide anterior" hidden>←</button><button class="av2v-seta d" id="av2v-d" aria-label="Próximo slide">→</button>
      <div class="av2v-pts">${imgs.map((_, k) => `<button data-pt="${k}" aria-label="Ir para o slide ${k + 1}" class="${k ? "" : "at"}"></button>`).join("")}</div>` : ""}</div>`;
  else media = `<div class="av2v-vert"><div class="av2v-story" style="background:#3B1F30;color:#FFFDF9">${esc(p.tema)}</div></div>`;
  const v = document.createElement("div");
  v.className = "av2v"; v.id = "av2v"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", p.tema || "Conteúdo");
  v.innerHTML = `<div class="av2v-box ${vert ? "vert" : ""}"><button class="av2v-x" id="av2v-x" aria-label="Fechar">✕</button>
    <div class="av2v-mid">${media}</div>
    <div class="av2v-lado"><div class="av2v-cab"><b>${esc(NOME[p.formato] || nomeFormato(p.formato))} ${p._num}</b><div class="muted">${esc(fmtDiaLongo(p.data))} · Instagram${p.versao > 1 ? " · versão " + p.versao : ""}</div></div>
      <div>${tagS(p.status)}</div>
      ${p.mudancas && pode ? `<div class="faixa alerta" style="margin:0">O que mudou nesta versão: ${esc(p.mudancas)}</div>` : ""}
      <div><div class="av2v-rot">${p.formato === "stories" ? "Texto do story" : "Legenda"}</div><div class="av2v-leg">${legHtml(p.formato === "stories" && !p.legenda ? textoStory(p.roteiro) : p.legenda) || `<span class="muted">Legenda em preparação.</span>`}</div></div>
      ${linkSeguro(p.link_drive) ? `<a href="${esc(p.link_drive)}" target="_blank" rel="noopener" style="font-weight:600;font-size:13px">Baixar no Google Drive ↗</a>` : ""}
      <div class="av2v-dec" id="av2v-dec">${pode ? `<div class="linha"><button class="btn primario" id="av2v-ok">Aprovar</button><button class="btn" id="av2v-aj">Pedir ajuste</button></div>
        <div class="muted" style="font-size:12.5px">${usadas} de ${rodadas(c)} rodadas de ajuste usadas neste conteúdo.</div>` : `<div class="muted">${p.status === "ajuste" ? "Seu pedido de ajuste foi recebido. A nova versão chega aqui." : "Nada para decidir neste conteúdo."}</div>`}
        <div class="av2v-nav"><button id="av2v-ant" ${idx <= 0 ? "disabled" : ""}>‹ Anterior</button><button id="av2v-prox" ${idx >= lista.length - 1 ? "disabled" : ""}>Próximo ›</button></div></div>
    </div></div>`;
  document.body.appendChild(v);
  document.body.style.overflow = "hidden";
  const foco = document.activeElement;
  $("#av2v-x", v).focus();
  const fechar = () => { fecharViewer(); if (foco && foco.focus) foco.focus(); };
  $("#av2v-x", v).onclick = fechar;
  v.onclick = (ev) => { if (ev.target === v) fechar(); };
  if ($("#av2v-ant", v)) $("#av2v-ant", v).onclick = () => idx > 0 && abrirViewer(ps, lista[idx - 1].id);
  if ($("#av2v-prox", v)) $("#av2v-prox", v).onclick = () => idx < lista.length - 1 && abrirViewer(ps, lista[idx + 1].id);
  if (pode) { $("#av2v-ok", v).onclick = () => decidir(p, "aprovado"); $("#av2v-aj", v).onclick = () => formAjuste(p, ps); }

  let i = 0;
  const tr = $("#av2v-tr", v), car = $("#av2v-car", v);
  const ir = (k) => { if (!tr) return; i = Math.max(0, Math.min(n - 1, k)); tr.style.transform = `translate3d(${-i * 100}%,0,0)`;
    if ($("#av2v-cont", v)) $("#av2v-cont", v).textContent = `${i + 1}/${n}`;
    if ($("#av2v-e", v)) $("#av2v-e", v).hidden = i === 0; if ($("#av2v-d", v)) $("#av2v-d", v).hidden = i === n - 1;
    $$("[data-pt]", v).forEach((b) => b.classList.toggle("at", Number(b.dataset.pt) === i)); };
  if (n > 1) {
    $("#av2v-e", v).onclick = (ev) => { ev.stopPropagation(); ir(i - 1); };
    $("#av2v-d", v).onclick = (ev) => { ev.stopPropagation(); ir(i + 1); };
    $$("[data-pt]", v).forEach((b) => b.onclick = () => ir(Number(b.dataset.pt)));
    let x0 = null, dx = 0;
    car.addEventListener("pointerdown", (ev) => { if (ev.button > 0 || ev.target.closest("button")) return; x0 = ev.clientX; dx = 0; tr.classList.add("arrastando"); car.setPointerCapture(ev.pointerId); });
    car.addEventListener("pointermove", (ev) => { if (x0 === null) return; dx = ev.clientX - x0; if ((i === 0 && dx > 0) || (i === n - 1 && dx < 0)) dx *= .3; tr.style.transform = `translate3d(calc(${-i * 100}% + ${dx}px),0,0)`; });
    const solta = () => { if (x0 === null) return; x0 = null; tr.classList.remove("arrastando"); const lim = Math.min(80, car.offsetWidth * .15); ir(dx < -lim ? i + 1 : dx > lim ? i - 1 : i); };
    car.addEventListener("pointerup", solta); car.addEventListener("pointercancel", solta);
  }
  if (p.formato === "reels") $("#av2v-play", v).onclick = () => {
    $("#av2v-vid", v).innerHTML = p._vid ? `<video src="${esc(p._vid.src)}" controls autoplay playsinline></video>`
      : did ? `<iframe src="https://drive.google.com/file/d/${esc(did)}/preview" allow="autoplay" title="Vídeo"></iframe>`
      : `<div class="av2v-story" style="background:#3B1F30;color:#FFFDF9;font-size:16px">O vídeo ainda não foi anexado.</div>`;
  };
  teclas = (ev) => {
    if (ev.target && /TEXTAREA|INPUT|SELECT/.test(ev.target.tagName)) return;
    if (ev.key === "Escape") fechar();
    else if (ev.key === "ArrowRight") { ev.preventDefault(); n > 1 ? ir(i + 1) : (idx < lista.length - 1 && abrirViewer(ps, lista[idx + 1].id)); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); n > 1 ? ir(i - 1) : (idx > 0 && abrirViewer(ps, lista[idx - 1].id)); }
  };
  document.addEventListener("keydown", teclas);
}

function textoStory(r) { const m = String(r || "").match(/Texto em escada:\s*([\s\S]*?)(\n[A-ZÀ-Ú][\wÀ-ú ()]+:|$)/); return m ? m[1].trim() : ""; }

function formAjuste(p, ps) {
  const n = (p._img || []).length;
  const onde = p.formato === "reels" ? ["Início do vídeo", "Meio do vídeo", "Final do vídeo"] : p.formato === "carrossel" ? ["Capa", ...[...Array(Math.max(1, n - 1))].map((_, k) => "Slide " + (k + 2))] : p.formato === "stories" ? ["Story"] : ["Arte"];
  const caixa = $("#av2v-dec");
  caixa.innerHTML = `<form id="av2-aj"><label style="margin-top:0">O que precisa mudar?</label><select id="aj-tipo"><option>Ajuste na legenda</option><option>Ajuste no design</option><option>Ajuste no vídeo</option><option>Informação incorreta</option><option>Mudança na abordagem</option><option>Outro</option></select>
    <label>Onde (opcional)</label><select id="aj-onde"><option value="">O conteúdo todo</option>${onde.map((x) => `<option>${esc(x)}</option>`).join("")}<option>Legenda</option></select>
    <label>Descreva exatamente (obrigatório)</label><textarea id="aj-desc" required placeholder="Ex.: trocar a frase do slide 3."></textarea>
    <div class="linha" style="margin-top:10px"><button class="btn primario">Enviar pedido</button><button type="button" class="btn" id="aj-voltar">Voltar</button></div></form>`;
  $("#aj-desc").focus();
  $("#aj-voltar").onclick = () => abrirViewer(ps, p.id);
  $("#av2-aj").onsubmit = (ev) => {
    ev.preventDefault();
    const d = $("#aj-desc").value.trim();
    if (d.length < 15) { avisar("Descreva com um pouco mais de detalhe (mínimo 15 caracteres)."); return; }
    decidir(p, "ajuste", `${$("#aj-tipo").value}: ${d}`, $("#aj-onde").value || null);
  };
}

async function decidir(p, decisao, comentario = null, trecho = null) {
  try {
    await D.inserir("aprovacoes", { post_id: p.id, cliente_id: p.cliente_id, decisao, comentario, trecho, autor_id: S.usuario.id });
    fecharViewer();
    avisar(decisao === "aprovado" ? "Aprovado. A social media foi avisada." : "Pedido enviado. A nova versão chega aqui para você aprovar.", "ok");
    rotear();
  } catch (e) { avisar(erroAmigavel(e), "erro"); }
}

P.R.cliente = Object.assign(P.R.cliente || {}, { abrirViewer });
})();

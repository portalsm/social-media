// =============================================================================
// cliente.js: telas do Portal do Cliente (reforma).
// O cliente só vê o que é dele (RLS do banco). Mesmo assim, as consultas filtram
// por cliente e por "visivel_cliente", para o modo de teste e o "Ver como cliente".
// Regras: o pedido de ajuste grava SÓ em "aprovacoes" (o banco cria a versão, o
// chamado, a tarefa e o aviso); a alteração de briefing grava SÓ os campos que mudaram.
// =============================================================================
(function () {
"use strict";
const P = window.__portal;
const R = P.R;
const { S, ROTAS, $, $$, esc, hojeISO, mesAtual, somarDias, fmtData, nomeMes, avisar, erroAmigavel, abrirModal, fecharModal,
  clienteAtual, PERGUNTAS_ONBOARDING, tempoRelativo } = P;
const { D, STATUS, CH_SIMPLES, CH_ABERTOS, IDEIA_ST, ICO_FORMATO, tag, tagS, nomeFormato, prazoDias, rodadas, usadasRodadas,
  fmtDiaLongo, linkSeguro, gradiente, capaUrl, gradeMes, navMes, TELAS_CLIENTE, rotear, atualizarContadores } = R;

const mesDe = (args) => (args && /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : mesAtual());
const cid = () => clienteAtual().id;
const postsVisiveis = (f = {}) => D.lista("posts", Object.assign({ ordem: "data" }, f, { eq: Object.assign({ cliente_id: cid(), visivel_cliente: true }, f.eq || {}) }));

// ----------------------------------------------------------------- pedidos de gravação (Início e Solicitações)
async function blocoGravacoes() {
  const briefs = (await D.lista("briefings", { eq: { cliente_id: cid() }, ordem: "prazo" })).filter((b) => b.status !== "enviado");
  if (!briefs.length) return { html: "", ligar: () => null };
  const ids = briefs.map((b) => b.post_id).filter(Boolean);
  const posts = ids.length ? await postsVisiveis({ in: { id: ids } }) : [];
  const temaDe = (b) => ((posts.find((p) => p.id === b.post_id) || {}).tema || "Vídeo para gravar");
  const html = `<div class="cartao"><h3>Para você gravar</h3><div class="lista">${briefs.map((b) => `<div class="entre"><span><b>${esc(temaDe(b))}</b><br>
    <span class="muted">${b.prazo ? "até " + esc(fmtData(b.prazo)) : "sem prazo"}${b.referencia ? " · " + esc(b.referencia) : ""}</span></span>
    <span class="linha">${b.status === "gravado" ? tag("gravado, falta enviar", "t-ambar") : ""}<button class="btn primario pequeno" data-gravacao="${esc(b.id)}">Ver roteiro</button></span></div>`).join("")}</div></div>`;
  const ligar = (raiz) => $$("[data-gravacao]", raiz).forEach((bt) => bt.onclick = () => abrirGravacao(briefs.find((x) => x.id === bt.dataset.gravacao), temaDe));
  return { html, ligar };
}
function abrirGravacao(b, temaDe) {
  const c = clienteAtual();
  const ck = Array.isArray(b.checklist) ? b.checklist : [];
  const m = abrirModal(temaDe(b), `<p class="muted">Prazo: ${b.prazo ? esc(fmtData(b.prazo)) : "sem prazo"}${b.referencia ? " · Onde gravar: " + esc(b.referencia) : ""}</p>
    ${ck.length ? `<b>Checklist</b>${ck.map((x) => `<label class="check"><input type="checkbox"> ${esc(x)}</label>`).join("")}` : ""}
    <label>Teleprompter</label><div class="tele-previa">${esc(b.texto_teleprompter || "O roteiro chega aqui.")}</div>
    <div class="linha" style="margin-top:8px"><button class="btn" id="gv-tp">▶ Abrir teleprompter</button>${linkSeguro(c.pasta_envio_url) ? `<a class="btn" href="${esc(c.pasta_envio_url)}" target="_blank" rel="noopener">Abrir pasta de envio ↗</a>` : ""}</div>
    <label>Link da pasta com os vídeos gravados</label><input type="url" id="gv-link" placeholder="https://drive.google.com/..." value="${esc(b.link_envio || "")}">
    <div class="modal-rodape"><button class="btn" data-fechar>Fechar</button>${b.status !== "gravado" ? `<button class="btn" id="gv-gravei">Já gravei</button>` : ""}<button class="btn primario" id="gv-enviei">Enviei os vídeos</button></div>`);
  $("#gv-tp", m).onclick = () => P.teleprompter(b.texto_teleprompter || "");
  const salvar = async (status) => {
    const link = $("#gv-link", m).value.trim();
    if (link && !linkSeguro(link)) { avisar("Cole um link que comece com https://", "erro"); return; }
    try {
      await D.atualizar("briefings", { id: b.id }, status === "enviado" ? { status, link_envio: link || null } : { status });
      fecharModal(); avisar(status === "enviado" ? "Enviado! A social media vai ver na tela dela." : "Anotado: gravado.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#gv-gravei", m)) $("#gv-gravei", m).onclick = () => salvar("gravado");
  $("#gv-enviei", m).onclick = () => salvar("enviado");
}

/** Nova solicitação (vira chamado com origem "solicitacao"; o banco avisa a social media). */
function novaSolicitacao(categoria = "", texto = "") {
  const cats = ["Solicitação relacionada ao atendimento", "Solicitação de informação"];
  const m = abrirModal("Nova solicitação", `<form id="f-sol"><label>Assunto</label><select id="so-cat">${cats.map((x) => `<option ${x === categoria ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
    <label>Descrição</label><textarea id="so-desc" required>${esc(texto)}</textarea>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Enviar</button></div></form>`);
  $("#f-sol", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const desc = $("#so-desc", m).value.trim();
    if (desc.length < 5) { avisar("Conte um pouco mais sobre o que você precisa."); return; }
    try {
      await D.inserir("chamados", { cliente_id: cid(), origem: "solicitacao", categoria: $("#so-cat", m).value, descricao: desc, prioridade: "media", status: "novo",
        historico: [{ em: R.agoraISO(), o: "Aberta pelo cliente" }] });
      fecharModal(); avisar("Solicitação enviada.", "ok"); if (location.hash.startsWith("#/solicitacoes")) rotear(); else location.hash = "#/solicitacoes";
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- Início
TELAS_CLIENTE.inicio = async (el) => {
  const c = clienteAtual(), hoje = hojeISO();
  const [posts, notifs, agenda, rels, chamados, estrs, ob, grav] = await Promise.all([
    postsVisiveis(),
    D.lista("notificacoes", { eq: { para: "cliente", cliente_id: c.id }, ordem: "-created_at", limite: 4 }),
    D.lista("agenda", { eq: { cliente_id: c.id, compartilhado: true }, gte: { data: hoje }, ordem: "data", limite: 5 }),
    D.lista("relatorios", { eq: { cliente_id: c.id, publicado: true }, ordem: "-mes", limite: 3 }),
    D.lista("chamados", { eq: { cliente_id: c.id, visivel_cliente: true }, in: { status: CH_ABERTOS } }),
    D.lista("estrategias_mes", { eq: { cliente_id: c.id, status: "enviada" }, ordem: "mes" }),
    D.um("onboarding", { eq: { cliente_id: c.id } }),
    blocoGravacoes(),
  ]);
  const prox = posts.filter((p) => p.data >= hoje && ["aprovado", "agendado", "planejado", "aprovacao"].includes(p.status));
  const aguard = posts.filter((p) => p.status === "aprovacao"), aprov = posts.filter((p) => ["aprovado", "agendado"].includes(p.status));
  const nomeM = (m) => { const n = nomeMes(m); return n; };
  el.innerHTML = `
    ${!ob || ob.status === "rascunho" ? `<div class="faixa alerta">Falta terminar o seu briefing (${ob ? ob.progresso || 0 : 0}% respondido). <a href="#/briefing">Responder agora</a></div>` : ""}
    ${estrs.map((e) => `<div class="cartao destaque-borda"><h3>Estratégia de ${esc(nomeM(e.mes))} para aprovar</h3>
      <p class="muted">${esc(e.resumo || "Entendimento, estratégia, calendário e próximos passos. A produção começa depois da sua aprovação.")}</p>
      <div class="linha">${linkSeguro(e.link_apresentacao) ? `<a class="btn" href="${esc(e.link_apresentacao)}" target="_blank" rel="noopener">Abrir apresentação ↗</a>` : ""}
        <button class="btn primario" data-estr-ok="${esc(e.id)}">Aprovar estratégia</button><button class="btn" data-estr-aj="${esc(e.id)}">Pedir ajuste</button></div></div>`).join("")}
    ${grav.html}
    <div class="cartao boas"><h2>Olá, equipe ${esc(c.nome)}!</h2>
      <div>Aqui você acompanha tudo o que foi planejado para a sua marca. ${aguard.length ? `Você tem <b>${aguard.length} conteúdo(s)</b> esperando a sua aprovação.` : "Nenhuma aprovação pendente agora."}</div>
      ${aguard.length ? `<div style="margin-top:10px"><a class="btn" href="#/aprovacoes">Ver aprovações</a></div>` : ""}</div>
    <div class="grid g4">
      <div class="kpi"><div class="n">${prox.length}</div><div class="l">Próximas publicações</div></div>
      <div class="kpi"><div class="n">${aguard.length}</div><div class="l">Aguardando aprovação</div></div>
      <div class="kpi"><div class="n">${aprov.length}</div><div class="l">Aprovados</div></div>
      <div class="kpi"><div class="n">${chamados.length}</div><div class="l">Solicitações em andamento</div></div>
    </div>
    <div class="grid g2 sec">
      <div class="cartao"><h3>Próximas publicações</h3><div class="lista">${prox.slice(0, 5).map((p) => `<div class="entre"><span><b>${esc(R.fmtDataCurta(p.data))}</b> ${esc(p.tema)}<br><span class="muted">${esc(nomeFormato(p.formato))}</span></span>${tagS(p.status)}</div>`).join("") || `<div class="muted">Nada agendado.</div>`}</div></div>
      <div class="cartao"><h3>Notificações importantes</h3><div class="lista">${notifs.map((n) => `<div>${n.lida ? "" : tag("nova", "t-terra")}${esc(n.texto)}<br><span class="muted">${esc(tempoRelativo(n.created_at))}</span></div>`).join("") || `<div class="muted">Sem notificações.</div>`}</div></div>
      <div class="cartao"><h3>Próximos compromissos</h3><div class="lista">${agenda.map((g) => `<div><b>${esc(fmtDiaLongo(g.data))}${g.hora ? ", " + esc(String(g.hora).slice(0, 5)) : ""}</b><br>${esc(g.titulo)}</div>`).join("") || `<div class="muted">Nenhum compromisso.</div>`}</div></div>
      <div class="cartao"><h3>Últimos relatórios</h3><div class="lista">${rels.map((r) => `<div class="entre"><span>${r.tipo === "quinzenal" ? "Análise quinzenal" : "Relatório"} de ${esc(nomeMes(r.mes))}</span><a class="btn pequeno" href="#/relatorios">Abrir</a></div>`).join("") || `<div class="muted">Ainda não há relatórios.</div>`}</div></div>
    </div>`;
  grav.ligar(el);
  $$("[data-estr-ok]", el).forEach((b) => b.onclick = () => responderEstrategia(b.dataset.estrOk, "aprovada"));
  $$("[data-estr-aj]", el).forEach((b) => b.onclick = () => {
    const m = abrirModal("Pedir ajuste na estratégia", `<label>O que você quer mudar?</label><textarea id="es-com" placeholder="Ex.: prefiro não falar de preço em dezembro."></textarea>
      <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="es-env">Enviar</button></div>`);
    $("#es-env", m).onclick = () => { const t = $("#es-com", m).value.trim(); if (t.length < 15) { avisar("Descreva com um pouco mais de detalhe (mínimo 15 caracteres)."); return; } responderEstrategia(b.dataset.estrAj, "ajuste", t); };
  });
};
async function responderEstrategia(id, status, comentario = null) {
  try {
    await D.atualizar("estrategias_mes", { id }, { status, respondida_em: R.agoraISO(), comentario_cliente: comentario });
    fecharModal(); avisar(status === "aprovada" ? "Estratégia aprovada. A produção do mês pode começar." : "Pedido de ajuste enviado.", "ok"); rotear();
  } catch (e) { avisar(erroAmigavel(e), "erro"); }
}

// ----------------------------------------------------------------- Calendário editorial
TELAS_CLIENTE.calendario = async (el, args) => {
  const mes = mesDe(args), nv = navMes(mes);
  const posts = await postsVisiveis({ gte: { data: nv.ini }, lte: { data: nv.fim } });
  el.innerHTML = `<h1>Calendário editorial</h1><p class="sub">Os conteúdos planejados para você, os que estão em aprovação e os já publicados.</p>
    <div class="linha" style="margin-bottom:12px">${["planejado", "aprovacao", "ajuste", "aprovado", "agendado", "publicado"].map(tagS).join("")}</div>
    <div class="cartao"><div class="entre" style="margin-bottom:10px"><a class="btn pequeno" href="#/calendario/${nv.ant}">Anterior</a><h3 style="margin:0">${esc(nv.nome)}</h3><a class="btn pequeno" href="#/calendario/${nv.prox}">Próximo</a></div>
      ${gradeMes(mes, posts)}</div>
    <p class="muted" style="margin-top:10px">A produção (edição de vídeo, criação de arte, roteiro) acontece nos bastidores e não aparece aqui.</p>`;
  $$("[data-post]", el).forEach((b) => b.onclick = async () => {
    const p = posts.find((x) => x.id === b.dataset.post);
    const capa = await capaUrl(p).catch(() => "");
    const m = abrirModal(p.tema || "Conteúdo", `<div class="linha" style="margin-bottom:8px">${tagS(p.status)}</div><div class="grid g2">
      <div class="prev" style="background:${capa ? `url('${esc(capa)}') center/cover` : gradiente(p.tema)}"><small>${esc(nomeFormato(p.formato))}</small>${capa ? "" : esc(p.tema)}</div>
      <div><table class="ficha">
        <tr><td class="muted">Data prevista</td><td>${esc(fmtDiaLongo(p.data))}</td></tr><tr><td class="muted">Rede social</td><td>${esc(p.rede === "instagram" || !p.rede ? "Instagram" : p.rede)}</td></tr>
        <tr><td class="muted">Formato</td><td>${esc(nomeFormato(p.formato))}</td></tr>${p.objetivo ? `<tr><td class="muted">Objetivo</td><td>${esc(p.objetivo)}</td></tr>` : ""}
        <tr><td class="muted">Legenda</td><td class="vleg">${esc(p.legenda || "") || `<span class="muted">Ainda em preparação</span>`}</td></tr>
        <tr><td class="muted">Publicação</td><td>${p.status === "publicado" ? (linkSeguro(p.link_publicado) ? `<a href="${esc(p.link_publicado)}" target="_blank" rel="noopener">Ver no Instagram ↗</a>` : "Publicado") : "Ainda não publicado"}</td></tr>
      </table></div></div>
      <div class="modal-rodape">${p.status === "aprovacao" ? `<a class="btn primario" href="#/aprovacoes/${esc(String(p.data).slice(0, 7))}" data-fechar>Ir para aprovação</a>` : ""}<button class="btn" data-fechar>Fechar</button></div>`);
    void m;
  });
};

// ----------------------------------------------------------------- Aprovações (feed + visualizador)
TELAS_CLIENTE.aprovacoes = async (el, args) => {
  const c = clienteAtual(), mes = mesDe(args), nv = navMes(mes);
  const ps = await postsVisiveis({ gte: { data: nv.ini }, lte: { data: nv.fim } });
  let n = 0;
  ps.forEach((p) => { p._num = p.formato === "stories" ? null : String(++n).padStart(2, "0"); });
  const [capas, versoes] = await Promise.all([
    Promise.all(ps.map((p) => capaUrl(p).catch(() => ""))),
    ps.length ? D.lista("post_versoes", { eq: { cliente_id: c.id }, in: { post_id: ps.map((p) => p.id) }, ordem: "created_at" }) : Promise.resolve([]),
  ]);
  ps.forEach((p, i) => { p._capa = capas[i]; p._versoes = versoes.filter((v) => v.post_id === p.id); });
  const feed = ps.filter((p) => p.formato !== "stories"), st = ps.filter((p) => p.formato === "stories");
  const pend = ps.filter((p) => p.status === "aprovacao");
  const prazoMin = pend.map((p) => p.prazo_aprovacao).filter(Boolean).sort()[0] || null;
  const dias = prazoMin ? Math.round((new Date(prazoMin + "T12:00:00") - new Date(hojeISO() + "T12:00:00")) / 864e5) : 0;
  const usadas = ps.reduce((s, p) => s + usadasRodadas(p._versoes), 0);
  const fundo = (p) => (p._capa ? `background:url('${esc(p._capa)}') center/cover` : `background:${gradiente(p.tema)}`);
  el.innerHTML = `<h1>Aprovações</h1><p class="sub">O seu mês do jeito que vai aparecer no feed, só com as capas. Toque em um post para ler a legenda, abrir o conteúdo completo no Google Drive e decidir.</p>
    <div class="topo-aprov">
      <div class="cartao"><div class="muted">Esperando você</div><b class="grande">${pend.length} conteúdo(s)</b></div>
      <div class="cartao"><div class="muted">Prazo de aprovação</div><b class="grande">${prazoMin ? `${esc(R.fmtDataCurta(prazoMin))} ${dias < 0 ? tag("atrasado", "t-verm") : tag(dias === 0 ? "é hoje" : "faltam " + dias + " dia(s)", "t-ambar")}` : "Nada pendente"}</b></div>
      <div class="cartao"><div class="muted">Rodadas de ajuste no mês</div><b class="grande">${usadas} usadas</b> <span class="muted">· até ${rodadas(c)} por conteúdo</span></div>
    </div>
    <div class="feedwrap">
      <aside class="feedlat"><h3>${esc(c.nome)}</h3><div class="muted">${esc(nv.nome)}</div>
        ${feed.map((p) => `<button class="it" data-ver="${esc(p.id)}"><span class="mini-ps" style="${fundo(p)}">${p._capa ? "" : p._num}</span><span><b>POST ${p._num}</b> · ${esc(nomeFormato(p.formato))}<br><span class="muted">${esc(R.fmtDataCurta(p.data))}${p.status === "aprovacao" ? " · aprovar" : ""}</span></span></button>`).join("") || `<div class="muted">Nenhum post neste mês.</div>`}
      </aside>
      <div class="cartao">
        <div class="perfil-ig"><div class="av">${esc((c.nome || "?").slice(0, 1))}</div><div><b>${esc(c.instagram || c.nome)}</b><div class="muted">${feed.length} posts no mês · ${st.length} sequência(s) de stories</div>
          <div class="linha" style="margin-top:6px">${tag("borda amarela = esperando aprovação", "t-ambar")}</div></div></div>
        ${st.length ? `<div class="stories">${st.map((p) => `<button class="st" data-ver="${esc(p.id)}"><span style="${fundo(p)}">${p._capa ? "" : esc(R.fmtDataCurta(p.data))}</span>${esc(String(p.tema || "").slice(0, 12))}</button>`).join("")}</div>` : ""}
        <div class="feed-ig">${feed.slice().reverse().map((p) => `<button class="tile ${p.status === "aprovacao" ? "pend" : ""}" style="${fundo(p)}" data-ver="${esc(p.id)}">
          <span class="num">POST ${p._num}</span><span class="ico-f">${esc(ICO_FORMATO[p.formato] || nomeFormato(p.formato))}</span>${p._capa ? "" : `<span class="tema">${esc(p.tema)}</span>`}
          <span class="st8">${esc((STATUS[p.status] || [p.status])[0])}</span><span class="ver">Ver</span></button>`).join("") || `<div class="muted" style="padding:20px;grid-column:1/-1">Nenhum post neste mês.</div>`}</div>
        <div class="entre" style="margin-top:12px"><a class="btn pequeno" href="#/aprovacoes/${nv.ant}">Mês anterior</a><span class="muted">O feed mostra o post mais novo primeiro, como no Instagram</span><a class="btn pequeno" href="#/aprovacoes/${nv.prox}">Próximo mês</a></div>
      </div>
    </div>`;
  $$("[data-ver]", el).forEach((b) => b.onclick = () => abrirViewer(ps, b.dataset.ver));
};

function fecharViewer() { const v = $("#viewer-ps"); if (v) v.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", teclaViewer); }
function teclaViewer(ev) { if (ev.key === "Escape") fecharViewer(); }
function legendaHtml(t) { return esc(t || "").replace(/([#@][\wÀ-ú.]+)/g, '<span class="hs">$1</span>'); }

function abrirViewer(ps, id) {
  fecharViewer();
  const c = clienteAtual();
  const p = ps.find((x) => x.id === id);
  const feed = ps.filter((x) => x.formato !== "stories"), idx = feed.findIndex((x) => x.id === p.id);
  const pode = p.status === "aprovacao", usadas = usadasRodadas(p._versoes);
  const o = p.formato === "reels" ? "o vídeo completo, com áudio e legendas na tela" : p.formato === "carrossel" ? "todos os slides em alta resolução" : p.formato === "stories" ? "a sequência completa de stories" : "a arte em alta resolução";
  const drive = p.status === "planejado" || !linkSeguro(p.link_drive)
    ? `<div class="drivebox"><b>Conteúdo completo</b><div class="muted">O link do Drive aparece aqui quando o post chegar para aprovação.</div></div>`
    : `<div class="drivebox"><b>Conteúdo completo</b><div class="muted">Para o portal ficar leve, a versão completa (${o}) está na pasta deste post no Google Drive.</div>
        <a class="btn primario drivebtn" href="${esc(p.link_drive)}" target="_blank" rel="noopener">Abrir pasta no Google Drive ↗</a><div class="muted" style="font-size:11.5px">Veja tudo antes de aprovar.</div></div>`;
  const v = document.createElement("div");
  v.className = "viewer"; v.id = "viewer-ps";
  v.innerHTML = `<div class="vbox"><button class="vfechar" aria-label="Fechar">✕</button>
    <div class="vmedia" style="${p._capa ? `background:#1d1714 url('${esc(p._capa)}') center/contain no-repeat` : `background:${gradiente(p.tema)}`}">${p._capa ? "" : `<div class="vslide"><small>Capa · ${esc(ICO_FORMATO[p.formato] || "")}</small>${esc(p.tema)}</div>`}
      <span class="vcont">Prévia leve: só a capa</span></div>
    <div class="vlado">
      <div class="entre"><b>${p._num ? "POST " + p._num : "Stories"} · ${esc(nomeFormato(p.formato))}</b>${tagS(p.status)}</div>
      <div class="muted">${esc(fmtDiaLongo(p.data))} · Instagram${p.objetivo ? " · objetivo: " + esc(p.objetivo) : ""}${p.versao > 1 ? " · versão " + p.versao : ""}</div>
      ${p.mudancas && p.status === "aprovacao" ? `<div class="faixa alerta" style="margin:0">O que mudou nesta versão: ${esc(p.mudancas)}</div>` : ""}
      ${drive}
      <div><label style="margin:0 0 4px">Legenda</label><div class="vleg">${legendaHtml(p.legenda) || `<span class="muted">Legenda em preparação.</span>`}</div></div>
      ${p._versoes.length ? `<div class="muted">Histórico: ${p._versoes.map((x) => "v" + x.versao + " " + esc(String(x.motivo || "").split(":")[0]) + " em " + esc(R.fmtDataCurta(x.created_at))).join(" · ")}</div>` : ""}
      <hr style="margin:4px 0">
      <div id="decisao">${pode ? `<div class="linha"><button class="btn primario" id="v-aprovar">Aprovar</button><button class="btn" id="v-ajuste">Pedir ajuste</button></div>
        <div class="muted" style="margin-top:6px">${usadas} de ${rodadas(c)} rodadas de ajuste usadas neste conteúdo. Sem resposta, não aprovamos sozinhos: mandamos um lembrete.</div>`
        : `<div class="muted">${p.status === "ajuste" ? "Seu pedido de ajuste foi recebido. A nova versão chega aqui para você aprovar." : p.status === "planejado" ? "Este post ainda está sendo produzido. Ele chega para aprovação quando estiver pronto." : "Nada para decidir neste post."}</div>`}</div>
      <div class="entre" style="margin-top:auto;padding-top:8px">${idx > 0 ? `<button class="btn pequeno" data-nav="${esc(feed[idx - 1].id)}">‹ Post anterior</button>` : "<span></span>"}${idx >= 0 && idx < feed.length - 1 ? `<button class="btn pequeno" data-nav="${esc(feed[idx + 1].id)}">Próximo post ›</button>` : ""}</div>
    </div></div>`;
  document.body.appendChild(v);
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", teclaViewer);
  v.onclick = (ev) => { if (ev.target === v) fecharViewer(); };
  $(".vfechar", v).onclick = fecharViewer;
  $$("[data-nav]", v).forEach((b) => b.onclick = () => abrirViewer(ps, b.dataset.nav));
  if (pode) {
    $("#v-aprovar", v).onclick = () => decidir(p, "aprovado");
    $("#v-ajuste", v).onclick = () => formAjuste(p, ps);
  }
}

function formAjuste(p, ps) {
  const n = Array.isArray(p.midias) ? p.midias.length : 0;
  const onde = p.formato === "reels" ? ["Início do vídeo", "Meio do vídeo", "Final do vídeo"]
    : p.formato === "carrossel" ? ["Capa", ...[...Array(Math.max(4, n - 1))].map((_, k) => "Slide " + (k + 2))] : p.formato === "stories" ? ["Primeiro story", "Stories do meio", "Último story"] : ["Arte"];
  const caixa = $("#decisao");
  caixa.innerHTML = `<form id="f-aj"><label style="margin-top:0">O que precisa mudar?</label><select id="aj-tipo"><option>Ajuste na legenda</option><option>Ajuste no design</option><option>Informação incorreta</option><option>Mudança na abordagem</option><option>Outro</option></select>
    <label>Onde (opcional)</label><select id="aj-onde"><option value="">O conteúdo todo</option>${onde.map((x) => `<option>${esc(x)}</option>`).join("")}<option>Legenda</option></select>
    <label>Descreva exatamente (obrigatório)</label><textarea id="aj-desc" required placeholder="Ex.: o preço certo é R$ 39. Trocar a foto da capa pela do kit vermelho."></textarea>
    <div class="contador" id="aj-cont">0 de 15 caracteres no mínimo</div>
    <label>Link de referência (opcional)</label><input type="url" id="aj-ref" placeholder="https://...">
    <div class="linha" style="margin-top:10px"><button class="btn primario">Enviar pedido</button><button type="button" class="btn" id="aj-voltar">Voltar</button></div></form>`;
  $("#aj-desc").oninput = () => { const k = $("#aj-desc").value.trim().length; $("#aj-cont").textContent = k >= 15 ? "ok" : `${k} de 15 caracteres no mínimo`; };
  $("#aj-voltar").onclick = () => abrirViewer(ps, p.id);
  $("#f-aj").onsubmit = (ev) => {
    ev.preventDefault();
    const desc = $("#aj-desc").value.trim(), ref = $("#aj-ref").value.trim();
    if (desc.length < 15) { avisar("Descreva com um pouco mais de detalhe (mínimo 15 caracteres)."); return; }
    if (ref && !linkSeguro(ref)) { avisar("O link de referência precisa começar com https://", "erro"); return; }
    decidir(p, "ajuste", `${$("#aj-tipo").value}: ${desc}${ref ? " Referência: " + ref : ""}`, $("#aj-onde").value || null);
  };
}

// Grava SÓ em "aprovacoes". O banco muda o status do post, guarda a versão, abre o chamado e a tarefa e avisa a social media.
async function decidir(p, decisao, comentario = null, trecho = null) {
  try {
    await D.inserir("aprovacoes", { post_id: p.id, cliente_id: p.cliente_id, decisao, comentario, trecho, autor_id: S.usuario.id });
    fecharViewer();
    avisar(decisao === "aprovado" ? "Aprovado. A social media foi avisada e o conteúdo está liberado para agendar." : "Pedido enviado. A social media foi avisada e a nova versão chega aqui para você aprovar.", "ok");
    rotear();
  } catch (e) { avisar(erroAmigavel(e), "erro"); }
}

// ----------------------------------------------------------------- Briefing
const respostaDe = (resp, q) => { const r = String((resp || {})[q.id] || "").trim(); return r || ((resp || {})[q.id + "_audio"] ? "(respondido em áudio)" : ""); };
TELAS_CLIENTE.briefing = async (el) => {
  const c = clienteAtual();
  const ob = await D.um("onboarding", { eq: { cliente_id: c.id } });
  if (!ob || ob.status === "rascunho") {
    el.innerHTML = `<div class="faixa info">Este é o seu briefing. Responda uma pergunta por vez. Quando enviar, ele vira a versão oficial que guia a estratégia, e daqui você pode propor mudanças quando quiser.</div><div id="ob-area"></div>`;
    await ROTAS["c-onboarding"]($("#ob-area", el));
    return;
  }
  const resp = ob.respostas || {};
  const alts = await D.lista("briefing_alteracoes", { eq: { cliente_id: c.id }, ordem: "-created_at" });
  const pend = alts.find((a) => a.status === "pendente");
  const escl = alts[0] && alts[0].status === "esclarecimento" ? alts[0] : null;
  const blocos = [...new Set(PERGUNTAS_ONBOARDING.map((q) => q.blocoTitulo))];
  const aprovadas = alts.filter((a) => a.status === "aprovada");
  const ST = { pendente: ["em análise", "t-ambar"], aprovada: ["aprovada", "t-verde"], esclarecimento: ["pediram esclarecimento", "t-azul"], recusada: ["não aplicada", "t-cinza"] };
  el.innerHTML = `<h1>Briefing</h1><p class="sub">Esta é a versão oficial que guia a estratégia. Você pode propor mudanças a qualquer momento: elas entram em vigor depois que a social media aprovar.</p>
    ${pend ? `<div class="faixa alerta">Você tem uma alteração em análise (enviada em ${esc(fmtData(pend.created_at))}). Enquanto isso, a versão abaixo continua valendo.</div>` : ""}
    ${escl ? `<div class="faixa info">A social media pediu um esclarecimento sobre a sua última alteração. Veja a mensagem em <a href="#/notificacoes">Notificações</a> e envie uma nova proposta.</div>` : ""}
    <div class="entre" style="margin-bottom:10px"><span class="muted">Versão ${aprovadas.length + 1} · atualizado por último em ${esc(fmtData(ob.updated_at || (aprovadas[0] || {}).decidido_em || ""))}</span>
      <button class="btn primario" id="br-propor" ${pend ? "disabled" : ""}>Propor alterações</button></div>
    ${blocos.map((b) => `<div class="cartao"><h3>${esc(b)}</h3><div class="lista">${PERGUNTAS_ONBOARDING.filter((q) => q.blocoTitulo === b).map((q) => `<div><label style="margin:0 0 3px">${esc(q.texto)}</label>${esc(respostaDe(resp, q)) || `<span class="muted">sem resposta</span>`}</div>`).join("")}</div></div>`).join("")}
    <div class="sec"><h3>Histórico de mudanças</h3><div class="cartao lista">${alts.map((a) => { const st = ST[a.status] || [a.status, ""];
      return `<div class="entre"><span><b>${esc(fmtData(a.created_at))}</b> · ${Object.keys(a.campos || {}).length} campo(s): ${esc(Object.keys(a.campos || {}).map((k) => ((PERGUNTAS_ONBOARDING.find((q) => q.id === k) || {}).texto || k)).join("; "))}${a.motivo ? `<br><span class="muted">Motivo: ${esc(a.motivo)}</span>` : ""}</span>${tag(st[0], st[1])}</div>`; }).join("")
      || `<div class="muted">Briefing enviado em ${esc(fmtData(ob.updated_at || ""))}. Nenhuma alteração ainda.</div>`}</div></div>`;
  $("#br-propor").onclick = () => {
    const m = abrirModal("Propor alterações no briefing", `<p class="muted">Altere só o que mudou. Nada é aplicado sem a aprovação da social media.</p><form id="f-br">
      ${PERGUNTAS_ONBOARDING.map((q) => `<label>${esc(q.texto)}</label><textarea data-q="${q.id}" style="min-height:58px">${esc(String(resp[q.id] || ""))}</textarea>`).join("")}
      <label>Por que mudou? (opcional)</label><input type="text" id="br-motivo" placeholder="Ex.: reajuste de preços de dezembro">
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Enviar para aprovação</button></div></form>`, { largo: true });
    $("#f-br", m).onsubmit = async (ev) => {
      ev.preventDefault();
      const campos = {};
      $$("[data-q]", m).forEach((t) => { const antes = String(resp[t.dataset.q] || "").trim(), depois = t.value.trim(); if (depois !== antes) campos[t.dataset.q] = { antes, depois }; });
      if (!Object.keys(campos).length) { avisar("Nenhum campo foi alterado."); return; }
      try {
        await D.inserir("briefing_alteracoes", { cliente_id: c.id, campos, motivo: $("#br-motivo", m).value.trim() || null, status: "pendente" });
        fecharModal(); avisar("Alteração enviada. A social media vai comparar o antes e o depois e aprovar.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
};

// ----------------------------------------------------------------- Ideias e referências
TELAS_CLIENTE.ideias = async (el) => {
  const c = clienteAtual();
  const [ideias, coms] = await Promise.all([
    D.lista("ideias", { eq: { cliente_id: c.id }, ordem: "-created_at" }),
    D.lista("ideia_comentarios", { eq: { cliente_id: c.id }, ordem: "created_at" }),
  ]);
  el.innerHTML = `<div class="entre"><div><h1>Ideias e referências</h1><p class="sub">Espaço nosso: mande ideias, links, prints e vídeos. Tudo passa pela análise estratégica antes de virar post.</p></div><button class="btn primario" id="id-nova">Nova ideia</button></div>
    <div class="grid g2">${ideias.map((i) => { const st = IDEIA_ST[i.status] || [i.status, ""]; const cc = coms.filter((x) => x.ideia_id === i.id);
      return `<div class="cartao"><div class="entre"><b>${esc(i.titulo || String(i.conteudo || "Ideia").slice(0, 60))}</b>${tag(st[0], st[1])}</div>
        <div class="linha" style="margin:4px 0">${i.categoria ? tag(i.categoria) : ""}${tag(i.autor === "social_media" ? "Enviado pela social media" : "Enviado por você", i.autor === "social_media" ? "t-terra" : "")}</div>
        <div style="white-space:pre-wrap">${esc(i.conteudo || "")}</div>${i.audio_url ? `<audio controls data-audio="${esc(i.audio_url)}" style="width:100%;margin-top:6px"></audio>` : ""}
        ${linkSeguro(i.link) ? `<div class="muted"><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.link)}</a></div>` : ""}
        <div style="margin-top:8px">${cc.map((x) => `<div class="muted" style="padding:4px 0"><b>${x.autor_papel === "cliente" ? "Você" : "Social media"}:</b> ${esc(x.texto)}</div>`).join("")}</div>
        <div class="linha" style="margin-top:8px"><input type="text" class="cresce" data-com="${esc(i.id)}" placeholder="Comentar..."><button class="btn pequeno" data-enviar="${esc(i.id)}">Enviar</button></div></div>`; }).join("")
      || `<div class="vazio" style="grid-column:1/-1">Nenhuma ideia ainda. Mande a primeira!</div>`}</div>`;
  $$("[data-audio]", el).forEach(async (au) => { au.src = await D.urlArquivo("audios", au.dataset.audio); });
  $$("[data-enviar]", el).forEach((b) => b.onclick = async () => {
    const campo = $(`[data-com="${b.dataset.enviar}"]`, el), t = campo.value.trim();
    if (!t) return;
    try { await D.inserir("ideia_comentarios", { ideia_id: b.dataset.enviar, cliente_id: c.id, autor_papel: "cliente", texto: t }); avisar("Comentário enviado.", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $("#id-nova").onclick = () => {
    const m = abrirModal("Nova ideia", `<form id="f-id"><label>Título</label><input type="text" id="ni-t" required>
      <label>Tipo</label><select id="ni-tipo">${["Ideia de conteúdo", "Referência", "Link", "Imagem", "Vídeo", "Campanha", "Tendência"].map((x) => `<option>${x}</option>`).join("")}</select>
      <label>Descrição</label><textarea id="ni-d"></textarea><label>Link (opcional)</label><input type="url" id="ni-l" placeholder="https://...">
      <div class="linha" style="margin-top:8px"><button type="button" class="btn" id="ni-audio">🎙️ Gravar áudio (opcional)</button><span id="ni-st"></span></div>
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Enviar</button></div></form>`);
    let audio = null;
    P.gravadorAudio($("#ni-audio", m), $("#ni-st", m), async (blob) => {
      try { audio = await P.subirAudio(blob, "ideias"); $("#ni-st", m).innerHTML = tag("áudio pronto", "t-verde"); } catch (e) { avisar(erroAmigavel(e), "erro"); }
    });
    $("#f-id", m).onsubmit = async (ev) => {
      ev.preventDefault();
      const link = $("#ni-l", m).value.trim();
      if (link && !linkSeguro(link)) { avisar("O link precisa começar com https://", "erro"); return; }
      try {
        await D.inserir("ideias", { cliente_id: c.id, autor: "cliente", status: "nova", tipo: audio ? "audio" : "texto", audio_url: audio, titulo: $("#ni-t", m).value.trim(),
          categoria: $("#ni-tipo", m).value, conteudo: $("#ni-d", m).value.trim() || null, link: link || null });
        fecharModal(); avisar("Ideia registrada. Ela não vira post sozinha: primeiro passa pela análise.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
};

// ----------------------------------------------------------------- Solicitações
TELAS_CLIENTE.solicitacoes = async (el) => {
  const c = clienteAtual();
  const [cc, grav] = await Promise.all([D.lista("chamados", { eq: { cliente_id: c.id, visivel_cliente: true }, ordem: "-created_at" }), blocoGravacoes()]);
  el.innerHTML = `<div class="entre"><div><h1>Solicitações</h1><p class="sub">Acompanhe tudo o que você pediu. Você vê o andamento, não a operação interna.</p></div><button class="btn primario" id="so-nova">Nova solicitação</button></div>
    ${grav.html}
    <div class="cartao tabela"><table><tr><th>Data</th><th>Assunto</th><th>Tipo</th><th>Andamento</th></tr>
    ${cc.map((x) => `<tr><td>${esc(R.fmtDataCurta(x.created_at))}</td><td>${esc(x.descricao || "")}</td><td>${esc(x.categoria || "")}</td>
      <td>${tag(CH_SIMPLES[x.status] || x.status, x.status === "concluido" ? "t-verde" : x.status === "aguardando_cliente" ? "t-ambar" : "t-azul")}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Nenhuma solicitação.</td></tr>`}</table></div>`;
  grav.ligar(el);
  $("#so-nova").onclick = () => novaSolicitacao();
};

// ----------------------------------------------------------------- Notificações
TELAS_CLIENTE.notificacoes = async (el) => {
  const c = clienteAtual();
  const nn = await D.lista("notificacoes", { eq: { para: "cliente", cliente_id: c.id }, ordem: "-created_at", limite: 100 });
  el.innerHTML = `<h1>Notificações</h1><div class="cartao lista">${nn.map((n) => `<div class="entre"><span>${n.lida ? "" : tag("nova", "t-terra")}${n.link && String(n.link).startsWith("#/") ? `<a href="${esc(n.link)}">${esc(n.texto)}</a>` : esc(n.texto)}</span><span class="muted">${esc(tempoRelativo(n.created_at))}</span></div>`).join("") || `<div class="muted">Nada por aqui.</div>`}</div>`;
  if (nn.some((n) => !n.lida)) setTimeout(async () => {
    try { await D.atualizar("notificacoes", { para: "cliente", cliente_id: c.id, lida: false }, { lida: true }); atualizarContadores(); } catch (_) { /* tenta na próxima */ }
  }, 1500);
};

// ----------------------------------------------------------------- Minha conta
TELAS_CLIENTE.conta = async (el, args) => {
  if (args[0] === "pesquisa") return ROTAS["c-pesquisa"](el);
  if (args[0] === "dados") return ROTAS["c-dados"](el);
  const c = clienteAtual(), e = c.escopo || {};
  const entregas = e.posts_mes ? `${e.posts_mes} conteúdos por mês` : e.posts_semana ? `${e.posts_semana} posts por semana` : "conforme o plano";
  el.innerHTML = `<h1>Minha conta</h1><div class="grid g2">
    <div class="cartao"><h3>Contrato</h3><table class="ficha">
      <tr><td class="muted">Plano</td><td>${esc(c.plano || "a definir")}</td></tr>
      <tr><td class="muted">Início</td><td>${c.contrato_inicio ? esc(fmtData(c.contrato_inicio)) : "a definir"}</td></tr>
      ${c.contrato_fim ? `<tr><td class="muted">Vigente até</td><td>${esc(fmtData(c.contrato_fim))}</td></tr>` : ""}
      <tr><td class="muted">Entregas</td><td>${esc(entregas)}</td></tr>
      <tr><td class="muted">Rodadas de ajuste</td><td>${rodadas(c)} por conteúdo</td></tr>
      <tr><td class="muted">Prazo de aprovação</td><td>${prazoDias(c)} dias</td></tr></table></div>
    <div class="cartao"><h3>Como funciona o atendimento</h3><div class="lista">
      <div><b>1.</b> Todo mês você recebe o planejamento e o calendário.</div>
      <div><b>2.</b> Os conteúdos chegam em Aprovações. Sem resposta no prazo, mandamos lembrete (não aprovamos sozinhos).</div>
      <div><b>3.</b> Mudou algo no seu negócio? Proponha no Briefing.</div>
      <div><b>4.</b> Canais: este portal (principal) e WhatsApp em horário comercial.</div></div></div>
    <div class="cartao"><h3>Usuários com acesso</h3><div class="lista"><div>Responsável principal (você)${S.usuario.email ? `<br><span class="muted">${esc(S.usuario.email)}</span>` : ""}</div></div>
      <button class="btn pequeno" id="ct-acesso" style="margin-top:6px">Pedir novo acesso</button></div>
    <div class="cartao"><h3>Pesquisa do mês</h3><p class="muted">Uma pergunta só, uma vez por mês.</p><a class="btn pequeno" href="#/conta/pesquisa">Responder</a></div>
    <div class="cartao"><h3>Meus dados</h3><p class="muted">Uma cópia de tudo o que é seu aqui no portal.</p><a class="btn pequeno" href="#/conta/dados">Baixar meus dados</a></div>
  </div>`;
  $("#ct-acesso").onclick = () => novaSolicitacao("Solicitação relacionada ao atendimento", "Quero liberar acesso ao portal para: (nome e e-mail)");
};

// Relatórios e Arquivos do cliente ficam em js/gestao.js (fase 3).

P.R.cliente = { abrirViewer, novaSolicitacao, blocoGravacoes };
})();

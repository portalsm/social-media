// =============================================================================
// admin.js: telas do Painel Administrativo (papel social_media), reforma.
// Nada desta área aparece para os clientes. Os gatilhos do banco já cuidam do
// que o cliente faz (aprovação, briefing, solicitação, ideia): aqui só entram as
// ações da administração.
// =============================================================================
(function () {
"use strict";
const P = window.__portal;
const R = P.R;
const { S, ROTAS, $, $$, esc, hojeISO, mesAtual, somarDias, fmtData, fmtMoeda, nomeMes, avisar, erroAmigavel, abrirModal, fecharModal,
  confirmar, clienteAtual, PERGUNTAS_ONBOARDING, tempoRelativo } = P;
const { D, STATUS, INTERNOS, CH_STATUS, CH_ABERTOS, PRIO, PRIO_COR, TAREFA_ST, IDEIA_ST, ETAPAS_ONB, LINK_DRIVE, tag, tagS, nomeFormato, nomeCliente,
  prazoDias, rodadas, usadasRodadas, agoraISO, comHistorico, fmtDiaLongo, linkSeguro, gradiente, capaUrl, gradeMes, navMes, notificar, emBreve,
  TELAS_ADMIN, rotear, atualizarContadores } = R;

const mesDe = (args) => (args && /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : mesAtual());
const cliPorId = (id) => S.clientes.find((c) => c.id === id) || {};
const filtroCliente = (f = {}) => (S.clienteId ? Object.assign({}, f, { eq: Object.assign({}, f.eq || {}, { cliente_id: S.clienteId }) }) : f);
const textoPergunta = (k) => ((PERGUNTAS_ONBOARDING.find((q) => q.id === k) || {}).texto || k);
const ORIGEM = { aprovacao: "Aprovação de conteúdo", briefing: "Briefing", solicitacao: "Solicitação", ideia: "Ideias", sistema: "Sistema", interno: "Interno" };

// ----------------------------------------------------------------- Dashboard geral
TELAS_ADMIN.dashboard = async (el) => {
  const hoje = hojeISO(), nv = navMes(mesAtual());
  const [abertas, postsMes, pend, chamados, notifs, ultimas] = await Promise.all([
    D.lista("tarefas", { in: { status: ["a_fazer", "em_execucao", "revisao"] }, ordem: "prazo" }),
    D.lista("posts", { gte: { data: nv.ini }, lte: { data: nv.fim } }, "id,cliente_id,status"),
    D.lista("posts", { in: { status: ["aprovacao", "ajuste", "pauta", "producao", "revisao"] } }, "id,cliente_id,status"),
    D.lista("chamados", { in: { status: CH_ABERTOS } }, "id,cliente_id,status"),
    D.lista("notificacoes", { eq: { para: "admin", lida: false }, ordem: "-created_at", limite: 15 }),
    D.lista("notificacoes", { eq: { para: "admin" }, ordem: "-created_at", limite: 500 }, "cliente_id,created_at"),
  ]);
  const doDia = abertas.filter((t) => t.prazo && t.prazo <= hoje).sort((a, b) => (a.prazo + (a.hora || "99")).localeCompare(b.prazo + (b.hora || "99")));
  const atrasadas = abertas.filter((t) => !t.lead_id && t.prazo && t.prazo < hoje);
  const ativos = S.clientes.filter((c) => c.status !== "encerrado" && c.status !== "inativo");
  const receita = S.clientes.filter((c) => c.status === "ativo").reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
  const ultimaDe = (cid) => (ultimas.find((n) => n.cliente_id === cid) || {}).created_at;
  const faseDe = (c) => {
    if (c.status === "onboarding") return "Onboarding";
    const ps = pend.filter((p) => p.cliente_id === c.id);
    if (ps.some((p) => INTERNOS.includes(p.status))) return "Produção";
    if (ps.some((p) => p.status === "aprovacao" || p.status === "ajuste")) return "Aprovação";
    return "Planejamento";
  };
  const diaSemana = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  el.innerHTML = `<h1>Dashboard geral</h1><p class="sub">Visão da operação inteira. Nada desta área aparece para os clientes.</p>
    <div class="cartao hojelist destaque-borda"><div class="entre"><h3 style="margin:0">Minhas tarefas de hoje</h3><span class="muted">${esc(diaSemana)} · ${doDia.length} tarefa(s)</span></div>
      ${doDia.map((t) => `<div class="tk"><input type="checkbox" data-concluir="${esc(t.id)}" aria-label="Concluir"><div style="flex:1"><b>${t.hora ? esc(String(t.hora).slice(0, 5)) + " · " : ""}${esc(t.titulo)}</b>${t.prazo < hoje ? " " + tag("atrasada desde " + R.fmtDataCurta(t.prazo), "t-verm") : ""}
        <br><span class="muted">${t.lead_id ? "Comercial" : esc(nomeCliente(t.cliente_id))}${t.tipo ? " · " + esc(t.tipo) : ""}${t.nota ? " · " + esc(t.nota) : ""}</span></div>${t.lead_id ? tag("follow-up", "t-azul") : tag(PRIO[t.prioridade] || "", PRIO_COR[t.prioridade])}</div>`).join("")
        || `<div class="muted" style="padding:8px 0">Nada para hoje.</div>`}</div>
    <div class="grid g4">
      <div class="kpi"><div class="n">${ativos.length}</div><div class="l">Clientes ativos</div></div>
      <div class="kpi"><div class="n">${pend.filter((p) => p.status === "aprovacao").length}</div><div class="l">Aguardando aprovação</div></div>
      <div class="kpi"><div class="n">${chamados.length}</div><div class="l">Chamados abertos</div></div>
      <div class="kpi"><div class="n ${atrasadas.length ? "down" : ""}">${atrasadas.length}</div><div class="l">Tarefas atrasadas</div></div>
      <div class="kpi"><div class="n">${postsMes.filter((p) => p.status === "publicado").length}/${postsMes.length}</div><div class="l">Publicados no mês</div></div>
      <div class="kpi"><div class="n">${esc(fmtMoeda(receita))}</div><div class="l">Receita mensal recorrente</div></div>
    </div>
    <div class="cartao sec tabela"><h3>Pendências por cliente</h3><table><tr><th>Cliente</th><th>Fase</th><th>Aprovação</th><th>Ajustes</th><th>Chamados</th><th>Última interação</th></tr>
      ${S.clientes.map((c) => { const u = ultimaDe(c.id); const dd = u ? Math.floor((Date.now() - new Date(u).getTime()) / 864e5) : null;
        return `<tr><td><b>${esc(c.nome)}</b><br><span class="muted">${esc(c.instagram || "")}</span></td><td>${tag(faseDe(c))}</td>
          <td>${pend.filter((p) => p.cliente_id === c.id && p.status === "aprovacao").length}</td><td>${pend.filter((p) => p.cliente_id === c.id && p.status === "ajuste").length}</td>
          <td>${chamados.filter((x) => x.cliente_id === c.id).length}</td><td>${dd == null ? `<span class="muted">sem registro</span>` : dd + " dia(s)"} ${dd != null && dd > 7 ? tag("sem interação", "t-verm") : ""}</td></tr>`; }).join("")
        || `<tr><td colspan="6" class="muted">Nenhum cliente ainda. Cadastre em Clientes.</td></tr>`}</table></div>
    <div class="cartao sec"><div class="entre"><h3 style="margin:0">Alertas automáticos</h3>${notifs.length ? `<button class="btn pequeno" id="ler-alertas">Marcar como lidos</button>` : ""}</div>
      <div class="lista">${notifs.map((n) => `<div class="entre"><span>${n.link ? `<a href="${esc(n.link)}">${esc(n.texto)}</a>` : esc(n.texto)}</span><span class="muted">${esc(tempoRelativo(n.created_at))}</span></div>`).join("") || `<div class="muted">Sem alertas.</div>`}</div></div>`;
  $$("[data-concluir]", el).forEach((b) => b.onchange = async () => {
    const t = abertas.find((x) => x.id === b.dataset.concluir);
    try {
      await D.atualizar("tarefas", { id: t.id }, { status: "concluido" });
      avisar(t.lead_id ? "Follow-up feito. Marque o próximo no Funil de Vendas." : "Tarefa concluída.", "ok"); rotear();
    } catch (e) { b.checked = false; avisar(erroAmigavel(e), "erro"); }
  });
  if ($("#ler-alertas")) $("#ler-alertas").onclick = async () => {
    try { await D.atualizar("notificacoes", { para: "admin", lida: false }, { lida: true }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// ----------------------------------------------------------------- Onboarding
TELAS_ADMIN.onboarding = async (el) => {
  const [alts, ops, obs] = await Promise.all([
    D.lista("briefing_alteracoes", { eq: { status: "pendente" }, ordem: "created_at" }),
    D.lista("operacao", { eq: { mes: "onboarding" } }),
    D.lista("onboarding", {}, "cliente_id,progresso,status"),
  ]);
  const feita = (cid, i) => !!R.etapasOnb(ops.find((o) => o.cliente_id === cid))["onb" + (i + 1)];
  el.innerHTML = `<h1>Onboarding</h1><p class="sub">A jornada de cada cliente novo, do cadastro ao Cérebro da Marca.</p>
    ${alts.map((a) => `<div class="cartao borda-ambar"><div class="entre"><h3 style="margin:0">${esc(nomeCliente(a.cliente_id))}: alteração de briefing para aprovar</h3>${tag("pendente", "t-ambar")}</div>
      <p class="muted">Enviada ${esc(tempoRelativo(a.created_at))}${a.motivo ? ` · Motivo: ${esc(a.motivo)}` : ""}</p>
      ${Object.entries(a.campos || {}).map(([k, m]) => `<label>${esc(textoPergunta(k))}</label><div class="diff"><div class="antes"><b>Antes</b><br>${esc((m || {}).antes || "") || "<i>vazio</i>"}</div><div class="depois"><b>Depois</b><br>${esc((m || {}).depois || "") || "<i>vazio</i>"}</div></div>`).join("")}
      <div class="linha" style="margin-top:12px"><button class="btn primario" data-aprovar="${esc(a.id)}">Aprovar e atualizar o oficial</button><button class="btn" data-esclarecer="${esc(a.id)}">Pedir esclarecimento</button><button class="btn perigo" data-recusar="${esc(a.id)}">Não aplicar</button></div></div>`).join("")}
    <div class="grid g3">${S.clientes.map((c) => { const k = ETAPAS_ONB.filter((_, i) => feita(c.id, i)).length, pc = Math.round((k / ETAPAS_ONB.length) * 100); const ob = obs.find((o) => o.cliente_id === c.id);
      return `<div class="cartao"><div class="entre"><h3 style="margin:0">${esc(c.nome)}</h3><b>${pc}%</b></div><div class="barra"><span style="width:${pc}%"></span></div>
        <div class="muted" style="margin-top:6px">Briefing no portal: ${ob ? `${esc({ rascunho: "respondendo", enviado: "respondido", revisado: "revisado" }[ob.status] || ob.status)} (${ob.progresso || 0}%)` : "não começou"}</div>
        <div style="margin-top:8px">${ETAPAS_ONB.map((e, i) => `<label class="check"><input type="checkbox" data-cli="${esc(c.id)}" data-i="${i}" ${feita(c.id, i) ? "checked" : ""}> ${esc(e)}</label>`).join("")}</div>
        <div class="linha" style="margin-top:8px"><button class="btn pequeno" data-cerebro="${esc(c.id)}">Cérebro da Marca</button></div></div>`; }).join("") || P.vazio("Nenhum cliente cadastrado.")}</div>`;
  $$("input[data-cli]", el).forEach((b) => b.onchange = async () => {
    try {
      const cid = b.dataset.cli, etapas = Object.assign({}, R.etapasOnb(ops.find((o) => o.cliente_id === cid))), k = "onb" + (Number(b.dataset.i) + 1);
      if (b.checked) etapas[k] = agoraISO(); else delete etapas[k];
      const completo = ETAPAS_ONB.every((_, i) => etapas["onb" + (i + 1)]);
      await R.salvarRegistro(cid, "onboarding", etapas, { feita: completo, feita_em: completo ? agoraISO() : null });
      rotear();
    } catch (e) { b.checked = !b.checked; avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-cerebro]", el).forEach((b) => b.onclick = () => { S.clienteId = b.dataset.cerebro; location.hash = "#/cerebro"; });
  const fecharChamados = async (a, status, texto) => {
    const chs = await D.lista("chamados", { eq: { ref_tipo: "briefing_alteracao", ref_id: a.id } });
    for (const ch of chs.filter((x) => x.status !== "concluido")) await D.atualizar("chamados", { id: ch.id }, { status, historico: comHistorico(ch, texto) });
  };
  $$("[data-aprovar]", el).forEach((b) => b.onclick = async () => {
    const a = alts.find((x) => x.id === b.dataset.aprovar);
    try {
      const ob = await D.um("onboarding", { eq: { cliente_id: a.cliente_id } });
      const resp = Object.assign({}, (ob || {}).respostas || {});
      for (const [k, m] of Object.entries(a.campos || {})) resp[k] = (m || {}).depois || "";
      await D.atualizar("onboarding", { cliente_id: a.cliente_id }, { respostas: resp });
      await D.atualizar("briefing_alteracoes", { id: a.id }, { status: "aprovada", decidido_em: agoraISO() });
      await fecharChamados(a, "concluido", "Aprovado e aplicado ao briefing oficial");
      await notificar("cliente", a.cliente_id, "Sua atualização do briefing foi aprovada", "#/briefing");
      avisar("Briefing oficial atualizado. O cliente foi avisado.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  const decidirSemAplicar = (a, status) => {
    const esc1 = status === "esclarecimento";
    const m = abrirModal(esc1 ? "Pedir esclarecimento" : "Não aplicar a alteração", `<label>${esc1 ? "O que você precisa entender melhor?" : "Motivo (o cliente vê)"}</label><textarea id="dc-txt"></textarea>
      <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="dc-ok">Enviar ao cliente</button></div>`);
    $("#dc-ok", m).onclick = async () => {
      const t = $("#dc-txt", m).value.trim();
      if (t.length < 10) { avisar("Escreva uma mensagem um pouco maior para o cliente."); return; }
      try {
        await D.atualizar("briefing_alteracoes", { id: a.id }, { status, decidido_em: agoraISO() });
        await fecharChamados(a, esc1 ? "aguardando_cliente" : "concluido", (esc1 ? "Pedido de esclarecimento: " : "Alteração não aplicada: ") + t);
        await notificar("cliente", a.cliente_id, (esc1 ? "A social media pediu um esclarecimento sobre a sua alteração do briefing: " : "Sua alteração do briefing não foi aplicada: ") + t, "#/briefing");
        fecharModal(); avisar("Mensagem enviada ao cliente.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  $$("[data-esclarecer]", el).forEach((b) => b.onclick = () => decidirSemAplicar(alts.find((x) => x.id === b.dataset.esclarecer), "esclarecimento"));
  $$("[data-recusar]", el).forEach((b) => b.onclick = () => decidirSemAplicar(alts.find((x) => x.id === b.dataset.recusar), "recusada"));
};

// ----------------------------------------------------------------- Ações de um post (Conteúdos e Calendário geral)
function botoesAcao(p, versoes) {
  const c = cliPorId(p.cliente_id);
  const b = (acao, txt, prim) => `<button class="btn ${prim ? "primario" : ""} pequeno" data-acao="${acao}" data-id="${esc(p.id)}">${txt}</button>`;
  if (INTERNOS.includes(p.status)) return b("enviar", "Enviar para aprovação", true) + b("planejar", "Mostrar como planejado");
  if (p.status === "planejado") return b("enviar", "Enviar para aprovação", true);
  if (p.status === "ajuste") { const u = usadasRodadas(versoes); return b("versao", "Publicar nova versão", true) + `<br><span class="muted">${u}/${rodadas(c)} rodadas</span>${u > rodadas(c) ? " " + tag("acima do contrato", "t-verm") : ""}`; }
  if (p.status === "aprovacao") return b("lembrete", "Enviar lembrete");
  if (p.status === "aprovado") return b("agendado", "Marcar agendado");
  if (p.status === "agendado") return b("publicado", "Marcar publicado");
  return "";
}
async function subirCapa(p, arquivo) {
  const ext = (arquivo.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return D.enviarArquivo("midias", `${p.cliente_id}/posts/${p.id}/capa-${Date.now()}.${ext}`, arquivo);
}
function ligarAcoes(raiz, posts, depois) {
  $$("[data-acao]", raiz).forEach((bt) => bt.onclick = (ev) => {
    ev.stopPropagation();
    const p = posts.find((x) => x.id === bt.dataset.id);
    ({ enviar: enviarAprovacao, versao: novaVersao, lembrete, planejar, agendado: (x, d) => mudarStatus(x, "agendado", d), publicado: marcarPublicado })[bt.dataset.acao](p, depois);
  });
}
function enviarAprovacao(p, depois) {
  const c = cliPorId(p.cliente_id);
  const dentro = p.formato === "reels" ? "o vídeo final" : p.formato === "carrossel" ? "todos os slides numerados" : p.formato === "stories" ? "a sequência de stories" : "a arte final";
  const m = abrirModal("Enviar para aprovação", `<p class="muted">${esc(c.nome || "")} · ${esc(p.tema)} · ${esc(nomeFormato(p.formato))}</p><form id="f-env">
    <label>Design de capa (imagem leve, vai para o feed)${p.capa ? " · já tem capa, envie outra só se mudou" : ""}</label><input type="file" id="en-capa" accept="image/png,image/jpeg,image/webp,image/gif" ${p.capa ? "" : "required"}>
    <label>Link da pasta deste post no Google Drive (obrigatório)</label><input type="url" id="en-drive" required placeholder="https://drive.google.com/drive/folders/..." value="${esc(p.link_drive || "")}">
    <div class="muted" style="margin-top:4px">Dentro da pasta: ${dentro}. Compartilhe como "qualquer pessoa com o link pode ver".</div>
    <label>Legenda</label><textarea id="en-leg">${esc(p.legenda || "")}</textarea>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Enviar ao cliente</button></div></form>`);
  $("#f-env", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const drive = $("#en-drive", m).value.trim(), arq = $("#en-capa", m).files[0];
    if (!LINK_DRIVE.test(drive)) { avisar("Link inválido. Cole o link de uma pasta ou arquivo do Google Drive.", "erro"); return; }
    if (!arq && !p.capa) { avisar("Envie a imagem da capa.", "erro"); return; }
    const btn = $("button.primario", m); btn.disabled = true; btn.textContent = "Enviando...";
    try {
      const capa = arq ? await subirCapa(p, arq) : p.capa;
      await D.atualizar("posts", { id: p.id }, { capa, link_drive: drive, legenda: $("#en-leg", m).value, status: "aprovacao", visivel_cliente: true,
        versao: Math.max(1, Number(p.versao || 1)), prazo_aprovacao: somarDias(hojeISO(), prazoDias(c)) });
      await notificar("cliente", p.cliente_id, `Conteúdo disponível para aprovação: ${p.tema}`, `#/aprovacoes/${String(p.data).slice(0, 7)}`);
      fecharModal(); avisar("Enviado. A capa entrou no feed de aprovação do cliente, com a legenda e o link do Drive.", "ok"); depois();
    } catch (e) { btn.disabled = false; btn.textContent = "Enviar ao cliente"; avisar(erroAmigavel(e), "erro"); }
  };
}
function novaVersao(p, depois) {
  const c = cliPorId(p.cliente_id), v = Number(p.versao || 1) + 1;
  const m = abrirModal("Publicar nova versão", `<p class="muted">${esc(c.nome || "")} · ${esc(p.tema)}</p><form id="f-nv">
    <label>Link do Drive da nova versão</label><input type="url" id="nv-drive" required value="${esc(p.link_drive || "")}">
    <div class="muted" style="margin-top:4px">Dica: crie uma subpasta "v${v}" dentro da pasta do post.</div>
    <label>Nova capa (se mudou)</label><input type="file" id="nv-capa" accept="image/png,image/jpeg,image/webp,image/gif">
    <label>O que mudou (o cliente vê)</label><input type="text" id="nv-mud" placeholder="Ex.: troquei a foto do slide 3 e o preço da legenda">
    <label>Legenda</label><textarea id="nv-leg">${esc(p.legenda || "")}</textarea>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Enviar ao cliente</button></div></form>`);
  $("#f-nv", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const drive = $("#nv-drive", m).value.trim(), arq = $("#nv-capa", m).files[0];
    if (!LINK_DRIVE.test(drive)) { avisar("Link inválido. Cole o link de uma pasta ou arquivo do Google Drive.", "erro"); return; }
    const btn = $("button.primario", m); btn.disabled = true; btn.textContent = "Enviando...";
    try {
      const capa = arq ? await subirCapa(p, arq) : p.capa;
      await D.atualizar("posts", { id: p.id }, { versao: v, status: "aprovacao", visivel_cliente: true, link_drive: drive, capa, legenda: $("#nv-leg", m).value,
        mudancas: $("#nv-mud", m).value.trim() || null, prazo_aprovacao: somarDias(hojeISO(), prazoDias(c)) });
      const [chs, tfs] = await Promise.all([D.lista("chamados", { eq: { ref_tipo: "post", ref_id: p.id } }), D.lista("tarefas", { eq: { post_id: p.id } })]);
      for (const ch of chs.filter((x) => x.status !== "concluido")) await D.atualizar("chamados", { id: ch.id }, { status: "concluido", historico: comHistorico(ch, `Versão ${v} disponibilizada`) });
      for (const t of tfs.filter((x) => x.status !== "concluido")) await D.atualizar("tarefas", { id: t.id }, { status: "concluido" });
      await notificar("cliente", p.cliente_id, `Revisão concluída: nova versão de "${p.tema}" para aprovar`, `#/aprovacoes/${String(p.data).slice(0, 7)}`);
      fecharModal(); avisar(`Versão ${v} enviada. O chamado foi concluído e o cliente recebeu nova notificação.`, "ok"); depois();
    } catch (e) { btn.disabled = false; btn.textContent = "Enviar ao cliente"; avisar(erroAmigavel(e), "erro"); }
  };
}
async function lembrete(p) {
  await notificar("cliente", p.cliente_id, `Lembrete: "${p.tema}" está esperando sua aprovação`, `#/aprovacoes/${String(p.data).slice(0, 7)}`);
  avisar("Lembrete enviado. Lembre: sem resposta não é aprovação automática.", "ok");
}
async function planejar(p, depois) {
  try { await D.atualizar("posts", { id: p.id }, { status: "planejado", visivel_cliente: true }); avisar("Agora o cliente vê este post como planejado no calendário.", "ok"); depois(); }
  catch (e) { avisar(erroAmigavel(e), "erro"); }
}
async function mudarStatus(p, status, depois, extra = {}) {
  try { await D.atualizar("posts", { id: p.id }, Object.assign({ status }, extra)); avisar("Status atualizado.", "ok"); depois(); }
  catch (e) { avisar(erroAmigavel(e), "erro"); }
}
function marcarPublicado(p, depois) {
  const m = abrirModal("Marcar publicado", `<label>Link do post no Instagram (opcional)</label><input type="url" id="mp-link" placeholder="https://www.instagram.com/p/..." value="${esc(p.link_publicado || "")}">
    <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="mp-ok">Marcar publicado</button></div>`);
  $("#mp-ok", m).onclick = () => { const l = $("#mp-link", m).value.trim(); if (l && !linkSeguro(l)) { avisar("O link precisa começar com https://", "erro"); return; } fecharModal(); mudarStatus(p, "publicado", depois, { link_publicado: l || p.link_publicado || null }); };
}

// ----------------------------------------------------------------- Gestão de conteúdos
TELAS_ADMIN.conteudos = async (el, args) => {
  const mes = mesDe(args), nv = navMes(mes);
  const filtro = S.filtroConteudo || "";
  const posts = await D.lista("posts", filtroCliente({ gte: { data: nv.ini }, lte: { data: nv.fim }, ordem: "data" }));
  const ids = posts.map((p) => p.id);
  const [ajustes, versoes] = ids.length ? await Promise.all([
    D.lista("aprovacoes", { eq: { decisao: "ajuste" }, in: { post_id: ids }, ordem: "-created_at" }),
    D.lista("post_versoes", { in: { post_id: ids } }),
  ]) : [[], []];
  const lista = posts.filter((p) => !filtro || p.status === filtro);
  const c = clienteAtual();
  el.innerHTML = `<div class="entre"><div><h1>Gestão de conteúdos</h1><p class="sub">${c ? esc(c.nome) : "Todos os clientes"}. Status cinza são internos e o cliente não vê.</p></div>
      ${c ? `<button class="btn primario" id="ct-novo">Novo conteúdo</button>` : ""}</div>
    <div class="linha" style="margin-bottom:12px"><a class="btn pequeno" href="#/conteudos/${nv.ant}">‹</a><b>${esc(nv.nome)}</b><a class="btn pequeno" href="#/conteudos/${nv.prox}">›</a>
      <span class="espaco"></span><select id="ct-filtro" style="width:auto"><option value="">Todos os status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === filtro ? "selected" : ""}>${esc(v[0])}</option>`).join("")}</select></div>
    <div class="cartao tabela"><table><tr><th>Data</th><th>Cliente</th><th>Conteúdo</th><th>Marcações</th><th>Status</th><th>Ação</th></tr>
    ${lista.map((p) => { const aj = p.status === "ajuste" ? ajustes.find((a) => a.post_id === p.id) : null;
      return `<tr><td>${esc(R.fmtDataCurta(p.data))}</td><td>${esc(nomeCliente(p.cliente_id))}</td>
        <td><a href="#" data-editar="${esc(p.id)}"><b>${esc(p.tema || "(sem tema)")}</b></a><br><span class="muted">${esc(nomeFormato(p.formato))} · v${Number(p.versao || 1)}</span>
          ${aj ? `<br><span class="tag t-verm quebra">Pedido: ${esc(String(aj.comentario || "").slice(0, 90))}${aj.trecho ? " (" + esc(aj.trecho) + ")" : ""}</span>` : ""}</td>
        <td>${p.pilar ? tag(p.pilar) : ""}${p.funil ? tag(p.funil) : ""}${p.nivel_consciencia ? tag(p.nivel_consciencia) : ""}</td>
        <td>${tagS(p.status)}<br><span class="muted">${p.visivel_cliente ? "cliente vê" : "só interno"}</span></td>
        <td>${botoesAcao(p, versoes.filter((x) => x.post_id === p.id))}</td></tr>`; }).join("") || `<tr><td colspan="6" class="muted">Nenhum conteúdo neste mês.</td></tr>`}</table></div>`;
  $("#ct-filtro").onchange = (e) => { S.filtroConteudo = e.target.value; rotear(); };
  ligarAcoes(el, posts, rotear);
  $$("[data-editar]", el).forEach((a) => a.onclick = (ev) => { ev.preventDefault(); P.abrirPostSM(posts.find((x) => x.id === a.dataset.editar), rotear); });
  if ($("#ct-novo")) $("#ct-novo").onclick = () => P.abrirPostSM({ cliente_id: c.id, data: hojeISO(), status: "pauta", tema: "", formato: "carrossel", versao: 1, midias: [] }, rotear);
};

// ----------------------------------------------------------------- Produção (kanban de tarefas)
const COLS = ["a_fazer", "em_execucao", "revisao", "concluido"];
const TIPOS_TAREFA = ["Escrever roteiros", "Criar artes", "Editar vídeos", "Revisar materiais", "Analisar briefing", "Elaborar calendário", "Preparar relatórios", "Outro"];
TELAS_ADMIN.producao = async (el) => {
  const hoje = hojeISO();
  const todas = (await D.lista("tarefas", filtroCliente({ ordem: "prazo" }))).filter((t) => !t.lead_id);
  const limite = somarDias(hoje, -30);
  const TT = todas.filter((t) => t.status !== "concluido" || String(t.created_at || t.prazo || hoje).slice(0, 10) >= limite);
  el.innerHTML = `<div class="entre"><h1>Produção</h1><button class="btn primario" id="tf-nova">Nova tarefa</button></div>
    <div class="privado">Área privada. O cliente nunca vê estas tarefas: ele só vê o calendário, os materiais liberados e os resultados.</div>
    <div class="kan">${COLS.map((col, i) => { const cc = TT.filter((t) => t.status === col);
      return `<div class="col"><h3>${esc(TAREFA_ST[col])}<span>${cc.length}</span></h3>${cc.map((t) => `<div class="kc"><b>${esc(t.titulo)}</b><span class="muted">${esc(nomeCliente(t.cliente_id))}${t.responsavel ? " · " + esc(t.responsavel) : ""}</span>
        <div class="linha" style="margin-top:4px">${tag(PRIO[t.prioridade] || "Média", PRIO_COR[t.prioridade])}${t.prazo ? tag("prazo " + R.fmtDataCurta(t.prazo), t.prazo < hoje && col !== "concluido" ? "t-verm" : "") : ""}</div>
        <div class="linha" style="margin-top:6px">${i > 0 ? `<button class="btn pequeno" data-mover="${esc(t.id)}" data-para="${COLS[i - 1]}">Voltar</button>` : ""}${i < 3 ? `<button class="btn pequeno" data-mover="${esc(t.id)}" data-para="${COLS[i + 1]}">Avançar</button>` : ""}<button class="btn pequeno fantasma" data-tarefa="${esc(t.id)}">Editar</button></div></div>`).join("")}</div>`; }).join("")}</div>`;
  $$("[data-mover]", el).forEach((b) => b.onclick = async () => {
    try { await D.atualizar("tarefas", { id: b.dataset.mover }, { status: b.dataset.para }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-tarefa]", el).forEach((b) => b.onclick = () => formTarefa(todas.find((t) => t.id === b.dataset.tarefa)));
  $("#tf-nova").onclick = () => formTarefa(null);
};
function formTarefa(t) {
  const n = t || { cliente_id: S.clienteId || (S.clientes[0] || {}).id, prioridade: "media", responsavel: "Social media", status: "a_fazer", prazo: hojeISO() };
  const m = abrirModal(t ? "Editar tarefa" : "Nova tarefa", `<form id="f-tf"><label>Título</label><input type="text" id="tf-t" required value="${esc(n.titulo || "")}">
    <div class="grade-form"><div><label>Cliente</label><select id="tf-c">${S.clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === n.cliente_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div>
      <div><label>Tipo</label><select id="tf-tipo">${TIPOS_TAREFA.map((x) => `<option ${x === n.tipo ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div><label>Responsável</label><input type="text" id="tf-r" value="${esc(n.responsavel || "")}"></div>
      <div><label>Prioridade</label><select id="tf-p">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === n.prioridade ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div><label>Prazo</label><input type="date" id="tf-prazo" value="${esc(n.prazo || "")}"></div>
      <div><label>Status</label><select id="tf-s">${COLS.map((k) => `<option value="${k}" ${k === n.status ? "selected" : ""}>${TAREFA_ST[k]}</option>`).join("")}</select></div></div>
    <label>Nota</label><textarea id="tf-nota">${esc(n.nota || "")}</textarea>
    <div class="modal-rodape">${t ? `<button type="button" class="btn perigo" id="tf-apagar">Excluir</button>` : ""}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
  $("#f-tf", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const dados = { titulo: $("#tf-t", m).value.trim(), cliente_id: $("#tf-c", m).value || null, tipo: $("#tf-tipo", m).value, responsavel: $("#tf-r", m).value.trim() || null,
      prioridade: $("#tf-p", m).value, prazo: $("#tf-prazo", m).value || null, status: $("#tf-s", m).value, nota: $("#tf-nota", m).value.trim() || null };
    try { if (t) await D.atualizar("tarefas", { id: t.id }, dados); else await D.inserir("tarefas", dados); fecharModal(); avisar("Tarefa salva.", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#tf-apagar", m)) $("#tf-apagar", m).onclick = async () => {
    if (!(await confirmar("Excluir esta tarefa?", "Excluir", true))) return;
    try { await D.apagar("tarefas", { id: t.id }); avisar("Tarefa excluída.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- Calendário geral
TELAS_ADMIN["calendario-geral"] = async (el, args) => {
  const mes = mesDe(args), nv = navMes(mes), c = clienteAtual();
  const posts = await D.lista("posts", filtroCliente({ gte: { data: nv.ini }, lte: { data: nv.fim }, ordem: "data" }));
  let mostrar = true;
  try { mostrar = localStorage.getItem("portal-datas-calendario") !== "nao"; } catch (_) { /* sem storage */ }
  const datas = R.datasDoMes(mes);
  el.innerHTML = `<div class="entre"><div><h1>Calendário geral</h1><p class="sub">${c ? esc(c.nome) : "Todos os clientes"}, incluindo o que ainda é interno.</p></div>
      <button class="btn pequeno" id="cg-datas">${mostrar ? "Esconder" : "Mostrar"} feriados e datas comemorativas</button></div>
    <div class="linha" style="margin-bottom:8px">${Object.keys(STATUS).map(tagS).join("")}</div>
    ${mostrar ? `<div class="linha" style="margin-bottom:12px">${Object.entries(R.TIPO_DATA).map(([k, n]) => `<span class="data-esp ${k} legenda">${esc(n)}</span>`).join("")}</div>` : ""}
    <div class="cartao"><div class="entre" style="margin-bottom:10px"><a class="btn pequeno" href="#/calendario-geral/${nv.ant}">Anterior</a><h3 style="margin:0">${esc(nv.nome)}</h3><a class="btn pequeno" href="#/calendario-geral/${nv.prox}">Próximo</a></div>
      ${gradeMes(mes, posts, { comCliente: !c, datas: mostrar ? datas : [] })}</div>
    ${mostrar ? `<div class="cartao"><h3>Datas importantes de ${esc(nv.nome.toLowerCase())}</h3><div class="lista">${datas.map((x) => `<div class="entre"><span><b>${esc(fmtDiaLongo(x.data))}</b> · ${esc(x.nome)}</span><span class="data-esp ${x.tipo} legenda">${esc(R.TIPO_DATA[x.tipo])}</span></div>`).join("")
      || `<div class="muted">Nenhuma data especial neste mês.</div>`}</div><p class="muted" style="margin-top:8px">Feriados estaduais e municipais não entram: confira os da cidade de cada cliente.</p></div>` : ""}`;
  $("#cg-datas").onclick = () => { try { localStorage.setItem("portal-datas-calendario", mostrar ? "nao" : "sim"); } catch (_) { /* sem storage */ } rotear(); };
  $$("[data-post]", el).forEach((b) => b.onclick = () => verPostAdmin(posts.find((x) => x.id === b.dataset.post)));
};
async function verPostAdmin(p) {
  const [capa, versoes] = await Promise.all([capaUrl(p).catch(() => ""), D.lista("post_versoes", { eq: { post_id: p.id }, ordem: "created_at" })]);
  const m = abrirModal(p.tema || "Conteúdo", `<div class="linha" style="margin-bottom:6px">${tagS(p.status)}<span class="muted">${p.visivel_cliente ? "cliente vê" : "só interno"}</span></div>
    <p>${esc(nomeCliente(p.cliente_id))} · ${esc(fmtDiaLongo(p.data))} · ${esc(nomeFormato(p.formato))} · versão ${Number(p.versao || 1)}</p>
    <div class="linha">${p.pilar ? tag("Pilar: " + p.pilar) : ""}${p.funil ? tag("Funil: " + p.funil) : ""}${p.nivel_consciencia ? tag("Consciência: " + p.nivel_consciencia) : ""}${p.objetivo ? tag("Objetivo: " + p.objetivo) : ""}</div>
    <div class="grid g2" style="margin-top:10px"><div class="prev" style="background:${capa ? `url('${esc(capa)}') center/cover` : gradiente(p.tema)}"><small>${esc(nomeFormato(p.formato))}</small>${capa ? "" : esc(p.tema)}</div>
      <div><p class="muted vleg">${esc(p.legenda || "Sem legenda ainda.")}</p>${linkSeguro(p.link_drive) ? `<p><a href="${esc(p.link_drive)}" target="_blank" rel="noopener">Pasta no Drive ↗</a></p>` : ""}
        ${versoes.length ? `<p class="muted">Versões: ${versoes.map((v) => "v" + v.versao + " " + esc(String(v.motivo || "").slice(0, 60))).join(" · ")}</p>` : ""}</div></div>
    <div class="modal-rodape" id="vp-acoes">${botoesAcao(p, versoes)}<button class="btn pequeno" id="vp-editar">Editar</button><button class="btn pequeno" data-fechar>Fechar</button></div>`);
  ligarAcoes(m, [p], rotear);
  $("#vp-editar", m).onclick = () => P.abrirPostSM(p, rotear);
}

// ----------------------------------------------------------------- Chamados internos
TELAS_ADMIN.chamados = async (el) => {
  const f = S.filtroChamados || (S.filtroChamados = { cat: "", prio: "", st: "abertos" });
  const todos = await D.lista("chamados", filtroCliente({ ordem: "-created_at" }));
  const cats = [...new Set(todos.map((x) => x.categoria).filter(Boolean))].sort();
  const cc = todos.filter((x) => (!f.cat || x.categoria === f.cat) && (!f.prio || x.prioridade === f.prio)
    && (f.st === "todos" || (f.st === "abertos" ? x.status !== "concluido" : x.status === f.st)));
  el.innerHTML = `<div class="entre"><div><h1>Chamados internos</h1><p class="sub">Tudo que pede uma ação sua cai aqui, criado automaticamente.</p></div><button class="btn primario" id="ch-novo">Novo chamado</button></div>
    <div class="linha" style="margin-bottom:12px">
      <select id="f-cat" style="width:auto"><option value="">Todas as categorias</option>${cats.map((x) => `<option ${x === f.cat ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
      <select id="f-prio" style="width:auto"><option value="">Toda prioridade</option>${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === f.prio ? "selected" : ""}>${v}</option>`).join("")}</select>
      <select id="f-st" style="width:auto"><option value="abertos" ${f.st === "abertos" ? "selected" : ""}>Abertos</option><option value="todos" ${f.st === "todos" ? "selected" : ""}>Todos</option>${Object.entries(CH_STATUS).map(([k, v]) => `<option value="${k}" ${k === f.st ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="cartao tabela"><table><tr><th>Aberto</th><th>Cliente</th><th>Categoria</th><th>Descrição</th><th>Prioridade</th><th>Prazo</th><th>Status</th></tr>
    ${cc.map((x) => `<tr><td>${esc(R.fmtDataCurta(x.created_at))}<br><span class="muted">${esc(ORIGEM[x.origem] || x.origem || "")}</span></td><td>${esc(nomeCliente(x.cliente_id))}</td><td>${esc(x.categoria || "")}</td>
      <td>${esc(x.descricao || "")}<br><a href="#" data-hist="${esc(x.id)}">histórico</a>${x.ref_tipo ? ` · <a href="#" data-ref="${esc(x.id)}">abrir ${esc({ post: "conteúdo", ideia: "ideia", briefing_alteracao: "briefing" }[x.ref_tipo] || "item")}</a>` : ""}${x.visivel_cliente ? "" : ` · <span class="muted">só interno</span>`}</td>
      <td>${tag(PRIO[x.prioridade] || "", PRIO_COR[x.prioridade])}</td><td>${x.prazo ? esc(R.fmtDataCurta(x.prazo)) : "-"}${x.prazo && x.prazo < hojeISO() && x.status !== "concluido" ? "<br>" + tag("vencido", "t-verm") : ""}</td>
      <td><select class="sel-ch" data-st="${esc(x.id)}">${Object.entries(CH_STATUS).map(([k, v]) => `<option value="${k}" ${k === x.status ? "selected" : ""}>${v}</option>`).join("")}</select></td></tr>`).join("")
      || `<tr><td colspan="7" class="muted">Nenhum chamado.</td></tr>`}</table></div>`;
  $("#f-cat").onchange = (e) => { f.cat = e.target.value; rotear(); };
  $("#f-prio").onchange = (e) => { f.prio = e.target.value; rotear(); };
  $("#f-st").onchange = (e) => { f.st = e.target.value; rotear(); };
  $$("[data-st]", el).forEach((s) => s.onchange = async () => {
    const ch = todos.find((x) => x.id === s.dataset.st), novo = s.value;
    try {
      await D.atualizar("chamados", { id: ch.id }, { status: novo, historico: comHistorico(ch, "Status: " + CH_STATUS[novo]) });
      if (ch.visivel_cliente && (novo === "concluido" || novo === "aguardando_cliente") && ch.origem === "solicitacao")
        await notificar("cliente", ch.cliente_id, novo === "concluido" ? "Sua solicitação foi concluída" : "Sua solicitação precisa de uma resposta sua", "#/solicitacoes");
      avisar(ch.visivel_cliente ? "Status atualizado. O cliente vê o andamento na tela Solicitações." : "Status atualizado.", "ok"); rotear();
    } catch (e) { s.value = ch.status; avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-hist]", el).forEach((a) => a.onclick = (ev) => {
    ev.preventDefault();
    const ch = todos.find((x) => x.id === a.dataset.hist), h = Array.isArray(ch.historico) ? ch.historico : [];
    abrirModal("Histórico do chamado", `<p class="muted">${esc(nomeCliente(ch.cliente_id))} · ${esc(ch.categoria || "")}</p><div class="lista">${h.map((x) => `<div><b>${esc(P.fmtData(x.em))}</b> ${esc(x.o || "")}</div>`).join("") || `<div class="muted">Sem registros.</div>`}</div>
      <div class="modal-rodape"><button class="btn" data-fechar>Fechar</button></div>`);
  });
  $$("[data-ref]", el).forEach((a) => a.onclick = async (ev) => {
    ev.preventDefault();
    const ch = todos.find((x) => x.id === a.dataset.ref);
    if (ch.ref_tipo === "briefing_alteracao") { location.hash = "#/onboarding"; return; }
    if (ch.ref_tipo === "post") { const p = await D.um("posts", { eq: { id: ch.ref_id } }); if (p) verPostAdmin(p); else avisar("Este conteúdo não existe mais."); return; }
    if (ch.ref_tipo === "ideia") verIdeia(ch.ref_id);
  });
  $("#ch-novo").onclick = () => {
    const m = abrirModal("Novo chamado", `<form id="f-ch"><div class="grade-form">
      <div><label>Cliente</label><select id="nc-c">${S.clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === S.clienteId ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div>
      <div><label>Categoria</label><input type="text" id="nc-cat" required placeholder="Ex.: Pendência de aprovação"></div>
      <div><label>Prioridade</label><select id="nc-p">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === "media" ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div><label>Prazo</label><input type="date" id="nc-prazo" value="${esc(somarDias(hojeISO(), 2))}"></div></div>
      <label>Descrição</label><textarea id="nc-d" required></textarea>
      <label class="check"><input type="checkbox" id="nc-vis"> O cliente vê este chamado em Solicitações</label>
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Abrir chamado</button></div></form>`);
    $("#f-ch", m).onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await D.inserir("chamados", { cliente_id: $("#nc-c", m).value, origem: "interno", categoria: $("#nc-cat", m).value.trim(), descricao: $("#nc-d", m).value.trim(), prioridade: $("#nc-p", m).value,
          prazo: $("#nc-prazo", m).value || null, status: "novo", visivel_cliente: $("#nc-vis", m).checked, historico: [{ em: agoraISO(), o: "Aberto pela administração" }] });
        fecharModal(); avisar("Chamado aberto.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
};
async function verIdeia(id) {
  const i = await D.um("ideias", { eq: { id } });
  if (!i) { avisar("Esta ideia não existe mais."); return; }
  const coms = await D.lista("ideia_comentarios", { eq: { ideia_id: id }, ordem: "created_at" });
  const m = abrirModal(i.titulo || "Ideia", `<div class="linha">${i.categoria ? tag(i.categoria) : ""}${tag(i.autor === "social_media" ? "Enviado pela social media" : "Enviado pelo cliente", i.autor === "social_media" ? "t-terra" : "")}</div>
    <p style="white-space:pre-wrap">${esc(i.conteudo || "")}</p>${linkSeguro(i.link) ? `<p><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.link)}</a></p>` : ""}
    <label>Status</label><select id="vi-st">${Object.entries(IDEIA_ST).map(([k, v]) => `<option value="${k}" ${k === i.status ? "selected" : ""}>${esc(v[0])}</option>`).join("")}</select>
    <label>Comentários</label><div class="lista">${coms.map((x) => `<div><b>${x.autor_papel === "cliente" ? "Cliente" : "Você"}:</b> ${esc(x.texto)}</div>`).join("") || `<div class="muted">Sem comentários.</div>`}</div>
    <textarea id="vi-com" placeholder="Responder ao cliente..."></textarea>
    <div class="modal-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn primario" id="vi-ok">Salvar</button></div>`);
  $("#vi-ok", m).onclick = async () => {
    try {
      const st = $("#vi-st", m).value, t = $("#vi-com", m).value.trim();
      if (st !== i.status) await D.atualizar("ideias", { id }, { status: st });
      if (t) {
        await D.inserir("ideia_comentarios", { ideia_id: id, cliente_id: i.cliente_id, autor_papel: "social_media", texto: t });
        await notificar("cliente", i.cliente_id, `Nova resposta na ideia "${i.titulo || "sua ideia"}"`, "#/ideias");
      }
      fecharModal(); avisar("Ideia atualizada.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- telas das próximas fases (as atuais seguem abertas)
// Operação e Planejamento: js/operacao.js. CRM, Funil, Customer Success e Indicadores: js/comercial.js.
// Clientes, Agenda, Arquivos, Configurações e Automações ficam em js/gestao.js (fase 3).
P.R.admin = { verPostAdmin, botoesAcao, ligarAcoes };
// Tudo registrado: o portal pode começar.
P.iniciar();
})();

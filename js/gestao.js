// =============================================================================
// gestao.js: reforma, fase 3.
//   Cliente: Arquivos, Relatórios.
//   Administração: Arquivos, Agenda,
//   Clientes (planos, contrato, Ver como cliente) e Configurações (identidade,
//   regras de aprovação, planos e biblioteca de prompts).
// Planos e prompts vêm das tabelas planos e prompts_modelo. O modelo de contrato
// fica aqui no código, com campos entre colchetes para revisar.
// =============================================================================
(function () {
"use strict";
const P = window.__portal;
const R = P.R;
const { S, GANCHO, ROTAS, $, $$, esc, hojeISO, mesAtual, somarDias, fmtData, fmtMoeda, fmtNum, nomeMes, avisar, erroAmigavel, abrirModal, fecharModal,
  confirmar, clienteAtual, slugify, md, tempoRelativo } = P;
const { D, CATS_ARQ, LINK_DRIVE, tag, nomeCliente, prazoDias, rodadas, agoraISO, linkSeguro, caixaCopiar, ligarCopiar, notificar, fmtDiaLongo,
  TELAS_CLIENTE, TELAS_ADMIN, rotear, ETAPAS_ONB } = R;
const cliPorId = (id) => S.clientes.find((c) => c.id === id) || {};
// ================================================================= CLIENTE
// ----------------------------------------------------------------- Arquivos (só links, para o portal ficar leve)
TELAS_CLIENTE.arquivos = async (el, args) => {
  if (args[0] === "publicados") return ROTAS["c-acervo"](el);
  const c = clienteAtual();
  const aa = await D.lista("arquivos", { eq: { cliente_id: c.id }, ordem: "-created_at" });
  const cats = [...new Set([...CATS_ARQ.filter((k) => aa.some((a) => a.categoria === k)), ...aa.map((a) => a.categoria)])];
  el.innerHTML = `<div class="entre"><div><h1>Arquivos</h1><p class="sub">Sua biblioteca organizada por categoria. Cada arquivo é um link do Google Drive.</p></div><button class="btn primario" id="ar-enviar">Enviar arquivo</button></div>
    <div class="grid g3">${cats.map((k) => `<div class="cartao"><h3>${esc(k)}</h3><div class="lista">${aa.filter((a) => a.categoria === k).map((a) => `<div class="entre"><span>${esc(a.nome)}${a.enviado_pelo_cliente ? `<br><span class="muted">enviado por você</span>` : ""}</span>${linkSeguro(a.link) ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">Abrir ↗</a>` : ""}</div>`).join("")}</div></div>`).join("")
      || `<div class="vazio" style="grid-column:1/-1">Nenhum arquivo ainda.</div>`}
      <a class="cartao pasta" href="#/arquivos/publicados" style="text-decoration:none"><h3>Conteúdos publicados</h3><div class="muted">Tudo o que já foi ao ar, com roteiros e legendas.</div></a></div>`;
  $("#ar-enviar").onclick = () => {
    const m = abrirModal("Enviar arquivo", `<p class="muted">Suba o arquivo no seu Google Drive, compartilhe como "qualquer pessoa com o link pode ver" e cole o link aqui.</p><form id="f-ar">
      <label>Pasta</label><select id="ar-cat">${CATS_ARQ.map((k) => `<option ${k === "Documentos compartilhados" ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>
      <label>Nome</label><input type="text" id="ar-nome" required placeholder="Ex.: fotos da loja de novembro">
      <label>Link do Google Drive</label><input type="url" id="ar-link" required placeholder="https://drive.google.com/...">
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Enviar</button></div></form>`);
    $("#f-ar", m).onsubmit = async (ev) => {
      ev.preventDefault();
      const link = $("#ar-link", m).value.trim();
      if (!LINK_DRIVE.test(link)) { avisar("Cole um link do Google Drive.", "erro"); return; }
      try { await D.inserir("arquivos", { cliente_id: c.id, categoria: $("#ar-cat", m).value, nome: $("#ar-nome", m).value.trim(), link, enviado_pelo_cliente: true }); fecharModal(); avisar("Arquivo enviado. A social media vê na pasta do seu perfil.", "ok"); rotear(); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
};

// ----------------------------------------------------------------- Relatórios (mensal e quinzenal)
TELAS_CLIENTE.relatorios = async (el, args) => {
  const c = clienteAtual();
  const [rr, dias, pubs, mets] = await Promise.all([
    D.lista("relatorios", { eq: { cliente_id: c.id, publicado: true }, ordem: "-mes" }),
    D.lista("metricas_conta", { eq: { cliente_id: c.id }, ordem: "data" }),
    D.lista("posts", { eq: { cliente_id: c.id, status: "publicado" }, ordem: "-data", limite: 60 }, "id,data,formato").catch(() => []),
    D.lista("metricas_post", { eq: { cliente_id: c.id } }, "post_id,alcance,canal").catch(() => []),
  ]);
  // Alcance médio por post hoje: média dos últimos 9 posts publicados (sem stories e sem testes) que já têm alcance.
  const alcances = pubs.filter((p) => p.formato !== "stories")
    .map((p) => mets.find((m) => m.post_id === p.id && m.canal !== "teste" && m.alcance != null)).filter(Boolean).slice(0, 9).map((m) => Number(m.alcance));
  const alcHoje = alcances.length ? Math.round(alcances.reduce((s, x) => s + x, 0) / alcances.length) : null;
  rr.sort((a, b) => b.mes.localeCompare(a.mes) || (a.tipo === "quinzenal" ? 1 : -1));
  const titulo = (r) => (r.tipo === "quinzenal" ? "Análise quinzenal de " : "Relatório de ") + nomeMes(r.mes);
  const r = rr.find((x) => x.id === args[0]) || rr[0];
  const pp = c.ponto_de_partida || {}, ultimo = [...dias].reverse().find((d) => d.seguidores != null) || {};
  const dif = pp.seguidores != null && ultimo.seguidores != null ? ultimo.seguidores - pp.seguidores : null;
  el.innerHTML = `<h1>Relatórios</h1>
    ${rr.length ? `<div class="linha" style="margin-bottom:12px">${rr.map((x) => `<a class="btn pequeno ${x === r ? "primario" : ""}" href="#/relatorios/${esc(x.id)}">${x.tipo === "quinzenal" ? "Quinzenal" : "Mensal"}: ${esc(nomeMes(x.mes))}</a>`).join("")}</div>
      <div class="cartao" id="rel-atual"><div class="entre"><h2 style="margin:0">${esc(titulo(r))}</h2><button class="btn pequeno" id="rel-imprimir">Imprimir ou salvar em PDF</button></div>
        <p class="muted">${r.tipo === "quinzenal" ? "A quinzena comparada com a anterior." : "O mês inteiro, comparado com o mês anterior."}</p>${md(r.conteudo)}</div>`
      : `<div class="faixa alerta">O primeiro relatório aparece aqui no fechamento do mês.</div>`}
    <div class="grid g4 sec">
      <div class="kpi"><div class="n">${ultimo.seguidores != null ? fmtNum(ultimo.seguidores) : "-"}</div><div class="l">Seguidores hoje</div>${dif != null ? `<div class="d ${dif >= 0 ? "up" : "down"}">${dif >= 0 ? "+" : ""}${fmtNum(dif)} desde o começo</div>` : ""}</div>
      <div class="kpi"><div class="n">${fmtNum(dias.filter((d) => String(d.data).startsWith(mesAtual())).reduce((s, d) => s + (d.novos_seguidores || 0), 0))}</div><div class="l">Novos seguidores no mês</div></div>
      <div class="kpi"><div class="n">${fmtNum(dias.filter((d) => String(d.data).startsWith(mesAtual())).reduce((s, d) => s + (d.alcance || 0), 0))}</div><div class="l">Alcance somado no mês</div></div>
      <div class="kpi"><div class="n">${alcHoje != null ? fmtNum(alcHoje) : "-"}</div><div class="l">Alcance médio por post${alcances.length ? ` (últimos ${alcances.length})` : ""}</div>${pp.alcance_medio ? `<div class="d ${alcHoje == null || alcHoje >= pp.alcance_medio ? "up" : "down"}">No começo: ${fmtNum(pp.alcance_medio)}${alcHoje != null ? ` (${alcHoje >= pp.alcance_medio ? "+" : ""}${Math.round((alcHoje / pp.alcance_medio - 1) * 100)}%)` : ""}</div>` : ""}</div>
    </div>`;
  if ($("#rel-imprimir")) $("#rel-imprimir").onclick = () => { const d = $("#rel-atual"); d.classList.add("imprimir"); window.print(); setTimeout(() => d.classList.remove("imprimir"), 500); };
};

// ================================================================= ADMINISTRAÇÃO
// ----------------------------------------------------------------- Arquivos
TELAS_ADMIN.arquivos = async (el) => {
  const c = clienteAtual();
  if (!c) {
    const todos = await D.lista("arquivos", {}, "cliente_id,categoria");
    el.innerHTML = `<h1>Arquivos</h1><p class="sub">Escolha um cliente para ver as pastas.</p><div class="grid g3">${S.clientes.map((x) => { const n = todos.filter((a) => a.cliente_id === x.id);
      return `<button class="cartao pasta" data-cli-pasta="${esc(x.id)}"><div class="linha"><div class="mono-cli">${esc((x.nome || "?").slice(0, 1))}</div><div><b>${esc(x.nome)}</b><div class="muted">${new Set(n.map((a) => a.categoria)).size} pastas · ${n.length} arquivos</div></div></div></button>`; }).join("")}</div>`;
    $$("[data-cli-pasta]", el).forEach((b) => b.onclick = () => { S.clienteId = b.dataset.cliPasta; S.arqCat = null; rotear(); });
    return;
  }
  const aa = await D.lista("arquivos", { eq: { cliente_id: c.id }, ordem: "-created_at" });
  const cats = [...new Set([...CATS_ARQ, ...aa.map((a) => a.categoria)])];
  if (S.arqCat && S.arqCatCliente === c.id) {
    const lst = aa.filter((a) => a.categoria === S.arqCat);
    el.innerHTML = `<div class="entre"><div><a href="#" id="arq-voltar">‹ ${esc(c.nome)}</a><h1 style="margin-top:6px">${esc(S.arqCat)}</h1></div><button class="btn primario" id="arq-novo">Adicionar link</button></div>
      <div class="cartao lista">${lst.map((a) => `<div class="entre"><span><b>${esc(a.nome)}</b><br><span class="muted">${a.enviado_pelo_cliente ? "enviado pelo cliente" : "compartilhado com o cliente"} · ${esc(fmtData(a.created_at))}</span></span>
        <span class="linha">${linkSeguro(a.link) ? `<a class="btn pequeno" href="${esc(a.link)}" target="_blank" rel="noopener">Abrir no Drive ↗</a>` : ""}<button class="btn pequeno perigo" data-tirar="${esc(a.id)}">Remover</button></span></div>`).join("") || `<div class="muted">Pasta vazia.</div>`}</div>`;
    $("#arq-voltar").onclick = (ev) => { ev.preventDefault(); S.arqCat = null; rotear(); };
  } else {
    el.innerHTML = `<div class="entre"><div><h1>Arquivos: ${esc(c.nome)}</h1><p class="sub">Pastas por categoria. Cada arquivo é um link (Drive), para o portal continuar leve.</p></div><button class="btn primario" id="arq-novo">Adicionar link</button></div>
      <div class="grid g3">${cats.map((k) => `<button class="cartao pasta" data-cat="${esc(k)}"><div style="font-size:24px;line-height:1">🗀</div><b>${esc(k)}</b><div class="muted">${aa.filter((a) => a.categoria === k).length} arquivo(s)</div></button>`).join("")}</div>`;
    $$("[data-cat]", el).forEach((b) => b.onclick = () => { S.arqCat = b.dataset.cat; S.arqCatCliente = c.id; rotear(); });
  }
  $$("[data-tirar]", el).forEach((b) => b.onclick = async () => {
    if (!(await confirmar("Remover este link da pasta? O arquivo no Drive não é apagado.", "Remover", true))) return;
    try { await D.apagar("arquivos", { id: b.dataset.tirar }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $("#arq-novo").onclick = () => {
    const m = abrirModal("Adicionar link", `<p class="muted">${esc(c.nome)}</p><form id="f-arq"><label>Pasta</label><select id="aq-cat">${CATS_ARQ.map((k) => `<option ${k === S.arqCat ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>
      <label>Nome</label><input type="text" id="aq-nome" required><label>Link do Google Drive</label><input type="url" id="aq-link" required placeholder="https://drive.google.com/...">
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
    $("#f-arq", m).onsubmit = async (ev) => {
      ev.preventDefault();
      const link = $("#aq-link", m).value.trim();
      if (!LINK_DRIVE.test(link)) { avisar("Cole um link do Google Drive.", "erro"); return; }
      const cat = $("#aq-cat", m).value, nome = $("#aq-nome", m).value.trim();
      try {
        await D.inserir("arquivos", { cliente_id: c.id, categoria: cat, nome, link, enviado_pelo_cliente: false });
        await notificar("cliente", c.id, `Novo arquivo em ${cat}: ${nome}`, "#/arquivos");
        fecharModal(); avisar("Link salvo. O cliente vê na pasta dele.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
};

// ----------------------------------------------------------------- Agenda
const TIPOS_AGENDA = ["Reunião", "Onboarding", "Apresentação estratégica", "Gravação", "Prazo interno", "Follow-up comercial", "Outro"];
TELAS_ADMIN.agenda = async (el) => {
  const verPassados = !!S.agendaPassados, hoje = hojeISO();
  const itens = await D.lista("agenda", verPassados ? { ordem: "-data" } : { gte: { data: hoje }, ordem: "data" });
  itens.sort((a, b) => (verPassados ? -1 : 1) * ((a.data + (a.hora || "")).localeCompare(b.data + (b.hora || ""))));
  el.innerHTML = `<div class="entre"><div><h1>Agenda</h1><p class="sub">Compromissos compartilhados aparecem no Início do cliente. Os internos ficam só aqui.</p></div>
      <div class="linha"><button class="btn pequeno" id="ag-passados">${verPassados ? "Ver próximos" : "Ver passados"}</button><button class="btn primario" id="ag-novo">Novo compromisso</button></div></div>
    <div class="cartao tabela"><table><tr><th>Quando</th><th>Compromisso</th><th>Cliente</th><th>Tipo</th><th>Cliente vê?</th><th></th></tr>
    ${itens.map((g) => `<tr><td>${esc(fmtDiaLongo(g.data))}${g.hora ? ", " + esc(String(g.hora).slice(0, 5)) : ""}</td><td>${esc(g.titulo || "")}</td><td>${g.cliente_id ? esc(nomeCliente(g.cliente_id)) : g.lead_id ? "Comercial" : "-"}</td><td>${esc(g.tipo || "")}</td>
      <td>${g.cliente_id ? `<button class="sw ${g.compartilhado ? "on" : ""}" data-comp="${esc(g.id)}" aria-label="Cliente vê"></button>` : `<span class="muted">interno</span>`}</td>
      <td><button class="btn pequeno fantasma" data-editar="${esc(g.id)}">Editar</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nenhum compromisso${verPassados ? "" : " a partir de hoje"}.</td></tr>`}</table></div>`;
  $("#ag-passados").onclick = () => { S.agendaPassados = !verPassados; rotear(); };
  $$("[data-comp]", el).forEach((b) => b.onclick = async () => {
    const g = itens.find((x) => x.id === b.dataset.comp);
    try {
      await D.atualizar("agenda", { id: g.id }, { compartilhado: !g.compartilhado });
      if (!g.compartilhado) await notificar("cliente", g.cliente_id, `Novo compromisso: ${g.titulo} (${fmtDiaLongo(g.data)}${g.hora ? ", " + String(g.hora).slice(0, 5) : ""})`, "#/inicio");
      rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-editar]", el).forEach((b) => b.onclick = () => formAgenda(itens.find((x) => x.id === b.dataset.editar)));
  $("#ag-novo").onclick = () => formAgenda(null);
};
function formAgenda(g) {
  const n = g || { data: hojeISO(), hora: "10:00", tipo: "Reunião", cliente_id: S.clienteId || "", compartilhado: false };
  const m = abrirModal(g ? "Editar compromisso" : "Novo compromisso", `<form id="f-ag"><label>Título</label><input type="text" id="ag-t" required value="${esc(n.titulo || "")}">
    <div class="grade-form"><div><label>Data</label><input type="date" id="ag-d" required value="${esc(n.data || "")}"></div><div><label>Hora</label><input type="time" id="ag-h" value="${esc(String(n.hora || "").slice(0, 5))}"></div>
      <div><label>Tipo</label><select id="ag-tipo">${TIPOS_AGENDA.map((x) => `<option ${x === n.tipo ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div><label>Cliente</label><select id="ag-c"><option value="">Nenhum (interno)</option>${S.clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === n.cliente_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div></div>
    <label class="check"><input type="checkbox" id="ag-comp" ${n.compartilhado ? "checked" : ""}> O cliente vê este compromisso no Início dele</label>
    <div class="modal-rodape">${g ? `<button type="button" class="btn perigo" id="ag-apagar">Excluir</button>` : ""}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
  $("#f-ag", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const cid = $("#ag-c", m).value || null;
    const dados = { titulo: $("#ag-t", m).value.trim(), data: $("#ag-d", m).value, hora: $("#ag-h", m).value || null, tipo: $("#ag-tipo", m).value, cliente_id: cid, compartilhado: !!cid && $("#ag-comp", m).checked };
    try {
      if (g) await D.atualizar("agenda", { id: g.id }, dados); else await D.inserir("agenda", dados);
      if (dados.compartilhado && (!g || !g.compartilhado)) await notificar("cliente", cid, `Novo compromisso: ${dados.titulo} (${fmtDiaLongo(dados.data)}${dados.hora ? ", " + dados.hora : ""})`, "#/inicio");
      fecharModal(); avisar("Compromisso salvo.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#ag-apagar", m)) $("#ag-apagar", m).onclick = async () => {
    if (!(await confirmar("Excluir este compromisso?", "Excluir", true))) return;
    try { await D.apagar("agenda", { id: g.id }); avisar("Compromisso excluído.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- Clientes
const STATUS_CLI = { ativo: "ativo", onboarding: "onboarding", pausado: "pausado", encerrado: "encerrado" };
const somarMeses = (iso, n) => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); d.setMonth(d.getMonth() + Number(n || 0)); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
R.cadastrarCliente = cadastrarCliente;

/** Exclui o cliente e, pelo banco (on delete cascade), tudo o que é dele. Pede para digitar o nome. */
function excluirCliente(c) {
  const m = abrirModal("Excluir cliente: " + c.nome, `<form id="f-xcl">
    <div class="faixa alerta">Isto apaga <b>de vez</b> o cliente e tudo o que é dele no portal: posts, calendário, aprovações, briefing, Cérebro da Marca, ideias, chamados, tarefas, agenda, arquivos, relatórios e métricas. Não dá para desfazer. No CRM, o lead continua, só perde o vínculo com o cliente.</div>
    <p>Se for só uma pausa ou fim de contrato, prefira mudar o status para <b>pausado</b> ou <b>encerrado</b> em Editar.</p>
    <label>Para confirmar, digite o nome do cliente: <b>${esc(c.nome)}</b></label><input type="text" id="xc-nome" autocomplete="off" required>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn perigo" id="xc-ok" disabled>Excluir para sempre</button></div></form>`);
  const normal = (t) => String(t || "").trim().toLowerCase();
  $("#xc-nome", m).oninput = () => { $("#xc-ok", m).disabled = normal($("#xc-nome", m).value) !== normal(c.nome); };
  $("#f-xcl", m).onsubmit = async (ev) => {
    ev.preventDefault();
    if (normal($("#xc-nome", m).value) !== normal(c.nome)) return;
    $("#xc-ok", m).disabled = true;
    try {
      await D.apagar("clientes", { id: c.id });
      // O banco pode recusar em silêncio (permissão): confere se sumiu mesmo
      if (await D.um("clientes", { eq: { id: c.id } })) throw { erro: "O banco não deixou excluir este cliente. Confira se você entrou como social media." };
      if (S.clienteId === c.id) { S.clienteId = null; try { localStorage.setItem("portal-cliente", ""); } catch (_) { /* sem storage */ } }
      await P.carregarClientes();
      fecharModal(); avisar(`Cliente "${c.nome}" excluído.`, "ok"); rotear();
    } catch (e) { $("#xc-ok", m).disabled = false; avisar(erroAmigavel(e), "erro"); }
  };
}
TELAS_ADMIN.clientes = async (el) => {
  const planos = await D.lista("planos", { ordem: "ordem" }).catch(() => []);
  const hoje = hojeISO();
  el.innerHTML = `<div class="entre"><div><h1>Clientes</h1><p class="sub">Cadastro, plano, contrato e usuários.</p></div><button class="btn primario" id="cl-novo">Cadastrar cliente</button></div>
    <div class="cartao tabela"><table><tr><th>Cliente</th><th>Plano</th><th>Contrato</th><th>Mensalidade</th><th>Status</th><th>Instagram</th><th></th></tr>
    ${S.clientes.map((c) => { const fim = c.contrato_fim, dias = fim ? Math.round((new Date(fim + "T12:00:00") - new Date(hoje + "T12:00:00")) / 864e5) : null; const e = c.escopo || {};
      return `<tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.plano || "-")}<br><span class="muted">${e.posts_mes ? e.posts_mes + " posts · " : ""}${rodadas(c)} ajustes · ${prazoDias(c)} dias p/ aprovar</span></td>
        <td>${c.contrato_inicio ? esc(fmtData(c.contrato_inicio)) : "?"} a ${fim ? esc(fmtData(fim)) : "?"}${dias != null && dias >= 0 && dias < 60 ? "<br>" + tag("renova em " + dias + " dias", "t-ambar") : dias != null && dias < 0 ? "<br>" + tag("contrato vencido", "t-verm") : ""}</td>
        <td>${esc(fmtMoeda(c.valor_mensal))}</td><td>${tag(c.status || "", c.status === "ativo" ? "t-verde" : "t-ambar")}</td>
        <td>${esc(c.instagram || "-")}</td>
        <td><div class="acoes-col"><button class="btn pequeno" data-editar="${esc(c.id)}">Editar</button><button class="btn pequeno" data-contrato="${esc(c.id)}">Contrato</button>
          <button class="btn pequeno" data-vercomo="${esc(c.id)}">Ver como cliente</button><button class="btn pequeno fantasma" data-config="${esc(c.id)}">Mais configurações</button><button class="btn pequeno fantasma perigo" data-excluir-cli="${esc(c.id)}">Excluir cliente</button></div></td></tr>`; }).join("")
      || `<tr><td colspan="7" class="muted">Nenhum cliente ainda.</td></tr>`}</table></div>
    ${planos.length ? "" : `<div class="faixa alerta">A tabela de planos está vazia. Cadastre os planos em Configurações para usar no cadastro e no contrato.</div>`}`;
  $("#cl-novo").onclick = () => cadastrarCliente(planos);
  $$("[data-editar]", el).forEach((b) => b.onclick = () => editarCliente(cliPorId(b.dataset.editar), planos));
  $$("[data-contrato]", el).forEach((b) => b.onclick = () => gerarContrato(cliPorId(b.dataset.contrato), planos));
  $$("[data-vercomo]", el).forEach((b) => b.onclick = () => R.entrarVerComo(b.dataset.vercomo));
  $$("[data-excluir-cli]", el).forEach((b) => b.onclick = () => excluirCliente(cliPorId(b.dataset.excluirCli)));
  $$("[data-config]", el).forEach((b) => b.onclick = () => { S.clienteId = b.dataset.config; location.hash = "#/config-cliente"; });
};
const opcoesPlano = (planos, atual) => `<option value="">Escolha</option>${planos.map((p) => `<option value="${esc(p.nome)}" ${p.nome === atual ? "selected" : ""}>${esc(p.nome)} · ${Number(p.valor) === 0 ? "gratuito" : esc(fmtMoeda(p.valor))}</option>`).join("")}${atual && !planos.some((p) => p.nome === atual) ? `<option selected>${esc(atual)}</option>` : ""}`;
function cadastrarCliente(planos, pre = {}, depois = null) {
  const m = abrirModal("Cadastrar cliente", `<form id="f-cad"><div class="grade-form">
    <div><label>Nome da marca</label><input type="text" id="cd-nome" required value="${esc(pre.nome || "")}"></div><div><label>Identificador (slug)</label><input type="text" id="cd-slug" required placeholder="nome-da-marca" value="${esc(pre.nome ? slugify(pre.nome) : "")}"></div>
    <div><label>E-mail de acesso do cliente</label><input type="email" id="cd-email" required></div><div><label>Instagram</label><input type="text" id="cd-ig" placeholder="@perfil" value="${esc(pre.instagram || "")}"></div>
    <div><label>Plano</label><select id="cd-plano">${opcoesPlano(planos, "")}</select></div><div><label>Mensalidade (R$)</label><input type="number" id="cd-valor" min="0" step="0.01" value="${esc(pre.valor ?? "")}"></div></div>
    <p class="muted">O cliente recebe o convite por e-mail. O onboarding começa com o cadastro e o acesso já marcados.</p>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Cadastrar e iniciar onboarding</button></div></form>`);
  $("#cd-nome", m).oninput = () => { $("#cd-slug", m).value = slugify($("#cd-nome", m).value); };
  $("#cd-plano", m).onchange = () => { const p = planos.find((x) => x.nome === $("#cd-plano", m).value); if (p && p.valor != null) $("#cd-valor", m).value = p.valor; };
  $("#f-cad", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("button.primario", m); btn.disabled = true; btn.textContent = "Enviando...";
    const plano = planos.find((x) => x.nome === $("#cd-plano", m).value) || null, hoje = hojeISO();
    try {
      const r = await D.funcao("client-invite", { nome: $("#cd-nome", m).value.trim(), slug: slugify($("#cd-slug", m).value), email: $("#cd-email", m).value.trim(),
        instagram: $("#cd-ig", m).value.trim(), plano: plano ? plano.nome : null, valor_mensal: Number($("#cd-valor", m).value) || null, redirect_to: location.origin + location.pathname });
      if (r && r.cliente_id) {
        const extra = { contrato_inicio: hoje, status: "onboarding" };
        if (plano) Object.assign(extra, { contrato_fim: Number(plano.contrato_minimo_meses) > 0 ? somarMeses(hoje, plano.contrato_minimo_meses) : null, escopo: { posts_mes: plano.posts_mes || null, rodadas_ajuste: plano.rodadas_ajuste || 2, prazo_aprovacao_dias: 2 } });
        await D.atualizar("clientes", { id: r.cliente_id }, extra).catch(() => null);
        await R.salvarRegistro(r.cliente_id, "onboarding", { onb1: agoraISO(), onb2: agoraISO() }).catch((e) => avisar("O cliente foi cadastrado, mas não consegui marcar as etapas do onboarding: " + erroAmigavel(e), "erro"));
      }
      await P.carregarClientes();
      if (depois && r && r.cliente_id) await depois(r.cliente_id);
      abrirModal("Cliente cadastrado", `<div class="faixa ok">${esc((r && r.mensagem) || "Convite enviado.")}</div><p class="muted">Próximo passo: acompanhe a jornada em Onboarding.</p>
        <div class="modal-rodape"><a class="btn primario" href="#/onboarding" data-fechar>Ir para Onboarding</a></div>`);
    } catch (e) { btn.disabled = false; btn.textContent = "Cadastrar e iniciar onboarding"; avisar(erroAmigavel(e), "erro"); }
  };
}
function editarCliente(c, planos) {
  const e = c.escopo || {};
  const m = abrirModal("Editar cliente: " + c.nome, `<form id="f-ecl"><div class="grade-form">
    <div><label>Plano</label><select id="ec-plano">${opcoesPlano(planos, c.plano)}</select></div><div><label>Mensalidade (R$)</label><input type="number" id="ec-valor" min="0" step="0.01" value="${esc(c.valor_mensal ?? "")}"></div>
    <div><label>Início do contrato</label><input type="date" id="ec-ini" value="${esc(c.contrato_inicio || "")}"></div><div><label>Fim do contrato</label><input type="date" id="ec-fim" value="${esc(c.contrato_fim || "")}"></div>
    <div><label>Aniversário da marca</label><input type="date" id="ec-aniv" value="${esc(c.aniversario || "")}"></div><div><label>Status</label><select id="ec-st">${Object.keys(STATUS_CLI).map((k) => `<option ${k === c.status ? "selected" : ""}>${k}</option>`).join("")}</select></div>
    <div><label>Posts por mês</label><input type="number" id="ec-posts" min="0" value="${esc(e.posts_mes ?? "")}"></div><div><label>Rodadas de ajuste por conteúdo</label><input type="number" id="ec-rod" min="0" value="${esc(e.rodadas_ajuste ?? 2)}"></div>
    <div><label>Prazo de aprovação (dias)</label><input type="number" id="ec-prazo" min="1" value="${esc(e.prazo_aprovacao_dias ?? 2)}"></div></div>
    <button type="button" class="btn pequeno" id="ec-aplicar">Usar os números do plano escolhido</button>
    <div class="modal-rodape"><button type="button" class="btn perigo" id="ec-excluir" style="margin-right:auto">Excluir cliente</button><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
  $("#ec-excluir", m).onclick = () => excluirCliente(c);
  $("#ec-aplicar", m).onclick = () => {
    const p = planos.find((x) => x.nome === $("#ec-plano", m).value);
    if (!p) { avisar("Escolha um plano cadastrado."); return; }
    if (p.valor != null) $("#ec-valor", m).value = p.valor;
    if (p.posts_mes != null) $("#ec-posts", m).value = p.posts_mes;
    if (p.rodadas_ajuste != null) $("#ec-rod", m).value = p.rodadas_ajuste;
    if ($("#ec-ini", m).value && !$("#ec-fim", m).value && Number(p.contrato_minimo_meses) > 0) $("#ec-fim", m).value = somarMeses($("#ec-ini", m).value, p.contrato_minimo_meses);
  };
  $("#f-ecl", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const num = (s) => ($(s, m).value === "" ? null : Number($(s, m).value));
    const dados = { plano: $("#ec-plano", m).value || null, valor_mensal: num("#ec-valor"), contrato_inicio: $("#ec-ini", m).value || null, contrato_fim: $("#ec-fim", m).value || null,
      aniversario: $("#ec-aniv", m).value || null, status: $("#ec-st", m).value,
      escopo: Object.assign({}, e, { posts_mes: num("#ec-posts"), rodadas_ajuste: num("#ec-rod"), prazo_aprovacao_dias: num("#ec-prazo") }) };
    try { await D.atualizar("clientes", { id: c.id }, dados); Object.assign(c, dados); fecharModal(); avisar("Cliente atualizado.", "ok"); rotear(); } catch (er) { avisar(erroAmigavel(er), "erro"); }
  };
}
/** Modelo de contrato (texto base para revisar com um advogado; campos entre colchetes). */
function textoContrato(c, p) {
  const e = c.escopo || {}, ini = c.contrato_inicio || hojeISO();
  const entregas = p ? [p.posts_mes ? `${p.posts_mes} posts por mês` : "", p.dias ? `publicações em ${p.dias}` : "", p.stories ? `stories: ${p.stories}` : "", p.reels ? `reels: ${p.reels}` : "",
    p.captacao ? `captação de vídeo: ${p.captacao}` : ""].filter(Boolean) : [];
  const itens = [...entregas, ...((p && p.entregaveis) || [])].map((x) => "  - " + x).join("\n") || "  - [descrever os entregáveis]";
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL

CONTRATANTE: ${c.nome}, inscrita no CPF/CNPJ [número], com endereço em [endereço].
CONTRATADA: [nome da empresa], inscrita no CNPJ [número], com sede em [cidade].

CLÁUSULA 1 - OBJETO
Prestação de serviços de planejamento de conteúdo e gestão de redes sociais, plano ${c.plano || (p && p.nome) || "[plano]"}:
${itens}
  - Relatório de desempenho ${p && p.relatorio ? String(p.relatorio).toLowerCase() : "[periodicidade]"}
Perfil atendido: Instagram ${c.instagram || "[@perfil]"}

CLÁUSULA 2 - OBRIGAÇÕES DO CONTRATANTE
a) Enviar as informações, fotos e vídeos necessários para a produção; b) Analisar e responder aos materiais enviados para aprovação em até ${e.prazo_aprovacao_dias || 2} dias. A falta de resposta não é considerada aprovação; c) Solicitar ajustes dentro do limite de ${e.rodadas_ajuste ?? (p && p.rodadas_ajuste) ?? 2} rodada(s) por conteúdo.

CLÁUSULA 3 - OBRIGAÇÕES DA CONTRATADA
a) Prestar os serviços descritos com qualidade e nos prazos combinados; b) Elaborar o relatório de desempenho; c) Manter sigilo sobre as informações do CONTRATANTE, inclusive após o fim do contrato; d) Emitir nota fiscal mensal.

CLÁUSULA 4 - VALOR E PAGAMENTO
${!Number(c.valor_mensal) && (!p || !Number(p.valor)) ? "Período de teste gratuito: nenhum valor é cobrado pelos serviços do plano durante o teste." : `${fmtMoeda(c.valor_mensal || (p && p.valor) || 0)} por mês, pagos [forma e data de pagamento].`} Impulsionamento pago e serviços fora do plano são orçados à parte.

CLÁUSULA 5 - VIGÊNCIA E RESCISÃO
${p && Number(p.contrato_minimo_meses) === 0 ? `a) Período de teste sem prazo mínimo, a partir de ${fmtData(ini)}. Qualquer das partes pode encerrar a qualquer momento, com aviso por escrito; b) Ao fim do teste, a continuidade depende de um novo plano contratado;` : `a) Vigência mínima de ${(p && p.contrato_minimo_meses) || 3} meses a partir de ${fmtData(ini)}; b) Rescisão com aviso por escrito de [30] dias. Rescisão antes do prazo mínimo: [condição];`} c) Fica eleito o foro da comarca de [cidade]. Assinatura eletrônica válida.

[cidade], ${hoje}.

_____________________________          _____________________________
CONTRATANTE                            CONTRATADA`;
}
function gerarContrato(c, planos) {
  const p = planos.find((x) => x.nome === c.plano) || null;
  const txt = textoContrato(c, p);
  const m = abrirModal("Contrato: " + c.nome, `<p class="muted">Gerado a partir do modelo, com o plano e o valor do cliente. Revise com um advogado os campos entre colchetes.</p>
    ${p ? "" : `<div class="faixa alerta">O plano "${esc(c.plano || "sem plano")}" não está cadastrado em Configurações. Os entregáveis ficaram em branco.</div>`}
    ${caixaCopiar("contrato-txt", txt, 360)}<div class="modal-rodape"><button class="btn" id="ct-baixar">Baixar .txt</button><button class="btn" data-fechar>Fechar</button></div>`, { largo: true });
  ligarCopiar(m);
  $("#ct-baixar", m).onclick = () => P.baixarArquivo(`contrato-${slugify(c.nome)}.txt`, txt, "text/plain;charset=utf-8");
}

// ----------------------------------------------------------------- Configurações
const CAMPOS_PLANO = [["nome", "Nome", "text"], ["ordem", "Ordem", "number"], ["valor", "Investimento mensal (R$)", "number"], ["posts_mes", "Posts por mês", "number"],
  ["dias", "Dias", "text"], ["stories", "Stories", "text"], ["reels", "Reels", "text"], ["captacao", "Captação de vídeo", "text"], ["relatorio", "Relatório", "text"],
  ["rodadas_ajuste", "Rodadas de ajuste", "number"], ["contrato_minimo_meses", "Contrato mínimo (meses; 0 = sem prazo)", "number"]];
TELAS_ADMIN.configuracoes = async (el) => {
  const [cfg, planos, prompts] = await Promise.all([D.um("configuracoes", { eq: { id: 1 } }), D.lista("planos", { ordem: "ordem" }), D.lista("prompts_modelo", { ordem: "ordem" })]);
  const c = cfg || { id: 1 };
  const todosEnt = [...new Set(planos.flatMap((p) => p.entregaveis || []))];
  const etapas = [...new Set(prompts.map((p) => p.etapa || "Outros"))];
  el.innerHTML = `<h1>Configurações</h1><div class="grid g2">
    <form class="cartao" id="f-id"><h3>Identidade do portal</h3>
      <label>Nome exibido</label><input type="text" id="cf-nome" value="${esc(c.nome || "")}">
      <label>Cor de destaque</label><div class="linha"><input type="color" id="cf-cor-p" value="${esc(/^#[0-9a-fA-F]{6}$/.test(c.cor_destaque || "") ? c.cor_destaque : "#B5562E")}" style="width:52px;height:36px;padding:2px"><input type="text" id="cf-cor" class="cresce" value="${esc(c.cor_destaque || "#B5562E")}"></div>
      <label>WhatsApp de contato (só números, com DDI)</label><input type="text" id="cf-whats" value="${esc(c.whatsapp || "")}">
      <label>Mensagem de boas-vindas</label><textarea id="cf-boas">${esc(c.texto_boas_vindas || "")}</textarea>
      <label>Observações internas (o cliente nunca vê)</label><textarea id="cf-obs">${esc(c.observacoes_internas || "")}</textarea>
      <div class="modal-rodape"><button class="btn primario">Salvar identidade</button></div></form>
    <div class="cartao"><h3>Regras de aprovação</h3>
      <div class="lista"><div><b>Aprovação automática sem resposta:</b> desligada. Sem resposta, o conteúdo nunca é aprovado sozinho.</div>
        <div><b>Lembretes:</b> pelo botão "Enviar lembrete" em Gestão de Conteúdos.</div><div><b>Prazo e rodadas:</b> por cliente, abaixo. Novos clientes recebem os números do plano.</div></div>
      <div class="tabela"><table><tr><th>Cliente</th><th>Prazo (dias)</th><th>Rodadas</th></tr>${S.clientes.map((x) => `<tr><td>${esc(x.nome)}</td>
        <td><input type="number" min="1" class="num-curto" data-prazo="${esc(x.id)}" value="${esc(prazoDias(x))}"></td><td><input type="number" min="0" class="num-curto" data-rod="${esc(x.id)}" value="${esc(rodadas(x))}"></td></tr>`).join("")}</table></div>
      <div class="modal-rodape"><button class="btn primario" id="rg-salvar">Salvar regras</button></div></div>
    <div class="cartao" style="grid-column:1/-1"><div class="entre"><h3 style="margin:0">Planos e entregáveis</h3><button class="btn pequeno" id="pl-novo">Novo plano</button></div>
      <p class="muted">Esta tabela alimenta o cadastro, o contrato e o escopo de cada cliente.</p>
      ${planos.length ? `<div class="tabela"><table><tr><th>Entregável</th>${planos.map((p) => `<th>${esc(p.nome)}</th>`).join("")}</tr>
        ${CAMPOS_PLANO.filter(([k]) => !["nome", "ordem", "valor"].includes(k)).map(([k, n]) => `<tr><td><b>${esc(n.replace("; 0 = sem prazo", ""))}</b></td>${planos.map((p) => `<td>${k === "contrato_minimo_meses" && Number(p[k]) === 0 ? "sem prazo" : esc(p[k] ?? "-")}</td>`).join("")}</tr>`).join("")}
        ${todosEnt.map((x) => `<tr><td>${esc(x)}</td>${planos.map((p) => `<td>${(p.entregaveis || []).includes(x) ? "✓" : "-"}</td>`).join("")}</tr>`).join("")}
        <tr><td><b>Investimento</b></td>${planos.map((p) => `<td><b>${Number(p.valor) === 0 ? "Gratuito" : esc(fmtMoeda(p.valor))}</b></td>`).join("")}</tr></table></div>
        <div class="linha" style="margin-top:8px">${planos.map((p) => `<button class="btn pequeno" data-plano="${esc(p.id)}">Editar ${esc(p.nome)}</button>`).join("")}</div>` : `<div class="muted">Nenhum plano cadastrado.</div>`}</div>
    <div class="cartao" style="grid-column:1/-1"><div class="entre"><h3 style="margin:0">Biblioteca de prompts</h3><button class="btn pequeno" id="pr-novo">Novo prompt</button></div>
      <p class="muted">Os prompts da operação, por etapa, na ordem em que são usados. Ficam na tabela prompts_modelo.</p>
      ${etapas.map((et) => `<div style="margin-top:10px"><b>${esc(et)}</b><div class="lista">${prompts.filter((p) => (p.etapa || "Outros") === et).map((p) => `<div class="entre"><span>${esc(p.titulo || p.tarefa)}<br>
        <span class="muted">${esc([p.tarefa, p.onde, p.skill && p.skill !== "-" ? "skill: " + p.skill : ""].filter(Boolean).join(" · "))}</span></span><button class="btn pequeno" data-prompt="${esc(p.id)}">Ver e editar</button></div>`).join("")}</div></div>`).join("")
        || `<div class="muted">Nenhum prompt cadastrado.</div>`}</div>
    <div class="cartao"><h3>Usuários e papéis</h3><div class="lista"><div>Social media (administração): vê e edita tudo.</div><div>Cliente: só a própria marca, sem a operação interna.</div></div>
      <p class="muted">O acesso do cliente é criado em Clientes > Cadastrar cliente.</p></div>
  </div>`;
  $("#cf-cor-p").oninput = () => { $("#cf-cor").value = $("#cf-cor-p").value.toUpperCase(); };
  $("#f-id").onsubmit = async (ev) => {
    ev.preventDefault();
    const cor = $("#cf-cor").value.trim();
    if (cor && !/^#[0-9a-fA-F]{6}$/.test(cor)) { avisar("A cor precisa estar no formato #RRGGBB.", "erro"); return; }
    try {
      const novo = await D.upsert("configuracoes", { id: 1, nome: $("#cf-nome").value.trim(), cor_destaque: cor || null, whatsapp: $("#cf-whats").value.replace(/\D/g, ""),
        texto_boas_vindas: $("#cf-boas").value, observacoes_internas: $("#cf-obs").value, logo_url: c.logo_url || null }, "id");
      Object.assign(S.config, novo || {}); P.aplicarMarca(); avisar("Identidade salva.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  $("#rg-salvar").onclick = async () => {
    try {
      for (const x of S.clientes) {
        const prazo = Number($(`[data-prazo="${x.id}"]`, el).value) || 2, rod = Number($(`[data-rod="${x.id}"]`, el).value);
        if (prazo === prazoDias(x) && rod === rodadas(x)) continue;
        const escopo = Object.assign({}, x.escopo || {}, { prazo_aprovacao_dias: prazo, rodadas_ajuste: isNaN(rod) ? 2 : rod });
        await D.atualizar("clientes", { id: x.id }, { escopo }); x.escopo = escopo;
      }
      avisar("Regras salvas.", "ok");
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  $("#pl-novo").onclick = () => formPlano(null);
  $$("[data-plano]", el).forEach((b) => b.onclick = () => formPlano(planos.find((p) => p.id === b.dataset.plano)));
  $("#pr-novo").onclick = () => formPrompt(null, etapas);
  $$("[data-prompt]", el).forEach((b) => b.onclick = () => formPrompt(prompts.find((p) => p.id === b.dataset.prompt), etapas));
};
function formPlano(p) {
  const n = p || { ordem: 0, contrato_minimo_meses: 3, entregaveis: [] };
  const m = abrirModal(p ? "Editar plano" : "Novo plano", `<form id="f-pl2"><div class="grade-form">${CAMPOS_PLANO.map(([k, t, tipo]) => `<div><label>${esc(t)}</label><input type="${tipo}" data-pk="${k}" ${tipo === "number" ? 'step="any" min="0"' : ""} value="${esc(n[k] ?? "")}" ${k === "nome" ? "required" : ""}></div>`).join("")}</div>
    <label>Entregáveis (um por linha)</label><textarea id="pl-ent" style="min-height:140px">${esc((n.entregaveis || []).join("\n"))}</textarea>
    <div class="modal-rodape">${p ? `<button type="button" class="btn perigo" id="pl-apagar">Excluir plano</button>` : ""}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar plano</button></div></form>`, { largo: true });
  $("#f-pl2", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const dados = {};
    $$("[data-pk]", m).forEach((i) => { const k = i.dataset.pk; dados[k] = i.type === "number" ? (i.value === "" ? null : Number(i.value)) : (i.value.trim() || null); });
    dados.entregaveis = $("#pl-ent", m).value.split("\n").map((x) => x.trim()).filter(Boolean);
    try { if (p) await D.atualizar("planos", { id: p.id }, dados); else await D.inserir("planos", dados); fecharModal(); avisar("Plano salvo.", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#pl-apagar", m)) $("#pl-apagar", m).onclick = async () => {
    if (!(await confirmar(`Excluir o plano "${p.nome}"? Os clientes que usam este nome continuam com ele no cadastro.`, "Excluir", true))) return;
    try { await D.apagar("planos", { id: p.id }); avisar("Plano excluído.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}
function formPrompt(p, etapas) {
  const n = p || { ordem: 0 };
  const m = abrirModal(p ? (p.titulo || p.tarefa) : "Novo prompt", `<form id="f-pr"><div class="grade-form">
    <div><label>Chave (tarefa)</label><input type="text" id="pr-tarefa" required value="${esc(n.tarefa || "")}" ${p ? "disabled" : ""} placeholder="op_exemplo"></div>
    <div><label>Título</label><input type="text" id="pr-titulo" value="${esc(n.titulo || "")}"></div>
    <div><label>Etapa</label><input type="text" id="pr-etapa" list="pr-etapas" value="${esc(n.etapa || "")}"><datalist id="pr-etapas">${etapas.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
    <div><label>Onde usar</label><input type="text" id="pr-onde" value="${esc(n.onde || "")}"></div>
    <div><label>Skill</label><input type="text" id="pr-skill" value="${esc(n.skill || "")}"></div><div><label>Origem</label><input type="text" id="pr-origem" value="${esc(n.origem || "")}"></div>
    <div><label>Ordem</label><input type="number" id="pr-ordem" value="${esc(n.ordem ?? 0)}"></div></div>
    <label>Texto do prompt</label><p class="muted">Campos trocados na hora de usar: {cliente} {ig} {nicho} {publico} {pilares} {cadencia} {cta} {mes}</p>
    <textarea id="pr-texto" class="grande" style="min-height:300px">${esc(n.texto || "")}</textarea>
    <div class="modal-rodape">${p ? `<button type="button" class="btn perigo" id="pr-apagar">Excluir</button>` : ""}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar prompt</button></div></form>`, { largo: true });
  $("#f-pr", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const dados = { titulo: $("#pr-titulo", m).value.trim() || null, etapa: $("#pr-etapa", m).value.trim() || null, onde: $("#pr-onde", m).value.trim() || null, skill: $("#pr-skill", m).value.trim() || null,
      origem: $("#pr-origem", m).value.trim() || null, ordem: Number($("#pr-ordem", m).value) || 0, texto: $("#pr-texto", m).value, atualizado_em: agoraISO() };
    try {
      if (p) await D.atualizar("prompts_modelo", { id: p.id }, dados);
      else await D.inserir("prompts_modelo", Object.assign({ tarefa: $("#pr-tarefa", m).value.trim() }, dados));
      fecharModal(); avisar("Prompt salvo.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#pr-apagar", m)) $("#pr-apagar", m).onclick = async () => {
    if (!(await confirmar("Excluir este prompt da biblioteca? Etapas da Operação que usam esta chave vão avisar que o prompt não existe.", "Excluir", true))) return;
    try { await D.apagar("prompts_modelo", { id: p.id }); avisar("Prompt excluído.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- modo de teste: dados fictícios desta fase
const exemploAnterior = GANCHO.exemplo;
const gatilhosAnteriores = GANCHO.gatilhos;
GANCHO.exemplo = (t, C) => {
  if (exemploAnterior) exemploAnterior(t, C);
  t.planos = [
    { id: "pl-a", nome: "Plano A", ordem: 1, posts_mes: 12, dias: "3 por semana", stories: "2 sequências por semana", reels: "4 por mês", captacao: "não", relatorio: "Mensal", rodadas_ajuste: 2, valor: 1000, contrato_minimo_meses: 3, entregaveis: ["Entregável de exemplo 1", "Entregável de exemplo 2"] },
    { id: "pl-b", nome: "Plano B", ordem: 2, posts_mes: 16, dias: "4 por semana", stories: "3 sequências por semana", reels: "6 por mês", captacao: "1 por mês", relatorio: "Mensal e quinzenal", rodadas_ajuste: 2, valor: 1500, contrato_minimo_meses: 3, entregaveis: ["Entregável de exemplo 1", "Entregável de exemplo 2", "Entregável de exemplo 3"] },
    { id: "pl-c", nome: "Plano C", ordem: 3, posts_mes: 20, dias: "5 por semana", stories: "diários", reels: "8 por mês", captacao: "2 por mês", relatorio: "Mensal e quinzenal", rodadas_ajuste: 3, valor: 2000, contrato_minimo_meses: 3, entregaveis: ["Entregável de exemplo 1", "Entregável de exemplo 2", "Entregável de exemplo 3", "Entregável de exemplo 4"] },
  ];
  const planoDe = { [C]: "Plano C", "exemplo-0002": "Plano B", "exemplo-0003": "Plano A" };
  t.clientes.forEach((c) => { if (planoDe[c.id]) c.plano = planoDe[c.id]; });
  (t.relatorios || []).forEach((r) => { r.tipo = r.tipo || "mensal"; });
  t.relatorios.push({ id: "rel-q", cliente_id: C, mes: mesAtual(), tipo: "quinzenal", publicado: true, conteudo: "# Análise quinzenal (exemplo)\n\n- Alcance da quinzena acima da anterior.\n- A automação de lanche respondeu pela maior parte dos cliques.\n\n## Para a próxima quinzena\nMais um reels de bastidor." });
  t.ig_alertas = [{ id: "al-1", cliente_id: C, tipo: "volume", mensagem: "Muitas respostas em pouco tempo: o envio foi freado por 10 minutos (exemplo).", visto: false, created_at: new Date().toISOString() }];
};
// Mesma regra do banco: a palavra-chave não se repete no mesmo cliente
GANCHO.gatilhos = (tabela, l, antigo) => {
  if (gatilhosAnteriores) gatilhosAnteriores(tabela, l, antigo);
  if (tabela !== "ig_automations" || !String(l.keyword || "").trim()) return;
  const t = P.D.t, k = String(l.keyword).trim().toUpperCase();
  const outra = (t.ig_automations || []).find((x) => x !== l && x.cliente_id === l.cliente_id && String(x.keyword || "").trim().toUpperCase() === k);
  if (!outra) return;
  if (antigo) Object.keys(l).forEach((c) => { if (c in antigo) l[c] = antigo[c]; });
  else t.ig_automations = t.ig_automations.filter((x) => x !== l);
  throw { message: 'duplicate key value violates unique constraint "ig_automations_palavra_unica"' };
};
})();

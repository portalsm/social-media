// =============================================================================
// comercial.js: reforma, fase 4 (só administração).
//   CRM comercial (leads, scripts, proposta), Funil de vendas (etapas, follow-up,
//   conversão em cliente, perdido com reabordagem), Customer Success e
//   Relatórios e indicadores.
// Scripts vêm da tabela scripts e planos da tabela planos. Os números que o banco
// não tem como medir aparecem como "sem dado", nunca inventados.
// =============================================================================
(function () {
"use strict";
const P = window.__portal;
const R = P.R;
const { S, GANCHO, $, $$, esc, hojeISO, mesAtual, somarDias, fmtData, fmtMoeda, nomeMes, avisar, erroAmigavel, abrirModal, fecharModal, confirmar, clienteAtual, md, tempoRelativo } = P;
const { D, ETAPAS_ONB, CH_ABERTOS, tag, nomeCliente, agoraISO, linkSeguro, caixaCopiar, ligarCopiar, notificar, navMes, fmtDiaLongo, primeiroNome, TELAS_ADMIN, rotear } = R;

const ETAPAS = [["prospeccao", "Prospecção"], ["em_conversa", "Em conversa"], ["onboarding_agendado", "Onboarding agendado"], ["proposta_enviada", "Proposta Enviada"], ["cliente", "Cliente"], ["perdido", "Perdido"]];
const NOME_ETAPA = Object.fromEntries(ETAPAS);
const COR_ETAPA = (e) => (e === "cliente" ? "t-verde" : e === "perdido" ? "t-verm" : "t-azul");
const ORIGENS = ["Prospecção fria", "Indicação", "Instagram", "Site", "Outro"];
const CANAIS = ["WhatsApp", "Direct do Instagram", "Ligação", "E-mail", "Reunião"];
const MOTIVOS_PERDA = ["Preço", "Momento", "Sem resposta", "Já tem alguém", "Vai fazer sozinha", "Outro"];
const SIMBOLO = { BRL: "R$", EUR: "€", USD: "US$" };
const FU = "Follow-up comercial";
const dinheiro = (v, moeda = "BRL") => (moeda === "BRL" || !moeda ? fmtMoeda(v) : `${SIMBOLO[moeda] || moeda} ${Number(v || 0).toLocaleString("pt-BR")}`);
const somarMeses = (iso, n) => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T12:00:00") - new Date(String(a).slice(0, 10) + "T12:00:00")) / 864e5);

/** Follow-ups abertos (tarefas com lead_id). */
async function followups() { return (await D.lista("tarefas", { in: { status: ["a_fazer", "em_execucao", "revisao"] }, ordem: "prazo" })).filter((t) => t.lead_id); }
const canalDe = (t) => ((String(t.titulo || "").match(/\(([^)]+)\)\s*$/) || [])[1] || "");

/** Agenda um follow-up: troca a tarefa aberta do lead e o compromisso na agenda. */
async function gravarFollowup(l, data, hora, canal, nota) {
  const abertas = (await followups()).filter((t) => t.lead_id === l.id && t.tipo === FU);
  for (const t of abertas) await D.apagar("tarefas", { id: t.id });
  const ag = (await D.lista("agenda", { eq: { lead_id: l.id }, gte: { data: hojeISO() } })).filter((g) => g.tipo === FU);
  for (const g of ag) await D.apagar("agenda", { id: g.id });
  await D.inserir("tarefas", { cliente_id: null, lead_id: l.id, titulo: `Follow-up: ${l.nome} (${canal})`, tipo: FU, responsavel: "Social media", prioridade: "media", prazo: data, hora: hora || null, nota: nota || null, status: "a_fazer" });
  await D.inserir("agenda", { cliente_id: null, lead_id: l.id, data, hora: hora || null, titulo: `Follow-up ${l.nome}`, tipo: FU, compartilhado: false });
  await D.atualizar("leads", { id: l.id }, { proximo_passo: data });
}
async function limparFollowups(l) {
  for (const t of (await followups()).filter((x) => x.lead_id === l.id)) await D.apagar("tarefas", { id: t.id });
  for (const g of (await D.lista("agenda", { eq: { lead_id: l.id }, gte: { data: hojeISO() } }))) await D.apagar("agenda", { id: g.id });
}
function agendarFollowup(l, depois) {
  const m = abrirModal("Agendar follow-up", `<p class="muted">${esc(l.nome)} · ${esc(NOME_ETAPA[l.etapa] || l.etapa)}</p><form id="f-fu">
    <div class="grade-form"><div><label>Data</label><input type="date" id="fu-d" required value="${esc(somarDias(hojeISO(), 1))}"></div><div><label>Hora</label><input type="time" id="fu-h" value="10:00"></div></div>
    <label>Canal</label><select id="fu-c">${CANAIS.map((x) => `<option>${x}</option>`).join("")}</select>
    <label>O que fazer</label><textarea id="fu-n" placeholder="Ex.: mandar o carrossel de presente e perguntar se viu a proposta"></textarea>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Agendar</button></div></form>`);
  $("#f-fu", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const d = $("#fu-d", m).value;
    try {
      await gravarFollowup(l, d, $("#fu-h", m).value, $("#fu-c", m).value, $("#fu-n", m).value.trim());
      fecharModal(); avisar(d === hojeISO() ? "Follow-up agendado. Já está nas suas tarefas de hoje e na Agenda." : `Follow-up agendado para ${fmtData(d)}. Entra nas suas tarefas do dia e na Agenda.`, "ok"); (depois || rotear)();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- formulário de lead
function formLead(l, depois) {
  const n = l || { origem: ORIGENS[0], pais: "Brasil", idioma: "Português do Brasil", moeda: "BRL", data_abordagem: hojeISO(), etapa: "prospeccao", valor: null };
  const sel = (id, ops, v) => `<select id="${id}">${ops.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("")}${v && !ops.includes(v) ? `<option selected>${esc(v)}</option>` : ""}</select>`;
  const m = abrirModal(l ? "Editar lead" : "Novo lead", `<form id="f-lead"><div class="grade-form">
    <div><label>Nome</label><input type="text" id="ld-nome" required value="${esc(n.nome || "")}"></div><div><label>Instagram</label><input type="text" id="ld-ig" value="${esc(n.instagram || "")}" placeholder="@perfil"></div>
    <div><label>Origem</label>${sel("ld-origem", ORIGENS, n.origem)}</div><div><label>Tipo de negócio</label><input type="text" id="ld-tipo" value="${esc(n.tipo_negocio || "")}"></div>
    <div><label>Data da abordagem</label><input type="date" id="ld-abord" value="${esc(n.data_abordagem || "")}"></div><div><label>Valor estimado</label><input type="number" id="ld-valor" min="0" step="0.01" value="${esc(n.valor ?? "")}"></div>
    <div><label>País</label>${sel("ld-pais", ["Brasil", "Portugal", "Estados Unidos", "Outro"], n.pais)}</div><div><label>Idioma</label>${sel("ld-idioma", ["Português do Brasil", "Português de Portugal", "Inglês", "Espanhol"], n.idioma)}</div>
    <div><label>Moeda</label>${sel("ld-moeda", ["BRL", "EUR", "USD"], n.moeda)}</div><div><label>Fuso</label><input type="text" id="ld-fuso" value="${esc(n.fuso || "")}" placeholder="Ex.: Lisboa (+3h)"></div></div>
    <label>Problema visível no perfil</label><input type="text" id="ld-prob" value="${esc(n.problema || "")}" placeholder="Ex.: bio sem chamada, sem post há 20 dias">
    <label>Observação</label><textarea id="ld-obs">${esc(n.observacao || "")}</textarea>
    <div class="modal-rodape">${l ? `<button type="button" class="btn perigo" id="ld-apagar">Excluir lead</button>` : ""}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`, { largo: true });
  $("#f-lead", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const v = (s) => $(s, m).value.trim() || null;
    const dados = { nome: v("#ld-nome"), instagram: v("#ld-ig"), origem: v("#ld-origem"), tipo_negocio: v("#ld-tipo"), data_abordagem: v("#ld-abord"), valor: $("#ld-valor", m).value === "" ? null : Number($("#ld-valor", m).value),
      pais: v("#ld-pais"), idioma: v("#ld-idioma"), moeda: v("#ld-moeda"), fuso: v("#ld-fuso"), problema: v("#ld-prob"), observacao: v("#ld-obs") };
    try {
      if (l) await D.atualizar("leads", { id: l.id }, dados); else await D.inserir("leads", Object.assign({ etapa: "prospeccao" }, dados));
      fecharModal(); avisar(l ? "Lead atualizado." : "Lead salvo. Agende o follow-up no Funil de Vendas.", "ok"); (depois || rotear)();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#ld-apagar", m)) $("#ld-apagar", m).onclick = async () => {
    if (!(await confirmar(`Excluir o lead "${l.nome}"? As propostas dele também deixam de aparecer.`, "Excluir", true))) return;
    try { await limparFollowups(l); await D.apagar("leads", { id: l.id }); avisar("Lead excluído.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- scripts (tabela scripts)
async function verScripts(l) {
  const lista = await D.lista("scripts", { ordem: "ordem" });
  const preencher = (t) => (l ? String(t || "").replace(/\[nome\]|\[name\]|\[Nome\]/g, primeiroNome(l.nome)).replace(/\[negócio\]|\[negocio\]/gi, l.nome) : String(t || ""));
  const m = abrirModal("Scripts de prospecção" + (l ? ": " + l.nome : ""), lista.length
    ? `<p class="muted">${l ? "Nome e negócio do lead já preenchidos. " : ""}Revise os campos entre colchetes antes de mandar.</p>
      <input type="search" id="sc-busca" placeholder="Buscar situação..." style="margin-bottom:8px">
      <div class="lista" id="sc-lista" style="max-height:60vh;overflow:auto">${lista.map((s, i) => `<div data-sit="${esc((s.situacao || "") + " " + (s.objetivo || "")).toLowerCase()}"><b>${esc(s.situacao || "")}</b>${s.objetivo ? ` <span class="muted">· ${esc(s.objetivo)}</span>` : ""}
        ${caixaCopiar("sc-" + i, preencher(s.texto), 80)}</div>`).join("")}</div>`
    : `<div class="faixa alerta">A tabela scripts está vazia. Cadastre os scripts no banco para eles aparecerem aqui.</div>`, { largo: true });
  ligarCopiar(m);
  if ($("#sc-busca", m)) $("#sc-busca", m).oninput = () => { const q = $("#sc-busca", m).value.toLowerCase(); $$("#sc-lista > div", m).forEach((d) => { d.style.display = d.dataset.sit.includes(q) ? "" : "none"; }); };
}

// ----------------------------------------------------------------- proposta em 8 partes (tabela propostas)
function textoProposta(l, planos) {
  const moeda = l.moeda || "BRL", conv = moeda !== "BRL";
  const idioma = l.idioma === "Inglês" ? " (traduzir para inglês)" : l.idioma === "Português de Portugal" ? " (escrever em português de Portugal)" : l.idioma === "Espanhol" ? " (traduzir para espanhol)" : "";
  const validade = somarDias(hojeISO(), 7);
  const linhaPlano = (p) => Number(p.valor) === 0 ? `${p.nome}: gratuito, para teste${p.posts_mes ? ` · ${p.posts_mes} posts` : ""}` : `${p.nome}: ${conv ? `[valor em ${moeda}] (referência ${fmtMoeda(p.valor)})` : fmtMoeda(p.valor)} por mês${p.posts_mes ? ` · ${p.posts_mes} posts` : ""}${p.dias ? ` · ${p.dias}` : ""}`;
  return { validade, moeda, texto: `PROPOSTA DE GESTÃO DE INSTAGRAM${idioma}
Para: ${l.nome}${l.instagram ? ` (${l.instagram})` : ""} · Data: ${fmtData(hojeISO())}

1. QUEM SOU
[2 ou 3 frases sobre você e no que você acredita]

2. MARCAS QUE JÁ ATENDI
[marcas e resultados que podem ser citados]

3. DIAGNÓSTICO DO PERFIL
${l.problema ? "O que vi no perfil: " + l.problema : "[3 pontos que você viu no perfil]"}

4. COMO É O TRABALHO
[as etapas do seu processo, do briefing ao relatório]

5. QUANTO CUSTARIA POR FORA
[quanto custaria contratar cada profissional separado${conv ? ", em " + moeda : ""}]

6. PLANOS (contrato mínimo de ${Math.max(0, ...planos.map((x) => Number(x.contrato_minimo_meses) || 0)) || 3} meses${planos.some((x) => Number(x.contrato_minimo_meses) === 0) ? "; o teste não tem prazo" : ""})
${planos.length ? planos.map(linhaPlano).join("\n") + "\n[indique o plano recomendado e o motivo]" : "[cadastre os planos em Configurações]"}

7. PRÓXIMOS PASSOS
Escolha do plano > contrato > reunião de briefing

8. VALIDADE
Proposta válida até ${fmtData(validade)}` };
}
async function abrirProposta(l, depois) {
  const [planos, antigas] = await Promise.all([D.lista("planos", { ordem: "ordem" }), D.lista("propostas", { eq: { lead_id: l.id }, ordem: "-created_at" })]);
  const base = textoProposta(l, planos);
  const ultima = antigas[0];
  const m = abrirModal("Proposta para " + l.nome, `<p class="muted">Modelo em 8 partes${l.moeda && l.moeda !== "BRL" ? ", na moeda do cliente" : ""}. Revise os campos entre colchetes. Para a versão visual, use o prompt de proposta da Biblioteca de prompts.</p>
    ${antigas.length ? `<div class="faixa info">${antigas.length} proposta(s) salva(s) para este lead. A última ${ultima.enviada_em ? "foi enviada em " + esc(fmtData(ultima.enviada_em)) : "ainda não foi enviada"}. <a href="#" id="pp-ultima">Abrir a última</a></div>` : ""}
    <textarea id="pp-txt" class="grande" style="min-height:360px">${esc(base.texto)}</textarea>
    <div class="grade-form"><div><label>Validade</label><input type="date" id="pp-val" value="${esc(base.validade)}"></div><div><label>Moeda</label><input type="text" id="pp-moeda" value="${esc(base.moeda)}" disabled></div></div>
    <div class="modal-rodape"><button class="btn" id="pp-copiar">Copiar</button><button class="btn" id="pp-salvar">Salvar proposta</button><button class="btn primario" id="pp-enviada">Marcar como enviada</button></div>`, { largo: true });
  let salva = null;
  if ($("#pp-ultima", m)) $("#pp-ultima", m).onclick = (ev) => { ev.preventDefault(); $("#pp-txt", m).value = ultima.conteudo || ""; if (ultima.validade) $("#pp-val", m).value = ultima.validade; salva = ultima.enviada_em ? null : ultima; };
  $("#pp-copiar", m).onclick = async () => { const t = $("#pp-txt", m); try { await navigator.clipboard.writeText(t.value); } catch (_) { t.select(); document.execCommand("copy"); } avisar("Proposta copiada.", "ok"); };
  const salvar = async (enviada) => {
    const dados = { lead_id: l.id, conteudo: $("#pp-txt", m).value, moeda: base.moeda, validade: $("#pp-val", m).value || null };
    if (enviada) dados.enviada_em = agoraISO();
    if (salva) { await D.atualizar("propostas", { id: salva.id }, dados); salva = Object.assign(salva, dados); } else salva = await D.inserir("propostas", dados);
  };
  $("#pp-salvar", m).onclick = async () => { try { await salvar(false); avisar("Proposta salva.", "ok"); } catch (e) { avisar(erroAmigavel(e), "erro"); } };
  $("#pp-enviada", m).onclick = async () => {
    try {
      await salvar(true);
      await D.atualizar("leads", { id: l.id }, { etapa: "proposta_enviada" });
      await gravarFollowup(l, somarDias(hojeISO(), 2), "10:00", "WhatsApp", "2 dias depois da proposta: perguntar se conseguiu ver a proposta");
      fecharModal(); avisar("Proposta enviada. Follow-up de 2 dias agendado nas suas tarefas.", "ok"); (depois || rotear)();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- CRM comercial
TELAS_ADMIN.crm = async (el) => {
  const [leads, fus] = await Promise.all([D.lista("leads", { ordem: "-created_at" }), followups()]);
  const f = S.filtroCrm || "";
  const lista = leads.filter((l) => !f || l.etapa === f);
  el.innerHTML = `<div class="entre"><div><h1>CRM comercial</h1><p class="sub">A planilha de prospecção: uma linha por lead, com etapa, próximo passo, scripts e proposta.</p></div>
      <div class="linha"><button class="btn" id="crm-scripts">Scripts</button><button class="btn primario" id="crm-novo">Novo lead</button></div></div>
    <div class="linha" style="margin-bottom:12px"><select id="crm-f" style="width:auto"><option value="">Todas as etapas (${leads.length})</option>${ETAPAS.map(([k, n]) => `<option value="${k}" ${k === f ? "selected" : ""}>${n} (${leads.filter((l) => l.etapa === k).length})</option>`).join("")}</select></div>
    <div class="cartao tabela"><table><tr><th>Lead</th><th>Negócio e problema</th><th>Abordagem</th><th>Etapa</th><th>Próximo passo</th><th>Mercado</th><th></th></tr>
    ${lista.map((l) => { const fu = fus.find((t) => t.lead_id === l.id);
      return `<tr><td><a href="#" data-lead="${esc(l.id)}"><b>${esc(l.nome)}</b></a><br><span class="muted">${esc(l.instagram || "")}${l.origem ? " · " + esc(l.origem) : ""}</span></td>
        <td>${esc(l.tipo_negocio || "-")}<br><span class="muted">${esc(l.problema || "")}</span></td><td>${l.data_abordagem ? esc(R.fmtDataCurta(l.data_abordagem)) : "-"}</td>
        <td>${tag(NOME_ETAPA[l.etapa] || l.etapa, COR_ETAPA(l.etapa))}${l.etapa === "perdido" && l.motivo_perda ? `<br><span class="muted">${esc(l.motivo_perda)}</span>` : ""}</td>
        <td>${fu ? `${esc(R.fmtDataCurta(fu.prazo))}${fu.hora ? " " + esc(String(fu.hora).slice(0, 5)) : ""}<br><span class="muted">${esc(canalDe(fu))}</span>` : l.proximo_passo ? esc(R.fmtDataCurta(l.proximo_passo)) : "-"}</td>
        <td>${esc(l.pais || "Brasil")}<br><span class="muted">${esc(l.idioma || "Português do Brasil")} · ${esc(l.moeda || "BRL")}${l.fuso ? " · " + esc(l.fuso) : ""}</span></td>
        <td><div class="acoes-col"><button class="btn pequeno" data-scripts="${esc(l.id)}">Scripts</button>${["cliente", "perdido"].includes(l.etapa) ? "" : `<button class="btn pequeno" data-proposta="${esc(l.id)}">Proposta</button>`}</div></td></tr>`; }).join("")
      || `<tr><td colspan="7" class="muted">Nenhum lead${f ? " nesta etapa" : " ainda"}.</td></tr>`}</table></div>`;
  $("#crm-f").onchange = (e) => { S.filtroCrm = e.target.value; rotear(); };
  $("#crm-novo").onclick = () => formLead(null);
  $("#crm-scripts").onclick = () => verScripts(null);
  $$("[data-lead]", el).forEach((a) => a.onclick = (ev) => { ev.preventDefault(); formLead(leads.find((x) => x.id === a.dataset.lead)); });
  $$("[data-scripts]", el).forEach((b) => b.onclick = () => verScripts(leads.find((x) => x.id === b.dataset.scripts)));
  $$("[data-proposta]", el).forEach((b) => b.onclick = () => abrirProposta(leads.find((x) => x.id === b.dataset.proposta)));
};

// ----------------------------------------------------------------- Funil de vendas
TELAS_ADMIN.funil = async (el) => {
  const [leads, fus] = await Promise.all([D.lista("leads", { ordem: "nome" }), followups()]);
  const hoje = hojeISO(), seg = somarDias(hoje, -((new Date(hoje + "T12:00:00").getDay() + 6) % 7));
  const semana = leads.filter((l) => l.data_abordagem && l.data_abordagem >= seg && l.data_abordagem <= hoje).length;
  el.innerHTML = `<div class="entre"><div><h1>Funil de vendas</h1><p class="sub">Mova os leads entre as etapas. Abordagens nesta semana: <b>${semana}</b>.</p></div><button class="btn primario" id="fn-novo">Novo lead</button></div>
    <div class="kan kan-funil">${ETAPAS.map(([k, n], i) => { const cc = leads.filter((l) => l.etapa === k);
      return `<div class="col"><h3>${n}<span>${cc.length}</span></h3>${cc.map((l) => { const fu = fus.find((t) => t.lead_id === l.id);
        return `<div class="kc"><b><a href="#" data-lead="${esc(l.id)}">${esc(l.nome)}</a></b><span class="muted">${esc(l.origem || "")}${l.valor ? " · " + esc(dinheiro(l.valor, l.moeda)) : ""}</span>
          <div class="linha" style="margin-top:6px">${i > 0 && i < 5 ? `<button class="btn pequeno" data-mover="${esc(l.id)}" data-para="${ETAPAS[i - 1][0]}">Voltar</button>` : ""}${i < 4 ? `<button class="btn pequeno" data-mover="${esc(l.id)}" data-para="${ETAPAS[i + 1][0]}">Avançar</button>` : ""}${i < 4 ? `<button class="btn pequeno perigo" data-perdido="${esc(l.id)}">Perdido</button>` : ""}
            ${k === "perdido" ? `<button class="btn pequeno" data-mover="${esc(l.id)}" data-para="prospeccao">Reabrir</button>` : ""}</div>
          ${i < 4 ? `<div style="margin-top:6px">${fu ? `<span class="tag quebra ${fu.prazo < hoje ? "t-verm" : fu.prazo === hoje ? "t-ambar" : "t-azul"}">Follow-up ${fu.prazo === hoje ? "hoje" : R.fmtDataCurta(fu.prazo)}${fu.hora ? " " + String(fu.hora).slice(0, 5) : ""}${canalDe(fu) ? " · " + esc(canalDe(fu)) : ""}</span>` : ""}
            <button class="btn primario pequeno" data-fu="${esc(l.id)}">${fu ? "Reagendar" : "Agendar"} follow-up</button></div>` : ""}
          ${k === "perdido" && l.proximo_passo ? `<div class="muted" style="margin-top:4px">Reabordar em ${esc(fmtData(l.proximo_passo))}</div>` : ""}</div>`; }).join("")}</div>`; }).join("")}</div>`;
  $("#fn-novo").onclick = () => formLead(null);
  $$("[data-lead]", el).forEach((a) => a.onclick = (ev) => { ev.preventDefault(); formLead(leads.find((x) => x.id === a.dataset.lead)); });
  $$("[data-fu]", el).forEach((b) => b.onclick = () => agendarFollowup(leads.find((x) => x.id === b.dataset.fu)));
  $$("[data-perdido]", el).forEach((b) => b.onclick = () => marcarPerdido(leads.find((x) => x.id === b.dataset.perdido)));
  $$("[data-mover]", el).forEach((b) => b.onclick = async () => {
    const l = leads.find((x) => x.id === b.dataset.mover), para = b.dataset.para;
    if (para === "cliente") return converter(l);
    try { await D.atualizar("leads", { id: l.id }, { etapa: para, motivo_perda: para === "prospeccao" ? null : l.motivo_perda }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
};
function marcarPerdido(l) {
  const m = abrirModal("Marcar como perdido", `<p class="muted">${esc(l.nome)}</p><label>Motivo</label><select id="pd-m">${MOTIVOS_PERDA.map((x) => `<option>${x}</option>`).join("")}</select>
    <label>Detalhe (opcional)</label><input type="text" id="pd-d"><p class="muted">A reabordagem fica agendada para daqui a 2 meses, nas suas tarefas.</p>
    <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="pd-ok">Marcar como perdido</button></div>`);
  $("#pd-ok", m).onclick = async () => {
    const volta = somarMeses(hojeISO(), 2), motivo = $("#pd-m", m).value + ($("#pd-d", m).value.trim() ? ": " + $("#pd-d", m).value.trim() : "");
    try {
      await limparFollowups(l);
      await D.atualizar("leads", { id: l.id }, { etapa: "perdido", motivo_perda: motivo, proximo_passo: volta });
      await D.inserir("tarefas", { cliente_id: null, lead_id: l.id, titulo: `Reabordar: ${l.nome}`, tipo: "Reabordagem", responsavel: "Social media", prioridade: "baixa", prazo: volta, nota: "Motivo da perda: " + motivo, status: "a_fazer" });
      fecharModal(); avisar("Marcado como perdido. Reabordagem agendada para daqui a 2 meses.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}
async function converter(l) {
  const planos = await D.lista("planos", { ordem: "ordem" }).catch(() => []);
  R.cadastrarCliente(planos, { nome: l.nome, instagram: l.instagram, valor: l.valor }, async (cid) => {
    await limparFollowups(l);
    await D.atualizar("leads", { id: l.id }, { etapa: "cliente", cliente_id: cid, proximo_passo: null });
    await D.inserir("tarefas", { cliente_id: cid, titulo: "Agendar reunião de onboarding", tipo: "Onboarding", responsavel: "Social media", prioridade: "alta", prazo: somarDias(hojeISO(), 2), status: "a_fazer" });
    rotear();
  });
}

// ----------------------------------------------------------------- Customer Success
TELAS_ADMIN.cs = async (el) => {
  const hoje = hojeISO();
  const [leads, propostas, ops, pesq, chamados, ultimas] = await Promise.all([
    D.lista("leads", {}), D.lista("propostas", {}), D.lista("operacao", { eq: { mes: "onboarding" } }), D.lista("pesquisa_satisfacao", {}),
    D.lista("chamados", { in: { status: CH_ABERTOS } }, "id,cliente_id"), D.lista("notificacoes", { eq: { para: "admin" }, ordem: "-created_at", limite: 500 }, "cliente_id,created_at"),
  ]);
  const ativos = S.clientes.filter((c) => !["encerrado"].includes(c.status));
  const abordados = leads.filter((l) => l.data_abordagem).length;
  const responderam = leads.filter((l) => !["prospeccao"].includes(l.etapa) && l.etapa !== "perdido").length;
  const enviadas = propostas.filter((p) => p.enviada_em);
  const leadsComProposta = new Set(enviadas.map((p) => p.lead_id));
  const fechados = leads.filter((l) => l.etapa === "cliente");
  const fechadosComProposta = fechados.filter((l) => leadsComProposta.has(l.id)).length;
  const ciclos = fechados.map((l) => { const c = S.clientes.find((x) => x.id === l.cliente_id); return l.data_abordagem && c && c.created_at ? diasEntre(l.data_abordagem, c.created_at) : null; }).filter((x) => x != null && x >= 0);
  const pagantes = S.clientes.filter((c) => c.status === "ativo" && Number(c.valor_mensal) > 0);
  const onbOk = (cid) => { const e = R.etapasOnb(ops.find((o) => o.cliente_id === cid)); return ETAPAS_ONB.every((_, i) => e["onb" + (i + 1)]); };
  const encerrados = S.clientes.filter((c) => c.status === "encerrado").length;
  const tres = somarMeses(mesAtual() + "-01", -2).slice(0, 7);
  const notas = pesq.filter((x) => x.mes >= tres && x.nota != null);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "sem dado");
  const SEM = `<span class="muted">sem dado</span>`;
  // relacionamento
  const em30 = somarDias(hoje, 30), em60 = somarDias(hoje, 60);
  const aniversarios = S.clientes.filter((c) => c.aniversario).map((c) => { const a = c.aniversario.slice(5); let d = hoje.slice(0, 4) + "-" + a; if (d < hoje) d = (Number(hoje.slice(0, 4)) + 1) + "-" + a; return { c, d }; }).filter((x) => x.d <= em30);
  const renovacoes = S.clientes.filter((c) => c.contrato_fim && c.contrato_fim >= hoje && c.contrato_fim <= em60);
  const ultima = (cid) => (ultimas.find((n) => n.cliente_id === cid) || {}).created_at;
  const semInteracao = ativos.filter((c) => { const u = ultima(c.id); return !u || diasEntre(u, hoje) > 7; });
  const semPesquisa = ativos.filter((c) => !pesq.some((x) => x.cliente_id === c.id && x.mes === mesAtual()));
  const linha = (n, v) => `<tr><td>${n}</td><td><b>${v}</b></td></tr>`;
  el.innerHTML = `<h1>Customer Success</h1><p class="sub">Métricas comerciais e de relacionamento. Exclusivas da administração.</p>
    <div class="grid g3">
      <div class="cartao"><h3>SDR</h3><table class="ficha">${linha("Leads recebidos", leads.length)}${linha("Leads qualificados", leads.filter((l) => !["prospeccao", "perdido"].includes(l.etapa)).length)}
        ${linha("Taxa de resposta", pct(responderam, abordados))}${linha("Tempo de 1ª resposta", SEM)}${linha("Reuniões agendadas", leads.filter((l) => l.etapa === "onboarding_agendado").length)}${linha("Comparecimento", SEM)}</table></div>
      <div class="cartao"><h3>Closer</h3><table class="ficha">${linha("Propostas apresentadas", enviadas.length)}${linha("Propostas aguardando resposta", leads.filter((l) => l.etapa === "proposta_enviada").length)}
        ${linha("Taxa de fechamento", pct(fechadosComProposta, leadsComProposta.size))}${linha("Ticket médio", pagantes.length ? esc(fmtMoeda(pagantes.reduce((s, c) => s + Number(c.valor_mensal), 0) / pagantes.length)) : SEM)}
        ${linha("Ciclo médio de vendas", ciclos.length ? Math.round(ciclos.reduce((a, b) => a + b, 0) / ciclos.length) + " dias" : SEM)}</table></div>
      <div class="cartao"><h3>Customer Success</h3><table class="ficha">${linha("Onboarding concluído", `${ativos.filter((c) => onbOk(c.id)).length}/${ativos.length}`)}${linha("Time to Value", SEM)}
        ${linha("Retenção", pct(S.clientes.length - encerrados, S.clientes.length))}${linha("Churn", pct(encerrados, S.clientes.length))}
        ${linha("CSAT médio (3 meses)", notas.length ? (notas.reduce((s, x) => s + x.nota, 0) / notas.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : SEM)}${linha("Chamados abertos", chamados.length)}</table></div>
    </div>
    <div class="cartao sec"><h3>Relacionamento: próximos toques</h3><div class="lista">
      ${aniversarios.map((x) => `<div>${tag("aniversário", "t-terra")} ${esc(x.c.nome)}: ${esc(fmtDiaLongo(x.d))}</div>`).join("")}
      ${renovacoes.map((c) => `<div>${tag("renovação", "t-ambar")} ${esc(c.nome)}: contrato termina em ${esc(fmtData(c.contrato_fim))}</div>`).join("")}
      ${semInteracao.map((c) => `<div>${tag("sem interação", "t-verm")} ${esc(c.nome)}: mandar um toque de relacionamento</div>`).join("")}
      ${semPesquisa.length ? `<div>${tag("pesquisa", "t-azul")} Pesquisa de satisfação de ${esc(nomeMes(mesAtual()))}: falta resposta de ${esc(semPesquisa.map((c) => c.nome).join(", "))}</div>` : ""}
      ${!aniversarios.length && !renovacoes.length && !semInteracao.length && !semPesquisa.length ? `<div class="muted">Nada pendente por enquanto.</div>` : ""}</div></div>
    <p class="muted">"Sem dado" aparece quando o portal ainda não registra a informação necessária para o cálculo.</p>`;
};

// ----------------------------------------------------------------- Relatórios e indicadores
TELAS_ADMIN.indicadores = async (el, args) => {
  const mes = /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : mesAtual(), nv = navMes(mes), c = clienteAtual(), hoje = hojeISO();
  const fc = (f = {}) => (c ? Object.assign({}, f, { eq: Object.assign({}, f.eq || {}, { cliente_id: c.id }) }) : f);
  const [ps, tarefas, ajustes, chamadosAj, rels] = await Promise.all([
    D.lista("posts", fc({ gte: { data: nv.ini }, lte: { data: nv.fim } })),
    D.lista("tarefas", fc({ gte: { prazo: nv.ini }, lte: { prazo: nv.fim } })),
    D.lista("aprovacoes", fc({ eq: { decisao: "ajuste" }, gte: { created_at: nv.ini }, lte: { created_at: nv.fim + "T23:59:59" } })),
    D.lista("chamados", fc({ eq: { origem: "aprovacao", status: "concluido" } })),
    D.lista("relatorios", fc({ ordem: "-mes" })),
  ]);
  const aprovados = ps.filter((p) => ["aprovado", "agendado", "publicado"].includes(p.status));
  const tf = tarefas.filter((t) => !t.lead_id), emDia = tf.filter((t) => t.status === "concluido" || t.prazo >= hoje).length;
  const rev = chamadosAj.map((x) => (new Date(x.updated_at) - new Date(x.created_at)) / 864e5).filter((d) => d >= 0);
  el.innerHTML = `<div class="entre"><div><h1>Relatórios e indicadores</h1><p class="sub">${c ? esc(c.nome) : "Todos os clientes"}: eficiência da operação e relatórios dos clientes.</p></div>
      <div class="linha"><a class="btn pequeno" href="#/indicadores/${nv.ant}">‹</a><b>${esc(nv.nome)}</b><a class="btn pequeno" href="#/indicadores/${nv.prox}">›</a></div></div>
    <h3>Produção e entregas</h3><div class="grid g4">
      <div class="kpi"><div class="n">${ps.length}</div><div class="l">Conteúdos planejados</div></div>
      <div class="kpi"><div class="n">${ps.filter((p) => !["pauta", "producao"].includes(p.status)).length}</div><div class="l">Produzidos</div></div>
      <div class="kpi"><div class="n">${ps.filter((p) => p.status === "publicado").length}</div><div class="l">Publicados</div></div>
      <div class="kpi"><div class="n">${tf.length ? Math.round((emDia / tf.length) * 100) + "%" : "-"}</div><div class="l">Tarefas em dia</div></div></div>
    <h3 class="sec">Aprovações</h3><div class="grid g4">
      <div class="kpi"><div class="n">${aprovados.length ? Math.round((aprovados.filter((p) => Number(p.versao || 1) <= 1).length / aprovados.length) * 100) + "%" : "-"}</div><div class="l">Aprovados na 1ª versão</div></div>
      <div class="kpi"><div class="n">${ajustes.length}</div><div class="l">Pedidos de ajuste no mês</div></div>
      <div class="kpi"><div class="n">${rev.length ? (rev.reduce((a, b) => a + b, 0) / rev.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " dia" : "-"}</div><div class="l">Tempo médio de revisão</div></div>
      <div class="kpi"><div class="n">${ps.filter((p) => p.status === "aprovacao").length}</div><div class="l">Pendentes</div></div></div>
    <div class="entre sec"><h3 style="margin:0">Relatórios dos clientes</h3>${c ? `<button class="btn primario pequeno" id="rel-novo">Novo relatório</button>` : `<span class="muted">Escolha um cliente na barra para criar um relatório.</span>`}</div>
    <div class="cartao tabela" style="margin-top:8px"><table><tr><th>Cliente</th><th>Período</th><th>Tipo</th><th>Situação</th><th></th></tr>
    ${rels.map((r) => `<tr><td>${esc(nomeCliente(r.cliente_id))}</td><td>${esc(nomeMes(r.mes))}</td><td>${r.tipo === "quinzenal" ? "Quinzenal" : "Mensal"}</td>
      <td>${r.publicado ? tag("Disponível para o cliente", "t-verde") : tag("Análise interna", "t-cinza")}</td>
      <td><div class="linha"><button class="btn pequeno" data-rel="${esc(r.id)}">Abrir</button>${r.publicado ? `<button class="btn pequeno" data-despub="${esc(r.id)}">Recolher</button>` : `<button class="btn primario pequeno" data-pub="${esc(r.id)}">Disponibilizar</button>`}</div></td></tr>`).join("")
      || `<tr><td colspan="5" class="muted">Nenhum relatório ainda.</td></tr>`}</table></div>`;
  const editar = (r) => {
    const m = abrirModal(r ? `${r.tipo === "quinzenal" ? "Análise quinzenal" : "Relatório"}: ${nomeCliente(r.cliente_id)}, ${nomeMes(r.mes)}` : "Novo relatório", `<form id="f-rl">
      ${r ? "" : `<div class="grade-form"><div><label>Mês</label><input type="month" id="rl-mes" value="${esc(mes)}" required></div><div><label>Tipo</label><select id="rl-tipo"><option value="mensal">Relatório mensal</option><option value="quinzenal">Análise quinzenal</option></select></div></div>`}
      <label>Conteúdo (markdown)</label><textarea id="rl-txt" class="grande" style="min-height:340px">${esc(r ? r.conteudo : "# Relatório\n\n## Números\n\n## Melhores conteúdos\n\n## Análise estratégica\n\n## Recomendações para o próximo período\n")}</textarea>
      ${r ? `<details><summary>Ver como o cliente vê</summary><div class="cartao" style="margin-top:8px">${md(r.conteudo)}</div></details>` : ""}
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`, { largo: true });
    $("#f-rl", m).onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        // sempre salva como rascunho primeiro: o aviso ao cliente sai quando ele é disponibilizado
        if (r) await D.atualizar("relatorios", { id: r.id }, { conteudo: $("#rl-txt", m).value });
        else await D.upsert("relatorios", { cliente_id: c.id, mes: $("#rl-mes", m).value, tipo: $("#rl-tipo", m).value, conteudo: $("#rl-txt", m).value, publicado: false }, "cliente_id,mes,tipo");
        fecharModal(); avisar("Relatório salvo como análise interna.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  if ($("#rel-novo")) $("#rel-novo").onclick = () => editar(null);
  $$("[data-rel]", el).forEach((b) => b.onclick = () => editar(rels.find((x) => x.id === b.dataset.rel)));
  $$("[data-pub]", el).forEach((b) => b.onclick = async () => {
    try { await D.atualizar("relatorios", { id: b.dataset.pub }, { publicado: true }); avisar("Relatório disponibilizado. O cliente foi notificado.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-despub]", el).forEach((b) => b.onclick = async () => {
    if (!(await confirmar("Recolher este relatório? O cliente deixa de ver.", "Recolher", true))) return;
    try { await D.atualizar("relatorios", { id: b.dataset.despub }, { publicado: false }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
};

// ----------------------------------------------------------------- modo de teste: leads, scripts e pesquisas fictícios
const exemploAnterior = GANCHO.exemplo;
GANCHO.exemplo = (t, C) => {
  if (exemploAnterior) exemploAnterior(t, C);
  const hoje = hojeISO(), ag = (d) => somarDias(hoje, d);
  t.leads = [
    { id: "lead-1", nome: "Doceria Exemplo", instagram: "@doceria_exemplo", origem: "Indicação", tipo_negocio: "Doceria", problema: "Fotos escuras, sem reels", data_abordagem: ag(-10), etapa: "proposta_enviada", proximo_passo: hoje, valor: 1500, pais: "Brasil", idioma: "Português do Brasil", moeda: "BRL", created_at: ag(-10) + "T10:00:00Z" },
    { id: "lead-2", nome: "Studio Pilates Exemplo", instagram: "@pilates_exemplo", origem: "Prospecção fria", tipo_negocio: "Studio de pilates", problema: "Posta sem estratégia, bio sem chamada", data_abordagem: ag(-3), etapa: "em_conversa", valor: 2000, pais: "Brasil", idioma: "Português do Brasil", moeda: "BRL", created_at: ag(-3) + "T10:00:00Z" },
    { id: "lead-3", nome: "Barbearia Exemplo", instagram: "@barbearia_exemplo", origem: "Instagram", tipo_negocio: "Barbearia", problema: "Último post há 25 dias", data_abordagem: ag(-6), etapa: "onboarding_agendado", valor: 1500, pais: "Brasil", idioma: "Português do Brasil", moeda: "BRL", created_at: ag(-6) + "T10:00:00Z" },
    { id: "lead-4", nome: "Ótica Exemplo", instagram: "@otica_exemplo", origem: "Prospecção fria", tipo_negocio: "Ótica", problema: "Bio não diz o que faz", data_abordagem: null, etapa: "prospeccao", valor: 1000, pais: "Portugal", idioma: "Português de Portugal", moeda: "EUR", fuso: "Lisboa (+3h)", created_at: ag(-1) + "T10:00:00Z" },
    { id: "lead-5", nome: "Loja Exemplo", instagram: "@loja_exemplo", origem: "Indicação", tipo_negocio: "Loja de roupas", problema: "Sem identidade visual", data_abordagem: ag(-40), etapa: "perdido", motivo_perda: "Preço", proximo_passo: somarMeses(hoje, 1), valor: 1500, moeda: "BRL", created_at: ag(-40) + "T10:00:00Z" },
    { id: "lead-6", nome: "Ateliê Exemplo", instagram: "@atelie_exemplo", origem: "Instagram", tipo_negocio: "Ateliê", data_abordagem: ag(-20), etapa: "cliente", cliente_id: "exemplo-0003", valor: 2000, moeda: "BRL", created_at: ag(-20) + "T10:00:00Z" },
  ];
  const c3 = (t.clientes || []).find((c) => c.id === "exemplo-0003"); if (c3) c3.created_at = ag(-3) + "T10:00:00Z";
  t.propostas = [{ id: "pr-1", lead_id: "lead-1", conteudo: "Proposta de exemplo", moeda: "BRL", validade: ag(-3), enviada_em: ag(-10) + "T15:00:00Z", created_at: ag(-10) + "T15:00:00Z" },
    { id: "pr-2", lead_id: "lead-6", conteudo: "Proposta de exemplo", moeda: "BRL", validade: ag(-13), enviada_em: ag(-18) + "T15:00:00Z", created_at: ag(-18) + "T15:00:00Z" }];
  t.scripts = [
    { id: "sc-1", situacao: "Script de exemplo: primeira mensagem", objetivo: "Exemplo", texto: "Oi, [nome]! Texto de exemplo para [negócio]. Os scripts reais ficam na tabela scripts.", ordem: 1 },
    { id: "sc-2", situacao: "Script de exemplo: follow-up", objetivo: "Exemplo", texto: "Oi, [nome]! Outro texto de exemplo.", ordem: 2 },
  ];
  t.pesquisa_satisfacao = [{ id: "ps-1", cliente_id: C, mes: mesAtual(), nota: 9, comentario: "Exemplo" }, { id: "ps-2", cliente_id: "exemplo-0002", mes: somarMeses(mesAtual() + "-01", -1).slice(0, 7), nota: 8 }];
  t.agenda.push({ id: "g-fu1", cliente_id: null, lead_id: "lead-1", data: hoje, hora: "16:00", titulo: "Follow-up Doceria Exemplo", tipo: FU, compartilhado: false });
  const t6 = (t.tarefas || []).find((x) => x.id === "t-6"); if (t6) t6.titulo = "Follow-up: Doceria Exemplo (WhatsApp)";
};
})();

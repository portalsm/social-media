// =============================================================================
// nucleo.js: base da reforma do portal.
//   - menus do Portal do Cliente e do Painel Administrativo
//   - moldura (topo, menu, barra de cliente), roteador e contadores
//   - peças comuns às telas novas (status, etiquetas, calendário, capas)
//   - modo de teste local: dados de exemplo das tabelas novas e os mesmos
//     gatilhos do banco (no modo real quem faz isso é o próprio banco)
// Depende de js/app.js (window.__portal). As telas ficam em cliente.js e admin.js.
// =============================================================================
(function () {
"use strict";
const P = window.__portal;
const { S, ROTAS, GANCHO, $, $$, esc, hojeISO, mesAtual, somarDias, fmtDataCurta, nomeMes, avisar, erroAmigavel,
  abrirModal, fecharModal, confirmar, clienteAtual, ehSM, sair, logoHtml } = P;
// D muda depois do login (real ou teste): sempre pega a camada ativa
const D = new Proxy({}, { get: (_, k) => { const d = P.D; const v = d[k]; return typeof v === "function" ? v.bind(d) : v; } });

// ----------------------------------------------------------------- constantes
const STATUS = {
  pauta: ["Pauta (interno)", "t-cinza"], producao: ["Em produção (interno)", "t-cinza"], revisao: ["Revisão interna", "t-cinza"],
  planejado: ["Planejado", "t-azul"], aprovacao: ["Aguardando aprovação", "t-ambar"], ajuste: ["Revisão solicitada", "t-verm"],
  aprovado: ["Aprovado", "t-verde"], agendado: ["Agendado", "t-verde"], publicado: ["Publicado", "t-terra"],
};
const INTERNOS = ["pauta", "producao", "revisao"];
const CH_STATUS = { novo: "Novo", em_analise: "Em análise", em_execucao: "Em execução", aguardando_cliente: "Aguardando cliente", concluido: "Concluído" };
const CH_SIMPLES = { novo: "Recebida", em_analise: "Em análise", em_execucao: "Em andamento", aguardando_cliente: "Esperando você", concluido: "Concluída" };
const CH_ABERTOS = ["novo", "em_analise", "em_execucao", "aguardando_cliente"];
const PRIO = { alta: "Alta", media: "Média", baixa: "Baixa" };
const PRIO_COR = { alta: "t-verm", media: "t-ambar", baixa: "" };
const TAREFA_ST = { a_fazer: "A fazer", em_execucao: "Em execução", revisao: "Revisão", concluido: "Concluído" };
const IDEIA_ST = {
  nova: ["Nova ideia", "t-azul"], em_analise: ["Em análise", "t-ambar"], aprovada: ["Aprovada para planejamento", "t-verde"],
  nao_selecionada: ["Não selecionada", "t-cinza"], virou_pauta: ["Incorporada ao calendário", "t-terra"], arquivada: ["Arquivada", "t-cinza"],
};
const FORMATOS = { carrossel: "Carrossel", reels: "Reels", post: "Post", stories: "Stories" };
const ICO_FORMATO = { carrossel: "▤ Carrossel", reels: "▶ Reels", post: "▢ Post", stories: "◔ Stories" };
const ETAPAS_ONB = ["Cliente cadastrado e plano vinculado", "Acesso individual liberado", "Mensagem de boas-vindas enviada", "Briefing liberado",
  "Briefing respondido pelo cliente", "Briefing analisado e complementado", "Reunião de alinhamento", "Cérebro da Marca e estratégia prontos"];
const CATS_ARQ = ["Identidade visual", "Logotipos", "Fotos", "Vídeos", "Documentos compartilhados", "Materiais de campanhas", "Briefing", "Planejamentos", "Relatórios", "Conteúdos aprovados"];
const LINK_DRIVE = /^https:\/\/(drive|docs)\.google\.com\//;

const MENU_C = [["inicio", "Início"], ["calendario", "Calendário Editorial"], ["aprovacoes", "Aprovações"], ["briefing", "Briefing"], ["ideias", "Ideias e Referências"],
  ["relatorios", "Relatórios"], ["arquivos", "Arquivos"], ["solicitacoes", "Solicitações"], ["notificacoes", "Notificações"], ["conta", "Minha Conta"]];
const MENU_A = [["dashboard", "Dashboard Geral"], ["crm", "CRM Comercial"], ["clientes", "Clientes"], ["funil", "Funil de Vendas"], ["onboarding", "Onboarding"],
  ["planejamento", "Planejamento Estratégico"], ["operacao", "Operação do Mês"], ["conteudos", "Gestão de Conteúdos"], ["producao", "Produção"],
  ["calendario-geral", "Calendário Geral"], ["chamados", "Chamados Internos"], ["indicadores", "Relatórios e Indicadores"],
  ["cs", "Customer Success"], ["agenda", "Agenda"], ["arquivos", "Arquivos"], ["configuracoes", "Configurações"]];
// Telas com a barra de cliente fixa no topo. Operação e Planejamento não têm "Todos".
const POR_CLIENTE = ["operacao", "planejamento", "conteudos", "producao", "calendario-geral", "chamados", "indicadores", "arquivos"];
const SEM_TODOS = ["operacao", "planejamento"];
// Telas atuais da administração que continuam abertas até a versão nova substituir
const LEGADO_SM = { inicio: "Início do cliente (atual)", cerebro: "Cérebro da Marca", conteudo: "Ganchos e prompts", calendario: "Calendário (atual)",
  produto: "Produto", lancamento: "Lançamento", analise: "Análise", relatorios: "Relatórios (editor)",
  "config-cliente": "Configurações do cliente", painel: "Painel geral (atual)", "minhas-configuracoes": "Minhas configurações" };
const LEGADO_SEM_CLIENTE = ["painel", "minhas-configuracoes"];
// Telas do menu do cliente que a social media pode esconder (ids antigos em clientes.telas_visiveis)
const TELA_ANTIGA = { ideias: "ideias", relatorios: "resultados", arquivos: "acervo" };

// ----------------------------------------------------------------- peças
const tag = (t, c = "") => `<span class="tag ${c}">${esc(t)}</span>`;
const tagS = (s) => { const x = STATUS[s] || [s, "t-cinza"]; return `<span class="tag ${x[1]}">${esc(x[0])}</span>`; };
const nomeFormato = (f) => FORMATOS[f] || (f ? String(f).charAt(0).toUpperCase() + String(f).slice(1) : "Post");
const nomeCliente = (id) => ((S.clientes.find((c) => c.id === id) || {}).nome || "Cliente");
const prazoDias = (c) => Number(((c || {}).escopo || {}).prazo_aprovacao_dias || 2);
const rodadas = (c) => Number(((c || {}).escopo || {}).rodadas_ajuste || 2);
const usadasRodadas = (versoes) => (versoes || []).filter((v) => String(v.motivo || "").startsWith("ajuste pedido")).length;
const agoraISO = () => new Date().toISOString();
const comHistorico = (ch, texto) => [...(Array.isArray(ch.historico) ? ch.historico : []), { em: agoraISO(), o: texto }];
const fmtDiaLongo = (iso) => new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const linkSeguro = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
const CORES = ["#8E5B3C", "#5E4030", "#B5562E", "#6F4A35", "#A86B45", "#7D4B2F", "#9A6A4A", "#43658B", "#4F7A55", "#7A8F6A"];
function corDe(texto) { let h = 0; for (const ch of String(texto || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; }
const gradiente = (texto) => `linear-gradient(160deg,${corDe(texto)},#2B2420)`;
function primeiroNome(t) { return String(t || "").trim().split(/\s+/)[0] || ""; }

/** URL da capa de um post (capa no bucket midias; sem capa, a primeira mídia; senão vazio). */
async function capaUrl(p) {
  if (p.capa) { if (/^(data:|blob:|https?:)/.test(p.capa)) return p.capa; return await D.urlArquivo("midias", p.capa); }
  const m = (Array.isArray(p.midias) ? p.midias : [])[0];
  if (!m) return "";
  if (m.src) return m.src;
  if (m.url) return m.url;
  if (m.caminho) return await D.urlArquivo("midias", m.caminho);
  return "";
}

/** Grade de um mês (segunda a domingo). Cada post vira um botão data-post. */
function gradeMes(mes, posts, opcoes = {}) {
  const [a, m] = mes.split("-").map(Number);
  const ini = new Date(a, m - 1, 1), dow = (ini.getDay() + 6) % 7, dias = new Date(a, m, 0).getDate();
  const nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  let h = `<div class="cal-cab">${nomes.map((n) => `<div>${n}</div>`).join("")}</div><div class="cal">`;
  for (let i = 0; i < dow; i++) h += `<div class="dia fora"></div>`;
  for (let d = 1; d <= dias; d++) {
    const iso = `${mes}-${String(d).padStart(2, "0")}`;
    h += `<div class="dia ${iso === hojeISO() ? "hoje" : ""}"><div class="n">${d}</div>${(opcoes.datas || []).filter((x) => x.data === iso).map((x) =>
      `<span class="data-esp ${x.tipo}" title="${esc(TIPO_DATA[x.tipo] + ": " + x.nome)}">${esc(x.nome)}</span>`).join("")}${posts.filter((p) => p.data === iso).map((p) =>
      `<button class="chip ${(STATUS[p.status] || [, "t-cinza"])[1]}" data-post="${esc(p.id)}" title="${esc(p.tema || "")}">${opcoes.comCliente ? esc(primeiroNome(nomeCliente(p.cliente_id))) + ": " : ""}${esc(nomeFormato(p.formato))}: ${esc(String(p.tema || "").slice(0, 28))}</button>`).join("")}</div>`;
  }
  return h + "</div>";
}
// ----------------------------------------------------------------- registro único por cliente em operacao
// O checklist do Onboarding (mes = 'onboarding') e os materiais do Planejamento (mes = 'planejamento') ficam
// numa linha só por cliente, no campo checklist. A coluna etapa precisa existir em operacao_modelo (regra do
// banco), então usamos a primeira chave do modelo. Só a administração lê e grava esta tabela.
let chaveBase = null;
async function chaveRegistro() {
  if (chaveBase) return chaveBase;
  const m = await D.lista("operacao_modelo", { ordem: "ordem", limite: 1 }, "chave");
  if (!m.length) throw { erro: "A tabela operacao_modelo está vazia: cadastre as etapas da operação primeiro." };
  chaveBase = m[0].chave;
  return chaveBase;
}
const registros = (mes, cid = null) => D.lista("operacao", { eq: cid ? { mes, cliente_id: cid } : { mes }, ordem: "feita_em" });
async function salvarRegistro(cid, mes, checklist, extra = {}) {
  const ex = (await registros(mes, cid))[0];
  if (ex) return D.atualizar("operacao", { id: ex.id }, Object.assign({ checklist }, extra));
  return D.inserir("operacao", Object.assign({ cliente_id: cid, mes, etapa: await chaveRegistro(), feita: false, checklist }, extra));
}
/** Etapas do onboarding marcadas: { onb1: "data", ... } */
const etapasOnb = (r) => (r && r.checklist && typeof r.checklist === "object" && !Array.isArray(r.checklist) ? r.checklist : {});
/** Materiais do planejamento: [{ id, nome, link, compartilhado, compartilhado_em }] */
const materiaisPlan = (r) => (r && Array.isArray(r.checklist) ? r.checklist.filter((x) => x && typeof x === "object") : []);

// ----------------------------------------------------------------- datas importantes (feriados e datas comerciais)
// Calculadas para qualquer ano, inclusive as móveis (Páscoa, Carnaval, Dia das Mães, Black Friday).
const TIPO_DATA = { feriado: "Feriado nacional", facultativo: "Ponto facultativo", comercial: "Data comercial", area: "Data da nossa área" };
function pascoa(ano) {   // algoritmo de Meeus/Jones/Butcher (calendário gregoriano)
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
/** n-ésimo dia da semana do mês (dow: 0 domingo ... 6 sábado). */
function enesimo(ano, mes, dow, n) {
  const d = new Date(Date.UTC(ano, mes - 1, 1)); const delta = (dow - d.getUTCDay() + 7) % 7;
  d.setUTCDate(1 + delta + (n - 1) * 7); return d.toISOString().slice(0, 10);
}
function datasEspeciais(ano) {
  const f = (mmdd) => `${ano}-${mmdd}`, p = pascoa(ano), mais = (iso, n) => somarDias(iso, n);
  const blackFriday = mais(enesimo(ano, 11, 4, 4), 1);   // a sexta depois da quarta quinta-feira de novembro
  return [
    [f("01-01"), "Confraternização Universal", "feriado"], [mais(p, -48), "Carnaval", "facultativo"], [mais(p, -47), "Carnaval", "facultativo"],
    [mais(p, -46), "Quarta-feira de Cinzas", "facultativo"], [mais(p, -2), "Sexta-feira Santa", "feriado"], [p, "Páscoa", "comercial"],
    [f("04-21"), "Tiradentes", "feriado"], [f("05-01"), "Dia do Trabalho", "feriado"], [mais(p, 60), "Corpus Christi", "facultativo"],
    [f("09-07"), "Independência do Brasil", "feriado"], [f("10-12"), "Nossa Senhora Aparecida", "feriado"], [f("11-02"), "Finados", "feriado"],
    [f("11-15"), "Proclamação da República", "feriado"], [f("11-20"), "Consciência Negra", "feriado"], [f("12-25"), "Natal", "feriado"],
    [f("03-08"), "Dia Internacional da Mulher", "comercial"], [f("03-15"), "Dia do Consumidor (Semana do Consumidor)", "comercial"],
    [enesimo(ano, 5, 0, 2), "Dia das Mães", "comercial"], [f("06-12"), "Dia dos Namorados", "comercial"], [f("06-24"), "São João (festas juninas)", "comercial"],
    [f("07-20"), "Dia do Amigo", "comercial"], [f("07-26"), "Dia dos Avós", "comercial"], [enesimo(ano, 8, 0, 2), "Dia dos Pais", "comercial"],
    [f("09-15"), "Dia do Cliente", "comercial"], [f("10-12"), "Dia das Crianças", "comercial"], [f("10-31"), "Halloween", "comercial"],
    [f("11-19"), "Dia da Mulher Empreendedora", "comercial"], [blackFriday, "Black Friday", "comercial"], [mais(blackFriday, 3), "Cyber Monday", "comercial"],
    [f("12-24"), "Véspera de Natal", "comercial"], [f("12-31"), "Véspera de Ano-Novo", "comercial"],
    [f("01-08"), "Dia do Fotógrafo", "area"], [f("02-01"), "Dia do Publicitário", "area"], [f("05-08"), "Dia do Profissional de Marketing", "area"],
    [f("06-30"), "Dia Mundial das Redes Sociais", "area"], [f("10-05"), "Dia do Empreendedor", "area"], [f("10-06"), "Aniversário do Instagram", "area"],
    [f("11-05"), "Dia do Designer", "area"],
  ].map(([data, nome, tipo]) => ({ data, nome, tipo })).sort((x, y) => x.data.localeCompare(y.data));
}
const datasDoMes = (mes) => datasEspeciais(Number(mes.slice(0, 4))).filter((x) => x.data.startsWith(mes));

function navMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  return { ant: new Date(a, m - 2, 15).toISOString().slice(0, 7), prox: new Date(a, m, 15).toISOString().slice(0, 7),
    ini: mes + "-01", fim: `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`,
    nome: (() => { const n = nomeMes(mes); return n.charAt(0).toUpperCase() + n.slice(1); })() };
}

/** Caixa de texto só para ler, com botão Copiar. */
function caixaCopiar(id, texto, altura = 160) {
  return `<textarea id="${id}" readonly class="caixa-copiar" style="min-height:${altura}px">${esc(texto)}</textarea>
    <div class="linha" style="justify-content:flex-end;margin-top:6px"><button class="btn primario pequeno" data-copiar="${id}">Copiar</button></div>`;
}
function ligarCopiar(raiz) {
  $$("[data-copiar]", raiz).forEach((b) => b.onclick = async () => {
    const el = document.getElementById(b.dataset.copiar);
    try { await navigator.clipboard.writeText(el.value); } catch (_) { el.select(); document.execCommand("copy"); }
    avisar("Copiado.", "ok");
  });
}

/** Notificação dentro do portal (só a administração grava direto; as do cliente o banco cria). */
async function notificar(para, clienteId, texto, link = null) {
  try { await D.inserir("notificacoes", { para, cliente_id: clienteId, texto, link, lida: false }); }
  catch (e) { console.warn("notificação não gravada", e); }
}

// ----------------------------------------------------------------- moldura
/** Fecha janelas por cima da tela (visualizador de post) ao trocar de tela ou sair. */
function fecharSobrepostos() { $$(".viewer").forEach((v) => v.remove()); document.body.style.overflow = ""; }
function moldura(tela) {
  fecharSobrepostos();
  const sm = ehSM() && !S.verComo;
  const menu = sm ? MENU_A : MENU_C.filter(([k]) => visivelCliente(k, clienteAtual()));
  const legado = sm && LEGADO_SM[tela];
  const nome = esc(String(S.usuario.nome || S.usuario.email || "").trim());
  $("#app").innerHTML = `
    ${S.verComo ? `<div class="faixa-vercomo">Você está vendo o portal como <b>${esc((clienteAtual() || {}).nome || "")}</b>. É só visualização: nada que você clicar aqui é gravado. <button class="btn pequeno" id="sair-vercomo">Voltar ao painel</button></div>` : ""}
    <header class="topo-ps">
      <a class="marca-link" href="#/${sm ? "dashboard" : "inicio"}" aria-label="Início">${logoHtml("menu")}</a>
      <span class="espaco"></span>
      ${sm ? "" : `<span class="tag t-cinza so-largo">${esc((clienteAtual() || {}).nome || "")}</span>`}
      <button class="sino" id="sino" aria-label="Notificações">Notificações <i id="sino-n">0</i></button>
      <span class="quem so-largo" title="${nome}">${nome}</span>
      <button class="btn pequeno" id="btn-sair">Sair</button>
    </header>
    <div class="app-ps">
      <nav class="menu-ps" id="menu-ps"><div class="tit">${sm ? "Menu administrativo" : "Menu do cliente"}</div>
        ${menu.map(([k, l]) => `<a href="#/${k}" class="${tela === k ? "on" : ""}" data-menu="${k}">${esc(l)}<em class="escondido"></em></a>`).join("")}
        ${sm ? `<details class="mais-telas" ${legado ? "open" : ""}><summary>Telas atuais</summary>${Object.entries(LEGADO_SM).map(([k, l]) => `<a href="#/${k}" class="${tela === k ? "on" : ""}">${esc(l)}</a>`).join("")}</details>` : ""}
        ${S.modo === "local" ? `<p class="muted" style="padding:10px">Modo de teste local: dados fictícios.</p>` : ""}
      </nav>
      <main class="main-ps" id="conteudo"><p class="muted">Carregando...</p></main>
    </div>`;
  $("#btn-sair").onclick = () => { fecharSobrepostos(); sair(); };
  if ($("#sair-vercomo")) $("#sair-vercomo").onclick = () => sairVerComo();
  $("#sino").onclick = () => { if (sm) painelNotificacoesAdmin(); else location.hash = "#/notificacoes"; };
  const ativo = $(".menu-ps a.on");
  if (ativo && ativo.scrollIntoView && window.innerWidth < 820) ativo.scrollIntoView({ block: "nearest", inline: "center" });
  return $("#conteudo");
}

function visivelCliente(k, c) {
  if (!c || !TELA_ANTIGA[k]) return true;
  const vis = c.telas_visiveis;
  return !Array.isArray(vis) || !vis.length || vis.includes(TELA_ANTIGA[k]);
}

/** Barra de clientes fixa (administração). Troca o cliente e recarrega a tela. */
function barraCliente(semTodos) {
  if (semTodos && !S.clienteId && S.clientes.length) S.clienteId = S.clientes[0].id;
  const el = document.createElement("div");
  el.className = "barcli";
  el.innerHTML = `<span class="muted">Cliente:</span>${semTodos ? "" : `<button class="${S.clienteId ? "" : "on"}" data-cli="">Todos</button>`}
    ${S.clientes.map((c) => `<button class="${S.clienteId === c.id ? "on" : ""}" data-cli="${esc(c.id)}">${esc(c.nome)}</button>`).join("") || `<span class="muted">Nenhum cliente cadastrado.</span>`}`;
  $$("[data-cli]", el).forEach((b) => b.onclick = async () => {
    if (S.sujo && !(await confirmar("Você tem alterações não salvas. Trocar de cliente mesmo assim?", "Trocar", true))) return;
    S.sujo = false;
    S.clienteId = b.dataset.cli || null;
    try { localStorage.setItem("portal-cliente", S.clienteId || ""); } catch (_) { /* sem storage */ }
    rotear();
  });
  return el;
}

// ----------------------------------------------------------------- contadores
async function atualizarContadores() {
  const marcar = (k, n) => { const em = $(`[data-menu="${k}"] em`); if (em) { em.textContent = n; em.classList.toggle("escondido", !n); } };
  try {
    if (ehSM() && !S.verComo) {
      const [notif, ch, br] = await Promise.all([
        D.contar("notificacoes", { eq: { para: "admin", lida: false } }),
        D.contar("chamados", { in: { status: CH_ABERTOS } }),
        D.contar("briefing_alteracoes", { eq: { status: "pendente" } }),
      ]);
      $("#sino-n") && ($("#sino-n").textContent = notif);
      marcar("chamados", ch); marcar("onboarding", br);
    } else {
      const cid = S.verComo || S.usuario.cliente_id;
      const [notif, apr] = await Promise.all([
        D.contar("notificacoes", { eq: { para: "cliente", cliente_id: cid, lida: false } }),
        D.contar("posts", { eq: { cliente_id: cid, status: "aprovacao", visivel_cliente: true } }),
      ]);
      $("#sino-n") && ($("#sino-n").textContent = notif);
      marcar("notificacoes", notif); marcar("aprovacoes", apr);
    }
  } catch (e) { console.warn("contadores", e); }
}

/** Notificações da administração (painel no sino). */
async function painelNotificacoesAdmin() {
  let lista = [];
  try { lista = await D.lista("notificacoes", { eq: { para: "admin" }, ordem: "-created_at", limite: 60 }); } catch (e) { avisar(erroAmigavel(e), "erro"); return; }
  const m = abrirModal("Notificações da administração", `<div class="lista">${lista.map((n) => `<div class="entre">
      <span>${n.lida ? "" : tag("nova", "t-terra")}${n.link ? `<a href="${esc(n.link)}" data-fechar>${esc(n.texto)}</a>` : esc(n.texto)}<br><span class="muted">${esc(nomeCliente(n.cliente_id))}</span></span>
      <span class="muted">${esc(P.tempoRelativo(n.created_at))}</span></div>`).join("") || `<div class="muted">Nada por aqui.</div>`}</div>
    <div class="modal-rodape"><button class="btn" data-fechar>Fechar</button>${lista.some((n) => !n.lida) ? `<button class="btn primario" id="ler-todas">Marcar todas como lidas</button>` : ""}</div>`);
  const b = $("#ler-todas", m);
  if (b) b.onclick = async () => {
    try { await D.atualizar("notificacoes", { para: "admin", lida: false }, { lida: true }); fecharModal(); atualizarContadores(); avisar("Notificações marcadas como lidas.", "ok"); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ----------------------------------------------------------------- roteador
const TELAS_CLIENTE = {};   // preenchido por cliente.js
const TELAS_ADMIN = {};     // preenchido por admin.js

async function rotear() {
  if (!S.usuario) return;
  if (S.sujo && location.hash !== GANCHO.rotaAnterior) {
    const ok = await confirmar("Você tem alterações não salvas. Sair desta tela mesmo assim?", "Sair sem salvar", true);
    if (!ok) { history.replaceState(null, "", GANCHO.rotaAnterior); return; }
    S.sujo = false;
  }
  GANCHO.rotaAnterior = location.hash;
  fecharModal();
  const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  let tela = partes[0] || "";
  let fn = null;

  if (S.verComo) S.clienteId = S.verComo;
  if (ehSM() && !S.verComo) {
    if (TELAS_ADMIN[tela]) fn = TELAS_ADMIN[tela];
    else if (LEGADO_SM[tela] && ROTAS[tela]) fn = telaLegada(tela);
    else { tela = "dashboard"; fn = TELAS_ADMIN.dashboard; }
  } else {
    const c = clienteAtual();
    if (!c) { $("#app").innerHTML = `<div class="tela-cheia-centro"><div class="caixa-login"><p>Não encontrei o seu cadastro. Fale com a sua social media.</p><button class="btn bloco" id="sair2">Sair</button></div></div>`; $("#sair2").onclick = () => sair(); return; }
    if (!tela) {
      let ob = null;
      try { ob = await D.um("onboarding", { eq: { cliente_id: c.id } }); } catch (_) { ob = null; }
      tela = (!ob || ob.status === "rascunho") ? "briefing" : "inicio";
    }
    if (!TELAS_CLIENTE[tela] || !visivelCliente(tela, c)) tela = "inicio";
    fn = TELAS_CLIENTE[tela];
  }
  S.telaAtual = tela;
  const alvo = moldura(tela);
  let area = alvo;
  if (ehSM() && !S.verComo && (POR_CLIENTE.includes(tela) || (LEGADO_SM[tela] && !LEGADO_SEM_CLIENTE.includes(tela)))) {
    const semTodos = SEM_TODOS.includes(tela) || !!LEGADO_SM[tela];
    alvo.innerHTML = "";
    alvo.appendChild(barraCliente(semTodos));
    area = document.createElement("div");
    alvo.appendChild(area);
  }
  try { await fn(area, partes.slice(1)); }
  catch (e) { console.error(e); area.innerHTML = `<div class="vazio">Não consegui carregar esta tela. ${esc(erroAmigavel(e))}</div>`; }
  atualizarContadores();
  window.scrollTo(0, 0);
}

/** Telas atuais da administração dentro da moldura nova. */
function telaLegada(id) {
  return async (el, args) => {
    if (!LEGADO_SEM_CLIENTE.includes(id) && !clienteAtual()) { el.innerHTML = P.vazio("Escolha um cliente na barra acima."); return; }
    await ROTAS[id](el, args);
  };
}

/** Aviso padrão para telas que chegam numa próxima fase. */
function emBreve(titulo, sub, fase, atalhos = []) {
  return async (el) => {
    el.innerHTML = `<h1>${esc(titulo)}</h1><p class="sub">${esc(sub)}</p>
      <div class="faixa info">Esta tela será reformada na ${esc(fase)}. ${atalhos.length ? "Enquanto isso, use as telas atuais:" : ""}</div>
      ${atalhos.length ? `<div class="linha">${atalhos.map(([h, n]) => `<a class="btn" href="${h}">${esc(n)}</a>`).join("")}</div>` : ""}`;
  };
}

// ----------------------------------------------------------------- Ver como cliente (só leitura)
// Enquanto estiver ligado, qualquer gravação é bloqueada antes de sair do navegador.
const ESCRITAS = ["inserir", "atualizar", "upsert", "apagar", "funcao", "enviarArquivo"];
function travarEscritas(d) {
  if (!d || d.__travado) return;
  for (const k of ESCRITAS) {
    const original = d[k];
    if (typeof original !== "function") continue;
    d[k] = function (...a) { if (S.verComo) return Promise.reject({ erro: "Você está no modo Ver como cliente: é só visualização, nada é gravado." }); return original.apply(this, a); };
  }
  d.__travado = true;
}
function entrarVerComo(cid) {
  if (!ehSM() || !S.clientes.find((c) => c.id === cid)) return;
  travarEscritas(P.D);
  S.verComo = cid; S.clienteId = cid;
  location.hash = "#/inicio"; rotear();
}
function sairVerComo() { S.verComo = null; location.hash = "#/clientes"; rotear(); }

GANCHO.moldura = moldura;
GANCHO.rotear = rotear;

// ----------------------------------------------------------------- modo de teste local
// Mesmo comportamento dos gatilhos do banco (aplicar_aprovacao, avisar_*), só na memória do navegador.
function linhaLocal(t, tabela, dados) {
  const l = Object.assign({ id: P.uid(), created_at: agoraISO() }, dados);
  (t[tabela] = t[tabela] || []).push(l);
  return l;
}
const PADROES = {
  posts: { visivel_cliente: false, status: "pauta", status_conteudo: "pauta", status_design: "nao_se_aplica", status_video: "nao_se_aplica", versao: 1, rede: "instagram" },
  chamados: { visivel_cliente: true, historico: [], status: "novo", prioridade: "media" },
  notificacoes: { lida: false }, tarefas: { status: "a_fazer", prioridade: "media" }, ideias: { status: "nova", autor: "cliente", tipo: "texto" },
  agenda: { compartilhado: false }, arquivos: { enviado_pelo_cliente: false }, briefing_alteracoes: { status: "pendente" },
  estrategias_mes: { status: "rascunho" }, relatorios: { publicado: false, tipo: "mensal" }, operacao: { feita: false, checklist: [] },
};
GANCHO.gatilhos = (tabela, l, antigo) => {
  const t = P.D.t;
  if (!t) return;
  if (!antigo && PADROES[tabela]) for (const [k, v] of Object.entries(PADROES[tabela])) if (l[k] === undefined) l[k] = JSON.parse(JSON.stringify(v));
  const nomeCli = (id) => ((t.clientes || []).find((c) => c.id === id) || {}).nome || "Cliente";
  if (tabela === "aprovacoes" && !antigo) {
    const p = (t.posts || []).find((x) => x.id === l.post_id);
    if (!p) return;
    linhaLocal(t, "post_versoes", { post_id: p.id, cliente_id: p.cliente_id, versao: p.versao || 1, legenda: p.legenda, roteiro: p.roteiro, capa: p.capa, link_drive: p.link_drive,
      motivo: l.decisao === "aprovado" ? "aprovado pelo cliente" : "ajuste pedido: " + (l.comentario || "") });
    if (l.decisao === "ajuste") {
      linhaLocal(t, "chamados", { cliente_id: l.cliente_id, origem: "aprovacao", categoria: "Revisão de conteúdo", descricao: (p.tema || "Post") + (l.trecho ? ` (${l.trecho})` : "") + ": " + (l.comentario || ""),
        prioridade: "alta", prazo: somarDias(hojeISO(), 2), ref_tipo: "post", ref_id: p.id, status: "novo", visivel_cliente: true, historico: [{ em: agoraISO(), o: "Aberto automaticamente pelo pedido de ajuste do cliente" }] });
      linhaLocal(t, "tarefas", { cliente_id: l.cliente_id, post_id: p.id, titulo: "Ajuste: " + (p.tema || "post"), tipo: "Revisar materiais", prioridade: "alta", prazo: somarDias(hojeISO(), 2), status: "a_fazer" });
      linhaLocal(t, "notificacoes", { para: "admin", cliente_id: l.cliente_id, texto: `${nomeCli(l.cliente_id)} pediu ajuste em "${p.tema || "post"}"`, lida: false });
    } else linhaLocal(t, "notificacoes", { para: "admin", cliente_id: l.cliente_id, texto: `${nomeCli(l.cliente_id)} aprovou "${p.tema || "post"}"`, lida: false });
  }
  if (tabela === "briefing_alteracoes" && !antigo) {
    linhaLocal(t, "chamados", { cliente_id: l.cliente_id, origem: "briefing", categoria: "Alteração de briefing", descricao: Object.keys(l.campos || {}).length + " campo(s) para revisar",
      prioridade: "media", prazo: somarDias(hojeISO(), 3), ref_tipo: "briefing_alteracao", ref_id: l.id, status: "novo", visivel_cliente: true, historico: [] });
    linhaLocal(t, "notificacoes", { para: "admin", cliente_id: l.cliente_id, texto: `${nomeCli(l.cliente_id)} propôs mudanças no briefing`, lida: false });
  }
  if (tabela === "chamados" && !antigo && l.origem === "solicitacao")
    linhaLocal(t, "notificacoes", { para: "admin", cliente_id: l.cliente_id, texto: `${nomeCli(l.cliente_id)} abriu uma solicitação`, lida: false });
  if (tabela === "ideias" && !antigo && l.autor === "cliente") {
    linhaLocal(t, "chamados", { cliente_id: l.cliente_id, origem: "ideia", categoria: "Nova ideia enviada", descricao: l.titulo || String(l.conteudo || "").slice(0, 80),
      prioridade: "baixa", prazo: somarDias(hojeISO(), 7), ref_tipo: "ideia", ref_id: l.id, status: "novo", visivel_cliente: true, historico: [] });
    linhaLocal(t, "notificacoes", { para: "admin", cliente_id: l.cliente_id, texto: `${nomeCli(l.cliente_id)} enviou uma nova ideia`, lida: false });
  }
  if (tabela === "estrategias_mes" && antigo) {
    if (l.status === "enviada" && antigo.status !== "enviada") linhaLocal(t, "notificacoes", { para: "cliente", cliente_id: l.cliente_id, texto: "A estratégia do mês está pronta para você aprovar", lida: false });
    else if (["aprovada", "ajuste"].includes(l.status) && antigo.status === "enviada")
      linhaLocal(t, "notificacoes", { para: "admin", cliente_id: l.cliente_id, texto: `${nomeCli(l.cliente_id)} ${l.status === "aprovada" ? "aprovou a estratégia de " : "pediu ajuste na estratégia de "}${l.mes}`, lida: false });
  }
  if (tabela === "relatorios" && antigo && l.publicado && !antigo.publicado)
    linhaLocal(t, "notificacoes", { para: "cliente", cliente_id: l.cliente_id, texto: l.tipo === "quinzenal" ? "Sua análise quinzenal está disponível" : "Seu relatório do mês está disponível", lida: false });
};

/** Dados de exemplo das tabelas novas (fictícios, só no modo de teste). */
GANCHO.exemplo = (t, C) => {
  const hoje = hojeISO(), ag = (d) => somarDias(hoje, d), ts = (d, h = "10:00") => somarDias(hoje, d) + "T" + h + ":00Z";
  const C2 = "exemplo-0002", C3 = "exemplo-0003";
  const base = t.clientes[0];
  Object.assign(base, { contrato_inicio: ag(-70), contrato_fim: ag(295), aniversario: ag(9), nicho: "Alimentação para quem trabalha fora", publico: "Mulheres de 28 a 45 anos que trabalham fora",
    cadencia: "5 posts por semana, segunda a sexta", cta: "Comenta LANCHE", escopo: Object.assign({}, base.escopo, { posts_mes: 20, rodadas_ajuste: 2, prazo_aprovacao_dias: 2 }) });
  t.clientes.push(Object.assign({}, JSON.parse(JSON.stringify(base)), { id: C2, slug: "cliente-exemplo-2", nome: "Studio Exemplo", instagram: "@studio_exemplo", plano: "Plano B", valor_mensal: 2500,
    contrato_inicio: ag(-30), contrato_fim: ag(40), aniversario: null, escopo: { posts_mes: 12, rodadas_ajuste: 2, prazo_aprovacao_dias: 3 } }));
  t.clientes.push(Object.assign({}, JSON.parse(JSON.stringify(base)), { id: C3, slug: "cliente-exemplo-3", nome: "Ateliê Exemplo", instagram: "@atelie_exemplo", plano: "Plano A", valor_mensal: 2000,
    status: "onboarding", contrato_inicio: ag(-3), contrato_fim: ag(362), aniversario: null, escopo: { posts_mes: 12, rodadas_ajuste: 2, prazo_aprovacao_dias: 2 } }));
  // posts: o que o cliente vê e o que é interno
  t.posts.forEach((p) => {
    p.visivel_cliente = !INTERNOS.includes(p.status);
    p.link_drive = p.visivel_cliente ? "https://drive.google.com/drive/folders/EXEMPLO-" + p.id : null;
    p.objetivo = p.objetivo || ["Alcance", "Conexão", "Autoridade", "Venda"][p.id.length % 4];
    p.nivel_consciencia = ["Inconsciente", "Consciente do problema", "Consciente da solução"][Number(p.id.slice(-1)) % 3];
    p.status_conteudo = p.visivel_cliente ? "finalizado" : "em_criacao";
  });
  const p3 = t.posts.find((p) => p.id === "post-3");
  t.posts.push(
    Object.assign({}, JSON.parse(JSON.stringify(p3)), { id: "post-9", data: ag(12), tema: "Nossa rotina de domingo (planejado)", status: "planejado", versao: 1, mudancas: null, prazo_aprovacao: null, midias: [], link_drive: null }),
    Object.assign({}, JSON.parse(JSON.stringify(p3)), { id: "post-10", data: ag(4), tema: "Marmitas da semana em 20 minutos", status: "ajuste", versao: 1, mudancas: null, formato: "reels" }),
    { id: "post-11", cliente_id: C2, data: ag(2), formato: "carrossel", tema: "Mitos sobre alongamento", status: "aprovacao", versao: 1, visivel_cliente: true, legenda: "Alongar antes do treino é obrigatório? Vamos aos fatos.",
      midias: [], link_drive: "https://drive.google.com/drive/folders/EXEMPLO-11", prazo_aprovacao: ag(-1), pilar: "Educação", funil: "topo", nivel_consciencia: "Consciente do problema", status_conteudo: "finalizado" },
    { id: "post-12", cliente_id: C2, data: ag(6), formato: "reels", tema: "Um dia no studio", status: "producao", versao: 1, visivel_cliente: false, legenda: "", midias: [], pilar: "Bastidores", funil: "meio", status_conteudo: "em_criacao" },
    { id: "post-13", cliente_id: C3, data: ag(10), formato: "post", tema: "Apresentação do ateliê", status: "pauta", versao: 1, visivel_cliente: false, legenda: "", midias: [], pilar: "Marca", funil: "topo", status_conteudo: "pauta" },
  );
  t.post_versoes = [
    { id: "pv-1", post_id: "post-3", cliente_id: C, versao: 1, legenda: "Primeira versão", motivo: "ajuste pedido: Ajuste no design (Slide 3): trocar a foto do slide 3 pela da marmita", created_at: ts(-3) },
    { id: "pv-2", post_id: "post-10", cliente_id: C, versao: 1, motivo: "ajuste pedido: Ajuste na legenda: tirar o preço da legenda, ele mudou", created_at: ts(-1) },
  ];
  t.aprovacoes.push({ id: "ap-1", post_id: "post-10", cliente_id: C, decisao: "ajuste", comentario: "Ajuste na legenda: tirar o preço da legenda, ele mudou", trecho: "Legenda", autor_id: "local-cliente", created_at: ts(-1) });
  t.chamados = [
    { id: "ch-1", cliente_id: C, origem: "aprovacao", categoria: "Revisão de conteúdo", descricao: "Marmitas da semana em 20 minutos (Legenda): tirar o preço da legenda, ele mudou", prioridade: "alta", prazo: ag(1),
      status: "em_execucao", ref_tipo: "post", ref_id: "post-10", visivel_cliente: true, created_at: ts(-1), historico: [{ em: ts(-1), o: "Aberto automaticamente pelo pedido de ajuste do cliente" }, { em: ts(0, "09:00"), o: "Status: Em execução" }] },
    { id: "ch-2", cliente_id: C2, origem: "sistema", categoria: "Pendência de aprovação", descricao: "Carrossel \"Mitos sobre alongamento\" aguardando aprovação além do prazo", prioridade: "media", prazo: ag(1),
      status: "novo", ref_tipo: "post", ref_id: "post-11", visivel_cliente: false, created_at: ts(0, "08:00"), historico: [{ em: ts(0, "08:00"), o: "Alerta automático de prazo vencido" }] },
    { id: "ch-3", cliente_id: C, origem: "ideia", categoria: "Nova ideia enviada", descricao: "Lancheira da volta às aulas", prioridade: "baixa", prazo: ag(6), status: "novo", ref_tipo: "ideia", ref_id: "id-1", visivel_cliente: true, created_at: ts(-1), historico: [] },
    { id: "ch-4", cliente_id: C, origem: "solicitacao", categoria: "Solicitação de informação", descricao: "Quando sai o relatório do mês?", prioridade: "media", prazo: ag(2), status: "concluido", visivel_cliente: true, created_at: ts(-6),
      historico: [{ em: ts(-6), o: "Aberta pelo cliente" }, { em: ts(-5), o: "Status: Concluído" }] },
  ];
  t.tarefas = [
    { id: "t-1", cliente_id: C, post_id: "post-10", titulo: "Ajuste: Marmitas da semana em 20 minutos", tipo: "Revisar materiais", responsavel: "Social media", prioridade: "alta", prazo: ag(1), status: "em_execucao", created_at: ts(-1) },
    { id: "t-2", cliente_id: C, titulo: "Roteiro: Como funciona o acompanhamento", tipo: "Escrever roteiros", responsavel: "Social media", prioridade: "baixa", prazo: hoje, status: "a_fazer", created_at: ts(-2) },
    { id: "t-3", cliente_id: C2, titulo: "Editar vídeo: Um dia no studio", tipo: "Editar vídeos", responsavel: "Editora", prioridade: "alta", prazo: ag(-1), status: "a_fazer", created_at: ts(-4) },
    { id: "t-4", cliente_id: C3, titulo: "Analisar briefing do Ateliê", tipo: "Analisar briefing", responsavel: "Social media", prioridade: "alta", prazo: ag(2), status: "a_fazer", created_at: ts(-1) },
    { id: "t-5", cliente_id: C2, titulo: "Criar artes: carrossel mitos", tipo: "Criar artes", responsavel: "Designer", prioridade: "media", prazo: ag(-5), status: "concluido", created_at: ts(-8) },
    { id: "t-6", cliente_id: null, lead_id: "lead-1", titulo: "Follow-up: Doceria Exemplo (WhatsApp)", tipo: "Follow-up comercial", responsavel: "Social media", prioridade: "media", prazo: hoje, hora: "16:00", nota: "Perguntar se viu a proposta", status: "a_fazer", created_at: ts(-2) },
  ];
  t.notificacoes = [
    { id: "n-1", para: "cliente", cliente_id: C, texto: "3 conteúdos aguardando sua aprovação", link: "#/aprovacoes", lida: false, created_at: ts(0, "08:00") },
    { id: "n-2", para: "cliente", cliente_id: C, texto: "Seu relatório do mês está disponível", link: "#/relatorios", lida: true, created_at: ts(-10) },
    { id: "n-3", para: "cliente", cliente_id: C, texto: "Nova resposta na ideia \"Lancheira da volta às aulas\"", link: "#/ideias", lida: false, created_at: ts(-1) },
    { id: "n-4", para: "admin", cliente_id: C2, texto: "Studio Exemplo: aprovação atrasada", lida: false, created_at: ts(0, "08:00") },
    { id: "n-5", para: "admin", cliente_id: C, texto: "Cliente Exemplo pediu ajuste em \"Marmitas da semana em 20 minutos\"", lida: false, created_at: ts(-1) },
    { id: "n-6", para: "admin", cliente_id: C, texto: "Cliente Exemplo enviou uma nova ideia", lida: false, created_at: ts(-1) },
  ];
  t.agenda = [
    { id: "g-1", cliente_id: C, data: ag(4), hora: "10:00", titulo: "Reunião de alinhamento do próximo mês", tipo: "Reunião", compartilhado: true },
    { id: "g-2", cliente_id: C3, data: ag(2), hora: "14:00", titulo: "Onboarding: apresentação do portal", tipo: "Onboarding", compartilhado: true },
    { id: "g-3", cliente_id: C2, data: ag(1), hora: "09:00", titulo: "Prazo interno: ajustes do reels", tipo: "Prazo interno", compartilhado: false },
  ];
  t.arquivos = [
    { id: "ar-1", cliente_id: C, categoria: "Identidade visual", nome: "Manual da marca (exemplo)", link: "https://drive.google.com/drive/folders/EXEMPLO-manual", enviado_pelo_cliente: false, created_at: ts(-40) },
    { id: "ar-2", cliente_id: C, categoria: "Planejamentos", nome: "Planejamento do trimestre (exemplo)", link: "https://drive.google.com/drive/folders/EXEMPLO-plan", enviado_pelo_cliente: false, created_at: ts(-20) },
  ];
  t.briefing_alteracoes = [
    { id: "ba-1", cliente_id: C, campos: { q3: { antes: (t.onboarding[0].respostas || {}).q3 || "", depois: "Vendo o acompanhamento mensal por R$ 390. As pessoas chamam no direct e eu mando o link de pagamento." } },
      motivo: "Reajuste de preço", status: "pendente", criado_por: "local-cliente", created_at: ts(-1) },
  ];
  t.ideias.forEach((i) => Object.assign(i, { autor: "cliente", titulo: "Lancheira da volta às aulas", categoria: "Ideia de conteúdo", link: null }));
  t.ideias.push({ id: "id-2", cliente_id: C, tipo: "texto", autor: "social_media", titulo: "Série \"Lanche sem frescura\"", categoria: "Ideia estratégica",
    conteudo: "Quadro semanal desmontando mitos de lanche saudável. Pode virar linha editorial fixa.", status: "em_analise", created_at: ts(-4) });
  t.ideia_comentarios = [
    { id: "ic-1", ideia_id: "id-2", cliente_id: C, autor_papel: "social_media", texto: "O que você acha de gravar você mesma explicando?", created_at: ts(-4) },
    { id: "ic-2", ideia_id: "id-1", cliente_id: C, autor_papel: "social_media", texto: "Amei! Vou colocar no planejamento do mês que vem.", created_at: ts(-1) },
  ];
  t.estrategias_mes = [{ id: "em-1", cliente_id: C, mes: somarDias(hoje.slice(0, 8) + "15", 30).slice(0, 7), link_apresentacao: "https://docs.google.com/presentation/d/EXEMPLO",
    resumo: "Entendimento, estratégia, calendário e próximos passos do próximo mês.", status: "enviada", enviada_em: ts(-1) }];
  const marcadas = (n, quando) => Object.fromEntries(ETAPAS_ONB.slice(0, n).map((_, i) => ["onb" + (i + 1), quando]));
  t.operacao = [{ id: "onb-c1", cliente_id: C, mes: "onboarding", etapa: "briefing", feita: true, feita_em: ts(-60), checklist: marcadas(8, ts(-60)) },
    { id: "onb-c3", cliente_id: C3, mes: "onboarding", etapa: "briefing", feita: false, feita_em: null, checklist: marcadas(5, ts(-2)) }];
  t.onboarding.push({ cliente_id: C2, respostas: { q1: "Studio Exemplo (fictício)" }, progresso: 100, status: "revisado", pendencias: [] },
    { cliente_id: C3, respostas: { q1: "Ateliê Exemplo (fictício)" }, progresso: 40, status: "rascunho", pendencias: [] });
  t.ig_automations.forEach((a) => { a.cliente_id = a.cliente_id || C; });
};

// ----------------------------------------------------------------- exporta
P.R = { D, STATUS, INTERNOS, CH_STATUS, CH_SIMPLES, CH_ABERTOS, PRIO, PRIO_COR, TAREFA_ST, IDEIA_ST, FORMATOS, ICO_FORMATO, ETAPAS_ONB, CATS_ARQ, LINK_DRIVE,
  tag, tagS, nomeFormato, nomeCliente, prazoDias, rodadas, usadasRodadas, agoraISO, comHistorico, fmtDiaLongo, linkSeguro, corDe, gradiente, primeiroNome,
  capaUrl, gradeMes, navMes, caixaCopiar, ligarCopiar, notificar, barraCliente, atualizarContadores, emBreve, TELAS_CLIENTE, TELAS_ADMIN, rotear, fmtDataCurta, mesAtual,
  entrarVerComo, sairVerComo, datasEspeciais, datasDoMes, TIPO_DATA, registros, salvarRegistro, etapasOnb, materiaisPlan };
})();

// =============================================================================
// operacao.js: Operação do Mês e Planejamento Estratégico (reforma, fase 2).
// As etapas vêm de operacao_modelo, os prompts de prompts_modelo e o progresso
// de cada cliente fica em operacao (mes = 'config' para a configuração, 'AAAA-MM'
// para o ciclo do mês, 'planejamento' para os materiais). Nenhum texto de prompt,
// script ou curso fica no código: as telas leem do banco.
// =============================================================================
(function () {
"use strict";
const P = window.__portal;
const R = P.R;
const { S, GANCHO, $, $$, esc, hojeISO, mesAtual, somarDias, fmtData, nomeMes, avisar, erroAmigavel, abrirModal, fecharModal, clienteAtual, normalizar, slugify } = P;
const { D, INTERNOS, LINK_DRIVE, tag, nomeFormato, prazoDias, agoraISO, linkSeguro, caixaCopiar, ligarCopiar, notificar, navMes, TELAS_ADMIN, rotear } = R;

// ----------------------------------------------------------------- ajudantes
const norm = (t) => normalizar(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const temPalavra = (t, ...ps) => { const n = norm(t); return ps.some((p) => n.includes(p)); };

/** Coluna de status de produção ligada a uma etapa (aceita vários jeitos de escrever). */
function colunaDe(e) {
  const c = norm(e.coluna_status || "");
  if (!c) return null;
  if (c.includes("cont") || c === "sc") return "status_conteudo";
  if (c.includes("design") || c === "sd") return "status_design";
  if (c.includes("video") || c === "sv") return "status_video";
  return null;
}
const ehApresentacao = (e) => temPalavra(e.chave + " " + e.titulo, "apresent");
const ehAprovacaoMes = (e) => e.grupo !== "config" && !ehApresentacao(e) && temPalavra(e.chave + " " + e.titulo, "aprova");
const geraFicha = (e) => e.grupo === "config" && temPalavra(e.chave + " " + e.titulo, "skill", "ficha");

/** Seção do Cérebro (markdown) cujo título tem alguma das palavras. Devolve só o corpo. */
function secaoCerebro(mdTexto, palavras) {
  const linhas = String(mdTexto || "").replace(/\r/g, "").split("\n");
  const i = linhas.findIndex((l) => /^#{1,4}\s/.test(l) && palavras.some((p) => norm(l).includes(p)));
  if (i < 0) return "";
  const nivel = linhas[i].match(/^#+/)[0].length;
  const fim = linhas.findIndex((l, k) => k > i && /^#{1,4}\s/.test(l) && l.match(/^#+/)[0].length <= nivel);
  return linhas.slice(i + 1, fim < 0 ? undefined : fim).join("\n").trim();
}
function pilaresDe(mdTexto) {
  const s = secaoCerebro(mdTexto, ["pilares"]);
  const itens = s.split("\n").map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").replace(/\*\*/g, "").trim()).filter((l) => l && !/^#/.test(l));
  return itens.slice(0, 8);
}
const resumo = (t, n = 400) => {
  const s = String(t || "").replace(/\*\*/g, "").split("\n").map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").replace(/^#+\s*/, "").trim()).filter(Boolean).join("; ");
  return s.length > n ? s.slice(0, n) + "..." : s;
};

/** Troca {cliente} {ig} {nicho} {publico} {pilares} {cadencia} {cta} {mes} pelos dados do cliente. */
function preencher(texto, c, ctx) {
  const vals = {
    cliente: c.nome || "", ig: c.instagram || "", nicho: c.nicho || "[nicho]", publico: c.publico || "[público]",
    pilares: (ctx.pilares || []).join(", ") || "[pilares]", cadencia: c.cadencia || "[cadência]", cta: c.cta || "[CTA]",
    mes: ctx.mes ? nomeMes(ctx.mes) : "[mês]", idioma: c.idioma || "[idioma]", rotacao: c.rotacao || "[rotação]", pontuais: c.formatos_pontuais || "[formatos pontuais]",
    prazo: ctx.prazo ? fmtData(ctx.prazo) : "[prazo]",
  };
  return String(texto || "").replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}

/** Prompt de prompts_modelo pela chave da etapa (aceita "linhas" e "op_linhas"). */
const acharPrompt = (prompts, k) => prompts.find((p) => p.tarefa === k) || prompts.find((p) => p.tarefa === "op_" + k) || null;
function verPrompt(p, c, ctx) {
  const m = abrirModal(p.titulo || p.tarefa, `<div class="linha" style="margin-bottom:8px">${p.onde ? tag("Onde: " + p.onde, "t-azul") : ""}${p.skill && p.skill !== "-" ? tag("Skill: " + p.skill, "t-terra") : ""}${p.origem ? tag(p.origem) : ""}</div>
    ${caixaCopiar("pr-texto", preencher(p.texto, c, ctx), 260)}<div class="modal-rodape"><button class="btn" data-fechar>Fechar</button></div>`, { largo: true });
  ligarCopiar(m);
}

/** Arquivo do cliente para plugar na skill de conteúdo (markdown). */
function fichaMd(c, cer, ctx) {
  const md = (cer || {}).conteudo_md || "";
  const voz = resumo(secaoCerebro(md, ["voz"]), 300), regras = resumo(secaoCerebro(md, ["tabus", "regras"]), 300);
  const nd = "não definido";
  return `# ${c.nome}
- Nome: ${c.nome}
- @: ${c.instagram || nd}
- Idioma e variante: ${c.idioma || nd}
- Nicho: ${c.nicho || nd}
- Público: ${c.publico || resumo(secaoCerebro(md, ["publico"]), 200) || nd}
- Voz e tom: ${voz || nd}
- Pilares de conteúdo: ${(ctx.pilares || []).join("; ") || nd}
- CTA: ${c.cta || nd}
- Regras e tabus: ${regras || nd}
- Cadência: ${c.cadencia || nd}
- Rotação de formatos: ${c.rotacao || nd}
- Formatos pontuais: ${c.formatos_pontuais || nd}

## Fonte da verdade
O Cérebro da Marca deste cliente no Portal Social Media (tabela cerebro). Em caso de dúvida, leia o Cérebro.`;
}
function abrirFicha(c, cer, ctx, prompts) {
  const txt = fichaMd(c, cer, ctx), falta = (txt.match(/não definido/g) || []).length;
  const plugar = prompts.find((p) => temPalavra(p.tarefa + " " + (p.titulo || ""), "ficha", "plugar"));
  const m = abrirModal("Arquivo do cliente para a skill", `<p class="muted">Gerado a partir do Cérebro e da ficha do cliente. Cole no Claude junto com o prompt de plugar o cliente na skill de conteúdo.</p>
    ${falta ? `<div class="faixa alerta">${falta} campo(s) não definido(s). A skill vai parar e pedir: complete em Planejamento, na Ficha da skill.</div>` : ""}
    ${caixaCopiar("ficha-md", txt, 280)}
    <div class="modal-rodape"><button class="btn" id="fi-baixar">Baixar .md</button>${plugar ? `<button class="btn" id="fi-prompt">Ver o prompt de plugar</button>` : ""}<button class="btn" data-fechar>Fechar</button></div>`, { largo: true });
  ligarCopiar(m);
  $("#fi-baixar", m).onclick = () => P.baixarArquivo(`${slugify(c.slug || c.nome)}.md`, txt, "text/markdown;charset=utf-8");
  if (plugar) $("#fi-prompt", m).onclick = () => verPrompt(plugar, c, ctx);
}

// ----------------------------------------------------------------- Operação do Mês
const SC = { pauta: "Pauta", em_criacao: "Em criação", finalizado: "Conteúdo finalizado" };
const SD = { nao_se_aplica: "Não se aplica", nao_iniciado: "Não iniciado", em_andamento: "Em andamento", finalizado: "Finalizado" };
const SV = { nao_se_aplica: "Não se aplica", nao_iniciado: "Não iniciado", em_edicao: "Em edição", finalizado: "Finalizado" };
const MAPA_COL = { status_conteudo: SC, status_design: SD, status_video: SV };
const corSt = (v) => (v === "finalizado" ? "t-verde" : ["em_andamento", "em_edicao", "em_criacao"].includes(v) ? "t-ambar" : v === "nao_se_aplica" ? "t-cinza" : "t-verm");
const prontoPost = (p) => p.status_conteudo === "finalizado" && ["nao_se_aplica", "finalizado"].includes(p.status_design || "nao_se_aplica") && ["nao_se_aplica", "finalizado"].includes(p.status_video || "nao_se_aplica");
const mesPadrao = () => navMes(mesAtual()).prox;   // planeja sempre o mês seguinte

TELAS_ADMIN.operacao = async (el, args) => {
  const c = clienteAtual();
  if (!c) { el.innerHTML = P.vazio("Cadastre um cliente para começar."); return; }
  const mes = /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : (S.mesOperacao || mesPadrao());
  S.mesOperacao = mes;
  const nv = navMes(mes);
  const [modelo, prompts, ops, posts, cer, estr] = await Promise.all([
    D.lista("operacao_modelo", { ordem: "ordem" }),
    D.lista("prompts_modelo", { ordem: "ordem" }),
    D.lista("operacao", { eq: { cliente_id: c.id } }),
    D.lista("posts", { eq: { cliente_id: c.id }, gte: { data: nv.ini }, lte: { data: nv.fim }, ordem: "data" }),
    D.um("cerebro", { eq: { cliente_id: c.id } }),
    D.um("estrategias_mes", { eq: { cliente_id: c.id, mes } }),
  ]);
  const ctx = { mes, pilares: pilaresDe((cer || {}).conteudo_md) };
  const cfg = modelo.filter((e) => e.grupo === "config"), ciclo = modelo.filter((e) => e.grupo !== "config");
  const reg = (grupo, k) => ops.find((o) => o.mes === (grupo === "config" ? "config" : mes) && o.etapa === k) || null;
  const feita = (e) => !!(reg(e.grupo, e.chave) || {}).feita;
  const cfgOk = cfg.length > 0 && cfg.every(feita);
  const etConteudo = ciclo.find((e) => colunaDe(e) === "status_conteudo");
  // Libera em ordem; design, vídeo e gravação liberam junto, assim que o conteúdo do mês estiver feito
  const liberada = (lista, i) => {
    const e = lista[i];
    if (i === 0 || feita(lista[i - 1])) return true;
    const col = colunaDe(e);
    if (etConteudo && feita(etConteudo) && (col === "status_design" || col === "status_video" || temPalavra(e.chave + " " + e.titulo, "grav"))) return true;
    return false;
  };
  if (estr && estr.status === "aprovada") {   // cliente aprovou a estratégia: a etapa de apresentação fica feita
    const ap = ciclo.find(ehApresentacao);
    if (ap && !feita(ap)) { try { await D.upsert("operacao", { cliente_id: c.id, mes, etapa: ap.chave, feita: true, feita_em: agoraISO() }, "cliente_id,mes,etapa"); ops.push({ cliente_id: c.id, mes, etapa: ap.chave, feita: true }); } catch (_) { /* tenta depois */ } }
  }
  if (!modelo.length) {
    el.innerHTML = `<h1>Operação do mês</h1><div class="faixa alerta">A tabela operacao_modelo está vazia. Cadastre as etapas no banco para esta tela funcionar.</div>`;
    return;
  }
  const aberta = S.etapaAberta || null;
  const etapaHtml = (e, lista, i) => {
    const r = reg(e.grupo, e.chave), ok = !!(r || {}).feita, lib = liberada(lista, i), col = colunaDe(e), abre = aberta === e.grupo + ":" + e.chave;
    const marcados = Array.isArray((r || {}).checklist) ? r.checklist : [];
    let extra = "";
    if (col && e.grupo !== "config") { const alvo = posts.filter((p) => (p[col] || "nao_se_aplica") !== "nao_se_aplica"); extra = ` <span class="muted">· ${alvo.filter((p) => p[col] === "finalizado").length}/${alvo.length} finalizados</span>`; }
    if (ehApresentacao(e) && estr) extra = " " + tag({ rascunho: "rascunho", enviada: "aguardando o cliente", aprovada: "cliente aprovou", ajuste: "cliente pediu ajuste" }[estr.status] || estr.status, { enviada: "t-ambar", aprovada: "t-verde", ajuste: "t-verm" }[estr.status] || "");
    const st = ok ? tag("feita", "t-verde") : lib ? tag("a fazer", "t-ambar") : tag("bloqueada", "t-cinza");
    const ps = (e.prompts || []).map((k) => ({ k, p: acharPrompt(prompts, k) }));
    return `<div class="etapa"><div class="entre etapa-cab" data-abrir="${esc(e.grupo + ":" + e.chave)}"><span><b>${ok ? "✓ " : ""}${esc(e.titulo)}</b>${extra}</span><span class="linha">${st}<span class="muted">${abre ? "▲" : "▼"}</span></span></div>
      ${abre ? `<div class="etapa-corpo">${e.descricao ? `<div class="muted">${esc(e.descricao)}</div>` : ""}${e.onde ? `<div style="margin-top:4px"><b>Onde:</b> ${esc(e.onde)}</div>` : ""}
        ${ps.length ? `<div class="lista" style="margin-top:6px">${ps.map(({ k, p }) => p ? `<div class="entre"><span><b>${esc(p.titulo || p.tarefa)}</b><br><span class="muted">${esc([p.onde, p.skill && p.skill !== "-" ? "skill: " + p.skill : "", p.origem].filter(Boolean).join(" · "))}</span></span><button class="btn pequeno" data-prompt="${esc(p.tarefa)}">Ver prompt</button></div>`
          : `<div class="muted">Prompt "${esc(k)}" não encontrado em prompts_modelo.</div>`).join("")}</div>` : ""}
        ${geraFicha(e) ? `<button class="btn primario pequeno" style="margin-top:8px" data-ficha>Gerar arquivo do cliente para a skill</button>` : ""}
        ${ehApresentacao(e) ? blocoEstrategia(estr) : ""}
        ${ehAprovacaoMes(e) ? blocoAprovacaoMes(posts, ok) : ""}
        ${(e.checklist || []).length ? `<div style="margin-top:8px"><b>Checklist</b>${e.checklist.map((x, n) => `<label class="check"><input type="checkbox" data-check="${esc(e.grupo + ":" + e.chave)}" data-n="${n}" ${marcados.includes(x) ? "checked" : ""}> ${esc(x)}</label>`).join("")}</div>` : ""}
        <div class="linha" style="margin-top:8px">${lib && !ok ? `<button class="btn primario pequeno" data-concluir="${esc(e.grupo + ":" + e.chave)}">Concluir etapa</button>` : ""}${ok ? `<button class="btn pequeno" data-reabrir="${esc(e.grupo + ":" + e.chave)}">Reabrir</button>` : ""}${!lib && !ok ? `<span class="muted">Libera quando a etapa anterior estiver feita.</span>` : ""}</div></div>` : ""}</div>`;
  };
  el.innerHTML = `<div class="entre"><div><h1>Operação do mês</h1><p class="sub">${esc(c.nome)} · o passo a passo completo, na ordem, com o prompt, a skill e a ferramenta de cada etapa.</p></div>
      <div class="linha"><a class="btn pequeno" href="#/operacao/${nv.ant}">‹</a>${tag("Mês: " + nomeMes(mes), "t-terra")}<a class="btn pequeno" href="#/operacao/${nv.prox}">›</a></div></div>
    <div class="cartao"><div class="entre"><h3 style="margin:0">Configuração do cliente (uma vez)</h3>${cfgOk ? tag("completa", "t-verde") : tag(cfg.filter(feita).length + " de " + cfg.length, "t-ambar")}</div>
      ${cfgOk ? `<div class="muted" style="margin-top:6px">Configuração pronta. <a href="#" id="ver-cfg">${S.verCfg ? "Esconder" : "Ver etapas"}</a></div>` : ""}
      ${!cfgOk || S.verCfg ? cfg.map((e, i) => etapaHtml(e, cfg, i)).join("") : ""}</div>
    ${cfgOk ? `<div class="cartao"><h3>Ciclo de ${esc(nomeMes(mes))}</h3>${ciclo.map((e, i) => etapaHtml(e, ciclo, i)).join("")}</div>
      <div class="cartao"><div class="entre"><h3 style="margin:0">Produção dos posts de ${esc(nomeMes(mes))}</h3><span class="muted">Mude o status de cada parte. A aprovação libera quando tudo estiver finalizado.</span></div>${tabelaProducao(posts)}</div>`
      : `<div class="faixa alerta">O ciclo do mês libera quando a configuração do cliente estiver completa.</div>`}`;

  // ---- eventos
  if ($("#ver-cfg")) $("#ver-cfg").onclick = (ev) => { ev.preventDefault(); S.verCfg = !S.verCfg; rotear(); };
  $$("[data-abrir]", el).forEach((d) => d.onclick = () => { S.etapaAberta = S.etapaAberta === d.dataset.abrir ? null : d.dataset.abrir; rotear(); });
  $$("[data-prompt]", el).forEach((b) => b.onclick = () => verPrompt(prompts.find((p) => p.tarefa === b.dataset.prompt), c, ctx));
  $$("[data-ficha]", el).forEach((b) => b.onclick = () => abrirFicha(c, cer, ctx, prompts));
  const etapaPor = (v) => { const [g, k] = v.split(":"); return modelo.find((e) => e.grupo === g && e.chave === k) || modelo.find((e) => e.chave === k); };
  const salvarEtapa = async (e, campos) => {
    const r = reg(e.grupo, e.chave) || {};
    await D.upsert("operacao", Object.assign({ cliente_id: c.id, mes: e.grupo === "config" ? "config" : mes, etapa: e.chave, feita: !!r.feita, checklist: Array.isArray(r.checklist) ? r.checklist : [] }, campos), "cliente_id,mes,etapa");
  };
  $$("[data-check]", el).forEach((b) => b.onchange = async () => {
    const e = etapaPor(b.dataset.check), r = reg(e.grupo, e.chave) || {};
    const lista = new Set(Array.isArray(r.checklist) ? r.checklist : []), item = e.checklist[Number(b.dataset.n)];
    if (b.checked) lista.add(item); else lista.delete(item);
    try { await salvarEtapa(e, { checklist: [...lista] }); if (r.etapa) r.checklist = [...lista]; else ops.push({ cliente_id: c.id, mes: e.grupo === "config" ? "config" : mes, etapa: e.chave, checklist: [...lista] }); }
    catch (er) { b.checked = !b.checked; avisar(erroAmigavel(er), "erro"); }
  });
  $$("[data-concluir]", el).forEach((b) => b.onclick = async () => {
    const e = etapaPor(b.dataset.concluir), lista = e.grupo === "config" ? cfg : ciclo, i = lista.indexOf(e);
    try { await salvarEtapa(e, { feita: true, feita_em: agoraISO() }); const prox = lista[i + 1]; S.etapaAberta = prox ? prox.grupo + ":" + prox.chave : null; avisar("Etapa concluída." + (prox ? " Próxima: " + prox.titulo : ""), "ok"); rotear(); }
    catch (er) { avisar(erroAmigavel(er), "erro"); }
  });
  $$("[data-reabrir]", el).forEach((b) => b.onclick = async () => {
    try { await salvarEtapa(etapaPor(b.dataset.reabrir), { feita: false, feita_em: null }); rotear(); } catch (er) { avisar(erroAmigavel(er), "erro"); }
  });
  ligarEstrategia(el, c, mes, estr);
  ligarProducao(el, c, posts, ciclo, mes, feita);
  ligarAprovacaoMes(el, c, posts, ciclo, mes, prompts, ctx);
};

// ---- estratégia do mês (o cliente aprova no Início dele)
function blocoEstrategia(estr) {
  const st = (estr || {}).status;
  if (st === "aprovada") return `<div class="faixa ok" style="margin-top:8px">O cliente aprovou a estratégia${estr.respondida_em ? " em " + esc(fmtData(estr.respondida_em)) : ""}. A produção pode começar.</div>`;
  return `<div class="cartao" style="margin:8px 0 0;background:var(--creme)">
    ${st === "ajuste" ? `<div class="faixa alerta">O cliente pediu ajuste: ${esc(estr.comentario_cliente || "")}</div>` : ""}
    ${st === "enviada" ? `<div class="faixa info">Enviada em ${esc(fmtData(estr.enviada_em))}. Aguardando o cliente aprovar no Início do portal dele.</div>` : ""}
    <label style="margin-top:0">Link da apresentação (Google Slides, Canva, PDF no Drive)</label><input type="url" id="es-link" placeholder="https://..." value="${esc((estr || {}).link_apresentacao || "")}">
    <label>Resumo para o cliente</label><textarea id="es-resumo" placeholder="Entendimento, estratégia, calendário e próximos passos.">${esc((estr || {}).resumo || "")}</textarea>
    <div class="linha" style="margin-top:8px"><button class="btn primario pequeno" id="es-enviar">${st === "enviada" || st === "ajuste" ? "Reenviar" : "Enviar"} estratégia para o cliente aprovar</button><button class="btn pequeno" id="es-salvar">Salvar rascunho</button></div></div>`;
}
function ligarEstrategia(el, c, mes, estr) {
  const salvar = async (status) => {
    const link = $("#es-link", el).value.trim();
    if (link && !linkSeguro(link)) { avisar("O link precisa começar com https://", "erro"); return; }
    if (status === "enviada" && !link) { avisar("Cole o link da apresentação antes de enviar.", "erro"); return; }
    const dados = { cliente_id: c.id, mes, link_apresentacao: link || null, resumo: $("#es-resumo", el).value.trim() || null, status };
    if (status === "enviada") Object.assign(dados, { enviada_em: agoraISO(), respondida_em: null, comentario_cliente: null });
    try {
      // reenvio depois de "ajuste": volta para rascunho antes, para o banco avisar o cliente de novo
      if (status === "enviada" && estr && estr.status === "enviada") await D.atualizar("estrategias_mes", { id: estr.id }, { status: "rascunho" });
      if (estr) await D.atualizar("estrategias_mes", { id: estr.id }, dados); else await D.inserir("estrategias_mes", dados);
      avisar(status === "enviada" ? "Estratégia enviada. O cliente aprova no Início do portal dele." : "Rascunho salvo.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if ($("#es-enviar", el)) $("#es-enviar", el).onclick = () => salvar("enviada");
  if ($("#es-salvar", el)) $("#es-salvar", el).onclick = () => salvar(estr && estr.status !== "rascunho" ? estr.status : "rascunho");
}

// ---- tabela de produção (status_conteudo, status_design, status_video, Drive e capa)
function tabelaProducao(posts) {
  if (!posts.length) return `<div class="muted" style="margin-top:8px">Nenhum post neste mês ainda. Eles entram quando a skill de conteúdo grava o mês no portal.</div>`;
  let n = 0;
  const sel = (p, col) => { const v = p[col] || (col === "status_conteudo" ? "pauta" : "nao_se_aplica");
    return `<select class="sel-st tag ${corSt(v)}" data-prod="${esc(p.id)}" data-col="${col}">${Object.entries(MAPA_COL[col]).map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("")}</select>`; };
  return `<div class="tabela"><table><tr><th>Post</th><th>Conteúdo</th><th>Design</th><th>Vídeo</th><th>Drive</th><th>Capa</th></tr>${posts.map((p) => {
    const num = p.formato === "stories" ? "STORIES" : "POST " + String(++n).padStart(2, "0");
    return `<tr><td><b>${num}</b> · ${esc(R.fmtDataCurta(p.data))}<br><span class="muted">${esc(nomeFormato(p.formato))}: ${esc(p.tema || "")}</span>${INTERNOS.includes(p.status) || p.status === "planejado" ? "" : "<br>" + R.tagS(p.status)}</td>
      <td>${sel(p, "status_conteudo")}</td><td>${sel(p, "status_design")}</td><td>${sel(p, "status_video")}</td>
      <td>${linkSeguro(p.link_drive) ? `<a class="tag t-verde" href="${esc(p.link_drive)}" target="_blank" rel="noopener">link ok</a> <a href="#" data-drive="${esc(p.id)}" class="muted">trocar</a>` : `<button class="btn pequeno" data-drive="${esc(p.id)}">Colar link</button>`}</td>
      <td>${p.capa ? tag("capa ok", "t-verde") : ""}<label class="btn pequeno arquivo">${p.capa ? "Trocar" : "Enviar capa"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-capa="${esc(p.id)}"></label></td></tr>`; }).join("")}</table></div>`;
}
function ligarProducao(el, c, posts, ciclo, mes, feita) {
  const marcarEtapa = async (col) => {
    const e = ciclo.find((x) => colunaDe(x) === col);
    if (e && !feita(e)) await D.upsert("operacao", { cliente_id: c.id, mes, etapa: e.chave, feita: true, feita_em: agoraISO() }, "cliente_id,mes,etapa");
  };
  $$("[data-prod]", el).forEach((s) => s.onchange = async () => {
    const p = posts.find((x) => x.id === s.dataset.prod), col = s.dataset.col, v = s.value, mud = { [col]: v };
    // conteúdo finalizado puxa a próxima parte: reels vai para vídeo, os outros formatos vão para design
    if (col === "status_conteudo" && v === "finalizado") {
      if (p.formato === "reels" && (p.status_video || "nao_se_aplica") === "nao_se_aplica") mud.status_video = "nao_iniciado";
      if (p.formato !== "reels" && (p.status_design || "nao_se_aplica") === "nao_se_aplica") mud.status_design = "nao_iniciado";
    }
    try {
      await D.atualizar("posts", { id: p.id }, mud); Object.assign(p, mud);
      if (posts.every((x) => x.status_conteudo === "finalizado")) { await marcarEtapa("status_conteudo"); avisar("Conteúdo do mês finalizado. Próximo passo: designs e edição dos vídeos.", "ok"); }
      if (posts.every(prontoPost)) { await marcarEtapa("status_design"); await marcarEtapa("status_video"); avisar("Tudo finalizado. A página de aprovação do mês está pronta para enviar.", "ok"); S.etapaAberta = (ciclo.find(ehAprovacaoMes) || {}).chave ? "mes:" + ciclo.find(ehAprovacaoMes).chave : S.etapaAberta; }
      rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); rotear(); }
  });
  $$("[data-drive]", el).forEach((b) => b.onclick = (ev) => {
    ev.preventDefault();
    const p = posts.find((x) => x.id === b.dataset.drive);
    const m = abrirModal("Link do Drive", `<label>Pasta deste post</label><input type="url" id="ld" placeholder="https://drive.google.com/drive/folders/..." value="${esc(p.link_drive || "")}">
      <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="ld-ok">Salvar</button></div>`);
    $("#ld-ok", m).onclick = async () => {
      const v = $("#ld", m).value.trim();
      if (!LINK_DRIVE.test(v)) { avisar("Cole um link do Google Drive.", "erro"); return; }
      try { await D.atualizar("posts", { id: p.id }, { link_drive: v }); fecharModal(); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  });
  $$("[data-capa]", el).forEach((inp) => inp.onchange = async () => {
    const p = posts.find((x) => x.id === inp.dataset.capa), arq = inp.files[0];
    if (!arq) return;
    try {
      const ext = (arq.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const caminho = await D.enviarArquivo("midias", `${p.cliente_id}/posts/${p.id}/capa-${Date.now()}.${ext}`, arq);
      await D.atualizar("posts", { id: p.id }, { capa: caminho }); avisar("Capa enviada.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
}

// ---- página de aprovação do mês
function blocoAprovacaoMes(posts, feitaEtapa) {
  const pendentes = posts.filter((p) => INTERNOS.includes(p.status) || p.status === "planejado");
  if (feitaEtapa && !pendentes.length) return `<div class="faixa ok" style="margin-top:8px">Página de aprovação enviada. O cliente já vê o mês em Aprovações.</div>`;
  const pronto = posts.length > 0 && posts.every(prontoPost), semLink = posts.filter((p) => !linkSeguro(p.link_drive)).length;
  return `<div style="margin-top:8px">${!posts.length ? `<div class="faixa alerta">Ainda não há posts neste mês.</div>` : pronto ? (semLink ? `<div class="faixa alerta">Faltam ${semLink} link(s) do Drive na tabela de produção.</div>` : "")
    : `<div class="faixa alerta">Ainda há posts sem conteúdo, design ou vídeo finalizado.</div>`}
    <button class="btn primario pequeno" id="env-mes" ${pronto && !semLink ? "" : "disabled"}>Gerar página de aprovação e enviar o mês</button></div>`;
}
function ligarAprovacaoMes(el, c, posts, ciclo, mes, prompts, ctx) {
  const b = $("#env-mes", el);
  if (!b) return;
  b.onclick = async () => {
    b.disabled = true; b.textContent = "Enviando...";
    const prazo = somarDias(hojeISO(), prazoDias(c));
    try {
      for (const p of posts.filter((x) => INTERNOS.includes(x.status) || x.status === "planejado"))
        await D.atualizar("posts", { id: p.id }, { status: "aprovacao", visivel_cliente: true, versao: Math.max(1, Number(p.versao || 1)), prazo_aprovacao: prazo });
      const e = ciclo.find(ehAprovacaoMes);
      if (e) await D.upsert("operacao", { cliente_id: c.id, mes, etapa: e.chave, feita: true, feita_em: agoraISO() }, "cliente_id,mes,etapa");
      await notificar("cliente", c.id, `O conteúdo de ${nomeMes(mes)} está pronto para você aprovar`, `#/aprovacoes/${mes}`);
      const envio = acharPrompt(prompts, "envio");
      const m = abrirModal("Mês enviado para aprovação", `<p class="muted">O feed de ${esc(nomeMes(mes))} já aparece em Aprovações para o cliente${envio ? ". Mande também esta mensagem:" : "."}</p>
        ${envio ? caixaCopiar("msg-envio", preencher(envio.texto, c, Object.assign({}, ctx, { prazo })), 180) : `<div class="faixa info">Cadastre o prompt "op_envio" em prompts_modelo para a mensagem pronta aparecer aqui.</div>`}
        <div class="modal-rodape"><button class="btn primario" data-fechar>Fechar</button></div>`);
      ligarCopiar(m);
      $$("[data-fechar]", m).forEach((x) => x.addEventListener("click", () => rotear()));
    } catch (er) { b.disabled = false; b.textContent = "Gerar página de aprovação e enviar o mês"; avisar(erroAmigavel(er), "erro"); }
  };
}

// ----------------------------------------------------------------- Planejamento estratégico
const CEREBRO_SECOES = [["Identidade", ["identidade", "essencia"]], ["História", ["historia"]], ["Produtos e oferta", ["produto", "oferta"]], ["Público", ["publico"]],
  ["Perguntas frequentes", ["perguntas"]], ["Objeções", ["objec"]], ["Mitos do nicho", ["mitos"]], ["Mercado", ["mercado"]], ["Pilares", ["pilares"]], ["Voz e tom", ["voz"]],
  ["Tabus e regras", ["tabus", "regras"]], ["Vídeo e gravação", ["video", "gravacao"]], ["Objetivos", ["objetivo"]], ["Operação e provas", ["operacao", "provas"]],
  ["Ponto de partida", ["ponto de partida"]], ["CTA", ["cta"]]];
const FICHA_CAMPOS = [["nicho", "Nicho"], ["publico", "Público"], ["idioma", "Idioma e variante"], ["cadencia", "Cadência (quantos posts e em que dias)"],
  ["rotacao", "Rotação de formatos"], ["formatos_pontuais", "Formatos pontuais"], ["cta", "CTA principal"]];
const FICHAS_PROD = [["design", "Projeto de design", ["Referências", "Paleta", "Fontes", "Projeto"]],
  ["motion", "Projeto de motion (2 a 4 por Reels, o primeiro entre 4 e 5 segundos)", ["Cores", "Fontes", "Duração", "Entrada", "Nunca", "Projeto"]],
  ["video", "Ficha de estilo de vídeo (talking head)", ["Legenda", "Destaques", "Zoom", "Filtro", "Duração", "Nunca", "Pasta"]]];
const SUGESTOES_PLANEJAMENTO = ["Diagnóstico da presença digital", "Definição de objetivos", "Estratégia de posicionamento", "Pilares de conteúdo", "Linha editorial",
  "Planejamento de campanhas", "Apresentação da estratégia do mês", "Estratégias de relacionamento e conversão"];

TELAS_ADMIN.planejamento = async (el) => {
  const c = clienteAtual();
  if (!c) { el.innerHTML = P.vazio("Cadastre um cliente para começar."); return; }
  const [regs, cer, ob, prompts] = await Promise.all([
    R.registros("planejamento", c.id),
    D.um("cerebro", { eq: { cliente_id: c.id } }),
    D.um("onboarding", { eq: { cliente_id: c.id } }),
    D.lista("prompts_modelo", { ordem: "ordem" }),
  ]);
  const itens = R.materiaisPlan(regs[0]);
  const mdTexto = (cer || {}).conteudo_md || "";
  const ctx = { pilares: pilaresDe(mdTexto) };
  const preenchida = (pal) => !!secaoCerebro(mdTexto, pal).replace(/\[.*?\]/g, "").trim();
  const nOk = CEREBRO_SECOES.filter(([, pal]) => preenchida(pal)).length;
  const stOb = (ob || {}).status || "rascunho";
  const fluxo = [["rascunho", "Cliente respondendo"], ["enviado", "Respondido"], ["revisado", "Você revisou"], ["cerebro", "Cérebro aprovado"]];
  const idx = cer && cer.versao > 0 && stOb === "revisado" ? 3 : ["rascunho", "enviado", "revisado"].indexOf(stOb);
  const skills = [...new Set(prompts.map((p) => p.skill).filter((s) => s && s !== "-"))];
  const fichas = c.fichas && typeof c.fichas === "object" ? c.fichas : {};
  el.innerHTML = `<h1>Planejamento estratégico</h1><p class="sub">${esc(c.nome)}: feito aqui dentro. Só vai para o cliente quando você clicar em compartilhar.</p>
    <div class="grid g2">
      <div class="cartao"><div class="entre"><h3 style="margin:0">Materiais do planejamento</h3><button class="btn pequeno" id="pl-novo">Adicionar material</button></div>
        <div class="lista" style="margin-top:6px">${itens.map((x) => {
          return `<div class="entre"><span>${linkSeguro(x.link) ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.nome || "Material")}</a>` : esc(x.nome || "Material")}</span>
            <span class="linha">${x.compartilhado ? tag("Compartilhado", "t-verde") : tag("Rascunho interno", "t-cinza")}${x.compartilhado ? "" : `<button class="btn primario pequeno" data-comp="${esc(x.id)}">Compartilhar</button>`}</span></div>`; }).join("")
          || `<div class="muted">Ainda não começou. Comece pelo Cérebro da Marca.</div>`}</div></div>
      <div class="cartao"><div class="entre"><h3 style="margin:0">Cérebro da Marca</h3>${cer ? tag(`versão ${cer.versao || 1}${idx === 3 ? " aprovada" : ""}`, idx === 3 ? "t-verde" : "t-ambar") : tag("em construção", "t-ambar")}</div>
        <p class="muted">Montado a partir do briefing. Toda skill de conteúdo lê este Cérebro antes de criar.</p>
        <div class="linha" style="margin-bottom:8px">${fluxo.map(([, n], i) => tag((i <= idx ? "✓ " : "") + n, i <= idx ? "t-verde" : "t-cinza")).join("")}</div>
        <div class="muted" style="margin-bottom:4px">${nOk} de ${CEREBRO_SECOES.length} seções preenchidas</div>
        <div class="tabela"><table>${CEREBRO_SECOES.map(([n, pal]) => `<tr><td><b>${esc(n)}</b></td><td>${preenchida(pal) ? tag("preenchido", "t-verde") : tag("não definido", "t-cinza")}</td></tr>`).join("")}</table></div>
        ${skills.length ? `<hr><b>Skills que usam o Cérebro</b><div class="linha" style="margin-top:6px">${skills.map((s) => tag(s, "t-terra")).join("")}</div>` : ""}
        <div class="linha" style="margin-top:10px"><a class="btn pequeno" href="#/cerebro">Abrir e editar o Cérebro</a></div></div>
    </div>
    <div class="grid g2 sec">
      <div class="cartao"><div class="entre"><h3 style="margin:0">Ficha da skill</h3><button class="btn primario pequeno" id="fs-gerar">Gerar arquivo do cliente</button></div>
        <p class="muted">Campos que a skill de conteúdo exige além do Cérebro. Sem eles a skill para e pede.</p>
        ${FICHA_CAMPOS.map(([k, n]) => `<label>${esc(n)}</label><input type="text" data-ficha="${k}" value="${esc(c[k] || "")}" placeholder="não definido">`).join("")}
        <div class="linha" style="margin-top:10px"><button class="btn pequeno" id="fs-salvar">Salvar ficha</button></div></div>
      <div class="cartao"><h3 style="margin:0">Fichas de produção</h3><p class="muted">Usadas no Claude Design e nas skills de edição. Gravadas no cadastro do cliente para não se perderem.</p>
        ${FICHAS_PROD.map(([k, t, campos]) => `<details class="ficha-prod" ${Object.keys(fichas[k] || {}).length ? "" : "open"}><summary><b>${esc(t)}</b></summary>
          ${campos.map((cp) => `<label>${esc(cp)}</label><input type="text" data-fp="${k}" data-campo="${esc(cp)}" value="${esc((fichas[k] || {})[cp] || "")}" placeholder="não definido">`).join("")}</details>`).join("")}
        <div class="linha" style="margin-top:10px"><button class="btn pequeno" id="fp-salvar">Salvar fichas de produção</button></div></div>
    </div>
    <div class="faixa ok sec">O passo a passo de produção deste cliente está em <a href="#/operacao">Operação do Mês</a>.</div>`;

  $("#pl-novo").onclick = () => {
    const m = abrirModal("Adicionar material de planejamento", `<form id="f-pl"><label>Nome</label><input type="text" id="pl-nome" list="pl-sug" required>
      <datalist id="pl-sug">${SUGESTOES_PLANEJAMENTO.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <label>Link (Google Drive, Docs, Slides ou Canva)</label><input type="url" id="pl-link" placeholder="https://..." required>
      <div class="muted" style="margin-top:4px">Fica como rascunho interno. O cliente só vê depois que você clicar em Compartilhar.</div>
      <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
    $("#f-pl", m).onsubmit = async (ev) => {
      ev.preventDefault();
      const link = $("#pl-link", m).value.trim();
      if (!linkSeguro(link)) { avisar("O link precisa começar com https://", "erro"); return; }
      try { await R.salvarRegistro(c.id, "planejamento", [...itens, { id: "m" + Date.now(), nome: $("#pl-nome", m).value.trim(), link, compartilhado: false, criado_em: agoraISO() }]); fecharModal(); avisar("Material salvo como rascunho interno.", "ok"); rotear(); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  $$("[data-comp]", el).forEach((b) => b.onclick = async () => {
    const x = itens.find((i) => i.id === b.dataset.comp), d = x;
    try {
      await D.inserir("arquivos", { cliente_id: c.id, categoria: "Planejamentos", nome: d.nome || "Planejamento", link: d.link || null, enviado_pelo_cliente: false });
      await R.salvarRegistro(c.id, "planejamento", itens.map((i) => (i.id === x.id ? Object.assign({}, i, { compartilhado: true, compartilhado_em: agoraISO() }) : i)));
      await notificar("cliente", c.id, `Novo material de planejamento: ${d.nome || "Planejamento"}`, "#/arquivos");
      avisar("Compartilhado. Agora aparece em Arquivos, na pasta Planejamentos do cliente.", "ok"); rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  const lerFicha = () => Object.fromEntries($$("[data-ficha]", el).map((i) => [i.dataset.ficha, i.value.trim() || null]));
  $("#fs-salvar").onclick = async () => {
    try { const f = lerFicha(); await D.atualizar("clientes", { id: c.id }, f); Object.assign(c, f); avisar("Ficha da skill salva.", "ok"); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  $("#fs-gerar").onclick = () => abrirFicha(Object.assign({}, c, lerFicha()), cer, ctx, prompts);
  $("#fp-salvar").onclick = async () => {
    const novo = JSON.parse(JSON.stringify(fichas));
    $$("[data-fp]", el).forEach((i) => { const k = i.dataset.fp; novo[k] = novo[k] || {}; if (i.value.trim()) novo[k][i.dataset.campo] = i.value.trim(); else delete novo[k][i.dataset.campo]; });
    try { await D.atualizar("clientes", { id: c.id }, { fichas: novo }); c.fichas = novo; avisar("Fichas de produção salvas.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// ----------------------------------------------------------------- modo de teste: modelo e prompts fictícios
// Só para o teste local funcionar. No portal real tudo vem das tabelas operacao_modelo e prompts_modelo.
const exemploAnterior = GANCHO.exemplo;
GANCHO.exemplo = (t, C) => {
  if (exemploAnterior) exemploAnterior(t, C);
  const hoje = hojeISO(), prox = navMes(mesAtual()).prox, dia = (d) => `${prox}-${String(d).padStart(2, "0")}`;
  const et = (grupo, ordem, chave, titulo, coluna = null) => ({ chave, grupo, ordem, titulo, descricao: "Descrição de exemplo. No portal real, o texto vem do banco.", onde: "Exemplo",
    prompts: ["exemplo_" + chave], checklist: ["Item de exemplo 1", "Item de exemplo 2"], coluna_status: coluna });
  t.operacao_modelo = [et("config", 1, "briefing", "Briefing respondido"), et("config", 2, "pesquisa", "Pesquisa de público"), et("config", 3, "cerebro", "Cérebro da Marca"),
    et("config", 4, "skill", "Arquivo do cliente para a skill"),
    et("mes", 1, "estrategia", "1. Estratégia do mês"), et("mes", 2, "apresentacao", "2. Apresentação da estratégia ao cliente"), et("mes", 3, "conteudo", "3. Criação do conteúdo", "conteudo"),
    et("mes", 4, "gravacao", "4. Gravações do cliente"), et("mes", 5, "design", "5. Designs", "design"), et("mes", 6, "video", "6. Edição de vídeo", "video"),
    et("mes", 7, "aprovacao", "7. Página de aprovação do mês"), et("mes", 8, "resultados", "8. Resultados")];
  const pr = (tarefa, titulo) => ({ id: tarefa, tarefa, titulo, etapa: "exemplo", onde: "Claude", skill: "skill-de-exemplo", origem: "exemplo", ordem: 0,
    texto: `Prompt de exemplo para ${"{cliente}"} (${"{ig}"}), nicho ${"{nicho}"}, público ${"{publico}"}, pilares ${"{pilares}"}, cadência ${"{cadencia}"}, CTA ${"{cta}"}, mês ${"{mes}"}. O texto real fica na tabela prompts_modelo.` });
  t.prompts_modelo = (t.prompts_modelo || []).concat(t.operacao_modelo.map((e) => pr("exemplo_" + e.chave, "Prompt de exemplo: " + e.titulo.replace(/^\d+\. /, ""))),
    [Object.assign(pr("op_envio", "Mensagem de envio do mês"), { texto: "Mensagem de exemplo: o conteúdo de {mes} de {cliente} está no portal para aprovar até {prazo}." })]);
  t.operacao = (t.operacao || []).concat(["briefing", "pesquisa", "cerebro", "skill"].map((k) => ({ id: "cfg-" + k, cliente_id: C, mes: "config", etapa: k, feita: true, feita_em: hoje + "T10:00:00Z", checklist: [] })),
    [{ id: "mes-1", cliente_id: C, mes: prox, etapa: "estrategia", feita: true, feita_em: hoje + "T10:00:00Z", checklist: [] }],
    [{ id: "plan-c1", cliente_id: C, mes: "planejamento", etapa: "briefing", feita: false, feita_em: hoje + "T09:00:00Z", checklist: [
      { id: "m1", nome: "Pilares de conteúdo (exemplo)", link: "https://docs.google.com/document/d/EXEMPLO", compartilhado: true, compartilhado_em: hoje + "T09:00:00Z" },
      { id: "m2", nome: "Planejamento de campanhas (exemplo)", link: "https://docs.google.com/document/d/EXEMPLO2", compartilhado: false }] }]);
  if (t.cerebro && t.cerebro[0]) t.cerebro[0].conteudo_md += "\n## Pilares\n- Rotina\n- Bastidor\n- Prova\n";
  const fmts = ["carrossel", "reels", "post", "reels", "carrossel", "stories"];
  const sts = [["finalizado", "em_andamento", "nao_se_aplica"], ["finalizado", "nao_se_aplica", "em_edicao"], ["finalizado", "finalizado", "nao_se_aplica"],
    ["finalizado", "nao_se_aplica", "nao_iniciado"], ["em_criacao", "nao_se_aplica", "nao_se_aplica"], ["pauta", "nao_se_aplica", "nao_se_aplica"]];
  fmts.forEach((f, i) => t.posts.push({ id: "prox-" + i, cliente_id: C, data: dia(2 + i * 3), formato: f, tema: "Post de exemplo " + (i + 1) + " do próximo mês", status: "producao", versao: 1,
    visivel_cliente: false, legenda: i < 4 ? "Legenda pronta (exemplo)." : "", midias: [], link_drive: i < 3 ? "https://drive.google.com/drive/folders/EXEMPLO-P" + i : null,
    status_conteudo: sts[i][0], status_design: sts[i][1], status_video: sts[i][2], pilar: ["Rotina", "Bastidor", "Prova"][i % 3] }));
  (t.estrategias_mes || []).forEach((e) => { if (e.cliente_id === C) e.mes = prox; });
};
})();

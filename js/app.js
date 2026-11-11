// =============================================================================
// app.js: portal da social media e dos clientes.
// JavaScript puro, sem build. Dividido em seções:
//   1. Utilidades          5. Visão da social media
//   2. Dados (real/local)  6. Instagram e editor de automação
//   3. Login e sessão      7. Visão do cliente
//   4. Layout e rotas      8. Início
// =============================================================================
(function () {
"use strict";

const CFG = window.PORTAL_CONFIG || {};
const VERSAO_APP = "1.0.0";

// =============================================================================
// 1. UTILIDADES
// =============================================================================
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Escapa texto para colocar dentro de HTML. */
function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function mesAtual() { return new Date().toISOString().slice(0, 7); }
function somarDias(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fmtData(iso) { if (!iso) return ""; const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${a}`; }
function fmtDataCurta(iso) { if (!iso) return ""; const [, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; }
function fmtMoeda(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtNum(v) { return v == null || v === "" ? "sem dado" : Number(v).toLocaleString("pt-BR"); }
function nomeMes(aaaamm) {
  const [a, m] = aaaamm.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "há 2 h", "ontem", "12/11" */
function tempoRelativo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400 && new Date().getDate() === d.getDate()) return `há ${Math.floor(s / 3600)} h`;
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "ontem";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function uid() { return (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(16).slice(2) + Date.now().toString(16)); }
function slugify(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function normalizar(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

/** Aviso rápido no rodapé (toast). */
function avisar(msg, tipo = "") {
  const caixa = $("#avisos");
  const d = document.createElement("div");
  d.className = "aviso " + tipo;
  d.textContent = msg;
  caixa.appendChild(d);
  setTimeout(() => d.remove(), tipo === "erro" ? 6500 : 3800);
}

/** Traduz erros técnicos para português. Nunca mostra erro cru. */
function erroAmigavel(e) {
  const m = String((e && (e.message || e.erro || e.error_description)) || e || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que você recebeu.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com a internet. Confira e tente de novo.";
  if (m.includes("jwt") || m.includes("sessão expirou")) return "Sua sessão expirou. Entre de novo.";
  if (m.includes("row-level security") || m.includes("permission denied")) return "Você não tem permissão para fazer isso.";
  if (m.includes("duplicate key")) return "Isso já existe.";
  if (m.includes("password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (e && e.erro && typeof e.erro === "string") return e.erro;   // mensagens das funções já vêm em português
  if (e && e.message && /[áéíóúãõç]/i.test(e.message)) return e.message;
  return "Algo deu errado. Tente de novo em instantes.";
}

/** Modal genérico. Devolve o elemento para quem chamou preencher eventos. */
function abrirModal(titulo, corpoHtml, opcoes = {}) {
  fecharModal();
  const camada = $("#camada-modal");
  camada.innerHTML = `<div class="modal-fundo"><div class="modal ${opcoes.largo ? "largo" : ""}" role="dialog" aria-modal="true">
    <div class="modal-topo"><h2>${esc(titulo)}</h2><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
    <div class="modal-corpo">${corpoHtml}</div></div></div>`;
  const fundo = $(".modal-fundo", camada);
  fundo.addEventListener("click", (ev) => { if (ev.target === fundo || ev.target.closest("[data-fechar]")) fecharModal(); });
  return $(".modal", camada);
}
function fecharModal() { $("#camada-modal").innerHTML = ""; }

/** Painel lateral (detalhe de lead, de post). */
function abrirPainelLateral(html) {
  fecharModal();
  const camada = $("#camada-modal");
  camada.innerHTML = `<div class="modal-fundo" style="align-items:stretch;justify-content:flex-end;padding:0"><div class="painel-lateral">${html}</div></div>`;
  const fundo = $(".modal-fundo", camada);
  fundo.addEventListener("click", (ev) => { if (ev.target === fundo || ev.target.closest("[data-fechar]")) fecharModal(); });
  return $(".painel-lateral", camada);
}

/** Confirmação com botões (promessa true/false). */
function confirmar(msg, textoSim = "Confirmar", perigo = false) {
  return new Promise((ok) => {
    const m = abrirModal("Confirme", `<p>${esc(msg)}</p><div class="modal-rodape"><button class="btn" data-n>Cancelar</button><button class="btn ${perigo ? "alerta" : "primario"}" data-s>${esc(textoSim)}</button></div>`);
    $("[data-n]", m).onclick = () => { fecharModal(); ok(false); };
    $("[data-s]", m).onclick = () => { fecharModal(); ok(true); };
  });
}

/** Baixa um arquivo gerado no navegador. */
function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** CSV com ponto e vírgula, UTF-8 com BOM (abre certo no Excel). */
function gerarCSV(cabecalhos, linhas) {
  const campo = (v) => { const s = String(v == null ? "" : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + [cabecalhos.map(campo).join(";"), ...linhas.map((l) => l.map(campo).join(";"))].join("\r\n");
}

/** Markdown simples para HTML (títulos, negrito, itálico, listas, tabelas, citações). */
function md(texto) {
  const linhas = String(texto || "").replace(/\r/g, "").split("\n");
  let html = "", lista = null, tabela = null;
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const fechar = () => {
    if (lista) { html += `</${lista}>`; lista = null; }
    if (tabela) { html += "</table>"; tabela = null; }
  };
  for (const l of linhas) {
    if (/^\s*\|/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
      const cols = l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      if (!tabela) { fechar(); tabela = true; html += "<table><tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>"; }
      else html += "<tr>" + cols.map((c) => `<td>${c}</td>`).join("") + "</tr>";
      continue;
    }
    if (tabela) { html += "</table>"; tabela = null; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { fechar(); const n = Math.min(4, m[1].length); html += `<h${n}>${inline(m[2])}</h${n}>`; }
    else if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { if (lista !== "ul") { fechar(); lista = "ul"; html += "<ul>"; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+\.\s+(.*)$/))) { if (lista !== "ol") { fechar(); lista = "ol"; html += "<ol>"; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^>\s?(.*)$/))) { fechar(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
    else if (!l.trim()) { fechar(); }
    else { fechar(); html += `<p>${inline(l)}</p>`; }
  }
  fechar();
  return `<div class="md">${html}</div>`;
}

/** Pega uma seção do markdown pelo começo do título (ex.: "## 3. Voz"). */
function secaoMd(texto, inicioTitulo) {
  const linhas = String(texto || "").split("\n");
  const i = linhas.findIndex((l) => normalizar(l).startsWith(normalizar(inicioTitulo)));
  if (i < 0) return "";
  const nivel = (linhas[i].match(/^#+/) || ["##"])[0].length;
  const fim = linhas.findIndex((l, k) => k > i && /^#+\s/.test(l) && (l.match(/^#+/)[0].length <= nivel));
  return linhas.slice(i, fim < 0 ? undefined : fim).join("\n");
}

/** Imagem SVG de exemplo (modo local), como data URI. */
function svgExemplo(texto, cor = "#4F46E5", proporcao = "4/5") {
  const [w, h] = proporcao === "1/1" ? [400, 400] : proporcao === "9/16" ? [360, 640] : [400, 500];
  const linhas = String(texto).match(/.{1,16}(\s|$)/g) || [texto];
  const ts = linhas.slice(0, 5).map((l, i) => `<text x="32" y="${h / 2 - 40 + i * 34}" font-family="Arial" font-size="28" font-weight="700" fill="#fff">${esc(l.trim())}</text>`).join("");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${cor}"/>${ts}<text x="32" y="${h - 30}" font-family="Arial" font-size="16" fill="#ffffffaa">exemplo</text></svg>`);
}

// =============================================================================
// 2. DADOS: duas implementações com a mesma interface.
//    - DadosReais: Supabase (produção). Paginação de 1000 em 1000.
//    - DadosLocais: memória do navegador, com o Cliente Exemplo (modo de teste local).
//    Interface: lista, um, inserir, atualizar, upsert, apagar, funcao, rpc, enviarArquivo, urlArquivo
//    filtros: { eq: {col: v}, in: {col: [..]}, gte: {}, lte: {}, ordem: "col" | "-col", limite: n, contem: {col: v} }
// =============================================================================
let sb = null;          // cliente do Supabase (modo real)
let D = null;           // camada de dados ativa

const DadosReais = {
  _aplicar(q, f = {}) {
    for (const [k, v] of Object.entries(f.eq || {})) q = q.eq(k, v);
    for (const [k, v] of Object.entries(f.in || {})) q = q.in(k, v);
    for (const [k, v] of Object.entries(f.gte || {})) q = q.gte(k, v);
    for (const [k, v] of Object.entries(f.lte || {})) q = q.lte(k, v);
    for (const [k, v] of Object.entries(f.contem || {})) q = q.contains(k, v);
    if (f.ordem) { const desc = f.ordem.startsWith("-"); q = q.order(f.ordem.replace(/^-/, ""), { ascending: !desc }); }
    return q;
  },
  async lista(tabela, f = {}, colunas = "*") {
    const limite = f.limite || 100000;
    const todas = [];
    for (let inicio = 0; inicio < limite; inicio += 1000) {
      const fim = Math.min(inicio + 999, limite - 1);
      const { data, error } = await this._aplicar(sb.from(tabela).select(colunas), f).range(inicio, fim);
      if (error) throw error;
      todas.push(...data);
      if (data.length < fim - inicio + 1) break;
    }
    return todas;
  },
  async um(tabela, f = {}, colunas = "*") {
    const { data, error } = await this._aplicar(sb.from(tabela).select(colunas), f).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
  async contar(tabela, f = {}) {
    const { count, error } = await this._aplicar(sb.from(tabela).select("*", { count: "exact", head: true }), f);
    if (error) throw error;
    return count || 0;
  },
  async inserir(tabela, linha) {
    const { data, error } = await sb.from(tabela).insert(linha).select();
    if (error) throw error;
    return data && data[0];
  },
  async atualizar(tabela, eq, mudancas) {
    let q = sb.from(tabela).update(mudancas);
    for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
    const { data, error } = await q.select();
    if (error) throw error;
    return data;
  },
  async upsert(tabela, linha, onConflict) {
    const { data, error } = await sb.from(tabela).upsert(linha, { onConflict }).select();
    if (error) throw error;
    return data && data[0];
  },
  async apagar(tabela, eq) {
    let q = sb.from(tabela).delete();
    for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  },
  async funcao(nome, corpo) {
    const { data, error } = await sb.functions.invoke(nome, { body: corpo || {} });
    if (error) {
      // a função devolve { ok:false, erro:"mensagem em português" }
      let msg = null;
      try { const j = await error.context.json(); msg = j && (j.erro || j.message); if (j && j.codigo_suporte) msg += ` Código para suporte: ${j.codigo_suporte}`; } catch (_) { /* sem corpo */ }
      throw { erro: msg || "Não consegui falar com o servidor. Tente de novo." };
    }
    return data;
  },
  async rpc(nome, args) {
    const { data, error } = await sb.rpc(nome, args);
    if (error) throw error;
    return data;
  },
  async enviarArquivo(bucket, caminho, arquivo) {
    const { error } = await sb.storage.from(bucket).upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
    if (error) {
      if (String(error.message).toLowerCase().includes("exceeded")) throw { erro: bucket === "audios" ? "O áudio passa de 10 MB." : "A imagem passa de 5 MB." };
      throw error;
    }
    return caminho;
  },
  _urls: {},
  async urlArquivo(bucket, caminho) {
    const k = bucket + "/" + caminho;
    if (this._urls[k] && this._urls[k].ate > Date.now()) return this._urls[k].url;
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(caminho, 3600);
    if (error) return "";
    this._urls[k] = { url: data.signedUrl, ate: Date.now() + 50 * 60 * 1000 };
    return data.signedUrl;
  },
};

// ---------------------------------------------------------------- modo local
const DadosLocais = {
  t: {},     // tabelas em memória
  _filtrar(linhas, f = {}) {
    let r = linhas.filter((l) =>
      Object.entries(f.eq || {}).every(([k, v]) => l[k] === v) &&
      Object.entries(f.in || {}).every(([k, v]) => v.includes(l[k])) &&
      Object.entries(f.gte || {}).every(([k, v]) => l[k] != null && String(l[k]) >= String(v)) &&
      Object.entries(f.lte || {}).every(([k, v]) => l[k] != null && String(l[k]) <= String(v)) &&
      Object.entries(f.contem || {}).every(([k, v]) => (v || []).every((x) => (l[k] || []).includes(x))));
    if (f.ordem) {
      const desc = f.ordem.startsWith("-"), c = f.ordem.replace(/^-/, "");
      r = [...r].sort((a, b) => (String(a[c] ?? "") > String(b[c] ?? "") ? 1 : -1) * (desc ? -1 : 1));
    }
    return f.limite ? r.slice(0, f.limite) : r;
  },
  _tab(n) { if (n === "ig_leads_resumo") return this._leadsResumo(); return (this.t[n] = this.t[n] || []); },
  _copia(x) { return JSON.parse(JSON.stringify(x)); },
  _leadsResumo() {
    return (this.t.ig_leads || []).map((l) => {
      const env = (this.t.ig_deliveries || []).filter((d) => d.ig_account_id === l.ig_account_id && d.ig_user_id === l.ig_user_id);
      const a = (this.t.ig_automations || []).find((x) => x.id === l.automation_id);
      const ts = env.map((d) => d.ts).sort();
      return { ...l, automacao_nome: a ? a.nome : null, total_envios: env.length,
        primeira_interacao: [l.created_at, ts[0]].filter(Boolean).sort()[0], ultima_interacao: [l.updated_at, ts[ts.length - 1]].filter(Boolean).sort().pop() };
    });
  },
  async lista(t, f) { return this._copia(this._filtrar(this._tab(t), f)); },
  async um(t, f) { return this._copia(this._filtrar(this._tab(t), f)[0] || null); },
  async contar(t, f) { return this._filtrar(this._tab(t), f).length; },
  async inserir(t, linha) {
    const l = { id: uid(), created_at: new Date().toISOString(), ...this._copia(linha) };
    this._tab(t).push(l);
    this._gatilhos(t, l);
    return this._copia(l);
  },
  async atualizar(t, eq, m) {
    const alvo = this._filtrar(this._tab(t), { eq });
    alvo.forEach((l) => { const antes = this._copia(l); Object.assign(l, this._copia(m), { updated_at: new Date().toISOString() }); this._gatilhos(t, l, antes); });
    return this._copia(alvo);
  },
  async upsert(t, linha, onConflict) {
    const chaves = (onConflict || "id").split(",");
    const ex = this._tab(t).find((l) => chaves.every((k) => l[k] === linha[k]));
    if (ex) { Object.assign(ex, this._copia(linha), { updated_at: new Date().toISOString() }); return this._copia(ex); }
    return this.inserir(t, linha);
  },
  async apagar(t, eq) { const fora = new Set(this._filtrar(this._tab(t), { eq })); this.t[t] = this._tab(t).filter((l) => !fora.has(l)); },
  async rpc(nome, args) { if (nome === "espaco_usado") return 1250000; return null; },
  async enviarArquivo(bucket, caminho, arquivo) {
    if (arquivo.size > (bucket === "audios" ? 10 : 5) * 1024 * 1024) throw { erro: bucket === "audios" ? "O áudio passa de 10 MB." : "A imagem passa de 5 MB." };
    this._blobs[caminho] = URL.createObjectURL(arquivo);
    return caminho;
  },
  _blobs: {},
  async urlArquivo(bucket, caminho) { return this._blobs[caminho] || ""; },
  // gatilho aplicar_aprovacao (igual ao do banco)
  _gatilhos(t, l, antigo) {
    if (t === "ig_automations" && S.usuario && S.usuario.papel === "cliente") {
      const acao = !antigo ? "criou a automação" : antigo.active !== l.active ? (l.active ? "ativou a automação" : "pausou a automação") : "editou a automação";
      this._tab("ig_alertas").push({ id: uid(), cliente_id: l.cliente_id, automation_id: l.id, tipo: "cliente", visto: false, created_at: new Date().toISOString(),
        mensagem: `${(this._tab("clientes").find((c) => c.id === l.cliente_id) || {}).nome || "O cliente"} ${acao} "${l.nome}".` });
    }
    if (t === "aprovacoes") {
      const p = this._tab("posts").find((x) => x.id === l.post_id && x.cliente_id === l.cliente_id);
      if (p) p.status = l.decisao === "aprovado" ? "aprovado" : "ajuste";
    }
  },
  // funções simuladas (nada sai do navegador)
  async funcao(nome, corpo) {
    await new Promise((r) => setTimeout(r, 350));
    const cid = corpo.cliente_id || S.clienteId;
    if (nome === "client-invite") {
      const slug = slugify(corpo.slug || corpo.nome);
      let c = this._tab("clientes").find((x) => x.slug === slug);
      if (!c) c = await this.inserir("clientes", novoClienteVazio({ nome: corpo.nome, slug, instagram: corpo.instagram, plano: corpo.plano, valor_mensal: corpo.valor_mensal }));
      await this.upsert("onboarding", { cliente_id: c.id, respostas: {}, progresso: 0, status: "rascunho", pendencias: [] }, "cliente_id");
      return { ok: true, cliente_id: c.id, slug, mensagem: "Modo de teste: nenhum e-mail foi enviado." };
    }
    if (nome === "ig-insights") {
      const conta = this._tab("ig_contas_publico").find((x) => x.cliente_id === cid);
      if (!conta) throw { erro: "Conecte o Instagram para ver as métricas." };
      // Igual à função real: o dobro do período (para comparar); novos seguidores só dos últimos 30 dias
      const n = [7, 15, 30, 90].includes(Number(corpo.dias)) ? Number(corpo.dias) : 15;
      const dias = [...Array(n * 2)].map((_, i) => somarDias(hojeISO(), i - (n * 2 - 1)));
      const posts = corpo.posts ? this._tab("ig_midias").filter((m) => m.cliente_id === cid && m.media_type !== "STORY" && new Date(m.timestamp) >= new Date(Date.now() - n * 86400000))
        .map((m, i) => ({ media_id: m.media_id, media_type: m.media_type, permalink: m.permalink, timestamp: m.timestamp, caption: m.caption, thumbnail_url: m.thumbnail_url,
          reach: 900 + ((i * 1733) % 9000), views: 1500 + ((i * 2711) % 14000), saved: 10 + ((i * 37) % 160), shares: 5 + ((i * 53) % 240), likes: 80 + ((i * 97) % 600), comments: 4 + ((i * 13) % 70), follows: i % 3 ? 2 + ((i * 11) % 90) : null })) : undefined;
      return { ok: true, username: conta.username, seguidores: 1412, dias: n, engajadas: corpo.posts ? 3180 * Math.ceil(n / 30) : null, interacoes: corpo.posts ? 6420 * Math.ceil(n / 30) : null,
        novos_por_dia: dias.slice(-30).map((d, i) => ({ data: d, valor: 3 + ((i * 7) % 9) })),
        alcance_por_dia: dias.map((d, i) => ({ data: d, valor: 600 + ((i * 137) % 700) + (i > n ? 150 : 0) })), posts };
    }
    if (nome === "ig-comentarios") {
      const lista = this._tab("ig_comentarios").filter((x) => x.cliente_id === cid);
      lista.forEach((x) => { x.atualizado_em = new Date().toISOString(); });
      return { ok: true, posts: 8, comentarios: lista.length, duvidas: lista.filter((x) => x.categoria === "duvida").length, interesses: lista.filter((x) => x.categoria === "interesse").length };
    }
    if (nome === "ig-media") {
      const conta = this._tab("ig_contas_publico").find((x) => x.cliente_id === cid);
      if (!conta) throw { erro: "Conecte o Instagram deste cliente primeiro." };
      return { ok: true, total: this._tab("ig_midias").filter((m) => m.cliente_id === cid).length };
    }
    if (nome === "ig-diagnostico") {
      return { ok: true, tudo_ok: false, testes: [
        { nome: "Perfil", ok: true, http: 200, codigo: null, subcodigo: null, mensagem: "OK" },
        { nome: "Publicações", ok: true, http: 200, codigo: null, subcodigo: null, mensagem: "OK" },
        { nome: "Métricas", ok: true, http: 200, codigo: null, subcodigo: null, mensagem: "OK" },
        { nome: "Conversas (direct)", ok: false, http: 400, codigo: 3, subcodigo: null, mensagem: "Exemplo de falha: o app ainda não tem acesso ao direct." },
        { nome: "Webhooks inscritos", ok: true, http: 200, codigo: null, subcodigo: null, mensagem: "OK" },
      ] };
    }
    if (nome === "ig-account-connect") {
      if (!/^\d{6,25}$/.test(corpo.ig_account_id || "")) throw { erro: "O ID da conta profissional precisa ter só números (de 6 a 25 dígitos)." };
      const outra = this._tab("ig_contas_publico").find((x) => x.ig_account_id === corpo.ig_account_id && x.cliente_id !== cid);
      if (outra) throw { erro: "Essa conta do Instagram já está ligada a outro cliente. Desconecte lá primeiro." };
      await this.upsert("ig_contas_publico", { ig_account_id: corpo.ig_account_id, cliente_id: cid, username: "conta_teste_" + corpo.ig_account_id.slice(-4),
        tipo_login: "token_sistema", conectado_em: new Date().toISOString(), last_ok: true, situacao: "ativa" }, "ig_account_id");
      return { ok: true, username: "conta_teste", diagnostico: [], aviso: "Modo de teste: nada foi enviado ao Meta." };
    }
    if (nome === "ig-account-disconnect") {
      await this.atualizar("ig_automations", { ig_account_id: corpo.ig_account_id }, { active: false });
      await this.apagar("ig_contas_publico", { ig_account_id: corpo.ig_account_id });
      return { ok: true, mensagem: "Conta desconectada. As automações dela foram pausadas." };
    }
    if (nome === "ig-oauth-start") throw { erro: "No modo de teste o login do Instagram não abre. Use o cadastro direto." };
    return { ok: true };
  },
};

function novoClienteVazio(c) {
  return Object.assign({
    id: uid(), slug: "", nome: "", instagram: "", tipo_negocio: "servico", plano: "", status: "ativo", fase_ciclo: 0,
    telas_visiveis: TELAS_CLIENTE.map((t) => t.id), proximo_marco: {}, ponto_de_partida: {}, escopo: { posts_semana: 3, prazo_aprovacao_dias: 2, rodadas_ajuste: 1 },
    video_boas_vindas_url: "", pasta_envio_url: "", valor_mensal: 0, contrato_fim: null, produto: {}, created_at: new Date().toISOString(),
  }, c);
}

/** Dados de exemplo do modo local (tudo fictício). */
function carregarExemplo() {
  const t = DadosLocais.t;
  const C = "exemplo-0001";
  const hoje = hojeISO();
  const cores = ["#7D9A7E", "#C46A45", "#1F4E8C", "#9B86BD", "#D99A1E", "#0FA3A3"];
  t.configuracoes = [{ id: 1, nome: "Portal Social Media", logo_url: "", cor_destaque: "#CC5E27", whatsapp: "5500000000000", texto_boas_vindas: "Que bom ter você aqui! Comece pelo onboarding: uma pergunta por vez, sem pressa." }];
  t.clientes = [novoClienteVazio({
    id: C, slug: "cliente-exemplo", nome: "Cliente Exemplo", instagram: "@cliente_exemplo", plano: "Crescimento", fase_ciclo: 1,
    proximo_marco: { texto: "Fechar 30 dias de rodízio de originais", data: somarDias(hoje, 20) },
    ponto_de_partida: { seguidores: 1200, alcance_medio: 800, nota_bio: 5, data: somarDias(hoje, -60) },
    escopo: { posts_semana: 5, formatos: "carrossel, reels, post", lancamentos: 1, relatorio: true, rodadas_ajuste: 1, prazo_aprovacao_dias: 2 },
    video_boas_vindas_url: "", pasta_envio_url: "https://drive.google.com/SUA_PASTA_AQUI", valor_mensal: 1500, contrato_fim: somarDias(hoje, 25),
    produto: { ideia: "Mini guia de lanches da semana (exemplo)", nota: 78, mecanismo: "Método das 3 Gavetas (exemplo)" },
  })];
  const post = (i, dias, formato, est, tema, status, extra = {}) => ({
    id: "post-" + i, cliente_id: C, data: somarDias(hoje, dias), formato, pilar: ["Rotina", "Bastidor", "Prova"][i % 3], funil: ["topo", "meio", "fundo"][i % 3],
    estrategia: est, fase_ciclo: 1, tema, status, versao: 1, mudancas: null, link_publicado: null, updated_at: new Date().toISOString(),
    prazo_aprovacao: status === "aprovacao" ? somarDias(hoje, 2) : null,
    roteiro: formato === "reels" ? "Gancho (0 a 3 s): Você também chega em casa morrendo de fome?\nContexto: O problema quase nunca é o jantar.\nEntrega: É o lanche das 16h que faltou.\nCTA: Comenta LANCHE que eu te mando a lista." :
      "Slide 1: " + tema + "\nSlide 2: O que costuma acontecer\nSlide 3: A troca simples\nSlide 4: Comenta LANCHE",
    legenda: "Legenda de exemplo para \"" + tema + "\". Primeira linha que complementa o gancho.\n\nCorpo com um fato real do cliente.\n\nComenta LANCHE que eu te mando a lista.",
    midias: formato === "reels" ? [{ tipo: "imagem", src: svgExemplo(tema, cores[i % 6], "9/16") }] :
      [1, 2, 3].map((n) => ({ tipo: "imagem", src: svgExemplo(n === 1 ? tema : "Slide " + n, cores[(i + n) % 6]) })),
    ...extra,
  });
  t.posts = [
    post(1, 1, "carrossel", "alcance", "O lanche das 16h que salva seu jantar", "aprovacao"),
    post(2, 3, "reels", "conexao", "Um dia comigo, do café ao último atendimento", "aprovacao"),
    post(3, 5, "carrossel", "autoridade", "3 mitos sobre comer à noite", "aprovacao", { versao: 2, mudancas: "Troquei o slide 3 como você pediu." }),
    post(4, 7, "post", "prova_social", "O que mudou para uma cliente em 3 meses", "producao"),
    post(5, 9, "reels", "venda", "Como funciona o acompanhamento", "pauta"),
    post(6, -2, "carrossel", "autoridade", "Mito x verdade: pão à noite", "publicado", { link_publicado: "https://www.instagram.com/p/EXEMPLO1/" }),
    post(7, -5, "reels", "alcance", "A geladeira de quem trabalha fora", "publicado", { link_publicado: "https://www.instagram.com/p/EXEMPLO2/" }),
    post(8, -8, "post", "conexao", "Bastidor: minha segunda-feira", "publicado"),
  ];
  t.aprovacoes = [];
  t.briefings = [
    { id: "br-1", post_id: "post-2", cliente_id: C, status: "pendente", prazo: somarDias(hoje, 2), link_envio: null, referencia: "Cozinha, de manhã, luz da janela de frente.",
      checklist: ["Celular na vertical", "Lente limpa", "Luz de frente", "Altura dos olhos", "Distância de um braço", "Gancho em tomada separada"],
      texto_teleprompter: "Você também chega em casa morrendo de fome?\nO problema quase nunca é o jantar.\nÉ o lanche das 16h que faltou.\nHoje eu te mostro o meu.\nComenta LANCHE que eu te mando a lista." },
    { id: "br-2", post_id: "post-5", cliente_id: C, status: "pendente", prazo: somarDias(hoje, 6), link_envio: null, referencia: "Consultório, sentada, câmera na altura dos olhos.",
      checklist: ["Celular na vertical", "Luz de frente"], texto_teleprompter: "Muita gente me pergunta como funciona o acompanhamento.\nSão 3 encontros por mês.\nE você me chama no direct quando precisar." },
  ];
  t.ideias = [{ id: "id-1", cliente_id: C, tipo: "texto", conteudo: "Falar sobre lancheira das crianças na volta às aulas", status: "nova", created_at: somarDias(hoje, -1) + "T10:00:00Z" }];
  t.recados = [{ id: "rc-1", cliente_id: C, autor_id: "sm", texto: "O conteúdo da semana que vem está no portal, na tela Aprovar.", tipo: "aviso", created_at: somarDias(hoje, -1) + "T09:00:00Z" }];
  t.metricas_post = [
    { post_id: "post-6", cliente_id: C, visualizacoes: 4200, alcance: 3100, curtidas: 180, comentarios: 22, salvamentos: 95, compartilhamentos: 40, seguidores_ganhos: 31, origem: "manual", canal: "feed" },
    { post_id: "post-7", cliente_id: C, visualizacoes: 12800, alcance: 9900, curtidas: 610, comentarios: 75, salvamentos: 140, compartilhamentos: 230, seguidores_ganhos: 160, origem: "api", canal: "feed" },
    { post_id: "post-8", cliente_id: C, visualizacoes: 900, alcance: 760, curtidas: 60, comentarios: 9, salvamentos: 4, compartilhamentos: 2, seguidores_ganhos: 2, origem: "manual", canal: "feed" },
  ];
  t.metricas_conta = [...Array(15)].map((_, i) => ({ cliente_id: C, data: somarDias(hoje, i - 14), seguidores: 1340 + i * 5, novos_seguidores: 3 + ((i * 7) % 9), alcance: 600 + ((i * 137) % 700) }));
  t.pedidos_audiencia = [
    { id: "pa-1", cliente_id: C, frase_exata: "o que eu levo de lanche pro trabalho?", tipo: "pergunta", ocorrencias: 7, fonte: "comentários", created_at: hoje },
    { id: "pa-2", cliente_id: C, frase_exata: "não tenho tempo nem de almoçar", tipo: "dificuldade", ocorrencias: 4, fonte: "direct", created_at: hoje },
  ];
  t.relatorios = [{ id: "rel-1", cliente_id: C, mes: somarDias(hoje, -30).slice(0, 7), publicado: true,
    conteudo: "# Relatório do mês (exemplo)\n\n## Números\n- Seguidores: de 1.200 para 1.340 (+140)\n- Alcance médio por post: 2.100\n\n## Os 3 melhores posts\n1. A geladeira de quem trabalha fora: 12.800 visualizações, 160 seguidores.\n2. Mito x verdade: pão à noite: 95 salvamentos.\n3. Bastidor: minha segunda-feira.\n\n## Próximo mês\nMais reels de rotina e um post de prova social por semana." }];
  t.lancamentos = [{ id: "lan-1", cliente_id: C, nome: "Mini guia de lanches (exemplo)", status: "planejado", tamanho_lista: null, resultado: {},
    datas: montarCalendarioReverso(somarDias(hoje, 18)) }];
  t.pesquisa_satisfacao = [];
  t.onboarding = [{ cliente_id: C, respostas: { q1: "Exemplo: pode me chamar de Cliente Exemplo.", q2: "@cliente_exemplo, prestadora de serviço.", q3: "não sei ainda" }, progresso: 6, status: "enviado", pendencias: [] }];
  t.cerebro = [{ cliente_id: C, versao: 1, conteudo_md: "# Cérebro da Marca: Cliente Exemplo (fictício)\n\n## 1. Essência\n- **O que faz:** acompanhamento de alimentação para quem trabalha fora (exemplo).\n- **Transformação:** antes, jantar exagerado por fome > depois, rotina com lanche planejado.\n\n## 2. Público\n- **Dores, nas palavras do público:** \"não tenho tempo nem de almoçar\"\n\n### As 13 informações do avatar\n1. Desejos: chegar em casa sem fome de leão.\n2. Dores: correria, falta de planejamento.\n\n## 3. Voz e tom\n- **Pessoa do discurso:** primeira pessoa, conversa entre amigas.\n- **Nunca usar:** \"guerreira\", \"gratidão\".\n\n## 9. Regras operacionais\n- Prazo de aprovação: 2 dias.\n- Não mostrar os filhos.\n" }];
  t.prompts_modelo = (typeof PROMPTS_LOCAIS !== "undefined" ? PROMPTS_LOCAIS : []).map((p) => ({ id: p.tarefa, tarefa: p.tarefa, texto: p.texto }));
  t.geracoes = [{ id: "g-1", cliente_id: C, tarefa: "perguntas-gancho", created_at: somarDias(hoje, -3) + "T12:00:00Z",
    resposta_colada: "1. Você também abre a geladeira às 22h sem fome? (espelho | culpa)\n2. Precisa mesmo cortar o pão à noite? (crença | medo de engordar)\n3. Por que o seu jantar vira banquete? (quebra | curiosidade)" }];
  t.usuarios = [];
  // Instagram de exemplo
  t.ig_contas_publico = [{ ig_account_id: "17840000000000001", cliente_id: C, username: "cliente_exemplo", tipo_login: "token_sistema", conectado_em: somarDias(hoje, -20) + "T10:00:00Z", last_ok: true, situacao: "ativa", expires_at: null }];
  t.ig_midias = [...Array(8)].map((_, i) => ({ media_id: "m" + (i + 1), cliente_id: C, ig_account_id: "17840000000000001", media_type: i % 3 === 1 ? "VIDEO" : "IMAGE",
    thumbnail_url: svgExemplo("Post " + (i + 1), cores[i % 6], "1/1"), permalink: "https://www.instagram.com/p/EXEMPLO" + (i + 1) + "/", caption: "Legenda de exemplo " + (i + 1), timestamp: somarDias(hoje, -i * 2) + "T12:00:00Z" }));
  // Stories ativos de exemplo
  t.ig_midias.push(...[1, 2, 3].map((n) => ({ media_id: "s" + n, cliente_id: C, ig_account_id: "17840000000000001", media_type: "STORY",
    thumbnail_url: svgExemplo("Story " + n, cores[(n + 2) % 6], "9/16"), permalink: null, caption: "", timestamp: new Date(Date.now() - n * 3 * 3600 * 1000).toISOString() })));
  t.ig_automations = [
    { id: "auto-1", cliente_id: C, ig_account_id: "17840000000000001", nome: "Lista de lanches", keyword: "lanche, lista", match_any: false, active: true, media_ids: ["m1", "m2", "m3"],
      public_reply: "Te mandei no direct!", public_reply_variants: ["Corre lá no direct que eu te mandei!"], modelo: "material", asset_ids: [], updated_at: somarDias(hoje, -2) + "T10:00:00Z",
      flow: { steps: [{ id: 1, message: "Aqui está a lista que você pediu 💌", buttons: [{ title: "Baixar a lista", url: "https://SEU_LINK_AQUI" }] }] } },
    { id: "auto-2", cliente_id: C, ig_account_id: "17840000000000001", nome: "Lista VIP do guia", keyword: "vip", match_any: false, active: false, media_ids: [],
      public_reply: "Te chamei no direct!", public_reply_variants: [], modelo: "captacao_vip", asset_ids: [], updated_at: somarDias(hoje, -1) + "T10:00:00Z",
      gatilhos: ["comentario", "story"], story_qualquer: true, story_ids: [],
      flow: { steps: [{ id: 1, message: "Oba! Quer entrar na lista VIP do guia?", buttons: [{ title: "Quero entrar", next: 2 }] },
        { id: 2, message: "Pronto! Toca no botão para entrar no grupo da lista.", buttons: [{ title: "Entrar no grupo", url: "https://SEU_LINK_DO_GRUPO" }] }] } },
  ];
  const nomes = ["ana.exemplo", "bia_teste", null, "carla.demo", "duda_exemplo", null, "elis.teste", "fe.demo", "gabi_exemplo", "helo.teste"];
  t.ig_leads = nomes.map((u, i) => ({ ig_account_id: "17840000000000001", ig_user_id: "9000000000" + i, cliente_id: C, username: u,
    last_source: ["comment", "dm", "story_reply"][i % 3], last_keyword: i % 4 === 3 ? "vip" : "lanche", automation_id: i % 4 === 3 ? "auto-2" : "auto-1",
    flow_step: 1, link_sent: i % 3 !== 2, tags: i % 4 === 3 ? ["vip", "guia-lanches"] : i % 2 ? ["lanche"] : [], email: i === 3 ? "carla@exemplo.com" : null, telefone: i === 6 ? "11900000000" : null,
    created_at: new Date(Date.now() - (i * 9 + 2) * 3600 * 1000).toISOString(), updated_at: new Date(Date.now() - i * 5 * 3600 * 1000).toISOString(),
    status: ["novo", "em_conversa", "novo", "cliente", "novo", "perdido", "em_conversa", "novo", "cliente", "novo"][i] }));
  // Mais 90 leads fictícios espalhados pelos últimos 6 meses, com mais movimento à noite e às quintas
  const frases = ["quero a lista", "LANCHE por favor", "lanche!!", "me manda a lista 😍", "vip", "quero entrar na vip", "lanche", "quero"];
  for (let k = 0; k < 90; k++) {
    const diasAtras = (k * 2.1) % 180, hora = [19, 20, 21, 12, 13, 8, 20, 22][k % 8];
    const d = new Date(Date.now() - diasAtras * 86400000); d.setHours(hora, (k * 7) % 60, 0, 0);
    if (k % 5 === 0) d.setDate(d.getDate() - ((d.getDay() + 3) % 7));   // puxa alguns para quinta-feira
    const auto = k % 3 === 0 ? "auto-2" : "auto-1";
    t.ig_leads.push({ ig_account_id: "17840000000000001", ig_user_id: "8100000" + String(k).padStart(4, "0"), cliente_id: C, username: k % 7 === 0 ? null : "pessoa.exemplo" + k,
      last_source: ["comment", "comment", "dm", "story_reply"][k % 4], last_keyword: frases[k % frases.length], automation_id: auto, flow_step: 1, link_sent: k % 4 !== 1,
      tags: k % 6 === 0 ? ["vip"] : [], email: k % 9 === 0 ? `pessoa${k}@exemplo.com` : null, telefone: k % 13 === 0 ? "11900000" + String(k).padStart(3, "0") : null,
      status: ["novo", "novo", "em_conversa", "cliente", "novo", "perdido"][k % 6], created_at: d.toISOString(), updated_at: d.toISOString() });
  }
  t.ig_deliveries = t.ig_leads.flatMap((l, i) => [{ id: "d" + i, cliente_id: C, ig_account_id: l.ig_account_id, ig_user_id: l.ig_user_id, automation_id: l.automation_id,
    canal: l.last_source === "comment" ? "private_reply" : "dm", tipo: l.link_sent ? "link" : "flow", status: i === 5 || i % 31 === 0 ? "erro" : "ok",
    motivo: i === 5 || i % 31 === 0 ? "A pessoa não aceita mensagens (exemplo)" : null, ts: l.created_at }]);
  t.ig_alertas = [];
  t.ig_assets = [];
  // Comentários de exemplo (aba Comentários)
  const textosCom = ["amei", "Como faço pra montar a lancheira da semana?", "quanto custa o acompanhamento?", "Queria muito aprender a cozinhar rápido", "faz um vídeo sobre lanche da tarde",
    "lindo demais 😍", "tem como fazer sem glúten?", "sim", "Dá pra congelar os potes?", "preciso de ideias para o jantar das crianças", "quero", "Qual iogurte você usa?",
    "fala sobre lanche para levar no carro", "perfeito!", "Onde compra esses potes?", "gostaria de um cardápio de 7 dias", "amei a dica", "como substituir a aveia?"];
  const quem = ["isa.exemplo", "sofia.teste", "carol.demo", "nat.exemplo", "ju.teste", "line.demo", "bia_teste", "ana.exemplo", "rafa.demo", "helo.teste"];
  t.ig_comentarios = [...Array(70)].map((_, k) => {
    const texto = textosCom[(k * 7) % textosCom.length];
    const categoria = /\?|^(como|quanto|qual|onde|tem como|dá pra)/i.test(texto) && texto.length >= 12 ? "duvida" : /(queria|preciso|gostaria|faz um vídeo|fala sobre)/i.test(texto) ? "interesse" : null;
    return { comment_id: "c" + k, cliente_id: C, ig_account_id: "17840000000000001", media_id: "m" + ((k % 8) + 1), parent_id: null,
      username: quem[Math.min(quem.length - 1, Math.floor(Math.sqrt(k * 1.6)))], texto, categoria, virou_pauta: false,
      timestamp: new Date(Date.now() - k * 9 * 3600 * 1000).toISOString(), atualizado_em: new Date(Date.now() - 2 * 3600 * 1000).toISOString() };
  });
}

/** Calendário reverso do lançamento a partir da abertura do carrinho. */
function montarCalendarioReverso(abertura) {
  const pre = somarDias(abertura, -2), aquec = somarDias(pre, -6), fechamento = somarDias(abertura, 2);
  const checklist = [];
  for (let i = 0; i < 6; i++) checklist.push({ dia: somarDias(aquec, i), fase: "Aquecimento", item: i < 4 ? "2 posts só sobre o problema" : "Post de captação da lista VIP com palavra-chave", feito: false });
  for (let i = 0; i < 2; i++) checklist.push({ dia: somarDias(pre, i), fase: "Pré-lançamento", item: "2 posts e 2 mensagens no canal com data, preço e condição reais", feito: false });
  for (let i = 0; i < 3; i++) checklist.push({ dia: somarDias(abertura, i), fase: "Lançamento", item: i === 2 ? "Última oportunidade: 2 posts com a palavra-chave do checkout" : "2 posts com a palavra-chave que leva ao checkout na DM", feito: false });
  return {
    aquecimento: aquec, pre, abertura, fechamento, checklist,
    canal: [
      { dia: pre, hora: "09:00", texto: "Bom dia! Amanhã tem novidade aqui no canal. Fica de olho." },
      { dia: abertura, hora: "09:00", texto: "Abriu! O link está aqui: [link do checkout]" },
      { dia: fechamento, hora: "19:00", texto: "Última chamada: o carrinho fecha hoje às 23h59." },
    ],
    pagamento: [{ item: "Checkout testado com uma compra real", feito: false }, { item: "Preço e condição conferidos", feito: false },
      { item: "Link do checkout na automação da palavra-chave", feito: false }, { item: "Página de obrigado com o retorno do rei", feito: false }],
  };
}

// Perguntas do onboarding (as mesmas de modelos/briefing-onboarding.md)
const PERGUNTAS_ONBOARDING = [
 {
  "id": "q1",
  "bloco": 1,
  "blocoTitulo": "Seu negócio",
  "texto": "Como chamar você e seu negócio?",
  "exemplo": "Pode me chamar de [seu nome]. O negócio é [nome do negócio]."
 },
 {
  "id": "q2",
  "bloco": 1,
  "blocoTitulo": "Seu negócio",
  "texto": "Qual o @ e o tipo de negócio?",
  "exemplo": "@[seu_perfil], sou prestadora de serviço (atendo em [cidade])."
 },
 {
  "id": "q3",
  "bloco": 1,
  "blocoTitulo": "Seu negócio",
  "texto": "O que você vende e como as pessoas compram?",
  "exemplo": "Vendo [serviço ou produto] por [valor]. As pessoas chamam no direct e eu mando o link de pagamento."
 },
 {
  "id": "q4",
  "bloco": 1,
  "blocoTitulo": "Seu negócio",
  "texto": "O que mais quer divulgar nos próximos meses?",
  "exemplo": "Quero lotar a agenda de [serviço] e lançar [produto] em [mês]."
 },
 {
  "id": "q5",
  "bloco": 2,
  "blocoTitulo": "A pessoa que você atende",
  "texto": "Quem costuma comprar de você? Pense em uma pessoa real, sem dados privados.",
  "exemplo": "Uma mulher de uns 35 anos, mãe de dois, que trabalha fora e chega cansada em casa."
 },
 {
  "id": "q6",
  "bloco": 2,
  "blocoTitulo": "A pessoa que você atende",
  "texto": "Em que momento ela procura você?",
  "exemplo": "Quando percebe que já tentou sozinha e não deu certo, geralmente no começo do mês."
 },
 {
  "id": "q7",
  "bloco": 2,
  "blocoTitulo": "A pessoa que você atende",
  "texto": "O que ela quer conseguir ou manter?",
  "exemplo": "Quer ter mais tempo à noite sem sentir culpa."
 },
 {
  "id": "q8",
  "bloco": 2,
  "blocoTitulo": "A pessoa que você atende",
  "texto": "O que ela diz, com as palavras dela?",
  "exemplo": "\"Eu não tenho tempo nem para respirar.\""
 },
 {
  "id": "q9",
  "bloco": 2,
  "blocoTitulo": "A pessoa que você atende",
  "texto": "O que ela teme ou pensa e nem sempre fala?",
  "exemplo": "Tem medo de gastar e não ver resultado de novo."
 },
 {
  "id": "q10",
  "bloco": 2,
  "blocoTitulo": "A pessoa que você atende",
  "texto": "O que ela já tentou antes?",
  "exemplo": "Já baixou aplicativo, já seguiu dica de vídeo, já pagou um curso que não terminou."
 },
 {
  "id": "q11",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Quais são os desejos dessa pessoa?",
  "exemplo": "Ter a casa organizada sem passar o sábado inteiro limpando."
 },
 {
  "id": "q12",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Quais dificuldades aparecem com mais frequência?",
  "exemplo": "Falta de tempo, cansaço, não saber por onde começar."
 },
 {
  "id": "q13",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que situações do dia a dia fazem ela reconhecer o problema?",
  "exemplo": "Quando abre o armário e cai tudo, quando recebe visita de surpresa."
 },
 {
  "id": "q14",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que filmes, séries, músicas ou referências ela gosta?",
  "exemplo": "Assiste [série], ouve [estilo de música], segue memes de [tema]."
 },
 {
  "id": "q15",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que técnicas ou soluções ela já conhece?",
  "exemplo": "Já ouviu falar de [técnica], mas acha difícil manter."
 },
 {
  "id": "q16",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que pessoas ou personagens ela acompanha?",
  "exemplo": "Segue [tipo de perfil], gosta de quem fala de [tema]."
 },
 {
  "id": "q17",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que opções ela compara antes de escolher você?",
  "exemplo": "Compara com fazer sozinha, com [concorrente genérico] e com um curso online."
 },
 {
  "id": "q18",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que instituições, grupos ou lugares ela frequenta?",
  "exemplo": "Grupo de mães da escola, academia do bairro, igreja."
 },
 {
  "id": "q19",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que objetos ou ferramentas ela usa?",
  "exemplo": "Usa o celular para tudo, agenda de papel, aplicativo de lista."
 },
 {
  "id": "q20",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Que frases ou crenças ela repete?",
  "exemplo": "\"Isso não é para mim\", \"Quando as coisas acalmarem eu começo\"."
 },
 {
  "id": "q21",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "O que poderia surpreendê-la?",
  "exemplo": "Descobrir que 15 minutos por dia já resolvem."
 },
 {
  "id": "q22",
  "bloco": 3,
  "blocoTitulo": "Pesquisa e avatar",
  "texto": "Faça um retrato resumido dessa pessoa.",
  "exemplo": "Uma mulher ocupada, que quer cuidar de si mas sempre se coloca por último."
 },
 {
  "id": "q23",
  "bloco": 4,
  "blocoTitulo": "Experiência e repertório",
  "texto": "Que problema parecido você já viveu ou resolveu?",
  "exemplo": "Eu também vivia com a casa bagunçada até criar meu próprio jeito."
 },
 {
  "id": "q24",
  "bloco": 4,
  "blocoTitulo": "Experiência e repertório",
  "texto": "O que as pessoas mais pedem que você explique?",
  "exemplo": "Me perguntam sempre como começar quando falta tempo."
 },
 {
  "id": "q25",
  "bloco": 4,
  "blocoTitulo": "Experiência e repertório",
  "texto": "Qual é sua história de origem, sua virada e algo que está em andamento?",
  "exemplo": "Comecei em [ano] atendendo amigas. A virada foi [fato]. Agora estou montando [projeto]."
 },
 {
  "id": "q26",
  "bloco": 4,
  "blocoTitulo": "Experiência e repertório",
  "texto": "Conte um desafio ou conquista com contexto (e diga se podemos usar).",
  "exemplo": "Uma cliente saiu de [situação] para [resultado] em [tempo]. Ela autorizou contar."
 },
 {
  "id": "q27",
  "bloco": 4,
  "blocoTitulo": "Experiência e repertório",
  "texto": "Que opinião ou convicção você defende?",
  "exemplo": "Acredito que [opinião], mesmo que muita gente no meu meio pense diferente."
 },
 {
  "id": "q28",
  "bloco": 5,
  "blocoTitulo": "Direção e conteúdo",
  "texto": "O que você quer tornar possível para quem segue você?",
  "exemplo": "Quero que a pessoa consiga [mudança] sem [sacrifício]."
 },
 {
  "id": "q29",
  "bloco": 5,
  "blocoTitulo": "Direção e conteúdo",
  "texto": "O que esse resultado mudaria na rotina dela?",
  "exemplo": "Ela teria as noites livres para a família."
 },
 {
  "id": "q30",
  "bloco": 5,
  "blocoTitulo": "Direção e conteúdo",
  "texto": "Sobre que assuntos você consegue conversar por bastante tempo?",
  "exemplo": "Rotina, organização, maternidade, [tema]."
 },
 {
  "id": "q31",
  "bloco": 5,
  "blocoTitulo": "Direção e conteúdo",
  "texto": "Quais seriam os três assuntos do seu perfil?",
  "exemplo": "1) [assunto] 2) [assunto] 3) bastidores do meu trabalho."
 },
 {
  "id": "q32",
  "bloco": 5,
  "blocoTitulo": "Direção e conteúdo",
  "texto": "Que conteúdo você gosta de assistir?",
  "exemplo": "Gosto de vídeos curtos, falados, de gente que mostra a rotina real."
 },
 {
  "id": "q33",
  "bloco": 6,
  "blocoTitulo": "Voz e regras",
  "texto": "Quem fala nos conteúdos?",
  "exemplo": "Eu, em primeira pessoa, como uma conversa entre amigas."
 },
 {
  "id": "q34",
  "bloco": 6,
  "blocoTitulo": "Voz e regras",
  "texto": "Como você quer soar? Até três características.",
  "exemplo": "Acolhedora, direta e bem-humorada."
 },
 {
  "id": "q35",
  "bloco": 6,
  "blocoTitulo": "Voz e regras",
  "texto": "Que palavras você fala e quais não quer usar?",
  "exemplo": "Falo \"gente\" e \"bora\". Não quero \"guerreira\" nem \"gratidão\"."
 },
 {
  "id": "q36",
  "bloco": 6,
  "blocoTitulo": "Voz e regras",
  "texto": "Como prefere pontuação, emojis e humor?",
  "exemplo": "Poucos emojis, sem exclamação demais, humor leve."
 },
 {
  "id": "q37",
  "bloco": 6,
  "blocoTitulo": "Voz e regras",
  "texto": "Existem temas sensíveis ou regras profissionais a seguir?",
  "exemplo": "Não posso prometer resultado, regra do meu conselho profissional."
 },
 {
  "id": "q38",
  "bloco": 6,
  "blocoTitulo": "Voz e regras",
  "texto": "Quais são as regras de imagem?",
  "exemplo": "Pode mostrar meu rosto, mas não meus filhos. Nada de foto de banco de imagem."
 },
 {
  "id": "q39",
  "bloco": 7,
  "blocoTitulo": "Perfil e referências",
  "texto": "Qual o objetivo principal do seu Instagram hoje?",
  "exemplo": "Ser procurada no direct para fechar atendimentos."
 },
 {
  "id": "q40",
  "bloco": 7,
  "blocoTitulo": "Perfil e referências",
  "texto": "O que já funcionou no seu perfil? Números ou prints ajudam.",
  "exemplo": "Um reels de [tema] teve [número] visualizações e trouxe [número] mensagens."
 },
 {
  "id": "q41",
  "bloco": 7,
  "blocoTitulo": "Perfil e referências",
  "texto": "Com que frequência você consegue gravar?",
  "exemplo": "Consigo gravar uma vez por semana, umas 2 horas."
 },
 {
  "id": "q42",
  "bloco": 7,
  "blocoTitulo": "Perfil e referências",
  "texto": "Que fotos, vídeos e materiais você pode compartilhar?",
  "exemplo": "Tenho fotos do consultório, vídeos de bastidor e alguns depoimentos."
 },
 {
  "id": "q43",
  "bloco": 7,
  "blocoTitulo": "Perfil e referências",
  "texto": "Tem depoimentos autorizados? Quais?",
  "exemplo": "Tenho [número] prints de clientes que autorizaram."
 },
 {
  "id": "q44",
  "bloco": 7,
  "blocoTitulo": "Perfil e referências",
  "texto": "Que referências visuais você gosta e o que gosta nelas?",
  "exemplo": "Gosto do perfil @[referencia] pelas cores claras e pela letra grande."
 },
 {
  "id": "q45",
  "bloco": 8,
  "blocoTitulo": "Operação e ponto de partida",
  "texto": "Quanto tempo você precisa para aprovar um conteúdo?",
  "exemplo": "Até 2 dias depois de receber."
 },
 {
  "id": "q46",
  "bloco": 8,
  "blocoTitulo": "Operação e ponto de partida",
  "texto": "Quem aprova e qual o canal preferido?",
  "exemplo": "Eu mesma, pelo WhatsApp."
 },
 {
  "id": "q47",
  "bloco": 8,
  "blocoTitulo": "Operação e ponto de partida",
  "texto": "Que datas importantes vêm por aí?",
  "exemplo": "Aniversário do negócio em [mês], férias em [mês], evento em [data]."
 },
 {
  "id": "q48",
  "bloco": 8,
  "blocoTitulo": "Operação e ponto de partida",
  "texto": "Qual a foto do ponto de partida? Seguidores, alcance médio, nota da bio e data de hoje.",
  "exemplo": "Hoje, [data], tenho [número] seguidores e alcance médio de [número] por post."
 },
 {
  "id": "q49",
  "bloco": 8,
  "blocoTitulo": "Operação e ponto de partida",
  "texto": "Algo mais que queira me contar?",
  "exemplo": "Prefiro não gravar às segundas. Tenho vergonha no começo, mas melhoro."
 }
];
// Biblioteca de prompts para o modo de teste local (no modo real vem da tabela prompts_modelo)
const PROMPTS_LOCAIS = [
 {
  "tarefa": "roteiro-broll",
  "nome": "Roteiro de B-roll",
  "texto": "# Roteiro de B-roll\n\nVocê é roteirista de vídeos curtos para Instagram, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva 3 opções de roteiro de B-roll (cena cotidiana sem fala) sobre o tema. Texto completo na tela desde o primeiro segundo, até 20 palavras. A legenda responde a pergunta do texto da tela.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nPara cada opção:\nOPÇÃO N\nCena: ...\nTexto na tela: ...\nLegenda: ...\nCTA: ...\n"
 },
 {
  "tarefa": "video-falado",
  "nome": "Vídeo falado com loops abertos",
  "texto": "# Vídeo falado com loops abertos\n\nVocê é roteirista de vídeos falados para Instagram, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva um roteiro de vídeo falado de 30 a 50 segundos com loops abertos (responde uma pergunta e abre a próxima sem atrasar a entrega). Comece com 3 opções de gancho.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nGANCHOS\n1. ...\n2. ...\n3. ...\nROTEIRO\n| Tempo | Cena | Fala | Texto na tela |\nCTA: ...\nCAPA: ...\n"
 },
 {
  "tarefa": "yap",
  "nome": "YAP (vídeo falado em série)",
  "texto": "# YAP (vídeo falado em série)\n\nVocê é roteirista de séries de vídeos falados, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nA partir do material do cliente (despejo de ideias), escreva um episódio de YAP de 60 a 70 segundos em 4 partes: gancho, apresentação da série, desenvolvimento de uma ideia, CTA de uma coisa só. Use as palavras do próprio cliente. Aplique o filtro: o cliente ficaria bem se este vídeo alcançasse um milhão de pessoas?\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nSÉRIE: ...\nEPISÓDIO: N\nGANCHO: ...\nAPRESENTAÇÃO: ...\nDESENVOLVIMENTO: ...\nCTA: ...\nCAPA: ...\nLEGENDA: ...\n"
 },
 {
  "tarefa": "carrossel",
  "nome": "Carrossel",
  "texto": "# Carrossel\n\nVocê é redatora de carrosséis para Instagram, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva um carrossel de 6 a 10 slides. Slide 1 com até 12 palavras. Até 30 palavras por slide. Último slide com CTA único. Siga as 5 leis: cada tela abre a próxima, responde a pergunta principal e as secundárias, valor crescente, linguagem do público, final que conclui e pede uma ação.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nSLIDE 1 (capa): ...\nSLIDE 2: ...\n...\nSLIDE N (cta): ...\nLEGENDA: ...\n"
 },
 {
  "tarefa": "imagem-por-tela",
  "nome": "Prompt de imagem por tela",
  "texto": "# Prompt de imagem por tela\n\nVocê é diretora de arte, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nPara o carrossel abaixo (no campo material), escreva um prompt de imagem por tela, uma tela por vez. Formato 4:5, 1080 x 1350. Mantenha consistência de cores, fonte e estilo entre as telas. O texto da tela vai exatamente como está, sem mudar nenhuma palavra.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nTELA 1\nPrompt: ...\nTexto exato: ...\n\nTELA 2\n...\n"
 },
 {
  "tarefa": "legenda",
  "nome": "Legenda",
  "texto": "# Legenda\n\nVocê é redatora de legendas para Instagram, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva a legenda do post. Primeira linha com até 125 caracteres que complementa o gancho. Corpo com um fato real do cliente. CTA único. 3 a 5 palavras-chave naturais. Hashtags só se a marca usa (até 5).\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nLEGENDA:\n...\nPRIMEIRA LINHA ALTERNATIVA: ...\nCOMENTÁRIO FIXADO: ...\n"
 },
 {
  "tarefa": "perguntas-gancho",
  "nome": "20 perguntas-gancho",
  "texto": "# 20 perguntas-gancho\n\nVocê é estrategista de conteúdo, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva 20 perguntas-gancho que o público já faz na cabeça, com as palavras dele. Varie os tipos: espelho, crença, quebra, medo, desejo, inimigo, comparação, identidade.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\n1. Pergunta (tipo | ponto ativado)\n2. ...\n...\n20. ...\nAS 5 MAIS FORTES: números ...\n"
 },
 {
  "tarefa": "pesquisa-de-mercado",
  "nome": "Pesquisa de mercado",
  "texto": "# Pesquisa de mercado\n\nVocê é pesquisadora de público, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nA partir dos comentários colados no campo material, preencha as 13 informações do avatar. Preserve as frases exatas entre aspas. Não invente frequência nem número: diga quantos comentários leu e quantos repetiam a ideia.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\n1. Desejos: ...\n2. Dores: ...\n3. Medos: ...\n4. Hábitos: ...\n5. Referências culturais: ...\n6. Técnicas conhecidas: ...\n7. Pessoas que acompanha: ...\n8. Concorrentes: ...\n9. Instituições: ...\n10. Objetos: ...\n11. Crenças: ...\n12. Quebras de expectativa: ...\n13. Retrato: ...\nCOMENTÁRIOS LIDOS: N\n"
 },
 {
  "tarefa": "produto-viral",
  "nome": "Produto viral",
  "texto": "# Produto viral\n\nVocê é estrategista de produto digital, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nAvalie a ideia de produto do material com nota de 0 a 100 pelos 3 critérios (problema urgente, resultado rápido, fácil de entender), proponha 3 nomes de mecanismo único e revise o índice.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nNOTA: N/100\nProblema urgente: N/33, porque ...\nResultado rápido: N/33, porque ...\nFácil de entender: N/33, porque ...\nMECANISMOS: 1. ... 2. ... 3. ...\nÍNDICE REVISADO:\n1. ...\n"
 },
 {
  "tarefa": "oferta",
  "nome": "Oferta",
  "texto": "# Oferta\n\nVocê é estrategista de ofertas, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nMonte a oferta com os 7 componentes: promessa, método, conteúdo, bônus, garantia, prova, preço e condição. Nada de prova inventada ou escassez falsa.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nPROMESSA: ...\nMÉTODO: ...\nCONTEÚDO: ...\nBÔNUS: ...\nGARANTIA: ...\nPROVA: ...\nPREÇO E CONDIÇÃO: ...\nRETORNO DO REI: ...\nORDER BUMPS: 1. ... 2. ...\n"
 },
 {
  "tarefa": "checkout",
  "nome": "Copy de checkout",
  "texto": "# Copy de checkout\n\nVocê é redatora de checkout, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva a copy do checkout: curta, com o que a pessoa leva, preço com âncora real, garantia e regra de reembolso clara.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nTÍTULO: ...\nO QUE VOCÊ LEVA: ...\nPREÇO: ...\nGARANTIA: ...\nREEMBOLSO: ...\nBOTÃO: ...\n"
 },
 {
  "tarefa": "aquecimento",
  "nome": "Conteúdos de aquecimento",
  "texto": "# Conteúdos de aquecimento\n\nVocê é estrategista de lançamento, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nPlaneje 6 dias de aquecimento: nos 4 primeiros, só o problema (sem vender, sem anunciar produto); nos 2 últimos, captação para a lista VIP com palavra-chave. Sem remix no feed.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nDIA 1\nPost 1: formato | gancho | ideia\nPost 2: ...\n...\nDIA 6\n...\n"
 },
 {
  "tarefa": "captacao",
  "nome": "Captação da lista VIP",
  "texto": "# Captação da lista VIP\n\nVocê é estrategista de lançamento, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva os conteúdos de captação que convidam para a lista VIP com uma palavra-chave, e o texto da automação de direct (uma frase e um botão, sem vender).\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nPOST: ...\nPALAVRA-CHAVE: ...\nRESPOSTA PÚBLICA NO COMENTÁRIO (A): ...\nRESPOSTA PÚBLICA (B): ...\nMENSAGEM DA DM: ...\nTEXTO DO BOTÃO (até 20 caracteres): ...\n"
 },
 {
  "tarefa": "pre-lancamento",
  "nome": "Pré-lançamento",
  "texto": "# Pré-lançamento\n\nVocê é estrategista de lançamento, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nPlaneje 2 dias de pré-lançamento com 2 posts e 2 mensagens no canal por dia, anunciando data, preço e condição reais.\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nDIA 1\nPost 1: ...\nPost 2: ...\nCanal 9h: ...\nCanal 19h: ...\nDIA 2\n...\n"
 },
 {
  "tarefa": "mensagens-do-canal",
  "nome": "Mensagens do canal",
  "texto": "# Mensagens do canal\n\nVocê é redatora de mensagens de grupo e canal, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nEscreva as mensagens do canal (grupo ou canal de transmissão) da fase indicada, com horário e objetivo de cada uma (lembrar, provar, responder objeção, abrir, fechar).\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nHORÁRIO | OBJETIVO | MENSAGEM\n09:00 | ... | ...\n12:00 | ... | ...\n19:00 | ... | ...\n"
 },
 {
  "tarefa": "analise-metricas",
  "nome": "Análise de métricas",
  "texto": "# Análise de métricas\n\nVocê é analista de métricas de Instagram, escrevendo para {{nome_cliente}}.\n\nContexto:\n- Cliente: {{nome_cliente}}\n- Fase do ciclo: {{fase_ciclo}}\n- Público: {{publico}}\n- Voz: {{voz}}\n- Tema: {{tema}}\n- Gancho escolhido: {{gancho}}\n- Material do cliente (use como matéria-prima, com as palavras dele):\n{{material_cliente}}\n\nCérebro da Marca:\n{{cerebro}}\n\nRegras de escrita (obrigatórias):\n- Nunca use travessão. Use vírgula, ponto, dois-pontos ou hífen simples.\n- No máximo um emoji (ou nenhum, se a marca pedir). Negrito só na frase principal.\n- Concreto no lugar do abstrato: cada frase com número, nome, cena ou exemplo real.\n- Nada de começos e finais de IA (\"No cenário atual\", \"Você já se perguntou\", \"Espero que tenha ajudado\").\n- Evite: jornada, potencializar, alavancar, desbloquear, mergulhar, crucial, transformador, insights valiosos.\n- Listas de 2, 4 ou 5 itens. Misture frases curtas e longas.\n- Não invente números, depoimentos ou resultados. Dedução vai marcada como (sugestão, validar com o cliente).\n\nTarefa:\nCom os números do material, calcule: seguidores por 100 visualizações, taxa de compartilhamento, salvamentos e taxa de pulos (se houver). Compare com a régua (orientação, nunca garantia), separe tráfego de conversão e recomende UM teste. Sem dado, escreva \"sem dado\".\n\nFormato de saída (responda exatamente neste formato, para colar de volta no portal):\nPERÍODO: ...\n| Post | Visualizações | Seg/100 vis. | Compart. % | Salv. % | Leitura |\nTRÁFEGO: ...\nCONVERSÃO: ...\nTESTE RECOMENDADO: ...\n"
 }
];

// =============================================================================
// CONSTANTES
// =============================================================================
const TELAS_SM = [
  { id: "inicio", nome: "Início do cliente", icone: "🏠" },
  { id: "cerebro", nome: "Cérebro da Marca", icone: "🧠" },
  { id: "conteudo", nome: "Conteúdo", icone: "✍️" },
  { id: "calendario", nome: "Calendário", icone: "🗓️" },
  { id: "instagram", nome: "Instagram", icone: "📷" },
  { id: "produto", nome: "Produto", icone: "📦" },
  { id: "lancamento", nome: "Lançamento", icone: "🚀" },
  { id: "analise", nome: "Análise", icone: "📊" },
  { id: "relatorios", nome: "Relatórios", icone: "📄" },
  { id: "config-cliente", nome: "Configurações do cliente", icone: "⚙️" },
];
const TELAS_CLIENTE = [
  { id: "onboarding", nome: "Boas-vindas e onboarding", icone: "👋" },
  { id: "semana", nome: "Minha semana", icone: "📌" },
  { id: "aprovar", nome: "Aprovar", icone: "✅" },
  { id: "gravar", nome: "Gravar", icone: "🎬" },
  { id: "ideias", nome: "Ideias", icone: "💡" },
  { id: "automacoes", nome: "Automações", icone: "⚡" },
  { id: "resultados", nome: "Resultados", icone: "📈" },
  { id: "jornada", nome: "Jornada", icone: "🧭" },
  { id: "recados", nome: "Recados", icone: "💬" },
  { id: "acervo", nome: "Acervo", icone: "🗂️" },
  { id: "plano", nome: "Meu plano", icone: "📋" },
  { id: "pesquisa", nome: "Pesquisa do mês", icone: "⭐" },
  { id: "dados", nome: "Baixar meus dados", icone: "⬇️" },
];
const FASES = [
  { n: 0, nome: "Fundação", rodizio: "Nicho, bio, pesquisa de mercado, vídeo de estreia", porque: "Antes de crescer, a gente deixa claro para quem você fala e o que você resolve. Assim quem chega entende em 3 segundos." },
  { n: 1, nome: "Crescimento", rodizio: "Originais em rodízio + remix; até 3 posts por dia, nunca mais de 4 reels", porque: "Agora é hora de ser descoberta por gente nova, com conteúdos que fazem as pessoas pararem e seguirem." },
  { n: 2, nome: "Produto", rodizio: "1 original + 1 remix por dia enquanto o produto é feito", porque: "Enquanto o conteúdo segue no ritmo, a gente monta a sua oferta de entrada com base no que o público pede." },
  { n: 3, nome: "Máquina de vendas", rodizio: "Oferta, bumps e checkout; conteúdo no ritmo da fase 2", porque: "Deixamos a compra simples: oferta clara, checkout curto e complementos que fazem sentido." },
  { n: 4, nome: "Aquecimento", rodizio: "6 dias, só o problema nos 4 primeiros, captação nos 2 últimos; sem remix no feed", porque: "A gente fala do problema que a sua oferta resolve, para as pessoas certas levantarem a mão." },
  { n: 5, nome: "Pré-lançamento", rodizio: "2 dias, 2 posts e 2 mensagens no canal por dia", porque: "Anunciamos data, preço e condição reais, para ninguém ser pego de surpresa." },
  { n: 6, nome: "Lançamento", rodizio: "3 dias (2 nos próximos), 2 posts por dia com palavra-chave que leva ao checkout na DM; dia 3 é \"última oportunidade\"", porque: "Carrinho aberto: quem estava esperando compra com facilidade, direto pelo direct." },
  { n: 7, nome: "Debriefing e perpétuo", rodizio: "5 perguntas, troca do checkout, perpétuo; volta para a fase 1", porque: "Olhamos o que funcionou, guardamos os aprendizados e deixamos a oferta vendendo todo dia." },
];
const STATUS_POST = [
  { id: "pauta", nome: "Pauta" }, { id: "producao", nome: "Produção" }, { id: "revisao", nome: "Revisão" }, { id: "aprovacao", nome: "Aguardando aprovação" },
  { id: "ajuste", nome: "Ajuste" }, { id: "aprovado", nome: "Aprovado" }, { id: "agendado", nome: "Agendado" }, { id: "publicado", nome: "Publicado" },
];
const nomeStatus = (s) => (STATUS_POST.find((x) => x.id === s) || { nome: s }).nome;
const ESTRATEGIAS = { alcance: "Alcance", autoridade: "Autoridade", conexao: "Conexão", prova_social: "Prova social", objecao: "Quebra de objeção", venda: "Venda", retencao: "Retenção" };
const ORIGENS = { comment: "Comentário", dm: "Direct", story_reply: "Resposta ao story" };
const STATUS_LEAD = { novo: "Novo", em_conversa: "Em conversa", cliente: "Cliente", perdido: "Perdido" };
const EMOJIS = ["🫶", "👀", "😍", "🥰", "😂", "😮", "🔥", "✨", "💌", "👉", "🙌", "💕"];

const YAP_MODELOS_MD = "# Biblioteca de modelos de YAP\n\nAqui ficam os modelos de referência analisados.\n\n[preencher com os modelos analisados]\n\n## Ficha para preencher (copie uma por modelo)\n\n- **Nome do modelo:**\n- **Frase-chave:** (a frase que resume o jeito do vídeo)\n- **Lição:** (o que esse modelo ensina)\n- **Princípio:** (por que funciona)\n- **Teste prático:** (como aplicar no próximo episódio do cliente)";

// =============================================================================
// ESTADO GLOBAL
// =============================================================================
const S = {
  modo: "real",            // "real" (Supabase) ou "local" (teste)
  usuario: null,           // { id, email, papel, cliente_id, nome }
  config: {},              // configuracoes (nome, logo, cor, whatsapp, boas-vindas)
  clientes: [],            // social media: todos; cliente: o dele
  clienteId: null,         // cliente aberto
  sujo: false,             // editor com alteração não salva
  telaAtual: "",
};
const clienteAtual = () => S.clientes.find((c) => c.id === S.clienteId) || null;
const ehSM = () => S.usuario && S.usuario.papel === "social_media";

// =============================================================================
// 3. LOGIN E SESSÃO
// =============================================================================
function modoLocalDisponivel() {
  const h = location.hostname;
  return location.protocol === "file:" || h === "localhost" || h === "127.0.0.1";
}
function configPreenchida() {
  return CFG.supabaseUrl && !CFG.supabaseUrl.includes("SEU_PROJETO") && CFG.supabaseAnonKey && !CFG.supabaseAnonKey.includes("SUA_CHAVE");
}

/**
 * IMPORTANTE: a volta do login do Meta traz ?code&state. Guardamos ANTES de criar o
 * cliente do Supabase (ele poderia consumir o "code" achando que é dele) e limpamos a URL.
 */
function capturarRetornoMeta() {
  const p = new URLSearchParams(location.search);
  let mudou = false;
  if (p.get("code") && p.get("state")) {
    try { sessionStorage.setItem("ig-oauth-retorno", JSON.stringify({ code: p.get("code"), state: p.get("state") })); } catch (_) { /* sem storage */ }
    p.delete("code"); p.delete("state"); mudou = true;
  }
  if (p.get("error") && (p.get("error_reason") || p.get("error_description") || p.get("state"))) {
    try { sessionStorage.setItem("ig-oauth-cancelado", "1"); } catch (_) { /* sem storage */ }
    ["error", "error_reason", "error_description", "error_code", "state"].forEach((k) => p.delete(k)); mudou = true;
  }
  if (mudou) history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash);
}

/** Link do convite ou da recuperação de senha: o Supabase manda #...type=invite|recovery */
function tipoLinkDeAcesso() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  const t = h.get("type");
  return t === "invite" || t === "recovery" ? t : null;
}

async function iniciar() {
  capturarRetornoMeta();
  const forcarReal = new URLSearchParams(location.search).get("real") === "1";
  if (modoLocalDisponivel() && !(forcarReal && configPreenchida())) {
    S.modo = "local";
    D = DadosLocais;
    carregarExemplo();
    telaLogin();
    return;
  }
  if (!configPreenchida()) {
    $("#app").innerHTML = `<div class="tela-cheia-centro"><div class="caixa-login"><h2>Portal ainda não configurado</h2>
      <p class="suave">Preencha o arquivo js/config.js com a URL e a chave anon do Supabase. O passo a passo está no LEIA-ME.</p></div></div>`;
    return;
  }
  S.modo = "real";
  D = DadosReais;
  const linkAcesso = tipoLinkDeAcesso();
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  // Restaura a sessão ANTES de mostrar o login (atualizar a página nunca volta para o login)
  $("#app").innerHTML = `<div class="tela-cheia-centro"><p class="suave">Entrando...</p></div>`;
  let sessao = null;
  try { const { data } = await sb.auth.getSession(); sessao = data.session; } catch (_) { sessao = null; }

  sb.auth.onAuthStateChange((evento, nova) => {
    if (evento === "PASSWORD_RECOVERY") { telaDefinirSenha("recovery"); return; }
    if (evento === "SIGNED_OUT" || (evento === "TOKEN_REFRESHED" && !nova)) {
      if (S.usuario) { S.usuario = null; avisar("Sua sessão terminou. Entre de novo."); telaLogin(); }
    }
  });

  if (sessao && linkAcesso) { telaDefinirSenha(linkAcesso); return; }
  if (sessao) { await entrarComSessao(sessao.user); return; }
  telaLogin();
}

function telaLogin(msg = "") {
  const local = S.modo === "local";
  const nome = (S.config && S.config.nome) || "Portal";
  $("#app").innerHTML = `<div class="tela-login">${logoHtml("login")}<form class="caixa-login" id="form-login" autocomplete="on">
    <h1>${local ? "Portal de teste" : "Acesso restrito"}</h1>
    <p class="sub-login">Faça login para acessar o portal.</p>
    ${msg ? `<div class="faixa erro">${esc(msg)}</div>` : ""}
    <label for="email">E-mail</label><input type="email" id="email" required autocomplete="username" placeholder="voce@email.com">
    <label for="senha">Senha</label><input type="password" id="senha" required autocomplete="current-password" ${local ? 'placeholder="5 dígitos, ex.: 12345"' : ""}>
    ${local ? "" : `<a href="#" id="esqueci" class="link-esqueci">Esqueci minha senha</a>`}
    ${local ? `<label>Entrar como</label><div class="seletor-papel">
      <label><input type="radio" name="papel" value="social_media" checked><span>Social media</span></label>
      <label><input type="radio" name="papel" value="cliente"><span>Cliente</span></label></div>` : ""}
    <button class="btn primario bloco" style="margin-top:18px" type="submit">Entrar</button>
    ${local ? `<p class="aviso-local">Modo de teste local. Para colocar no ar, siga o LEIA-ME.</p>` : ""}
  </form></div>`;
  ligarFalhaLogo();
  void nome;
  $("#form-login").onsubmit = async (ev) => {
    ev.preventDefault();
    const email = $("#email").value.trim(), senha = $("#senha").value;
    const btn = $("#form-login button[type=submit]");
    if (local) {
      if (!/^\d{5}$/.test(senha)) { telaLogin("No modo de teste, use uma senha de 5 dígitos (ex.: 12345)."); return; }
      const papel = $("input[name=papel]:checked").value;
      S.config = DadosLocais.t.configuracoes[0];
      S.usuario = { id: "local-" + papel, email, papel, cliente_id: papel === "cliente" ? "exemplo-0001" : null, nome: papel === "cliente" ? "Cliente Exemplo" : "Social media" };
      await abrirPortal();
      return;
    }
    btn.disabled = true; btn.textContent = "Entrando...";
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      await entrarComSessao(data.user);
    } catch (e) { telaLogin(erroAmigavel(e)); }
  };
  const esq = $("#esqueci");
  if (esq) esq.onclick = async (ev) => {
    ev.preventDefault();
    const email = $("#email").value.trim();
    if (!email) { avisar("Digite seu e-mail no campo acima e clique de novo."); return; }
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      avisar("Se o e-mail estiver cadastrado, você vai receber um link para criar uma senha nova.", "ok");
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

function telaDefinirSenha(tipo) {
  $("#app").innerHTML = `<div class="tela-cheia-centro"><form class="caixa-login" id="form-senha">
    <h1>${tipo === "invite" ? "Boas-vindas! Crie sua senha" : "Crie uma senha nova"}</h1>
    <label for="s1">Senha nova</label><input type="password" id="s1" minlength="6" required autocomplete="new-password">
    <label for="s2">Repita a senha</label><input type="password" id="s2" minlength="6" required autocomplete="new-password">
    <button class="btn primario bloco" style="margin-top:16px">Salvar senha e entrar</button></form></div>`;
  $("#form-senha").onsubmit = async (ev) => {
    ev.preventDefault();
    if ($("#s1").value !== $("#s2").value) { avisar("As duas senhas estão diferentes.", "erro"); return; }
    try {
      const { data, error } = await sb.auth.updateUser({ password: $("#s1").value });
      if (error) throw error;
      history.replaceState(null, "", location.pathname);
      avisar("Senha salva.", "ok");
      await entrarComSessao(data.user);
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

/** Lê o papel em "usuarios" e abre a visão certa. */
async function entrarComSessao(user) {
  try {
    const linha = await D.um("usuarios", { eq: { id: user.id } });
    if (!linha) {
      $("#app").innerHTML = `<div class="tela-cheia-centro"><div class="caixa-login"><h2>Seu acesso ainda não foi liberado</h2>
        <p>Fale com a sua social media para ela liberar o seu acesso ao portal.</p><button class="btn bloco" id="sair">Sair</button></div></div>`;
      $("#sair").onclick = sair;
      return;
    }
    S.usuario = { id: user.id, email: user.email, papel: linha.papel, cliente_id: linha.cliente_id, nome: linha.nome };
    const cfg = ehSM() ? await D.um("configuracoes", { eq: { id: 1 } }) : await D.um("configuracoes_publico", {});
    S.config = cfg || {};
    await abrirPortal();
  } catch (e) {
    telaLogin(erroAmigavel(e));
  }
}

async function sair() {
  if (S.sujo && !(await confirmar("Você tem alterações não salvas. Sair mesmo assim?", "Sair", true))) return;
  S.sujo = false;
  if (S.modo === "real" && sb) await sb.auth.signOut();
  S.usuario = null; S.clientes = []; S.clienteId = null;
  if (S.modo === "real") {
    // no portal publicado: recarrega a página inteira (limpa da memória tudo o que era da sessão)
    location.replace(location.pathname);
    return;
  }
  // no modo de teste: só volta para o login (recarregar apagaria os dados de exemplo)
  history.replaceState(null, "", location.pathname + location.search);
  rotaAnterior = "";
  telaLogin();
  const campo = $("#email"); if (campo) campo.focus();
}

// =============================================================================
// 4. LAYOUT E ROTAS
// =============================================================================
function aplicarMarca() {
  if (S.config.cor_destaque) {
    const raiz = document.documentElement.style;
    raiz.setProperty("--destaque", S.config.cor_destaque);
    // tons claros derivados da cor escolhida (fundo do item ativo e trilho dos gráficos)
    raiz.setProperty("--destaque-suave", `color-mix(in srgb, ${S.config.cor_destaque} 12%, #ffffff)`);
  }
  document.title = S.config.nome || "Portal";
}

/** Ícones de linha simples do menu (desenhados em SVG, herdam a cor do texto). */
const ICONES = {
  painel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  "minhas-configuracoes": '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v12h13V9"/><path d="M10 21v-6h4v6"/>',
  cerebro: '<path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z"/><path d="M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z"/>',
  conteudo: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  calendario: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
  produto: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  lancamento: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="m9 15-3-3c1.5-4 5-8 12-9-1 7-5 10.5-9 12z"/><circle cx="15" cy="9" r="1.5"/>',
  analise: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
  relatorios: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  "config-cliente": '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  onboarding: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  semana: '<path d="m3 6 2 2 3-3M3 13l2 2 3-3M11 6h10M11 13h10M11 20h10"/>',
  aprovar: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  gravar: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>',
  ideias: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  automacoes: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  resultados: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  jornada: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  recados: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z"/>',
  acervo: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  plano: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M9 11h6M9 15h4"/>',
  pesquisa: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  dados: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
};
function iconeSvg(id) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[id] || ICONES.painel}</svg>`;
}

/** Logo (portal/img). Se o arquivo não carregar, vira o marcador de texto "Portal" na serifa. */
function logoHtml(tipo = "menu") {
  const src = S.config.logo_url || "./img/logo-portal.png";
  return `<img class="logo-img logo-${tipo}" src="${esc(src)}" alt="${esc(S.config.nome || "Portal Social Media")}" data-falha-logo>`;
}
function simboloHtml() { return `<img class="simbolo-img" src="./img/simbolo-portal.png" alt="" data-falha-logo>`; }
function ligarFalhaLogo(raiz = document) {
  $$("img[data-falha-logo]", raiz).forEach((img) => {
    const trocar = () => {
      console.warn("Faltam os arquivos da logo em portal/img (logo-portal.png e simbolo-portal.png).");
      const t = document.createElement("span"); t.className = "marca-texto marcador-logo"; t.textContent = "Portal"; img.replaceWith(t);
    };
    if (img.complete && img.naturalWidth === 0) trocar(); else img.addEventListener("error", trocar, { once: true });
  });
}

/** Marca em texto: primeira palavra + ponto colorido + o resto (ex.: "portal.socialmedia"). */
function marcaHtml(nome, sub = "") {
  const partes = String(nome || "Portal").trim().toLowerCase().split(/\s+/);
  const texto = partes.length > 1 ? `${esc(partes[0])}<span class="ponto">.</span>${esc(partes.slice(1).join(""))}` : `${esc(partes[0])}<span class="ponto">.</span>`;
  return `<div class="marca-texto">${texto}${sub ? `<span class="marca-sub">${esc(sub)}</span>` : ""}</div>`;
}

async function carregarClientes() {
  try {
    S.clientes = ehSM() ? await D.lista("clientes", { ordem: "nome" }) : await D.lista("clientes", { eq: { id: S.usuario.cliente_id } });
  } catch (e) { S.clientes = []; avisar(erroAmigavel(e), "erro"); }
  if (!ehSM()) S.clienteId = S.usuario.cliente_id;
  else if (!S.clientes.find((c) => c.id === S.clienteId)) {
    let salvo = null;
    try { salvo = localStorage.getItem("portal-cliente"); } catch (_) { /* sem storage */ }
    S.clienteId = (S.clientes.find((c) => c.id === salvo) || {}).id || null;
  }
}

async function abrirPortal() {
  aplicarMarca();
  await carregarClientes();
  if (!S.ouvindo) {   // registra os eventos uma vez só (mesmo depois de sair e entrar de novo)
    window.addEventListener("hashchange", rotear);
    window.addEventListener("beforeunload", (ev) => { if (S.sujo) { ev.preventDefault(); ev.returnValue = ""; } });
    S.ouvindo = true;
  }
  // Volta do login do Meta (botão opcional)
  let retorno = null, cancelado = null;
  try { retorno = sessionStorage.getItem("ig-oauth-retorno"); cancelado = sessionStorage.getItem("ig-oauth-cancelado"); } catch (_) { /* sem storage */ }
  if (cancelado) { try { sessionStorage.removeItem("ig-oauth-cancelado"); } catch (_) { /* nada */ } avisar("A conexão foi cancelada. Você pode tentar de novo quando quiser."); }
  if (retorno) { await concluirConexaoMeta(JSON.parse(retorno)); return; }
  rotear();
}

async function concluirConexaoMeta(ret) {
  try { sessionStorage.removeItem("ig-oauth-retorno"); } catch (_) { /* nada */ }
  $("#app").innerHTML = `<div class="tela-cheia-centro"><p class="suave">Conectando seu Instagram...</p></div>`;
  try {
    const r = await D.funcao("ig-oauth-callback", ret);
    avisar(`Instagram conectado${r.username ? ": @" + r.username : ""}.`, "ok");
    if (r.aviso) avisar(r.aviso);
  } catch (e) { avisar(erroAmigavel(e), "erro"); }
  await carregarClientes();
  location.hash = ehSM() ? "#/instagram/contas" : "#/plano";
  rotear();
}

/** Monta topo + menu lateral e devolve o elemento do conteúdo. */
function moldura(telaId) {
  const c = clienteAtual();
  const nome = S.config.nome || "Portal";
  const logo = S.config.logo_url ? `<img src="${esc(S.config.logo_url)}" alt="">` : esc(nome.slice(0, 1));
  let menu = "";
  if (ehSM()) {
    menu += `<a href="#/painel" class="${telaId === "painel" ? "ativo" : ""}"><span class="icone">${iconeSvg("painel")}</span>Painel geral</a>`;
    menu += `<a href="#/minhas-configuracoes" class="${telaId === "minhas-configuracoes" ? "ativo" : ""}"><span class="icone">${iconeSvg("minhas-configuracoes")}</span>Minhas configurações</a>`;
    if (c) {
      menu += `<div class="grupo">${esc(c.nome)}</div>`;
      menu += TELAS_SM.map((t) => `<a href="#/${t.id}" class="${telaId === t.id ? "ativo" : ""}"><span class="icone">${iconeSvg(t.id)}</span>${esc(t.nome)}</a>`).join("");
    }
  } else if (c) {
    const visiveis = TELAS_CLIENTE.filter((t) => (c.telas_visiveis || []).includes(t.id));
    menu += visiveis.map((t) => `<a href="#/${t.id}" class="${telaId === t.id ? "ativo" : ""}"><span class="icone">${iconeSvg(t.id)}</span>${esc(t.nome)}</a>`).join("");
  }
  menu += `<div class="grupo">Conta</div><a href="#" id="btn-sair"><span class="icone">${iconeSvg("sair")}</span>Sair</a>`;
  if (S.modo === "local") menu += `<p class="suave" style="font-size:12px;padding:10px">Modo de teste local. Para colocar no ar, siga o LEIA-ME.</p>`;

  const seletor = ehSM() ? `<select id="seletor-cliente" aria-label="Cliente">
      <option value="">${S.clientes.length ? "Escolha um cliente" : "Nenhum cliente ainda"}</option>
      ${S.clientes.map((x) => `<option value="${esc(x.id)}" ${x.id === S.clienteId ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>` : "";

  const inicial = esc(String(S.usuario.nome || S.usuario.email || "?").trim().slice(0, 1).toUpperCase());
  $("#app").innerHTML = `
    <div class="layout">
      <nav class="lateral" id="lateral"><a class="lateral-marca" href="#/${ehSM() ? "painel" : ""}" aria-label="Início">${logoHtml("menu")}</a>${menu}</nav>
      <div class="fundo-lateral escondido" id="fundo-lateral"></div>
      <div class="coluna">
        <header class="topo"><button class="btn-menu" id="btn-menu" aria-label="Menu">☰</button><span class="so-celular">${simboloHtml()}</span>
          <div class="espaco"></div>${seletor}<span class="avatar-usuario" title="${esc(S.usuario.nome || S.usuario.email || "")}">${inicial}</span></header>
        <main class="conteudo" id="conteudo"><p class="suave">Carregando...</p></main>
      </div>
    </div>`;
  ligarFalhaLogo();
  void logo; void nome;
  $("#btn-menu").onclick = () => { $("#lateral").classList.toggle("aberta"); $("#fundo-lateral").classList.toggle("escondido"); };
  $("#fundo-lateral").onclick = () => { $("#lateral").classList.remove("aberta"); $("#fundo-lateral").classList.add("escondido"); };
  $("#btn-sair").onclick = (ev) => { ev.preventDefault(); sair(); };
  const sel = $("#seletor-cliente");
  if (sel) sel.onchange = async () => {
    if (S.sujo && !(await confirmar("Você tem alterações não salvas. Trocar de cliente mesmo assim?", "Trocar", true))) { sel.value = S.clienteId || ""; return; }
    S.sujo = false;
    S.clienteId = sel.value || null;
    try { localStorage.setItem("portal-cliente", S.clienteId || ""); } catch (_) { /* sem storage */ }
    location.hash = S.clienteId ? "#/inicio" : "#/painel";
    rotear();
  };
  return $("#conteudo");
}

const ROTAS = {};   // preenchido pelas seções 5, 6 e 7

let rotaAnterior = location.hash;
async function rotear() {
  if (!S.usuario) return;
  // Aviso de alteração não salva ao navegar
  if (S.sujo && location.hash !== rotaAnterior) {
    const ok = await confirmar("Você tem alterações não salvas. Sair desta tela mesmo assim?", "Sair sem salvar", true);
    if (!ok) { history.replaceState(null, "", rotaAnterior); return; }
    S.sujo = false;
  }
  rotaAnterior = location.hash;
  const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  let tela = partes[0] || "";
  const c = clienteAtual();

  if (ehSM()) {
    // Sem cliente escolhido (ou sem nenhum cliente): só o Painel geral. Nunca o onboarding do cliente.
    const deCliente = TELAS_SM.some((t) => t.id === tela);
    if (!tela || (deCliente && !c) || (!ROTAS[tela] && tela !== "minhas-configuracoes")) tela = "painel";
  } else {
    if (!c) { $("#app").innerHTML = `<div class="tela-cheia-centro"><div class="caixa-login"><p>Não encontrei o seu cadastro. Fale com a sua social media.</p></div></div>`; return; }
    const visiveis = (c.telas_visiveis || []).filter((t) => ROTAS["c-" + t]);
    let ob = null;
    try { ob = await D.um("onboarding", { eq: { cliente_id: c.id } }); } catch (_) { ob = null; }
    const pendenteOnboarding = visiveis.includes("onboarding") && (!ob || ob.status === "rascunho");
    if (!tela) tela = pendenteOnboarding ? "onboarding" : visiveis.includes("semana") ? "semana" : visiveis[0];
    if (!visiveis.includes(tela)) tela = visiveis[0] || "semana";
  }
  S.telaAtual = tela;
  const alvo = moldura(tela);
  $("#lateral").classList.remove("aberta");
  const fn = ehSM() ? ROTAS[tela] : ROTAS["c-" + tela];
  try {
    await fn(alvo, partes.slice(1));
  } catch (e) {
    console.error(e);
    alvo.innerHTML = `<div class="vazio">Não consegui carregar esta tela. ${esc(erroAmigavel(e))}</div>`;
  }
  window.scrollTo(0, 0);
}

function cabecalho(titulo, sub = "", acoes = "") {
  return `<div class="cabecalho-tela"><div><h1>${esc(titulo)}</h1>${sub ? `<p class="suave">${sub}</p>` : ""}</div><div class="linha">${acoes}</div></div>`;
}
const vazio = (txt) => `<div class="vazio">${esc(txt)}</div>`;
const pilulaStatus = (s) => {
  const cls = { aprovado: "ok", publicado: "ok", agendado: "info", aprovacao: "alerta", ajuste: "erro" }[s] || "";
  return `<span class="pilula ${cls}">${esc(nomeStatus(s))}</span>`;
};

/** Resolve as URLs das mídias de um post (local: src; real: URL assinada do bucket). */
async function urlsMidias(post) {
  const lista = Array.isArray(post.midias) ? post.midias : [];
  const out = [];
  for (const m of lista) {
    if (m.src) out.push({ tipo: m.tipo, src: m.src });
    else if (m.url) out.push({ tipo: m.tipo, src: m.url });
    else if (m.caminho) out.push({ tipo: m.tipo, src: await D.urlArquivo("midias", m.caminho) });
  }
  return out;
}

/** Gráfico de barras em SVG (hover mostra o número). */
function graficoBarras(pontos, rotulo = "") {
  if (!pontos || !pontos.length) return vazio("Sem dados para mostrar ainda.");
  const W = 600, H = 180, pad = 24, max = Math.max(1, ...pontos.map((p) => p.valor));
  const bw = (W - pad * 2) / pontos.length;
  const barras = pontos.map((p, i) => {
    const h = (p.valor / max) * (H - pad * 2);
    const x = pad + i * bw + 2, w = Math.max(2, bw - 4);
    // trilho claro (altura toda) atrás da barra com o valor
    return `<rect class="trilho" x="${x}" y="${pad}" width="${w}" height="${H - pad * 2}" rx="3"></rect>
      <rect class="barra" x="${x}" y="${H - pad - h}" width="${w}" height="${h}" rx="3"><title>${fmtDataCurta(p.data)}: ${fmtNum(p.valor)} ${esc(rotulo)}</title></rect>
      ${i % Math.max(1, Math.ceil(pontos.length / 10)) === 0 ? `<text x="${pad + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${fmtDataCurta(p.data)}</text>` : ""}`;
  }).join("");
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(rotulo)}">${barras}<text x="${pad}" y="14">máx. ${fmtNum(max)}</text></svg>`;
}
/** Linha de resumo de uma série: média por dia e o dia de pico. */
function resumoSerie(pontos, prefixoPico = "") {
  if (!pontos || !pontos.length) return "";
  const total = pontos.reduce((s, p) => s + p.valor, 0);
  const pico = pontos.reduce((a, p) => (p.valor > a.valor ? p : a), pontos[0]);
  const dia = DIAS_SEMANA[new Date(pico.data + "T12:00:00").getDay()];
  return `<p class="resumo-serie">média <strong>${(total / pontos.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia</strong> · pico <strong>${prefixoPico}${fmtNum(pico.valor)}</strong> em ${dia}, ${fmtDataCurta(pico.data)}</p>`;
}

function graficoLinha(pontos, rotulo = "") {
  if (!pontos || !pontos.length) return vazio("Sem dados para mostrar ainda.");
  const W = 600, H = 180, pad = 24, max = Math.max(1, ...pontos.map((p) => p.valor));
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, pontos.length - 1);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const pts = pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ");
  const bolas = pontos.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.valor)}" r="4"><title>${fmtDataCurta(p.data)}: ${fmtNum(p.valor)} ${esc(rotulo)}</title></circle>`).join("");
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(rotulo)}"><polyline points="${pts}"/>${bolas}<text x="${pad}" y="14">máx. ${fmtNum(max)}</text></svg>`;
}

/** Régua de métricas (orientação, nunca garantia). */
function regua(tipo, valor) {
  if (valor == null || isNaN(valor)) return { classe: "", texto: "sem dado" };
  const r = { seg100: [0.5, 1.5], compart: [0.5, 2], salv: [1, 3] }[tipo];
  if (!r) return { classe: "", texto: "" };
  if (valor < r[0]) return { classe: "regua-fraco", texto: "fraco" };
  if (valor <= r[1]) return { classe: "regua-bom", texto: "bom" };
  return { classe: "regua-otimo", texto: "ótimo" };
}
function taxa(a, b) { return b ? (Number(a || 0) / Number(b)) * 100 : null; }
function fmtTaxa(v) { return v == null ? "sem dado" : v.toFixed(2).replace(".", ",") + (v >= 0 ? "" : ""); }

/** Itens da semana de um cliente (dados reais): usado no Painel geral, no Início e na Minha semana. */
async function pendenciasDaSemana(clienteId) {
  const hoje = hojeISO(), fim = somarDias(hoje, 7);
  const [posts, briefings, relatorios] = await Promise.all([
    D.lista("posts", { eq: { cliente_id: clienteId }, in: { status: ["aprovacao", "producao", "revisao", "ajuste"] }, ordem: "data" }),
    D.lista("briefings", { eq: { cliente_id: clienteId, status: "pendente" }, ordem: "prazo" }),
    ehSM() ? D.lista("relatorios", { eq: { cliente_id: clienteId } }) : Promise.resolve([]),
  ]);
  const mesPassado = somarDias(hoje.slice(0, 8) + "01", -1).slice(0, 7);
  return {
    aprovacao: posts.filter((p) => p.status === "aprovacao"),
    aprovacaoSemana: posts.filter((p) => p.status === "aprovacao" && p.prazo_aprovacao && p.prazo_aprovacao >= hoje && p.prazo_aprovacao <= fim),
    atrasadas: posts.filter((p) => p.status === "aprovacao" && p.prazo_aprovacao && p.prazo_aprovacao < hoje),
    briefings,
    briefingsSemana: briefings.filter((b) => !b.prazo || b.prazo <= fim),
    emAndamento: posts.filter((p) => p.status !== "aprovacao"),
    relatorioPendente: ehSM() && !relatorios.some((r) => r.mes === mesPassado && r.publicado) ? mesPassado : null,
  };
}

/** Etapa do mês, deduzida dos status dos posts do mês. */
function etapaDoMes(posts) {
  const m = mesAtual();
  const doMes = posts.filter((p) => String(p.data).startsWith(m));
  if (!doMes.length) return "planejamento";
  const tem = (s) => doMes.some((p) => p.status === s);
  if (tem("pauta") || tem("producao")) return "produção";
  if (tem("revisao")) return "revisão";
  if (tem("aprovacao")) return "aprovação";
  if (tem("ajuste")) return "ajustes";
  if (doMes.every((p) => p.status === "publicado")) return "fechamento";
  return "agendamento";
}

// =============================================================================
// 5. VISÃO DA SOCIAL MEDIA
// =============================================================================

// ---------------------------------------------------------------- Painel geral
ROTAS.painel = async (el) => {
  const ativos = S.clientes.filter((c) => c.status === "ativo");
  const hoje = hojeISO(), em30 = somarDias(hoje, 30);
  const faturamento = ativos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
  const vencendo = S.clientes.filter((c) => c.contrato_fim && c.contrato_fim >= hoje && c.contrato_fim <= em30);

  if (!S.clientes.length) {
    el.innerHTML = cabecalho("Painel geral", "Tudo o que está acontecendo com os seus clientes.", `<button class="btn primario" id="ativar">+ Ativar novo cliente</button>`) +
      `<div class="vazio"><p><strong>Nenhum cliente ainda.</strong></p><p>Clique em "Ativar novo cliente" para cadastrar o primeiro e mandar o convite.</p></div>`;
    $("#ativar").onclick = modalAtivarCliente;
    return;
  }

  el.innerHTML = cabecalho("Painel geral", "Tudo o que está acontecendo com os seus clientes.", `<button class="btn primario" id="ativar">+ Ativar novo cliente</button>`) +
    `<div id="alertas"></div>
    <div class="grade quatro" style="margin-bottom:16px">
      <div class="kpi"><div class="numero-grande">${ativos.length}</div><small>clientes ativos</small></div>
      <div class="kpi"><div class="numero-grande">${fmtMoeda(faturamento)}</div><small>faturamento mensal (ativos)</small></div>
      <div class="kpi"><div class="numero-grande" id="k-atrasadas">...</div><small>aprovações atrasadas</small></div>
      <div class="kpi"><div class="numero-grande">${vencendo.length}</div><small>contratos que vencem em 30 dias</small></div>
    </div>
    <div class="cartao"><h2>Clientes</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Cliente</th><th>Status</th><th>Fase</th><th>Etapa do mês</th><th>Próximo marco</th><th class="num">Valor</th></tr></thead><tbody id="tb-clientes"></tbody></table></div></div>
    <div class="cartao"><h2>Prazos da semana</h2><div id="prazos"><p class="suave">Carregando...</p></div></div>
    ${vencendo.length ? `<div class="cartao"><h2>Contratos que vencem em 30 dias</h2>${vencendo.map((c) => `<p>${esc(c.nome)}: ${fmtData(c.contrato_fim)}</p>`).join("")}</div>` : ""}`;
  $("#ativar").onclick = modalAtivarCliente;

  // Alertas de volume das automações
  try {
    const alertas = await D.lista("ig_alertas", { eq: { visto: false }, ordem: "-created_at", limite: 10 });
    $("#alertas").innerHTML = alertas.map((a) => `<div class="faixa alerta">${a.tipo === "cliente" ? "🔔" : "⚠️"} ${esc(a.mensagem)} <button class="btn pequeno" data-visto="${esc(a.id)}">Entendi</button></div>`).join("");
    $$("[data-visto]", el).forEach((b) => b.onclick = async () => { await D.atualizar("ig_alertas", { id: b.dataset.visto }, { visto: true }); b.parentElement.remove(); });
  } catch (_) { /* sem alertas */ }

  // Dados reais de cada cliente
  let totalAtrasadas = 0;
  const linhasClientes = [], blocosPrazos = [];
  for (const c of S.clientes) {
    let posts = [], pend = null;
    try {
      posts = await D.lista("posts", { eq: { cliente_id: c.id }, gte: { data: mesAtual() + "-01" } });
      pend = await pendenciasDaSemana(c.id);
    } catch (_) { pend = null; }
    const fase = FASES[c.fase_ciclo || 0];
    linhasClientes.push(`<tr class="clicavel" data-cli="${esc(c.id)}"><td><strong>${esc(c.nome)}</strong><br><small>${esc(c.instagram || "")}</small></td>
      <td>${esc(c.status)}</td><td>${fase.n}. ${esc(fase.nome)}</td><td>${esc(etapaDoMes(posts))}</td>
      <td>${esc((c.proximo_marco || {}).texto || "")}${(c.proximo_marco || {}).data ? ` <small>(${fmtDataCurta(c.proximo_marco.data)})</small>` : ""}</td><td class="num">${fmtMoeda(c.valor_mensal)}</td></tr>`);
    if (pend) {
      totalAtrasadas += pend.atrasadas.length;
      const itens = [
        ...pend.atrasadas.map((p) => `<li><span class="pilula erro">atrasada</span> Aprovação de "${esc(p.tema)}" (prazo ${fmtDataCurta(p.prazo_aprovacao)})</li>`),
        ...pend.aprovacaoSemana.map((p) => `<li><span class="pilula alerta">aprovação</span> "${esc(p.tema)}" até ${fmtDataCurta(p.prazo_aprovacao)}</li>`),
        ...pend.briefingsSemana.map((b) => `<li><span class="pilula info">gravação</span> Briefing pendente${b.prazo ? ` até ${fmtDataCurta(b.prazo)}` : ""}</li>`),
        ...(pend.relatorioPendente ? [`<li><span class="pilula">relatório</span> Relatório de ${esc(nomeMes(pend.relatorioPendente))} não publicado</li>`] : []),
      ];
      if (itens.length) blocosPrazos.push(`<h3>${esc(c.nome)}</h3><ul>${itens.join("")}</ul>`);
    }
  }
  $("#tb-clientes").innerHTML = linhasClientes.join("");
  $("#k-atrasadas").textContent = totalAtrasadas;
  $("#prazos").innerHTML = blocosPrazos.join("") || `<p class="suave">Nada com prazo nos próximos 7 dias.</p>`;
  $$("[data-cli]", el).forEach((tr) => tr.onclick = () => {
    S.clienteId = tr.dataset.cli;
    try { localStorage.setItem("portal-cliente", S.clienteId); } catch (_) { /* sem storage */ }
    location.hash = "#/inicio";
  });
};

function modalAtivarCliente() {
  const m = abrirModal("Ativar novo cliente", `<form id="f-ativar">
    <div class="grade-form">
      <div><label>Nome do cliente</label><input type="text" id="a-nome" required></div>
      <div><label>Identificador (slug)</label><input type="text" id="a-slug" required placeholder="nome-do-cliente"><small>Mesmo nome da pasta clientes/&lt;slug&gt;.</small></div>
      <div><label>E-mail do cliente (para o convite)</label><input type="email" id="a-email" required></div>
      <div><label>@ do Instagram</label><input type="text" id="a-ig" placeholder="@perfil"></div>
      <div><label>Plano</label><select id="a-plano"><option>Essencial</option><option selected>Crescimento</option><option>Completo</option></select></div>
      <div><label>Valor mensal (R$)</label><input type="number" id="a-valor" min="0" step="0.01"></div>
    </div>
    <div class="modal-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Criar e enviar convite</button></div></form>`);
  $("#a-nome", m).oninput = () => { $("#a-slug", m).value = slugify($("#a-nome", m).value); };
  $("#f-ativar", m).onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("button.primario", m); btn.disabled = true; btn.textContent = "Enviando...";
    const slug = slugify($("#a-slug", m).value);
    try {
      const r = await D.funcao("client-invite", { nome: $("#a-nome", m).value.trim(), slug, email: $("#a-email", m).value.trim(),
        instagram: $("#a-ig", m).value.trim(), plano: $("#a-plano", m).value, valor_mensal: Number($("#a-valor", m).value) || null,
        redirect_to: location.origin + location.pathname });
      await carregarClientes();
      S.clienteId = r.cliente_id;
      abrirModal("Cliente ativado", `<div class="faixa ok">${esc(r.mensagem || "Convite enviado.")}</div>
        <p>Agora duplique a pasta modelo no seu computador, na raiz do sistema:</p>
        <p><strong>Windows (PowerShell):</strong></p><pre><code>Copy-Item -Recurse clientes\\_modelo clientes\\${esc(r.slug || slug)}</code></pre>
        <p><strong>Mac ou Linux:</strong></p><pre><code>cp -r clientes/_modelo clientes/${esc(r.slug || slug)}</code></pre>
        <div class="modal-rodape"><button class="btn primario" data-fechar>Abrir o cliente</button></div>`);
      location.hash = "#/config-cliente";
      rotear();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Criar e enviar convite";
      avisar(erroAmigavel(e), "erro");
      await carregarClientes();
    }
  };
}

// ---------------------------------------------------------------- Minhas configurações
ROTAS["minhas-configuracoes"] = async (el) => {
  const c = (await D.um("configuracoes", { eq: { id: 1 } })) || { id: 1 };
  el.innerHTML = cabecalho("Minhas configurações", "Nome, logo e cor que aparecem para os seus clientes.") + `<form class="cartao" id="f-cfg">
    <div class="grade-form">
      <div><label>Seu nome ou marca</label><input type="text" id="c-nome" value="${esc(c.nome || "")}"></div>
      <div><label>Link do logo (imagem)</label><input type="url" id="c-logo" value="${esc(c.logo_url || "")}" placeholder="https://..."></div>
      <div><label>Cor de destaque</label><input type="text" id="c-cor" value="${esc(c.cor_destaque || "#4F46E5")}" placeholder="#4F46E5"></div>
      <div><label>WhatsApp de contato (só números, com DDI)</label><input type="text" id="c-whats" value="${esc(c.whatsapp || "")}" placeholder="5511900000000"></div>
    </div>
    <label>Texto de boas-vindas</label><textarea id="c-boas">${esc(c.texto_boas_vindas || "")}</textarea>
    <label>Observações internas (o cliente nunca vê)</label><textarea id="c-obs">${esc(c.observacoes_internas || "")}</textarea>
    <div class="modal-rodape"><button class="btn primario">Salvar</button></div></form>`;
  $("#f-cfg").onsubmit = async (ev) => {
    ev.preventDefault();
    const cor = $("#c-cor").value.trim();
    if (cor && !/^#[0-9a-fA-F]{6}$/.test(cor)) { avisar("A cor precisa estar no formato #RRGGBB.", "erro"); return; }
    try {
      const novo = await D.upsert("configuracoes", { id: 1, nome: $("#c-nome").value.trim(), logo_url: $("#c-logo").value.trim() || null, cor_destaque: cor || "#4F46E5",
        whatsapp: $("#c-whats").value.replace(/\D/g, ""), texto_boas_vindas: $("#c-boas").value, observacoes_internas: $("#c-obs").value }, "id");
      S.config = novo || S.config;
      aplicarMarca();
      avisar("Configurações salvas.", "ok");
      rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// ---------------------------------------------------------------- Início do cliente
ROTAS.inicio = async (el) => {
  const c = clienteAtual();
  const fase = FASES[c.fase_ciclo || 0];
  const [pend, leads, autos, postsMes] = await Promise.all([
    pendenciasDaSemana(c.id),
    D.contar("ig_leads", { eq: { cliente_id: c.id } }).catch(() => 0),
    D.lista("ig_automations", { eq: { cliente_id: c.id } }).catch(() => []),
    D.lista("posts", { eq: { cliente_id: c.id }, gte: { data: mesAtual() + "-01" } }),
  ]);
  const doMes = postsMes.filter((p) => String(p.data).startsWith(mesAtual()));
  const autosVip = autos.filter((a) => a.modelo === "captacao_vip").map((a) => a.id);
  const vip = autosVip.length ? await D.contar("ig_leads", { eq: { cliente_id: c.id }, in: { automation_id: autosVip } }).catch(() => 0) : 0;
  const escopoMes = Number((c.escopo || {}).posts_semana || 0) * 4;
  const entregues = doMes.filter((p) => ["aprovado", "agendado", "publicado"].includes(p.status)).length;
  const tarefas = [
    ...pend.atrasadas.map((p) => `<li><span class="pilula erro">atrasada</span> Cobrar aprovação de "${esc(p.tema)}"</li>`),
    ...pend.aprovacaoSemana.map((p) => `<li><span class="pilula alerta">aprovação</span> "${esc(p.tema)}" até ${fmtDataCurta(p.prazo_aprovacao)}</li>`),
    ...pend.briefingsSemana.map((b) => `<li><span class="pilula info">gravação</span> Briefing pendente${b.prazo ? ` até ${fmtDataCurta(b.prazo)}` : ""}</li>`),
    ...pend.emAndamento.filter((p) => p.data <= somarDias(hojeISO(), 7)).map((p) => `<li>${pilulaStatus(p.status)} "${esc(p.tema)}" (${fmtDataCurta(p.data)})</li>`),
    ...(pend.relatorioPendente ? [`<li><span class="pilula">relatório</span> Publicar o relatório de ${esc(nomeMes(pend.relatorioPendente))}</li>`] : []),
  ];
  el.innerHTML = cabecalho(c.nome, esc(c.instagram || ""), `<a class="btn" href="#/config-cliente">Configurações</a>`) + `
    <div class="grade duas">
      <div class="cartao"><h2>Fase ${fase.n}: ${esc(fase.nome)}</h2><p class="suave">${esc(fase.rodizio)}</p>
        <p><strong>Próximo marco:</strong> ${esc((c.proximo_marco || {}).texto || "não definido")} ${(c.proximo_marco || {}).data ? `(${fmtData(c.proximo_marco.data)})` : ""}</p></div>
      <div class="cartao"><h2>Tarefas da semana</h2>${tarefas.length ? `<ul>${tarefas.join("")}</ul>` : `<p class="suave">Nada pendente para os próximos 7 dias.</p>`}</div>
    </div>
    <div class="grade quatro">
      <div class="kpi"><div class="numero-grande">${leads}</div><small>leads (Instagram)</small></div>
      <div class="kpi"><div class="numero-grande">${vip}</div><small>na lista VIP</small></div>
      <div class="kpi"><div class="numero-grande">${autos.filter((a) => a.active).length}</div><small>automações ativas</small></div>
      <div class="kpi"><div class="numero-grande">${doMes.length}</div><small>posts no mês</small></div>
    </div>
    <div class="cartao" style="margin-top:16px"><h2>Entregas x escopo</h2>
      <p>${entregues} de ${escopoMes || "?"} posts do mês aprovados, agendados ou publicados.</p>
      <div class="progresso"><div style="width:${escopoMes ? Math.min(100, (entregues / escopoMes) * 100) : 0}%"></div></div></div>`;
};

// ---------------------------------------------------------------- Cérebro da Marca
ROTAS.cerebro = async (el) => {
  const c = clienteAtual();
  const [ob, cer] = await Promise.all([D.um("onboarding", { eq: { cliente_id: c.id } }), D.um("cerebro", { eq: { cliente_id: c.id } })]);
  const resp = (ob && ob.respostas) || {};
  const conteudoMd = (cer && cer.conteudo_md) || "";
  const pend = PERGUNTAS_ONBOARDING.filter((q) => !String(resp[q.id] || "").trim() || normalizar(resp[q.id]).trim() === "nao sei ainda");
  el.innerHTML = cabecalho("Cérebro da Marca", "O documento-base de tudo o que é produzido para este cliente.") + `
    <div class="abas" id="abas-cer"><button class="ativa" data-a="cerebro">Cérebro</button><button data-a="onboarding">Onboarding (${pend.length} pendências)</button>
      <button data-a="pesquisa">Pesquisa de mercado</button><button data-a="regras">Regras da marca</button><button data-a="partida">Ponto de partida</button></div>
    <div id="aba-cer"></div>`;
  const abas = {
    cerebro: () => `<div class="cartao"><div class="linha" style="justify-content:space-between"><p class="suave">Versão ${cer ? cer.versao : 0}. Publicado pelo portal_sync.py ou editado aqui.</p>
        <button class="btn" id="editar-cer">Editar</button></div><div id="ver-cer">${conteudoMd ? md(conteudoMd) : vazio("Ainda sem Cérebro. Rode a skill cerebro-da-marca e depois portal_sync.py publicar-cerebro.")}</div></div>`,
    onboarding: () => `<div class="cartao"><div class="linha" style="justify-content:space-between"><p>Status: <strong>${esc(ob ? ob.status : "não começou")}</strong> · progresso ${ob ? ob.progresso : 0}%</p>
        ${ob && ob.status === "enviado" ? `<button class="btn primario" id="revisado">Marcar como revisado</button>` : ""}</div>
      ${PERGUNTAS_ONBOARDING.map((q) => { const r = String(resp[q.id] || "").trim(); const p = !r || normalizar(r) === "nao sei ainda";
        return `<div style="margin:10px 0"><strong>${q.id.slice(1)}. ${esc(q.texto)}</strong><br>${p ? `<span class="pendente">${esc(r || "sem resposta")}</span>` : esc(r)}
          ${resp[q.id + "_audio"] ? `<br><small>🎙️ resposta em áudio enviada</small>` : ""}</div>`; }).join("")}</div>`,
    pesquisa: () => `<div class="cartao">${md(secaoMd(conteudoMd, "### As 13") || secaoMd(conteudoMd, "## 2. Público")) || vazio("Sem pesquisa de mercado no Cérebro ainda.")}</div>`,
    regras: () => `<div class="cartao">${md([secaoMd(conteudoMd, "## 3. Voz"), secaoMd(conteudoMd, "## 9. Regras"), secaoMd(conteudoMd, "## Regras configuráveis")].filter(Boolean).join("\n\n")) || vazio("Sem regras no Cérebro ainda.")}</div>`,
    partida: () => { const p = c.ponto_de_partida || {}; return `<form class="cartao" id="f-partida"><div class="grade-form">
        <div><label>Seguidores</label><input type="number" id="pp-seg" value="${esc(p.seguidores ?? "")}"></div>
        <div><label>Alcance médio por post</label><input type="number" id="pp-alc" value="${esc(p.alcance_medio ?? "")}"></div>
        <div><label>Nota da bio (0 a 10)</label><input type="number" min="0" max="10" id="pp-bio" value="${esc(p.nota_bio ?? "")}"></div>
        <div><label>Data</label><input type="date" id="pp-data" value="${esc(p.data || "")}"></div></div>
        <div class="modal-rodape"><button class="btn primario">Salvar ponto de partida</button></div></form>`; },
  };
  const mostrar = (a) => {
    $$("#abas-cer button").forEach((b) => b.classList.toggle("ativa", b.dataset.a === a));
    $("#aba-cer").innerHTML = abas[a]();
    if (a === "cerebro") $("#editar-cer").onclick = () => {
      $("#ver-cer").innerHTML = `<textarea class="grande" id="txt-cer" style="min-height:420px">${esc(conteudoMd)}</textarea><div class="modal-rodape"><button class="btn primario" id="salvar-cer">Salvar nova versão</button></div>`;
      $("#txt-cer").oninput = () => { S.sujo = true; };
      $("#salvar-cer").onclick = async () => {
        try { await D.upsert("cerebro", { cliente_id: c.id, conteudo_md: $("#txt-cer").value, versao: (cer ? cer.versao : 0) + 1 }, "cliente_id"); S.sujo = false; avisar("Cérebro salvo.", "ok"); rotear(); }
        catch (e) { avisar(erroAmigavel(e), "erro"); }
      };
    };
    if (a === "onboarding" && $("#revisado")) $("#revisado").onclick = async () => {
      try { await D.atualizar("onboarding", { cliente_id: c.id }, { status: "revisado", pendencias: pend.map((q) => q.id) }); avisar("Onboarding marcado como revisado.", "ok"); rotear(); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
    if (a === "partida") $("#f-partida").onsubmit = async (ev) => {
      ev.preventDefault();
      const pp = { seguidores: Number($("#pp-seg").value) || null, alcance_medio: Number($("#pp-alc").value) || null, nota_bio: Number($("#pp-bio").value) || null, data: $("#pp-data").value || null };
      try { await D.atualizar("clientes", { id: c.id }, { ponto_de_partida: pp }); c.ponto_de_partida = pp; avisar("Ponto de partida salvo.", "ok"); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  $$("#abas-cer button").forEach((b) => b.onclick = () => mostrar(b.dataset.a));
  mostrar("cerebro");
};

// ---------------------------------------------------------------- Conteúdo
ROTAS.conteudo = async (el) => {
  const c = clienteAtual();
  const [ideias, geracoes, prompts, cer, posts] = await Promise.all([
    D.lista("ideias", { eq: { cliente_id: c.id }, ordem: "-created_at" }),
    D.lista("geracoes", { eq: { cliente_id: c.id }, ordem: "-created_at", limite: 50 }),
    D.lista("prompts_modelo", { ordem: "tarefa" }),
    D.um("cerebro", { eq: { cliente_id: c.id } }),
    D.lista("posts", { eq: { cliente_id: c.id }, gte: { data: somarDias(hojeISO(), -30) }, ordem: "data" }),
  ]);
  const ganchos = geracoes.filter((g) => g.tarefa === "perguntas-gancho");
  el.innerHTML = cabecalho("Conteúdo", "Ganchos, ideias do cliente, modelos de YAP e o plano B de geração.") + `
    <div class="abas" id="abas-ct"><button class="ativa" data-a="ganchos">Banco de ganchos</button><button data-a="ideias">Ideias do cliente (${ideias.filter((i) => i.status === "nova").length})</button>
      <button data-a="yap">Modelos de YAP</button><button data-a="prompt">Copiar prompt (plano B)</button></div><div id="aba-ct"></div>`;
  const abas = {
    ganchos: () => `<div class="cartao"><p class="suave">As perguntas-gancho salvas pelo plano B (tarefa "20 perguntas-gancho") aparecem aqui. O arquivo completo fica em clientes/&lt;cliente&gt;/banco-de-ganchos.md.</p>
      ${ganchos.length ? ganchos.map((g) => `<div class="cartao plano"><small>${fmtData(g.created_at)}</small><pre>${esc(g.resposta_colada)}</pre></div>`).join("") : vazio("Nenhum gancho salvo ainda.")}</div>`,
    ideias: () => ideias.length ? `<div class="lista-acoes">${ideias.map((i) => `<div class="cartao plano"><div class="linha" style="justify-content:space-between">
        <small>${fmtData(i.created_at)} · ${i.tipo === "audio" ? "🎙️ áudio" : "texto"}</small><span class="pilula ${i.status === "nova" ? "info" : ""}">${esc({ nova: "nova", virou_pauta: "virou pauta", arquivada: "arquivada" }[i.status])}</span></div>
        <p>${esc(i.conteudo || "")}</p>${i.audio_url ? `<audio controls data-audio="${esc(i.audio_url)}"></audio>` : ""}
        ${i.status === "nova" ? `<div class="linha"><button class="btn pequeno primario" data-pauta="${esc(i.id)}">Virou pauta</button><button class="btn pequeno" data-arq="${esc(i.id)}">Arquivar</button></div>` : ""}</div>`).join("")}</div>` : vazio("Nenhuma ideia ainda."),
    yap: () => `<div class="cartao">${md(YAP_MODELOS_MD)}<p class="suave">Preencha em referencias/metodo/yap-modelos.md.</p></div>`,
    prompt: () => `<div class="cartao"><div class="grade-form">
        <div><label>Tarefa</label><select id="p-tarefa">${prompts.map((p) => `<option value="${esc(p.tarefa)}">${esc((p.texto.match(/^# (.+)$/m) || [, p.tarefa])[1])}</option>`).join("")}</select></div>
        <div><label>Post (opcional)</label><select id="p-post"><option value="">Nenhum</option>${posts.map((p) => `<option value="${esc(p.id)}">${fmtDataCurta(p.data)} ${esc(p.tema)}</option>`).join("")}</select></div>
        <div><label>Tema</label><input type="text" id="p-tema"></div><div><label>Gancho escolhido</label><input type="text" id="p-gancho"></div></div>
        <label>Material do cliente (áudio transcrito, ideias, comentários)</label><textarea id="p-material">${esc(ideias.filter((i) => i.status === "nova").map((i) => "- " + (i.conteudo || "")).join("\n"))}</textarea>
        <label>Prompt pronto</label><textarea class="grande" id="p-texto" readonly></textarea>
        <div class="linha"><button class="btn primario" id="p-copiar">Copiar prompt</button><small>Cole no Claude e traga a resposta de volta.</small></div>
        <label>Cole aqui a resposta</label><textarea class="grande" id="p-resposta"></textarea>
        <div class="modal-rodape"><button class="btn primario" id="p-salvar">Salvar resposta</button></div></div>`,
  };
  const montarPrompt = () => {
    const p = prompts.find((x) => x.tarefa === $("#p-tarefa").value);
    if (!p) return;
    const cm = (cer && cer.conteudo_md) || "(Cérebro da Marca ainda não publicado)";
    const vals = { nome_cliente: c.nome, cerebro: cm, publico: secaoMd(cm, "## 2. Público") || "(ver Cérebro)", voz: secaoMd(cm, "## 3. Voz") || "(ver Cérebro)",
      tema: $("#p-tema").value || "(definir)", gancho: $("#p-gancho").value || "(definir)", fase_ciclo: `${c.fase_ciclo}. ${FASES[c.fase_ciclo || 0].nome}`, material_cliente: $("#p-material").value || "(sem material: peça ao cliente)" };
    $("#p-texto").value = p.texto.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vals ? vals[k] : `{{${k}}}`));
  };
  const mostrar = (a) => {
    $$("#abas-ct button").forEach((b) => b.classList.toggle("ativa", b.dataset.a === a));
    $("#aba-ct").innerHTML = abas[a]();
    if (a === "ideias") {
      $$("[data-audio]").forEach(async (au) => { au.src = await D.urlArquivo("audios", au.dataset.audio); });
      $$("[data-pauta]").forEach((b) => b.onclick = async () => {
        const i = ideias.find((x) => x.id === b.dataset.pauta);
        try {
          const post = await D.inserir("posts", { cliente_id: c.id, data: somarDias(hojeISO(), 7), tema: (i.conteudo || "Ideia do cliente").slice(0, 80), status: "pauta", formato: "carrossel", midias: [] });
          await D.atualizar("ideias", { id: i.id }, { status: "virou_pauta", post_id: post.id });
          i.status = "virou_pauta"; avisar("Virou pauta no calendário.", "ok"); mostrar("ideias");
        } catch (e) { avisar(erroAmigavel(e), "erro"); }
      });
      $$("[data-arq]").forEach((b) => b.onclick = async () => { await D.atualizar("ideias", { id: b.dataset.arq }, { status: "arquivada" }); ideias.find((x) => x.id === b.dataset.arq).status = "arquivada"; mostrar("ideias"); });
    }
    if (a === "prompt") {
      if (!prompts.length) { $("#aba-ct").innerHTML = vazio("A biblioteca de prompts está vazia. Rode o 98-seed-prompts.sql."); return; }
      ["#p-tarefa", "#p-tema", "#p-gancho", "#p-material"].forEach((s) => $(s).oninput = montarPrompt);
      $("#p-tarefa").onchange = montarPrompt;
      $("#p-post").onchange = () => { const p = posts.find((x) => x.id === $("#p-post").value); if (p) { $("#p-tema").value = p.tema; } montarPrompt(); };
      montarPrompt();
      $("#p-copiar").onclick = async () => { try { await navigator.clipboard.writeText($("#p-texto").value); avisar("Prompt copiado.", "ok"); } catch (_) { $("#p-texto").select(); document.execCommand("copy"); avisar("Prompt copiado.", "ok"); } };
      $("#p-resposta").oninput = () => { S.sujo = !!$("#p-resposta").value.trim(); };
      $("#p-salvar").onclick = async () => {
        if (!$("#p-resposta").value.trim()) { avisar("Cole a resposta antes de salvar."); return; }
        try {
          await D.inserir("geracoes", { cliente_id: c.id, post_id: $("#p-post").value || null, tarefa: $("#p-tarefa").value, prompt_usado: $("#p-texto").value, resposta_colada: $("#p-resposta").value });
          S.sujo = false; avisar("Resposta salva.", "ok"); rotear();
        } catch (e) { avisar(erroAmigavel(e), "erro"); }
      };
    }
  };
  $$("#abas-ct button").forEach((b) => b.onclick = () => mostrar(b.dataset.a));
  mostrar("ganchos");
};

// ---------------------------------------------------------------- Calendário
ROTAS.calendario = async (el, args) => {
  const c = clienteAtual();
  let mes = (args[0] && /^\d{4}-\d{2}$/.test(args[0])) ? args[0] : mesAtual();
  let visao = "mes";
  const filtros = { formato: "", estrategia: "", status: "" };
  const desenhar = async () => {
    const ini = mes + "-01";
    const [a, m] = mes.split("-").map(Number);
    const fimMes = new Date(a, m, 0).toISOString().slice(0, 10);
    const todos = await D.lista("posts", { eq: { cliente_id: c.id }, gte: { data: somarDias(ini, -7) }, lte: { data: somarDias(fimMes, 7) }, ordem: "data" });
    const posts = todos.filter((p) => (!filtros.formato || p.formato === filtros.formato) && (!filtros.estrategia || p.estrategia === filtros.estrategia) && (!filtros.status || p.status === filtros.status));
    const mesAnt = new Date(a, m - 2, 1).toISOString().slice(0, 7), mesProx = new Date(a, m, 1).toISOString().slice(0, 7);
    let corpo = "";
    if (visao === "mes") {
      const primeiro = new Date(a, m - 1, 1);
      const inicioGrade = somarDias(ini, -primeiro.getDay());
      const celulas = [...Array(42)].map((_, i) => somarDias(inicioGrade, i));
      corpo = `<div class="cal-cab">${DIAS_SEMANA.map((d) => `<div>${d}</div>`).join("")}</div><div class="cal">${celulas.map((d) => `<div class="dia ${d.slice(0, 7) !== mes ? "fora" : ""} ${d === hojeISO() ? "hoje" : ""}">
        <div class="n">${Number(d.slice(8))}</div>${posts.filter((p) => p.data === d).map((p) => `<button class="chip st-${esc(p.status)}" data-post="${esc(p.id)}" title="${esc(p.tema)}">${esc(p.formato || "")} · ${esc(p.tema)}</button>`).join("")}</div>`).join("")}</div>`;
    } else if (visao === "semana") {
      const hoje = hojeISO(), inicioSem = somarDias(hoje, -new Date(hoje + "T12:00").getDay());
      corpo = [...Array(7)].map((_, i) => { const d = somarDias(inicioSem, i); const ps = posts.filter((p) => p.data === d);
        return `<div class="cartao plano"><strong>${DIAS_SEMANA[i]} ${fmtDataCurta(d)}</strong>${ps.length ? ps.map((p) => `<div class="cartao-post" data-post="${esc(p.id)}">${pilulaStatus(p.status)} ${esc(p.formato || "")} · ${esc(p.tema)}</div>`).join("") : `<p class="suave">Nada neste dia.</p>`}</div>`; }).join("");
    } else {
      const doMes = posts.filter((p) => p.data.startsWith(mes));
      corpo = `<div class="quadro">${STATUS_POST.map((s) => { const ps = doMes.filter((p) => p.status === s.id);
        return `<div class="coluna-quadro"><h4>${esc(s.nome)} <span class="pilula">${ps.length}</span></h4>${ps.map((p) => `<div class="cartao-post" data-post="${esc(p.id)}"><strong>${fmtDataCurta(p.data)}</strong> ${esc(p.tema)}<br><small>${esc(p.formato || "")} · ${esc(ESTRATEGIAS[p.estrategia] || p.estrategia || "")}</small></div>`).join("")}</div>`; }).join("")}</div>`;
    }
    const sel = (id, opcoes, atual, rotulo) => `<select id="${id}" style="width:auto"><option value="">${rotulo}</option>${Object.entries(opcoes).map(([k, v]) => `<option value="${esc(k)}" ${k === atual ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
    el.innerHTML = cabecalho("Calendário", esc(nomeMes(mes)), `<button class="btn" id="novo-post">+ Novo post</button>`) + `
      <div class="linha" style="margin-bottom:12px">
        <button class="btn pequeno" id="ant">‹</button><strong>${esc(nomeMes(mes))}</strong><button class="btn pequeno" id="prox">›</button>
        <span class="espaco"></span>
        <div class="opcoes-radio">${[["mes", "Mês"], ["semana", "Semana"], ["quadro", "Quadro por status"]].map(([v, n]) => `<label><input type="radio" name="visao" value="${v}" ${visao === v ? "checked" : ""}>${n}</label>`).join("")}</div>
      </div>
      <div class="linha" style="margin-bottom:12px">${sel("f-formato", { carrossel: "Carrossel", reels: "Reels", post: "Post", stories: "Stories" }, filtros.formato, "Todos os formatos")}
        ${sel("f-estr", ESTRATEGIAS, filtros.estrategia, "Todas as estratégias")}${sel("f-status", Object.fromEntries(STATUS_POST.map((s) => [s.id, s.nome])), filtros.status, "Todos os status")}</div>
      ${corpo}`;
    $("#ant").onclick = () => { mes = mesAnt; desenhar(); };
    $("#prox").onclick = () => { mes = mesProx; desenhar(); };
    $$("input[name=visao]").forEach((r) => r.onchange = () => { visao = r.value; desenhar(); });
    $("#f-formato").onchange = (e) => { filtros.formato = e.target.value; desenhar(); };
    $("#f-estr").onchange = (e) => { filtros.estrategia = e.target.value; desenhar(); };
    $("#f-status").onchange = (e) => { filtros.status = e.target.value; desenhar(); };
    $$("[data-post]", el).forEach((b) => b.onclick = () => abrirPostSM(todos.find((p) => p.id === b.dataset.post), desenhar));
    $("#novo-post").onclick = () => abrirPostSM({ cliente_id: c.id, data: hojeISO(), status: "pauta", tema: "", formato: "carrossel", versao: 1, midias: [] }, desenhar);
  };
  await desenhar();
};

async function abrirPostSM(p, depois) {
  const novo = !p.id;
  const [midias, aprov] = novo ? [[], []] : await Promise.all([urlsMidias(p), D.lista("aprovacoes", { eq: { post_id: p.id }, ordem: "-created_at" })]);
  const painel = abrirPainelLateral(`<div class="modal-topo"><h2>${novo ? "Novo post" : esc(p.tema)}</h2><button class="fechar" data-fechar>×</button></div>
    ${midias.length ? `<div class="slides" style="border-radius:10px;overflow:hidden;margin-bottom:10px">${midias.map((m) => m.tipo === "video" ? `<video src="${esc(m.src)}" controls></video>` : `<img src="${esc(m.src)}" alt="">`).join("")}</div>` : ""}
    <div class="grade-form">
      <div><label>Data</label><input type="date" id="pp-data" value="${esc(p.data || "")}"></div>
      <div><label>Status</label><select id="pp-status">${STATUS_POST.map((s) => `<option value="${s.id}" ${s.id === p.status ? "selected" : ""}>${esc(s.nome)}</option>`).join("")}</select></div>
      <div><label>Formato</label><select id="pp-formato">${["carrossel", "reels", "post", "stories"].map((f) => `<option ${f === p.formato ? "selected" : ""}>${f}</option>`).join("")}</select></div>
      <div><label>Estratégia</label><select id="pp-estr"><option value=""></option>${Object.entries(ESTRATEGIAS).map(([k, v]) => `<option value="${k}" ${k === p.estrategia ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
      <div><label>Pilar</label><input type="text" id="pp-pilar" value="${esc(p.pilar || "")}"></div>
      <div><label>Funil</label><select id="pp-funil"><option value=""></option>${["topo", "meio", "fundo"].map((f) => `<option ${f === p.funil ? "selected" : ""}>${f}</option>`).join("")}</select></div>
    </div>
    <label>Tema</label><input type="text" id="pp-tema" value="${esc(p.tema || "")}">
    <label>Roteiro</label><textarea id="pp-roteiro">${esc(p.roteiro || "")}</textarea>
    <label>Legenda</label><textarea id="pp-legenda">${esc(p.legenda || "")}</textarea>
    <div class="grade-form"><div><label>Prazo de aprovação</label><input type="date" id="pp-prazo" value="${esc(p.prazo_aprovacao || "")}"></div>
      <div><label>Link publicado</label><input type="url" id="pp-link" value="${esc(p.link_publicado || "")}" placeholder="https://www.instagram.com/p/..."></div></div>
    <p class="suave">Versão ${p.versao || 1}${p.mudancas ? `. O que mudou: ${esc(p.mudancas)}` : ""}</p>
    <div class="modal-rodape">${novo ? "" : `<button class="btn perigo" id="pp-apagar">Apagar</button>`}<button class="btn primario" id="pp-salvar">Salvar</button></div>
    ${novo ? "" : `<hr><h3>Histórico de aprovação</h3>${aprov.length ? aprov.map((a) => `<p>${a.decisao === "aprovado" ? "✅" : "✏️"} <strong>${esc(a.decisao)}</strong> em ${fmtData(a.created_at)}${a.comentario ? `: ${esc(a.comentario)}` : ""}${a.trecho ? ` <small>(trecho: "${esc(a.trecho)}")</small>` : ""}</p>`).join("") : `<p class="suave">Sem respostas do cliente ainda.</p>`}`}`);
  $("#pp-salvar", painel).onclick = async () => {
    const dados = { cliente_id: p.cliente_id, data: $("#pp-data").value, status: $("#pp-status").value, formato: $("#pp-formato").value, estrategia: $("#pp-estr").value || null,
      pilar: $("#pp-pilar").value || null, funil: $("#pp-funil").value || null, tema: $("#pp-tema").value.trim(), roteiro: $("#pp-roteiro").value, legenda: $("#pp-legenda").value,
      prazo_aprovacao: $("#pp-prazo").value || null, link_publicado: $("#pp-link").value.trim() || null };
    if (!dados.tema || !dados.data) { avisar("Preencha a data e o tema.", "erro"); return; }
    try {
      if (novo) await D.inserir("posts", { ...dados, versao: 1, midias: [] }); else await D.atualizar("posts", { id: p.id }, dados);
      fecharModal(); avisar("Post salvo.", "ok"); depois && depois();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  if (!novo) $("#pp-apagar", painel).onclick = async () => {
    if (!(await confirmar("Apagar este post? Isso não pode ser desfeito.", "Apagar", true))) return;
    try { await D.apagar("posts", { id: p.id }); avisar("Post apagado.", "ok"); depois && depois(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
}

// ---------------------------------------------------------------- Produto
ROTAS.produto = async (el) => {
  const c = clienteAtual();
  const p = c.produto || {};
  const campos = [["ideia", "Ideia do produto"], ["nota", "Nota de 0 a 100 (problema urgente, resultado rápido, fácil de entender)"], ["mecanismo", "Mecanismo único"],
    ["indice", "Índice (escrito pelo cliente, revisado)"], ["aulas", "Aulas (roteiros a partir dos áudios)"], ["retorno_do_rei", "Retorno do rei (oferta logo após a compra)"],
    ["bumps", "Order bumps"], ["oferta", "Oferta (7 componentes)"], ["checkout", "Checkout (copy, preço com âncora real, garantia)"]];
  el.innerHTML = cabecalho("Produto", "Produto viral de entrada e máquina de vendas (fases 2 e 3). Fora do infoproduto, vira oferta de entrada.") + `<form class="cartao" id="f-prod">
    ${campos.map(([k, n]) => k === "nota" ? `<label>${esc(n)}</label><input type="number" min="0" max="100" id="pr-${k}" value="${esc(p[k] ?? "")}">` : `<label>${esc(n)}</label><textarea id="pr-${k}">${esc(p[k] || "")}</textarea>`).join("")}
    <div class="modal-rodape"><button class="btn primario">Salvar produto</button></div></form>`;
  $$("#f-prod textarea, #f-prod input").forEach((i) => i.oninput = () => { S.sujo = true; });
  $("#f-prod").onsubmit = async (ev) => {
    ev.preventDefault();
    const novo = Object.fromEntries(campos.map(([k]) => [k, k === "nota" ? (Number($("#pr-" + k).value) || null) : $("#pr-" + k).value]));
    try { await D.atualizar("clientes", { id: c.id }, { produto: novo }); c.produto = novo; S.sujo = false; avisar("Produto salvo.", "ok"); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// ---------------------------------------------------------------- Lançamento
ROTAS.lancamento = async (el, args) => {
  const c = clienteAtual();
  const lancs = await D.lista("lancamentos", { eq: { cliente_id: c.id } });
  const atual = lancs.find((l) => l.id === args[0]) || lancs[lancs.length - 1];
  let intervalo = null;
  el.innerHTML = cabecalho("Lançamento", "Calendário reverso, checklist por dia, canal, lista VIP e pagamento.",
    `${lancs.length > 1 ? `<select id="sel-lan" style="width:auto">${lancs.map((l) => `<option value="${esc(l.id)}" ${atual && l.id === atual.id ? "selected" : ""}>${esc(l.nome)}</option>`).join("")}</select>` : ""}<button class="btn primario" id="novo-lan">+ Novo lançamento</button>`) + `<div id="corpo-lan"></div>`;
  $("#novo-lan").onclick = () => {
    const m = abrirModal("Novo lançamento ou campanha", `<form id="f-lan"><label>Nome</label><input type="text" id="l-nome" required>
      <label>Data de abertura do carrinho</label><input type="date" id="l-abre" required><p class="suave">O calendário reverso é montado a partir dessa data (aquecimento 6 dias, pré 2 dias, carrinho 3 dias).</p>
      <div class="modal-rodape"><button class="btn primario">Criar</button></div></form>`);
    $("#f-lan", m).onsubmit = async (ev) => {
      ev.preventDefault();
      try { const l = await D.inserir("lancamentos", { cliente_id: c.id, nome: $("#l-nome", m).value.trim(), status: "planejado", datas: montarCalendarioReverso($("#l-abre", m).value), resultado: {} });
        fecharModal(); location.hash = "#/lancamento/" + l.id; } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  if ($("#sel-lan")) $("#sel-lan").onchange = (e) => { location.hash = "#/lancamento/" + e.target.value; };
  if (!atual) { $("#corpo-lan").innerHTML = vazio("Nenhum lançamento ainda. Crie um para montar o calendário reverso."); return; }
  const d = atual.datas || {};
  const salvarDatas = async () => { try { await D.atualizar("lancamentos", { id: atual.id }, { datas: d }); } catch (e) { avisar(erroAmigavel(e), "erro"); } };
  const fases = [["Aquecimento", d.aquecimento, d.pre && somarDias(d.pre, -1)], ["Pré-lançamento", d.pre, d.abertura && somarDias(d.abertura, -1)], ["Carrinho aberto", d.abertura, d.fechamento], ["Debriefing", d.fechamento && somarDias(d.fechamento, 1), null]];
  const hoje = hojeISO();
  $("#corpo-lan").innerHTML = `
    <div class="cartao"><h2>${esc(atual.nome)}</h2><div class="jornada">${fases.map(([n, ini, fim]) => { const feita = fim && fim < hoje, at = ini && ini <= hoje && (!fim || fim >= hoje);
      return `<div class="fase ${feita ? "feita" : ""} ${at ? "atual" : ""}"><div class="bola">${feita ? "✓" : ""}</div><div><strong>${esc(n)}</strong><br><small>${ini ? fmtData(ini) : ""}${fim ? " a " + fmtData(fim) : ""}</small></div></div>`; }).join("")}</div></div>
    <div class="grade duas">
      <div class="cartao"><h2>Lista VIP ao vivo</h2><div class="numero-grande" id="vip-n">...</div><small>atualiza a cada 30 segundos</small></div>
      <div class="cartao"><h2>Checklist de pagamento</h2>${(d.pagamento || []).map((x, i) => `<label class="interruptor"><input type="checkbox" data-pg="${i}" ${x.feito ? "checked" : ""}> ${esc(x.item)}</label>`).join("<br>")}</div>
    </div>
    <div class="cartao"><h2>Checklist por dia</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Dia</th><th>Fase</th><th>O que fazer</th><th>Feito</th></tr></thead><tbody>
      ${(d.checklist || []).map((x, i) => `<tr><td>${fmtDataCurta(x.dia)}</td><td>${esc(x.fase)}</td><td>${esc(x.item)}</td><td><input type="checkbox" data-ck="${i}" ${x.feito ? "checked" : ""}></td></tr>`).join("")}</tbody></table></div></div>
    <div class="cartao"><h2>Textos do canal</h2>${(d.canal || []).map((x, i) => `<div class="cartao plano"><div class="linha"><input type="date" data-cd="${i}" value="${esc(x.dia)}" style="width:auto"><input type="text" data-ch="${i}" value="${esc(x.hora)}" style="width:90px"></div><textarea data-ct="${i}">${esc(x.texto)}</textarea></div>`).join("")}
      <div class="linha"><button class="btn" id="add-canal">+ Mensagem</button><button class="btn primario" id="salvar-canal">Salvar textos</button></div></div>
    <div class="cartao"><h2>Debriefing</h2><p class="suave">As 5 perguntas. O lançamento só conta como feito com o debriefing.</p>
      ${["Quantas pessoas entraram na lista e quantas compraram?", "Qual conteúdo trouxe mais gente para a lista?", "Qual objeção mais apareceu?", "O que daria para fazer melhor com o mesmo esforço?", "O que repetir no próximo?"]
        .map((q, i) => `<label>${i + 1}. ${esc(q)}</label><textarea data-db="${i}">${esc(((atual.resultado || {}).debriefing || [])[i] || "")}</textarea>`).join("")}
      <div class="modal-rodape"><button class="btn primario" id="salvar-db">Salvar debriefing</button></div></div>`;
  $$("[data-pg]").forEach((cb) => cb.onchange = () => { d.pagamento[cb.dataset.pg].feito = cb.checked; salvarDatas(); });
  $$("[data-ck]").forEach((cb) => cb.onchange = () => { d.checklist[cb.dataset.ck].feito = cb.checked; salvarDatas(); });
  $("#add-canal").onclick = () => { d.canal = d.canal || []; d.canal.push({ dia: d.abertura || hoje, hora: "12:00", texto: "" }); salvarDatas().then(rotear); };
  $("#salvar-canal").onclick = async () => {
    (d.canal || []).forEach((x, i) => { x.dia = $(`[data-cd="${i}"]`).value; x.hora = $(`[data-ch="${i}"]`).value; x.texto = $(`[data-ct="${i}"]`).value; });
    await salvarDatas(); avisar("Textos do canal salvos.", "ok");
  };
  $("#salvar-db").onclick = async () => {
    const resultado = Object.assign({}, atual.resultado, { debriefing: [0, 1, 2, 3, 4].map((i) => $(`[data-db="${i}"]`).value) });
    const completo = resultado.debriefing.every((x) => x.trim());
    try { await D.atualizar("lancamentos", { id: atual.id }, { resultado, status: completo ? "concluido" : atual.status }); avisar(completo ? "Debriefing completo: lançamento concluído." : "Debriefing salvo.", "ok"); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  // Lista VIP ao vivo: leads das automações de captação + etiqueta "vip"
  const contarVip = async () => {
    if (!$("#vip-n")) { clearInterval(intervalo); return; }
    try {
      const autos = await D.lista("ig_automations", { eq: { cliente_id: c.id, modelo: "captacao_vip" } });
      const leads = await D.lista("ig_leads", { eq: { cliente_id: c.id } }, "ig_user_id, automation_id, tags");
      const n = leads.filter((l) => autos.some((a) => a.id === l.automation_id) || (l.tags || []).includes("vip")).length;
      $("#vip-n").textContent = n;
    } catch (_) { $("#vip-n").textContent = "sem dado"; }
  };
  contarVip();
  intervalo = setInterval(contarVip, 30000);
};

// ---------------------------------------------------------------- Análise
ROTAS.analise = async (el) => {
  const c = clienteAtual();
  const [posts, mets, pedidos] = await Promise.all([
    D.lista("posts", { eq: { cliente_id: c.id }, in: { status: ["publicado", "agendado"] }, ordem: "-data", limite: 120 }),
    D.lista("metricas_post", { eq: { cliente_id: c.id } }),
    D.lista("pedidos_audiencia", { eq: { cliente_id: c.id }, ordem: "-ocorrencias" }),
  ]);
  const linha = (p) => {
    const m = mets.find((x) => x.post_id === p.id) || {};
    const s100 = taxa(m.seguidores_ganhos, m.visualizacoes), cp = taxa(m.compartilhamentos, m.alcance), sv = taxa(m.salvamentos, m.alcance);
    const r1 = regua("seg100", s100), r2 = regua("compart", cp), r3 = regua("salv", sv);
    let diag = "sem dado";
    if (m.visualizacoes) {
      if (m.visualizacoes > 3000 && r1.texto === "fraco") diag = "Muito tráfego e pouca conversão: o gancho funciona, a entrega pode melhorar.";
      else if (r2.texto === "ótimo") diag = "Muita gente mandou para alguém: bom tema de alcance.";
      else if (r3.texto === "ótimo") diag = "Muitos salvamentos: conteúdo útil, repita o formato.";
      else if (r1.texto === "fraco") diag = "Pouco seguidor por visualização: teste outro gancho (um elemento por vez).";
      else diag = "Dentro da régua. Mude um elemento por vez para testar.";
    }
    return `<tr><td>${fmtDataCurta(p.data)}</td><td>${esc(p.tema)}<br><small>${esc(p.formato || "")} · ${esc(m.canal || "feed")} · ${esc(m.origem || "sem métrica")}</small></td>
      <td class="num">${fmtNum(m.visualizacoes)}</td><td class="num">${fmtNum(m.alcance)}</td>
      <td class="num ${r1.classe}">${fmtTaxa(s100)}</td><td class="num ${r2.classe}">${fmtTaxa(cp)}${cp != null ? "%" : ""}</td><td class="num ${r3.classe}">${fmtTaxa(sv)}${sv != null ? "%" : ""}</td>
      <td style="min-width:220px"><small>${esc(diag)}</small></td><td><button class="btn pequeno" data-met="${esc(p.id)}">Editar</button></td></tr>`;
  };
  el.innerHTML = cabecalho("Análise", "Taxas calculadas e comparadas com a régua (orientação, nunca garantia).") + `
    <div class="cartao"><h2>Posts</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Data</th><th>Post</th><th class="num">Visualizações</th><th class="num">Alcance</th>
      <th class="num">Seg./100 vis.</th><th class="num">Compart.</th><th class="num">Salv.</th><th>Diagnóstico</th><th></th></tr></thead><tbody>
      ${posts.map(linha).join("") || `<tr><td colspan="9">${vazio("Nenhum post publicado ainda.")}</td></tr>`}</tbody></table></div>
      <p class="suave" style="margin-top:8px">Régua: seguidores por 100 visualizações (fraco abaixo de 0,5, ótimo acima de 1,5), compartilhamento (0,5% a 2%), salvamento (1% a 3%).</p></div>
    <div class="cartao"><h2>Pedidos da audiência</h2>
      <form class="linha" id="f-ped"><input class="cresce" type="text" id="pa-frase" placeholder="Frase exata, entre aspas se quiser" required>
        <select id="pa-tipo" style="width:auto"><option>pergunta</option><option>dificuldade</option><option>palavra</option></select>
        <input type="number" id="pa-oc" value="1" min="1" style="width:80px"><button class="btn primario">Adicionar</button></form>
      ${pedidos.map((x) => `<p>"${esc(x.frase_exata)}" <span class="pilula">${esc(x.tipo || "")}</span> <small>${x.ocorrencias} vez(es) · ${esc(x.fonte || "")}</small></p>`).join("") || `<p class="suave">Nada registrado ainda.</p>`}</div>
    <div class="cartao"><h2>Debriefing</h2><p>O debriefing de cada lançamento fica na tela <a href="#/lancamento">Lançamento</a>.</p></div>`;
  $("#f-ped").onsubmit = async (ev) => {
    ev.preventDefault();
    try { await D.inserir("pedidos_audiencia", { cliente_id: c.id, frase_exata: $("#pa-frase").value.trim(), tipo: $("#pa-tipo").value, ocorrencias: Number($("#pa-oc").value) || 1, fonte: "manual" }); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  $$("[data-met]").forEach((b) => b.onclick = () => {
    const p = posts.find((x) => x.id === b.dataset.met), m = mets.find((x) => x.post_id === p.id) || {};
    const campos = [["visualizacoes", "Visualizações"], ["alcance", "Alcance"], ["curtidas", "Curtidas"], ["comentarios", "Comentários"], ["salvamentos", "Salvamentos"],
      ["compartilhamentos", "Compartilhamentos"], ["seguidores_ganhos", "Seguidores ganhos"], ["taxa_pulos", "Taxa de pulos (%)"], ["tempo_medio", "Tempo médio (s)"]];
    const mm = abrirModal("Métricas: " + p.tema, `<form id="f-met"><div class="grade-form">${campos.map(([k, n]) => `<div><label>${esc(n)}</label><input type="number" step="any" id="m-${k}" value="${esc(m[k] ?? "")}"></div>`).join("")}
      <div><label>Canal</label><select id="m-canal"><option value="feed" ${m.canal !== "teste" ? "selected" : ""}>feed</option><option value="teste" ${m.canal === "teste" ? "selected" : ""}>teste</option></select></div></div>
      <div class="modal-rodape"><button class="btn primario">Salvar</button></div></form>`);
    $("#f-met", mm).onsubmit = async (ev) => {
      ev.preventDefault();
      const dados = { post_id: p.id, cliente_id: c.id, origem: "manual", canal: $("#m-canal", mm).value };
      campos.forEach(([k]) => { const v = $("#m-" + k, mm).value; dados[k] = v === "" ? null : Number(v); });
      try { await D.upsert("metricas_post", dados, "post_id"); fecharModal(); avisar("Métricas salvas.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  });
};

// ---------------------------------------------------------------- Relatórios
ROTAS.relatorios = async (el) => {
  const c = clienteAtual();
  const rels = await D.lista("relatorios", { eq: { cliente_id: c.id }, ordem: "-mes" });
  el.innerHTML = cabecalho("Relatórios", "O relatório do mês é escrito pela skill relatorio-mensal e publicado pelo portal_sync.py, ou aqui.", `<button class="btn primario" id="novo-rel">+ Relatório</button>`) +
    (rels.length ? rels.map((r) => `<div class="cartao"><div class="linha" style="justify-content:space-between"><h2 style="margin:0">${esc(nomeMes(r.mes))}</h2>
      <div class="linha">${r.publicado ? `<span class="pilula ok">publicado para o cliente</span>` : `<span class="pilula alerta">rascunho</span>`}
      <button class="btn pequeno" data-ed="${esc(r.id)}">Editar</button><button class="btn pequeno ${r.publicado ? "" : "primario"}" data-pub="${esc(r.id)}">${r.publicado ? "Despublicar" : "Publicar para o cliente"}</button></div></div>
      <div style="margin-top:10px">${md(r.conteudo)}</div></div>`).join("") : vazio("Nenhum relatório ainda."));
  const editar = (r) => {
    const m = abrirModal(r ? "Editar relatório" : "Novo relatório", `<form id="f-rel"><label>Mês</label><input type="month" id="r-mes" value="${esc(r ? r.mes : mesAtual())}" ${r ? "disabled" : ""}>
      <label>Conteúdo (markdown)</label><textarea class="grande" id="r-txt" style="min-height:360px">${esc(r ? r.conteudo : "# Relatório de " + nomeMes(mesAtual()) + "\n\n## Números\n\n## Os 3 melhores posts\n\n## Aprendizados\n\n## Próximo mês\n")}</textarea>
      <div class="modal-rodape"><button class="btn primario">Salvar</button></div></form>`, { largo: true });
    $("#f-rel", m).onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        if (r) await D.atualizar("relatorios", { id: r.id }, { conteudo: $("#r-txt", m).value });
        else await D.upsert("relatorios", { cliente_id: c.id, mes: $("#r-mes", m).value, conteudo: $("#r-txt", m).value, publicado: false }, "cliente_id,mes");
        fecharModal(); avisar("Relatório salvo.", "ok"); rotear();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  $("#novo-rel").onclick = () => editar(null);
  $$("[data-ed]").forEach((b) => b.onclick = () => editar(rels.find((r) => r.id === b.dataset.ed)));
  $$("[data-pub]").forEach((b) => b.onclick = async () => {
    const r = rels.find((x) => x.id === b.dataset.pub);
    try { await D.atualizar("relatorios", { id: r.id }, { publicado: !r.publicado }); avisar(r.publicado ? "Relatório despublicado." : "Relatório publicado para o cliente.", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
};

// ---------------------------------------------------------------- Configurações do cliente
ROTAS["config-cliente"] = async (el) => {
  const c = clienteAtual();
  const e = c.escopo || {};
  let usado = null;
  try { usado = await D.rpc("espaco_usado", { p_cliente: c.id }); } catch (_) { usado = null; }
  el.innerHTML = cabecalho("Configurações do cliente", esc(c.nome)) + `<form id="f-cli">
    <div class="cartao"><h2>Cadastro</h2><div class="grade-form">
      <div><label>Nome</label><input type="text" id="k-nome" value="${esc(c.nome)}"></div>
      <div><label>@ do Instagram</label><input type="text" id="k-ig" value="${esc(c.instagram || "")}"></div>
      <div><label>Tipo de negócio</label><select id="k-tipo">${[["infoproduto", "Infoproduto"], ["servico", "Prestador de serviço"], ["local", "Negócio local"], ["produto_fisico", "Produto físico"]].map(([v, n]) => `<option value="${v}" ${c.tipo_negocio === v ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div><label>Status</label><select id="k-status">${["ativo", "pausado", "encerrado"].map((s) => `<option ${c.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div><label>Plano</label><input type="text" id="k-plano" value="${esc(c.plano || "")}"></div>
      <div><label>Valor mensal (R$)</label><input type="number" step="0.01" id="k-valor" value="${esc(c.valor_mensal ?? "")}"></div>
      <div><label>Fim do contrato (período mínimo)</label><input type="date" id="k-fim" value="${esc(c.contrato_fim || "")}"></div>
      <div><label>Fase do ciclo</label><select id="k-fase">${FASES.map((f) => `<option value="${f.n}" ${Number(c.fase_ciclo) === f.n ? "selected" : ""}>${f.n}. ${esc(f.nome)}</option>`).join("")}</select></div>
      <div><label>Próximo marco</label><input type="text" id="k-marco" value="${esc((c.proximo_marco || {}).texto || "")}"></div>
      <div><label>Data do próximo marco</label><input type="date" id="k-marco-data" value="${esc((c.proximo_marco || {}).data || "")}"></div>
    </div></div>
    <div class="cartao"><h2>Escopo</h2><div class="grade-form">
      <div><label>Posts por semana</label><input type="number" id="k-pps" value="${esc(e.posts_semana ?? "")}"></div>
      <div><label>Formatos</label><input type="text" id="k-formatos" value="${esc(e.formatos || "")}" placeholder="carrossel, reels, post"></div>
      <div><label>Lançamentos por ano</label><input type="number" id="k-lanc" value="${esc(e.lancamentos ?? "")}"></div>
      <div><label>Rodadas de ajuste por post</label><input type="number" id="k-rodadas" value="${esc(e.rodadas_ajuste ?? 1)}"></div>
      <div><label>Prazo de aprovação (dias)</label><input type="number" id="k-prazo" value="${esc(e.prazo_aprovacao_dias ?? 2)}"></div>
      <div><label class="interruptor" style="margin-top:28px"><input type="checkbox" id="k-rel" ${e.relatorio !== false ? "checked" : ""}> Relatório mensal incluso</label></div>
    </div></div>
    <div class="cartao"><h2>Portal do cliente</h2>
      <label>Vídeo de boas-vindas (link do YouTube, Vimeo ou Drive)</label><input type="url" id="k-video" value="${esc(c.video_boas_vindas_url || "")}">
      <label>Link da pasta de envio (ex.: pasta do Google Drive do cliente)</label><input type="url" id="k-pasta" value="${esc(c.pasta_envio_url || "")}">
      <label>Telas visíveis para o cliente</label><div class="grade-form">${TELAS_CLIENTE.map((t) => `<label class="interruptor"><input type="checkbox" data-tela="${t.id}" ${(c.telas_visiveis || []).includes(t.id) ? "checked" : ""}> ${iconeSvg(t.id)} ${esc(t.nome)}</label>`).join("")}</div>
      <p class="suave" style="margin-top:10px">Espaço usado no armazenamento: <strong>${usado == null ? "sem dado" : (usado / 1024 / 1024).toFixed(1).replace(".", ",") + " MB"}</strong>. Limite por arquivo: 5 MB (imagem) e 10 MB (áudio). Vídeos entram como link.</p>
    </div>
    <div class="modal-rodape"><button class="btn primario">Salvar configurações</button></div></form>`;
  $$("#f-cli input, #f-cli select").forEach((i) => i.addEventListener("input", () => { S.sujo = true; }));
  $("#f-cli").onsubmit = async (ev) => {
    ev.preventDefault();
    const dados = {
      nome: $("#k-nome").value.trim(), instagram: $("#k-ig").value.trim(), tipo_negocio: $("#k-tipo").value, status: $("#k-status").value, plano: $("#k-plano").value.trim(),
      valor_mensal: Number($("#k-valor").value) || null, contrato_fim: $("#k-fim").value || null, fase_ciclo: Number($("#k-fase").value),
      proximo_marco: { texto: $("#k-marco").value.trim(), data: $("#k-marco-data").value || null },
      escopo: { posts_semana: Number($("#k-pps").value) || 0, formatos: $("#k-formatos").value.trim(), lancamentos: Number($("#k-lanc").value) || 0,
        rodadas_ajuste: Number($("#k-rodadas").value) || 1, prazo_aprovacao_dias: Number($("#k-prazo").value) || 2, relatorio: $("#k-rel").checked },
      video_boas_vindas_url: $("#k-video").value.trim() || null, pasta_envio_url: $("#k-pasta").value.trim() || null,
      telas_visiveis: $$("[data-tela]").filter((x) => x.checked).map((x) => x.dataset.tela),
    };
    try { await D.atualizar("clientes", { id: c.id }, dados); Object.assign(c, dados); S.sujo = false; avisar("Configurações salvas.", "ok"); rotear(); }
    catch (er) { avisar(erroAmigavel(er), "erro"); }
  };
};

// =============================================================================
// 6. INSTAGRAM (social media): Métricas, Automações, Interações, Contas + editor
// =============================================================================
const MODELOS_AUTOMACAO = {
  captacao_vip: { nome: "Captação da lista VIP", keyword: "vip", public_reply: "Te chamei no direct!", public_reply_variants: ["Corre lá no direct!"],
    mensagem: "Oba! Sua vaga na lista VIP está garantida. Toca no botão para entrar.", botao: "Entrar na lista" },
  abertura: { nome: "Abertura das inscrições", keyword: "quero", public_reply: "Te mandei o link no direct!", public_reply_variants: ["Olha o direct!"],
    mensagem: "As inscrições abriram! Toca no botão para garantir a sua.", botao: "Quero garantir" },
  material: { nome: "Material em troca de comentário", keyword: "material", public_reply: "Te mandei no direct!", public_reply_variants: ["Já está no seu direct!"],
    mensagem: "Aqui está o material que você pediu 💌", botao: "Baixar material" },
};

ROTAS.instagram = async (el, args) => {
  const c = clienteAtual();
  let aba = args[0] === "metricas" ? "analises" : args[0];   // "metricas" era o nome antigo
  if (aba === "automacao") return editorAutomacao(el, args[1]);
  if (!["visao", "analises", "comentarios", "automacoes", "interacoes", "contas"].includes(aba)) aba = "visao";
  el.innerHTML = cabecalho("📸 Instagram", esc(c.nome), `<div class="chips-topo" id="chips-ig"></div>`) + `<div class="abas">
    ${[["visao", "📊 Visão geral"], ["analises", "Análises"], ["comentarios", "💬 Comentários"], ["automacoes", "Automações"], ["interacoes", "Interações"], ["contas", "Contas"]].map(([k, n]) => `<button class="${aba === k ? "ativa" : ""}" data-aba="${k}">${n}</button>`).join("")}</div><div id="aba-ig"><p class="suave">Carregando...</p></div>`;
  $$("[data-aba]", el).forEach((b) => b.onclick = () => { location.hash = "#/instagram/" + b.dataset.aba; });
  chipsInstagram(c);   // status da conexão e entregas em 24 h (carrega em paralelo)
  const alvo = $("#aba-ig");
  try {
    if (aba === "visao") await abaVisaoGeral(alvo, c);
    if (aba === "analises") await abaMetricas(alvo, c);
    if (aba === "comentarios") await abaComentarios(alvo, c);
    if (aba === "automacoes") await abaAutomacoes(alvo, c);
    if (aba === "interacoes") await abaInteracoes(alvo, c);
    if (aba === "contas") await abaContas(alvo, c);
  } catch (e) { console.error("Instagram (" + aba + "):", e); alvo.innerHTML = vazio("Não consegui carregar. " + erroAmigavel(e)); }
};

async function contaDoCliente(c) {
  const contas = await D.lista("ig_contas_publico", { eq: { cliente_id: c.id } }).catch(() => []);
  return contas[0] || null;
}

/** Endereço da lista e do editor de automações (social media ou cliente). */
const rotaListaAutomacoes = () => (ehSM() ? "#/instagram/automacoes" : "#/automacoes");
const rotaEditorAutomacao = (id) => (ehSM() ? "#/instagram/automacao/" : "#/automacoes/editar/") + id;

/** Chips do topo: situação da conexão (e validade do token) e entregas nas últimas 24 h. */
async function chipsInstagram(c) {
  try {
    const conta = await contaDoCliente(c);
    const desde = new Date(Date.now() - 86400 * 1000).toISOString();
    const entregas = conta ? await D.contar("ig_deliveries", { eq: { cliente_id: c.id, status: "ok" }, gte: { ts: desde } }).catch(() => 0) : 0;
    let conexao = `<span class="bolinha-status ruim"></span>Sem conta conectada`;
    if (conta) {
      const ruim = conta.situacao !== "ativa";
      const diasToken = conta.expires_at ? Math.max(0, Math.ceil((new Date(conta.expires_at) - Date.now()) / 86400000)) : null;
      conexao = `<span class="bolinha-status ${ruim ? "ruim" : ""}"></span>${ruim ? "Precisa reconectar" : diasToken == null ? "Conectada" : `Token ${diasToken} dias`}`;
    }
    const alvo = $("#chips-ig");
    if (alvo) alvo.innerHTML = `<span class="chip-topo" title="${conta ? "@" + esc(conta.username || "") : ""}">${conexao}</span>${conta ? `<span class="chip-topo">✉️ ${entregas} entregas 24h</span>` : ""}`;
  } catch (_) { /* os chips são só informativos */ }
}

// ---------------------------------------------------------------- Visão geral
async function abaVisaoGeral(el, c) {
  const conta = await contaDoCliente(c);
  if (!conta) { el.innerHTML = vazio("Conecte o Instagram para ver a visão geral.") + `<p style="text-align:center;margin-top:10px"><a class="btn primario" href="#/instagram/contas">Ir para Contas</a></p>`; return; }
  const hoje = hojeISO(), inicio = somarDias(hoje, -14);
  const iso15 = new Date(inicio + "T00:00:00").toISOString(), iso30 = new Date(Date.now() - 30 * 86400000).toISOString();
  let api = null;
  try { api = await D.funcao("ig-insights", { cliente_id: c.id, dias: 15 }); } catch (_) { api = null; }
  const [hist, leads, entregas, fila, autos] = await Promise.all([
    D.lista("metricas_conta", { eq: { cliente_id: c.id }, gte: { data: inicio }, ordem: "data" }).catch(() => []),
    D.lista("ig_leads", { eq: { cliente_id: c.id } }, "ig_user_id, created_at, tags, last_source, automation_id, last_keyword").catch(() => []),
    D.lista("ig_deliveries", { eq: { cliente_id: c.id }, gte: { ts: iso30 }, limite: 50000 }, "ig_user_id, status, motivo, ts").catch(() => []),
    D.lista("ig_send_queue", { eq: { cliente_id: c.id }, gte: { created_at: iso30 } }, "status").catch(() => []),
    D.lista("ig_automations", { eq: { cliente_id: c.id } }, "id, keyword, match_any").catch(() => []),
  ]);
  // séries de 15 dias (histórico do banco + dado novo da API)
  const serie = (campoBanco, campoApi) => {
    const m = new Map();
    hist.forEach((d) => { if (d[campoBanco] != null) m.set(d.data, Number(d[campoBanco])); });
    ((api && api[campoApi]) || []).forEach((p) => m.set(p.data, Number(p.valor)));
    return [...Array(15)].map((_, i) => { const d = somarDias(inicio, i); return { data: d, valor: m.get(d) ?? 0 }; });
  };
  const novos = serie("novos_seguidores", "novos_por_dia"), alcance = serie("alcance", "alcance_por_dia");
  const somaNovos = novos.reduce((s, p) => s + p.valor, 0), somaAlcance = alcance.reduce((s, p) => s + p.valor, 0);
  const leads15 = leads.filter((l) => (l.created_at || "") >= iso15).length;
  const atendidas = new Set(entregas.filter((d) => d.status === "ok" && d.ts >= iso15).map((d) => d.ig_user_id)).size;
  const seguidores = api ? api.seguidores : (hist.filter((d) => d.seguidores != null).pop() || {}).seguidores;

  // Saúde do envio (30 dias)
  const ok = entregas.filter((d) => d.status === "ok").length, falhas = entregas.filter((d) => d.status === "erro");
  const cancelados = fila.filter((q) => q.status === "expirado").length, aguardando = fila.filter((q) => q.status === "pendente").length;
  const totalSaude = Math.max(1, ok + falhas.length + cancelados + aguardando);
  const motivos = {};
  falhas.forEach((d) => { const m = (d.motivo || "sem detalhe").slice(0, 90); motivos[m] = (motivos[m] || 0) + 1; });
  const topMotivos = Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const saude = (ok + falhas.length + cancelados + aguardando) === 0 ? vazio("Nenhum envio nos últimos 30 dias.") : `
    <div class="saude-barra" role="img" aria-label="${ok} entregues, ${falhas.length} falharam, ${cancelados} cancelados, ${aguardando} aguardando">
      <span style="width:${(ok / totalSaude) * 100}%;background:var(--ok)"></span><span style="width:${(falhas.length / totalSaude) * 100}%;background:var(--erro)"></span>
      <span style="width:${(aguardando / totalSaude) * 100}%;background:var(--alerta)"></span><span style="width:${(cancelados / totalSaude) * 100}%;background:#B8ADA5"></span></div>
    <div class="saude-legenda"><span><i style="background:var(--ok)"></i><strong>${ok}</strong> entregues</span><span><i style="background:var(--erro)"></i><strong>${falhas.length}</strong> falharam</span>
      <span><i style="background:var(--alerta)"></i><strong>${aguardando}</strong> na fila</span><span><i style="background:#B8ADA5"></i><strong>${cancelados}</strong> cancelados (mais de 7 dias)</span></div>
    ${topMotivos.length ? `<div class="lista-erros">${topMotivos.map(([m, n]) => `<div><span>${esc(m)}</span><strong>${n}</strong></div>`).join("")}</div>` : ""}`;

  // O que as pessoas querem: etiqueta do lead, ou a palavra-chave da automação
  const rotuloDe = (l) => {
    if ((l.tags || []).length) return l.tags[0];
    const a = autos.find((x) => x.id === l.automation_id);
    if (a && !a.match_any && a.keyword) return a.keyword.split(",")[0].trim();
    return "outros";
  };
  const grupos = {};
  leads.forEach((l) => { const r = rotuloDe(l); grupos[r] = (grupos[r] || 0) + 1; });
  const topGrupos = Object.entries(grupos).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxG = Math.max(1, ...topGrupos.map(([, n]) => n));
  const porOrigem = (o) => leads.filter((l) => l.last_source === o).length;
  const querem = !leads.length ? vazio("Os interesses aparecem aqui quando chegarem os primeiros leads.") : `
    <div class="barras-h">${topGrupos.map(([nome, n]) => `<div class="linha-barra"><span class="nome" title="${esc(nome)}">${esc(nome)}</span><div class="trilho-h"><div style="width:${(n / maxG) * 100}%"></div></div><span class="valor">${n}</span></div>`).join("")}</div>
    <p class="resumo-serie" style="margin-top:10px">📍 <strong>${porOrigem("comment")}</strong> comentário · <strong>${porOrigem("dm")}</strong> direct · <strong>${porOrigem("story_reply")}</strong> story</p>
    <p class="suave" style="font-size:12px;margin:4px 0 0">Agrupado pela etiqueta do lead (Interações) ou pela palavra-chave da automação.</p>`;

  const sinal = (n) => (n > 0 ? "+" : "") + fmtNum(n);
  el.innerHTML = `<div class="grade quatro" style="margin-bottom:16px">
      <div class="kpi"><small>👥 Seguidores</small><div class="numero-grande">${fmtNum(seguidores)}</div><span class="delta ${somaNovos >= 0 ? "sobe" : "desce"}">${somaNovos >= 0 ? "↑" : "↓"} ${sinal(somaNovos)} em 15 dias</span></div>
      <div class="kpi destaque"><small>🎯 Leads captados</small><div class="numero-grande">${fmtNum(leads.length)}</div><span class="delta sobe">↑ ${sinal(leads15)} em 15 dias</span></div>
      <div class="kpi"><small>💬 Pessoas atendidas</small><div class="numero-grande">${fmtNum(atendidas)}</div><span class="delta neutro">receberam DM em 15 dias</span></div>
      <div class="kpi"><small>📣 Alcance</small><div class="numero-grande">${fmtNum(somaAlcance)}</div><span class="delta neutro">contas alcançadas · 15 dias</span></div>
    </div>
    <div class="grade duas">
      <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">📈 Crescimento do perfil</h2><small>novos seguidores por dia · 15 dias · passe o mouse</small></div>
        <div class="numero-grafico">${sinal(somaNovos)} <small>seguidores</small></div>${graficoBarras(novos, "novos seguidores")}${resumoSerie(novos, "+")}</div>
      <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">📣 Alcance</h2><small>contas alcançadas por dia · 15 dias · passe o mouse</small></div>
        <div class="numero-grafico">${fmtNum(somaAlcance)} <small>contas</small></div>${graficoBarras(alcance, "de alcance")}${resumoSerie(alcance)}</div>
    </div>
    <div class="grade duas">
      <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">🛡️ Saúde do envio</h2><small>últimos 30 dias</small></div>${saude}</div>
      <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">💡 O que as pessoas querem</h2><small>por lead</small></div>${querem}</div>
    </div>`;
}

// ---------------------------------------------------------------- Métricas
async function abaMetricas(el, c) {
  const conta = await contaDoCliente(c);
  if (!conta) { el.innerHTML = vazio("Conecte o Instagram para ver as métricas.") + `<p style="text-align:center;margin-top:10px"><a class="btn primario" href="#/instagram/contas">Ir para Contas</a></p>`; return; }
  let dias = 30;
  try { dias = Number(localStorage.getItem("portal-metricas-dias")) || 30; } catch (_) { /* sem storage */ }
  let ordemPosts = "melhores";

  const desenhar = async () => {
    el.innerHTML = seletorPeriodo() + `<p class="suave">Carregando métricas de ${dias} dias...</p>`;
    ligarPeriodo();
    const hoje = hojeISO();
    const inicio = somarDias(hoje, -(dias - 1));            // primeiro dia do período atual
    const inicioAnt = somarDias(inicio, -dias);            // primeiro dia do período anterior
    const isoAnt = new Date(inicioAnt + "T00:00:00").toISOString();

    // 1) Instagram ao vivo (com o período anterior para comparar) e 2) o histórico do banco
    let api = null, erroApi = "";
    try { api = await D.funcao("ig-insights", { cliente_id: c.id, dias, posts: true }); } catch (e) { erroApi = erroAmigavel(e); }
    const [hist, leads, entregas] = await Promise.all([
      D.lista("metricas_conta", { eq: { cliente_id: c.id }, gte: { data: inicioAnt }, ordem: "data" }).catch(() => []),
      D.lista("ig_leads", { eq: { cliente_id: c.id }, gte: { created_at: isoAnt } }, "ig_user_id, created_at, email, telefone").catch(() => []),
      D.lista("ig_deliveries", { eq: { cliente_id: c.id }, gte: { ts: isoAnt }, limite: 50000 }, "ig_user_id, tipo, status, ts").catch(() => []),
    ]);

    // Junta as séries: o banco preenche os dias, a API sobrescreve com o dado mais novo
    const serie = (campoBanco, campoApi) => {
      const m = new Map();
      hist.forEach((d) => { if (d[campoBanco] != null) m.set(d.data, Number(d[campoBanco])); });
      ((api && api[campoApi]) || []).forEach((p) => m.set(p.data, Number(p.valor)));
      return m;
    };
    const novosMap = serie("novos_seguidores", "novos_por_dia"), alcanceMap = serie("alcance", "alcance_por_dia");
    const diasDe = (de, n) => [...Array(n)].map((_, i) => somarDias(de, i));
    const pontos = (mapa, de) => diasDe(de, dias).map((d) => ({ data: d, valor: mapa.get(d) ?? 0 }));
    const soma = (mapa, de) => diasDe(de, dias).reduce((s, d) => s + (mapa.get(d) ?? 0), 0);
    const temDado = (mapa, de) => diasDe(de, dias).some((d) => mapa.has(d));
    const naJanela = (iso, de) => { const d = new Date(iso); return d >= new Date(de + "T00:00:00") && d < new Date(somarDias(de, dias) + "T00:00:00"); };
    const leadsAt = leads.filter((l) => naJanela(l.created_at, inicio)), leadsAnt = leads.filter((l) => naJanela(l.created_at, inicioAnt));
    const entAt = entregas.filter((d) => naJanela(d.ts, inicio)), entAnt = entregas.filter((d) => naJanela(d.ts, inicioAnt));
    const okAt = entAt.filter((d) => d.status === "ok").length, okAnt = entAnt.filter((d) => d.status === "ok").length;

    // Comparação com o período anterior
    const delta = (atual, anterior, temAnterior = true) => {
      if (!temAnterior || anterior == null) return `<span class="delta neutro">sem dado do período anterior</span>`;
      if (!anterior && !atual) return `<span class="delta neutro">igual ao período anterior</span>`;
      if (!anterior) return `<span class="delta sobe">▲ novo em relação ao período anterior</span>`;
      const p = ((atual - anterior) / anterior) * 100;
      const txt = `${Math.abs(p).toFixed(0)}% vs. ${dias} dias anteriores`;
      return p > 0.5 ? `<span class="delta sobe">▲ ${txt}</span>` : p < -0.5 ? `<span class="delta desce">▼ ${txt}</span>` : `<span class="delta neutro">= ${txt}</span>`;
    };
    const kpi = (valor, rotulo, d) => `<div class="kpi"><div class="numero-grande">${fmtNum(valor)}</div><small>${rotulo}</small>${d}</div>`;

    // Funil das automações (pessoas únicas no período)
    const unicos = (lista) => new Set(lista.map((d) => d.ig_user_id));
    const acionaram = unicos(entAt);
    const entregues = unicos(entAt.filter((d) => d.status === "ok"));
    const comLink = unicos(entAt.filter((d) => d.status === "ok" && d.tipo === "link"));
    const contatos = leadsAt.filter((l) => (l.email || l.telefone)).length;
    const etapas = [["Acionaram a automação", acionaram.size, "comentaram, mandaram mensagem ou responderam ao story"], ["Receberam a DM", entregues.size, "a mensagem foi entregue"],
      ["Receberam o link", comLink.size, "a mensagem tinha um botão de link"], ["Deixaram contato", contatos, "informaram e-mail ou telefone"]];
    const maxF = Math.max(1, etapas[0][1]);
    const funil = acionaram.size ? `<div class="funil">${etapas.map(([n, v, dica], i) => `<div class="funil-etapa"><div class="funil-rotulo"><strong>${esc(n)}</strong><small>${esc(dica)}</small></div>
        <div class="funil-barra"><div style="width:${Math.max(3, (v / maxF) * 100)}%"></div></div><div class="funil-num"><strong>${v}</strong>${i ? `<small>${((v / maxF) * 100).toFixed(0)}%</small>` : ""}</div></div>`).join("")}</div>
        <p class="suave" style="margin-top:8px">O Instagram não informa cliques, então o funil mostra quem recebeu o link.</p>`
      : vazio("Nenhuma automação disparou neste período.");

    // Melhor dia e horário: quando os leads chegam (horário deste computador)
    const mapaCalor = [...Array(7)].map(() => Array(24).fill(0));
    leadsAt.forEach((l) => { const d = new Date(l.created_at); mapaCalor[d.getDay()][d.getHours()]++; });
    const maxC = Math.max(0, ...mapaCalor.flat());
    let pico = null;
    mapaCalor.forEach((linha, di) => linha.forEach((v, h) => { if (v && (!pico || v > pico.v)) pico = { di, h, v }; }));
    const porDia = mapaCalor.map((l) => l.reduce((s, v) => s + v, 0));
    const melhorDia = porDia.indexOf(Math.max(...porDia));
    const nomesDias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const calor = leadsAt.length < 3 ? vazio("Ainda há poucos leads neste período para mostrar o melhor horário.") : `
      <p><strong>Pico:</strong> ${nomesDias[pico.di]} por volta das ${pico.h}h (${pico.v} lead${pico.v > 1 ? "s" : ""}). <strong>Melhor dia:</strong> ${nomesDias[melhorDia]} (${porDia[melhorDia]} leads).</p>
      <div class="calor-rolagem"><table class="calor" aria-label="Leads por dia da semana e hora">
        <thead><tr><th></th>${[...Array(24)].map((_, h) => `<th>${h % 3 === 0 ? h + "h" : ""}</th>`).join("")}</tr></thead>
        <tbody>${mapaCalor.map((linha, di) => `<tr><th>${DIAS_SEMANA[di]}</th>${linha.map((v, h) => `<td style="--i:${maxC ? (v / maxC).toFixed(2) : 0}" title="${nomesDias[di]}, ${h}h: ${v} lead${v === 1 ? "" : "s"}">${v || ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div><p class="suave" style="margin-top:6px">Use para escolher quando postar: os leads chegam logo depois das publicações que funcionam.</p>`;

    // Melhores posts do período: galeria com filtros (troca a ordem sem buscar de novo)
    const posts = (api && api.posts) || [];
    const ORDENS = [["melhores", "Melhores"], ["likes", "Mais curtidos"], ["comments", "Mais comentados"], ["saved", "Mais salvos"], ["views", "Mais vistos"], ["shares", "Mais compartilhados"]];
    const nota = (p) => (Number(p.reach) || 0) + 5 * (Number(p.saved) || 0) + 5 * (Number(p.shares) || 0) + 2 * (Number(p.comments) || 0) + (Number(p.likes) || 0);
    const valorOrdem = (p) => (ordemPosts === "melhores" ? nota(p) : Number(p[ordemPosts]) || 0);
    const pintarPosts = () => {
      const alvo = $("#bloco-posts");
      if (!alvo) return;
      if (!posts.length) { alvo.innerHTML = vazio(api ? "Nenhuma publicação neste período." : "Não consegui buscar as publicações agora."); return; }
      const ordenados = [...posts].sort((a, b) => valorOrdem(b) - valorOrdem(a));
      const nomes = { likes: "curtidas", comments: "comentários", saved: "salvamentos", views: "visualizações", shares: "compartilhamentos", reach: "alcance" };
      const num = (p, k, icone) => `<span class="${ordemPosts === k ? "em-foco" : ""}" title="${nomes[k]}">${icone} ${p[k] == null ? "–" : fmtNum(p[k])}</span>`;
      alvo.innerHTML = `<div class="galeria-posts">${ordenados.map((p, i) => `<a class="card-post" ${p.permalink ? `href="${esc(p.permalink)}" target="_blank" rel="noopener"` : ""} title="${esc(p.caption || "")}">
          <div class="capa-post" style="background-image:url('${esc(p.thumbnail_url || "")}')"><span class="pos">${i + 1}º</span><span class="tipo-post">${esc({ VIDEO: "reels", CAROUSEL_ALBUM: "carrossel", IMAGE: "foto" }[p.media_type] || "")}</span></div>
          <div class="nums-post">${num(p, "likes", "❤️")}${num(p, "comments", "💬")}${num(p, "saved", "🔖")}${num(p, "shares", "🚀")}${num(p, "views", "👀")}${num(p, "reach", "📣")}</div></a>`).join("")}</div>
        <p class="suave" style="font-size:12px;margin-top:8px">Só aparecem posts publicados pela própria conta (collabs publicadas por outra conta não vêm pela API). "Melhores" pesa alcance, salvamentos, compartilhamentos, comentários e curtidas.</p>`;
      $$("[data-ordem-post]", el).forEach((b) => b.classList.toggle("ativo", b.dataset.ordemPost === ordemPosts));
    };
    const engajadas = api && api.engajadas != null ? api.engajadas : null, interacoes = api && api.interacoes != null ? api.interacoes : null;

    el.innerHTML = seletorPeriodo() + (erroApi ? `<div class="faixa alerta">Não consegui falar com o Instagram agora (${esc(erroApi)}). Mostrando os dados já salvos.</div>` : "") + `
      <div class="grade tres" style="margin-bottom:16px">
        ${kpi(api ? api.seguidores : (hist.filter((d) => d.seguidores != null).pop() || {}).seguidores, `seguidores (@${esc(conta.username || "")})`, "")}
        ${kpi(soma(novosMap, inicio), `novos seguidores (${dias}d)`, delta(soma(novosMap, inicio), soma(novosMap, inicioAnt), temDado(novosMap, inicioAnt)))}
        ${kpi(soma(alcanceMap, inicio), `alcance (${dias}d)`, delta(soma(alcanceMap, inicio), soma(alcanceMap, inicioAnt), temDado(alcanceMap, inicioAnt)))}
        ${kpi(engajadas, `contas engajadas (${dias}d)`, engajadas == null ? `<span class="delta neutro">o Instagram não entregou</span>` : "")}
        ${kpi(interacoes, `interações (${dias}d)`, interacoes == null ? `<span class="delta neutro">o Instagram não entregou</span>` : `<span class="delta neutro">curtidas, comentários, salvos e compartilhamentos</span>`)}
        ${kpi(leadsAt.length, `leads captados (${dias}d)`, delta(leadsAt.length, leadsAnt.length))}
      </div>
      <div class="grade duas">
        <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">📈 Novos seguidores por dia</h2><small>passe o mouse para ver os números</small></div>${graficoBarras(pontos(novosMap, inicio), "novos seguidores")}${resumoSerie(pontos(novosMap, inicio), "+")}${dias > 30 ? `<small class="suave">O Instagram só entrega novos seguidores dos últimos 30 dias; o resto vem do histórico salvo.</small>` : ""}</div>
        <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">📣 Alcance por dia</h2><small>passe o mouse para ver os números</small></div>${graficoBarras(pontos(alcanceMap, inicio), "de alcance")}${resumoSerie(pontos(alcanceMap, inicio))}<small class="suave">DMs entregues pelas automações no período: <strong>${okAt}</strong></small> ${delta(okAt, okAnt)}</div>
      </div>
      <div class="cartao"><div class="linha" style="justify-content:space-between;margin-bottom:10px"><div class="titulo-grafico"><h2 style="margin:0">🔥 Melhores posts</h2><small>últimos ${dias} dias</small></div>
        <div class="pilulas-filtro">${ORDENS.map(([k, n]) => `<button data-ordem-post="${k}" class="${ordemPosts === k ? "ativo" : ""}">${n}</button>`).join("")}</div></div><div id="bloco-posts"></div></div>
      <div class="cartao"><h2>🧲 Funil das automações</h2>${funil}</div>
      <div class="cartao"><h2>🕐 Melhor dia e horário</h2>${calor}</div>`;
    ligarPeriodo();
    pintarPosts();
    trocarImagensQuebradas(el);
    $$("[data-ordem-post]", el).forEach((b) => b.onclick = () => { ordemPosts = b.dataset.ordemPost; pintarPosts(); });
  };

  const seletorPeriodo = () => `<div class="linha" style="margin-bottom:14px"><span class="suave">Período:</span>
    <div class="opcoes-radio">${[7, 15, 30, 90].map((d) => `<label><input type="radio" name="periodo-met" value="${d}" ${dias === d ? "checked" : ""}> ${d} dias</label>`).join("")}</div></div>`;
  const ligarPeriodo = () => $$("input[name=periodo-met]", el).forEach((r) => r.onchange = () => {
    dias = Number(r.value);
    try { localStorage.setItem("portal-metricas-dias", String(dias)); } catch (_) { /* sem storage */ }
    desenhar();
  });
  await desenhar();
}

// ---------------------------------------------------------------- Comentários
// "Quem mais comenta" e "Oportunidades de conteúdo" (dúvidas e interesses), sem IA paga.
async function abaComentarios(el, c) {
  const conta = await contaDoCliente(c);
  if (!conta) { el.innerHTML = vazio("Conecte o Instagram para analisar os comentários.") + `<p style="text-align:center;margin-top:10px"><a class="btn primario" href="#/instagram/contas">Ir para Contas</a></p>`; return; }
  const [coments, midias, ideias, cer] = await Promise.all([
    D.lista("ig_comentarios", { eq: { cliente_id: c.id }, ordem: "-timestamp", limite: 20000 }).catch(() => []),
    D.lista("ig_midias", { eq: { cliente_id: c.id } }, "media_id, permalink, thumbnail_url").catch(() => []),
    D.lista("geracoes", { eq: { cliente_id: c.id, tarefa: "ideias-de-video" }, ordem: "-created_at", limite: 1 }).catch(() => []),
    D.um("cerebro", { eq: { cliente_id: c.id } }).catch(() => null),
  ]);
  const linkDo = (mediaId) => (midias.find((m) => m.media_id === mediaId) || {}).permalink || "";
  const ultima = coments.reduce((m, x) => (x.atualizado_em > m ? x.atualizado_em : m), "");
  const comUsuario = coments.filter((x) => x.username);
  const pessoas = new Set(comUsuario.map((x) => x.username)).size;
  const duvidas = coments.filter((x) => x.categoria === "duvida"), interesses = coments.filter((x) => x.categoria === "interesse");
  let filtro = "tudo", mostrar = 30;

  // Ranking: quantos comentários (e respostas) cada pessoa fez
  const contagem = {};
  comUsuario.forEach((x) => { const k = x.username; contagem[k] = contagem[k] || { n: 0, ultimo: "" }; contagem[k].n++; if ((x.timestamp || "") > contagem[k].ultimo) contagem[k].ultimo = x.timestamp || ""; });
  const ranking = Object.entries(contagem).sort((a, b) => b[1].n - a[1].n).slice(0, 30);
  const medalha = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;

  const pintarOportunidades = () => {
    const lista = filtro === "duvida" ? duvidas : filtro === "interesse" ? interesses : [...duvidas, ...interesses].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    const alvo = $("#lista-oport");
    alvo.innerHTML = lista.length ? lista.slice(0, mostrar).map((x) => `<div class="oport">
        <div class="linha" style="justify-content:space-between;flex-wrap:nowrap;gap:8px"><strong>${x.username ? `<a href="https://www.instagram.com/${esc(x.username)}/" target="_blank" rel="noopener">@${esc(x.username)}</a>` : "Perfil sem @"}</strong>
          <span class="pilula ${x.categoria === "duvida" ? "alerta" : "destaque"}">${x.categoria === "duvida" ? "❓ Dúvida" : "✨ Interesse"}</span></div>
        <p style="margin:4px 0">${esc(x.texto || "")}</p>
        <div class="linha" style="font-size:13px"><small class="suave">${x.timestamp ? fmtData(x.timestamp) : ""}</small>
          ${linkDo(x.media_id) ? `<a href="${esc(linkDo(x.media_id))}" target="_blank" rel="noopener">ver post ↗</a>` : ""}
          ${x.virou_pauta ? `<span class="pilula ok">virou pauta ✓</span>` : `<button class="btn pequeno" data-pauta-com="${esc(x.comment_id)}">Virar pauta</button>`}</div>
      </div>`).join("") + (lista.length > mostrar ? `<p style="text-align:center"><button class="btn" id="mais-oport">Mostrar mais (${lista.length - mostrar})</button></p>` : "")
      : vazio(filtro === "tudo" ? "Nenhuma dúvida ou interesse encontrado ainda. Clique em Atualizar comentários." : "Nada nesta categoria ainda.");
    $$("[data-f-oport]", el).forEach((b) => b.classList.toggle("ativo", b.dataset.fOport === filtro));
    if ($("#mais-oport")) $("#mais-oport").onclick = () => { mostrar += 30; pintarOportunidades(); };
    $$("[data-pauta-com]", alvo).forEach((b) => b.onclick = async () => {
      const x = coments.find((k) => k.comment_id === b.dataset.pautaCom);
      try {
        await D.inserir("posts", { cliente_id: c.id, data: somarDias(hojeISO(), 7), tema: (x.categoria === "duvida" ? "Responder: " : "") + String(x.texto || "").slice(0, 90), status: "pauta", formato: "reels", midias: [] });
        await D.atualizar("ig_comentarios", { comment_id: x.comment_id }, { virou_pauta: true });
        x.virou_pauta = true; avisar("Virou pauta no calendário (daqui a 7 dias).", "ok"); pintarOportunidades();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    });
  };

  el.innerHTML = `<div class="linha" style="justify-content:space-between;margin-bottom:12px">
      <p class="suave" style="margin:0">🕘 Última atualização: <strong>${ultima ? new Date(ultima).toLocaleString("pt-BR") : "nunca"}</strong>. Comentários novos chegam sozinhos; o botão busca os antigos dos últimos 30 posts.</p>
      <button class="btn primario" id="atualizar-com">↻ Atualizar comentários</button></div>
    <div class="grade quatro" style="margin-bottom:16px">
      <div class="kpi"><small>💬 Comentários analisados</small><div class="numero-grande">${fmtNum(coments.length)}</div></div>
      <div class="kpi"><small>👥 Pessoas diferentes</small><div class="numero-grande">${fmtNum(pessoas)}</div></div>
      <div class="kpi destaque"><small>❓ Dúvidas</small><div class="numero-grande">${fmtNum(duvidas.length)}</div></div>
      <div class="kpi"><small>✨ Interesses</small><div class="numero-grande">${fmtNum(interesses.length)}</div></div>
    </div>
    <div class="cartao"><div class="linha" style="justify-content:space-between"><div class="titulo-grafico"><h2 style="margin:0">🎬 Ideias de vídeo</h2><small>geradas no seu Claude a partir das dúvidas e interesses</small></div>
        <button class="btn" id="gerar-ideias" ${duvidas.length + interesses.length ? "" : "disabled"}>✨ Gerar ideias no Claude</button></div>
      ${ideias.length ? `<div style="margin-top:10px">${md(ideias[0].resposta_colada)}</div><small class="suave">Salvas em ${fmtData(ideias[0].created_at)}.</small>` : `<p class="suave" style="margin-top:8px">O botão monta um prompt com as dúvidas e os interesses reais do público. Você cola no Claude que já assina, traz a resposta e salva aqui. Sem custo extra.</p>`}</div>
    <div class="grade duas">
      <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">🏆 Quem mais comenta</h2><small>todos os posts analisados</small></div>
        <p class="suave" style="font-size:13px;margin:2px 0 10px">Soma comentários e respostas. Boas pessoas para responder, convidar ou agradecer.</p>
        ${ranking.length ? `<div class="ranking">${ranking.map(([u, d], i) => `<div class="item-ranking"><span class="pos-ranking">${medalha(i)}</span>
          <a href="https://www.instagram.com/${esc(u)}/" target="_blank" rel="noopener">@${esc(u)}</a><span class="espaco-flex"></span>
          <small class="suave">${d.ultimo ? tempoRelativo(d.ultimo) : ""}</small><strong>${d.n} comentário${d.n > 1 ? "s" : ""}</strong></div>`).join("")}</div>`
          : vazio("Ninguém ainda. Clique em Atualizar comentários.")}</div>
      <div class="cartao"><div class="titulo-grafico"><h2 style="margin:0">💡 Oportunidades de conteúdo</h2><small>dúvidas e interesses reais</small></div>
        <p class="suave" style="font-size:13px;margin:2px 0 10px">Já filtradas de comentários genéricos como "amei", "sim" e "quero". Responda ou transforme em vídeo.</p>
        <div class="pilulas-filtro" style="margin-bottom:10px"><button data-f-oport="tudo">Tudo (${duvidas.length + interesses.length})</button>
          <button data-f-oport="duvida">❓ Dúvidas (${duvidas.length})</button><button data-f-oport="interesse">✨ Interesses (${interesses.length})</button></div>
        <div id="lista-oport" class="lista-oport"></div></div>
    </div>`;
  pintarOportunidades();
  $$("[data-f-oport]", el).forEach((b) => b.onclick = () => { filtro = b.dataset.fOport; mostrar = 30; pintarOportunidades(); });

  $("#atualizar-com").onclick = async () => {
    const b = $("#atualizar-com"); b.disabled = true; b.textContent = "Buscando comentários...";
    try {
      const r = await D.funcao("ig-comentarios", { cliente_id: c.id, posts: 30 });
      avisar(`${r.comentarios} comentários de ${r.posts} posts: ${r.duvidas} dúvidas e ${r.interesses} interesses.`, "ok");
      rotear();
    } catch (e) { avisar(erroAmigavel(e), "erro"); b.disabled = false; b.textContent = "↻ Atualizar comentários"; }
  };

  // Plano B sem custo: monta o prompt com as dúvidas e interesses e salva a resposta colada
  $("#gerar-ideias").onclick = () => {
    const amostra = [...duvidas.slice(0, 25).map((x) => `- [dúvida] "${x.texto}"`), ...interesses.slice(0, 15).map((x) => `- [interesse] "${x.texto}"`)].join("\n");
    const publico = cer ? (secaoMd(cer.conteudo_md, "## 2. Público") || "") : "";
    const voz = cer ? (secaoMd(cer.conteudo_md, "## 3. Voz") || "") : "";
    const prompt = `Você é estrategista de conteúdo para Instagram, escrevendo para ${c.nome}.

Contexto do público:
${publico || "(ver Cérebro da Marca)"}

Voz da marca:
${voz || "(ver Cérebro da Marca)"}

Comentários reais do público (frases exatas):
${amostra}

Regras de escrita: nunca use travessão; concreto no lugar do abstrato; nada de começos e finais de IA; não invente números nem depoimentos.

Tarefa: agrupe os comentários pelos assuntos que mais se repetem e proponha de 6 a 8 ideias de vídeo, cada uma respondendo a uma dúvida ou interesse real.

Formato de saída (exatamente assim, para colar de volta no portal):
## [Assunto]
- Ideia: ...
- Gancho (primeira frase do vídeo): ...
- Comentários que inspiraram: ...`;
    const m = abrirModal("Gerar ideias de vídeo no Claude", `<p class="suave">1. Copie o prompt e cole no Claude. 2. Cole a resposta aqui embaixo e salve.</p>
      <textarea class="grande" id="ideias-prompt" readonly>${esc(prompt)}</textarea>
      <div class="linha" style="margin-top:8px"><button class="btn primario" id="ideias-copiar">Copiar prompt</button></div>
      <label>Resposta do Claude</label><textarea class="grande" id="ideias-resp" placeholder="Cole aqui a resposta"></textarea>
      <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="ideias-salvar">Salvar ideias</button></div>`, { largo: true });
    $("#ideias-copiar", m).onclick = async () => { try { await navigator.clipboard.writeText(prompt); } catch (_) { $("#ideias-prompt", m).select(); document.execCommand("copy"); } avisar("Prompt copiado.", "ok"); };
    $("#ideias-salvar", m).onclick = async () => {
      const resp = $("#ideias-resp", m).value.trim();
      if (!resp) { avisar("Cole a resposta do Claude antes de salvar."); return; }
      try { await D.inserir("geracoes", { cliente_id: c.id, tarefa: "ideias-de-video", prompt_usado: prompt, resposta_colada: resp }); fecharModal(); avisar("Ideias salvas.", "ok"); rotear(); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
}

// ---------------------------------------------------------------- Automações
function miniaturaAutomacao(a, midias) {
  const ids = a.media_ids || [];
  const primeira = midias.find((m) => m.media_id === ids[0]);
  const icone = `<span class="mini" title="${esc(a.keyword || "")}">${esc((a.match_any ? "qualquer" : (a.keyword || "").split(",")[0] || "?").trim().slice(0, 10))}</span>`;
  const img = primeira && primeira.thumbnail_url ? `<img class="mini" src="${esc(primeira.thumbnail_url)}" alt="" data-falha="${esc((a.keyword || "").split(",")[0].slice(0, 10))}">` : icone;
  return `<span class="mini-envolve">${img}${ids.length > 1 ? `<span class="mini-mais">+${ids.length - 1}</span>` : ""}</span>`;
}
/** Imagem que falhar vira o ícone neutro com a palavra-chave. */
function trocarImagensQuebradas(raiz) {
  $$("img.mini[data-falha], img.mini-grande[data-falha]", raiz).forEach((img) => {
    img.onerror = () => { const s = document.createElement("span"); s.className = "mini"; s.textContent = img.dataset.falha || "post"; img.replaceWith(s); };
  });
}

async function abaAutomacoes(el, c) {
  const trinta = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const [autos, midias, conta, alertas, entregas, leads] = await Promise.all([
    D.lista("ig_automations", { eq: { cliente_id: c.id }, ordem: "-updated_at" }),
    D.lista("ig_midias", { eq: { cliente_id: c.id } }).catch(() => []),
    contaDoCliente(c),
    ehSM() ? D.lista("ig_alertas", { eq: { cliente_id: c.id, visto: false } }).catch(() => []) : Promise.resolve([]),   // avisos são só da social media
    D.lista("ig_deliveries", { eq: { cliente_id: c.id }, gte: { ts: trinta }, limite: 20000 }, "automation_id, ig_user_id, tipo, status").catch(() => []),
    D.lista("ig_leads", { eq: { cliente_id: c.id }, gte: { created_at: trinta } }, "automation_id, email, telefone").catch(() => []),
  ]);
  // Números de cada automação nos últimos 30 dias (a partir dos envios e dos leads)
  const numeros = (a) => {
    const env = entregas.filter((d) => d.automation_id === a.id);
    const ok = env.filter((d) => d.status === "ok");
    return {
      pessoas: new Set(ok.map((d) => d.ig_user_id)).size,
      enviadas: ok.length,
      links: new Set(ok.filter((d) => d.tipo === "link").map((d) => d.ig_user_id)).size,
      fila: env.filter((d) => d.status === "na_fila").length,
      erros: env.filter((d) => d.status === "erro").length,
      leads: leads.filter((l) => l.automation_id === a.id).length,
      contatos: leads.filter((l) => l.automation_id === a.id && (l.email || l.telefone)).length,
    };
  };
  const celulaNumeros = (n) => `<div class="nums-auto">
      <span title="Pessoas que receberam a DM"><strong>${n.pessoas}</strong> pessoas</span>
      <span title="Leads novos captados"><strong>${n.leads}</strong> leads</span>
      <span title="Pessoas que receberam o link"><strong>${n.links}</strong> links</span>
      ${n.contatos ? `<span title="Deixaram e-mail ou telefone"><strong>${n.contatos}</strong> contatos</span>` : ""}
      ${n.erros ? `<span class="nums-erro" title="Envios que falharam"><strong>${n.erros}</strong> erro${n.erros > 1 ? "s" : ""}</span>` : ""}
      ${n.fila ? `<span class="nums-fila" title="Esperando o freio de envio"><strong>${n.fila}</strong> na fila</span>` : ""}
    </div>`;
  const totais = autos.reduce((s, a) => { const n = numeros(a); s.pessoas += n.pessoas; s.leads += n.leads; s.links += n.links; s.erros += n.erros; return s; }, { pessoas: 0, leads: 0, links: 0, erros: 0 });

  el.innerHTML = `${!conta ? `<div class="faixa alerta">Este cliente ainda não tem conta conectada. As automações só funcionam depois de conectar em <a href="#/instagram/contas">Contas</a>.</div>` : ""}
    ${alertas.map((a) => `<div class="faixa alerta">${a.tipo === "cliente" ? "🔔" : "⚠️"} ${esc(a.mensagem)}</div>`).join("")}
    ${autos.length && ehSM() ? `<div class="grade quatro" style="margin-bottom:14px">
      <div class="kpi"><div class="numero-grande">${autos.filter((a) => a.active).length}<span class="suave" style="font-size:16px;font-weight:600"> / ${autos.length}</span></div><small>automações ativas</small></div>
      <div class="kpi"><div class="numero-grande">${totais.pessoas}</div><small>pessoas atendidas em 30 dias</small></div>
      <div class="kpi"><div class="numero-grande">${totais.leads}</div><small>leads novos em 30 dias</small></div>
      <div class="kpi"><div class="numero-grande">${totais.links}</div><small>receberam o link em 30 dias</small></div></div>` : ""}
    <div class="linha" style="justify-content:space-between;margin-bottom:12px"><p class="suave" style="margin:0">${autos.length} automaç${autos.length === 1 ? "ão" : "ões"} · ${autos.filter((a) => a.active).length} ativa${autos.filter((a) => a.active).length === 1 ? "" : "s"}. Regra: nunca vender na mensagem, uma frase e o botão.</p>
      <button class="btn primario" id="nova-auto">+ Nova automação</button></div>
    ${autos.length ? `<div class="lista-auto">${autos.map((a) => {
      // primeiro link de destino que aparece na conversa (botão de link)
      const link = ((a.flow && a.flow.steps) || []).flatMap((p) => p.buttons || []).map((b) => b.url).find(Boolean);
      const gat = (a.gatilhos && a.gatilhos.length ? a.gatilhos : ["comentario", "dm"]);
      return `<div class="card-auto ${a.active ? "" : "pausada"}">
        ${miniaturaAutomacao(a, midias)}
        <div style="min-width:0">
          <div class="titulo-auto">${esc(a.nome)} ${gat.map((g) => `<span class="pilula">${{ comentario: "💬 Comentário", dm: "✉️ Direct", story: "↩️ Stories" }[g] || esc(g)}</span>`).join("")}</div>
          <div class="linha-chips">${a.match_any ? `<span class="pilula">qualquer palavra</span>` : (a.keyword || "").split(",").filter((k) => k.trim()).map((k) => `<span class="pilula destaque">${esc(k.trim())}</span>`).join("")}
            ${a.story_qualquer && gat.includes("story") ? `<span class="pilula">qualquer resposta ao story</span>` : ""}
            <span>· ${a.media_ids && a.media_ids.length ? a.media_ids.length + " post" + (a.media_ids.length > 1 ? "s" : "") : "todos os posts"}</span></div>
          <div class="link-auto" title="${esc(link || "")}">🔗 ${link ? esc(link) : "(sem link: continua a conversa)"}</div>
          ${ehSM() ? `<div style="margin-top:8px">${celulaNumeros(numeros(a))}</div>` : ""}
        </div>
        <div class="acoes-auto"><label class="interruptor" title="${a.active ? "Ativa" : "Pausada"}"><input type="checkbox" data-ativa="${esc(a.id)}" ${a.active ? "checked" : ""}></label>
          <a class="btn pequeno" href="${rotaEditorAutomacao(esc(a.id))}">Editar</a><button class="btn pequeno" data-duplicar="${esc(a.id)}">Duplicar</button>${ehSM() ? `<button class="btn pequeno perigo" data-apagar="${esc(a.id)}" aria-label="Apagar">🗑</button>` : ""}</div>
      </div>`; }).join("")}</div>` : vazio("Nenhuma automação ainda. Crie a primeira com um dos modelos prontos.")}`;
  trocarImagensQuebradas(el);
  $("#nova-auto").onclick = () => {
    const m = abrirModal("Nova automação", `<p class="suave">Escolha um modelo pronto. Regra embutida: nunca vender na mensagem, uma frase e o botão.</p>
      <div class="lista-acoes">${Object.entries(MODELOS_AUTOMACAO).map(([k, v]) => `<button class="item-acao" data-modelo="${k}"><span class="icone">${{ captacao_vip: "⭐", abertura: "🚀", material: "💌" }[k]}</span><span class="texto"><strong>${esc(v.nome)}</strong><br><small>"${esc(v.mensagem)}"</small></span><span class="seta">›</span></button>`).join("")}
      <button class="item-acao" data-modelo="livre"><span class="icone">✏️</span><span class="texto"><strong>Em branco</strong><br><small>Começar do zero</small></span><span class="seta">›</span></button></div>`);
    $$("[data-modelo]", m).forEach((b) => b.onclick = () => { fecharModal(); location.hash = rotaEditorAutomacao("novo-" + b.dataset.modelo); });
  };
  $$("[data-ativa]", el).forEach((cb) => cb.onchange = async () => {
    try { await D.atualizar("ig_automations", { id: cb.dataset.ativa }, { active: cb.checked }); avisar(cb.checked ? "Automação ativada." : "Automação pausada.", "ok"); }
    catch (e) { cb.checked = !cb.checked; avisar(erroAmigavel(e), "erro"); }
  });
  // Duplicar: copia tudo (mensagens, botões, gatilhos), pausada, e abre o editor da cópia
  $$("[data-duplicar]", el).forEach((b) => b.onclick = async () => {
    const a = autos.find((x) => x.id === b.dataset.duplicar);
    const copia = JSON.parse(JSON.stringify(a));
    ["id", "created_at", "updated_at"].forEach((k) => delete copia[k]);
    copia.nome = a.nome + " (cópia)";
    copia.active = false;
    try { const nova = await D.inserir("ig_automations", copia); avisar("Cópia criada (pausada). Troque a palavra e o post e salve.", "ok"); location.hash = rotaEditorAutomacao(nova.id); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-apagar]", el).forEach((b) => b.onclick = async () => {
    if (!(await confirmar("Apagar esta automação? Os contatos continuam salvos.", "Apagar", true))) return;
    try { await D.apagar("ig_automations", { id: b.dataset.apagar }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
}

// ---------------------------------------------------------------- Editor de automação
async function editorAutomacao(el, idOuNovo) {
  const c = clienteAtual();
  const conta = await contaDoCliente(c);
  let midias = await D.lista("ig_midias", { eq: { cliente_id: c.id }, ordem: "-timestamp" }).catch(() => []);
  const assets = await D.lista("ig_assets", { eq: { cliente_id: c.id } }).catch(() => []);
  let a;
  if (idOuNovo && !idOuNovo.startsWith("novo")) {
    a = await D.um("ig_automations", { eq: { id: idOuNovo } });
    if (!a) { el.innerHTML = vazio("Automação não encontrada."); return; }
  } else {
    const mod = (idOuNovo || "novo-livre").replace("novo-", "");
    const base = MODELOS_AUTOMACAO[mod] || { nome: "", keyword: "", public_reply: "", public_reply_variants: [], mensagem: "", botao: "Acessar" };
    a = { id: null, cliente_id: c.id, ig_account_id: conta ? conta.ig_account_id : "", nome: base.nome, keyword: base.keyword, match_any: false, active: false, media_ids: [],
      public_reply: base.public_reply, public_reply_variants: base.public_reply_variants.slice(), modelo: MODELOS_AUTOMACAO[mod] ? mod : "livre", asset_ids: [],
      flow: { steps: [{ id: 1, message: base.mensagem, buttons: [{ title: base.botao, url: "" }] }] } };
  }

  // ----- Estado do editor (a partir do flow salvo)
  const passos = (a.flow && a.flow.steps) || [];
  const p1 = passos[0] || { id: 1, message: "", buttons: [] };
  const b1 = (p1.buttons || [])[0];
  const E = {
    nome: a.nome || "", tags: (a.keyword || "").split(",").map((k) => k.trim()).filter(Boolean), qualquer: !!a.match_any,
    media_ids: (a.media_ids || []).slice(), resposta: a.public_reply || "", variantes: (a.public_reply_variants || []).slice(),
    mensagem: p1.message || "", temBotao: b1 ? true : !passos.length, textoBotao: b1 ? b1.title : "Acessar",
    acao: b1 && (b1.next || b1.next === 0) ? "conversa" : "link", url: (b1 && b1.url) || "",
    anexo: (p1.assets || [])[0] || "",
    // onde dispara: comentário em post, direct e/ou resposta a story (07-stories.sql)
    gatilhos: (a.gatilhos && a.gatilhos.length ? a.gatilhos : ["comentario", "dm"]).slice(),
    storyQualquer: !!a.story_qualquer, story_ids: (a.story_ids || []).slice(),
    // mensagens do construtor (2 em diante). acaoBotao guarda a escolha em estado próprio,
    // para o campo de link aparecer NA HORA mesmo vazio.
    msgs: passos.slice(1).map((p) => ({ id: p.id, message: p.message || "", buttons: (p.buttons || []).map((b) => ({ title: b.title, url: b.url || "", next: b.next ?? "", acao: b.url ? "link" : (b.next || b.next === 0) ? "ir" : "encerrar" })),
      collect: p.collect ? p.collect.field : "" })),
    previaCaminho: [],
  };
  if (E.acao === "conversa" && !E.msgs.length) E.msgs.push({ id: 2, message: "", buttons: [], collect: "" });
  let proximoId = Math.max(1, ...E.msgs.map((m) => Number(m.id) || 0)) + 1;
  const sujar = () => { S.sujo = true; atualizarPrevia(); };

  const primeiraMidia = midias.find((m) => m.media_id === E.media_ids[0]);
  el.innerHTML = cabecalho(a.id ? "Editar automação" : "Nova automação", esc(c.nome), `<a class="btn" href="${rotaListaAutomacoes()}">Voltar</a><button class="btn primario" id="salvar-auto">Salvar</button>`) + `
    ${S.modo === "local" ? `<div class="faixa info">Modo de teste: a automação fica salva só neste navegador e nada é enviado ao Instagram.</div>` : ""}
    ${!conta ? `<div class="faixa alerta">Sem conta conectada: dá para montar e salvar, mas a automação só funciona depois de conectar o Instagram.</div>` : ""}
    <div class="editor-auto"><div>
      <div class="cartao" id="topo-post"></div>
      <div class="cartao"><h2>Gatilho</h2>
        <label>Nome da automação</label><input type="text" id="e-nome" value="${esc(E.nome)}" placeholder="Ex.: Lista de lanches">
        <label>Onde esta automação responde</label>
        <div class="opcoes-radio" id="e-gatilhos">
          <label><input type="checkbox" data-gat="comentario" ${E.gatilhos.includes("comentario") ? "checked" : ""}> 💬 Comentário em post</label>
          <label><input type="checkbox" data-gat="dm" ${E.gatilhos.includes("dm") ? "checked" : ""}> ✉️ Mensagem no direct</label>
          <label><input type="checkbox" data-gat="story" ${E.gatilhos.includes("story") ? "checked" : ""}> ↩️ Resposta aos stories</label>
        </div>
        <label>Palavras-chave (Enter adiciona)</label><div class="tags" id="e-tags"></div>
        <small class="suave" id="dica-palavra"></small>
        <div id="bloco-comentario">
          <h3 style="margin-top:16px">Comentários em posts</h3>
          <label class="interruptor"><input type="checkbox" id="e-qualquer" ${E.qualquer ? "checked" : ""}> Qualquer palavra ativa (todo comentário recebe a DM)</label>
          <label>Em quais posts</label><p class="suave" style="margin:0 0 6px">Sem nenhum marcado, vale para todos os posts.</p><div id="e-posts"></div>
          <label>Resposta pública no comentário</label><input type="text" id="e-resposta" value="${esc(E.resposta)}" placeholder="Te mandei no direct!">
          <div id="e-variantes"></div><button class="btn pequeno" id="add-var" type="button">+ Variação (teste A/B)</button>
        </div>
        <div id="bloco-story">
          <h3 style="margin-top:16px">Respostas aos stories</h3>
          <label class="interruptor"><input type="checkbox" id="e-story-qualquer" ${E.storyQualquer ? "checked" : ""}> Qualquer resposta ao story dispara (mesmo sem a palavra-chave)</label>
          <label>Em quais stories</label><p class="suave" style="margin:0 0 6px">Stories somem em 24 horas. Sem nenhum marcado, vale para qualquer story, inclusive os próximos que você postar.</p><div id="e-stories"></div>
          <p class="suave" style="margin-top:6px">Cada pessoa recebe no máximo 1 resposta automática de story por dia nesta automação.</p>
        </div>
      </div>
      <div class="cartao"><h2>Resposta no direct</h2>
        <label>Sua mensagem</label><div class="emojis" id="emojis">${EMOJIS.map((x) => `<button type="button">${x}</button>`).join("")}</div>
        <textarea id="e-msg" placeholder="Uma frase. Ex.: Aqui está o material que você pediu.">${esc(E.mensagem)}</textarea>
        <label class="interruptor"><input type="checkbox" id="e-tembotao" ${E.temBotao ? "checked" : ""}> Botão na mensagem</label>
        <div id="bloco-botao">
          <label>Texto do botão</label><input type="text" id="e-txtbotao" maxlength="20" value="${esc(E.textoBotao)}"><div class="contador" id="cont-botao"></div>
          <label>O que o botão faz</label><div class="opcoes-radio">
            <label><input type="radio" name="acao" value="link" ${E.acao === "link" ? "checked" : ""}> Um link</label>
            <label><input type="radio" name="acao" value="conversa" ${E.acao === "conversa" ? "checked" : ""}> Continua a conversa</label></div>
          <div id="bloco-link"><label>Link (cole a URL inteira)</label><textarea class="url-grande" id="e-url" placeholder="https://...">${esc(E.url)}</textarea></div>
          <div id="bloco-conversa"></div>
        </div>
        <label>Anexar arquivo da biblioteca (opcional)</label><select id="e-anexo"><option value="">Nenhum</option>${assets.map((x) => `<option value="${esc(x.id)}" ${E.anexo === x.id ? "selected" : ""}>${esc(x.nome)} (${esc(x.tipo)})</option>`).join("")}</select>
      </div>
    </div>
    <div class="previa"><h3>Prévia no celular</h3><div class="celular"><div class="barra"></div><div class="conversa" id="previa"></div></div><p class="suave" style="text-align:center;margin-top:8px">Toque nos botões da prévia para seguir a conversa.</p></div></div>`;

  // ----- topo: post vinculado
  const desenharTopo = () => {
    const pm = midias.find((m) => m.media_id === E.media_ids[0]);
    $("#topo-post").innerHTML = pm ? `<div class="linha"><img class="mini-grande" src="${esc(pm.thumbnail_url || "")}" alt="" data-falha="post">
      <div><strong>Post vinculado</strong>${E.media_ids.length > 1 ? ` <span class="pilula">+${E.media_ids.length - 1}</span>` : ""}<br><small>${esc(pm.caption || "")}</small><br>
      ${pm.permalink ? `<a href="${esc(pm.permalink)}" target="_blank" rel="noopener">Abrir no Instagram ↗</a>` : ""}</div></div>`
      : `<div class="linha"><span class="mini" style="width:96px;height:96px;flex-basis:96px">${esc(E.qualquer ? "qualquer" : E.tags[0] || "todos")}</span><div><strong>Vale para todos os posts</strong><br><small>Escolha posts abaixo para limitar.</small></div></div>`;
    trocarImagensQuebradas($("#topo-post"));
  };
  void primeiraMidia;

  // ----- tags
  const desenharTags = () => {
    $("#e-tags").innerHTML = E.tags.map((t, i) => `<span class="pilula destaque">${esc(t)}<button type="button" data-rm="${i}" aria-label="Remover">×</button></span>`).join("") + `<input type="text" id="e-novatag" placeholder="${E.tags.length ? "" : "Ex.: QUERO"}">`;
    $$("[data-rm]", $("#e-tags")).forEach((b) => b.onclick = () => { E.tags.splice(Number(b.dataset.rm), 1); desenharTags(); sujar(); });
    const inp = $("#e-novatag");
    const add = () => { const v = inp.value.replace(/,/g, " ").trim(); if (v && !E.tags.some((t) => normalizar(t) === normalizar(v))) { E.tags.push(v); desenharTags(); sujar(); $("#e-novatag").focus(); } else inp.value = ""; };
    inp.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === ",") { ev.preventDefault(); add(); } else if (ev.key === "Backspace" && !inp.value && E.tags.length) { E.tags.pop(); desenharTags(); sujar(); } };
    inp.onblur = () => { if (inp.value.trim()) add(); };
  };

  // ----- posts e stories (o ig-media guarda stories com media_type "STORY")
  const listaPosts = () => midias.filter((m) => m.media_type !== "STORY");
  const listaStories = () => midias.filter((m) => m.media_type === "STORY");
  const recarregarMidias = async () => { await D.funcao("ig-media", { cliente_id: c.id }); midias = await D.lista("ig_midias", { eq: { cliente_id: c.id }, ordem: "-timestamp" }); desenharPosts(); desenharStories(); };

  const desenharStories = () => {
    const alvo = $("#e-stories");
    const sts = listaStories();
    alvo.innerHTML = (sts.length ? `<div class="grade-midias">${sts.map((m) => `<button type="button" class="${E.story_ids.includes(m.media_id) ? "marcada" : ""}" data-sid="${esc(m.media_id)}" title="Story de ${esc(fmtData(m.timestamp))}" style="aspect-ratio:9/16"><img src="${esc(m.thumbnail_url || "")}" alt="" loading="lazy"></button>`).join("")}</div>`
      : `<p class="suave">Nenhum story ativo carregado.</p>`) +
      `<div class="linha" style="margin-top:6px"><small>${E.story_ids.length ? E.story_ids.length + " marcado(s)" : "nenhum marcado: vale para qualquer story"}</small><button class="btn pequeno" type="button" id="carregar-stories">Carregar stories ativos</button></div>`;
    $$("[data-sid]", alvo).forEach((b) => b.onclick = () => {
      const id = b.dataset.sid, i = E.story_ids.indexOf(id);
      if (i >= 0) E.story_ids.splice(i, 1); else E.story_ids.push(id);
      desenharStories(); sujar();
    });
    $("#carregar-stories").onclick = async () => { try { await recarregarMidias(); avisar("Stories atualizados.", "ok"); } catch (e) { avisar(erroAmigavel(e), "erro"); } };
  };

  // Mostra só as opções dos gatilhos marcados e explica quando a palavra-chave é usada
  const atualizarGatilhos = () => {
    $("#bloco-comentario").classList.toggle("escondido", !E.gatilhos.includes("comentario"));
    $("#bloco-story").classList.toggle("escondido", !E.gatilhos.includes("story"));
    const usa = [];
    if (E.gatilhos.includes("comentario") && !E.qualquer) usa.push("comentários");
    if (E.gatilhos.includes("dm")) usa.push("mensagens no direct");
    if (E.gatilhos.includes("story") && !E.storyQualquer) usa.push("respostas aos stories");
    $("#dica-palavra").textContent = usa.length ? "A palavra-chave vale para: " + usa.join(", ") + "." : "A palavra-chave não é necessária com as opções escolhidas.";
  };

  // ----- escolher posts
  const desenharPosts = () => {
    const alvo = $("#e-posts");
    if (!listaPosts().length) {
      alvo.innerHTML = `<div class="vazio" style="padding:14px"><p>Nenhuma publicação carregada.</p><button class="btn" type="button" id="carregar-pub">Carregar publicações</button></div>`;
      $("#carregar-pub").onclick = async () => {
        const b = $("#carregar-pub"); b.disabled = true; b.textContent = "Carregando...";
        try { await recarregarMidias(); }
        catch (e) { avisar(erroAmigavel(e), "erro"); b.disabled = false; b.textContent = "Carregar publicações"; }
      };
      return;
    }
    alvo.innerHTML = `<div class="grade-midias">${listaPosts().slice(0, 60).map((m) => `<button type="button" class="${E.media_ids.includes(m.media_id) ? "marcada" : ""}" data-mid="${esc(m.media_id)}" title="${esc(m.caption || "")}"><img src="${esc(m.thumbnail_url || "")}" alt="" loading="lazy"></button>`).join("")}</div>
      <div class="linha" style="margin-top:6px"><small>${E.media_ids.length ? E.media_ids.length + " marcado(s)" : "nenhum marcado: vale para todos"}</small><button class="btn pequeno" type="button" id="recarregar-pub">Atualizar publicações</button></div>`;
    $$("[data-mid]", alvo).forEach((b) => b.onclick = () => {
      const id = b.dataset.mid, i = E.media_ids.indexOf(id);
      if (i >= 0) E.media_ids.splice(i, 1); else E.media_ids.push(id);
      desenharPosts(); desenharTopo(); sujar();
    });
    $("#recarregar-pub").onclick = async () => { try { await recarregarMidias(); avisar("Publicações atualizadas.", "ok"); } catch (e) { avisar(erroAmigavel(e), "erro"); } };
  };

  // ----- variações da resposta pública
  const desenharVariantes = () => {
    $("#e-variantes").innerHTML = E.variantes.map((v, i) => `<div class="linha" style="margin-top:6px"><input class="cresce" type="text" data-var="${i}" value="${esc(v)}" placeholder="Variação ${i + 2}"><button class="btn pequeno perigo" type="button" data-rmvar="${i}">Remover</button></div>`).join("");
    $$("[data-var]").forEach((inp) => inp.oninput = () => { E.variantes[Number(inp.dataset.var)] = inp.value; S.sujo = true; });
    $$("[data-rmvar]").forEach((b) => b.onclick = () => { E.variantes.splice(Number(b.dataset.rmvar), 1); desenharVariantes(); sujar(); });
  };

  // ----- construtor de conversa
  const desenharConversa = () => {
    const alvo = $("#bloco-conversa");
    if (E.acao !== "conversa") { alvo.innerHTML = ""; return; }
    const opcoesIr = (atual) => E.msgs.map((m, i) => `<option value="${esc(m.id)}" ${String(atual) === String(m.id) ? "selected" : ""}>Mensagem ${i + 2}</option>`).join("");
    alvo.innerHTML = `<div class="cartao-msg"><div class="titulo-msg">Mensagem 1 <small class="suave">(edite lá em cima)</small></div><p style="white-space:pre-wrap">${esc(E.mensagem || "(vazia)")}</p>
        <small>Botão "${esc(E.textoBotao)}" leva para a Mensagem 2.</small></div>
      ${E.msgs.map((m, i) => `<div class="cartao-msg"><div class="titulo-msg">Mensagem ${i + 2}<button type="button" class="btn pequeno perigo" data-rmmsg="${i}">Remover</button></div>
        <textarea data-msgtxt="${i}" placeholder="Texto da mensagem ${i + 2}">${esc(m.message)}</textarea>
        <label class="interruptor"><input type="checkbox" data-coleta="${i}" ${m.collect ? "checked" : ""}> Pedir um dado depois desta mensagem</label>
        ${m.collect ? `<select data-campo="${i}" style="width:auto"><option value="email" ${m.collect === "email" ? "selected" : ""}>e-mail</option><option value="telefone" ${m.collect === "telefone" ? "selected" : ""}>telefone</option></select>` : ""}
        ${m.buttons.map((b, j) => `<div class="linha-botao"><input type="text" maxlength="60" data-bnome="${i}-${j}" value="${esc(b.title)}" placeholder="Nome do botão (até 20)">
          <select data-bacao="${i}-${j}"><option value="ir" ${b.acao === "ir" ? "selected" : ""}>Ir para outra mensagem</option><option value="link" ${b.acao === "link" ? "selected" : ""}>Abrir um link</option><option value="encerrar" ${b.acao === "encerrar" ? "selected" : ""}>Encerrar</option></select>
          <button type="button" class="btn pequeno perigo" data-rmb="${i}-${j}">×</button>
          ${b.acao === "link" ? `<textarea class="url-grande" data-burl="${i}-${j}" placeholder="https://..." style="grid-column:1/-1">${esc(b.url)}</textarea>` : ""}
          ${b.acao === "ir" ? `<select data-bnext="${i}-${j}" style="grid-column:1/-1"><option value="">Escolha a mensagem</option>${opcoesIr(b.next)}</select>` : ""}
          ${b.acao === "encerrar" ? `<small style="grid-column:1/-1" class="suave">Encerrar não vira botão visível.</small>` : ""}</div>`).join("")}
        ${m.buttons.length < 3 ? `<button type="button" class="btn pequeno" data-addb="${i}" style="margin-top:8px">+ Botão</button>` : ""}</div>`).join("")}
      <button type="button" class="btn" id="add-msg">+ Adicionar mensagem</button>`;
    const pos = (s) => s.split("-").map(Number);
    $$("[data-msgtxt]", alvo).forEach((t) => t.oninput = () => { E.msgs[Number(t.dataset.msgtxt)].message = t.value; sujar(); });
    $$("[data-rmmsg]", alvo).forEach((b) => b.onclick = () => { E.msgs.splice(Number(b.dataset.rmmsg), 1); desenharConversa(); sujar(); });
    $$("[data-coleta]", alvo).forEach((cb) => cb.onchange = () => { E.msgs[Number(cb.dataset.coleta)].collect = cb.checked ? "email" : ""; desenharConversa(); sujar(); });
    $$("[data-campo]", alvo).forEach((s) => s.onchange = () => { E.msgs[Number(s.dataset.campo)].collect = s.value; sujar(); });
    $$("[data-bnome]", alvo).forEach((inp) => inp.oninput = () => {
      const [i, j] = pos(inp.dataset.bnome), b = E.msgs[i].buttons[j];
      // Colou um link no nome e escolheu "abrir um link": o link vai para o campo certo e o nome vira "Acessar"
      if (/^https?:\/\//i.test(inp.value.trim()) && b.acao === "link") { b.url = inp.value.trim(); b.title = "Acessar"; desenharConversa(); }
      else b.title = inp.value;
      sujar();
    });
    $$("[data-bacao]", alvo).forEach((s) => s.onchange = () => {
      const [i, j] = pos(s.dataset.bacao), b = E.msgs[i].buttons[j];
      b.acao = s.value;
      if (b.acao === "link" && /^https?:\/\//i.test((b.title || "").trim())) { b.url = b.title.trim(); b.title = "Acessar"; }
      desenharConversa(); sujar();
    });
    $$("[data-burl]", alvo).forEach((t) => t.oninput = () => { const [i, j] = pos(t.dataset.burl); E.msgs[i].buttons[j].url = t.value.trim(); sujar(); });
    $$("[data-bnext]", alvo).forEach((s) => s.onchange = () => { const [i, j] = pos(s.dataset.bnext); E.msgs[i].buttons[j].next = s.value; sujar(); });
    $$("[data-rmb]", alvo).forEach((b) => b.onclick = () => { const [i, j] = pos(b.dataset.rmb); E.msgs[i].buttons.splice(j, 1); desenharConversa(); sujar(); });
    $$("[data-addb]", alvo).forEach((b) => b.onclick = () => { E.msgs[Number(b.dataset.addb)].buttons.push({ title: "", url: "", next: "", acao: "ir" }); desenharConversa(); sujar(); });
    $("#add-msg").onclick = () => { E.msgs.push({ id: proximoId++, message: "", buttons: [], collect: "" }); desenharConversa(); sujar(); };
  };

  const atualizarBlocos = () => {
    $("#bloco-botao").classList.toggle("escondido", !E.temBotao);
    $("#bloco-link").classList.toggle("escondido", E.acao !== "link");
    $("#cont-botao").textContent = `${E.textoBotao.length}/20`;
    if (E.acao === "conversa" && !E.msgs.length) E.msgs.push({ id: proximoId++, message: "", buttons: [], collect: "" });
    desenharConversa();
  };

  // ----- monta o flow a partir do estado (mesma regra do servidor)
  const montarFlow = () => {
    const passo1 = { id: 1, message: E.mensagem.trim(), buttons: [] };
    if (E.anexo) passo1.assets = [E.anexo];
    if (E.temBotao && E.textoBotao.trim()) {
      if (E.acao === "link" && E.url.trim()) passo1.buttons.push({ title: E.textoBotao.trim().slice(0, 20), url: E.url.trim() });
      if (E.acao === "conversa" && E.msgs[0]) passo1.buttons.push({ title: E.textoBotao.trim().slice(0, 20), next: Number(E.msgs[0].id) });
    }
    const steps = [passo1];
    if (E.acao === "conversa" && E.temBotao) {
      E.msgs.forEach((m) => {
        const btns = m.buttons.filter((b) => b.title.trim() && b.acao !== "encerrar")
          .map((b) => b.acao === "link" ? (b.url ? { title: b.title.trim().slice(0, 20), url: b.url } : null) : (b.next !== "" ? { title: b.title.trim().slice(0, 20), next: Number(b.next) } : null))
          .filter(Boolean).slice(0, 3);
        const passo = { id: Number(m.id), message: m.message.trim(), buttons: btns };
        if (m.collect) passo.collect = { field: m.collect, next: null };
        steps.push(passo);
      });
    }
    return { steps };
  };

  // ----- prévia ao vivo
  const atualizarPrevia = () => {
    const flow = montarFlow();
    const balao = (passo) => {
      const btns = (passo.buttons || []);    // só os válidos (botão sem destino não aparece)
      return `<div class="balao"><div class="txt">${esc(passo.message || "...")}</div>
        ${passo.assets && passo.assets.length ? `<div class="anexo-prev">📎 arquivo anexado</div>` : ""}
        ${btns.map((b) => `<div class="botao-anexo" data-prev="${b.next ?? ""}" data-url="${esc(b.url || "")}">${b.url ? "🔗 " : ""}${esc(b.title)}</div>`).join("")}</div>
        ${passo.collect ? `<div class="balao usuario"><div class="txt">${passo.collect.field === "email" ? "nome@email.com" : "11 91234 5678"}</div></div>` : ""}`;
    };
    const caminho = [flow.steps[0], ...E.previaCaminho.map((id) => flow.steps.find((s) => String(s.id) === String(id))).filter(Boolean)];
    // O que a pessoa fez para disparar (o primeiro gatilho marcado)
    const palavra = E.tags[0] || "PALAVRA";
    let gatilhoTxt = `💬 comentou: ${E.qualquer ? "qualquer comentário" : palavra}`;
    if (!E.gatilhos.includes("comentario") && E.gatilhos.includes("dm")) gatilhoTxt = `✉️ mandou no direct: ${palavra}`;
    if (!E.gatilhos.includes("comentario") && !E.gatilhos.includes("dm") && E.gatilhos.includes("story")) gatilhoTxt = `↩️ respondeu seu story: ${E.storyQualquer ? "😍" : palavra}`;
    $("#previa").innerHTML = `<div class="cab"><span class="mini" style="width:26px;height:26px;flex-basis:26px;border-radius:50%"></span>${esc(c.instagram || "@perfil")}</div>
      <div class="balao usuario"><div class="txt">${esc(gatilhoTxt)}</div></div>` + caminho.map(balao).join("");
    $$("[data-prev]", $("#previa")).forEach((b) => b.onclick = () => {
      if (b.dataset.url) { avisar("No Instagram, esse botão abre: " + b.dataset.url); return; }
      if (b.dataset.prev) { E.previaCaminho.push(b.dataset.prev); if (E.previaCaminho.length > 8) E.previaCaminho.shift(); atualizarPrevia(); }
    });
  };

  // ----- eventos
  $("#e-nome").oninput = (ev) => { E.nome = ev.target.value; S.sujo = true; };
  $("#e-qualquer").onchange = (ev) => { E.qualquer = ev.target.checked; desenharTopo(); atualizarGatilhos(); sujar(); };
  $("#e-story-qualquer").onchange = (ev) => { E.storyQualquer = ev.target.checked; atualizarGatilhos(); sujar(); };
  $$("[data-gat]").forEach((cb) => cb.onchange = () => {
    E.gatilhos = $$("[data-gat]").filter((x) => x.checked).map((x) => x.dataset.gat);
    atualizarGatilhos(); sujar();
  });
  $("#e-resposta").oninput = (ev) => { E.resposta = ev.target.value; S.sujo = true; };
  $("#add-var").onclick = () => { E.variantes.push(""); desenharVariantes(); };
  $("#e-msg").oninput = (ev) => { E.mensagem = ev.target.value; E.previaCaminho = []; sujar(); if (E.acao === "conversa") desenharConversa(); };
  $$("#emojis button").forEach((b) => b.onclick = () => {
    const t = $("#e-msg"), ini = t.selectionStart ?? t.value.length, fim = t.selectionEnd ?? t.value.length;
    t.value = t.value.slice(0, ini) + b.textContent + t.value.slice(fim);
    t.focus(); t.selectionStart = t.selectionEnd = ini + b.textContent.length;
    E.mensagem = t.value; sujar();
  });
  $("#e-tembotao").onchange = (ev) => { E.temBotao = ev.target.checked; atualizarBlocos(); sujar(); };
  $("#e-txtbotao").oninput = (ev) => { E.textoBotao = ev.target.value.slice(0, 20); $("#cont-botao").textContent = `${E.textoBotao.length}/20`; sujar(); };
  $$("input[name=acao]").forEach((r) => r.onchange = () => { E.acao = r.value; E.previaCaminho = []; atualizarBlocos(); sujar(); });
  $("#e-url").oninput = (ev) => { E.url = ev.target.value.trim(); sujar(); };
  $("#e-anexo").onchange = (ev) => { E.anexo = ev.target.value; sujar(); };

  $("#salvar-auto").onclick = async () => {
    // Validação amigável
    if (!E.nome.trim()) { avisar("Dê um nome para a automação.", "erro"); $("#e-nome").focus(); return; }
    if (!E.gatilhos.length) { avisar("Escolha onde a automação responde: comentário, direct ou stories.", "erro"); return; }
    const precisaPalavra = (E.gatilhos.includes("comentario") && !E.qualquer) || E.gatilhos.includes("dm") || (E.gatilhos.includes("story") && !E.storyQualquer);
    if (precisaPalavra && !E.tags.length) { avisar("Adicione pelo menos uma palavra-chave (ou ligue \"qualquer palavra\" / \"qualquer resposta ao story\").", "erro"); return; }
    if (!E.mensagem.trim()) { avisar("Escreva a mensagem do direct.", "erro"); $("#e-msg").focus(); return; }
    if (E.temBotao && !E.textoBotao.trim()) { avisar("Escreva o texto do botão.", "erro"); return; }
    if (E.temBotao && E.acao === "link" && !/^https?:\/\/\S+$/i.test(E.url)) { avisar("Cole um link completo, começando com https://", "erro"); return; }
    if (E.acao === "conversa" && E.temBotao && E.msgs.some((m) => !m.message.trim())) { avisar("Toda mensagem da conversa precisa de texto.", "erro"); return; }
    if (!ehSM() && !conta) { avisar("Seu Instagram ainda não está conectado. Fale com a sua social media.", "erro"); return; }
    const flow = montarFlow();
    const dados = { cliente_id: c.id, ig_account_id: conta ? conta.ig_account_id : (a.ig_account_id || "sem-conta"), nome: E.nome.trim(), keyword: E.tags.join(", "),
      match_any: E.qualquer, media_ids: E.media_ids, public_reply: E.resposta.trim() || null, public_reply_variants: E.variantes.map((v) => v.trim()).filter(Boolean),
      flow, asset_ids: E.anexo ? [E.anexo] : [], modelo: a.modelo || "livre",
      gatilhos: E.gatilhos, story_qualquer: E.storyQualquer, story_ids: E.story_ids };
    try {
      if (a.id) await D.atualizar("ig_automations", { id: a.id }, dados);
      else { const nova = await D.inserir("ig_automations", { ...dados, active: false }); a.id = nova.id; }
      S.sujo = false;
      avisar(S.modo === "local" ? "Salvo só neste navegador (modo de teste, sem Supabase)." : "Automação salva. Ative na lista quando quiser.", S.modo === "local" ? "" : "ok");
      location.hash = rotaListaAutomacoes();
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };

  desenharTopo(); desenharTags(); desenharPosts(); desenharStories(); desenharVariantes(); atualizarGatilhos(); atualizarBlocos(); atualizarPrevia();
  S.sujo = false;
}

// ---------------------------------------------------------------- Interações
async function abaInteracoes(el, c) {
  const noventa = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
  const [leads, entregas, midias, autos] = await Promise.all([
    D.lista("ig_leads_resumo", { eq: { cliente_id: c.id } }).catch(() => D.lista("ig_leads", { eq: { cliente_id: c.id } })),
    D.lista("ig_deliveries", { eq: { cliente_id: c.id }, gte: { ts: noventa }, ordem: "-ts", limite: 5000 }),
    D.lista("ig_midias", { eq: { cliente_id: c.id } }).catch(() => []),
    D.lista("ig_automations", { eq: { cliente_id: c.id } }),
  ]);
  // Junta os envios por lead (ligação por ig_account_id + ig_user_id)
  const chave = (x) => x.ig_account_id + "|" + x.ig_user_id;
  const porLead = {};
  entregas.forEach((d) => { (porLead[chave(d)] = porLead[chave(d)] || []).push(d); });
  // Qual palavra-chave da automação apareceu no que a pessoa escreveu
  const palavraDe = (l, a) => {
    if (!a) return "";
    if (l.last_source === "story_reply" && a.story_qualquer) return "qualquer resposta";
    if (a.match_any && l.last_source === "comment") return "qualquer palavra";
    const t = " " + normalizar(l.last_keyword || "").replace(/[^\p{L}\p{N}\s]/gu, " ") + " ";
    return (a.keyword || "").split(",").map((k) => k.trim()).filter(Boolean).find((k) => t.includes(" " + normalizar(k) + " ")) || (a.keyword || "").split(",")[0].trim();
  };
  const linhas = leads.map((l) => {
    const env = porLead[chave(l)] || [];
    const a = autos.find((x) => x.id === l.automation_id);
    const ts = env.map((d) => d.ts).sort();
    return { ...l, status: l.status || "novo", envios: env, automacao: l.automacao_nome || (a ? a.nome : ""), auto: a, palavra: palavraDe(l, a),
      total: l.total_envios ?? env.length, erros: env.filter((d) => d.status === "erro").length,
      primeira: l.primeira_interacao || [l.created_at, ts[0]].filter(Boolean).sort()[0], ultima: l.ultima_interacao || [l.updated_at, ts[ts.length - 1]].filter(Boolean).sort().pop() };
  });
  const etiquetas = [...new Set(linhas.flatMap((l) => l.tags || []))].sort();
  const F = { busca: "", origem: "", automacao: "", etiqueta: "", status: "", periodo: "tudo", ordem: "ultima", desc: true, pagina: 0 };
  const POR_PAGINA = 50;

  const filtrar = () => {
    const corte = F.periodo === "tudo" ? null : new Date(Date.now() - Number(F.periodo) * 86400 * 1000).toISOString();
    const busca = normalizar(F.busca.replace(/^@/, ""));
    let r = linhas.filter((l) => (!busca || normalizar(l.username || l.ig_user_id).includes(busca) || normalizar(l.last_keyword || "").includes(busca) || normalizar(l.email || "").includes(busca)) &&
      (!F.origem || l.last_source === F.origem) && (!F.automacao || l.automation_id === F.automacao) &&
      (!F.etiqueta || (l.tags || []).includes(F.etiqueta)) && (!F.status || l.status === F.status) && (!corte || (l.ultima || "") >= corte));
    const ordemStatus = { novo: 0, em_conversa: 1, cliente: 2, perdido: 3 };
    const val = (l) => ({ usuario: l.username || "", origem: l.last_source || "", palavra: l.palavra || "", disse: l.last_keyword || "", automacao: l.automacao || "",
      status: ordemStatus[l.status] ?? 0, total: l.total || 0, primeira: l.primeira || "", ultima: l.ultima || "", etapa: l.flow_step || 0, contato: (l.email || l.telefone) ? 1 : 0 }[F.ordem]);
    r.sort((x, y) => (val(x) > val(y) ? 1 : val(x) < val(y) ? -1 : 0) * (F.desc ? -1 : 1));
    return r;
  };
  const miniPost = (l) => {
    const ids = (l.auto && l.auto.media_ids) || [];
    const m = midias.find((x) => x.media_id === ids[0]);
    return m && m.thumbnail_url ? `<img class="mini" src="${esc(m.thumbnail_url)}" alt="" data-falha="${esc(l.palavra || "post")}">` : `<span class="mini">${esc((l.palavra || "todos").slice(0, 8))}</span>`;
  };
  const usuarioHtml = (l) => l.username ? `<a href="https://www.instagram.com/${esc(l.username)}/" target="_blank" rel="noopener" onclick="event.stopPropagation()">@${esc(l.username)}</a>` : `<span class="suave">Perfil sem @</span> <small>${esc(String(l.ig_user_id).slice(-6))}</small>`;
  const seletorStatus = (l) => `<select class="sel-status st-lead-${esc(l.status)}" data-status="${esc(chave(l))}" onclick="event.stopPropagation()" aria-label="Status do lead">
    ${Object.entries(STATUS_LEAD).map(([k, v]) => `<option value="${k}" ${l.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>`;

  const salvarStatus = async (l, novo) => {
    const antigo = l.status;
    l.status = novo;
    try { await D.atualizar("ig_leads", { ig_account_id: l.ig_account_id, ig_user_id: l.ig_user_id }, { status: novo }); avisar(`Status: ${STATUS_LEAD[novo]}.`, "ok"); }
    catch (e) { l.status = antigo; avisar(erroAmigavel(e), "erro"); }
  };

  const desenhar = () => {
    const r = filtrar();
    const semana = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const paginas = Math.max(1, Math.ceil(r.length / POR_PAGINA));
    F.pagina = Math.min(F.pagina, paginas - 1);
    const pag = r.slice(F.pagina * POR_PAGINA, (F.pagina + 1) * POR_PAGINA);
    const th = (k, n) => `<th class="ordenavel" data-ord="${k}">${n}${F.ordem === k ? (F.desc ? " ↓" : " ↑") : ""}</th>`;
    const conta = (s) => linhas.filter((l) => l.status === s).length;
    el.innerHTML = `<div class="grade quatro" style="margin-bottom:10px">
        <div class="kpi"><div class="numero-grande">${linhas.length}</div><small>total de leads</small></div>
        <div class="kpi"><div class="numero-grande">${linhas.filter((l) => (l.primeira || "") >= semana).length}</div><small>novos em 7 dias</small></div>
        <div class="kpi"><div class="numero-grande">${linhas.filter((l) => l.email || l.telefone).length}</div><small>com contato</small></div>
        <div class="kpi"><div class="numero-grande">${linhas.filter((l) => l.link_sent).length}</div><small>receberam o link</small></div></div>
      <div class="funil-status" role="group" aria-label="Filtrar por status">
        <button class="${F.status === "" ? "ativo" : ""}" data-fst="">Todos <strong>${linhas.length}</strong></button>
        ${Object.entries(STATUS_LEAD).map(([k, v]) => `<button class="st-lead-${k} ${F.status === k ? "ativo" : ""}" data-fst="${k}">${v} <strong>${conta(k)}</strong></button>`).join("")}
      </div>
      <div class="linha" style="margin-bottom:10px">
        <input class="cresce" type="search" id="i-busca" placeholder="Buscar por @, texto ou e-mail" value="${esc(F.busca)}">
        <select id="i-origem" style="width:auto"><option value="">Todas as origens</option>${Object.entries(ORIGENS).map(([k, v]) => `<option value="${k}" ${F.origem === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select id="i-auto" style="width:auto"><option value="">Todas as automações</option>${autos.map((a) => `<option value="${esc(a.id)}" ${F.automacao === a.id ? "selected" : ""}>${esc(a.nome)}</option>`).join("")}</select>
        <select id="i-tag" style="width:auto"><option value="">Todas as etiquetas</option>${etiquetas.map((t) => `<option ${F.etiqueta === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select id="i-periodo" style="width:auto">${[["7", "7 dias"], ["15", "15 dias"], ["30", "30 dias"], ["90", "90 dias"], ["tudo", "Tudo"]].map(([k, v]) => `<option value="${k}" ${F.periodo === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <button class="btn" id="i-csv">Exportar CSV</button></div>
      ${linhas.length ? `<div class="tabela-rolagem planilha"><table class="tabela"><thead><tr>${th("usuario", "Usuário")}${th("status", "Status")}${th("origem", "Origem")}${th("palavra", "Palavra")}${th("disse", "O que disse")}
        ${th("automacao", "Automação")}<th>Post</th>${th("contato", "Contato")}<th>Etiquetas</th>${th("total", "Interações")}<th>Link</th>${th("etapa", "Etapa")}${th("primeira", "Primeira")}${th("ultima", "Última vez")}</tr></thead><tbody>
        ${pag.map((l) => `<tr class="clicavel" data-lead="${esc(chave(l))}"><td class="fixa">${usuarioHtml(l)}</td><td>${seletorStatus(l)}</td>
          <td>${esc(ORIGENS[l.last_source] || l.last_source || "")}</td><td>${l.palavra ? `<span class="pilula destaque">${esc(l.palavra)}</span>` : ""}</td>
          <td class="disse" title="${esc(l.last_keyword || "")}">${l.last_keyword ? `"${esc(l.last_keyword)}"` : ""}</td>
          <td>${esc(l.automacao)}</td><td>${miniPost(l)}</td><td><small>${esc([l.email, l.telefone].filter(Boolean).join(" · "))}</small></td>
          <td>${(l.tags || []).map((t) => `<span class="pilula">${esc(t)}</span>`).join(" ")}</td>
          <td class="num">${l.total}${l.erros ? ` <span class="pilula erro" title="envios com erro">${l.erros} erro${l.erros > 1 ? "s" : ""}</span>` : ""}</td><td>${l.link_sent ? "✓" : ""}</td>
          <td class="num">${l.flow_step ?? ""}</td><td><small>${fmtDataCurta(l.primeira)}</small></td><td><small title="${l.ultima ? esc(new Date(l.ultima).toLocaleString("pt-BR")) : ""}">${esc(tempoRelativo(l.ultima))}</small></td></tr>`).join("") || `<tr><td colspan="14">${vazio("Nenhum lead com esses filtros.")}</td></tr>`}
        </tbody></table></div>
        <div class="paginacao"><small>${r.length} lead(s) · página ${F.pagina + 1} de ${paginas}</small><button class="btn pequeno" id="pg-ant" ${F.pagina === 0 ? "disabled" : ""}>‹</button><button class="btn pequeno" id="pg-prox" ${F.pagina >= paginas - 1 ? "disabled" : ""}>›</button></div>`
        : vazio("Nenhum lead ainda. Assim que alguém comentar a palavra-chave de uma automação ativa, aparece aqui.")}`;
    trocarImagensQuebradas(el);
    const re = (k, v) => { F[k] = v; F.pagina = 0; desenhar(); };
    $("#i-busca").oninput = debounce((ev) => { re("busca", ev.target.value); setTimeout(() => { const b = $("#i-busca"); if (b) { b.focus(); b.selectionStart = b.selectionEnd = b.value.length; } }, 0); }, 250);
    $("#i-origem").onchange = (ev) => re("origem", ev.target.value);
    $("#i-auto").onchange = (ev) => re("automacao", ev.target.value);
    $("#i-tag").onchange = (ev) => re("etiqueta", ev.target.value);
    $("#i-periodo").onchange = (ev) => re("periodo", ev.target.value);
    $$("[data-fst]", el).forEach((b) => b.onclick = () => re("status", b.dataset.fst));
    $$("[data-ord]", el).forEach((t) => t.onclick = () => { if (F.ordem === t.dataset.ord) F.desc = !F.desc; else { F.ordem = t.dataset.ord; F.desc = true; } desenhar(); });
    $$("[data-status]", el).forEach((s) => s.onchange = async () => { await salvarStatus(linhas.find((l) => chave(l) === s.dataset.status), s.value); desenhar(); });
    if ($("#pg-ant")) { $("#pg-ant").onclick = () => { F.pagina--; desenhar(); }; $("#pg-prox").onclick = () => { F.pagina++; desenhar(); }; }
    $("#i-csv").onclick = () => {
      const cab = ["Usuário", "ID do perfil", "Status", "Origem", "Palavra-chave", "O que disse", "Automação", "E-mail", "Telefone", "Etiquetas", "Interações", "Envios com erro", "Link enviado", "Etapa do fluxo", "Primeira interação", "Última interação"];
      const ls = filtrar().map((l) => [l.username ? "@" + l.username : "Perfil sem @", l.ig_user_id, STATUS_LEAD[l.status] || l.status, ORIGENS[l.last_source] || "", l.palavra, l.last_keyword || "", l.automacao,
        l.email || "", l.telefone || "", (l.tags || []).join(", "), l.total, l.erros, l.link_sent ? "sim" : "não", l.flow_step ?? "",
        l.primeira ? new Date(l.primeira).toLocaleString("pt-BR") : "", l.ultima ? new Date(l.ultima).toLocaleString("pt-BR") : ""]);
      baixarArquivo(`interacoes-${slugify(c.nome)}-${hojeISO()}.csv`, gerarCSV(cab, ls), "text/csv;charset=utf-8");
    };
    $$("[data-lead]", el).forEach((tr) => tr.onclick = () => abrirLead(linhas.find((l) => chave(l) === tr.dataset.lead), desenhar));
  };

  const abrirLead = (l, depois) => {
    const p = abrirPainelLateral(`<div class="modal-topo"><h2>${l.username ? "@" + esc(l.username) : "Perfil sem @"}</h2><button class="fechar" data-fechar>×</button></div>
      <p>${usuarioHtml(l)} · ${esc(ORIGENS[l.last_source] || "")} · ${esc(l.automacao)}</p>
      ${l.last_keyword ? `<div class="faixa info">O que disse: "${esc(l.last_keyword)}"</div>` : ""}
      <p><small>Primeira interação: ${l.primeira ? new Date(l.primeira).toLocaleString("pt-BR") : ""}<br>Última vez: ${esc(tempoRelativo(l.ultima))}</small></p>
      ${l.email || l.telefone ? `<p>📇 ${esc([l.email, l.telefone].filter(Boolean).join(" · "))}</p>` : ""}
      <label>Status</label><div class="funil-status" id="lead-status">${Object.entries(STATUS_LEAD).map(([k, v]) => `<button class="st-lead-${k} ${l.status === k ? "ativo" : ""}" data-st="${k}">${v}</button>`).join("")}</div>
      <label>Etiquetas</label><div class="tags" id="lead-tags"></div>
      <div class="modal-rodape"><button class="btn primario" id="salvar-tags">Salvar etiquetas</button></div>
      <h3>Histórico de envios</h3>
      ${l.envios.length ? `<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Data</th><th>Canal</th><th>Tipo</th><th>Status</th><th>Motivo</th></tr></thead><tbody>
        ${l.envios.map((d) => `<tr><td><small>${new Date(d.ts).toLocaleString("pt-BR")}</small></td><td>${esc({ private_reply: "resposta ao comentário", dm: "direct" }[d.canal] || d.canal || "")}</td>
          <td>${esc({ flow: "conversa", link: "link", text: "texto" }[d.tipo] || d.tipo || "")}</td><td>${d.status === "ok" ? `<span class="pilula ok">enviado</span>` : d.status === "na_fila" ? `<span class="pilula alerta">na fila</span>` : `<span class="pilula erro">erro</span>`}</td>
          <td><small>${esc(d.motivo || "")}</small></td></tr>`).join("")}</tbody></table></div>` : `<p class="suave">Nenhum envio nos últimos 90 dias.</p>`}`);
    $$("[data-st]", p).forEach((b) => b.onclick = async () => {
      await salvarStatus(l, b.dataset.st);
      $$("[data-st]", p).forEach((x) => x.classList.toggle("ativo", x.dataset.st === l.status));
      depois();
    });
    const tags = (l.tags || []).slice();
    const dt = () => {
      $("#lead-tags", p).innerHTML = tags.map((t, i) => `<span class="pilula">${esc(t)}<button type="button" data-rt="${i}">×</button></span>`).join("") + `<input type="text" id="nova-et" placeholder="nova etiqueta + Enter">`;
      $$("[data-rt]", p).forEach((b) => b.onclick = () => { tags.splice(Number(b.dataset.rt), 1); dt(); });
      $("#nova-et", p).onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); const v = ev.target.value.trim(); if (v && !tags.includes(v)) tags.push(v); dt(); $("#nova-et", p).focus(); } };
    };
    dt();
    $("#salvar-tags", p).onclick = async () => {
      try {
        await D.atualizar("ig_leads", { ig_account_id: l.ig_account_id, ig_user_id: l.ig_user_id }, { tags });
        l.tags = tags; fecharModal(); avisar("Etiquetas salvas.", "ok"); depois();
      } catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  };
  desenhar();
}

// ---------------------------------------------------------------- Contas
async function abaContas(el, c) {
  const contas = await D.lista("ig_contas_publico", { eq: { cliente_id: c.id } });
  el.innerHTML = `<div class="cartao"><h2>Contas conectadas</h2>
      ${contas.length ? contas.map((x) => `<div class="cartao plano"><div class="linha" style="justify-content:space-between">
        <div><strong>@${esc(x.username || x.ig_account_id)}</strong> ${x.situacao === "ativa" ? `<span class="pilula ok">Ativa</span>` : `<span class="pilula erro">Precisa reconectar</span>`}<br>
        <small>Conectada em ${fmtData(x.conectado_em)} · ${esc({ token_sistema: "token do usuário do sistema", unificado: "login do Meta", instagram: "login do Instagram" }[x.tipo_login] || x.tipo_login || "")}</small>
        ${x.last_error ? `<br><small style="color:var(--erro)">${esc(x.last_error)}</small>` : ""}</div>
        <div class="linha"><button class="btn pequeno" data-testar="${esc(x.ig_account_id)}">Testar conexão</button><button class="btn pequeno" data-reconectar="${esc(x.ig_account_id)}">Reconectar</button>
          <button class="btn pequeno perigo" data-desconectar="${esc(x.ig_account_id)}">Desconectar</button></div></div><div id="diag-${esc(x.ig_account_id)}"></div></div>`).join("") : `<p class="suave">Nenhuma conta conectada para este cliente.</p>`}
    </div>
    <form class="cartao" id="f-conta" autocomplete="off"><h2>Cadastrar conta</h2>
      <p class="suave">O jeito mais simples e que sempre funciona: o ID da conta profissional e um token do usuário do sistema do Meta (não expira). Passo a passo no LEIA-ME, seção "Como conectar o Instagram de um cliente".</p>
      <label>ID da conta profissional do Instagram</label><input type="text" id="ct-id" inputmode="numeric" placeholder="Só números, ex.: 17841400000000000">
      <small>Onde achar: Gerenciador de Negócios do Meta > Configurações do negócio > Contas do Instagram.</small>
      <label>Token do usuário do sistema</label><input type="password" id="ct-token" autocomplete="new-password" placeholder="Cole o token aqui">
      <small>Onde gerar: Configurações do negócio > Usuários do sistema > Gerar token (com as permissões do Instagram). O token some deste campo depois de enviado e nunca é mostrado.</small>
      <div class="modal-rodape"><button class="btn primario" id="ct-enviar">Cadastrar e testar</button></div>
      <div id="ct-resultado"></div></form>
    ${CFG.loginInstagramAtivo ? `<div class="cartao"><h2>Conectar pelo login do Meta (opcional)</h2><p class="suave">Se não funcionar, use o cadastro acima.</p>
      <details><summary>Opções avançadas</summary><label>ID da conta, se a conta não aparecer</label><input type="text" id="dica-id" inputmode="numeric"></details>
      <button class="btn primario" id="btn-conectar" style="margin-top:10px">Conectar Instagram</button></div>` : ""}`;

  const mostrarDiag = (alvo, testes) => {
    alvo.innerHTML = `<div class="tabela-rolagem" style="margin-top:8px"><table class="tabela"><thead><tr><th></th><th>Teste</th><th>HTTP</th><th>Código</th><th>Mensagem</th></tr></thead><tbody>
      ${(testes || []).map((t) => `<tr><td>${t.ok ? "✓" : "✗"}</td><td>${esc(t.nome)}</td><td>${esc(t.http ?? "")}</td><td>${esc([t.codigo, t.subcodigo].filter((x) => x != null).join("/"))}</td><td><small>${esc(t.mensagem)}</small></td></tr>`).join("")}</tbody></table></div>`;
  };
  $$("[data-testar]", el).forEach((b) => b.onclick = async () => {
    b.disabled = true; b.textContent = "Testando...";
    try { const r = await D.funcao("ig-diagnostico", { ig_account_id: b.dataset.testar }); mostrarDiag($("#diag-" + b.dataset.testar), r.testes); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
    b.disabled = false; b.textContent = "Testar conexão";
  });
  $$("[data-reconectar]", el).forEach((b) => b.onclick = () => { $("#ct-id").value = b.dataset.reconectar; $("#ct-token").focus(); $("#f-conta").scrollIntoView({ behavior: "smooth" }); });
  $$("[data-desconectar]", el).forEach((b) => b.onclick = async () => {
    if (!(await confirmar("Desconectar esta conta? As automações dela serão pausadas.", "Desconectar", true))) return;
    try { const r = await D.funcao("ig-account-disconnect", { ig_account_id: b.dataset.desconectar }); avisar(r.mensagem || "Conta desconectada.", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $("#f-conta").onsubmit = async (ev) => {
    ev.preventDefault();
    const id = $("#ct-id").value.trim(), token = $("#ct-token").value.replace(/\s+/g, "");
    if (!/^\d{6,25}$/.test(id)) { avisar("O ID da conta profissional precisa ter só números.", "erro"); return; }
    if (token.length < 20) { avisar("Cole o token inteiro.", "erro"); return; }
    $("#ct-token").value = "";   // o token some do campo depois de enviado
    const btn = $("#ct-enviar"); btn.disabled = true; btn.textContent = "Conectando...";
    try {
      const r = await D.funcao("ig-account-connect", { cliente_id: c.id, ig_account_id: id, access_token: token });
      $("#ct-resultado").innerHTML = `<div class="faixa ok">Conta conectada${r.username ? ": @" + esc(r.username) : ""}.</div>${r.aviso ? `<div class="faixa alerta">${esc(r.aviso)}</div>` : ""}`;
      if (r.diagnostico && r.diagnostico.length) { const d = document.createElement("div"); $("#ct-resultado").appendChild(d); mostrarDiag(d, r.diagnostico); }
      setTimeout(rotear, 2500);
    } catch (e) { $("#ct-resultado").innerHTML = `<div class="faixa erro">${esc(erroAmigavel(e))}</div>`; }
    btn.disabled = false; btn.textContent = "Cadastrar e testar";
  };
  if ($("#btn-conectar")) $("#btn-conectar").onclick = () => iniciarLoginMeta(c.id, ($("#dica-id") || {}).value);
}

async function iniciarLoginMeta(clienteId, dica) {
  try { const r = await D.funcao("ig-oauth-start", { cliente_id: clienteId, dica_ig_id: dica || null }); location.href = r.url; }
  catch (e) { avisar(erroAmigavel(e), "erro"); }
}

// =============================================================================
// 7. VISÃO DO CLIENTE (simples, sem palavras técnicas)
// =============================================================================

/** Link do WhatsApp da social media com mensagem pronta. */
function linkWhats(msg) {
  const n = String(S.config.whatsapp || "").replace(/\D/g, "");
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : "";
}

/** Embed do vídeo de boas-vindas (YouTube, Vimeo ou link). */
function videoHtml(url) {
  if (!url) return "";
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (m) return `<iframe class="video-boas-vindas" src="https://www.youtube-nocookie.com/embed/${esc(m[1])}" allowfullscreen title="Vídeo de boas-vindas"></iframe>`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `<iframe class="video-boas-vindas" src="https://player.vimeo.com/video/${esc(m[1])}" allowfullscreen title="Vídeo de boas-vindas"></iframe>`;
  m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return `<iframe class="video-boas-vindas" src="https://drive.google.com/file/d/${esc(m[1])}/preview" allowfullscreen title="Vídeo de boas-vindas"></iframe>`;
  return `<p><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">▶ Assistir ao vídeo de boas-vindas</a></p>`;
}

/** Gravador de áudio no navegador. Chama aoTerminar(blob). */
function gravadorAudio(botao, statusEl, aoTerminar) {
  let rec = null, partes = [], inicio = 0, relogio = null;
  botao.onclick = async () => {
    if (rec && rec.state === "recording") { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream);
      partes = [];
      rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(relogio);
        botao.textContent = "🎙️ Gravar áudio"; statusEl.textContent = "";
        const blob = new Blob(partes, { type: rec.mimeType || "audio/webm" });
        if (blob.size) aoTerminar(blob);
      };
      rec.start();
      inicio = Date.now();
      botao.textContent = "⏹ Parar gravação";
      relogio = setInterval(() => { const s = Math.floor((Date.now() - inicio) / 1000); statusEl.innerHTML = `<span class="gravando">● gravando ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</span>`; }, 500);
    } catch (_) { avisar("Não consegui usar o microfone. Confira a permissão do navegador.", "erro"); }
  };
}
async function subirAudio(blob, pasta) {
  const ext = (blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm");
  const caminho = `${S.clienteId}/${pasta}/${Date.now()}.${ext}`;
  const arquivo = new File([blob], `audio.${ext}`, { type: blob.type || "audio/webm" });
  return D.enviarArquivo("audios", caminho, arquivo);
}

// ---------------------------------------------------------------- Boas-vindas e onboarding
ROTAS["c-onboarding"] = async (el) => {
  const c = clienteAtual();
  let ob = await D.um("onboarding", { eq: { cliente_id: c.id } });
  if (!ob) { try { ob = await D.inserir("onboarding", { cliente_id: c.id, respostas: {}, progresso: 0, status: "rascunho" }); } catch (_) { ob = { cliente_id: c.id, respostas: {}, progresso: 0, status: "rascunho" }; } }
  const resp = Object.assign({}, ob.respostas || {});
  const bloqueado = ob.status === "revisado";
  const total = PERGUNTAS_ONBOARDING.length;
  let i = Math.max(0, PERGUNTAS_ONBOARDING.findIndex((q) => !String(resp[q.id] || "").trim()));
  if (i < 0 || ob.status !== "rascunho") i = 0;
  const contar = () => PERGUNTAS_ONBOARDING.filter((q) => String(resp[q.id] || "").trim() || resp[q.id + "_audio"]).length;

  const salvar = async (status) => {
    const progresso = Math.round((contar() / total) * 100);
    const pend = PERGUNTAS_ONBOARDING.filter((q) => !String(resp[q.id] || "").trim() && !resp[q.id + "_audio"]).map((q) => q.id);
    try { await D.upsert("onboarding", { cliente_id: c.id, respostas: resp, progresso, status: status || ob.status, pendencias: pend }, "cliente_id"); if (status) ob.status = status; $("#salvo") && ($("#salvo").textContent = "Salvo ✓"); }
    catch (e) { $("#salvo") && ($("#salvo").textContent = "Não salvou: " + erroAmigavel(e)); }
  };
  const salvarDepois = debounce(() => salvar(), 900);

  const desenhar = () => {
    const q = PERGUNTAS_ONBOARDING[i];
    const feitos = contar();
    el.innerHTML = cabecalho("Boas-vindas e onboarding", esc(S.config.texto_boas_vindas || "Responda uma pergunta por vez. Não precisa escrever bonito.")) + `
      ${i === 0 && c.video_boas_vindas_url ? `<div class="cartao">${videoHtml(c.video_boas_vindas_url)}</div>` : ""}
      ${ob.status === "enviado" ? `<div class="faixa ok">Você já enviou o onboarding. Pode ajustar as respostas até a revisão.</div>` : ""}
      ${bloqueado ? `<div class="faixa info">O onboarding já foi revisado. Se quiser mudar algo, mande um recado.</div>` : ""}
      <div class="cartao"><div class="linha" style="justify-content:space-between"><small>Bloco ${q.bloco}: ${esc(q.blocoTitulo)}</small><small>${feitos} de ${total} respondidas</small></div>
        <div class="progresso" style="margin-top:6px"><div style="width:${(feitos / total) * 100}%"></div></div>
        <div class="pergunta-grande">${i + 1}. ${esc(q.texto)}</div>
        <div class="exemplo">Exemplo: "${esc(q.exemplo)}"</div>
        <p class="suave" style="font-size:13px">Responda em texto ou áudio. Se não souber, escreva "não sei ainda".</p>
        <textarea id="ob-resp" ${bloqueado ? "disabled" : ""} placeholder="Sua resposta">${esc(resp[q.id] || "")}</textarea>
        <div class="linha" style="margin-top:8px">${bloqueado ? "" : `<button class="btn" id="ob-audio">🎙️ Gravar áudio</button><span id="ob-status"></span>`}
          ${resp[q.id + "_audio"] ? `<span class="pilula ok">áudio enviado</span>` : ""}<span class="espaco"></span><small id="salvo" class="suave"></small></div>
        <div class="linha" style="justify-content:space-between;margin-top:14px">
          <button class="btn" id="ob-ant" ${i === 0 ? "disabled" : ""}>‹ Anterior</button>
          ${i < total - 1 ? `<button class="btn primario" id="ob-prox">Próxima ›</button>` : bloqueado ? "" : `<button class="btn ok" id="ob-enviar">Enviar onboarding</button>`}
        </div></div>
      <details class="cartao"><summary>Ver todas as perguntas</summary>${PERGUNTAS_ONBOARDING.map((x, k) => `<p><a href="#" data-ir="${k}">${k + 1}. ${esc(x.texto)}</a> ${String(resp[x.id] || "").trim() || resp[x.id + "_audio"] ? "✓" : ""}</p>`).join("")}</details>`;
    const t = $("#ob-resp");
    t.oninput = () => { resp[q.id] = t.value; $("#salvo").textContent = "Salvando..."; salvarDepois(); };
    $("#ob-ant").onclick = () => { i--; desenhar(); };
    if ($("#ob-prox")) $("#ob-prox").onclick = () => { i++; desenhar(); };
    if ($("#ob-enviar")) $("#ob-enviar").onclick = async () => {
      const faltam = total - contar();
      if (faltam && !(await confirmar(`Ainda faltam ${faltam} perguntas. Enviar assim mesmo? Você pode completar depois.`, "Enviar"))) return;
      await salvar("enviado");
      avisar("Onboarding enviado. Obrigada!", "ok");
      location.hash = "#/semana";
    };
    $$("[data-ir]").forEach((a) => a.onclick = (ev) => { ev.preventDefault(); i = Number(a.dataset.ir); desenhar(); });
    if ($("#ob-audio")) gravadorAudio($("#ob-audio"), $("#ob-status"), async (blob) => {
      try { const caminho = await subirAudio(blob, "onboarding"); resp[q.id + "_audio"] = caminho; if (!String(resp[q.id] || "").trim()) resp[q.id] = "(respondido em áudio)"; await salvar(); avisar("Áudio enviado.", "ok"); desenhar(); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    });
  };
  desenhar();
};

// ---------------------------------------------------------------- Minha semana
ROTAS["c-semana"] = async (el) => {
  const c = clienteAtual();
  const vis = c.telas_visiveis || [];
  const [pend, ob, pesq] = await Promise.all([
    pendenciasDaSemana(c.id), D.um("onboarding", { eq: { cliente_id: c.id } }), D.um("pesquisa_satisfacao", { eq: { cliente_id: c.id, mes: mesAtual() } }),
  ]);
  const itens = [];
  if (vis.includes("aprovar") && pend.aprovacao.length) itens.push({ ic: iconeSvg("aprovar"), t: `${pend.aprovacao.length} post(s) esperando a sua aprovação`, s: pend.aprovacao[0].prazo_aprovacao ? `Prazo: ${fmtData(pend.aprovacao.map((p) => p.prazo_aprovacao).filter(Boolean).sort()[0])}` : "", h: "#/aprovar" });
  if (vis.includes("gravar")) pend.briefings.forEach((b) => itens.push({ ic: iconeSvg("gravar"), t: "Vídeo para gravar", s: b.prazo ? `Prazo: ${fmtData(b.prazo)}` : "", h: "#/gravar" }));
  if (vis.includes("onboarding") && (!ob || ob.status === "rascunho")) itens.push({ ic: iconeSvg("onboarding"), t: "Terminar o onboarding", s: `${ob ? ob.progresso : 0}% respondido`, h: "#/onboarding" });
  if (vis.includes("pesquisa") && !pesq) itens.push({ ic: iconeSvg("pesquisa"), t: "Pesquisa do mês aberta", s: "Leva 30 segundos", h: "#/pesquisa" });
  el.innerHTML = cabecalho("Minha semana", `Oi${S.usuario.nome ? ", " + esc(S.usuario.nome.split(" ")[0]) : ""}! O que precisa de você agora.`) +
    (itens.length ? `<div class="lista-acoes">${itens.map((x) => `<button class="item-acao" data-h="${x.h}"><span class="icone">${x.ic}</span><span class="texto"><strong>${esc(x.t)}</strong>${x.s ? `<br><small>${esc(x.s)}</small>` : ""}</span><span class="seta">›</span></button>`).join("")}</div>`
      : `<div class="vazio"><p style="font-size:18px">🎉 Tudo em dia por aqui.</p></div>`) +
    `<h2 style="margin-top:24px">Em andamento</h2>` +
    (pend.emAndamento.length ? `<div class="cartao">${pend.emAndamento.map((p) => `<p>${fmtDataCurta(p.data)} · ${esc(p.tema)} <small class="suave">(${{ pauta: "planejado", producao: "em produção", revisao: "em revisão", ajuste: "ajustando o que você pediu" }[p.status] || nomeStatus(p.status)})</small></p>`).join("")}</div>`
      : `<p class="suave">Nada em produção no momento.</p>`);
  $$("[data-h]", el).forEach((b) => b.onclick = () => { location.hash = b.dataset.h; });
};

// ---------------------------------------------------------------- Aprovar
ROTAS["c-aprovar"] = async (el) => {
  const c = clienteAtual();
  const fila = await D.lista("posts", { eq: { cliente_id: c.id, status: "aprovacao" }, ordem: "data" });
  const feed = await D.lista("posts", { eq: { cliente_id: c.id }, in: { status: ["publicado", "agendado", "aprovado"] }, ordem: "-data", limite: 12 });
  const comMidias = await Promise.all(fila.map(async (p) => ({ ...p, urls: await urlsMidias(p) })));
  const feedM = await Promise.all(feed.map(async (p) => ({ ...p, urls: await urlsMidias(p) })));
  if (!fila.length) {
    el.innerHTML = cabecalho("Aprovar", "Seus conteúdos esperando aprovação.") + `<div class="vazio"><p style="font-size:18px">Nada para aprovar agora.</p><p>Quando chegar conteúdo novo, ele aparece aqui.</p></div>`;
    return;
  }
  const capa = (p) => (p.urls[0] || {}).src || "";
  const icone = (p) => p.formato === "carrossel" ? "▣" : p.formato === "reels" ? "▶" : "";
  let visao = "grade";
  const desenhar = () => {
    const ordenados = [...comMidias].sort((a, b) => b.data.localeCompare(a.data));
    el.innerHTML = cabecalho("Aprovar", `${fila.length} post(s) esperando você. Toque para ver como fica no celular.`) + `
      <div class="abas"><button class="${visao === "grade" ? "ativa" : ""}" data-v="grade">Como fica no feed</button><button class="${visao === "lista" ? "ativa" : ""}" data-v="lista">Lista</button></div>
      ${visao === "grade" ? `<div class="feed">${ordenados.map((p, k) => `<button class="celula" style="background-image:url('${esc(capa(p))}')" data-abrir="${esc(p.id)}" aria-label="${esc(p.tema)}">
          <span class="numero">${ordenados.length - k}</span><span class="tipo">${icone(p)}</span>${p.versao > 1 ? `<span class="v2">versão ${p.versao}</span>` : ""}</button>`).join("")}
        ${feedM.map((p) => `<div class="celula" style="background-image:url('${esc(capa(p))}');opacity:.5;cursor:default"></div>`).join("")}</div>
        <p class="suave" style="margin-top:8px">Os numerados são os novos. Os apagados já estão no seu perfil.</p>`
      : `<div class="grade duas">${comMidias.map((p) => `<div class="cartao"><div class="linha" style="justify-content:space-between"><strong>${esc(p.tema)}</strong>${p.versao > 1 ? `<span class="pilula alerta">versão ${p.versao}</span>` : ""}</div>
          <small class="suave">${fmtData(p.data)} · ${esc(p.formato || "")}${p.prazo_aprovacao ? ` · aprovar até ${fmtData(p.prazo_aprovacao)}` : ""}</small>
          <div style="margin-top:10px">${celular(p)}</div>${botoesDecisao(p)}</div>`).join("")}</div>`}`;
    $$("[data-v]", el).forEach((b) => b.onclick = () => { visao = b.dataset.v; desenhar(); });
    $$("[data-abrir]", el).forEach((b) => b.onclick = () => abrirPost(comMidias.find((p) => p.id === b.dataset.abrir)));
    ligarDecisoes(el);
  };
  const celular = (p) => `<div class="celular"><div class="barra"></div><div class="perfil"><span class="bolinha"></span>${esc(c.instagram || c.nome)}</div>
    ${p.urls.length ? `<div class="slides">${p.urls.map((u) => u.tipo === "video" ? (/\.(mp4|webm|mov)(\?|$)/i.test(u.src) ? `<video src="${esc(u.src)}" controls playsinline></video>` : `<a href="${esc(u.src)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;color:#fff;aspect-ratio:9/16">▶ Assistir ao vídeo</a>`) : `<img src="${esc(u.src)}" alt="">`).join("")}</div>
      ${p.urls.length > 1 ? `<div class="pontinhos">deslize para o lado: ${p.urls.length} telas</div>` : ""}` : `<div style="aspect-ratio:4/5;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#888">Arte em produção</div>`}
    ${p.mudancas ? `<div class="faixa alerta" style="margin:8px">O que mudou: ${esc(p.mudancas)}</div>` : ""}
    <div class="legenda-celular"><strong>${esc((c.instagram || "").replace("@", ""))}</strong> ${esc(p.legenda || "")}</div>
    ${p.roteiro && p.formato === "reels" ? `<details style="padding:0 10px 10px"><summary>Ver roteiro</summary><pre style="font-size:13px">${esc(p.roteiro)}</pre></details>` : ""}</div>`;
  const botoesDecisao = (p) => `<div class="linha" style="margin-top:12px"><button class="btn ok cresce" data-aprovar="${esc(p.id)}">Aprovar</button><button class="btn cresce" data-ajuste="${esc(p.id)}">Pedir ajuste</button></div>
    <div class="escondido" id="aj-${esc(p.id)}"><label>O que você quer mudar?</label><textarea id="aj-txt-${esc(p.id)}"></textarea>
      <label>Trecho (opcional)</label><input type="text" id="aj-tr-${esc(p.id)}" placeholder="Copie aqui a frase que quer trocar"><button class="btn alerta bloco" style="margin-top:8px" data-enviar-ajuste="${esc(p.id)}">Enviar pedido de ajuste</button></div>`;
  const abrirPost = (p) => {
    const m = abrirModal(p.tema, celular(p) + botoesDecisao(p));
    ligarDecisoes(m);
  };
  const ligarDecisoes = (raiz) => {
    $$("[data-aprovar]", raiz).forEach((b) => b.onclick = () => decidir(b.dataset.aprovar, "aprovado"));
    $$("[data-ajuste]", raiz).forEach((b) => b.onclick = () => $("#aj-" + b.dataset.ajuste, raiz).classList.toggle("escondido"));
    $$("[data-enviar-ajuste]", raiz).forEach((b) => b.onclick = () => {
      const id = b.dataset.enviarAjuste, txt = $("#aj-txt-" + id, raiz).value.trim();
      if (!txt) { avisar("Conte o que você quer mudar."); return; }
      decidir(id, "ajuste", txt, $("#aj-tr-" + id, raiz).value.trim());
    });
  };
  // Grava SÓ em "aprovacoes": o gatilho do banco muda o status do post.
  const decidir = async (postId, decisao, comentario = null, trecho = null) => {
    try {
      await D.inserir("aprovacoes", { post_id: postId, cliente_id: c.id, decisao, comentario, trecho: trecho || null, autor_id: S.usuario.id });
      fecharModal();
      avisar(decisao === "aprovado" ? "Aprovado! Obrigada." : "Pedido de ajuste enviado.", "ok");
      rotear();   // recarrega: o post sai da fila
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  desenhar();
};

// ---------------------------------------------------------------- Gravar (teleprompter)
ROTAS["c-gravar"] = async (el) => {
  const c = clienteAtual();
  const briefs = await D.lista("briefings", { eq: { cliente_id: c.id }, ordem: "prazo" });
  const posts = briefs.length ? await D.lista("posts", { eq: { cliente_id: c.id }, in: { id: briefs.map((b) => b.post_id).filter(Boolean) } }) : [];
  const ativos = briefs.filter((b) => b.status !== "enviado"), feitos = briefs.filter((b) => b.status === "enviado");
  const card = (b) => {
    const p = posts.find((x) => x.id === b.post_id) || {};
    const ck = Array.isArray(b.checklist) ? b.checklist : [];
    return `<div class="cartao"><div class="linha" style="justify-content:space-between"><h2 style="margin:0">${esc(p.tema || "Vídeo")}</h2>
      ${b.status === "enviado" ? `<span class="pilula ok">enviado</span>` : b.status === "gravado" ? `<span class="pilula info">gravado</span>` : `<span class="pilula alerta">para gravar</span>`}</div>
      ${b.prazo ? `<p><strong>Prazo:</strong> ${fmtData(b.prazo)}</p>` : ""}
      ${b.referencia ? `<p><strong>Cena de referência:</strong> ${esc(b.referencia)}</p>` : ""}
      ${ck.length ? `<p><strong>Antes de gravar:</strong></p>${ck.map((x) => `<label class="interruptor" style="display:flex"><input type="checkbox"> ${esc(x)}</label>`).join("")}` : ""}
      <div class="linha" style="margin-top:12px"><button class="btn primario" data-tp="${esc(b.id)}">▶ Abrir teleprompter</button>
        ${c.pasta_envio_url ? `<a class="btn" href="${esc(c.pasta_envio_url)}" target="_blank" rel="noopener">📁 Abrir pasta de envio</a>` : ""}
        ${b.status !== "gravado" && b.status !== "enviado" ? `<button class="btn" data-gravado="${esc(b.id)}">Já gravei</button>` : ""}
        ${b.status !== "enviado" ? `<button class="btn ok" data-enviado="${esc(b.id)}">Marcar como enviado</button>` : ""}</div></div>`;
  };
  el.innerHTML = cabecalho("Gravar", "Os vídeos que você precisa gravar, com o texto para ler.") +
    (ativos.length ? ativos.map(card).join("") : `<div class="vazio">Nenhum vídeo para gravar agora. 🎉</div>`) +
    (feitos.length ? `<details style="margin-top:16px"><summary>Já enviados (${feitos.length})</summary>${feitos.map(card).join("")}</details>` : "");
  $$("[data-tp]", el).forEach((b) => b.onclick = () => teleprompter(briefs.find((x) => x.id === b.dataset.tp).texto_teleprompter || ""));
  $$("[data-gravado]", el).forEach((b) => b.onclick = async () => {
    try { await D.atualizar("briefings", { id: b.dataset.gravado }, { status: "gravado" }); avisar("Anotado: gravado.", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
  $$("[data-enviado]", el).forEach((b) => b.onclick = () => {
    const m = abrirModal("Marcar como enviado", `<p>Enviou o vídeo para a pasta? Se quiser, cole o link do arquivo.</p><input type="url" id="lk" placeholder="https://drive.google.com/... (opcional)">
      <div class="modal-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn ok" id="ok-env">Marcar como enviado</button></div>`);
    $("#ok-env", m).onclick = async () => {
      try { await D.atualizar("briefings", { id: b.dataset.enviado }, { status: "enviado", link_envio: $("#lk", m).value.trim() || null }); fecharModal(); avisar("Obrigada! Vídeo marcado como enviado.", "ok"); rotear(); }
      catch (e) { avisar(erroAmigavel(e), "erro"); }
    };
  });
};

function teleprompter(texto) {
  const div = document.createElement("div");
  div.className = "teleprompter";
  div.innerHTML = `<div class="marca-leitura"></div><div class="texto-tp" id="tp-texto">${esc(texto).replace(/\n/g, "<br><br>")}<div style="height:60vh"></div></div>
    <div class="controles"><button class="btn" id="tp-play">▶ Rolar</button><label style="color:#fff;margin:0;display:flex;gap:6px;align-items:center">Velocidade <input type="range" id="tp-vel" min="1" max="10" value="3"></label>
      <button class="btn" id="tp-menor">A-</button><button class="btn" id="tp-maior">A+</button><button class="btn" id="tp-cheia">⛶ Tela cheia</button><button class="btn" id="tp-fechar">Fechar</button></div>`;
  document.body.appendChild(div);
  const t = $("#tp-texto", div);
  let rodando = false, ultimo = 0, tam = parseFloat(getComputedStyle(t).fontSize), acumulado = 0;
  const passo = (ts) => {
    if (!rodando) return;
    const dt = ultimo ? (ts - ultimo) / 1000 : 0; ultimo = ts;
    acumulado += dt * Number($("#tp-vel", div).value) * 14;
    if (acumulado >= 1) { t.scrollTop += Math.floor(acumulado); acumulado -= Math.floor(acumulado); }
    requestAnimationFrame(passo);
  };
  $("#tp-play", div).onclick = () => { rodando = !rodando; ultimo = 0; $("#tp-play", div).textContent = rodando ? "⏸ Pausar" : "▶ Rolar"; if (rodando) requestAnimationFrame(passo); };
  $("#tp-menor", div).onclick = () => { tam = Math.max(20, tam - 4); t.style.fontSize = tam + "px"; };
  $("#tp-maior", div).onclick = () => { tam = Math.min(120, tam + 4); t.style.fontSize = tam + "px"; };
  $("#tp-cheia", div).onclick = () => { if (!document.fullscreenElement) div.requestFullscreen && div.requestFullscreen().catch(() => null); else document.exitFullscreen(); };
  $("#tp-fechar", div).onclick = () => { rodando = false; if (document.fullscreenElement) document.exitFullscreen().catch(() => null); div.remove(); };
}

// ---------------------------------------------------------------- Automações (cliente)
// O cliente cria, edita, duplica, ativa e desativa. Não exclui. A social media recebe um aviso.
ROTAS["c-automacoes"] = async (el, args) => {
  const c = clienteAtual();
  if (args[0] === "editar") return editorAutomacao(el, args[1]);
  el.innerHTML = cabecalho("⚡ Automações", "Respostas automáticas no direct para quem comenta, manda mensagem ou responde aos seus stories.") +
    `<div class="faixa info">Dica: uma frase e um botão funcionam melhor. Evite vender direto na mensagem e cuidado com "qualquer palavra" em posts muito comentados. Para excluir uma automação, fale com a sua social media.</div><div id="auto-cliente"></div>`;
  await abaAutomacoes($("#auto-cliente"), c);
};

// ---------------------------------------------------------------- Ideias
ROTAS["c-ideias"] = async (el) => {
  const c = clienteAtual();
  const ideias = await D.lista("ideias", { eq: { cliente_id: c.id }, ordem: "-created_at", limite: 50 });
  el.innerHTML = cabecalho("Ideias", "Teve uma ideia de conteúdo? Manda aqui, por texto ou áudio.") + `
    <div class="cartao"><h2>Tive uma ideia</h2><textarea id="id-txt" placeholder="Ex.: falar sobre a pergunta que a cliente me fez hoje"></textarea>
      <div class="linha" style="margin-top:8px"><button class="btn primario" id="id-enviar">Enviar ideia</button><button class="btn" id="id-audio">🎙️ Gravar áudio</button><span id="id-status"></span></div></div>
    <h2>Suas ideias</h2>${ideias.length ? ideias.map((i) => `<div class="cartao plano"><small>${fmtData(i.created_at)} · ${i.status === "virou_pauta" ? "virou conteúdo ✓" : i.status === "arquivada" ? "guardada" : "recebida"}</small>
      <p>${i.tipo === "audio" ? "🎙️ " : ""}${esc(i.conteudo || "")}</p></div>`).join("") : `<p class="suave">Nenhuma ideia ainda.</p>`}`;
  $("#id-enviar").onclick = async () => {
    const txt = $("#id-txt").value.trim();
    if (!txt) { avisar("Escreva a ideia antes de enviar."); return; }
    try { await D.inserir("ideias", { cliente_id: c.id, tipo: "texto", conteudo: txt, status: "nova" }); avisar("Ideia enviada. Obrigada!", "ok"); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  gravadorAudio($("#id-audio"), $("#id-status"), async (blob) => {
    try { const caminho = await subirAudio(blob, "ideias"); await D.inserir("ideias", { cliente_id: c.id, tipo: "audio", conteudo: $("#id-txt").value.trim() || "Ideia em áudio", audio_url: caminho, status: "nova" }); avisar("Áudio enviado. Obrigada!", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  });
};

// ---------------------------------------------------------------- Resultados
ROTAS["c-resultados"] = async (el) => {
  const c = clienteAtual();
  const [dias, rels, pedidos] = await Promise.all([
    D.lista("metricas_conta", { eq: { cliente_id: c.id }, ordem: "data" }),
    D.lista("relatorios", { eq: { cliente_id: c.id, publicado: true }, ordem: "-mes" }),
    D.lista("pedidos_audiencia", { eq: { cliente_id: c.id }, ordem: "-ocorrencias", limite: 10 }),
  ]);
  const pp = c.ponto_de_partida || {};
  const ultimo = [...dias].reverse().find((d) => d.seguidores != null) || {};
  const doMes = dias.filter((d) => String(d.data).startsWith(mesAtual()));
  const novosMes = doMes.reduce((s, d) => s + (d.novos_seguidores || 0), 0);
  const alcanceMes = doMes.reduce((s, d) => s + (d.alcance || 0), 0);
  const dif = pp.seguidores != null && ultimo.seguidores != null ? ultimo.seguidores - pp.seguidores : null;
  el.innerHTML = cabecalho("Resultados", "Como o seu Instagram está andando.") + `
    <div class="grade duas"><div class="cartao"><h2>Antes e depois</h2>
      <p><strong>Quando começamos</strong>${pp.data ? ` (${fmtData(pp.data)})` : ""}: ${pp.seguidores != null ? fmtNum(pp.seguidores) + " seguidores" : "sem dado"}</p>
      <p><strong>Hoje:</strong> ${ultimo.seguidores != null ? fmtNum(ultimo.seguidores) + " seguidores" : "sem dado"}</p>
      ${dif != null ? `<p class="numero-grande" style="color:${dif >= 0 ? "var(--ok)" : "var(--erro)"}">${dif >= 0 ? "+" : ""}${fmtNum(dif)}</p><small>seguidores desde o começo</small>` : ""}</div>
      <div class="cartao"><h2>Este mês</h2><p>🙋 <strong>${fmtNum(novosMes)}</strong> pessoas novas começaram a seguir você.</p>
        <p>👀 Seus conteúdos apareceram <strong>${fmtNum(alcanceMes)}</strong> vezes para as pessoas (alcance somado dos dias).</p></div></div>
    <div class="cartao"><h2>Relatórios</h2>${rels.length ? rels.map((r) => `<details class="cartao plano" id="rel-${esc(r.id)}"><summary><strong>${esc(nomeMes(r.mes))}</strong></summary>
      <div class="corpo-rel">${md(r.conteudo)}</div><button class="btn" data-imprimir="${esc(r.id)}">🖨️ Imprimir ou salvar em PDF</button></details>`).join("") : `<p class="suave">O primeiro relatório aparece aqui no fim do mês.</p>`}</div>
    ${pedidos.length ? `<div class="cartao"><h2>O que o seu público mais pergunta</h2>${pedidos.map((x) => `<p>"${esc(x.frase_exata)}" <small class="suave">(${x.ocorrencias} vez${x.ocorrencias > 1 ? "es" : ""})</small></p>`).join("")}</div>` : ""}`;
  $$("[data-imprimir]", el).forEach((b) => b.onclick = () => {
    const det = $("#rel-" + b.dataset.imprimir); det.open = true; det.classList.add("imprimir");
    window.print(); setTimeout(() => det.classList.remove("imprimir"), 500);
  });
};

// ---------------------------------------------------------------- Jornada
ROTAS["c-jornada"] = async (el) => {
  const c = clienteAtual();
  const atual = Number(c.fase_ciclo || 0);
  el.innerHTML = cabecalho("Jornada", "Em que parte do caminho a gente está e por quê.") + `
    ${(c.proximo_marco || {}).texto ? `<div class="faixa info"><strong>Próximo marco:</strong> ${esc(c.proximo_marco.texto)}${c.proximo_marco.data ? ` (${fmtData(c.proximo_marco.data)})` : ""}</div>` : ""}
    <div class="cartao"><div class="jornada">${FASES.map((f) => `<div class="fase ${f.n < atual ? "feita" : ""} ${f.n === atual ? "atual" : ""}"><div class="bola">${f.n < atual ? "✓" : f.n}</div>
      <div style="flex:1"><strong>${esc(f.nome)}</strong>${f.n === atual ? ` <span class="pilula destaque">você está aqui</span>` : ""}
      ${f.n === atual ? `<div class="por-que"><strong>Por que estamos fazendo isso:</strong> ${esc(f.porque)}</div>` : ""}</div></div>`).join("")}</div>
      <p class="suave">Depois da última fase, voltamos para o Crescimento com tudo o que aprendemos.</p></div>`;
};

// ---------------------------------------------------------------- Recados
ROTAS["c-recados"] = async (el) => {
  const c = clienteAtual();
  const recs = await D.lista("recados", { eq: { cliente_id: c.id }, ordem: "-created_at", limite: 60 });
  const zap = linkWhats(`Oi! Aqui é ${S.usuario.nome || c.nome}. `);
  el.innerHTML = cabecalho("Recados", "Avisos e combinados entre a gente.", zap ? `<a class="btn whats" href="${esc(zap)}" target="_blank" rel="noopener">💬 Falar no WhatsApp</a>` : "") + `
    <div class="cartao"><textarea id="rc-txt" placeholder="Escreva um recado"></textarea><div class="modal-rodape"><button class="btn primario" id="rc-enviar">Enviar recado</button></div></div>
    ${recs.length ? recs.map((r) => `<div class="cartao plano"><small>${r.autor_id === S.usuario.id ? "Você" : esc(S.config.nome || "Social media")} · ${esc(tempoRelativo(r.created_at))}${r.tipo === "decisao" ? ` · <span class="pilula info">decisão</span>` : ""}</small><p style="white-space:pre-wrap">${esc(r.texto)}</p></div>`).join("") : `<p class="suave">Nenhum recado ainda.</p>`}`;
  $("#rc-enviar").onclick = async () => {
    const t = $("#rc-txt").value.trim();
    if (!t) return;
    try { await D.inserir("recados", { cliente_id: c.id, autor_id: S.usuario.id, texto: t, tipo: "aviso" }); rotear(); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// ---------------------------------------------------------------- Acervo
ROTAS["c-acervo"] = async (el) => {
  const c = clienteAtual();
  const [pubs, cer] = await Promise.all([D.lista("posts", { eq: { cliente_id: c.id, status: "publicado" }, ordem: "-data", limite: 200 }), D.um("cerebro", { eq: { cliente_id: c.id } })]);
  const regras = cer ? [secaoMd(cer.conteudo_md, "## 3. Voz"), secaoMd(cer.conteudo_md, "## 7. Identidade"), secaoMd(cer.conteudo_md, "## 9. Regras")].filter(Boolean).join("\n\n") : "";
  el.innerHTML = cabecalho("Acervo", "Tudo o que já foi publicado, com roteiros e legendas.") + `
    <div class="cartao"><h2>Publicados (${pubs.length})</h2>${pubs.length ? pubs.map((p) => `<details class="cartao plano"><summary>${fmtData(p.data)} · ${esc(p.tema)} <small class="suave">${esc(p.formato || "")}</small></summary>
      ${p.link_publicado ? `<p><a href="${esc(p.link_publicado)}" target="_blank" rel="noopener">Ver no Instagram ↗</a></p>` : ""}
      ${p.roteiro ? `<h4>Roteiro</h4><pre>${esc(p.roteiro)}</pre>` : ""}${p.legenda ? `<h4>Legenda</h4><pre>${esc(p.legenda)}</pre>` : ""}</details>`).join("") : `<p class="suave">Nada publicado ainda.</p>`}</div>
    ${regras ? `<div class="cartao"><h2>Regras da sua marca</h2>${md(regras)}</div>` : ""}`;
};

// ---------------------------------------------------------------- Meu plano
ROTAS["c-plano"] = async (el) => {
  const c = clienteAtual();
  const e = c.escopo || {};
  const [posts, contas] = await Promise.all([
    D.lista("posts", { eq: { cliente_id: c.id }, gte: { data: mesAtual() + "-01" } }),
    D.lista("ig_contas_publico", { eq: { cliente_id: c.id } }).catch(() => []),
  ]);
  const doMes = posts.filter((p) => String(p.data).startsWith(mesAtual()));
  const entregues = doMes.filter((p) => ["aprovado", "agendado", "publicado"].includes(p.status)).length;
  const meta = Number(e.posts_semana || 0) * 4;
  const conta = contas[0];
  el.innerHTML = cabecalho("Meu plano", esc(c.plano || "")) + `
    <div class="cartao"><h2>O que está incluído</h2><ul>
      ${e.posts_semana ? `<li>${e.posts_semana} posts por semana${e.formatos ? ` (${esc(e.formatos)})` : ""}</li>` : ""}
      <li>Planejamento mensal e briefings de gravação</li>${e.relatorio !== false ? "<li>Relatório mensal</li>" : ""}
      <li>${Number(e.rodadas_ajuste || 1)} rodada${Number(e.rodadas_ajuste || 1) > 1 ? "s" : ""} de ajuste por post</li>
      <li>Prazo para aprovar: ${Number(e.prazo_aprovacao_dias || 2)} dias. Sem resposta no prazo, o conteúdo é considerado aprovado.</li>
      ${e.lancamentos ? `<li>${e.lancamentos} lançamento(s) por ano</li>` : ""}</ul></div>
    <div class="cartao"><h2>Entregas deste mês</h2><p class="numero-grande">${entregues}${meta ? ` <small class="suave" style="font-size:16px">de ${meta}</small>` : ""}</p>
      <div class="progresso"><div style="width:${meta ? Math.min(100, (entregues / meta) * 100) : 0}%"></div></div></div>
    <div class="cartao"><h2>Meu Instagram</h2>
      <p>Conecte seu Instagram para que eu possa acompanhar seus resultados e cuidar das respostas automáticas. Você pode desconectar quando quiser.</p>
      ${conta ? `<p>${conta.situacao === "ativa" ? "✅" : "⚠️"} <strong>@${esc(conta.username || "")}</strong> ${conta.situacao === "ativa" ? "conectado" : "precisa reconectar"}</p>
        <button class="btn perigo" id="desc-ig">Desconectar</button>`
      : `<p class="suave">Ainda não conectado.${CFG.loginInstagramAtivo ? "" : " Sua social media faz essa conexão para você."}</p>`}
      ${CFG.loginInstagramAtivo && (!conta || conta.situacao !== "ativa") ? `<button class="btn primario" id="con-ig">Conectar Instagram</button>` : ""}</div>`;
  if ($("#con-ig")) $("#con-ig").onclick = () => iniciarLoginMeta(c.id, null);
  if ($("#desc-ig")) $("#desc-ig").onclick = async () => {
    if (!(await confirmar("Desconectar seu Instagram? As respostas automáticas vão parar.", "Desconectar", true))) return;
    try { await D.funcao("ig-account-disconnect", { ig_account_id: conta.ig_account_id }); avisar("Instagram desconectado.", "ok"); rotear(); } catch (er) { avisar(erroAmigavel(er), "erro"); }
  };
};

// ---------------------------------------------------------------- Pesquisa do mês
ROTAS["c-pesquisa"] = async (el) => {
  const c = clienteAtual();
  const ja = await D.um("pesquisa_satisfacao", { eq: { cliente_id: c.id, mes: mesAtual() } });
  if (ja) { el.innerHTML = cabecalho("Pesquisa do mês") + `<div class="vazio"><p style="font-size:18px">Obrigada pela resposta! 💛</p><p>Você deu nota ${ja.nota} em ${esc(nomeMes(ja.mes))}. A próxima pesquisa abre no mês que vem.</p></div>`; return; }
  let nota = null;
  el.innerHTML = cabecalho("Pesquisa do mês", "Uma pergunta só, uma vez por mês.") + `<div class="cartao">
    <p class="pergunta-grande">De 0 a 10, o quanto você recomendaria o meu trabalho para alguém?</p>
    <div class="linha" id="notas">${[...Array(11)].map((_, n) => `<button class="btn" data-nota="${n}" style="min-width:44px">${n}</button>`).join("")}</div>
    <label>Quer contar o porquê? (opcional)</label><textarea id="ps-com"></textarea>
    <div class="modal-rodape"><button class="btn primario" id="ps-enviar">Enviar</button></div></div>`;
  $$("[data-nota]", el).forEach((b) => b.onclick = () => { nota = Number(b.dataset.nota); $$("[data-nota]", el).forEach((x) => x.classList.toggle("primario", x === b)); });
  $("#ps-enviar").onclick = async () => {
    if (nota == null) { avisar("Escolha uma nota de 0 a 10."); return; }
    try { await D.inserir("pesquisa_satisfacao", { cliente_id: c.id, mes: mesAtual(), nota, comentario: $("#ps-com").value.trim() || null }); avisar("Obrigada!", "ok"); rotear(); }
    catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// ---------------------------------------------------------------- Baixar meus dados
ROTAS["c-dados"] = async (el) => {
  const c = clienteAtual();
  el.innerHTML = cabecalho("Baixar meus dados", "Uma cópia de tudo o que é seu aqui no portal.") + `<div class="cartao">
    <p>Inclui: seu cadastro, onboarding, Cérebro da Marca, posts, aprovações, briefings, ideias, recados, métricas, relatórios publicados e pesquisas.</p>
    <div class="linha"><button class="btn primario" id="bx-json">Baixar em JSON</button><button class="btn" id="bx-csv">Baixar em CSV</button></div></div>`;
  const juntar = async () => {
    const f = { eq: { cliente_id: c.id } };
    const [onboarding, cerebro, posts, aprovacoes, briefings, ideias, recados, metricas_post, metricas_conta, relatorios, pesquisa, pedidos] = await Promise.all([
      D.lista("onboarding", f), D.lista("cerebro", f), D.lista("posts", f), D.lista("aprovacoes", f), D.lista("briefings", f), D.lista("ideias", f), D.lista("recados", f),
      D.lista("metricas_post", f), D.lista("metricas_conta", f), D.lista("relatorios", { eq: { cliente_id: c.id, publicado: true } }), D.lista("pesquisa_satisfacao", f), D.lista("pedidos_audiencia", f)]);
    const cad = Object.assign({}, c); delete cad.observacoes;
    return { gerado_em: new Date().toISOString(), cliente: cad, onboarding, cerebro, posts, aprovacoes, briefings, ideias, recados, metricas_post, metricas_conta, relatorios, pesquisa_satisfacao: pesquisa, pedidos_audiencia: pedidos };
  };
  $("#bx-json").onclick = async () => {
    try { baixarArquivo(`meus-dados-${slugify(c.nome)}-${hojeISO()}.json`, JSON.stringify(await juntar(), null, 2), "application/json"); } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
  $("#bx-csv").onclick = async () => {
    try {
      const tudo = await juntar(), linhas = [];
      for (const [tabela, valor] of Object.entries(tudo)) {
        const lista = Array.isArray(valor) ? valor : [valor];
        lista.forEach((reg, n) => { if (reg && typeof reg === "object") Object.entries(reg).forEach(([campo, v]) => linhas.push([tabela, n + 1, campo, typeof v === "object" && v !== null ? JSON.stringify(v) : v])); else linhas.push([tabela, 1, "", reg]); });
      }
      baixarArquivo(`meus-dados-${slugify(c.nome)}-${hojeISO()}.csv`, gerarCSV(["Tabela", "Registro", "Campo", "Valor"], linhas), "text/csv;charset=utf-8");
    } catch (e) { avisar(erroAmigavel(e), "erro"); }
  };
};

// =============================================================================
// 8. INÍCIO
// =============================================================================
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => null));
}
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fecharModal(); });
iniciar().catch((e) => { console.error(e); $("#app").innerHTML = `<div class="tela-cheia-centro"><div class="caixa-login"><p>${esc(erroAmigavel(e))}</p></div></div>`; });
window.__portal = { versao: VERSAO_APP };
})();

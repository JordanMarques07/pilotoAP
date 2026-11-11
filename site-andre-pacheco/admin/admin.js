/* =====================================================================
   admin.js — PAINEL ADMINISTRATIVO
   =====================================================================
   Tela de login + 3 áreas: Imóveis, Corretores e Dados da empresa.
   Permite ao cliente cadastrar, editar e excluir tudo sem mexer em código.

   DOIS MODOS (definidos por API_URL em config.js):
     - API_URL vazio -> MODO DEMONSTRAÇÃO: login admin/admin e dados gravados no
       navegador (localStorage "ap_demo"). O site público lê os mesmos dados.
     - API_URL cheio -> fala com o servidor: login real, token em cada chamada,
       fotos enviadas por upload. Endereços exatos no LEIA-ME.md, seção 4.2.

   ONDE O BACK END SE ENCAIXA: só no objeto "api" (seção 2) e na função
   "login" (seção 3). O restante é interface e não precisa mudar.

   ESTRUTURA DO ARQUIVO:
     1. Utilitários e estado        4. Imóveis (lista + formulário)
     2. Camada de dados (api)       5. Corretores (lista + formulário)
     3. Login e estrutura da tela   6. Dados da empresa
   ===================================================================== */
(() => {

/* ---------- 1. UTILITÁRIOS E ESTADO ---------- */
// C = configuração. DEMO = true quando não há API. $ = atalho de querySelector.
const C = window.CFG, DEMO = !C.API_URL, $ = (s, r = document) => r.querySelector(s);
// esc: protege contra HTML injetado (use sempre que colocar texto em innerHTML).
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
// brl: moeda em reais; valor 0/vazio vira "Sob consulta".
const brl = n => n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Sob consulta";
// list: aceita a resposta da API como lista simples ou paginada { content: [...] }.
const list = a => Array.isArray(a) ? a : (a && a.content) || [];
// cssUrl: endereço de imagem -> url("...") seguro para CSS ("" se inválido). Usado na pré-visualização do banner.
// safe: valida a URL de uma imagem (http(s), caminho relativo ou data:image do modo demo).
const safe = u => (/^(https?:)?\/\//.test(u) || /^[\w./-]+$/.test(u) || /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(u)) ? esc(u) : "";
// token = chave de acesso devolvida pelo login (vazio = não logado). tab = área aberta
// ("im" imóveis, "co" corretores, "em" empresa). O token fica em sessionStorage:
// some ao fechar a aba do navegador.
const cssUrl = u => safe(u) ? 'url("' + encodeURI(u).replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16)) + '")' : "";
let token = "", tab = "im";
try { token = sessionStorage.getItem("ap_tk") || ""; } catch (e) {}
// toast: aviso temporário no rodapé da tela. ruim = true deixa vermelho (erro).
const toast = (m, ruim) => { const t = $("#toast"); t.textContent = m; t.className = "on" + (ruim ? " ruim" : ""); clearTimeout(toast.h); toast.h = setTimeout(() => t.className = "", 3500); };

/* ---------- 2. CAMADA DE DADOS (AQUI SE LIGA O BACK END) ---------- */
// MODO DEMONSTRAÇÃO: D() lê os dados salvos no navegador (ou os exemplos do mock.js)
// e G(d) grava. Só existe para testar sem servidor.
const D = () => { try { const j = JSON.parse(localStorage.getItem("ap_demo")); if (j && j.imoveis && j.versao === window.MOCK.versao) return j; } catch (e) {} return JSON.parse(JSON.stringify(window.MOCK)); };   // cópia só vale se for da mesma "versao" do mock.js
const G = d => localStorage.setItem("ap_demo", JSON.stringify(d));
// sair: apaga o token e volta para a tela de login.
const sair = () => { token = ""; try { sessionStorage.removeItem("ap_tk"); } catch (e) {} render(); };
// req(método, caminho, corpo): chamada autenticada ao servidor.
//   - Envia "Authorization: Bearer <token>" quando há token.
//   - Corpo JSON (objeto) ou arquivo (FormData, usado no upload de fotos).
//   - 401 com token = sessão expirada: volta ao login. Outros erros viram exceção.
const req = async (m, p, b) => {
  const h = {}; if (b && !(b instanceof FormData)) h["Content-Type"] = "application/json"; if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(C.API_URL + p, { method: m, headers: h, body: b instanceof FormData ? b : b ? JSON.stringify(b) : undefined });
  if (r.status === 401 && token) { sair(); throw new Error("Sessão expirada"); }
  if (!r.ok) throw new Error("Erro " + r.status);
  return r.status === 204 ? null : r.json();
};
// reduzir: (só modo demo) diminui a foto para no máx. 1000 px e a guarda como texto
// (data URL), para caber no armazenamento do navegador. Com API não é usada.
// max = lado maior em pixels (fotos de imóveis: 1000; fundo do banner: 1920).
const reduzir = (f, max = 1000) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * k; c.height = im.height * k; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", .7)); }; im.onerror = no; im.src = r.result; }; r.onerror = no; r.readAsDataURL(f); });
// api: TODAS as operações de dados do painel. "rec" é o recurso: "imoveis" ou "corretores".
//   ler(rec)         GET  /imoveis ou /corretores           (público, sem token)
//   inst()           GET  /institucional                    (público, sem token)
//   salvar(rec, x)   sem x.id -> POST /admin/{rec}          cria
//                    com x.id -> PUT  /admin/{rec}/{id}     atualiza
//   excluir(rec,id)  DELETE /admin/{rec}/{id}
//   salvarInst(x)    PUT /admin/institucional
//   foto(arquivo)    POST /admin/upload (campo "arquivo") -> { url }
const api = {
  async ler(rec) { return DEMO ? D()[rec] : list(await (await fetch(C.API_URL + "/" + rec)).json()); },
  async inst() { return DEMO ? D().inst : (await fetch(C.API_URL + "/institucional")).json(); },
  async salvar(rec, x) {
    if (!DEMO) return req(x.id ? "PUT" : "POST", "/admin/" + rec + (x.id ? "/" + x.id : ""), x);
    // --- modo demonstração: simula o servidor gravando no navegador ---
    const d = D();
    if (x.id) d[rec] = d[rec].map(y => String(y.id) === String(x.id) ? x : y); else { x.id = Math.max(100, ...d[rec].map(y => +y.id || 0)) + 1; d[rec].push(x); }
    // Se o nome de um corretor mudou, atualiza o nome gravado dentro dos imóveis dele.
    if (rec === "corretores") d.imoveis.forEach(i => { if (i.corretor && String(i.corretor.id) === String(x.id)) i.corretor = { id: x.id, nome: x.nome }; });
    G(d); return x;
  },
  async excluir(rec, id) {
    if (!DEMO) return req("DELETE", "/admin/" + rec + "/" + id);
    const d = D(); d[rec] = d[rec].filter(y => String(y.id) !== String(id));
    // Corretor excluído: os imóveis dele ficam sem corretor responsável.
    if (rec === "corretores") d.imoveis.forEach(i => { if (i.corretor && String(i.corretor.id) === String(id)) i.corretor = null; });
    G(d);
  },
  async salvarInst(x) { if (!DEMO) return req("PUT", "/admin/institucional", x); const d = D(); d.inst = x; G(d); },
  async foto(f, max) { if (DEMO) return reduzir(f, max); const fd = new FormData(); fd.append("arquivo", f); return (await req("POST", "/admin/upload", fd)).url; }
};

/* ---------- 3. LOGIN E ESTRUTURA DA TELA ---------- */
// modal: abre uma janela sobre a tela (usada nos formulários) e a devolve.
// Fecha ao clicar fora. Cada formulário a fecha ao salvar ou cancelar.
const modal = html => { const m = document.createElement("div"); m.className = "md"; m.innerHTML = `<div class="mb">${html}</div>`; document.body.append(m); m.onclick = e => { if (e.target === m) m.remove(); }; return m; };
// opt: gera <option> para um <select>. a = lista de [valor, texto]; sel = valor selecionado.
const opt = (a, sel) => a.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(sel) ? " selected" : ""}>${esc(o[1])}</option>`).join("");
// ligar: liga os botões "Novo", "Editar" e "Excluir" de uma tabela (imóveis ou corretores).
//   abrir(item) abre o formulário (item = null para novo); voltar() recarrega a lista.
const ligar = (mn, L, abrir, rec, voltar) => {
  $("#novo").onclick = () => abrir(null);
  mn.querySelectorAll("[data-e]").forEach(b => b.onclick = () => abrir(L.find(x => String(x.id) === b.dataset.e)));
  mn.querySelectorAll("[data-d]").forEach(b => b.onclick = async () => { if (!confirm("Excluir? Esta ação não pode ser desfeita.")) return; try { await api.excluir(rec, b.dataset.d); toast("Excluído."); voltar(); } catch (e) { toast("Não foi possível excluir.", 1); } });
};
// erroSalvar: mensagem de erro ao gravar (o caso "cheio" só acontece no modo demo).
const erroSalvar = er => toast(er && er.name === "QuotaExceededError" ? "Armazenamento de demonstração cheio. Use menos fotos." : "Não foi possível salvar.", 1);

// login: desenha o formulário de entrada.
//   Demo: aceita só admin/admin.  API: POST /admin/login { usuario, senha } -> { token }.
//   Segurança: quem protege os dados é o SERVIDOR; aqui só se guarda o token.
function login() {
  $("#app").innerHTML = `<form class="lg" id="lg"><h1>Painel administrativo</h1><p>André Pacheco Negócios Imobiliários</p><label for="u">Usuário</label><input id="u" required autocomplete="username"><label for="s">Senha</label><input id="s" type="password" required autocomplete="current-password"><button class="go" type="submit">Entrar</button>${DEMO ? "<small>Modo demonstração: usuário <b>admin</b> e senha <b>admin</b>. Os dados ficam só neste navegador.</small>" : ""}</form>`;
  $("#lg").onsubmit = async e => {
    e.preventDefault();
    try {
      if (DEMO) { if ($("#u").value !== "admin" || $("#s").value !== "admin") throw 0; token = "demo"; }
      else token = (await req("POST", "/admin/login", { usuario: $("#u").value, senha: $("#s").value })).token;
      try { sessionStorage.setItem("ap_tk", token); } catch (er) {}
      render();
    } catch (er) { toast("Usuário ou senha inválidos.", 1); }
  };
}

// render: desenha a tela principal (menu lateral + área da aba atual). Sem token, mostra o login.
// Para criar uma nova aba: acrescente no array do menu e na tabela de funções no fim desta função.
function render() {
  if (!token) return login();
  $("#app").innerHTML = `<div class="shell"><aside><div class="bd">André Pacheco<small>Painel</small></div><nav>${[["im", "Imóveis"], ["co", "Corretores"], ["em", "Dados da empresa"]].map(t => `<button data-t="${t[0]}" class="${t[0] === tab ? "on" : ""}">${t[1]}</button>`).join("")}</nav><a href="../index.html" target="_blank">Ver o site</a><button id="out">Sair</button></aside><main id="mn"></main></div>`;
  document.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  $("#out").onclick = sair;
  ({ im: vImoveis, co: vCorretores, em: vEmpresa })[tab]();    // abre a aba escolhida
}

/* ---------- 4. IMÓVEIS ---------- */
// vImoveis: tabela com todos os imóveis (miniatura, tipo, valor, local, corretor).
async function vImoveis() {
  const mn = $("#mn"); let L, cs;
  try { [L, cs] = await Promise.all([api.ler("imoveis"), api.ler("corretores")]); } catch (e) { mn.innerHTML = "<p>Não foi possível carregar os imóveis.</p>"; return; }
  mn.innerHTML = `<div class="tb"><h1>Imóveis <small>(${L.length})</small></h1><button class="go" id="novo">Novo imóvel</button></div><div class="tw"><table><thead><tr><th>Ref.</th><th>Foto</th><th>Tipo</th><th>Negócio</th><th>Valor</th><th>Localização</th><th>Corretor</th><th></th></tr></thead><tbody>${L.map(x => { const l = x.localizacao || {}, f = x.fotos && x.fotos[0] ? safe(x.fotos[0]) : ""; return `<tr><td>${esc(x.id)}</td><td>${f ? `<img class="th" src="${f}" alt="">` : "—"}</td><td>${esc(x.tipo)}</td><td>${x.aquisicao === "aluguel" ? "Aluguel" : "Venda"}</td><td>${brl(x.valor)}</td><td>${esc([l.bairro, l.cidade].filter(Boolean).join(" - "))}</td><td>${esc(x.corretor ? x.corretor.nome : "")}</td><td class="ac"><button data-e="${esc(x.id)}">Editar</button><button data-d="${esc(x.id)}" class="rd">Excluir</button></td></tr>`; }).join("") || '<tr><td colspan="8">Nenhum imóvel cadastrado.</td></tr>'}</tbody></table></div>`;
  ligar(mn, L, x => fImovel(x, cs), "imoveis", vImoveis);
}

// fImovel(x, cs): formulário de imóvel. x = imóvel a editar (null = novo); cs = corretores
// (para o campo "Corretor responsável"). Ao salvar, monta o objeto no formato do contrato
// (ver mock.js) e chama api.salvar("imoveis", ...).
function fImovel(x, cs) {
  // v = valores atuais (vazio se novo). l = localização. fotos = cópia da lista de fotos
  // (reordenar/remover altera só a cópia até clicar em Salvar).
  const v = x || {}, l = v.localizacao || {}, fotos = [...(v.fotos || [])];
  const m = modal(`<form id="fi"><h2>${x ? "Editar imóvel " + esc(x.id) : "Novo imóvel"}</h2><div class="fg2">
    <div><label>Negócio</label><select name="aquisicao">${opt([["compra", "Compra"], ["aluguel", "Aluguel"]], v.aquisicao || "compra")}</select></div>
    <div><label>Tipo</label><select name="tipo">${opt([["casa", "Casa"], ["terreno", "Terreno"], ["apartamento", "Apartamento"]], v.tipo || "casa")}</select></div>
    <div><label>Valor (R$)</label><input name="valor" type="number" min="0" step="0.01" value="${esc(v.valor ?? "")}" placeholder="vazio ou 0 = sob consulta"></div>
    <div><label>Corretor responsável</label><select name="corretor"><option value="">Selecione</option>${opt(cs.map(c => [c.id, c.nome]), v.corretor && v.corretor.id)}</select></div>
    <div><label>Cidade</label><input name="cidade" required value="${esc(l.cidade || "")}"></div>
    <div><label>Bairro</label><input name="bairro" value="${esc(l.bairro || "")}"></div>
    <div class="w2"><label>Endereço (opcional)</label><input name="endereco" value="${esc(l.endereco || "")}"></div>
    <div><label>Quartos</label><input name="quartos" type="number" min="0" value="${esc(v.quartos ?? "")}"></div>
    <div><label>Banheiros</label><input name="banheiros" type="number" min="0" value="${esc(v.banheiros ?? "")}"></div>
    <div><label>Vagas</label><input name="vagas" type="number" min="0" value="${esc(v.vagas ?? "")}"></div>
    <div><label>Área (m²)</label><input name="areaM2" type="number" min="0" value="${esc(v.areaM2 ?? "")}"></div>
    <div class="w2"><label>Descrição</label><textarea name="descricao" rows="3">${esc(v.descricao || "")}</textarea></div></div>
    <label>Fotos (a primeira é a capa)</label><input type="file" id="ff" accept="image/*" multiple><div class="ths" id="ths"></div>
    <div class="mf2"><button class="go" type="submit">Salvar</button><button type="button" class="lk" id="cx">Cancelar</button></div></form>`);
  // th: redesenha as miniaturas das fotos, com botões "Capa" (move para o início) e × (remove).
  const th = () => {
    $("#ths", m).innerHTML = fotos.map((u, k) => `<div class="tt"><img src="${safe(u)}" alt=""><span>${k === 0 ? "Capa" : `<button type="button" data-c="${k}">Capa</button>`}<button type="button" data-r="${k}">×</button></span></div>`).join("");
    m.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { fotos.unshift(fotos.splice(+b.dataset.c, 1)[0]); th(); });
    m.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { fotos.splice(+b.dataset.r, 1); th(); });
  };
  th();
  // Escolher arquivos: cada um é enviado na hora (api.foto) e a URL devolvida entra na lista.
  $("#ff", m).onchange = async e => { for (const f of e.target.files) { try { fotos.push(await api.foto(f)); } catch (er) { toast("Não foi possível enviar " + f.name, 1); } } e.target.value = ""; th(); };
  $("#cx", m).onclick = () => m.remove();
  $("#fi", m).onsubmit = async e => {
    e.preventDefault(); const f = e.target, n = k => f[k].value === "" ? undefined : +f[k].value, c = cs.find(c => String(c.id) === f.corretor.value);
    // "...v" preserva campos que o formulário não conhece (ex.: algo extra vindo da API).
    // Campos numéricos opcionais vazios ficam "undefined" e não vão no JSON.
    const o = { ...v, aquisicao: f.aquisicao.value, tipo: f.tipo.value, valor: +f.valor.value || 0, localizacao: { cidade: f.cidade.value.trim(), bairro: f.bairro.value.trim(), endereco: f.endereco.value.trim() }, fotos, corretor: c ? { id: c.id, nome: c.nome } : null, quartos: n("quartos"), banheiros: n("banheiros"), vagas: n("vagas"), areaM2: n("areaM2"), descricao: f.descricao.value.trim() };
    try { await api.salvar("imoveis", o); m.remove(); toast("Imóvel salvo."); vImoveis(); } catch (er) { erroSalvar(er); }
  };
}

/* ---------- 5. CORRETORES ---------- */
// vCorretores: tabela de corretores (foto, nome, CRECI, WhatsApp).
async function vCorretores() {
  const mn = $("#mn"); let L;
  try { L = await api.ler("corretores"); } catch (e) { mn.innerHTML = "<p>Não foi possível carregar os corretores.</p>"; return; }
  mn.innerHTML = `<div class="tb"><h1>Corretores <small>(${L.length})</small></h1><button class="go" id="novo">Novo corretor</button></div><div class="tw"><table><thead><tr><th>Foto</th><th>Nome</th><th>CRECI</th><th>WhatsApp</th><th></th></tr></thead><tbody>${L.map(c => `<tr><td>${c.foto ? `<img class="th" src="${safe(c.foto)}" alt="">` : "—"}</td><td>${esc(c.nome)}</td><td>${esc(c.creci)}</td><td>${esc(c.whatsapp)}</td><td class="ac"><button data-e="${esc(c.id)}">Editar</button><button data-d="${esc(c.id)}" class="rd">Excluir</button></td></tr>`).join("") || '<tr><td colspan="5">Nenhum corretor cadastrado.</td></tr>'}</tbody></table></div>`;
  ligar(mn, L, fCorretor, "corretores", vCorretores);
}

// fCorretor(x): formulário de corretor (x = null para novo). Uma foto só.
function fCorretor(x) {
  const v = x || {}; let foto = v.foto || "";
  const m = modal(`<form id="fi"><h2>${x ? "Editar corretor" : "Novo corretor"}</h2><label>Nome</label><input name="nome" required value="${esc(v.nome || "")}"><label>CRECI</label><input name="creci" value="${esc(v.creci || "")}"><label>WhatsApp (com DDI e DDD)</label><input name="whatsapp" inputmode="numeric" placeholder="5519999999999" value="${esc(v.whatsapp || "")}"><label>Foto</label><input type="file" id="ff" accept="image/*"><div class="ths" id="ths"></div><div class="mf2"><button class="go" type="submit">Salvar</button><button type="button" class="lk" id="cx">Cancelar</button></div></form>`);
  const th = () => { $("#ths", m).innerHTML = foto ? `<div class="tt"><img src="${safe(foto)}" alt=""><span>Foto<button type="button" id="rf">×</button></span></div>` : ""; const r = $("#rf", m); if (r) r.onclick = () => { foto = ""; th(); }; };
  th();
  $("#ff", m).onchange = async e => { const f = e.target.files[0]; if (f) { try { foto = await api.foto(f); } catch (er) { toast("Não foi possível enviar a foto.", 1); } } e.target.value = ""; th(); };
  $("#cx", m).onclick = () => m.remove();
  $("#fi", m).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    // WhatsApp: guarda só os dígitos (é assim que o site monta os links wa.me).
    try { await api.salvar("corretores", { ...v, nome: f.nome.value.trim(), creci: f.creci.value.trim(), whatsapp: f.whatsapp.value.replace(/\D/g, ""), foto }); m.remove(); toast("Corretor salvo."); vCorretores(); } catch (er) { erroSalvar(er); }
  };
}

/* ---------- 6. DADOS DA EMPRESA ---------- */
// vEmpresa: formulário único com os "Dados globais" do diagrama (nome, CNPJ, Instagram,
// WhatsApp, endereço, missão, visão, valores e o contato de terreno + construção).
// Estes textos aparecem no topo, rodapé, Sobre, Contato e na página inicial do site.
async function vEmpresa() {
  const mn = $("#mn"); let i;
  try { i = await api.inst(); } catch (e) { mn.innerHTML = "<p>Não foi possível carregar os dados.</p>"; return; }
  const t = i.terrenoConstrucao || {};
  // Fundo do banner da página inicial: fundo = endereço da imagem ("" = fundo padrão); escuro = % de escurecimento.
  let fundo = i.bannerFundo || ""; const escuro = i.bannerEscuro ?? 55;
  mn.innerHTML = `<div class="tb"><h1>Dados da empresa</h1></div><form id="fe" class="card2"><div class="fg2">
    <div><label>Nome</label><input name="nome" required value="${esc(i.nome)}"></div><div><label>CNPJ</label><input name="cnpj" value="${esc(i.cnpj)}"></div>
    <div><label>Instagram</label><input name="instagram" value="${esc(i.instagram)}"></div><div><label>WhatsApp (com DDI e DDD)</label><input name="whatsapp" value="${esc(i.whatsapp)}"></div>
    <div><label>CRECI da imobiliária (aparece no logo)</label><input name="creci" placeholder="ex.: 54761-J" value="${esc(i.creci)}"></div><div></div>
    <div class="w2"><label>Endereço</label><input name="endereco" value="${esc(i.endereco)}"></div>
    <div class="w2"><label>Missão (opcional)</label><textarea name="missao" rows="3">${esc(i.missao)}</textarea></div>
    <div class="w2"><label>Visão / nossa história (separe os parágrafos com uma linha em branco)</label><textarea name="visao" rows="8">${esc(i.visao)}</textarea></div>
    <div class="w2"><label>Valores (um por linha)</label><textarea name="valores" rows="4">${esc((i.valores || []).join("\n"))}</textarea></div>
    <div class="w2"><label>Texto sobre os valores (opcional)</label><textarea name="valoresTexto" rows="4">${esc(i.valoresTexto)}</textarea></div>
    <div class="w2"><label>Terreno + construção: texto</label><textarea name="tTexto" rows="2">${esc(t.texto)}</textarea></div>
    <div class="w2"><label>Terreno + construção: WhatsApp</label><input name="tWhats" value="${esc(t.whatsapp)}"></div>
    <div class="w2"><label>Fundo do banner da página inicial (só o fundo muda; textos e botões continuam iguais)</label>
      <div class="bpv" id="bpv"><div id="bov"></div><span>Encontre o seu lar perfeito</span></div>
      <input type="file" id="bf" accept="image/*">
      <label style="margin-top:12px">Escurecimento da foto: <b id="bv"></b>% (aumente se o texto ficar difícil de ler)</label><input type="range" name="escuro" id="be" min="0" max="85" value="${esc(escuro)}">
      <button type="button" class="lk" id="brm">Remover imagem e voltar ao fundo padrão</button></div></div>
    <button class="go" type="submit">Salvar alterações</button></form>`;
  // pv: atualiza a pré-visualização do banner (imagem + escurecimento). Eventos: escolher imagem, remover, mover o controle.
  const pv = () => { $("#bv").textContent = $("#be").value; $("#bov").style.opacity = $("#be").value / 100; $("#bpv").style.backgroundImage = cssUrl(fundo); };
  $("#bf").onchange = async e => { const f = e.target.files[0]; if (f) { try { fundo = await api.foto(f, 1920); } catch (er) { toast("Não foi possível enviar a imagem.", 1); } } e.target.value = ""; pv(); };
  $("#brm").onclick = () => { fundo = ""; pv(); };
  $("#be").oninput = pv;
  pv();
  $("#fe").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    // "valores": cada linha do campo vira um item da lista. WhatsApps: só dígitos.
    try { await api.salvarInst({ ...i, nome: f.nome.value.trim(), cnpj: f.cnpj.value.trim(), creci: f.creci.value.trim(), instagram: f.instagram.value.trim(), whatsapp: f.whatsapp.value.replace(/\D/g, ""), endereco: f.endereco.value.trim(), missao: f.missao.value.trim(), visao: f.visao.value.trim(), bannerFundo: fundo, bannerEscuro: +f.escuro.value, valoresTexto: f.valoresTexto.value.trim(), valores: f.valores.value.split("\n").map(s => s.trim()).filter(Boolean), terrenoConstrucao: { texto: f.tTexto.value.trim(), whatsapp: f.tWhats.value.replace(/\D/g, "") } }); toast("Dados salvos."); } catch (er) { erroSalvar(er); }
  };
}

/* ---------- INÍCIO ---------- */
// Primeira tela: login (sem token) ou a aba de imóveis (com token salvo na sessão).
render();
})();

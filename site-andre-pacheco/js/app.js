/* =====================================================================
   app.js — NÚCLEO DO SITE PÚBLICO
   =====================================================================
   Carregado por TODAS as páginas públicas (por último, depois de config.js,
   mock.js e do script específico da página). O que ele faz:
     1. Busca os dados globais da empresa (API ou mock).
     2. Desenha o topo (menu) e o rodapé em <div id="hdr"> e <div id="ftr">.
     3. Publica as ferramentas em window.AP, para os outros scripts usarem.
     4. Carrega o chatbot (js/chat.js).
     5. Chama a lógica da página: a home roda aqui (função home); as demais
        páginas definem window.onAP, que é chamado no fim.

   ONDE O BACK END SE ENCAIXA: só no objeto "api" (seção 3) e em config.js.
   ===================================================================== */
(() => {

/* ---------- 1. CONFIGURAÇÃO E FONTE DOS DADOS ---------- */
// C = configuração (config.js). $ = atalho para document.querySelector.
// M = dados de demonstração: se o painel admin gravou dados no navegador
//     ("ap_demo" no localStorage) E forem da mesma "versao" do mock.js, usa esses;
//     senão usa window.MOCK (mock.js). Assim, dados antigos guardados no navegador
//     nunca escondem os dados novos do mock.js.
//     Só é usado quando API_URL está vazio.
const C = window.CFG, M = (() => { try { const j = JSON.parse(localStorage.getItem("ap_demo")); if (j && j.imoveis && j.versao === window.MOCK.versao) return j; } catch (e) {} return window.MOCK; })(), $ = (s, r = document) => r.querySelector(s);

/* ---------- 2. FUNÇÕES UTILITÁRIAS (usadas em todo o site) ---------- */
// esc: protege contra HTML injetado. SEMPRE use esc() ao colocar texto vindo da
//      API/usuário dentro de innerHTML.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
// brl: formata número como moeda (R$ 530.000,00). Valor 0/vazio vira "Sob consulta".
const brl = n => n ? Number(n).toLocaleString(window.I18N ? I18N.loc : "pt-BR", { style: "currency", currency: "BRL" }) : "Sob consulta";
// cap: primeira letra maiúscula ("casa" -> "Casa").
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";
// dig: deixa só os dígitos ("(19) 9999-0000" -> "1999990000").
const dig = s => String(s).replace(/\D/g, "");
// wa: monta o link do WhatsApp (número + mensagem opcional já codificada).
const wa = (n, m) => "https://wa.me/" + dig(n) + (m ? "?text=" + encodeURIComponent(m) : "");
// fmt: mostra o número de WhatsApp bonito: (19) 98929-8929.
const fmt = n => { n = dig(n).replace(/^55/, ""); return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : n; };
// safe: valida a URL de uma imagem antes de usar em <img src>. Aceita http(s),
//       caminhos relativos e imagens embutidas (data:image) do modo demonstração.
//       Qualquer outra coisa (ex.: "javascript:...") retorna "" (bloqueado).
const safe = u => (/^(https?:)?\/\//.test(u) || /^[\w./-]+$/.test(u) || /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(u)) ? esc(u) : "";
// list: aceita a resposta da API como lista simples [..] OU paginada { content: [..] }
//       (formato padrão do Spring Data). Sempre devolve um array.
const list = a => Array.isArray(a) ? a : (a && a.content) || [];
// cssUrl: transforma o endereço de uma imagem em url("...") seguro para usar em CSS
//         (devolve "" se o endereço não for válido). Usado no fundo do banner.
const cssUrl = u => safe(u) ? 'url("' + encodeURI(u).replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16)) + '")' : "";
// mapa(endereco): endereço CLICÁVEL que abre o mapa/GPS do aparelho. No celular o link do Google Maps
//       abre o aplicativo (se instalado); abaixo vão também os links do Waze e do Apple Maps.
//       Na busca, " – " vira vírgula para o mapa entender melhor o endereço.
const mapaUrl = (e, app) => { const q = encodeURIComponent(String(e).replace(/\s[–-]\s/g, ", ")); return app === "waze" ? "https://waze.com/ul?q=" + q + "&navigate=yes" : app === "apple" ? "https://maps.apple.com/?q=" + q : "https://www.google.com/maps/search/?api=1&query=" + q; };
const mapa = e => `<a class="end" href="${esc(mapaUrl(e))}" target="_blank" rel="noopener">${esc(e)}</a><span class="gps">Abrir no <a href="${esc(mapaUrl(e))}" target="_blank" rel="noopener">Google Maps</a> · <a href="${esc(mapaUrl(e, "waze"))}" target="_blank" rel="noopener">Waze</a> · <a href="${esc(mapaUrl(e, "apple"))}" target="_blank" rel="noopener">Apple Maps</a></span>`;

/* ---------- 3. CAMADA DE API (AQUI SE LIGA O BACK END) ---------- */
// get(caminho, dadosDeExemplo):
//   - com API_URL preenchido -> faz GET em API_URL + caminho e devolve o JSON;
//   - sem API_URL            -> devolve os dados de exemplo (modo demonstração).
// Obs.: se a API responder erro, a promessa falha e o tratamento de erro
//       fica no bloco de inicialização (seção 9).
const get = async (p, mock) => C.API_URL ? (await fetch(C.API_URL + p)).json() : mock;
// api: as 4 consultas que o site público faz. Contrato completo no LEIA-ME.md.
const api = {
  inst: () => get("/institucional", M.inst),                    // GET /institucional      -> dados da empresa
  cor: () => get("/corretores", M.corretores),                  // GET /corretores         -> lista de corretores
  imv: (q = "") => get("/imoveis" + q, M.imoveis),              // GET /imoveis            -> lista de imóveis
  imovel: id => get("/imoveis/" + encodeURIComponent(id),       // GET /imoveis/{id}       -> um imóvel
    (M.imoveis || []).find(x => String(x.id) === String(id)))
};

/* ---------- 4. ÍCONES (SVG embutidos, sem arquivos externos) ---------- */
// logo(i): imagem do logo (img/logo.png, branca com fundo transparente) com duas etiquetas brancas: "Imobiliária" em cima e
// "CRECI número" embaixo (o número vem de i.creci, em Dados da empresa). Sem CRECI cadastrado, a etiqueta de baixo some.
// As etiquetas são texto (CSS .pl em style.css), por isso ficam nítidas, traduzíveis e editáveis.
const logo = i => `<span class="lg2"><span class="pl pt">Imobiliária</span><img src="img/logo.png" alt="${esc(i.nome)}">${i.creci ? `<span class="pl pb">CRECI ${esc(i.creci)}</span>` : ""}</span>`;
const HOUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5"/></svg>';
const IG = '<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM17.5 6a1 1 0 110 2 1 1 0 010-2z"/></svg>';
const WP = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-8.6 15L2 22l5.1-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.2 14.8l-.3-.2-2.5.6.7-2.4-.2-.3A8 8 0 0112 4zM9 7.5c-.3 0-.7.2-.9.6-.3.5-.6 1.3 0 2.4 1 1.9 2.5 3.3 4.5 4.2 1 .4 1.9.3 2.4-.2.3-.3.5-.8.4-1l-1.7-.9c-.2-.1-.4 0-.6.2l-.5.6c-2-.9-2.6-1.7-3.2-3l.6-.5c.2-.1.2-.4.1-.6L9.9 8c-.1-.3-.4-.5-.9-.5z"/></svg>';

/* ---------- 5. TOPO, MENU E RODAPÉ (iguais em todas as páginas) ---------- */
// i = dados globais da empresa. Para adicionar um item ao menu, inclua uma linha
// no array "nav" abaixo: ["arquivo.html", "Texto do menu"].
function layout(i) {
  const pg = location.pathname.split("/").pop() || "index.html", ig = esc(String(i.instagram).replace("@", ""));
  const nav = [["index.html", "Início"], ["imoveis.html", "Imóveis"], ["corretores.html", "Corretores"], ["sobre.html", "Sobre"], ["contato.html", "Contato"], ["terreno.html", "Terreno + construção"]];
  // O link da página atual recebe class="on" (fica dourado).
  // Botões de idioma (PT | EN | ES). O idioma atual fica dourado. Escolher outro recarrega a página (ver js/i18n.js).
  const langs = window.I18N ? `<div class="lang">${I18N.idiomas.map(c => `<button type="button" data-l="${c}"${c === I18N.L ? ' class="on"' : ""} aria-label="${c.toUpperCase()}">${c.toUpperCase()}</button>`).join("")}</div>` : "";
  const links = nav.map(n => `<a href="${n[0]}"${n[0] === pg ? ' class="on"' : ""}>${n[1]}</a>`).join("");
  $("#hdr").innerHTML = `<header class="top"><div class="wrap t1"><a class="logo" href="index.html">${logo(i)}</a><div class="soc">${langs}<a href="https://instagram.com/${ig}" target="_blank" rel="noopener" aria-label="Instagram">${IG}</a><a href="${wa(i.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp">${WP}</a></div></div><nav class="wrap nav">${links}</nav></header>`;
  // Rodapé + botão flutuante do WhatsApp + balão de boas-vindas.
  $("#ftr").innerHTML = `<div class="ban"></div><footer><div class="wrap fg"><div>${logo(i)}</div><div><h4>${esc(i.nome)}</h4><p>CNPJ - ${esc(i.cnpj)}<br>${mapa(i.endereco)}</p><p><a href="${wa(i.whatsapp)}" target="_blank" rel="noopener">${fmt(i.whatsapp)}</a></p></div><div><h4>Menu</h4>${links}</div><div><h4>Social</h4><a href="https://instagram.com/${ig}" target="_blank" rel="noopener">Instagram</a><a href="${wa(i.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div></div><p class="wrap cp">© ${new Date().getFullYear()} ${esc(i.nome)} - Todos os direitos reservados</p></footer><a class="wfl" href="${wa(i.whatsapp, "Olá! Vim pelo site.")}" target="_blank" rel="noopener" aria-label="WhatsApp">${WP}</a><div class="bub" id="bub">Olá! Estamos disponíveis para te ajudar.<button type="button" aria-label="Fechar">×</button></div>`;
  // O balão fecha no botão × ou sozinho depois de 12 segundos.
  $("#bub button").onclick = () => $("#bub").remove();
  setTimeout(() => { const b = $("#bub"); if (b) b.remove(); }, 12000);
  document.querySelectorAll("[data-l]").forEach(b => b.onclick = () => I18N.set(b.dataset.l));
}

/* ---------- 5b. BLOCOS "MISSÃO / VISÃO / VALORES" (home e página Sobre) ---------- */
// par: quebra um texto em parágrafos (separados por linha em branco).
const par = s => String(s || "").split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
// tri(i, resumo): HTML dos cartões. Cartão sem texto não aparece (ex.: sem missão).
//   resumo = true  -> versão curta da home (1º parágrafo da visão + link "Leia mais");
//   resumo = false -> versão completa da página Sobre.
const tri = (i, resumo) => {
  const v = par(i.visao), vt = par(i.valoresTexto), ps = a => a.map(t => `<p>${esc(t)}</p>`).join("");
  return [
    i.missao ? `<div><h3>Missão</h3>${ps(par(i.missao))}</div>` : "",
    v.length ? `<div><h3>Visão</h3>${ps(resumo ? v.slice(0, 1) : v)}${resumo && v.length > 1 ? '<a class="bt" href="sobre.html">Leia mais</a>' : ""}</div>` : "",
    (i.valores || []).length || vt.length ? `<div><h3>Valores</h3>${resumo ? "" : ps(vt)}<div class="chp">${(i.valores || []).map(x => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""
  ].join("");
};

/* ---------- 6. CARD DE IMÓVEL (usado na home, listagem e "semelhantes") ---------- */
// Recebe um imóvel no formato do contrato e devolve o HTML do card.
// Para mudar o visual do card: edite este HTML e as classes .card/.ph/.cb em css/style.css.
const card = x => {
  const l = x.localizacao || {}, u = x.fotos && x.fotos[0] ? safe(x.fotos[0]) : "", href = "imovel.html?id=" + encodeURIComponent(x.id), al = x.aquisicao === "aluguel";
  return `<article class="card"><a class="ph" href="${href}">${u ? `<img src="${u}" alt="" loading="lazy">` : HOUSE}<span class="ref">Ref.: ${esc(x.id)}</span><span class="tag">${al ? "Aluguel" : "Venda"}</span></a><div class="cb"><h3>${esc(cap(x.tipo))}</h3><p class="lc">${esc([l.bairro, l.cidade].filter(Boolean).join(" - "))}</p><p class="pr">${brl(x.valor)}${al && x.valor ? "<small> /mês</small>" : ""}</p>${x.corretor ? `<p class="co">Corretor: ${esc(x.corretor.nome)}</p>` : ""}<a class="bt" href="${href}">Ver detalhes</a></div></article>`;
};

/* ---------- 7. "ÚLTIMAS PESQUISAS" (chips abaixo da busca da home) ---------- */
// Guarda até 3 pesquisas no navegador do visitante (localStorage "ap_buscas").
// Não envolve o servidor.
function buscas() {
  let b = []; try { b = JSON.parse(localStorage.getItem("ap_buscas") || "[]"); } catch (e) {}
  $("#ult").innerHTML = b.length ? "<span>Últimas pesquisas</span>" + b.map(x => `<a href="imoveis.html?${esc(x.q)}">${esc(x.t)}<small>${esc(x.s)}</small></a>`).join("") : "";
  return b;
}

/* ---------- 8. PÁGINA INICIAL (index.html) ---------- */
// i = dados da empresa, cor = corretores, imv = imóveis. Preenche cada bloco da home.
function home(i, cor, imv) {
  const ig = esc(String(i.instagram).replace("@", ""));
  // Fundo do banner personalizado: o dono escolhe a imagem no painel (Dados da empresa -> "Fundo do banner").
  // bannerFundo = endereço da imagem; bannerEscuro = 0 a 85 (% de escurecimento para o texto continuar legível).
  // Só o FUNDO muda: título, botões e busca continuam iguais. Sem imagem, vale o fundo padrão do CSS.
  if (cssUrl(i.bannerFundo)) { const h = $(".hero"); h.style.setProperty("--hero-img", cssUrl(i.bannerFundo)); h.style.setProperty("--hero-escuro", (i.bannerEscuro ?? 55) / 100); h.classList.add("foto"); }
  // Botões de contato sobre o banner.
  $("#pills").innerHTML = `<a href="https://instagram.com/${ig}" target="_blank" rel="noopener">${esc(i.instagram)}</a><a href="${wa(i.whatsapp)}" target="_blank" rel="noopener">${fmt(i.whatsapp)}</a>`;
  // Lista "Cidade e bairros" da busca: montada a partir dos imóveis existentes.
  const locs = [...new Set(imv.map(x => x.localizacao && x.localizacao.cidade ? x.localizacao.cidade + "|" + (x.localizacao.bairro || "") : "").filter(Boolean))];
  $("#fLoc").innerHTML = '<option value="">Selecione</option>' + locs.map(l => { const [c, b] = l.split("|"); return `<option value="${esc(l)}">${esc(c)}${b ? " - " + esc(b) : ""}</option>`; }).join("");
  $("#refBtn").onclick = () => $("#refBox").toggleAttribute("hidden");   // mostra/esconde o campo "Referência"
  buscas();
  // Ao pesquisar: monta a query string (?aquisicao=..&tipo=..) e abre imoveis.html,
  // que lê esses mesmos parâmetros. Nomes dos parâmetros: aquisicao, tipo, valorMin,
  // valorMax, cidade, bairro, ref.
  $("#busca").onsubmit = e => {
    e.preventDefault(); const f = e.target, q = new URLSearchParams(), p = (k, v) => v && q.set(k, v), [c, b] = (f.loc.value || "|").split("|");
    p("aquisicao", f.aq.value); p("tipo", f.tp.value); p("valorMin", dig(f.vmin.value)); p("valorMax", dig(f.vmax.value)); p("cidade", c); p("bairro", b); p("ref", f.ref.value.trim());
    const t = (f.aq.value === "aluguel" ? "Alugar" : f.aq.value === "compra" ? "Comprar" : "Todos") + (c ? " | " + c : ""), s = f.vmax.value ? "Até " + brl(dig(f.vmax.value)) : "Preço não definido";
    try { const b0 = buscas().filter(x => x.q !== q.toString()); b0.unshift({ t, s, q: q.toString() }); localStorage.setItem("ap_buscas", JSON.stringify(b0.slice(0, 3))); } catch (er) {}
    location.href = "imoveis.html?" + q;
  };
  // Destaques: os 6 primeiros imóveis que a API devolver.
  $("#dest").innerHTML = imv.slice(0, 6).map(card).join("") || "<p>Nenhum imóvel cadastrado ainda.</p>";
  // "Quem somos": missão, visão e valores (vêm dos Dados globais).
  $("#sobre").innerHTML = tri(i, true);
  // Faixa escura "Terreno + construção" (usa o WhatsApp próprio, se existir).
  const t = i.terrenoConstrucao || {};
  $("#terr").innerHTML = `<h2>Terreno + construção</h2><p>${esc(t.texto)}</p><a class="go" href="${wa(t.whatsapp || i.whatsapp, "Olá! Tenho um terreno e quero conversar sobre construção.")}" target="_blank" rel="noopener">Falar com a gente</a>`;
  // Corretores (foto ou inicial do nome, CRECI e botão de WhatsApp).
  $("#cors").innerHTML = cor.map(c => `<article class="card cor"><div class="av">${c.foto ? `<img src="${safe(c.foto)}" alt="">` : esc((c.nome || "?")[0])}</div><h3>${esc(c.nome)}</h3><small>CRECI ${esc(c.creci)}</small><a class="bt" href="${wa(c.whatsapp, "Olá, " + c.nome + "! Vim pelo site.")}" target="_blank" rel="noopener">WhatsApp</a></article>`).join("");
}

/* ---------- 9. INICIALIZAÇÃO (roda quando a página abre) ---------- */
(async () => {
  // A home precisa de empresa + corretores + imóveis; as outras páginas pedem
  // só a empresa aqui e buscam o resto sozinhas, quando precisam.
  const h = document.body.classList.contains("home");
  const [i, cor, imv] = await Promise.all([api.inst(), h ? api.cor() : [], h ? api.imv() : []]);
  layout(i);                                                    // desenha topo e rodapé
  // window.AP = "caixa de ferramentas" compartilhada com os outros scripts
  // (imoveis.js, imovel.js, paginas.js, chat.js). "inst" são os dados da empresa.
  window.AP = { esc, brl, cap, dig, wa, fmt, safe, list, api, card, tri, mapa, HOUSE, C, M, inst: i };
  // Carrega o chatbot (chat.js) em todas as páginas públicas.
  document.head.append(Object.assign(document.createElement("script"), { src: "js/chat.js" }));
  // Home: roda aqui. Demais páginas: chamam a função window.onAP que o próprio
  // script da página definiu (ver imoveis.js, imovel.js, paginas.js).
  if (h) home(i, list(cor), list(imv)); else if (window.onAP) window.onAP(i);
})().catch(() => document.body.insertAdjacentHTML("afterbegin", '<p class="err">Não foi possível carregar os dados agora.</p>'));
})();

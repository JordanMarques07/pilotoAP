/* =====================================================================
   chat.js — ASSISTENTE VIRTUAL (CHATBOT DE REGRAS)
   =====================================================================
   Carregado pelo app.js em todas as páginas públicas (não no painel).
   Cria o botão do chat e a janela de conversa, e decide as respostas.

   DOIS MODOS (definidos por API_URL em config.js):
     - API_URL vazio  -> as regras rodam AQUI, no navegador (função "motor").
     - API_URL cheio  -> cada mensagem vai para POST {API_URL}/chat e a janela
                         só mostra o que o servidor responder.
   A função "motor" é o MODELO das regras: o servidor Java pode reproduzi-la.

   FLUXO DAS REGRAS (máquina de estados; S.passo guarda a etapa atual):

     "inicio" -> pergunta o negócio ......... passo "aq"
        Comprar / Alugar ........ -> tipo (casa, apartamento, terreno, qualquer) .... "tp"
                                  -> região (bairros dos imóveis existentes) ........ "loc"
                                  -> valor máximo (faixas de aluguel ou de compra) .. "vl"
                                  -> mostra até 3 imóveis + botões ................... "fim"
        Terreno + construção .... -> pergunta onde fica o terreno ................... "tc"
                                  -> oferece WhatsApp / ver terrenos / refinar ....... "fim"
     "Refinar busca", "Recomeçar" ou "Voltar ao início" voltam para "aq" em qualquer etapa.

   CONTRATO COM O SERVIDOR (resposta de POST /chat):
     { resposta: "texto", opcoes: ["botão 1", ...], imoveis: [até 3], filtros: {...} }
     "imoveis" e "filtros" só vêm quando há resultado. Ver LEIA-ME.md, seção 4.3.
   ===================================================================== */
(() => {

/* ---------- 1. FERRAMENTAS E ESTADO ---------- */
// A = caixa de ferramentas do app.js (window.AP). Já existe quando este arquivo roda.
// inst = dados da empresa. DEMO = true quando não há API (usa as regras locais).
const A = window.AP, { esc, brl, cap, wa, C, inst } = A, DEMO = !C.API_URL, $ = s => document.querySelector(s);
// sid = identificador desta conversa; o servidor usa para lembrar em que etapa o cliente está.
const sid = Math.random().toString(36).slice(2);
// norm: deixa o texto em minúsculas e sem acentos, para comparar o que o cliente digitou
//       ("Até" = "ate", "Início" = "inicio").
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
// filtros = últimos filtros usados na busca (alimenta "Ver todos os resultados" e o WhatsApp).
// iniciado = true depois que a conversa começou (a saudação só é enviada uma vez).
let filtros = null, iniciado = false;

/* ---------- 2. HTML DA JANELA (botão flutuante + painel de conversa) ---------- */
// Estilos: bloco "chatbot" no fim de css/style.css (.cbtn, .cbox, .cmsg, .copt, .cin, .mg, .cmi).
document.body.insertAdjacentHTML("beforeend", `<button class="cbtn" id="cbtn" type="button" aria-label="Abrir assistente virtual"><svg viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H9l-5 4v-4a2 2 0 01-2-2V5a2 2 0 012-2zm3 6v2h10V9H7zm0 4v2h7v-2H7z"/></svg></button>
<section class="cbox" id="cbox" hidden aria-label="Assistente virtual"><header><div><b>Assistente virtual</b><small>${esc(inst.nome)}</small></div><button id="cfx" type="button" aria-label="Fechar">×</button></header><div class="cmsg" id="cmsg"></div><div class="copt" id="copt"></div><form class="cin" id="cin"><input id="ctx" placeholder="Digite ou escolha uma opção" autocomplete="off"><button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></form></section>`);

/* ---------- 3. DESENHO DAS MENSAGENS ---------- */
// rolar: leva a conversa para a última mensagem.
const rolar = () => { const m = $("#cmsg"); m.scrollTop = m.scrollHeight; };
// bolha: adiciona uma mensagem. q = "u" (cliente) ou "b" (assistente). Usa textContent,
//        então o texto nunca vira HTML (seguro mesmo vindo do servidor).
const bolha = (t, q) => { const d = document.createElement("div"); d.className = "mg " + q; d.textContent = t; $("#cmsg").append(d); rolar(); return d; };
// cards: mostra os imóveis encontrados como mini-cartões clicáveis (abrem imovel.html?id=).
const cards = L => {
  const w = document.createElement("div"); w.className = "cls";
  w.innerHTML = L.map(x => { const l = x.localizacao || {}, al = x.aquisicao === "aluguel"; return `<a class="cmi" href="imovel.html?id=${encodeURIComponent(x.id)}"><b>${esc(cap(x.tipo))} · ${al ? "Aluguel" : "Venda"}</b><span>${esc([l.bairro, l.cidade].filter(Boolean).join(" - "))}</span><em>${brl(x.valor)}${al && x.valor ? " /mês" : ""}</em></a>`; }).join("");
  $("#cmsg").append(w); rolar();
};
// opcoes: desenha os botões de resposta rápida. Clicar envia o texto do botão como mensagem.
const opcoes = L => { const o = $("#copt"); o.innerHTML = (L || []).map(t => `<button type="button">${esc(t)}</button>`).join(""); o.querySelectorAll("button").forEach(b => b.onclick = () => enviar(b.textContent)); };
// responder: mostra uma resposta completa { resposta, imoveis, filtros, opcoes }.
//            É o ÚNICO ponto que consome o formato de resposta (local ou do servidor).
const responder = r => { if (r.resposta) bolha(r.resposta, "b"); if (r.imoveis && r.imoveis.length) cards(r.imoveis); if (r.filtros) filtros = r.filtros; opcoes(r.opcoes); rolar(); };
// urlFiltros: transforma os filtros em um link da listagem (imoveis.html?aquisicao=..&tipo=..).
const urlFiltros = f => { const q = new URLSearchParams(); if (f) ["aquisicao", "tipo", "cidade", "bairro", "valorMax"].forEach(k => f[k] && q.set(k, f[k])); return "imoveis.html" + (q.toString() ? "?" + q : ""); };
// resumo: mensagem pronta para o WhatsApp, descrevendo o que o cliente procurava no chat.
const resumo = () => { const f = filtros || {}; return "Olá! Usei o assistente do site" + (f.aquisicao ? ` e procuro ${f.tipo || "imóvel"} para ${f.aquisicao === "aluguel" ? "alugar" : "comprar"}${f.bairro ? " em " + f.bairro : f.cidade ? " em " + f.cidade : ""}${f.valorMax ? " até " + brl(f.valorMax) : ""}` : "") + ". Pode me ajudar?"; };

/* ---------- 4. REGRAS LOCAIS (MODO DEMONSTRAÇÃO) ---------- */
// S = estado da conversa: passo atual e as escolhas feitas até agora.
const S = { passo: "aq", aq: "", tp: "", cidade: "", bairro: "", vmax: 0 };
// OPS = botões fixos das duas primeiras perguntas. Para adicionar um tipo de imóvel
//       novo, inclua em OPS.tp (e no cadastro do painel/API).
const OPS = { aq: ["Comprar", "Alugar", "Terreno + construção"], tp: ["Casa", "Apartamento", "Terreno", "Qualquer tipo"] };
// VAL = faixas de valor máximo: [texto do botão, valor em reais]. 0 = sem limite.
//       Aluguel e compra têm faixas diferentes. Para mudar as faixas, edite aqui.
const VAL = { aluguel: [["Até R$ 1.500", 1500], ["Até R$ 3.000", 3000], ["Até R$ 5.000", 5000], ["Qualquer valor", 0]], compra: [["Até R$ 200 mil", 200000], ["Até R$ 500 mil", 500000], ["Até R$ 1 milhão", 1000000], ["Qualquer valor", 0]] };
// todos = lista de imóveis (carregada na 1ª pergunta). LOCS = regiões disponíveis.
// tcLocal = onde fica o terreno, digitado no fluxo "Terreno + construção".
let todos = null, LOCS = {}, tcLocal = "";
// pick: acha qual botão o cliente quis, comparando sem acentos. Aceita o botão exato
//       ("Casa") ou uma frase que o contenha ("quero uma casa").
const pick = (ops, t) => { const n = norm(t); return ops.find(o => norm(o) === n) || ops.find(o => n.includes(norm(o))); };
// nao: resposta padrão quando o texto digitado não bate com nenhuma opção.
const nao = ops => ({ resposta: "Não entendi. Escolha uma das opções, por favor.", opcoes: ops });

// motor(txt): recebe o que o cliente escreveu e devolve a próxima resposta, conforme S.passo.
const motor = async txt => {
  todos = todos || A.list(await A.api.imv());           // carrega os imóveis uma única vez
  const n = norm(txt);
  // Reinício: "inicio" (saudação), "recomeçar", "refinar busca" e "voltar" zeram tudo.
  if (n === "inicio" || /recome|refinar|voltar/.test(n)) { tcLocal = ""; Object.assign(S, { passo: "aq", aq: "", tp: "", cidade: "", bairro: "", vmax: 0 }); return { resposta: n === "inicio" ? `Olá! Sou o assistente virtual da ${inst.nome}. Vou te ajudar a encontrar o imóvel ideal. O que você procura?` : "Vamos refazer a busca. O que você procura?", opcoes: OPS.aq }; }
  // Etapa "aq": comprar, alugar ou terreno + construção (aceita também palavras soltas).
  if (S.passo === "aq") {
    const o = pick(OPS.aq, txt) || (/constru/.test(n) ? "Terreno + construção" : /alug/.test(n) ? "Alugar" : /compr|vend/.test(n) ? "Comprar" : ""); if (!o) return nao(OPS.aq);
    // Caminho do terreno: mostra o texto cadastrado em "Dados da empresa" e pergunta o local.
    if (o === "Terreno + construção") { S.passo = "tc"; const t = (inst.terrenoConstrucao || {}).texto; return { resposta: `${t || "Podemos ajudar com projeto e construção no seu terreno."}\n\nOnde fica o seu terreno? Digite a cidade ou o bairro.`, opcoes: ["Ainda não tenho terreno", "Voltar ao início"] }; }
    S.aq = o === "Alugar" ? "aluguel" : "compra"; S.passo = "tp"; return { resposta: "Qual tipo de imóvel você quer?", opcoes: OPS.tp };
  }
  // Etapa "tc": guarda o local digitado e oferece os próximos passos.
  if (S.passo === "tc") {
    tcLocal = /ainda nao/.test(n) ? "" : txt.trim(); S.passo = "fim";
    return { resposta: tcLocal ? `Anotado: terreno em ${tcLocal}. Nossa equipe pode conversar sobre projeto, prazos e valores. Quer falar agora pelo WhatsApp?` : "Sem problema! Também podemos te ajudar a encontrar um terreno. Quer falar com a nossa equipe pelo WhatsApp?", opcoes: ["Falar sobre terreno + construção", "Ver terrenos à venda", "Refinar busca"] };
  }
  // Etapa "tp": tipo do imóvel. Em seguida monta a lista de regiões que realmente têm
  // imóveis desse negócio/tipo (assim o cliente nunca escolhe uma região vazia).
  if (S.passo === "tp") {
    const o = pick(OPS.tp, txt); if (!o) return nao(OPS.tp);
    S.tp = o === "Qualquer tipo" ? "" : o.toLowerCase(); S.passo = "loc"; LOCS = {};
    todos.filter(x => x.aquisicao === S.aq && (!S.tp || x.tipo === S.tp)).forEach(x => { const l = x.localizacao || {}; if (l.cidade) LOCS[[l.bairro, l.cidade].filter(Boolean).join(" - ")] = l; });
    return { resposta: "Em qual região?", opcoes: [...Object.keys(LOCS).slice(0, 5), "Qualquer lugar"] };   // no máximo 5 regiões + "Qualquer lugar"
  }
  // Etapa "loc": região escolhida (ou qualquer lugar).
  if (S.passo === "loc") {
    const ops = [...Object.keys(LOCS).slice(0, 5), "Qualquer lugar"], o = pick(ops, txt); if (!o) return nao(ops);
    const l = LOCS[o] || {}; S.cidade = l.cidade || ""; S.bairro = l.bairro || ""; S.passo = "vl";
    return { resposta: "Qual o valor máximo?", opcoes: VAL[S.aq].map(v => v[0]) };
  }
  // Etapa "vl": valor máximo. Aqui acontece a BUSCA: filtra os imóveis pelas escolhas.
  if (S.passo === "vl") {
    const ops = VAL[S.aq].map(v => v[0]), o = pick(ops, txt); if (!o) return nao(ops);
    S.vmax = VAL[S.aq].find(v => v[0] === o)[1]; S.passo = "fim";
    // f = filtros no mesmo formato da URL da listagem (usado por "Ver todos os resultados").
    const f = { aquisicao: S.aq, tipo: S.tp, cidade: S.cidade, bairro: S.bairro, valorMax: S.vmax || "" };
    // Regra do filtro: negócio igual; tipo/cidade/bairro só se foram escolhidos;
    // valor só se houver limite (imóvel "sob consulta", valor 0, fica de fora quando há limite).
    const r = todos.filter(x => { const l = x.localizacao || {}; return x.aquisicao === S.aq && (!S.tp || x.tipo === S.tp) && (!S.cidade || l.cidade === S.cidade) && (!S.bairro || l.bairro === S.bairro) && (!S.vmax || (x.valor && x.valor <= S.vmax)); });
    // Com resultado: mostra até 3 imóveis. Sem resultado: oferece refazer ou chamar um corretor.
    return r.length ? { resposta: `Encontrei ${r.length} ${r.length > 1 ? "imóveis" : "imóvel"} para você. ${r.length > 3 ? "Veja os 3 primeiros:" : "Veja abaixo:"}`, imoveis: r.slice(0, 3), filtros: f, opcoes: ["Ver todos os resultados", "Refinar busca", "Falar com um corretor"] }
      : { resposta: "Não encontrei imóveis com esse perfil agora. Posso refazer a busca ou chamar um corretor.", filtros: f, opcoes: ["Refinar busca", "Falar com um corretor"] };
  }
  // Etapa "fim" (ou qualquer texto fora de contexto): oferece recomeçar ou falar com alguém.
  return { resposta: "Posso refazer a busca ou chamar um corretor para você.", opcoes: ["Refinar busca", "Falar com um corretor"] };
};

/* ---------- 5. ENVIO DE MENSAGENS (AQUI ENTRA O SERVIDOR) ---------- */
// falar(txt): obtém a resposta para uma mensagem.
//   - Com API: POST {API_URL}/chat { sessaoId, mensagem } e devolve o JSON do servidor.
//   - Sem API: espera 450 ms (efeito de "digitando") e usa o "motor" local.
const falar = async txt => {
  if (!DEMO) { const r = await fetch(C.API_URL + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessaoId: sid, mensagem: txt }) }); if (!r.ok) throw 0; return r.json(); }
  await new Promise(ok => setTimeout(ok, 450)); return motor(txt);
};
// enviar(txt): chamado ao clicar num botão ou enviar o formulário de texto.
async function enviar(txt) {
  txt = String(txt).trim(); if (!txt) return;
  bolha(txt, "u"); opcoes([]);          // mostra a fala do cliente e remove os botões antigos
  // Botões tratados PELA PÁGINA (não vão ao servidor): abrem WhatsApp ou a listagem.
  // O servidor só precisa incluir estes textos em "opcoes" quando quiser oferecê-los.
  if (txt === "Falar com um corretor") { window.open(wa(inst.whatsapp, resumo()), "_blank", "noopener"); return responder({ resposta: "Abri o WhatsApp para você. Posso ajudar em mais alguma coisa?", opcoes: ["Refinar busca"] }); }
  if (txt === "Ver todos os resultados") { location.href = urlFiltros(filtros); return; }
  if (txt === "Ver terrenos à venda") { location.href = urlFiltros({ aquisicao: "compra", tipo: "terreno" }); return; }
  if (txt === "Falar sobre terreno + construção") { const t = inst.terrenoConstrucao || {}; window.open(wa(t.whatsapp || inst.whatsapp, "Olá! Usei o assistente do site. Tenho um terreno" + (tcLocal ? " em " + tcLocal : "") + " e quero conversar sobre construção."), "_blank", "noopener"); return responder({ resposta: "Abri o WhatsApp para você. Posso ajudar em mais alguma coisa?", opcoes: ["Refinar busca"] }); }
  // Qualquer outra mensagem: mostra "digitando...", obtém a resposta e exibe.
  // Se a API falhar, o cliente recebe um aviso e a opção de falar por WhatsApp.
  const t = bolha("digitando...", "b typing");
  try { const r = await falar(txt); t.remove(); responder(r); }
  catch (e) { t.remove(); responder({ resposta: "Não consegui responder agora. Você pode falar direto com a gente pelo WhatsApp.", opcoes: ["Falar com um corretor"] }); }
}

/* ---------- 6. ABRIR/FECHAR A JANELA ---------- */
// abrir: alterna a janela. Na primeira abertura envia a mensagem "inicio" (saudação e
//        primeira pergunta). Também remove o balão de boas-vindas do WhatsApp.
async function abrir() {
  const b = $("#cbox"); b.hidden = !b.hidden; const el = $("#bub"); if (el) el.remove();
  if (b.hidden) return; $("#ctx").focus();
  if (!iniciado) { iniciado = true; const t = bolha("digitando...", "b typing"); try { const r = await falar("inicio"); t.remove(); responder(r); } catch (e) { t.remove(); responder({ resposta: "Olá! O assistente está indisponível agora, mas você pode falar com a gente pelo WhatsApp.", opcoes: ["Falar com um corretor"] }); } }
}
$("#cbtn").onclick = abrir;                                   // botão flutuante
$("#cfx").onclick = () => { $("#cbox").hidden = true; };      // botão × da janela
$("#cin").onsubmit = e => { e.preventDefault(); const v = $("#ctx").value; $("#ctx").value = ""; enviar(v); };   // texto digitado
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#cbox").hidden = true; });             // Esc fecha
})();

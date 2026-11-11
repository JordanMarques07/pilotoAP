/* =====================================================================
   imoveis.js — PÁGINA DE LISTAGEM (imoveis.html)
   =====================================================================
   Mostra os imóveis com filtros e ordenação. Os filtros chegam pela URL
   (ex.: imoveis.html?aquisicao=aluguel&tipo=casa&valorMax=3000) e também
   podem ser mudados no formulário da própria página.

   Parâmetros aceitos na URL:
     aquisicao (compra|aluguel)  tipo (casa|terreno|apartamento)
     valorMin, valorMax (números)  cidade, bairro  ref (código/id do imóvel)

   COMO RODA: o app.js desenha topo e rodapé e depois chama window.onAP
   (definida abaixo). A lista inteira de imóveis é pedida UMA vez e os filtros
   são aplicados AQUI, no navegador.
   ATENÇÃO (back end): se a API devolver só uma página de resultados, a lista
   chega incompleta. Soluções: a API devolve todos os imóveis, ou os filtros
   passam a ser feitos no servidor (ver LEIA-ME.md, seção 4.1) e a função
   "filtrar" abaixo deixa de ser necessária.
   ===================================================================== */
window.onAP = async () => {
  // Ferramentas do app.js: card() desenha um imóvel; list() normaliza a resposta; api busca dados; esc protege o HTML.
  // PER = quantos cards aparecem por vez (o botão "Ver mais" mostra mais PER).
  const { card, list, api, esc } = window.AP, $ = s => document.querySelector(s), PER = 9, dg = s => String(s).replace(/\D/g, "");
  // Q = filtros atuais (lidos da URL); shown = quantos cards estão visíveis agora.
  let Q = new URLSearchParams(location.search), shown = PER;
  // all = todos os imóveis; f = o formulário de filtros (campos acessados por name: ref, aq, tp, vmin, vmax, loc).
  const all = list(await api.imv()), f = $("#flt");

  // Lista "Cidade e bairros" do formulário: montada com as regiões dos imóveis existentes
  // (cada opção tem o valor "cidade|bairro").
  const locs = [...new Set(all.map(x => x.localizacao && x.localizacao.cidade ? x.localizacao.cidade + "|" + (x.localizacao.bairro || "") : "").filter(Boolean))];
  f.loc.innerHTML = '<option value="">Selecione</option>' + locs.map(l => { const [c, b] = l.split("|"); return `<option value="${esc(l)}">${esc(c)}${b ? " - " + esc(b) : ""}</option>`; }).join("");

  // preencher: copia os filtros da URL para os campos do formulário (para o cliente ver o que está ativo).
  const preencher = () => {
    f.ref.value = Q.get("ref") || ""; f.aq.value = Q.get("aquisicao") || ""; f.tp.value = Q.get("tipo") || "";
    f.vmin.value = Q.get("valorMin") || ""; f.vmax.value = Q.get("valorMax") || "";
    f.loc.value = Q.get("cidade") ? Q.get("cidade") + "|" + (Q.get("bairro") || "") : "";
  };

  // filtrar: aplica os filtros em Q sobre "all" e devolve a lista já ordenada.
  // Regra: cada filtro só vale se foi preenchido (vazio = não filtra).
  const filtrar = () => {
    const g = n => Q.get(n) || "", aq = g("aquisicao"), tp = g("tipo"), vmin = +g("valorMin") || 0, vmax = +g("valorMax") || 0, cd = g("cidade"), bb = g("bairro"), rf = g("ref").toLowerCase();
    const r = all.filter(x => { const l = x.localizacao || {}; return (!aq || x.aquisicao === aq) && (!tp || x.tipo === tp) && (!vmin || x.valor >= vmin) && (!vmax || x.valor <= vmax) && (!cd || l.cidade === cd) && (!bb || l.bairro === bb) && (!rf || String(x.id).toLowerCase().includes(rf)); });
    // Ordenação: "min" = menor valor primeiro (sem valor vai para o fim); "max" = maior valor primeiro.
    const o = $("#ord").value;
    if (o === "min") r.sort((a, b) => (a.valor || 1e12) - (b.valor || 1e12));
    if (o === "max") r.sort((a, b) => (b.valor || 0) - (a.valor || 0));
    return r;
  };

  // draw: atualiza a contagem, mostra os primeiros "shown" cards e esconde o botão "Ver mais" quando acabam.
  const draw = () => {
    const r = filtrar();
    $("#cnt").textContent = r.length + (r.length === 1 ? " imóvel encontrado" : " imóveis encontrados");
    $("#res").innerHTML = r.slice(0, shown).map(card).join("") || '<p class="vz">Nenhum imóvel encontrado com esses filtros.</p>';
    $("#mais").hidden = r.length <= shown;
  };

  // Ao pesquisar: lê o formulário, monta os parâmetros, atualiza o endereço da página
  // (sem recarregar, assim o link pode ser copiado e compartilhado) e redesenha.
  f.onsubmit = e => {
    e.preventDefault();
    const q = new URLSearchParams(), p = (k, v) => v && q.set(k, v), [c, b] = (f.loc.value || "|").split("|");
    p("aquisicao", f.aq.value); p("tipo", f.tp.value); p("valorMin", dg(f.vmin.value)); p("valorMax", dg(f.vmax.value)); p("cidade", c); p("bairro", b); p("ref", f.ref.value.trim());
    Q = q; shown = PER;
    try { history.replaceState(null, "", q.toString() ? "?" + q : location.pathname); } catch (er) {}
    draw();
  };
  $("#lmp").onclick = () => { f.reset(); f.onsubmit(new Event("submit")); };   // "Limpar filtros"
  $("#ord").onchange = () => { shown = PER; draw(); };                          // mudar a ordenação
  $("#mais").onclick = () => { shown += PER; draw(); };                         // "Ver mais imóveis"

  preencher(); draw();   // primeira exibição: preenche o formulário com a URL e desenha a lista
};

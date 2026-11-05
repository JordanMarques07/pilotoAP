/* =====================================================================
   imovel.js — PÁGINA DE DETALHE DE UM IMÓVEL (imovel.html?id=...)
   =====================================================================
   Lê o id da URL, busca o imóvel e monta: título, galeria de fotos (com tela
   cheia), resumo de valor, ficha técnica, descrição, cartão do corretor
   responsável com botão de WhatsApp e "imóveis semelhantes".

   COMO RODA: o app.js desenha topo/rodapé e chama window.onAP (abaixo),
   passando os dados da empresa (inst).

   DADOS USADOS (formato do contrato — ver mock.js e LEIA-ME.md):
     GET /imoveis/{id}  -> o imóvel   |  GET /corretores -> para achar CRECI/WhatsApp
     GET /imoveis       -> só para a seção "semelhantes"
   Campos opcionais (quartos, banheiros, vagas, areaM2, descricao) só aparecem se vierem.
   ===================================================================== */
window.onAP = async inst => {
  const { esc, brl, cap, wa, fmt, safe, list, api, card, HOUSE } = window.AP, $ = s => document.querySelector(s);
  // id = parâmetro ?id= da URL; box = área onde o detalhe é desenhado.
  const id = new URLSearchParams(location.search).get("id"), box = $("#det");
  // Busca o imóvel. Se não existir (ou a API der erro), mostra "Imóvel não encontrado".
  let x = null; try { x = await api.imovel(id); } catch (e) {}
  if (!x || !x.id) { box.innerHTML = '<div class="nf"><h2>Imóvel não encontrado</h2><p>Ele pode ter sido vendido, alugado ou removido.</p><a class="go" href="imoveis.html">Ver todos os imóveis</a></div>'; return; }

  // Valores derivados: l = localização; al = é aluguel?; fr = fotos com URL válida (a 1ª é a capa);
  // local = "Bairro - Cidade"; titulo = "Casa em Bairro". O título da aba do navegador também muda.
  const l = x.localizacao || {}, al = x.aquisicao === "aluguel", fr = (x.fotos || []).filter(u => safe(u));
  const local = [l.bairro, l.cidade].filter(Boolean).join(" - "), titulo = cap(x.tipo) + (l.bairro ? " em " + l.bairro : "");
  document.title = titulo + " | " + inst.nome;

  // Corretor responsável: o imóvel traz só { id, nome }; CRECI, foto e WhatsApp são buscados na
  // lista de corretores pelo id. Sem corretor, o botão usa o WhatsApp da empresa.
  const cors = list(await api.cor()), ci = x.corretor || {};
  const cr = Object.assign({}, cors.find(c => String(c.id) === String(ci.id)), ci);
  const fone = cr.whatsapp || inst.whatsapp, msg = `Olá! Tenho interesse no imóvel Ref. ${x.id} (${titulo}).`;

  // Galeria: 1 foto grande + 2 menores (sem foto, mostra o ícone da casa). Cada uma é um botão
  // que abre a tela cheia. Com mais de 3 fotos, a última miniatura mostra "Mais fotos".
  const img = (u, k) => `<button class="gi${k === 0 ? " big" : ""}" data-i="${k}">${u ? `<img src="${safe(u)}" alt="">` : HOUSE}`;
  const gal = `<div class="gal">${img(fr[0], 0)}<span class="tag">${al ? "Aluguel" : "Venda"}</span><span class="ref">Ref.: ${esc(x.id)}</span>${fr.length ? `<span class="cnt2">${fr.length} foto${fr.length > 1 ? "s" : ""}</span>` : ""}</button>${img(fr[1], 1)}</button>${img(fr[2], 2)}${fr.length > 3 ? '<span class="mf">Mais fotos</span>' : ""}</button></div>`;

  // Ficha do imóvel: lista de [rótulo, valor]; linhas sem valor são omitidas.
  // Para mostrar um campo novo, acrescente uma linha neste array.
  const rows = [["Referência", x.id], ["Negócio", al ? "Aluguel" : "Venda"], ["Tipo", cap(x.tipo)], ["Cidade", l.cidade], ["Bairro", l.bairro], ["Endereço", l.endereco], ["Quartos", x.quartos], ["Banheiros", x.banheiros], ["Vagas", x.vagas], ["Área", x.areaM2 ? x.areaM2 + " m²" : ""]]
    .filter(r => r[1] !== undefined && r[1] !== null && r[1] !== "");
  const preco = brl(x.valor) + (al && x.valor ? "<small> /mês</small>" : "");   // "/mês" só no aluguel
  const av = cr.foto ? `<img src="${safe(cr.foto)}" alt="">` : esc((cr.nome || "?")[0]);   // foto do corretor ou inicial
  const share = "https://wa.me/?text=" + encodeURIComponent(titulo + " - " + location.href);   // link "Compartilhar no WhatsApp"

  // Monta a página: cabeçalho + botões, galeria, resumo, ficha/descrição e cartão lateral do corretor.
  // (Estilos: bloco "Detalhe do imóvel" de css/style.css.)
  box.innerHTML = `<div class="dthead"><div><h1>${esc(titulo)}</h1><p>${esc(local)}</p></div><div class="acts"><a class="bn wa" href="${share}" target="_blank" rel="noopener">Compartilhar no WhatsApp</a><button class="bn im" type="button" id="prt">Imprimir</button></div></div>
  ${gal}
  <div class="sum"><div><small>${al ? "Aluguel" : "Venda"}</small><b class="pr">${preco}</b></div><div><small>Tipo</small><b>${esc(cap(x.tipo))}</b></div><div><small>Localização</small><b>${esc(local || "—")}</b></div></div>
  <div class="cols"><div><h2>Ficha do imóvel</h2><div class="fic">${rows.map(r => `<div><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join("")}</div>${x.descricao ? `<h2>Descrição</h2><p class="dsc">${esc(x.descricao).replace(/\n/g, "<br>")}</p>` : ""}</div>
  <aside class="side"><div class="sc"><small>${al ? "Aluguel" : "Venda"}</small><p class="pr">${preco}</p>${cr.nome ? `<div class="av">${av}</div><h3>${esc(cr.nome)}</h3>${cr.creci ? `<small>CRECI ${esc(cr.creci)}</small>` : ""}` : `<small>${fmt(inst.whatsapp)}</small>`}<a class="go wa" href="${wa(fone, msg)}" target="_blank" rel="noopener">Falar no WhatsApp</a></div></aside></div>`;

  $("#prt").onclick = () => window.print();   // botão "Imprimir"

  // Galeria em tela cheia (lightbox, definido em imovel.html): abre ao clicar numa foto;
  // setas do teclado e botões passam as fotos; Esc fecha. "cur" = foto atual.
  const lb = $("#lb"); let cur = 0;
  const show = n => { cur = (n + fr.length) % fr.length; lb.querySelector("img").src = fr[cur]; lb.hidden = false; };
  box.querySelectorAll(".gi").forEach(b => b.onclick = () => { if (fr.length) show(+b.dataset.i < fr.length ? +b.dataset.i : 0); });
  lb.querySelector(".x").onclick = () => lb.hidden = true;
  lb.querySelector(".pv").onclick = () => show(cur - 1);
  lb.querySelector(".nx").onclick = () => show(cur + 1);
  document.addEventListener("keydown", e => { if (lb.hidden) return; if (e.key === "Escape") lb.hidden = true; if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });

  // Imóveis semelhantes: até 3 com o mesmo tipo e o mesmo negócio (compra/aluguel), exceto este.
  // Se der erro ou não houver nenhum, a seção simplesmente não aparece.
  try {
    const rel = list(await api.imv()).filter(y => String(y.id) !== String(x.id) && y.tipo === x.tipo && y.aquisicao === x.aquisicao).slice(0, 3);
    if (rel.length) { $("#relg").innerHTML = rel.map(card).join(""); $("#rel").hidden = false; }
  } catch (e) {}
};

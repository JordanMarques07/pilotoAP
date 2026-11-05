/* =====================================================================
   paginas.js — PÁGINAS INSTITUCIONAIS: Sobre, Contato, Corretores e
   Terreno + construção
   =====================================================================
   Um único script para as quatro páginas. A página é escolhida pelo atributo
   <body data-p="..."> do HTML (sobre.html tem data-p="sobre", etc.).

   COMO RODA: o app.js desenha topo/rodapé e chama window.onAP (abaixo),
   passando os dados da empresa (i). Cada bloco "if (p === ...)" preenche
   o <div id="pg"> da página correspondente.

   COMO ADICIONAR UMA PÁGINA NOVA: copie sobre.html, mude o título e o data-p,
   e crie aqui um novo bloco if (p === "nome") { ... } (e um item no menu em app.js).

   OS FORMULÁRIOS NÃO USAM O SERVIDOR: montam uma mensagem e abrem o WhatsApp da
   empresa. Se o back end passar a receber contatos, troque a função "abrir" por um POST.
   ===================================================================== */
window.onAP = async i => {
  const { esc, wa, fmt, safe, list, api } = window.AP, p = document.body.dataset.p, $ = s => document.querySelector(s), box = $("#pg");
  const ig = esc(String(i.instagram).replace("@", ""));      // @usuario sem o "@" (para o link do Instagram)
  // abrir: abre o WhatsApp em outra aba com a mensagem pronta (num = número só com dígitos).
  const abrir = (num, txt) => window.open(wa(num, txt), "_blank", "noopener");

  // ---- SOBRE: dados da empresa + missão, visão e valores (vêm de "Dados da empresa" no painel) ----
  if (p === "sobre") {
    $("#sub").textContent = i.nome;
    box.innerHTML = `<div class="sum"><div><small>Empresa</small><b>${esc(i.nome)}</b></div><div><small>CNPJ</small><b>${esc(i.cnpj)}</b></div><div><small>Endereço</small><b>${window.AP.mapa(i.endereco)}</b></div></div>
    <div class="tri">${window.AP.tri(i, false)}</div>`;
  }

  // ---- CONTATO: cartões (WhatsApp, Instagram, endereço no Google Maps) + formulário que envia por WhatsApp ----
  if (p === "contato") {
    $("#sub").textContent = "Fale com a gente";
    box.innerHTML = `<div class="two"><div class="cts">
      <a class="ct" href="${wa(i.whatsapp)}" target="_blank" rel="noopener">WhatsApp<b>${fmt(i.whatsapp)}</b></a>
      <a class="ct" href="https://instagram.com/${ig}" target="_blank" rel="noopener">Instagram<b>${esc(i.instagram)}</b></a>
      <div class="ct">Endereço<b>${window.AP.mapa(i.endereco)}</b></div></div>
      <form class="fm" id="fm"><h2>Envie uma mensagem</h2><div><label for="n">Nome</label><input id="n" required></div><div><label for="m">Mensagem</label><textarea id="m" rows="5" required></textarea></div><button class="go" type="submit">Enviar pelo WhatsApp</button></form></div>`;
    $("#fm").onsubmit = e => { e.preventDefault(); abrir(i.whatsapp, `Olá! Meu nome é ${$("#n").value}. ${$("#m").value}`); };
  }

  // ---- CORRETORES: lista completa (GET /corretores) com foto ou inicial, CRECI e WhatsApp ----
  if (p === "corretores") {
    $("#sub").textContent = "Conheça quem vai te atender";
    const cs = list(await api.cor());
    box.innerHTML = `<div class="grid">${cs.map(c => `<article class="card cor"><div class="av">${c.foto ? `<img src="${safe(c.foto)}" alt="">` : esc((c.nome || "?")[0])}</div><h3>${esc(c.nome)}</h3><small>CRECI ${esc(c.creci)}</small><a class="bt" href="${wa(c.whatsapp, "Olá, " + c.nome + "! Vim pelo site.")}" target="_blank" rel="noopener">WhatsApp</a></article>`).join("") || "<p>Nenhum corretor cadastrado ainda.</p>"}</div>`;
  }

  // ---- TERRENO + CONSTRUÇÃO: texto da empresa + formulário (nome, local do terreno, mensagem) por WhatsApp ----
  // Usa o WhatsApp próprio de "Terreno + construção" (terrenoConstrucao.whatsapp) ou, se vazio, o da empresa.
  if (p === "terreno") {
    const t = i.terrenoConstrucao || {}, num = t.whatsapp || i.whatsapp;
    $("#sub").textContent = "Do terreno à sua casa";
    box.innerHTML = `<div class="two"><div><h2>Seu terreno, a sua casa</h2><p>${esc(t.texto)}</p><a class="go" style="display:inline-block" href="${wa(num, "Olá! Tenho um terreno e quero conversar sobre construção.")}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>
      <form class="fm" id="fm"><h2>Qual Terreno Ideal para Realizar seu Sonho</h2><div><label for="n">Nome</label><input id="n" required></div><div><label for="lo">Algum Endereço em Específico?</label><input id="lo" required></div><div><label for="m">Mensagem</label><textarea id="m" rows="4"></textarea></div><button class="go" type="submit">Enviar pelo WhatsApp</button></form></div>`;
    $("#fm").onsubmit = e => { e.preventDefault(); abrir(num, `Olá! Meu nome é ${$("#n").value}. Tenho interesse em um terreno em ${$("#lo").value} e quero conversar sobre construção. ${$("#m").value}`); };
  }

  // Título da aba do navegador = título da página + nome da empresa.
  document.title = ($("h1").textContent || "") + " | " + i.nome;
};

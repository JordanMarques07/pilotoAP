# Site André Pacheco Imóveis — guia do projeto

Site de imobiliária feito só com **HTML, CSS e JavaScript puro** (sem framework e sem build).
Tem site público, painel administrativo e chatbot. Hoje roda em **modo demonstração**
(dados de exemplo). Para ligar ao back end, basta preencher um endereço (seção 4).

## 1. Como abrir e testar
1. Abra a pasta no VS Code e instale a extensão **Live Server**.
2. Botão direito no `index.html` da raiz → **Open with Live Server** (use o Chrome).
3. Painel admin: acrescente `/admin/index.html` ao endereço. No modo demonstração o login é `admin` / `admin`.

> Abrir os arquivos direto do disco (`file:///`) não é recomendado: o navegador não compartilha
> os dados de demonstração entre o painel e o site, e bloqueia chamadas a APIs.

## 2. Estrutura de pastas
```
index.html            Página inicial (busca, destaques, quem somos, terreno + construção, corretores)
imoveis.html          Listagem com filtros (lê ?aquisicao=&tipo=&valorMin=&valorMax=&cidade=&bairro=&ref=)
imovel.html           Detalhe de um imóvel (lê ?id=)
sobre.html            Empresa, CNPJ, endereço, missão, visão, valores
contato.html          WhatsApp, Instagram, endereço, formulário (envia por WhatsApp)
corretores.html       Lista de corretores
terreno.html          Terreno + construção (texto + formulário por WhatsApp)
img/logo.png          Logo (branco, fundo transparente), usado no topo e no rodapé
img/imoveis/          Fotos dos imóveis (código do imóvel + número), referenciadas em js/mock.js
css/style.css         Todo o visual do site e do chatbot (cores no topo, em :root)
js/config.js          >>> API_URL: o único valor a mudar para ligar o back end <<<
js/i18n.js            Tradução da interface (PT padrão, EN e ES): dicionário e botões de idioma
js/mock.js            Dados REAIS da imobiliária no formato oficial (usados enquanto não há API)
js/app.js             Núcleo: busca dados globais, desenha topo/rodapé, camada "api", home
js/imoveis.js         Lógica da página de listagem (filtros e ordenação)
js/imovel.js          Lógica da página de detalhe (galeria, ficha, corretor, semelhantes)
js/paginas.js         Lógica de sobre, contato, corretores e terreno (escolhida por <body data-p="...">)
js/chat.js            Chatbot de regras (janela de conversa)
admin/index.html      Painel administrativo (login, imóveis, corretores, dados da empresa)
admin/admin.js        Lógica do painel
admin/admin.css       Visual do painel
```

## 3. Como uma página funciona (ordem de carregamento)
Todo HTML termina com os scripts nesta ordem:
`config.js` → `mock.js` → `i18n.js` → *(script da página, se houver)* → `app.js`.

1. O `app.js` busca os dados da empresa, desenha topo e rodapé e publica `window.AP`
   (caixa de ferramentas: `esc`, `brl`, `wa`, `api`, `card`, `list`, `inst`...).
2. Carrega o `chat.js`.
3. Se a página tem lógica própria, o script dela definiu `window.onAP`, e o `app.js` o chama no fim.
   A home é a exceção: roda dentro do próprio `app.js`.

**Adicionar uma página nova:** copie `sobre.html`, mude `data-p` e o título, e acrescente um bloco
`if (p === "nome")` em `js/paginas.js`. Para aparecer no menu, inclua uma linha no array `nav`
da função `layout` em `js/app.js`.

## 4. Ligando o back end (o que fazer)
1. Em `js/config.js`, troque `API_URL: ""` por `"/api"` (mesmo domínio, recomendado) ou
   `"https://seudominio.com.br/api"` (outro domínio: o servidor precisa liberar **CORS**).
2. Confira se a API devolve os campos exatamente como em `js/mock.js`.
3. Teste no navegador: aba **Network** (F12) mostra cada chamada e sua resposta.

Com `API_URL` preenchido o site **não lê mais** o `mock.js` nem os dados gravados pelo painel no navegador.

### 4.1 Endereços que o SITE PÚBLICO chama (somente leitura, sem login)
| Método | Caminho | Devolve |
|---|---|---|
| GET | `/institucional` | `{ nome, cnpj, instagram, whatsapp, endereco, missao?, visao, valores[], valoresTexto?, bannerFundo?, bannerEscuro?, terrenoConstrucao{texto, whatsapp} }` (`missao`, `valoresTexto`, `bannerFundo` (url da imagem de fundo do banner da home, enviada pelo painel via `/admin/upload`) e `bannerEscuro` (0 a 85) são opcionais; textos longos usam parágrafos separados por linha em branco) |
| GET | `/corretores` | `[ { id, nome, creci, whatsapp, foto } ]` |
| GET | `/imoveis` | lista de imóveis (formato abaixo) |
| GET | `/imoveis/{id}` | um imóvel |

Listas aceitas como array simples **ou** paginadas `{ "content": [...] }`.
**Atenção:** a busca/filtro da listagem roda no navegador sobre o que a API devolve. Se a API paginar,
a lista chega incompleta. Solução: devolver todos (ou um limite alto) ou implementar filtros no servidor
(`?aquisicao=&tipo=&cidade=&bairro=&valorMin=&valorMax=`) e ajustar `js/imoveis.js`.

**Formato do imóvel:**
```json
{ "id": 101, "aquisicao": "compra", "tipo": "casa", "valor": 530000,
  "localizacao": { "cidade": "Capivari", "bairro": "Jardim Exemplo", "endereco": "" },
  "fotos": ["https://.../1.jpg"], "corretor": { "id": 1, "nome": "Corretor Exemplo" },
  "quartos": 3, "banheiros": 2, "vagas": 2, "areaM2": 116, "descricao": "..." }
```
`aquisicao`: `"compra"` ou `"aluguel"`. `tipo`: `"casa"`, `"terreno"` ou `"apartamento"`.
`valor` 0 = "Sob consulta". `fotos[0]` é a capa. Os campos de `quartos` em diante são opcionais.

### 4.2 Endereços que o PAINEL chama (exigem login)
| Método | Caminho | Corpo / retorno |
|---|---|---|
| POST | `/admin/login` | `{ usuario, senha }` → `{ token }` |
| POST | `/admin/upload` | arquivo no campo `arquivo` (multipart) → `{ url }` |
| POST / PUT / DELETE | `/admin/imoveis` e `/admin/imoveis/{id}` | imóvel completo (JSON) |
| POST / PUT / DELETE | `/admin/corretores` e `/admin/corretores/{id}` | corretor (JSON) |
| PUT | `/admin/institucional` | dados da empresa (JSON) |

Todas, menos o login, enviam `Authorization: Bearer <token>`. Se a API responder **401**, o painel
volta para a tela de login. O painel lê imóveis, corretores e institucional pelos mesmos GET públicos.

### 4.3 Chatbot
`POST /chat` com `{ "sessaoId": "abc", "mensagem": "Alugar" }` → 
`{ "resposta": "...", "opcoes": ["..."], "imoveis": [até 3], "filtros": { aquisicao, tipo, cidade, bairro, valorMax } }`.
- A primeira mensagem de cada conversa é sempre `"inicio"`.
- O servidor guarda a etapa de cada conversa pelo `sessaoId`.
- `imoveis` e `filtros` só vêm quando há resultado.
- O front intercepta estes botões (o servidor só precisa incluí-los em `opcoes`):
  `Falar com um corretor`, `Ver todos os resultados`, `Ver terrenos à venda`, `Falar sobre terreno + construção`.
- As regras do modo demonstração estão em `js/chat.js` (função `motor`) e servem de modelo para o servidor.

## 5. Segurança (leitura obrigatória)
- Quem protege o cadastro é o **servidor**. O login do painel no front só guarda o token.
  A senha `admin` existe apenas no modo demonstração e some quando `API_URL` é preenchido.
- O servidor deve validar o token em **todas** as rotas `/admin/*` e validar/limitar os uploads.
- Use **HTTPS** no domínio. O token fica em `sessionStorage` (some ao fechar a aba).
- Todo texto vindo da API passa por `esc()` antes de entrar em `innerHTML`. Mantenha esse hábito.

## 6. Pendências antes de publicar
- Conferir os dados reais em `js/mock.js` (CNPJ, WhatsApp da empresa, bairro dos imóveis) e apagá-lo quando a API estiver ligada (as fotos de `img/imoveis/` passam a vir do upload).
- Colocar a foto do banner (`--hero-img` em `css/style.css`).
- Definir backup do banco, HTTPS e quem cuida da VPS.

/* =====================================================================
   config.js — ÚNICO ARQUIVO QUE PRECISA MUDAR PARA LIGAR O BACK END
   =====================================================================
   API_URL = endereço base da API do servidor (sem barra no final).

   Exemplos:
     API_URL: ""                              -> MODO DEMONSTRAÇÃO (usa js/mock.js)
     API_URL: "/api"                          -> API no mesmo domínio do site (recomendado,
                                                 evita problemas de CORS)
     API_URL: "https://seudominio.com.br/api" -> API em outro endereço (o servidor precisa
                                                 liberar CORS para o domínio do site)

   Todas as páginas (site público e painel admin) leem este valor.
   ===================================================================== */
window.CFG = { API_URL: "" };

# Zaion Araújo — portfólio interativo

Portfólio estático da ZAION Soluções Digitais, em Aracati–CE. A interface combina desenvolvimento, design e os quatro trabalhos já apresentados por Zaion. A estrutura de interação foi inspirada no [portfólio indicado como referência](https://lopsxzale.github.io/?lang=en), com implementação própria e os dados e imagens deste repositório.

**Site:** https://zaionluz.github.io/Portifolio/

## Recursos

- Temas claro e escuro, com transição circular onde o navegador oferece View Transitions e alternativa imediata para movimento reduzido.
- Português e inglês, preferências salvas e parâmetros `?lang=pt&focus=all`.
- Foco Geral, Desenvolvimento ou Design: reorganiza a leitura das seções, a navegação e os projetos.
- Cartão da marca com flip por clique/teclado, tilt ao ponteiro e animações de revelação, frases e tecnologias.
- Navegação ativa, progresso de rolagem e menu móvel com fechamento por Escape e retorno de foco.
- Paleta de navegação por Ctrl/Cmd+K ou `/`, com busca, setas e Enter.
- Projetos filtráveis com detalhes, contexto, status e imagem ampliável.
- Painel de repositórios públicos, gráfico, tabela e consultas locais no estilo SQL.
- Cópia do e-mail, preparação de mensagem no WhatsApp e resumo profissional imprimível em A4.
- Conteúdo HTML legível sem JavaScript, animações pausadas quando fora da tela e respeito à preferência de movimento reduzido.

Os trabalhos mantêm seus estágios: Helly Viagens é uma logo final, Maria Marta Andrade é um site publicado, Vértice Metal e Aurora Odontologia são demonstrações. As fichas não atribuem resultados comerciais ou vínculos não informados.

A interface usa a paleta roxa, violeta, rosa e carmesim da Zaion. Os projetos aparecem sem caixas ou molduras opacas; as cores próprias das logos e das páginas apresentadas são mantidas. O rodapé mostra somente **Zaion**, sem ponto e sem o complemento comercial.

## Abrir e editar

O site publicado usa os arquivos diretamente, sem etapa de build. Para editar no VS Code, use um servidor local, como Live Server, ou o servidor incluído:

```bash
npm run dev
```

Requer Node.js 22 ou posterior para o servidor e os testes. Abra http://127.0.0.1:4173/Portifolio/. Não é necessário instalar dependências para executar apenas esse servidor.

- `index.html`: estrutura, conteúdo inicial acessível sem JavaScript, links e resumo imprimível.
- `css/style.css`: cores, tipografia, componentes, efeitos, telas pequenas e impressão.
- `js/content.js`: identidade, contatos, quatro projetos, oito serviços e dicionários PT/EN.
- `js/app.js`: preferências, navegação, diálogos, paleta, filtros, formulário, relógio e impressão.
- `js/motion.js`: revelações, contadores, spotlight, tilt e pausa das animações.
- `js/github-dashboard.js`: leitura pública do GitHub, estados, cache e filtros.
- `js/github-snapshot.js`: snapshot factual de metadados usado como alternativa offline.
- `assets/`: logos, imagens dos trabalhos, foto pessoal, favicon e imagem social. `zaion-portrait.png` é a mesma foto fornecida por Zaion, recuperada do seu avatar público original sem retoque. `marta-andrade-site.webp` é uma captura real do site publicado em 14/11/2026. A Helly usa o PNG original com transparência; a versão WebP antiga com fundo opaco não é exibida.

Ao alterar contatos, projetos ou serviços, atualize os dados em `content.js` e os respectivos links/cartões e textos iniciais de `index.html`, para manter a versão sem JavaScript consistente. Os nomes dos projetos são fixos; as descrições, estados e serviços têm valores `pt` e `en`. Troque imagens por arquivos próprios e ajuste os atributos `alt`.

A formação informada é estudante de Ciência da Computação. O resumo imprimível usa apenas os conhecimentos, serviços e contatos fornecidos. Para incluir instituição, datas, experiência ou um currículo próprio, acrescente somente informações confirmadas.

## Contato e privacidade

O formulário valida nome, tipo de serviço e descrição e abre **uma única navegação** para o WhatsApp com a mensagem preparada. O visitante revisa e envia a mensagem no WhatsApp. O site não envia mensagens automaticamente, não possui backend de e-mail e não armazena o conteúdo do formulário.

Tema, idioma, foco e preferência de movimento usam armazenamento local. A introdução e o cache do GitHub usam a sessão. Falhas de armazenamento não impedem a navegação. As fontes Geist e Geist Mono vêm do Google Fonts, com fontes do sistema como alternativa; os demais scripts são locais.

## Dados do GitHub

A API pública pode limitar requisições anônimas ou ficar indisponível. O painel distingue leitura ao vivo, cache de sessão e snapshot verificado; uma falha não é apresentada como sucesso. O cache expira em 15 minutos e há atualização manual.

O snapshot inicial foi conferido em 14/11/2026. Ele contém os metadados conhecidos dos três repositórios públicos, sem inventar bytes de linguagens. Nesse modo o gráfico mostra **quantidade de repositórios por linguagem principal**. A distribuição por **bytes de código** só é apresentada após respostas reais de todos os endpoints de linguagens.

O editor de consultas filtra esses metadados no navegador. Não executa SQL em servidor nem código arbitrário. Aceita seleção de colunas conhecidas, condições simples de linguagem/estrelas, ordenação e limite. Consultas inválidas exibem erro e preservam a última seleção válida.

## Verificar

```bash
npm install
npx playwright install chromium
npm test
```

A suíte Chromium cobre 21 casos: desktop, tablet e celular sem rolagem horizontal; temas/idiomas e persistência; foco de leitura; menu; flip/tilt; paleta; seleção de serviço; validação e navegação única do WhatsApp; dados, falha e cache do GitHub; ausência de JS; movimento reduzido e impressão.

Os testes usam fixtures explicitamente sintéticas para respostas de API e interceptam o WhatsApp: nenhuma mensagem real é enviada. Capturas completas, rastros e PDF ficam em `test-results/` e no artefato **portfolio-browser-review** do GitHub Actions. As verificações de navegador são executadas no Actions antes da atualização da versão principal.

## Publicação

Mantenha o GitHub Pages apontando para a raiz da branch `main`, conforme a configuração existente. O site não depende de Node.js ou Playwright em produção. Ao enviar alterações, o Pages publica os arquivos estáticos; o workflow `Portfolio browser checks` também executa a suíte. Não coloque tokens, credenciais ou dados privados nos scripts.

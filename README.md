# ZAION Soluções Digitais — Portfólio web

Site estático completo feito em HTML, CSS e JavaScript, pronto para publicar.

## Abrir localmente

Abra `index.html` no navegador. Para usar um servidor local, execute `python -m http.server 8000` nesta pasta e acesse http://localhost:8000.

## Publicar no GitHub

1. Crie um repositório público chamado `portfolio-zaion` em https://github.com/new, sem inicializar README.
2. Extraia o ZIP e abra o terminal na pasta que contém `index.html`.
3. Execute:

```bash
git init
git add .
git commit -m "Publica portfolio ZAION"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/portfolio-zaion.git
git push -u origin main
```

Substitua `SEU_USUARIO` pelo seu usuário GitHub. Se o repositório já estiver ligado ao remoto, não repita o `git remote add origin`; use `git add . && git commit -m "Atualiza portfolio" && git push`.

## Habilitar GitHub Pages

Na página do repositório, abra **Settings → Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main` e pasta `/(root)`, depois **Save**. O endereço será `https://SEU_USUARIO.github.io/portfolio-zaion/` após a publicação.

## Colocar no LinkedIn

Copie o URL publicado e acrescente no seu perfil em **Informações de contato → Website**. Você pode também usar **Adicionar seção do perfil → Recomendado → Adicionar destaque → Adicionar um link**, com o título **Portfólio | ZAION Soluções Digitais**.

## Personalizar

- `index.html`: textos e contatos.
- `css/style.css`: cores, layout e animações.
- `js/script.js`: menu, filtros, formulário de orçamento e modais.
- `assets/`: logotipos e imagens.

## Faixa de serviços

A faixa agora usa movimento por JavaScript (`requestAnimationFrame`) a **42 pixels por segundo**, com repetição contínua e sem depender da animação CSS que estava sendo interrompida. O botão **Pausar / Mover** permite controlar a animação quando necessário. Não é preciso instalar bibliotecas.

## Observação

Revise os projetos demonstrativos e as informações de contato antes de divulgar. Todos os arquivos necessários estão neste ZIP.


## Visualização local
- **Arquivo HTML único**: abra `ZAION_Portfolio_Abrir_Diretamente.html` sem precisar extrair nada (distribuído separadamente).
- **Projeto completo**: extraia o ZIP inteiro antes de abrir `index.html`. A pasta `assets`, `css` e `js` deve ficar junto do `index.html`.
- **GitHub Pages**: envie o conteúdo extraído (não somente o ZIP) à raiz do repositório e habilite Settings → Pages → Deploy from branch `main` / root.


## Atualização visual

- Logotipo com fundo transparente: `assets/zaion-logo-transparente.png`.
- Ícones do WhatsApp substituídos por SVG vetorial consistente.
- Link de produção: https://zaionluz.github.io/Portifolio/
- Para atualizar o GitHub, envie `index.html`, `css/`, `js/` e `assets/` à **raiz** do repositório `ZaionLuz/Portifolio`, confirme o commit e verifique a publicação em Actions.


## Atualização visual

- Logotipo com fundo transparente: `assets/zaion-logo-transparente.png`.
- Ícones do WhatsApp substituídos por SVG vetorial consistente.
- Link de produção: https://zaionluz.github.io/Portifolio/
- Para atualizar o GitHub, envie `index.html`, `css/`, `js/` e `assets/` à **raiz** do repositório `ZaionLuz/Portifolio`, confirme o commit e verifique a publicação em Actions.

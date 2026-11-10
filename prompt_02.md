# ROLE & OBJECTIVE
Você é um Principal Product Designer (especialista em sistemas POS/PDV gastronômicos como Toast POS, Square for Restaurants e Lightspeed) e Engenheiro Frontend Sênior React/TypeScript/TailwindCSS.

O backend, o domínio e os 14 testes automatizados (`CT01` a `CT14`) do **Sistema Basílico** já estão funcionando perfeitamente — **NÃO quebre nenhuma regra de negócio nem altere os contratos da `BasilicoSystemFacade.ts` que fazem os testes passarem**.
Seu objetivo exclusivo agora é realizar um **Redesign Completo de UI/UX e Refatoração da Camada de Apresentação (`src/presentation/`)** para eliminar 100% da aparência genérica de "sistema gerado por IA" (aquele tema azul-escuro cyberpunk com verde neon e textos técnicos espalhados) e transformá-lo em um **Software Comercial de Restaurante Italiano Moderno, Quente, Intuitivo e Fiel à Marca Basílico**.

---

# 1. IDENTIDADE VISUAL E PALETA DE CORES OFICIAL (BASEADA NA LOGO DO BASÍLICO)
A logo oficial do Restaurante Basílico possui fundo de pergaminho envelhecido/creme quente, tipografia caligráfica em carvão/espresso escuro, um arco dinâmico em Laranja Terracota vibrante e duas folhas de manjericão em Verde Folha vivo.

Substitua completamente o tema azul-escuro/verde-neon atual por um **Design System Gastronômico Artesanal ("Tuscan Warmth")** em `styles.css` e no Tailwind:

1. **Paleta de Cores (Variáveis CSS e Classes):**
   - **Fundo Principal da Aplicação (Warm Parchment / Creme Claro):** `#FAF6EE` (transmite limpeza, reduz fadiga visual e lembra massa artesanal/pergaminho).
   - **Fundo Secundário / Superfícies de Apoio:** `#F2E9D8` (Bege pedra quente, inspirado na textura da logo).
   - **Cards de Produtos e Painéis (Branco Quente):** `#FFFFFF` com borda sutil `#E6DEC8` e sombra suave `0 4px 20px -2px rgba(35, 32, 30, 0.06)`.
   - **Sidebar Lateral, Header Principal e Rodapé Técnico (Espresso / Carvão Basílico):** `#1E1B18` (contraste elegante de cafeteria/trattoria moderna) com textos claros em `#F7F3EB`.
   - **Cor Primária de Marca / Ação Principal (Laranja Terracota da Logo):** `#E86F2C` (hover: `#D45D1B`, fundo suave para badges: `#FFF0E6`). Use para CTAs principais, destaques de categoria ativa e seleções.
   - **Cor Secundária de Marca / Confirmação & Pagamento (Verde Manjericão da Logo):** `#4E8C22` / `#5CA329` (hover: `#3E7319`, fundo suave: `#EEF7E6`). Use para o botão de Finalizar Venda, status Online e confirmações.
   - **Tipografia Principal:** `#23201E` (Carvão escuro) para títulos e `#6E655F` (Marrom acinzentado quente) para descrições secundárias.
   - **Cores Semânticas:**
     - iFood: `#EA1D2C` | Aiqfome: `#7B1FA2`
     - Alerta / Sincronizando / Pendente: `#D97706` (Âmbar quente)
     - Erro / Offline / Estorno: `#DC2626` (Vermelho tomate)

2. **Tipografia (Google Fonts no `index.html`):**
   - Importe no `index.html`: `'Playfair Display'` (ou `'Cormorant Garamond'`), `'Plus Jakarta Sans'` e `'JetBrains Mono'`.
   - Use `'Plus Jakarta Sans'` como fonte principal da interface (limpa, moderna e de alta legibilidade para caixa).
   - Use `'Playfair Display'` (itálico/bold) para o nome **"Basílico"** e títulos de boas-vindas, remetendo à caligrafia clássica da logo.
   - Use `'JetBrains Mono'` exclusivamente para valores monetários tabulares, contadores de tempo, UUIDs e a bobina térmica ESC/POS.

3. **Componente de Logo Oficial (`src/presentation/components/BrandLogo.tsx`):**
   - Crie um componente que tente carregar a imagem `/logo-basilico.jpg` ou `/logo-basilico.png` (caso o usuário tenha colocado na pasta `public/`) dentro de um medalhão circular elegante com borda dourada/terracota.
   - Caso a imagem não exista em `public/`, renderize como fallback automático um **SVG rico e idêntico à logo real**: círculo com gradiente pergaminho (`#F3E3C3` para `#DFC394`), texto caligráfico "Basílico" em `#23201E`, subtítulo "RESTAURANTE", o swoosh curvo inferior em Laranja Terracota (`#E86F2C`) e as duas folhas de manjericão no canto superior direito em Verde (`#68A828`). Nunca mais mostre apenas uma letra "B" verde dentro de um quadrado!

---

# 2. DESPOLUIÇÃO VISUAL: SEPARAR O "MODO CLIENTE/OPERADOR" DO "MODO AVALIADOR UNIFEI"
Um dos maiores defeitos atuais é misturar textos acadêmicos (`RF01`, `CT01`, `RPO=0`, `1. Frente de Caixa (PDV Offline-First)`) com a operação real do restaurante.

1. **Chave "Modo Raio-X Acadêmico (UNIFEI)" no Topo:**
   - Adicione no cabeçalho um toggle discreto com ícone de capelo/código: `🎓 Modo Avaliador UNIFEI (ON/OFF)`.
   - **Quando OFF (Padrão Comercial Realista):** A interface esconde siglas de requisitos (`RF01`, `CT12`, `bcrypt cost 12`) dos títulos e subtítulos, usando linguagem 100% amigável de produto real (ex.: em vez de *"1. Frente de Caixa (PDV Offline-First)"*, mostre apenas **"PDV & Balcão"**; em vez de *"Carrinho Persistente (WAL) - RPO=0"*, mostre **"Comanda Atual"** com um pequeno ícone de nuvem/check *"Salvo automaticamente"*).
   - **Quando ON:** Exibe badges elegantes com os códigos de rastreabilidade (`RF01`, `RN03`, `CT12`) para o professor conferir durante a correção.

2. **Laboratório de Caos & Simulação em Gaveta Retrátil (Collapsible Dock):**
   - Em vez de uma barra verde-neon gigante ocupando o rodapé o tempo todo, transforme o **Laboratório de Caos & Simulação (ECOT11A)** em uma **barra/gaveta flutuante retrátil (estilo DevTools moderna)** na base da tela.
   - Ela pode ficar recolhida como uma pílula compacta no rodapé (`🧪 Simulador de Caos & Testes [Expandir ▲] — WAN: Online | Bobina: OK`) ou expandida com 1 clique revelando todos os botões de injeção de falhas (Rede WAN, Impressora 9100 Sem Papel, Corte de Lote Toxiproxy, + Pedido iFood, + Pedido Aiqfome, + Duplicata, Queda Elétrica e um NOVO botão **"🗑️ Resetar Banco Demo"** que limpa o `localStorage` e recarrega os dados iniciais do `SeedData`).

---

# 3. NOVA ARQUITETURA DE LAYOUT E UX (PADRÃO TOAST POS / SQUARE)
Quebre o arquivo monolítico `src/presentation/App.tsx` em componentes organizados dentro de `src/presentation/components/`:

### 3.1. Tela de Login (`LoginView.tsx`) — Elegante e Acolhedora
- Layout **Split-Screen (Tela Dividida)** moderno:
  - **Lado Esquerdo (Herói Institucional em Espresso Escuro `#1E1B18` com textura sutil):** A Logo grande do **Restaurante Basílico**, frase *"Tradição Italiana & Operação Resiliente — Pouso Alegre, MG"*, indicadores visuais elegantes de que o terminal está protegido com banco local Offline-First e status do carrinho salvo no caso de queda elétrica.
  - **Lado Direito (Formulário sobre fundo Pergaminho `#FAF6EE`):** Card limpo de login, campos com ícones, botão principal **"Entrar no Terminal"** em Laranja Terracota (`#E86F2C`), e uma seção inferior bem desenhada chamada **"Acesso Rápido para Avaliação"** com dois cards clicáveis (com ícone de Operador de Caixa e ícone de Gerente de Loja) que já preenchem ou logam com 1 clique.

### 3.2. Estrutura Principal Logada (Sidebar + Topbar + Workspace)
Substitua aquelas 4 abas enormes quebradas em 2 linhas por uma **Navegação Lateral Esquerda (Sidebar) ou Topbar Unificada ultra limpa**:
- **Menu de Navegação Principal (4 seções claras com ícones SVG Lucide):**
  1. 🍽️ **Frente de Caixa (PDV)** — Badge com qtd de itens na comanda.
  2. 🛵 **Hub de Delivery** — Badge pulsante com pedidos aguardando aceite (ex.: `2 novos`).
  3. 💰 **Caixa, Vendas & Estornos** — Gestão de turno, histórico e RBAC.
  4. 🔍 **Auditoria & Sincronização** — Inspetor Outbox SQLite ↔ PostgreSQL, Logs e LGPD.
- **Topbar Operacional Enxuta:**
  - Status de Conexão (Pílula clara: 🟢 **Online · Sincronizado**, 🔴 **Modo Offline · X na fila**, 🟠 **Sincronizando Lote...**).
  - Status do Caixa (`Caixa Aberto · R$ 250,00` clicável para ir ao fechamento).
  - Botão `🖨️ Impressora Térmica (OK / Sem Papel)` que abre/fecha a gaveta da bobina térmica a qualquer momento (com contador de impressões).
  - Perfil do Usuário (`Operador` ou `Gerente`), botão discreto de `⏱️ Simular Inatividade` e botão `Sair`.

### 3.3. Redesign da Aba 1: Frente de Caixa / PDV (`PosView.tsx`) — Foco Total em Velocidade
Divida a área da Frente de Caixa em **2 zonas ergonômicas** (proporção 65% Catálogo à esquerda / 35% Comanda fixa à direita):

1. **Zona do Catálogo (Esquerda - 65%):**
   - **Barra Superior do Catálogo:** Campo de **Busca Instantânea por nome do prato** (`🔍 Buscar prato ou bebida...`), botão **`+ Novo Prato`** estilizado.
   - **Barra de Categorias com Ícones:** Botões horizontais tipo pílula grande para toque rápido: `✨ Todos`, `🥖 Entradas`, `🍝 Massas`, `🍕 Pizzas`, `🍲 Risotos`, `🍰 Sobremesas`, `🍷 Bebidas`. A categoria ativa fica em Laranja Terracota (`#E86F2C`) com texto branco.
   - **Grade de Cards de Produtos (3 colunas em telas grandes):**
     - Cada card deve ter uma faixa superior colorida ou ícone ilustrativo elegante da categoria, tag da categoria, Nome do Prato em destaque (`#23201E`), descrição curta em 2 linhas e Preço em destaque (`R$ 58,90`).
     - **UX de PDV Real:** Clicar no botão `+ Adicionar` (ou direto no card) adiciona imediatamente ao carrinho com feedback visual (se o item já está no carrinho, mostre um badge `2x na comanda` na borda do card!).
     - No canto superior direito do card, coloque botões discretos de ícone para **Editar (✏️)** e **Excluir Produto (🗑️)** (implementando na UI a função de exclusão de produto do CRUD que faltava na tela).

2. **Zona da Comanda / Checkout Fixo (Direita - 35%, altura total da tela):**
   - Cabeçalho da Comanda: **"Comanda de Balcão"**, indicador discreto `"⚡ Salvo no disco (WAL)"` e botão `"Limpar"`.
   - **Lista de Itens Rolável:** Cada item com nome completo, preço unitário, controles `-` `1` `+` bem dimensionados para toque e subtotal da linha.
   - **Rodapé de Pagamento Fixo na Base da Comanda (Sempre visível sem precisar rolar a página inteira):**
     - Linha de **Desconto (R$)** expansível ou compacta.
     - Seleção de **Forma de Pagamento** em 4 botões visuais com ícones: `💠 PIX`, `💳 Crédito`, `💳 Débito`, `💵 Dinheiro`.
     - **NOVO (UX Realista):** Se o operador selecionar `💵 Dinheiro`, exiba um campo opcional rápido **"Valor Recebido (R$)"** que calcula e mostra automaticamente o **Troco** na tela!
     - Resumo claro: Subtotal, Desconto e **TOTAL A PAGAR** em fonte grande.
     - Botão primário gigante em Verde Manjericão (`#4E8C22`): **"✓ Finalizar Venda e Emitir Cupom (R$ XX,XX)"**.

### 3.4. Bobina Térmica ESC/POS Inteligente (`ThermalPrinterDrawer.tsx`)
- Em vez de ocupar 1/3 da tela vazia na Frente de Caixa, transforme a Impressora Térmica em um **Painel Deslizante (Slide-over Drawer) ou Modal Flutuante de Cozinha/Caixa** com opção de "Fixar na tela (Pin)".
- **Comportamento Automático:** Sempre que uma venda for finalizada ou um pedido de delivery for aceito e impresso, o painel da Bobina Térmica abre automaticamente (ou destaca-se) mostrando o cupom amarelo-térmico realista com borda serrilhada de papel rasgado no topo e na base, som suave de impressão e opção de ver/ocultar o *Hex Dump ESC/POS* técnico num acordeão retrátil (`Ver Bytes ESC/POS N-API`).

### 3.5. Redesign da Aba 2: Hub Central de Delivery (`DeliveryHubView.tsx`)
- Layout estilo **KDS (Kitchen Display System) / Gestor de Pedidos iFood** dividido em colunas ou filtros de status claros:
  - **Novos / Aguardando Aceite (`RECEBIDO`)** — Com borda pulsante, badge vermelho do **iFood** ou roxo do **Aiqfome**, código externo (`#IFOOD-8841`), dados do cliente, lista clara de itens e botão de destaque **"✓ Aceitar e Imprimir na Cozinha"** ao lado de **"Recusar"**.
  - **Retidos na Impressora (`PENDENTE_IMPRESSAO` - Regra RN03)** — Destaque em Âmbar explicando claramente ao operador: *"Atenção: Pedido aceito na plataforma, mas a impressora da cozinha está SEM BOBINA. Troque o papel e clique em Reimprimir."* com botão **"🖨️ Reimprimir Via da Cozinha"**.
  - **Em Preparo na Cozinha (`EM_PREPARO`)** & **Concluídos (`CONCLUIDO`)** — Com botão para concluir entrega.

### 3.6. Redesign da Aba 3: Caixa, Histórico de Vendas & Estornos (`CashierHistoryView.tsx`)
- **Cards de Resumo Financeiro no Topo (KPIs do Turno):**
  - *Saldo Atual em Caixa*, *Total Vendido no Turno*, *Vendas Pendentes de Sincronização (Outbox)* e *Total Estornado*.
- **Controle de Turno (Abrir / Fechar Caixa):** Visual limpo. Ao fechar o caixa offline com itens pendentes, exibir o Relatório de Fechamento em formato de documento contábil claro destacando a ressalva da `RN04`.
- **Tabela/Lista Moderna de Vendas:** Com filtros rápidos (Todas, Sincronizadas, Pendentes Offline, Estornadas), badges claros e botão **"Estornar Venda"** que abre o modal de autorização do Gerente (RBAC) com design bancário/corporativo limpo.

### 3.7. Redesign da Aba 4: Inspetor Arquitetural (`ArchitectureInspectorView.tsx`)
- Mantenha todas as funcionalidades técnicas que o professor vai avaliar (Tabelas lado a lado `SQLite Outbox Local` vs `PostgreSQL Nuvem`, botão de Reenviar Lote para provar Idempotência, botão de Anonimização LGPD `RE01` e Trilha de Auditoria Imutável), mas com visual de **Dashboard de Engenharia Moderno** (tabelas bem alinhadas, badges semânticos e explicação visual do fluxo `SQLite -> SyncWorker -> PostgreSQL`).

---

# 4. REGRAS DE OURO E VALIDAÇÃO FINAL
1. **Preserve 100% da Lógica e dos Testes:** Não altere assinaturas de métodos do domínio, da `BasilicoSystemFacade` ou dos repositórios que são testados em `tests/sistema-basilico.spec.ts`.
2. **Responsividade e Ergonomia:** Garanta que na tela de Frente de Caixa o operador veja os produtos e o botão de "Finalizar Venda" imediatamente sem precisar rolar a janela inteira do navegador.
3. **Verificação Obrigatória antes de concluir:**
   - Rode `npx vitest run` (ou `npm test`) e garanta que **todos os 14 Casos de Teste (CT01 a CT14) continuam passando com 100% de sucesso**.
   - Rode `npm run build` para garantir zero erros de TypeScript ou CSS.
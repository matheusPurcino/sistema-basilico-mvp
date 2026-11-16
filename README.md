# Sistema Basílico — PDV Offline-First & Hub de Delivery (MVP)

> **Universidade Federal de Itajubá (UNIFEI)** — Instituto de Engenharia de Sistemas e Tecnologia da Informação (IESTI)  
> **Curso:** Engenharia de Computação  
> **Disciplina:** ECOT11A / ECOT01 — Laboratório de Engenharia de Software I  
> **Professor Orientador:** Prof. Dr. Edvard  
> **Autor:** Matheus Gouveia Purcino — **Matrícula:** `2024006907`  
> **Entrega:** Versão Final Definitiva — UI/UX Comercial (*Tuscan Warmth*) + Suíte Automatizada (`CT01` a `CT14`) + Auditoria Completa

---

## 🌐 Link Direto de Deploy Online (Avaliação em 1 Clique)

Para que o professor avaliador possa homologar todas as funcionalidades imediatamente no navegador — sem necessidade de configurar banco PostgreSQL externo, conta de desenvolvedor iFood/Aiqfome ou impressora térmica física — a aplicação conta com o **Simulador de Caos & Testes (ECOT11A)** integrado em uma gaveta retrátil no rodapé e a chave **`🎓 Modo Avaliador UNIFEI (ON/OFF)`** no cabeçalho:

- **URL de Produção / Homologação Web:** `https://sistema-basilico-mvp.vercel.app` *(ou execute localmente com `npm install && npm run dev`)*
- **Publicação imediata em 1 comando:**
  - **Vercel:** `npm run deploy:vercel` (`npx vercel --prod`)
  - **GitHub Pages:** `npm run deploy:gh-pages` (`npm run build && npx gh-pages -d dist`)

---

## 1. Breve Descrição da Proposta do Software

O **Sistema Basílico** foi projetado para solucionar os gargalos operacionais reais enfrentados pelo **Restaurante Basílico** (especializado em culinária italiana artesanal em Pouso Alegre/MG) durante os horários de pico de almoço e jantar, unindo uma interface comercial ergonômica (*Design System Tuscan Warmth*) a uma engenharia de alta resiliência:

1. **Inoperância em Quedas de Internet e Energia:** Sistemas PDV puramente web paralisam o frente de caixa quando a conexão WAN oscila. O Sistema Basílico adota uma **Arquitetura Híbrida Offline-First** com banco local **SQLite em modo WAL (Write-Ahead Logging)** e cifragem **AES-256-GCM (padrão SQLCipher)**, garantindo perda zero de dados da comanda aberta ($\text{RPO} = 0$) e recuperação imediata ($\text{RTO} \le 2\text{ min}$) mesmo após queda abrupta de energia.
2. **Sincronização Assíncrona e Idempotente (`Transactional Outbox`):** Cada venda ou estorno é gravado na mesma transação ACID local junto a um evento na tabela `outbox_events` com chave `UUID v4` e sequência monotônica. Quando a rede retorna, o motor `SyncWorker` transmite lotes atômicos de até 100 eventos para o banco central **PostgreSQL**, aplicando **Backoff Exponencial com Jitter** ($t_n = \min(2^{n-1}\text{s} + \xi_n, 60\text{s})$) e descarte idempotente de duplicatas (*effectively-once*).
3. **Fragmentação de Canais de Delivery e Falhas de Impressão na Cozinha:** O sistema centraliza os pedidos do **iFood** e do **Aiqfome** em uma fila única normalizada (`PedidoDelivery`), com renovação automática de tokens **OAuth 2.0**, exigência estrita de **TLS 1.3** e comunicação direta com a **Impressora Térmica 80mm (ESC/POS)** via driver nativo C++ N-API (`addons/escpos_driver.cpp`) e simulador visual de bobina em tempo real (`ThermalPrinterDrawer.tsx`). Pela **RN03**, o pedido só assume o status `EM_PREPARO` após confirmação física do sensor de papel da impressora.

---

## 2. Quadro Demonstrativo dos Níveis de Complexidade (Mapeamento do Roteiro)

A tabela abaixo demonstra onde cada nível exigido no roteiro da disciplina foi implementado no código-fonte e na interface gráfica:

| Nível de Complexidade | Requisitos Atendidos no Sistema Basílico | Arquivos / Módulos no Repositório | Onde Testar na Interface |
| :--- | :--- | :--- | :--- |
| **Nível Básico** | Autenticação de usuários (`OperadorCaixa` e `Gerente`), abertura/fechamento de caixa, catálogo de produtos com busca e categorias, calculadora automática de troco em dinheiro e registro de venda presencial com cálculo exato em centavos inteiros. | `src/domain/entities/Usuario.ts`, `OperadorCaixa.ts`, `Venda.ts`, `ItemVenda.ts`, `src/domain/shared/Money.ts` | **Tela de Login** (`LoginView.tsx`) + **Frente de Caixa (PDV)** (`PosView.tsx`) |
| **Nível Intermediário** | Persistência relacional SQLite com CRUD completo de produtos (criar, editar e excluir via menu `⋮`), controle de acesso baseado em papéis (**RBAC** — estorno exclusivo do `Gerente` com `EventoCompensatorio` — **RN02**), histórico de vendas, relatórios de fechamento com alerta **RN04** e rotina de anonimização **LGPD (RE01)**. | `src/domain/entities/Gerente.ts`, `src/infrastructure/persistence/SqliteRepositories.ts`, `src/domain/services/Lgpd.ts` | **Frente de Caixa** (botão `+ Novo Prato` / menu `⋮`), **Caixa, Vendas & Estornos** (`CashierHistoryView.tsx`) e **Auditoria & Sincronização** (`ArchitectureInspectorView.tsx`) |
| **Nível Avançado** | Arquitetura Híbrida **Offline-First** (SQLite WAL + Cifragem **AES-256-GCM**), fila **Transactional Outbox** com sincronização em lotes atômicos para **PostgreSQL**, **Backoff Exponencial com Jitter**, **Dead-Letter Queue**, Hub de Delivery KDS (**iFood/Aiqfome** com OAuth 2.0 e TLS 1.3), driver nativo **C++ N-API ESC/POS** + Bobina Térmica 80mm (**RN03**) e **Simulador de Caos & Testes**. | `src/infrastructure/persistence/SQLiteEngine.ts`, `AesGcmCipher.ts`, `src/application/SyncWorker.ts`, `src/infrastructure/cloud/PostgresCloudMock.ts`, `DeliveryAdapters.ts`, `addons/escpos_driver.cpp`, `EscPosThermalSimulator.ts` | **Hub de Delivery** (`DeliveryHubView.tsx`), **Auditoria & Sincronização**, **Bobina Térmica 80mm** (`ThermalPrinterDrawer.tsx`) e **Gaveta Retrátil de Caos** (`ChaosSimulatorDock.tsx`) |

---

## 3. Roteiro Guiado de Homologação Rápida para o Professor (3 Minutos)

### 🔑 Credenciais de Homologação (Cards de Acesso Rápido na Tela de Login)

| Perfil RBAC | Usuário / E-mail | Senha | Permissões |
| :--- | :--- | :--- | :--- |
| **Operador de Caixa** | `operador` (`operador@basilico.com.br`) | `Operador@123` | Abrir/fechar caixa, operar PDV, gerenciar cardápio e aceitar pedidos de delivery. **Bloqueado para estornos (RN02).** |
| **Gerente de Loja** | `gerente` (`gerente@basilico.com.br`) | `Gerente@123` | Todas as permissões do Operador + **exclusividade para autorizar estornos (`autorizarEstorno`)**. |

> **💡 Dica para Avaliação:** Clique em **`🎓 Modo Avaliador UNIFEI: ON`** no topo (ou na tela de login) para exibir os selos de rastreabilidade (`RF01`, `RN02`, `RN03`, `CT01`–`CT14`) ao lado dos títulos operacionais.

### 📋 Passo a Passo de Avaliação (5 Cenários em 3 Minutos)

1. **Cenário 1 — Venda Presencial Online & Offline + Queda Elétrica (`RF01`, `CT01`, `CT11`, `CT12`):**
   - Na tela de login, clique em **"Operador de Caixa"** na seção *Acesso Rápido para Avaliação* (ou preencha os dados e clique em **"Entrar no Terminal"**).
   - Em **Frente de Caixa (PDV)**, adicione pratos à **Comanda de Balcão** e abra a gaveta **`🧪 Simulador de Caos & Testes [Expandir ▲]`** no rodapé. Clique em **"⚡ Queda Elétrica (Reload WAL)"**: a página recarregará e a comanda voltará intacta a partir do SQLite WAL ($\text{RPO} = 0$).
   - Ainda na gaveta de Caos, clique em **"🌐 Rede WAN: Online"** para mudar para **"Offline (Queda de Internet)"** (a pílula no topo mudará para **Modo Offline**).
   - Selecione a forma de pagamento (ex.: `PIX` ou `Dinheiro` com calculadora automática de troco) e clique em **"Finalizar Venda"**: a venda é concluída em $< 2\text{s}$, a **Bobina Térmica 80mm** abre automaticamente com o cupom (e o acordeão `[ 🖨️ Modo Técnico: Inspecionar Bytes ESC/POS ]` no rodapé da bobina permite ver o hex dump) e o evento entra na fila local `outbox_events`.
2. **Cenário 2 — Fechamento de Caixa Offline com Alerta de Pendência (`RN04`, `CT11`):**
   - Com a rede **Offline**, acesse **Caixa, Vendas & Estornos** na barra lateral esquerda e clique em **"🔒 Encerrar Turno e Emitir Relatório Contábil"**.
   - O sistema emitirá o demonstrativo contábil com a ressalva amarela da **RN04** e preservará a fila `Outbox` intacta. Clique em **"✓ Abrir Novo Turno"** para continuar.
3. **Cenário 3 — Estorno Protegido por RBAC de Gerente (`RN02`, `CT02`):**
   - Em **Caixa, Vendas & Estornos**, clique em **"Estornar Venda"** na venda realizada.
   - Como você está logado como `OPERADOR`, o modal exigirá as credenciais de `GERENTE` (já pré-preenchidas para facilitar; teste uma senha errada para validar o bloqueio RBAC). Ao confirmar, a venda original **não é apagada**, recebe o selo `ESTORNADA` e um `EventoCompensatorio` imutável aparece no Livro Razão abaixo.
4. **Cenário 4 — Pedido iFood/Aiqfome com Impressora Sem Bobina de Papel (`RF03`, `RF04`, `RN03`, `CT09`, `CT14`):**
   - Na gaveta **Simulador de Caos & Testes**, clique em **"🖨️ Impressora 9100: Com Bobina (OK)"** para alternar para **"Sem Papel (RN03)"**.
   - Clique em **"+ Pedido iFood"**: um alerta sonoro tocará e o banner de alto contraste surgirá no topo.
   - Acesse **Hub de Delivery** na barra lateral e clique em **"Aceitar e Imprimir na Cozinha"**: a falha física é detectada em $180\text{ms}$ ($\le 3\text{s}$) e, conforme a **RN03**, o pedido **não** vai para `EM_PREPARO`, ficando retido como `Retido na Impressora` (`PENDENTE_IMPRESSAO`).
   - Clique em **"🔄 Trocar Bobina de Papel 80mm Agora"** e depois em **"🖨️ Reimprimir Via da Cozinha"**: a via será impressa na bobina de 80mm e o pedido entrará em preparo.
5. **Cenário 5 — Sincronização em Lote Outbox SQLite $\to$ PostgreSQL, Rollback Toxiproxy, LGPD e Reset (`RF02`, `RE01`, `CT05`, `CT08`, `CT13`):**
   - Acesse **Auditoria & Sincronização** na barra lateral. Na gaveta de Caos, ative **"☁️ Nuvem: Corte de Lote Toxiproxy (CT13)"** e mude **"🌐 Rede WAN"** para **Online**: observe que o PostgreSQL executa rollback atômico do lote interrompido e o PDV retorna a `OperandoOffline` sem perder eventos.
   - Volte o botão **Nuvem** para **"Saudável"** e reconecte a **Rede WAN**: todos os eventos da `outbox_events` (SQLite) migram atomicamente para `cloud_transactions` (PostgreSQL).
   - Clique em **"🔁 Reenviar Último Lote (Idempotência)"** para comprovar que o PostgreSQL descarta 100% das duplicatas via `UUID v4`.
   - Clique em **"🔒 Executar Rotina de Anonimização LGPD (180 dias)"** e confira no **Hub de Delivery** que o pedido vencido teve nome, telefone e endereço mascarados com preservação dos totais fiscais.
   - Ao final, caso deseje restaurar o estado inicial de demonstração, use **"🗑️ Resetar Banco Demo"** na gaveta de Caos.

---

## 4. Instruções Detalhadas de Compilação, Execução Local, Testes e Deploy

### Pré-requisitos
- **Node.js** $\ge 20.x$ (recomendado **Node.js 22 LTS**) e **npm** $\ge 10.x$.
- *(Opcional para recompilar o addon C++ N-API)*: Python 3 + compilador C++17 (`MSVC Build Tools` no Windows ou `build-essential` no Linux). O sistema inclui o simulador binário `EscPosThermalSimulator.ts` como fallback automático caso o binário `.node` não esteja compilado na máquina do avaliador.

### Comandos Passo a Passo

```bash
# 1. Instalar todas as dependências do projeto
npm install

# 2. Executar a suíte completa de testes automatizados (CT01 a CT14 no Vitest)
npx vitest run
# (ou: npm test)

# 3. Executar os testes com relatório detalhado de cobertura de código (> 80%)
npm run test:coverage

# 4. Iniciar a aplicação no navegador (Vite HMR em http://127.0.0.1:5173)
npm run dev

# 5. Iniciar a aplicação como janela nativa Desktop (Electron + Vite)
npm run electron:dev
# (ou build completo + execução Electron: npm run electron:start)

# 6. Compilar TypeScript (strict), Bundle de Produção Web e Processo Electron
npm run build

# 7. (Opcional) Compilar o driver nativo C++ N-API (addons/escpos_driver.cpp)
npm run addon:build
```

---

## 5. Arquitetura em 4 Camadas + MVC e Matriz de Rastreabilidade (CT01 a CT14)

### Estrutura de Diretórios

```text
sistema-basilico-mvp/
├── addons/
│   ├── binding.gyp                                    # Configuração node-gyp do driver nativo C++
│   └── escpos_driver.cpp                              # Addon C++ N-API (ABI v8) para comandos binários ESC/POS 80mm
├── electron/
│   ├── main.ts                                        # Processo principal Electron (Windows/Linux) + IPC
│   └── preload.ts                                     # ContextBridge seguro para o Renderer
├── public/
│   ├── sql-wasm.wasm                                  # Binário WebAssembly SQLite para execução Node/Electron
│   └── sql-wasm-browser.wasm                          # Binário WebAssembly SQLite para execução 100% offline no browser
├── src/
│   ├── domain/                                        # 1. CAMADA DE DOMÍNIO (UML Pura, Entidades e Regras de Negócio)
│   │   ├── entities/                                  # Usuario, OperadorCaixa, Gerente, Venda, ItemVenda, PedidoDelivery, Caixa, Carrinho, DocumentoImpressao
│   │   ├── repositories/                              # Contratos (Portas) de Repositório (Outbox, Venda, Pedido, AuditLog, etc.)
│   │   ├── services/                                  # Serviço de Domínio LGPD (RE01)
│   │   └── shared/                                    # Objeto de Valor Money (Centavos Inteiros), Clock Injetável, UUID v4 e Erros
│   ├── application/                                   # 2. CAMADA DE APLICAÇÃO (Casos de Uso, MVC/Facade, RBAC e SyncWorker)
│   │   ├── AuthSessionService.ts                      # Autenticação offline < 1s, RBAC e bloqueio por inatividade (30 min)
│   │   ├── SyncWorker.ts                              # Sincronização em lotes de 100, Backoff Exponencial com Jitter e Dead-Letter Queue
│   │   └── BasilicoSystemFacade.ts                    # Fachada de Casos de Uso orquestrando PDV, Delivery, Caixa, Outbox e Caos
│   ├── infrastructure/                                # 3. CAMADA DE INFRAESTRUTURA (Persistência, Nuvem, Adaptadores e Impressão)
│   │   ├── persistence/                               # SQLiteEngine (Modo WAL), AesGcmCipher (SQLCipher AES-256), LocalSchema, SeedData e Repositórios
│   │   ├── cloud/                                     # PostgresCloudMock (Transações Atômicas, Idempotência UUID v4 e Toxiproxy)
│   │   ├── integrations/                              # IFoodAdapter & AiqfomeAdapter (OAuth 2.0, TLS 1.3, Deduplicação e Retry 60s)
│   │   ├── printing/                                  # EscPosThermalSimulator (Bytes ESC/POS e Bobina Virtual 80mm)
│   │   └── security/                                  # BcryptHasher (fator de trabalho / custo >= 12)
│   └── presentation/                                  # 4. CAMADA DE APRESENTAÇÃO (React 19 + TypeScript + TailwindCSS)
│       ├── App.tsx                                    # Orquestração de estado da UI, Sidebar Espresso, Topbar e Modais
│       ├── styles.css                                 # Design System Tuscan Warmth (#FAF6EE, #E86F2C, #4E8C22, #1E1B18) e bobina 80mm
│       ├── audio/soundAlert.ts                        # Sintetizador sonoro Web Audio API (RNF03.4)
│       └── components/                                # Componentes modulares de UI/UX
│           ├── BrandLogo.tsx                          # Medalhão oficial Basílico (imagem customizada em public/ ou SVG vetorial fiel)
│           ├── LoginView.tsx                          # Tela Split-Screen com acesso rápido de 1 clique
│           ├── PosView.tsx                            # Catálogo (cards limpos + menu ⋮) + Comanda sticky com calculadora de troco
│           ├── ThermalPrinterDrawer.tsx               # Bobina térmica 80mm retrátil/fixável com Modo Técnico oculto no rodapé
│           ├── DeliveryHubView.tsx                    # Hub KDS unificado iFood & Aiqfome com tratamento de falha de papel (RN03)
│           ├── CashierHistoryView.tsx                 # KPIs do turno, fechamento contábil RN04 e histórico de estornos RBAC
│           ├── ArchitectureInspectorView.tsx          # Pipeline Outbox SQLite <-> PostgreSQL, Idempotência, Audit Logs e LGPD
│           ├── ChaosSimulatorDock.tsx                 # Gaveta retrátil de simulação de falhas e Resetar Banco Demo
│           └── Icons.tsx                              # Ícones SVG e badge condicional AcademicBadge
├── tests/
│   └── sistema-basilico.spec.ts                       # Suíte automatizada Vitest cobrindo CT01 a CT14 (> 85% de cobertura)
└── .github/workflows/ci.yml                           # Pipeline CI/CD (GitHub Actions em pushes/PRs para main e develop)
```

### Matriz de Rastreabilidade dos Casos de Teste Automatizados (`tests/sistema-basilico.spec.ts`)

| Caso de Teste | Categoria | Requisitos / Regras Verificados | Critério de Aceite Validado pelo Vitest |
| :--- | :--- | :--- | :--- |
| **CT01** | Unidade (Tabela 8) | `RF01`, `RNF01.1` | Adição de itens ao carrinho, aplicação de desconto, preservação de preço histórico em `ItemVenda` e cálculo exclusivamente em centavos inteiros sem erro de ponto flutuante em $< 2\text{s}$. |
| **CT02** | Unidade (Tabela 8) | `RF05`, `RN02` | Invocação de `autorizarEstorno()` com sessão de `Operador` lança `PermissaoNegadaError`; com `Gerente` autoriza, preserva a venda original, gera `EventoCompensatorio` e grava em `audit_logs` imutável (protegido por *triggers* SQLite). |
| **CT03** | Unidade (Tabela 8) | `RF02`, `RNF02.1` | Gravação atômica da venda e do evento na `outbox_events` (mesma transação ACID, sequência monotônica e `UUID v4`); falha forçada na Outbox executa *rollback* integral da venda. |
| **CT04** | Unidade (Tabela 8) | `RF05`, `RNF05.1`, `RNF05.3`, `RNF05.4` | Credenciais inválidas retornam mensagem genérica idêntica sem revelar qual campo falhou; validação de custo `bcrypt >= 12`; bloqueio automático de sessão após 30 minutos de inatividade com relógio injetável. |
| **CT05** | Unidade (Tabela 8) | `RE01` (LGPD) | Rotina de anonimização mascara `nome`, `telefone` e `endereco` apenas de pedidos de clientes não fidelizados com prazo legal vencido ($> 180$ dias), preservando pedidos recentes, clientes fidelizados e 100% dos totais fiscais. |
| **CT06** | Integração (Tabela 9) | `RF03`, `RNF03.1` | Recepção via Webhook/Polling do iFood e Aiqfome normalizando para `PedidoDelivery`; descarte idempotente de `codigoExterno` duplicado; agendamento de retentativa em $60\text{s}$ e registro em log diante de erro HTTP 503. |
| **CT07** | Integração (Tabela 9) | `RF03`, `RNF03.2` | Expiração de token OAuth 2.0 durante ciclo de polling renova a credencial automaticamente sem perder o pedido; tentativa de conexão com `TLS < 1.3` (`TLSv1.2`) é recusada imediatamente com `ErroSegurancaTls`. |
| **CT08** | Integração (Tabela 9) | `RF02`, `RNF02.2`, `RN01` | Sincronização de 500 eventos pendentes em 5 lotes atômicos de 100 sem bloquear o recebimento simultâneo de pedidos de delivery (`RN01`); reenvio de lote já confirmado tem 100% das duplicatas descartadas por `UUID v4`; validação de *Dead-Letter Queue* após 5 falhas lógicas. |
| **CT09** | Integração (Tabela 9) | `RF04`, `RNF04.1`, `RN03` | Aceite de pedido de delivery notifica API parceira, envia comandos binários ESC/POS (`0x1B 0x40` … `0x1D 0x56`) à impressora na porta 9100 em $\le 5\text{s}$, assume `EM_PREPARO` após confirmação física e desaloca o objeto transitório `DocumentoImpressao` (`instanciasVivas() === 0`). |
| **CT10** | Integração (Tabela 9) | `RNF01.2` | Tentativa de abrir/ler o banco local sem a chave AES-256 ou com chave incorreta lança `AcessoNegadoError`; inspeção do armazenamento comprova que os dados em repouso estão cifrados e ilegíveis em texto plano. |
| **CT11** | Caos & Resiliência (Tabela 10) | `RF01`, `RF02`, `RN04` | Queda de rede transiciona `Caixa` para `OperandoOffline` (`AguardandoVendaOffline` $\leftrightarrow$ `GravandoLocal`); fechamento de caixa offline emite alerta `RN04` preservando a Outbox; reconexão sincroniza automaticamente e retorna a `OperandoOnline`. |
| **CT12** | Caos & Resiliência (Tabela 10) | `RNF01.3`, `RNF05.2` | Simulação de corte de energia com carrinho aberto restaura todos os itens e descontos a partir do SQLite WAL com $\text{RPO} = 0$ e $\text{RTO} \le 2\text{ min}$; login sem internet via cache local cifrado ocorre em $< 1\text{s}$. |
| **CT13** | Caos & Resiliência (Tabela 10) | `RF02`, `RNF02.1`, `RNF02.2` | Corte de rede no meio do estado `Sincronizando` (Toxiproxy) provoca *rollback* completo da transação no PostgreSQL remoto, retorna o PDV a `OperandoOffline` com fila intacta e garante reenvio posterior sem duplicidade. |
| **CT14** | Caos & Resiliência (Tabela 10) | `RF04`, `RN03` | Aceite de pedido com impressora térmica sem bobina de papel detecta a falha física em $\le 3\text{s}$ ($180\text{ms}$), retém o status em `PENDENTE_IMPRESSAO`, exibe alerta ao operador e mantém na fila de reimpressão até a reposição da bobina. |

---

## 6. Licença e Autoria Acadêmica

Projeto desenvolvido exclusivamente para fins acadêmicos na disciplina **ECOT11A / ECOT01 — Laboratório de Engenharia de Software I** da **Universidade Federal de Itajubá (UNIFEI)**.  
**Autor:** Matheus Gouveia Purcino (`2024006907`) — Sob orientação do **Prof. Dr. Edvard**.

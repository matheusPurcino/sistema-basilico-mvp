# ROLE & OBJECTIVE
Você é um Engenheiro de Software Principal e Arquiteto Full-Stack operando em um ambiente agêntico (Antigravity). Sua missão é construir, do zero até a validação final dos testes automatizados, o repositório completo do **MVP do Sistema Basílico** — um Sistema Híbrido Offline-First de Frente de Caixa (PDV) e Hub de Delivery[cite: 4, 6].

Este repositório corresponde à **ENTREGA 2 (Projeto Testável + README.md)** da disciplina **ECOT11A / ECOT01 - Laboratório de Engenharia de Software I** da **Universidade Federal de Itajubá (UNIFEI)**, sob orientação do **Prof. Dr. Edvard**[cite: 1, 4].
- **Autor:** Matheus Gouveia Purcino | **Matrícula:** 2024006907[cite: 4]

Execute TODAS as etapas de ponta a ponta sem pedir confirmação intermediária: crie a estrutura de diretórios, instale as dependências, implemente o backend/domínio, o addon C++ (com fallback TS), o frontend interativo com Painel de Simulação de Caos, a suíte de testes automatizados (CT01 a CT14), a pipeline de CI e o `README.md` completo[cite: 2, 14, 16, 17]. Não utilize placeholders (`// TODO`): entregue código 100% funcional, compilável e testado.

---

# 1. ESTRATÉGIA ARQUITETURAL PARA AVALIAÇÃO (CRÍTICO)
O professor avaliará o projeto em três níveis de complexidade (Básico, Intermediário e Avançado)[cite: 2, 3] e verificará a aderência estrita à Documentação Técnica da Entrega 1[cite: 4, 5].
Para permitir que o avaliador teste o sistema tanto localmente (`npm run dev` / Electron) quanto via Deploy Web (Vercel/Render) com 1 clique — sem precisar de conta de desenvolvedor no iFood, impressora térmica física ou banco PostgreSQL externo configurado — você deve construir uma aplicação **Node.js + TypeScript + React (Vite) + Electron + SQLite/Persistência Híbrida**[cite: 14, 16] que inclua na própria interface um **Painel de Controle de Simulação e Caos (DevTools & Chaos Bar)** em tempo real.

### Stack e Estrutura em 4 Camadas + MVC (Seção 7.2 e 9 da Entrega 1):
Estruture o código rigorosamente nas camadas documentadas[cite: 14, 16]:
- `src/domain/`: Entidades da UML, Objetos de Valor, Contratos de Repositório e Regras de Negócio puras[cite: 11, 12, 14].
- `src/application/`: Casos de Uso, Controladores MVC/IPC, RBAC, `SyncWorker` (motor de sincronização com Backoff Exponencial) e Serviços de Aplicação[cite: 14].
- `src/infrastructure/`:
  - Persistência Local (`SQLiteEngine` com suporte a modo WAL, cifragem simulada/real AES-256 SQLCipher e fila `Transactional Outbox`)[cite: 8, 14].
  - Persistência Central Simulada/Real (`PostgresCloudMock` que simula o banco PostgreSQL em nuvem com controle transacional atômico, deduplicação por UUID v4 e injeção de falhas HTTP 503/timeout)[cite: 8, 14, 17].
  - Camada de Integração (`IFoodAdapter` e `AiqfomeAdapter` com OAuth 2.0, verificação TLS 1.3 e deduplicação por `codigoExterno`)[cite: 8, 14, 17].
  - Driver de Impressão (`addons/escpos_driver.cpp` + `binding.gyp` em C++ N-API real para comprovação arquitetural no repositório + `EscPosThermalSimulator.ts` que processa os comandos ESC/POS em buffer binário e renderiza a bobina térmica de 80mm na interface em tempo real)[cite: 8, 14, 16, 18].
- `src/presentation/`: Interface gráfica React + TypeScript + TailwindCSS (tema Dark Mode profissional com acentos em verde-esmeralda/neon, alto contraste WCAG 2.1 AA $\ge 4.5:1$ e tipografia sans-serif limpa)[cite: 8, 14].
- `electron/`: Configuração `main.ts` e `preload.ts` para empacotamento Desktop Windows/Linux, mantendo execução direta no navegador via `npm run dev`[cite: 9, 14, 16].
- `tests/`: Suíte completa em **Vitest** cobrindo explicitamente os Casos de Teste **CT01 a CT14** com cobertura $>80\%$[cite: 9, 16, 17].

---

# 2. MODELAGEM UML E ENTIDADES OBRIGATÓRIAS (SEÇÃO 6)
Implemente no código exatamente as classes, atributos, visibilidades e assinaturas do Diagrama de Classes (Figura 2) e Máquina de Estados (Figura 4)[cite: 11, 12, 13]:

1. **`abstract class Usuario`**:
   - Atributos protegidos: `#id: number`, `#nome: string`, `#email: string`, `#senhaHash: string`, `#papel: 'OPERADOR' | 'GERENTE'`[cite: 11, 12].
   - Métodos: `+autenticar(nomeOuEmail: string, senhaPura: string): boolean`, `+deslogar(): void`[cite: 12].
2. **`class OperadorCaixa extends Usuario`**:
   - Métodos: `+abrirCaixa(caixa: Caixa, saldoInicialCentavos: number): void`, `+fecharCaixa(caixa: Caixa): RelatorioFechamento`[cite: 12].
3. **`class Gerente extends OperadorCaixa`** (Herda capacidades de OperadorCaixa + exclusividade de estorno - RN02)[cite: 7, 8, 11, 12]:
   - Métodos: `+autorizarEstorno(idVenda: string, motivo: string, caixa: Caixa): EventoCompensatorio`[cite: 9, 12].
4. **`class ItemVenda`** (Composição forte `1..*` com `Venda`)[cite: 11, 12]:
   - Atributos: `-idProduto: number`, `-nomeProduto: string`, `-quantidade: number`, `-precoUnitarioCentavos: number` (preserva preço histórico do momento da venda)[cite: 11, 12, 16].
5. **`class Venda`**:
   - Atributos: `-idVenda: string` (UUID v4), `-numeroSequencial: number`, `-dataHora: Date`, `-valorTotalCentavos: number`, `-descontoCentavos: number`, `-metodoPagamento: 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO'`, `-sincronizado: boolean = false`, `-estornada: boolean = false`, `-itens: ItemVenda[]`[cite: 8, 12, 14].
   - Métodos: `+adicionarItem(item: ItemVenda): void`, `+registrarPagamento(metodo: string): boolean`, `+gerarCupom(): string`[cite: 11, 12].
6. **`class PedidoDelivery`**:
   - Atributos: `-idInterno: string` (UUID v4), `-codigoExterno: string`, `-plataforma: 'IFOOD' | 'AIQFOME'`, `-clienteNome: string`, `-clienteTelefone: string`, `-clienteEndereco: string`, `-itens: ItemVenda[]`, `-valorTotalCentavos: number`, `-status: 'RECEBIDO' | 'PENDENTE_IMPRESSAO' | 'EM_PREPARO' | 'RECUSADO' | 'CONCLUIDO'`, `-dataCriacao: Date`, `-anonimizadoLgpd: boolean`[cite: 8, 9, 12].
   - Métodos: `+aceitarPedido(impressora: ImpressoraTermica): boolean`, `+recusarPedido(motivo: string): void`, `+imprimirViaCozinha(impressora: ImpressoraTermica): boolean`[cite: 12].
7. **`class Caixa`** (Agrega `Venda[]` e `PedidoDelivery[]`)[cite: 11, 12]:
   - Atributos: `-aberto: boolean`, `-statusConexao: boolean = true`, `-estadoMaquina: 'OperandoOnline' | 'OperandoOffline' | 'Sincronizando'`, `-subEstadoOffline: 'AguardandoVendaOffline' | 'GravandoLocal' | null`, `-saldoLocalCentavos: number`[cite: 12, 13].
   - Métodos: `+sincronizarNuvem(): Promise<boolean>`, `+verificarStatusRede(): boolean`[cite: 12].

---

# 3. REQUISITOS FUNCIONAIS, NÃO-FUNCIONAIS E REGRAS DE NEGÓCIO (SEÇÃO 5 E 7.3)
Implemente cada mecanismo com fidelidade matemática e técnica:

- **RF01 (PDV Offline-First e Gestão de Caixa):**
  - Cálculos monetários exclusivamente em **centavos inteiros** para evitar erro de ponto flutuante (CT01)[cite: 16].
  - Persistência contínua do carrinho aberto em modo WAL (`RPO = 0`, `RTO <= 2 min` — se a página/app for recarregada simulando queda de energia com itens no carrinho, o carrinho deve ser restaurado intacto - RNF01.3, CT12)[cite: 8, 9, 17].
  - Banco local com camada de cifragem AES-256 / chave de acesso (`SQLCipher` wrapper) que rejeita leitura sem a chave ou com chave incorreta (RNF01.2, CT10)[cite: 8, 17].
  - Indicador visual de conectividade no topo: Verde (`OperandoOnline`), Vermelho (`OperandoOffline`), Âmbar (`Sincronizando`) (RNF01.4)[cite: 8, 12, 13].
- **RF02 (Sincronização Assíncrona e Idempotente SQLite -> PostgreSQL):**
  - **Transactional Outbox:** Toda venda ou estorno grava na mesma transação atômica o registro de negócio e um evento na `outbox_events` com `UUID v4`, sequência monotônica e status `PENDENTE`. Se a gravação na outbox falhar, faz rollback integral da venda (CT03)[cite: 14, 16].
  - **Lotes Atômicos e Idempotência:** O `SyncWorker` envia lotes de até 100 eventos em ordem FIFO. Se o lote falhar no meio (ex.: corte via Toxiproxy/Simulador), o servidor PostgreSQL faz rollback integral do lote e o PDV volta para `OperandoOffline` com a fila intacta (CT13)[cite: 13, 14, 17]. Se um lote já confirmado for reenviado, o servidor descarta duplicatas via `UUID v4` garantindo semântica *effectively-once* (RNF02.2, CT08)[cite: 8, 14, 17].
  - **Backoff Exponencial com Jitter:** Em caso de falha de rede, calcular o tempo da $n$-ésima retentativa pela equação exata do documento: $t_n = \min(2^{n-1}\text{s} + \xi_n, 60\text{s})$, onde $\xi_n \sim \mathcal{U}(0, 1\text{s})$[cite: 14, 15]. Eventos que falham 5 vezes seguidas por erro lógico vão para fila *Dead-Letter (Quarentena)* com alerta ao Gerente[cite: 14].
- **RF03 (Hub de Delivery iFood / Aiqfome):**
  - Recepção via Webhook/Polling normalizando para `PedidoDelivery`, descartando duplicatas pelo `codigoExterno` e fazendo retentativa a cada 60s em falhas HTTP 503 (CT06)[cite: 8, 17].
  - Simulação/validação de renovação automática de token OAuth 2.0 expirado e recusa de conexões com TLS < 1.3 (RNF03.2, CT07)[cite: 8, 17].
  - Alerta visual pop-up de alto contraste e alerta sonoro (Web Audio API beep sintetizado) ao chegar novo pedido (RNF03.4)[cite: 8].
- **RF04 (Aceite e Impressão Térmica na Cozinha — Sequência da Figura 3):**
  - Seguir o Diagrama de Sequência: `Receber()` -> `ExibirPopup()` -> `Aceitar()` -> instanciar `ped: PedidoDelivery` -> notificar API parceira -> instanciar objeto transitório `via: DocumentoImpressao` -> enviar comandos ESC/POS para `imp: Impressora` -> aguardar confirmação física -> desalocar/destruir `via: DocumentoImpressao` (`delete`) -> atualizar tela[cite: 12].
- **RF05 (Autenticação, RBAC e Estornos):**
  - Hashing de senha com `bcrypt` (custo $\ge 12$) ou implementação compatível verificável, cache local cifrado para login 100% offline em $< 1\text{s}$, bloqueio automático de sessão por inatividade após 30 minutos (com relógio injetável para teste) e mensagem de erro genérica em vermelho sem revelar qual campo falhou (RNF05.1 a RNF05.4, CT04, CT12)[cite: 8, 9, 16, 17].
- **Regras de Negócio e LGPD:**
  - **RN01:** Priorizar envio do lote de vendas locais ao reconectar sem bloquear o recebimento simultâneo de pedidos de delivery (CT08)[cite: 9, 17].
  - **RN02:** Estorno exige credencial de `Gerente`, não apaga a venda original e gera `EventoCompensatorio` vinculado ao UUID original + registro em log de auditoria imutável (CT02)[cite: 8, 9, 14, 16].
  - **RN03:** No aceite do delivery, a confirmação vai para a API parceira, mas o pedido SÓ assume status `"EM_PREPARO"` após confirmação física da impressora térmica. Se a impressora estiver sem papel, detecta em $\le 3\text{s}$, retém o status como `"PENDENTE_IMPRESSAO"` e mantém na fila de reimpressão (CT09, CT14)[cite: 8, 9, 17].
  - **RN04:** Se o operador fechar o caixa offline com vendas não sincronizadas na Outbox, emitir alerta de pendência, registrar ressalva no relatório de fechamento e preservar a fila para o próximo ciclo online (CT11)[cite: 9, 17].
  - **RE01 (LGPD):** Rotina de anonimização que mascara `nome`, `telefone` e `endereco` de clientes em pedidos com prazo legal vencido, preservando os valores fiscais e mantendo intactos os pedidos dentro do prazo (CT05)[cite: 9, 16].

---

# 4. INTERFACE GRÁFICA (FRONTEND) E PAINEL DE SIMULAÇÃO DE CAOS
Construa uma interface rica, intuitiva e responsiva em React + TypeScript + TailwindCSS contendo:

1. **Tela de Login (com troca rápida de credenciais para o avaliador):**
   - Botões de preenchimento rápido ("Preencher como Operador" e "Preencher como Gerente") além dos campos normais de usuário/senha, facilitando o teste do professor.
2. **Header Operacional:**
   - Nome do Restaurante Basílico, usuário logado + badge de perfil (`OPERADOR` ou `GERENTE`), status do Caixa (`ABERTO` / `FECHADO` + Saldo Local em R$), botão de simular 30 min de inatividade (bloqueio de sessão) e **Indicador Luminoso da Máquina de Estados** (Verde: `OperandoOnline` | Vermelho: `OperandoOffline` | Âmbar pulsante: `Sincronizando`)[cite: 8, 12, 13].
3. **Abas Principais de Operação (Atendendo Básico, Intermediário e Avançado):**
   - **Aba 1: Frente de Caixa (PDV Offline-First):** Catálogo de pratos e bebidas italianas do Restaurante Basílico (com CRUD completo para adicionar/editar produtos — requisito de Nível Intermediário)[cite: 3], carrinho persistente em tempo real (WAL)[cite: 8, 11], aplicação de desconto, escolha de pagamento (PIX, Crédito, Débito, Dinheiro) e finalização em $< 2\text{s}$ com emissão imediata do comprovante na bobina térmica virtual[cite: 8, 11].
   - **Aba 2: Hub Central de Delivery (iFood & Aiqfome):** Fila única de pedidos recebidos com badge da plataforma, timer de SLA, botões "Aceitar e Imprimir na Cozinha", "Reimprimir Via" (quando retido em `PENDENTE_IMPRESSAO` por falta de papel) e "Recusar Pedido"[cite: 8, 9, 12].
   - **Aba 3: Histórico de Vendas, Estornos (RBAC) e Caixa:** Lista de vendas presenciais (indicando se já foram sincronizadas com a nuvem ou se estão na fila local), botão "Solicitar Estorno" (que abre modal exigindo senha de Gerente e motivo se o usuário logado for Operador, gerando o Evento Compensatório visível na lista)[cite: 8, 9, 16], e botões de Abrir/Fechar Caixa (disparando o alerta da RN04 se houver itens pendentes na Outbox)[cite: 9].
   - **Aba 4: Inspetor Arquitetural (Outbox SQLite <-> PostgreSQL Nuvem, Logs & LGPD):** Visão lado a lado da tabela local `outbox_events` (SQLite) e da tabela remota `cloud_transactions` (PostgreSQL), botão para acionar a rotina de Anonimização LGPD (RE01) em pedidos antigos e tabela de `audit_logs` imutáveis[cite: 8, 9, 14].
4. **Bobina da Impressora Térmica Virtual ESC/POS (80mm):**
   - Componente visual estilizado como papel térmico amarelo-claro/branco monoespaçado exibindo a última via de cozinha ou cupom de venda impresso, além da fila de reimpressão e os bytes ESC/POS gerados[cite: 7, 8, 18].
5. **Painel Flutuante/Fixo "Laboratório de Caos & Simulação (ECOT11A)"**:
   - **Toggle Rede WAN:** `Online` <-> `Offline (Queda de Internet)`[cite: 13, 17].
   - **Toggle Impressora Térmica (Porta 9100/USB):** `Com Bobina (OK)` <-> `Sem Bobina de Papel (Erro ESC/POS)`[cite: 8, 17].
   - **Toggle Falha no Servidor Nuvem (Toxiproxy):** `Servidor Saudável` <-> `Cortar Rede no Meio do Lote (Rollback Parcial CT13)`[cite: 17].
   - **Botões de Injeção:** `+ Receber Pedido iFood`, `+ Receber Pedido Aiqfome`, `+ Injetar Pedido Duplicado (Teste Idempotência)`, `Simular Queda Elétrica (Reload com RPO=0)`[cite: 8, 17].

---

# 5. SUÍTE DE TESTES AUTOMATIZADOS (SEÇÃO 10 — CT01 A CT14)
Crie em `tests/sistema-basilico.spec.ts` (usando Vitest) testes automatizados reais, granulares e determinísticos nomeados exatamente conforme as Tabelas 8, 9 e 10 da Entrega 1[cite: 16, 17]:
- **Testes de Unidade (Tabela 8):**
  - `CT01`: Adicionar itens ao carrinho, aplicar desconto válido e calcular total em centavos inteiros sem erro de ponto flutuante em $< 2\text{s}$[cite: 16].
  - `CT02`: Invocar `autorizarEstorno()` com sessão de Operador (deve lançar exceção de permissão negada) e depois com Gerente (autoriza, grava motivo em log imutável e gera evento compensatório sem apagar venda original)[cite: 16].
  - `CT03`: Registrar venda e inspecionar fila `outbox` local (mesma transação ACID, sequência monotônica e UUID v4); forçar falha na gravação do evento e provar rollback integral da venda[cite: 16].
  - `CT04`: Autenticar com credenciais inválidas (mensagem genérica sem expor qual campo falhou); validar custo do hash $\ge 12$; simular 30 min de inatividade com relógio injetável e verificar bloqueio da sessão[cite: 16].
  - `CT05`: Executar rotina de anonimização LGPD sobre pedidos de clientes não fidelizados com prazo vencido e não vencido (anonimiza apenas vencidos, preserva totais fiscais)[cite: 16].
- **Testes de Integração (Tabela 9):**
  - `CT06`: Simular webhook/polling do iFood e Aiqfome; repetir o mesmo `codigoExterno` (descarta duplicata); injetar falha HTTP 503 (agenda retentativa em 60s e registra em log)[cite: 17].
  - `CT07`: Expirar token OAuth 2.0 durante ciclo de polling (renova automaticamente sem perder pedido); tentar conexão com TLS < 1.3 (recusa conexão)[cite: 17].
  - `CT08`: Sincronizar 500 eventos pendentes (5 lotes de 100), reenviar lote já confirmado (descartado por UUID) e receber pedido de delivery durante o envio sem bloqueio (RN01)[cite: 17].
  - `CT09`: Aceitar pedido de delivery com impressora virtual ESC/POS na porta 9100 (notifica API, imprime via em $\le 5\text{s}$, assume status `EM_PREPARO` somente após confirmação física e desaloca objeto temporário `Impressao`)[cite: 17].
  - `CT10`: Tentar abrir/ler o banco local sem a chave de cifragem AES-256 e com chave incorreta (acesso negado / conteúdo cifrado ilegível)[cite: 17].
- **Testes de Caos e Resiliência (Tabela 10):**
  - `CT11`: Desconectar rede durante registro de venda (transição para `OperandoOffline`), concluir venda offline, tentar fechar caixa offline (emite alerta de pendência RN04) e reconectar (sincronização automática para `OperandoOnline`)[cite: 13, 17].
  - `CT12`: Simular corte de energia com carrinho aberto (persistência WAL restaura carrinho com `RPO = 0` ao reiniciar) e autenticar sem internet via cache local cifrado em $< 1\text{s}$[cite: 8, 17].
  - `CT13`: Cortar conexão de rede no meio do estado `Sincronizando` (lote parcial via Toxiproxy/Simulador): transação remota sofre rollback completo, PDV retorna a `OperandoOffline` com fila intacta e reenvio posterior ocorre sem duplicidade[cite: 13, 14, 17].
  - `CT14`: Aceitar pedido de delivery com impressora térmica sem bobina de papel: falha detectada em $\le 3\text{s}$, status retido como `PENDENTE_IMPRESSAO` (RN03), alerta exibido e pedido mantido na fila de reimpressão[cite: 8, 9, 17].

---

# 6. PIPELINE CI/CD E GOVERNANÇA GIT (APÊNDICE 12.2)
1. Crie `.github/workflows/ci.yml` executando `npm ci`, `npm test` (Vitest) e `npm run build` em pushes e Pull Requests para `main` e `develop`[cite: 16, 18].
2. Inicialize o repositório Git local (`git init`), configure as branches `main` e `develop` conforme especificado no Apêndice 12.2[cite: 18] e deixe os commits organizados.

---

# 7. DOCUMENTAÇÃO `README.md` OBRIGATÓRIA (SEÇÃO 4 DO ROTEIRO)
Gere um `README.md` impecável, altamente didático e profissional na raiz do projeto contendo obrigatoriamente:
1. **Cabeçalho e Identificação Acadêmica:**
   - Nome do Projeto: **Sistema Basílico — PDV Offline-First & Hub de Delivery**[cite: 2, 4, 6]
   - Universidade Federal de Itajubá (UNIFEI) — Engenharia de Computação[cite: 1, 4]
   - Disciplina: ECOT11A / ECOT01 — Laboratório de Engenharia de Software I (Prof. Dr. Edvard)[cite: 1, 4]
   - Autor: **Matheus Gouveia Purcino** (Matrícula: `2024006907`)[cite: 2, 4]
2. **Breve Descrição da Proposta do Software:** Contexto do problema real do Restaurante Basílico (Pouso Alegre/MG) e como a arquitetura híbrida Offline-First resolve quedas de rede/energia e centraliza o delivery[cite: 2, 6].
3. **Quadro Demonstrativo dos Níveis de Complexidade (Mapeamento Direto do Roteiro):**
   - Tabela demonstrando exatamente onde e como cada requisito do **Nível Básico**, **Nível Intermediário** e **Nível Avançado** do roteiro da disciplina foi implementado no código e nas telas[cite: 2, 3].
4. **Roteiro Guiado de Homologação Rápida para o Professor (3 Minutos):**
   - Credenciais de acesso (`Operador` e `Gerente`) e um passo a passo numerado ensinando o avaliador a testar: (1) Venda online/offline, (2) Fechamento com alerta RN04, (3) Estorno com RBAC de Gerente (RN02), (4) Recebimento de pedido iFood/Aiqfome com impressora sem papel (RN03) e (5) Sincronização em lote Outbox SQLite -> PostgreSQL.
5. **Instruções Detalhadas de Compilação, Execução Local, Testes e Deploy:**
   - Pré-requisitos, comandos passo a passo (`npm install`, `npm run dev` para abrir no navegador, `npm run electron:dev` para abrir como app Desktop, `npm test` para rodar os 14 Casos de Teste CT01–CT14 e `npm run build`)[cite: 2, 16, 17].
   - Espaço destacado no topo para o Link Direto de Deploy Online (Vercel / Render / GitHub Pages) e instruções de 1 comando para publicar[cite: 2].
6. **Arquitetura e Matriz de Rastreabilidade dos Testes (CT01 a CT14):** Resumo da estrutura de pastas (`domain`, `application`, `infrastructure`, `presentation`, `addons`) e listagem dos 14 casos de teste verificados pelo Vitest[cite: 10, 14, 16, 17].

---

# 8. CRITÉRIO DE CONCLUSÃO (DEFINITION OF DONE)
Antes de encerrar sua execução no Antigravity:
1. Execute `npm install` para garantir que todas as dependências estão instaladas sem conflitos.
2. Execute `npm test` (ou `npx vitest run`) e corrija qualquer falha até que **todos os 14 Casos de Teste (CT01 a CT14) passem com 100% de sucesso**[cite: 16, 17].
3. Execute `npm run build` para comprovar que o TypeScript e o bundle Vite/React compilam sem nenhum erro de tipagem ou sintaxe.
4. Apresente um resumo final confirmando os testes aprovados e o comando para abrir a aplicação.
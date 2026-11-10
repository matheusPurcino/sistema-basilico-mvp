import { describe, expect, it } from 'vitest';
import {
  AutenticacaoError,
  DIA_MS,
  DocumentoImpressao,
  ItemVenda,
  MASCARAS_LGPD,
  MINUTO_MS,
  PedidoDelivery,
  PermissaoNegadaError,
  RelogioFixo,
  SessaoBloqueadaError,
  Venda,
  formatarBRL,
  isUuidV4,
  percentualDeCentavos,
  reaisParaCentavos,
  somarCentavos,
} from '../src/domain';
import {
  AcessoNegadoError,
  CREDENCIAIS_HOMOLOGACAO,
  ErroSegurancaTls,
  ESQUEMA_LOCAL,
  MemoryStorage,
  SQLiteEngine,
} from '../src/infrastructure';
import {
  BasilicoSystemFacade,
  CHAVE_AES_PADRAO_SISTEMA,
  calcularBackoffSegundos,
} from '../src/application';

describe('Suíte Oficial de Homologação — Sistema Basílico (ECOT11A / UNIFEI — CT01 a CT14)', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TESTES DE UNIDADE (TABELA 8 DA ENTREGA 1 — CT01 A CT05)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Testes de Unidade (Tabela 8)', () => {
    it('CT01: Adicionar itens ao carrinho, aplicar desconto válido e calcular total em centavos inteiros sem erro de ponto flutuante em < 2s', async () => {
      const inicio = performance.now();
      const sistema = await BasilicoSystemFacade.criar();
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);

      // Prova de que 0.1 + 0.2 em reais convertidos para centavos inteiros nunca gera dízima IEEE-754
      expect(somarCentavos([reaisParaCentavos('0,10'), reaisParaCentavos('0,20')])).toBe(30);
      expect(reaisParaCentavos('1.234,56')).toBe(123456);
      expect(formatarBRL(123456)).toBe('R$ 1.234,56');

      // Adiciona itens do catálogo do Restaurante Basílico e altera quantidades
      const catalogo = sistema.listarProdutos();
      const bruschetta = catalogo.find((p) => p.nome.includes('Bruschetta'))!; // 2890 centavos (R$ 28,90)
      const fettuccine = catalogo.find((p) => p.nome.includes('Fettuccine'))!; // 6490 centavos (R$ 64,90)

      await sistema.adicionarAoCarrinho(bruschetta.id, 2); // 2 * 2890 = 5780
      await sistema.adicionarAoCarrinho(fettuccine.id, 1); // 1 * 6490 = 6490
      expect(sistema.getCarrinho().getSubtotalCentavos()).toBe(12270);

      // Exercita alteração de quantidade, remoção, desconto percentual e CRUD de catálogo
      const temporario = sistema.cadastrarProduto({
        nome: 'Focaccia Rosmarino Teste',
        descricao: 'Focaccia de alecrim e flor de sal',
        categoria: 'ENTRADAS',
        precoCentavos: 1990,
        ativo: true,
      });
      await sistema.adicionarAoCarrinho(temporario.id, 1);
      await sistema.adicionarAoCarrinho(temporario.id, 1); // Soma no item existente do carrinho
      await sistema.alterarQuantidadeCarrinho(temporario.id, 3);
      await sistema.alterarQuantidadeCarrinho(temporario.id, 0); // Remove quando quantidade <= 0
      sistema.removerProduto(temporario.id);
      sistema.getCarrinho().aplicarDescontoPercentual(10);

      // Aplica desconto válido de R$ 12,70 (1270 centavos)
      await sistema.aplicarDescontoCarrinho(1270);
      expect(sistema.getCarrinho().getDescontoCentavos()).toBe(1270);
      expect(sistema.getCarrinho().getTotalCentavos()).toBe(11000);
      expect(Number.isSafeInteger(sistema.getCarrinho().getTotalCentavos())).toBe(true);

      // Preservação do preço histórico: alterar preço no catálogo após a venda não altera a venda registrada
      const resultado = await sistema.finalizarVendaCarrinho('PIX');
      sistema.atualizarProduto({ ...bruschetta, precoCentavos: 9999 });
      expect(resultado.venda.getItens()[0].getPrecoUnitarioCentavos()).toBe(2890);
      expect(resultado.venda.getValorTotalCentavos()).toBe(11000);
      expect(resultado.cupom).toContain('R$ 110,00');
      expect(percentualDeCentavos(10000, 10)).toBe(1000);

      const duracaoMs = performance.now() - inicio;
      expect(duracaoMs).toBeLessThan(2000);
    });

    it('CT02: Invocar autorizarEstorno() com sessão de Operador (exceção de permissão negada) e depois com Gerente (autoriza, grava em log imutável e gera evento compensatório sem apagar venda original)', async () => {
      const sistema = await BasilicoSystemFacade.criar();
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);

      const produto = sistema.listarProdutos()[0];
      await sistema.adicionarAoCarrinho(produto.id, 1);
      const { venda } = await sistema.finalizarVendaCarrinho('CREDITO');

      // 1) Sessão de Operador tentando estornar sem credencial de Gerente -> PermissaoNegadaError (RN02)
      await expect(
        sistema.autorizarEstornoVenda(venda.getIdVenda(), 'Cliente desistiu do prato'),
      ).rejects.toThrow(PermissaoNegadaError);
      expect(sistema.vendasRepo.buscar(venda.getIdVenda())?.isEstornada()).toBe(false);

      // 2) Sessão de Gerente autoriza o estorno (também testa elevação pontual de credencial de Gerente)
      const eventoViaCredencial = await sistema.autorizarEstornoVenda(
        venda.getIdVenda(),
        'Cobrança em duplicidade no cartão',
        {
          login: CREDENCIAIS_HOMOLOGACAO.gerente.login,
          senhaPura: CREDENCIAIS_HOMOLOGACAO.gerente.senhaPura,
        },
      );
      expect(isUuidV4(eventoViaCredencial.idEvento)).toBe(true);
      expect(eventoViaCredencial.idVendaOriginal).toBe(venda.getIdVenda());
      expect(eventoViaCredencial.valorEstornadoCentavos).toBe(venda.getValorTotalCentavos());
      expect(eventoViaCredencial.autorizadoPor).toBe('gerente');

      // Verifica que segundo estorno na mesma venda é rejeitado e login direto de Gerente também funciona
      sistema.logout();
      sistema.login(CREDENCIAIS_HOMOLOGACAO.gerente.login, CREDENCIAIS_HOMOLOGACAO.gerente.senhaPura);
      await expect(
        sistema.autorizarEstornoVenda(venda.getIdVenda(), 'Tentativa duplicada'),
      ).rejects.toThrow(/já foi estornada/);

      // Venda original NÃO é apagada (RN02), apenas marcada como estornada
      const vendaPersistida = sistema.vendasRepo.buscar(venda.getIdVenda());
      expect(vendaPersistida).toBeDefined();
      expect(vendaPersistida?.isEstornada()).toBe(true);
      expect(sistema.vendasRepo.listarEventosCompensatorios()).toHaveLength(1);

      // Log de auditoria foi gravado e é IMUTÁVEL (triggers SQLite impedem UPDATE e DELETE)
      const logsEstorno = sistema.auditRepo.listar().filter((l) => l.acao === 'ESTORNO_AUTORIZADO_RN02');
      expect(logsEstorno).toHaveLength(1);
      expect(logsEstorno[0].detalhes).toContain('Cobrança em duplicidade no cartão');
      expect(() => sistema.db.executar(`DELETE FROM audit_logs WHERE id = ?`, [logsEstorno[0].id])).toThrow(
        /audit_logs é imutável/,
      );
      expect(() => sistema.db.executar(`UPDATE audit_logs SET detalhes = 'adulterado'`)).toThrow(
        /audit_logs é imutável/,
      );
      expect(() => sistema.db.executar(`DELETE FROM vendas WHERE id_venda = ?`, [venda.getIdVenda()])).toThrow(
        /vendas não podem ser apagadas/,
      );
    });

    it('CT03: Registrar venda e inspecionar fila outbox local (mesma transação ACID, sequência monotônica e UUID v4); forçar falha na gravação do evento e provar rollback integral da venda', async () => {
      const sistema = await BasilicoSystemFacade.criar();
      await sistema.definirConectividadeWan(false); // Mantém eventos na Outbox local para inspeção
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);

      const p1 = sistema.listarProdutos()[0];
      await sistema.adicionarAoCarrinho(p1.id, 1);
      const r1 = await sistema.finalizarVendaCarrinho('DINHEIRO');

      await sistema.adicionarAoCarrinho(p1.id, 2);
      const r2 = await sistema.finalizarVendaCarrinho('DEBITO');

      const fila = sistema.outboxRepo.proximoLote(10);
      expect(fila).toHaveLength(2);
      expect(fila[0].seq).toBe(r1.seqOutbox);
      expect(fila[1].seq).toBe(r2.seqOutbox);
      expect(fila[1].seq).toBeGreaterThan(fila[0].seq);
      expect(isUuidV4(fila[0].idEvento)).toBe(true);
      expect(isUuidV4(fila[1].idEvento)).toBe(true);
      expect(fila[0].agregadoId).toBe(r1.venda.getIdVenda());
      expect(fila[0].status).toBe('PENDENTE');

      // Força falha na gravação da Outbox e prova ROLLBACK integral da venda (ACID)
      const totalVendasAntes = sistema.vendasRepo.contar();
      const saldoAntes = sistema.caixa.getSaldoLocalCentavos();
      sistema.outboxRepo.definirFalhaForcada(true);

      await sistema.adicionarAoCarrinho(p1.id, 3);
      await expect(sistema.finalizarVendaCarrinho('PIX')).rejects.toThrow(/Falha simulada ao gravar evento/);

      sistema.outboxRepo.definirFalhaForcada(false);
      expect(sistema.vendasRepo.contar()).toBe(totalVendasAntes);
      expect(sistema.outboxRepo.contarPendentes()).toBe(2);
      expect(sistema.caixa.getSaldoLocalCentavos()).toBe(saldoAntes);
    });

    it('CT04: Autenticar com credenciais inválidas (mensagem genérica sem expor qual campo falhou); validar custo do hash >= 12; simular 30 min de inatividade com relógio injetável e verificar bloqueio da sessão', async () => {
      const relogio = new RelogioFixo('2026-05-10T14:00:00.000Z');
      const sistema = await BasilicoSystemFacade.criar({ relogio });

      // 1) Mensagem idêntica e genérica tanto para usuário inexistente quanto para senha incorreta (RNF05.4)
      let msgUsuarioInexistente = '';
      let msgSenhaIncorreta = '';
      try {
        sistema.login('usuario_que_nao_existe', 'Qualquer@123');
      } catch (e) {
        msgUsuarioInexistente = (e as Error).message;
      }
      try {
        sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, 'SenhaErrada@999');
      } catch (e) {
        msgSenhaIncorreta = (e as Error).message;
      }

      expect(msgUsuarioInexistente).toBe(AutenticacaoError.MENSAGEM_GENERICA);
      expect(msgSenhaIncorreta).toBe(AutenticacaoError.MENSAGEM_GENERICA);
      expect(msgUsuarioInexistente.toLowerCase()).not.toContain('usuário');
      expect(msgSenhaIncorreta.toLowerCase()).not.toContain('senha');

      // 2) Validação de custo bcrypt >= 12 (RNF05.1)
      const todosUsuarios = sistema.usuariosRepo.buscarTodos();
      for (const u of todosUsuarios) {
        expect(sistema.hasher.extrairCusto(u.getSenhaHash())).toBeGreaterThanOrEqual(12);
      }
      expect(() => sistema.hasher.gerarHash('SenhaForte@123', 10)).toThrow(/custo do bcrypt deve ser >= 12/);

      // 3) Login válido + avanço de 30 minutos no relógio injetável -> bloqueio automático (RNF05.3)
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
      expect(sistema.auth.getUsuarioAtual()?.estaAutenticado()).toBe(true);

      relogio.avancar(29 * MINUTO_MS);
      expect(sistema.auth.isBloqueadaPorInatividade()).toBe(false);

      // Sem registrar atividade, mais 2 minutos completam 31 min >= 30 min
      relogio.avancar(2 * MINUTO_MS);
      expect(sistema.auth.isBloqueadaPorInatividade()).toBe(true);
      expect(sistema.auth.getUsuarioAtual()).toBeNull();
      expect(() => sistema.auth.exigirSessaoAtiva()).toThrow(SessaoBloqueadaError);
    });

    it('CT05: Executar rotina de anonimização LGPD sobre pedidos de clientes não fidelizados com prazo vencido e não vencido (anonimiza apenas vencidos, preserva totais fiscais)', async () => {
      const relogio = new RelogioFixo('2026-06-01T12:00:00.000Z');
      const sistema = await BasilicoSystemFacade.criar({ relogio, popularSeed: false });

      // Pedido 1: Cliente não fidelizado com prazo vencido (200 dias atrás > 180 dias)
      const pedidoVencido = new PedidoDelivery({
        codigoExterno: 'IFOOD-VENC-01',
        plataforma: 'IFOOD',
        clienteNome: 'João da Silva Antigo',
        clienteTelefone: '(35) 99111-0000',
        clienteEndereco: 'Rua das Flores, 100 - Pouso Alegre/MG',
        itens: [new ItemVenda(1, 'Lasagna Bolognese', 2, 5990)],
        dataCriacao: new Date(relogio.agora().getTime() - 200 * DIA_MS),
      });
      sistema.pedidosRepo.inserir(pedidoVencido);

      // Pedido 2: Cliente não fidelizado dentro do prazo legal (15 dias atrás <= 180 dias)
      const pedidoRecente = new PedidoDelivery({
        codigoExterno: 'AIQ-REC-02',
        plataforma: 'AIQFOME',
        clienteNome: 'Maria Oliveira Recente',
        clienteTelefone: '(35) 99222-0000',
        clienteEndereco: 'Av. Lisboa, 250 - Pouso Alegre/MG',
        itens: [new ItemVenda(2, 'Risotto ai Funghi', 1, 6890)],
        dataCriacao: new Date(relogio.agora().getTime() - 15 * DIA_MS),
      });
      sistema.pedidosRepo.inserir(pedidoRecente);

      // Pedido 3: Cliente FIDELIZADO mesmo antigo (consentimento ativo -> preservado)
      sistema.registrarTelefoneFidelizado('(35) 99333-9999');
      const pedidoFidelizado = new PedidoDelivery({
        codigoExterno: 'IFOOD-FID-03',
        plataforma: 'IFOOD',
        clienteNome: 'Cliente VIP Fidelizado',
        clienteTelefone: '(35) 99333-9999',
        clienteEndereco: 'Praça Senador José Bento, 10',
        itens: [new ItemVenda(3, 'Pizza Margherita', 1, 6200)],
        dataCriacao: new Date(relogio.agora().getTime() - 240 * DIA_MS),
      });
      sistema.pedidosRepo.inserir(pedidoFidelizado);

      const relatorio = sistema.executarRotinaAnonimizacaoLgpd(180);
      expect(relatorio.avaliados).toBe(3);
      expect(relatorio.anonimizados).toBe(1);
      expect(relatorio.preservadosPrazoVigente).toBe(1);
      expect(relatorio.preservadosFidelizados).toBe(1);

      const vencidoPos = sistema.pedidosRepo.buscar(pedidoVencido.getIdInterno())!;
      expect(vencidoPos.isAnonimizadoLgpd()).toBe(true);
      expect(vencidoPos.getClienteNome()).toBe(MASCARAS_LGPD.nome);
      expect(vencidoPos.getClienteTelefone()).toBe(MASCARAS_LGPD.telefone);
      expect(vencidoPos.getClienteEndereco()).toBe(MASCARAS_LGPD.endereco);
      // Valor fiscal em centavos permanece 100% preservado (RE01)
      expect(vencidoPos.getValorTotalCentavos()).toBe(11980);

      const recentePos = sistema.pedidosRepo.buscar(pedidoRecente.getIdInterno())!;
      expect(recentePos.isAnonimizadoLgpd()).toBe(false);
      expect(recentePos.getClienteNome()).toBe('Maria Oliveira Recente');
      expect(recentePos.getValorTotalCentavos()).toBe(6890);

      const fidelizadoPos = sistema.pedidosRepo.buscar(pedidoFidelizado.getIdInterno())!;
      expect(fidelizadoPos.isAnonimizadoLgpd()).toBe(false);
      expect(fidelizadoPos.getClienteNome()).toBe('Cliente VIP Fidelizado');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TESTES DE INTEGRAÇÃO (TABELA 9 DA ENTREGA 1 — CT06 A CT10)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Testes de Integração (Tabela 9)', () => {
    it('CT06: Simular webhook/polling do iFood e Aiqfome; repetir o mesmo codigoExterno (descarta duplicata); injetar falha HTTP 503 (agenda retentativa em 60s e registra em log)', async () => {
      const sistema = await BasilicoSystemFacade.criar({ popularSeed: false });

      // 1) Recepção normal no iFood e no Aiqfome
      const rIfood = sistema.receberPedidoDelivery('IFOOD', {
        codigoExterno: 'IFOOD-7701',
        cliente: { nome: 'Lucas Andrade', telefone: '(35) 99100-1122', endereco: 'Rua A, 10' },
        itens: [{ nome: 'Gnocchi alla Sorrentina', quantidade: 1, precoUnitarioReais: 54.9 }],
      });
      expect(rIfood.status).toBe('ACEITO_FILA');
      expect(rIfood.pedido?.getValorTotalCentavos()).toBe(5490);

      sistema.aiqfomeAdapter.enfileirarNoServidorParceiro({
        codigoExterno: 'AIQ-5501',
        cliente: { nome: 'Fernanda Lima', telefone: '(35) 99200-3344', endereco: 'Rua B, 20' },
        itens: [{ nome: 'Cannoli Siciliani', quantidade: 2, precoUnitarioCentavos: 2990 }],
      });
      const rPollingAiq = sistema.aiqfomeAdapter.executarCicloPolling();
      expect(rPollingAiq).toHaveLength(1);
      expect(rPollingAiq[0].status).toBe('ACEITO_FILA');
      expect(rPollingAiq[0].pedido?.getValorTotalCentavos()).toBe(5980);

      // 2) Repetição do mesmo codigoExterno -> descartado por idempotência
      const rDuplicado = sistema.receberPedidoDelivery('IFOOD', {
        codigoExterno: 'IFOOD-7701',
        cliente: { nome: 'Lucas Andrade', telefone: '(35) 99100-1122', endereco: 'Rua A, 10' },
        itens: [{ nome: 'Gnocchi alla Sorrentina', quantidade: 1, precoUnitarioReais: 54.9 }],
      });
      expect(rDuplicado.status).toBe('DUPLICATA_DESCARTADA');
      expect(sistema.pedidosRepo.listar()).toHaveLength(2);

      // 3) Falha HTTP 503 -> agenda retentativa para 60s e registra em audit_logs
      sistema.ifoodAdapter.definirHttp503(true);
      const r503 = sistema.ifoodAdapter.executarCicloPolling();
      expect(r503[0].status).toBe('RETENTATIVA_AGENDADA_503');
      expect(r503[0].retentativa?.intervaloSegundos).toBe(60);

      const logs503 = sistema.auditRepo.listar().filter((l) => l.acao === 'DELIVERY_HTTP_503_RETRY_60S');
      expect(logs503.length).toBeGreaterThanOrEqual(1);
    });

    it('CT07: Expirar token OAuth 2.0 durante ciclo de polling (renova automaticamente sem perder pedido); tentar conexão com TLS < 1.3 (recusa conexão)', async () => {
      const sistema = await BasilicoSystemFacade.criar({ popularSeed: false });

      // 1) Expira o token OAuth 2.0 antes do ciclo de polling
      const tokenAntes = sistema.ifoodAdapter.getTokenOAuth().accessToken;
      sistema.ifoodAdapter.expirarTokenOAuth();
      sistema.ifoodAdapter.enfileirarNoServidorParceiro({
        codigoExterno: 'IFOOD-OAUTH-99',
        cliente: { nome: 'Patrícia Gomes', telefone: '(35) 99444-5566', endereco: 'Av. Centro, 99' },
        itens: [{ nome: 'Tiramisù Classico', quantidade: 1, precoUnitarioCentavos: 3190 }],
      });

      const resultados = sistema.ifoodAdapter.executarCicloPolling();
      expect(resultados).toHaveLength(1);
      expect(resultados[0].tokenRenovado).toBe(true);
      expect(resultados[0].status).toBe('ACEITO_FILA');
      expect(sistema.ifoodAdapter.getTokenOAuth().renovacoes).toBe(1);
      expect(sistema.ifoodAdapter.getTokenOAuth().accessToken).not.toBe(tokenAntes);

      // 2) Tentativa de conexão com TLS < 1.3 (ex.: TLSv1.2) -> recusada imediatamente (RNF03.2)
      sistema.ifoodAdapter.configurarVersaoTls('TLSv1.2');
      expect(() => sistema.ifoodAdapter.executarCicloPolling()).toThrow(ErroSegurancaTls);
      expect(() =>
        sistema.receberPedidoDelivery('IFOOD', {
          codigoExterno: 'IFOOD-TLS-FAIL',
          cliente: { nome: 'Teste TLS', telefone: '00', endereco: 'Rua X' },
          itens: [{ nome: 'Item', quantidade: 1, precoUnitarioCentavos: 1000 }],
        }),
      ).toThrow(/Exigido TLS 1.3/);
    });

    it('CT08: Sincronizar 500 eventos pendentes (5 lotes de 100), reenviar lote já confirmado (descartado por UUID) e receber pedido de delivery durante o envio sem bloqueio (RN01)', async () => {
      const sistema = await BasilicoSystemFacade.criar({ popularSeed: false });
      await sistema.definirConectividadeWan(false);

      // Valida a equação exata de Backoff Exponencial com Jitter: t_n = min(2^(n-1) + xi_n, 60)
      expect(calcularBackoffSegundos(1, () => 0.25)).toBeCloseTo(1.25, 5);
      expect(calcularBackoffSegundos(4, () => 0.5)).toBeCloseTo(8.5, 5);
      expect(calcularBackoffSegundos(10, () => 0.9)).toBe(60);

      // Enfileira 500 eventos na Outbox local em uma transação rápida
      sistema.db.transacao(() => {
        for (let i = 1; i <= 500; i++) {
          const v = new Venda(i, new Date());
          v.adicionarItem(new ItemVenda(1, 'Espresso Italiano', 1, 900));
          v.registrarPagamento('PIX');
          sistema.outboxRepo.registrar({
            idEvento: v.getIdVenda(),
            tipo: 'VENDA_REGISTRADA',
            agregadoId: v.getIdVenda(),
            payload: { seq: i, valor: 900 },
            criadoEm: new Date().toISOString(),
          });
        }
      });
      expect(sistema.outboxRepo.contarPendentes()).toBe(500);

      // Sincroniza os 500 eventos (5 lotes de 100) injetando um pedido de delivery no meio do lote #3 (RN01)
      let pedidoRecebidoDuranteSync = false;
      const rel = await sistema.syncWorker.sincronizarTudo((indiceLote) => {
        if (indiceLote === 3) {
          const resDelivery = sistema.receberPedidoDelivery('AIQFOME', {
            codigoExterno: 'AIQ-CONCORRENTE-RN01',
            cliente: { nome: 'Cliente Simultâneo', telefone: '(35) 99000-1111', endereco: 'Rua RN01, 50' },
            itens: [{ nome: 'Pizza Diavola', quantidade: 1, precoUnitarioCentavos: 7190 }],
          });
          pedidoRecebidoDuranteSync = resDelivery.status === 'ACEITO_FILA';
        }
      });

      expect(rel.sucesso).toBe(true);
      expect(rel.lotesEnviados).toBe(5);
      expect(rel.eventosConfirmados).toBe(500);
      expect(rel.eventosInseridosNuvem).toBe(500);
      expect(sistema.outboxRepo.contarPendentes()).toBe(0);
      expect(sistema.nuvem.contar()).toBe(500);
      expect(pedidoRecebidoDuranteSync).toBe(true);

      // Reenvia o último lote de 100 eventos já confirmados -> 100% descartados por UUID v4 (RNF02.2)
      const reenvio = await sistema.syncWorker.reenviarUltimoLoteConfirmado();
      expect(reenvio.enviados).toBe(100);
      expect(reenvio.inseridos).toBe(0);
      expect(reenvio.duplicadosDescartados).toBe(100);
      expect(sistema.nuvem.contar()).toBe(500);

      // Verifica fila Dead-Letter (Quarentena) após 5 falhas lógicas seguidas (Seção 7.3)
      const vInvalida = new Venda(999, new Date());
      vInvalida.adicionarItem(new ItemVenda(1, 'Item Corrompido', 1, 500));
      vInvalida.registrarPagamento('PIX');
      sistema.outboxRepo.registrar({
        idEvento: vInvalida.getIdVenda(),
        tipo: 'VENDA_REGISTRADA',
        agregadoId: vInvalida.getIdVenda(),
        payload: { erro: true },
        criadoEm: new Date().toISOString(),
      });
      sistema.nuvem.marcarEventoComErroLogico(vInvalida.getIdVenda());
      for (let t = 1; t <= 5; t++) {
        await sistema.syncWorker.sincronizarTudo();
      }
      expect(sistema.outboxRepo.listarDeadLetter()).toHaveLength(1);
      expect(sistema.syncWorker.getAlertasDeadLetter().length).toBeGreaterThanOrEqual(1);
      sistema.nuvem.limparErrosLogicos();
    });

    it('CT09: Aceitar pedido de delivery com impressora virtual ESC/POS na porta 9100 (notifica API, imprime via em <= 5s, assume status EM_PREPARO somente após confirmação física e desaloca objeto temporário Impressao)', async () => {
      const sistema = await BasilicoSystemFacade.criar();
      const pedidosRecebidos = sistema.pedidosRepo.listar().filter((p) => p.getStatus() === 'RECEBIDO');
      const alvo = pedidosRecebidos[0];
      expect(alvo).toBeDefined();

      const vivasAntes = DocumentoImpressao.instanciasVivas();
      const criadasAntes = DocumentoImpressao.instanciasCriadas();

      const resultado = sistema.aceitarPedidoDelivery(alvo.getIdInterno());

      expect(resultado.parceiroNotificado).toBe(true);
      expect(resultado.impressoComSucesso).toBe(true);
      expect(resultado.tempoImpressaoMs).toBeLessThanOrEqual(5000);
      expect(resultado.pedido.getStatus()).toBe('EM_PREPARO');
      expect(sistema.ifoodAdapter.getConfirmacoesParceiro().length).toBeGreaterThanOrEqual(1);

      // Comprova que `via: DocumentoImpressao` foi instanciado e destruído (`delete via`) após a confirmação física
      expect(DocumentoImpressao.instanciasCriadas()).toBe(criadasAntes + 1);
      expect(DocumentoImpressao.instanciasVivas()).toBe(vivasAntes);

      // Verifica os comandos binários ESC/POS gerados na bobina térmica de 80mm
      const job = sistema.impressora.obterUltimaImpressao();
      expect(job).not.toBeNull();
      expect(job!.bytesEscPos[0]).toBe(0x1b); // ESC
      expect(job!.bytesEscPos[1]).toBe(0x40); // @ (Initialize printer)
      expect(job!.linhasRenderizadas.join('\n')).toContain(alvo.getCodigoExterno());
      expect(sistema.impressora.listarHistorico().length).toBeGreaterThanOrEqual(1);

      // Conclui o pedido em preparo e exercita recusa e injeção simulada em outro pedido
      const concluido = sistema.concluirPedidoDelivery(alvo.getIdInterno());
      expect(concluido.getStatus()).toBe('CONCLUIDO');
      const injetado = sistema.injetarPedidoSimulado('IFOOD', false);
      expect(injetado.status).toBe('ACEITO_FILA');
      expect(sistema.getUltimoPedidoPopup()?.getIdInterno()).toBe(injetado.pedido?.getIdInterno());
      sistema.dispensarPopupDelivery();
      const recusado = sistema.recusarPedidoDelivery(injetado.pedido!.getIdInterno(), 'Forno em manutenção');
      expect(recusado.getStatus()).toBe('RECUSADO');
      expect(recusado.getMotivoRecusa()).toBe('Forno em manutenção');
    });

    it('CT10: Tentar abrir/ler o banco local sem a chave de cifragem AES-256 e com chave incorreta (acesso negado / conteúdo cifrado ilegível)', async () => {
      const storage = new MemoryStorage();
      const sistema = await BasilicoSystemFacade.criar({
        storage,
        nomeBanco: 'cofre.pdv',
        chaveCifragem: CHAVE_AES_PADRAO_SISTEMA,
      });
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
      await sistema.adicionarAoCarrinho(sistema.listarProdutos()[0].id, 1);
      await sistema.finalizarVendaCarrinho('PIX');
      await sistema.db.checkpoint();
      sistema.db.fechar();

      // 1) Inspeciona o blob bruto gravado no storage: não pode conter texto plano legível do SQLite
      const blobBruto = storage.getItem('cofre.pdv.db')!;
      expect(blobBruto).toBeTruthy();
      const bytesDecodificados = new TextDecoder().decode(
        Uint8Array.from(atob(blobBruto), (c) => c.charCodeAt(0)),
      );
      expect(bytesDecodificados).not.toContain('SQLite format 3');
      expect(bytesDecodificados).not.toContain('Bruschetta');

      // 2) Tentar abrir sem chave -> AcessoNegadoError
      await expect(
        SQLiteEngine.abrir({
          nome: 'cofre.pdv',
          storage,
          chave: '',
          esquema: ESQUEMA_LOCAL,
        }),
      ).rejects.toThrow(AcessoNegadoError);

      // 3) Tentar abrir com chave incorreta -> AcessoNegadoError (falha de autenticação GCM)
      await expect(
        SQLiteEngine.abrir({
          nome: 'cofre.pdv',
          storage,
          chave: 'CHAVE-ERRADA-INVASOR-000',
          esquema: ESQUEMA_LOCAL,
        }),
      ).rejects.toThrow(AcessoNegadoError);

      // 4) Com a chave correta abre normalmente e preserva os dados
      const reaberto = await SQLiteEngine.abrir({
        nome: 'cofre.pdv',
        storage,
        chave: CHAVE_AES_PADRAO_SISTEMA,
        esquema: ESQUEMA_LOCAL,
      });
      expect(reaberto.consultar(`SELECT * FROM vendas`)).toHaveLength(1);
      reaberto.fechar();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TESTES DE CAOS E RESILIÊNCIA (TABELA 10 DA ENTREGA 1 — CT11 A CT14)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Testes de Caos e Resiliência (Tabela 10)', () => {
    it('CT11: Desconectar rede durante registro de venda (transição para OperandoOffline), concluir venda offline, tentar fechar caixa offline (emite alerta de pendência RN04) e reconectar (sincronização automática para OperandoOnline)', async () => {
      const sistema = await BasilicoSystemFacade.criar();
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
      expect(sistema.caixa.getEstadoMaquina()).toBe('OperandoOnline');

      // 1) Queda de conexão WAN durante operação -> OperandoOffline (AguardandoVendaOffline)
      await sistema.definirConectividadeWan(false);
      expect(sistema.caixa.getEstadoMaquina()).toBe('OperandoOffline');
      expect(sistema.caixa.getSubEstadoOffline()).toBe('AguardandoVendaOffline');

      // 2) Conclui venda 100% offline
      const p = sistema.listarProdutos()[1];
      await sistema.adicionarAoCarrinho(p.id, 2);
      const vendaOffline = await sistema.finalizarVendaCarrinho('DINHEIRO');
      expect(vendaOffline.sincronizadaImediatamente).toBe(false);
      expect(sistema.outboxRepo.contarPendentes()).toBe(1);
      expect(sistema.caixa.getHistoricoEstados().some((h) => h.para === 'OperandoOffline.GravandoLocal')).toBe(true);

      // 3) Fecha o caixa offline com vendas pendentes na Outbox -> emite alerta RN04 e preserva fila
      const relatorioFechamento = sistema.fecharCaixa();
      expect(relatorioFechamento.modo).toBe('OFFLINE');
      expect(relatorioFechamento.alertaPendencia).toBe(true);
      expect(relatorioFechamento.pendenciasOutbox).toBe(1);
      expect(relatorioFechamento.ressalvas.join(' ')).toContain('RN04');
      expect(sistema.outboxRepo.contarPendentes()).toBe(1);

      // 4) Reconecta a internet -> sincroniza automaticamente a Outbox e retorna para OperandoOnline
      const relSync = await sistema.definirConectividadeWan(true);
      expect(relSync?.sucesso).toBe(true);
      expect(sistema.caixa.getEstadoMaquina()).toBe('OperandoOnline');
      expect(sistema.outboxRepo.contarPendentes()).toBe(0);
      expect(sistema.nuvem.possuiEvento(sistema.outboxRepo.listar()[0].idEvento)).toBe(true);

      // Reabre o caixa para novo turno e verifica estatísticas do SQLite e relatórios
      sistema.abrirCaixa(30000);
      expect(sistema.caixa.isAberto()).toBe(true);
      expect(sistema.caixa.getSaldoInicialCentavos()).toBe(30000);
      expect(sistema.caixaRepo.listarFechamentos()).toHaveLength(1);
      expect(sistema.db.estatisticas().modoJournal).toContain('WAL');
    });

    it('CT12: Simular corte de energia com carrinho aberto (persistência WAL restaura carrinho com RPO = 0 ao reiniciar) e autenticar sem internet via cache local cifrado em < 1s', async () => {
      const storage = new MemoryStorage();
      const sistemaAntesQueda = await BasilicoSystemFacade.criar({ storage, nomeBanco: 'energia.pdv' });
      sistemaAntesQueda.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);

      const catalogo = sistemaAntesQueda.listarProdutos();
      await sistemaAntesQueda.adicionarAoCarrinho(catalogo[0].id, 2);
      await sistemaAntesQueda.adicionarAoCarrinho(catalogo[4].id, 1);
      await sistemaAntesQueda.aplicarDescontoCarrinho(500);

      const totalEsperado = sistemaAntesQueda.getCarrinho().getTotalCentavos();
      const qtdEsperada = sistemaAntesQueda.getCarrinho().getQuantidadeItens();

      // Simula queda abrupta de energia e reinicialização a frio (RPO = 0, RTO <= 2 min)
      const inicioRto = performance.now();
      const sistemaPosQueda = await sistemaAntesQueda.simularQuedaEletricaEReiniciar();
      const rtoMs = performance.now() - inicioRto;

      expect(rtoMs).toBeLessThan(120_000); // RTO <= 2 min
      expect(sistemaPosQueda.getCarrinho().estaVazio()).toBe(false);
      expect(sistemaPosQueda.getCarrinho().getQuantidadeItens()).toBe(qtdEsperada);
      expect(sistemaPosQueda.getCarrinho().getTotalCentavos()).toBe(totalEsperado);
      expect(sistemaPosQueda.getCarrinho().getDescontoCentavos()).toBe(500);

      // Autenticação 100% offline via cache local cifrado em < 1s (RNF05.2)
      await sistemaPosQueda.definirConectividadeWan(false);
      const inicioLogin = performance.now();
      const usuarioLogado = sistemaPosQueda.login(
        CREDENCIAIS_HOMOLOGACAO.gerente.login,
        CREDENCIAIS_HOMOLOGACAO.gerente.senhaPura,
      );
      const tempoLoginMs = performance.now() - inicioLogin;

      expect(usuarioLogado.estaAutenticado()).toBe(true);
      expect(usuarioLogado.getPapel()).toBe('GERENTE');
      expect(tempoLoginMs).toBeLessThan(1000);
    });

    it('CT13: Cortar conexão de rede no meio do estado Sincronizando (lote parcial via Toxiproxy/Simulador): transação remota sofre rollback completo, PDV retorna a OperandoOffline com fila intacta e reenvio posterior ocorre sem duplicidade', async () => {
      const sistema = await BasilicoSystemFacade.criar();
      sistema.login(CREDENCIAIS_HOMOLOGACAO.operador.login, CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
      await sistema.definirConectividadeWan(false);

      // Registra 4 vendas locais enquanto offline
      const prato = sistema.listarProdutos()[0];
      for (let i = 0; i < 4; i++) {
        await sistema.adicionarAoCarrinho(prato.id, 1);
        await sistema.finalizarVendaCarrinho('PIX');
      }
      expect(sistema.outboxRepo.contarPendentes()).toBe(4);
      expect(sistema.nuvem.contar()).toBe(0);

      // Ativa o Toxiproxy para cortar a conexão exatamente no meio do envio do lote
      sistema.nuvem.definirCorteMeioDoLote(true);
      const relFalha = await sistema.definirConectividadeWan(true);

      // O lote parcial sofreu ROLLBACK integral no PostgreSQL e o PDV voltou para OperandoOffline
      expect(relFalha?.sucesso).toBe(false);
      expect(sistema.nuvem.contar()).toBe(0);
      expect(sistema.nuvem.estatisticas().rollbacksRealizados).toBe(1);
      expect(sistema.caixa.getEstadoMaquina()).toBe('OperandoOffline');
      expect(sistema.outboxRepo.contarPendentes()).toBe(4);

      // Desativa o corte no Toxiproxy e sincroniza novamente: todos os 4 eventos chegam sem duplicidade
      sistema.nuvem.definirCorteMeioDoLote(false);
      const relSucesso = await sistema.definirConectividadeWan(true);
      expect(relSucesso?.sucesso).toBe(true);
      expect(sistema.caixa.getEstadoMaquina()).toBe('OperandoOnline');
      expect(sistema.outboxRepo.contarPendentes()).toBe(0);
      expect(sistema.nuvem.contar()).toBe(4);
    });

    it('CT14: Aceitar pedido de delivery com impressora térmica sem bobina de papel: falha detectada em <= 3s, status retido como PENDENTE_IMPRESSAO (RN03), alerta exibido e pedido mantido na fila de reimpressão', async () => {
      const sistema = await BasilicoSystemFacade.criar();
      const pedido = sistema.pedidosRepo.listar().find((p) => p.getStatus() === 'RECEBIDO')!;
      expect(pedido).toBeDefined();

      // Remove a bobina de papel da impressora térmica (Caos na porta 9100)
      sistema.impressora.definirBobinaPresente(false);
      const resultadoSemPapel = sistema.aceitarPedidoDelivery(pedido.getIdInterno());

      expect(resultadoSemPapel.impressoComSucesso).toBe(false);
      expect(resultadoSemPapel.parceiroNotificado).toBe(true);
      expect(resultadoSemPapel.tempoImpressaoMs).toBeLessThanOrEqual(3000);
      expect(resultadoSemPapel.pedido.getStatus()).toBe('PENDENTE_IMPRESSAO');
      expect(resultadoSemPapel.alertaErroImpressao).toContain('RN03');
      expect(sistema.getFilaReimpressao().map((p) => p.getIdInterno())).toContain(pedido.getIdInterno());

      // Repõe a bobina de papel e aciona a reimpressão da via de cozinha -> assume EM_PREPARO
      sistema.impressora.definirBobinaPresente(true);
      const resultadoReimpressao = sistema.reimprimirViaCozinha(pedido.getIdInterno());

      expect(resultadoReimpressao.impressoComSucesso).toBe(true);
      expect(resultadoReimpressao.pedido.getStatus()).toBe('EM_PREPARO');
      expect(sistema.getFilaReimpressao().map((p) => p.getIdInterno())).not.toContain(pedido.getIdInterno());
    });
  });
});

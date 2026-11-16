# ROLE & OBJECTIVE
Você é um Lead UX/UI Designer especializado em sistemas SaaS gastronômicos de alta performance (Toast, Square, KDS) e Engenheiro Sênior React/TypeScript. 

O Sistema Basílico está funcionalmente completo, com os 14 testes automatizados (`CT01` a `CT14`) passando perfeitamente. Seu objetivo agora é realizar a **Revisão Visual Definitiva, Faxina de UI e Auditoria Geral do Código** para entregar a versão final, polida e pronta para nota máxima.

Execute as seguintes frentes sem deixar nenhum placeholder (`// TODO`):

---

# 1. CORREÇÕES DE BUGS VISUAIS E UX NAS TELAS (CONFORME FEEDBACK REAL)

1. **Limpeza do Bloco da Impressora Térmica (`ThermalPrinterDrawer.tsx`):**
   - **O problema atual:** O bloco técnico de bytes ESC/POS em hexadecimal (`0x1B Ver Bytes ESC/POS...`) fica exposto de forma agressiva logo abaixo da comanda, tirando a elegância visual do simulador de impressão.
   - **A correção:** Oculte o bloco hexadecimal por padrão. Coloque apenas um link/botão secundário minimalista e discreto no rodapé da gaveta da impressora: `[ 🖨️ Modo Técnico: Inspecionar Bytes ESC/POS ]`. Ao clicar, abre-se um acordeão suave. O foco principal da gaveta deve ser 100% o papel térmico estilizado.

2. **Enxugamento de Jargões na Tela de Login (`LoginView.tsx`):**
   - **O problema atual:** O card esquerdo da tela de login exibe termos de engenharia pesados ("Motor Local Offline-First Ativo", "Cifragem AES-256") logo na entrada do cliente/operador.
   - **A correção:** Remova esses blocos técnicos fixos da tela de login principal. Substitua por uma apresentação acolhedora da trattoria ("Tradição Italiana & Operação Resiliente"). Caso o "Modo Avaliador UNIFEI" esteja ativo no topo, exiba um selo discreto informando a segurança ativa, mantendo a tela limpa para uso comercial.

3. **Refinamento dos Cards do Catálogo (`PosView.tsx`):**
   - Melhore o espaçamento interno dos cards de pratos. Mude os ícones de edição (`✏️`) e exclusão (`🗑️`) para dentro de um menu suspenso discreto de três pontos (`⋮`) no canto superior direito do card ao passar o mouse (hover), evitando poluição visual na grade.

---

# 2. POLIMENTO DE MICRO-INTERAÇÕES E ESTÉTICA GERAL (DESIGN SYSTEM TUSCAN WARMTH)

1. **Tipografia e Cores Uniformes:**
   - Garanta que todas as fontes tabulares (preços, valores de comanda, timers, UUIDs e logs) utilizem rigorosamente `font-mono` (JetBrains Mono).
   - Suavize as sombras dos cards e modais para usar classes do Tailwind mais elegantes (`shadow-xl shadow-stone-900/5` em vez de sombras escuras chapadas).
2. **Comanda / Checkout Lateral (`PosView` - Coluna Direita):**
   - Garanta que o rodapé da comanda com os botões de forma de pagamento e o botão finalizador *"✓ Finalizar Venda"* esteja fixo na parte inferior (`sticky bottom-0`) com um gradiente de fundo suave, permitindo finalizar a venda sem precisar rolar a lista de itens da comanda.
3. **Indicador de Status de Rede e Caixa:**
   - Padronize as pílulas de status no topo para terem animações de pulso suaves (`animate-pulse`) apenas quando o estado for `Sincronizando` ou `Pendente`.

---

# 3. REVISÃO GERAL DO CÓDIGO COMPLETO (VERSÃO FINAL DEFINITIVA)

Faça uma varredura e limpeza profunda em todos os arquivos do projeto (`src/`):
1. **Remoção de Código Morto (Dead Code):** Certifique-se de que não há imports não utilizados, variáveis órfãs, logs de `console.log` desnecessários poluindo o console do navegador ou arquivos temporários esquecidos.
2. **Type Safety Absoluto:** Verifique se há qualquer tipo `any` implícito no TypeScript e substitua por interfaces e tipagens estritas corretas.
3. **Validação de Testes:** 
   - Execute a suíte de testes (`npx vitest run`) e garanta que **100% dos Casos de Teste (CT01 a CT14) continuam passando com sucesso absoluto**.
   - Execute o build de produção (`npm run build`) e certifique-se de que compila sem nenhum aviso de erro ou alerta de tipo.
4. **Relatório de Conclusão:** Ao terminar, atualize o arquivo `README.md` com instruções finais claras, mantendo os links de acesso e o mapeamento dos requisitos cumpridos.
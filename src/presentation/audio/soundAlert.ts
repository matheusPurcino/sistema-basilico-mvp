/**
 * Alerta sonoro sintetizado via Web Audio API (RNF03.4) ao chegar novo pedido
 * de delivery ou alerta crítico de falta de bobina / sincronização.
 */
export function tocarAlertaSonoroDelivery(tipo: 'NOVO_PEDIDO' | 'ERRO_IMPRESSORA' | 'VENDA_OK' = 'NOVO_PEDIDO'): void {
  try {
    const AudioCtx =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const agora = ctx.currentTime;

    if (tipo === 'NOVO_PEDIDO') {
      // Duplo acorde ascendente de alto destaque para cozinha/caixa
      const notas = [587.33, 880, 1174.66]; // D5, A5, D6
      notas.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, agora + idx * 0.11);
        gain.gain.setValueAtTime(0.18, agora + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, agora + idx * 0.11 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(agora + idx * 0.11);
        osc.stop(agora + idx * 0.11 + 0.23);
      });
    } else if (tipo === 'ERRO_IMPRESSORA') {
      // Tom grave duplo de alerta de falha física (sem bobina)
      [220, 196].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, agora + idx * 0.18);
        gain.gain.setValueAtTime(0.16, agora + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, agora + idx * 0.18 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(agora + idx * 0.18);
        osc.stop(agora + idx * 0.18 + 0.26);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, agora);
      gain.gain.setValueAtTime(0.1, agora);
      gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(agora);
      osc.stop(agora + 0.13);
    }
  } catch {
    /* Web Audio API pode estar bloqueada antes do primeiro clique do usuário */
  }
}

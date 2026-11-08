/* ================================================================= *
 * IMPETUS SAAS - AUTO-INICIALIZADOR DO SISTEMA (PHD LEVEL)           *
 * ================================================================= */

import { inicializarEventosImpetus } from './impetus-ui-binder.js';

class ImpetusSystemCore {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.boot());
    } else {
      this.boot();
    }
  }

  boot() {
    console.log("⚡ [IMPETUS ENGINE] Inicializando subsistema de alta performance...");
    try {
      inicializarEventosImpetus();
      console.log("⚡ [IMPETUS ENGINE] Subsistema ativado com sucesso.");
    } catch (error) {
      console.error("❌ [IMPETUS ENGINE] Erro crítico na inicialização:", error);
    }
  }
}

// Instanciação automática e isolada
export const impetusCore = new ImpetusSystemCore();
/* ================================================================= *
 * IMPETUS SAAS - SERVIÇO DE PARTILHA E CAPTURA DE STORIES (9:16)     *
 * ================================================================= */

import { toPng } from 'html-to-image'; // Certifique-se de instalar se necessário, ou use a biblioteca nativa equivalente no projeto

export async function gerarECompartilharStory() {
  const node = document.getElementById('impetus-story-card');

  if (!node) {
    console.error("Elemento do story não encontrado.");
    return;
  }

  try {
    // 1. Converte o elemento HTML para Data URL (PNG)
    const dataUrl = await toPng(node, { cacheBust: true, quality: 0.95 });
    
    // 2. Transforma o Data URL em Blob para manipulação de ficheiro
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'impetus-treino-concluido.png', { type: 'image/png' });

    // 3. Verifica suporte à Web Share API (Partilha Nativa em dispositivos móveis)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Meu Treino - Impetus',
        text: 'Concluí o meu treino de hoje com a consultoria do Team Fábio Coelho! ⚡💪',
        files: [file],
      });
      console.log('Story partilhado com sucesso!');
    } else {
      // Fallback para computadores: Download direto do ficheiro PNG
      const link = document.createElement('a');
      link.download = 'impetus-treino-concluido.png';
      link.href = dataUrl;
      link.click();
      console.log('Download do story efetuado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao gerar o story:', error);
  }
}
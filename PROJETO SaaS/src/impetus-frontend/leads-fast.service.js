/* ================================================================= *
 * IMPETUS SAAS - MÓDULO DE CAPTURA RÁPIDA DE LEADS & WHATSAPP       *
 * ================================================================= */

export function enviarLeadWhatsApp(nomeCliente, telefonePersonal, objetivo) {
  // Número de WhatsApp padrão da consultoria ou do personal (ex: +55...)
  const numeroDestino = telefonePersonal || "5584999999999"; 

  const mensagem = encodeURIComponent(
    `Olá! Sou ${nomeCliente || "um novo aluno"}, tenho interesse na consultoria de treino e no método de alta performance do Team Fábio Coelho. Meu objetivo principal é: ${obj || "Hipertrofia/Definição"}. Vamos começar? ⚡`
  );

  const urlWhatsApp = `https://wa.me/${numeroDestino}?text=${mensagem}`;
  
  // Abre o WhatsApp com a mensagem pronta
  window.open(urlWhatsApp, '_blank');
}
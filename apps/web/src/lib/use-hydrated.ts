import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` no HTML que vem do servidor e durante a hidratação; `true` assim que
 * o React assume a página no navegador.
 *
 * Serve para manter o botão de envio dos formulários de login desabilitado até
 * o JavaScript estar pronto. Um clique antes disso faria o navegador enviar o
 * formulário por conta própria, sem passar pelo código da página.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

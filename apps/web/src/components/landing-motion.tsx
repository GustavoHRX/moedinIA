"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Orquestração de motion da landing (Brand Book pág. 08 + GSAP).
 * Cada animação tem um porquê:
 *  - hero: guia o olho título → sub → CTA → demo (hierarquia);
 *  - contadores: o número "chega" no valor (o dado é vivo — count-up do book);
 *  - chips de Pix: os gastinhos se acumulam e só então o total aparece (história);
 *  - "Como funciona": a tela do celular troca com o passo lido (estado);
 *  - barras/progresso do painel: chart-grow do book;
 *  - CTA fixo no celular: aparece quando o CTA do hero sai da tela (conversão).
 * Regras: nada acima de 600ms, ease-out, só transform/opacity,
 * prefers-reduced-motion desliga tudo (o conteúdo já nasce visível — as
 * animações são "from", nunca escondem nada). `clearProps` em tudo que pode
 * ter `transition` CSS por cima (nota do cofre: GSAP × transition: transform).
 */
export default function LandingMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const ease = "expo.out";

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Entrada do hero
      gsap
        .timeline({ defaults: { ease, duration: 0.45, clearProps: "transform,opacity" } })
        .from("[data-hero-eyebrow]", { y: 10, opacity: 0 })
        .from("[data-hero-title]", { y: 24, opacity: 0 }, "-=0.3")
        .from("[data-hero-sub]", { y: 16, opacity: 0 }, "-=0.28")
        // Anima o CONTAINER dos botões, não os botões: eles têm .press (transition
        // de transform no :active) e GSAP + transition no mesmo elemento travam.
        .from("[data-hero-cta]", { y: 12, opacity: 0 }, "-=0.28")
        .from("[data-hero-mock]", { y: 28, opacity: 0, scale: 0.97, duration: 0.55 }, "-=0.45");

      // Revelação de seções no scroll (slide-fade, stagger 70ms)
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((section) => {
        const items = section.querySelectorAll(":scope [data-reveal-item]");
        gsap.from(items.length ? items : section, {
          y: 16,
          opacity: 0,
          stagger: 0.07,
          duration: 0.45,
          ease,
          clearProps: "transform,opacity",
          scrollTrigger: { trigger: section, start: "top 84%", once: true },
        });
      });

      // Count-up: o texto já vem com o valor final do servidor; aqui ele "chega" lá.
      gsap.utils.toArray<HTMLElement>("[data-count-to]").forEach((el) => {
        const target = Number(el.dataset.countTo ?? 0);
        const isBrl = el.dataset.countFormat === "brl";
        const format = (value: number) =>
          isBrl
            ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : Math.round(value).toLocaleString("pt-BR");
        const state = { value: 0 };
        gsap.to(state, {
          value: target,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onStart: () => {
            el.textContent = format(0);
          },
          onUpdate: () => {
            el.textContent = format(state.value);
          },
          onComplete: () => {
            el.textContent = format(target);
          },
        });
      });

      // Gastinhos do Pix pingando um a um
      gsap.from("[data-pix-chip]", {
        y: 10,
        scale: 0.94,
        opacity: 0,
        stagger: 0.045,
        duration: 0.35,
        ease,
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: "[data-pix]", start: "top 70%", once: true },
      });

      // Painel: barras crescem (chart-grow) e progresso preenche
      gsap.from("[data-bar]", {
        scaleY: 0,
        stagger: 0.06,
        duration: 0.55,
        ease,
        clearProps: "transform",
        scrollTrigger: { trigger: "#painel", start: "top 65%", once: true },
      });
      gsap.utils.toArray<HTMLElement>("[data-progress]").forEach((bar) => {
        gsap.from(bar, {
          scaleX: 0,
          duration: 0.6,
          ease,
          clearProps: "transform",
          scrollTrigger: { trigger: bar, start: "top 90%", once: true },
        });
      });

      // Selo da garantia: a moeda gira uma vez quando o card de preço entra (coin-flip)
      gsap.from("[data-coin]", {
        rotateY: 180,
        duration: 0.6,
        ease: "back.out(1.6)",
        clearProps: "transform",
        scrollTrigger: { trigger: "[data-price-card]", start: "top 70%", once: true },
      });
    });

    // "Como funciona" (desktop): o passo no meio da tela define a tela do celular.
    // É troca de ESTADO (não movimento), então roda mesmo com reduced-motion —
    // o CSS é que decide se a troca tem fade ou é seca.
    mm.add("(min-width: 1024px)", () => {
      const container = document.querySelector<HTMLElement>("[data-hiw]");
      if (!container) return;
      gsap.utils.toArray<HTMLElement>("[data-hiw-step]").forEach((step) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (self.isActive) container.dataset.active = step.dataset.hiwStep ?? "0";
          },
        });
      });
    });

    // CTA fixo no celular: entra quando o hero sai, sai quando o card de preço aparece.
    mm.add("(max-width: 1023px)", () => {
      const bar = document.querySelector<HTMLElement>("[data-sticky-cta]");
      if (!bar) return;
      // Os triggers podem disparar onToggle já na criação: guardo num objeto
      // em vez de const solta para o `update` nunca ler uma variável ainda não criada.
      const t: Partial<Record<"pastHero" | "price" | "finalCta", ScrollTrigger>> = {};
      const update = () => {
        const visible = Boolean(t.pastHero?.isActive) && !t.price?.isActive && !t.finalCta?.isActive;
        bar.classList.toggle("is-visible", visible);
      };
      t.pastHero = ScrollTrigger.create({ trigger: "[data-hero]", start: "bottom 40%", end: "max", onToggle: update });
      t.price = ScrollTrigger.create({ trigger: "[data-price-card]", start: "top bottom", end: "bottom top", onToggle: update });
      t.finalCta = ScrollTrigger.create({ trigger: "[data-final-cta]", start: "top bottom", end: "max", onToggle: update });
      update();
      return () => bar.classList.remove("is-visible");
    });

    return () => mm.revert();
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Orquestração de motion da landing (Brand Book pág. 08 + GSAP).
 * Tudo tem propósito: entrada guia o olho para H1 → CTA → mockup;
 * scroll revela seções na ordem de leitura; count-up e barra reforçam
 * que os números são vivos. Nada acima de 600ms, ease-out expo/spring,
 * e prefers-reduced-motion desliga tudo (conteúdo já é visível por padrão —
 * as animações são "from", nunca escondem nada permanentemente).
 */
export default function LandingMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ease = "expo.out";

      // Entrada do hero: título → sub → CTAs → mockup (guia o olho na ordem de leitura)
      const heroTl = gsap.timeline({ defaults: { ease, duration: 0.45 } });
      heroTl
        .from("[data-hero-title]", { y: 24, opacity: 0 })
        .from("[data-hero-sub]", { y: 16, opacity: 0 }, "-=0.28")
        .from("[data-hero-cta] > *", { y: 12, opacity: 0, stagger: 0.07 }, "-=0.28")
        .from("[data-hero-chips] > *", { y: 8, opacity: 0, stagger: 0.05 }, "-=0.3")
        .from("[data-hero-mock]", { y: 28, opacity: 0, scale: 0.97, duration: 0.55 }, "-=0.45");

      // Mensagens do chat aparecem em sequência (typing feel) quando o mockup entra na tela
      gsap.from("[data-chat-msg]", {
        y: 14,
        opacity: 0,
        stagger: 0.16,
        duration: 0.35,
        ease,
        scrollTrigger: { trigger: "[data-hero-mock]", start: "top 80%", once: true },
      });

      // Count-up do resumo (anima o número de 0 até o valor real)
      const counter = document.querySelector<HTMLElement>("[data-countup]");
      if (counter) {
        const target = Number(counter.dataset.countup ?? 0);
        const state = { value: 0 };
        gsap.to(state, {
          value: target,
          duration: 0.45,
          ease: "power2.out",
          scrollTrigger: { trigger: counter, start: "top 85%", once: true },
          onUpdate: () => {
            counter.textContent = `R$ ${Math.round(state.value).toLocaleString("pt-BR")}`;
          },
        });
      }

      // Barra de orçamento cresce até 64% quando visível
      gsap.from("[data-budget-bar]", {
        width: 0,
        duration: 0.45,
        ease,
        scrollTrigger: { trigger: "[data-budget-bar]", start: "top 85%", once: true },
      });

      // Parallax sutil (scrub) no mockup do telefone — profundidade sem gimmick
      gsap.to("[data-hero-mock]", {
        y: -26,
        ease: "none",
        scrollTrigger: { trigger: "[data-hero-mock]", start: "top 70%", end: "bottom top", scrub: 0.6 },
      });

      // Revelação de seções no scroll (slide-fade, stagger 80ms — book pág. 08)
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((section) => {
        const items = section.querySelectorAll("[data-reveal-item]");
        gsap.from(items.length ? items : section, {
          y: 16,
          opacity: 0,
          stagger: 0.08,
          duration: 0.45,
          ease,
          scrollTrigger: { trigger: section, start: "top 82%", once: true },
        });
      });

      // Pin do título de "Como funciona" enquanto os 3 passos passam (só desktop)
      mm.add("(min-width: 1024px)", () => {
        const pinned = document.querySelector("[data-pin-title]");
        const steps = document.querySelector("[data-pin-steps]");
        if (pinned && steps) {
          ScrollTrigger.create({
            trigger: "[data-pin-section]",
            start: "top 96px",
            end: "bottom 60%",
            pin: pinned,
            pinSpacing: false,
          });
        }
      });
    });

    return () => {
      mm.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return null;
}

import { Footer } from "@/components/layout/Footer";
import { CineScene } from "@/components/sections/CineScene";
import { Employers } from "@/components/sections/Employers";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { Manifesto } from "@/components/sections/Manifesto";
import { Method } from "@/components/sections/Method";
import { Outcomes } from "@/components/sections/Outcomes";
import { CineFocusPill, PortalScroll } from "@/components/sections/PortalScroll";
import { Programs } from "@/components/sections/Programs";
import { SignalBand } from "@/components/sections/SignalBand";
import { Testimonials } from "@/components/sections/Testimonials";
import { JsonLd } from "@/components/seo/JsonLd";
import { CineScroll } from "@/components/webgl/CineScroll";
import { ParticleStage } from "@/components/webgl/ParticleStage";
import { CINE_BOOT_SCRIPT } from "@/lib/motion/cineBoot";

/**
 * Landing page. Scene order must match SCENE_INDEX in components/webgl/cineEngine.ts:
 * [hero+signal] [programs] [manifesto] [portal] [method] [outcomes] [employers] [stories] [faq] [cta+footer]
 */
export default function HomePage() {
  return (
    <>
      {/* runs before <main> is parsed, so cinematic layout applies before first paint */}
      <script dangerouslySetInnerHTML={{ __html: CINE_BOOT_SCRIPT }} />
      <CineScroll />
      <ParticleStage />
      <main>
        <CineScene>
          <Hero />
          <SignalBand />
        </CineScene>
        <CineScene>
          <Programs />
        </CineScene>
        <CineScene>
          <Manifesto />
        </CineScene>
        <CineScene>
          <PortalScroll />
        </CineScene>
        <CineScene>
          <Method />
        </CineScene>
        <CineScene>
          <Outcomes />
        </CineScene>
        <CineScene>
          <Employers />
        </CineScene>
        <CineScene>
          <Testimonials />
        </CineScene>
        <CineScene>
          <Faq />
        </CineScene>
        <CineScene>
          <FinalCta />
          <Footer />
        </CineScene>
      </main>
      <div className="cine-spacer" aria-hidden="true" />
      <CineFocusPill />
      <JsonLd />
    </>
  );
}

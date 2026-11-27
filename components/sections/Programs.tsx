import Image from "next/image";
import { ProgramCard } from "@/components/sections/ProgramCard";
import { formatPrice, programs } from "@/lib/content/programs";

export function Programs() {
  return (
    <section className="programs section-shell" id="programs">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Choose your transformation</p>
          <h2>
            One academy.
            <br />
            <span>Three career moves.</span>
          </h2>
        </div>
        <p>Start where you are. Finish with evidence of what you can do next.</p>
      </div>
      <div className="program-grid">
        {programs.map((program) => (
          <ProgramCard key={program.slug} track={program.track} featured={program.featured}>
            {program.badge && <div className="popular">{program.badge}</div>}
            {/* decorative: the course name and summary carry the meaning */}
            <div className="program-art">
              <Image src={`/images/programs/${program.slug}.svg`} alt="" width={400} height={220} />
            </div>
            <p className="program-level">{program.level}</p>
            <h3>{program.name}</h3>
            {/* the POC hides its arrow button; this keeps the card reachable by keyboard and screen readers */}
            <button type="button" className="program-apply sr-only">
              Apply for {program.name}
            </button>
            <p className="program-body">{program.summary}</p>
            <div className="program-meta">
              <span>{program.meta[0]}</span>
              <span>{program.meta[1]}</span>
            </div>
            <div className="program-footer">
              <strong>{formatPrice(program.priceGbp)}</strong>
            </div>
          </ProgramCard>
        ))}
      </div>
    </section>
  );
}

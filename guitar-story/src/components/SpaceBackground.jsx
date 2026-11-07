import React, { useMemo } from 'react';
import '../css/SpaceTheme.css';

// Deterministic PRNG so the sky is identical on every render and every visit.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SpaceBackground = () => {
  const stars = useMemo(() => {
    const rand = mulberry32(1206);
    return Array.from({ length: 160 }, (_, i) => {
      const r = rand();
      // Most stars are tiny; a handful are bright and warm.
      const tier = r > 0.97 ? 3 : r > 0.85 ? 2 : 1;
      return {
        id: i,
        x: rand() * 100,
        y: rand() * 100,
        tier,
        warm: rand() > 0.82,
        twinkle: tier > 1 && rand() > 0.4,
        delay: rand() * 6,
      };
    });
  }, []);

  return (
    <div className="cosmos" aria-hidden="true">
      <div className="cosmos-nebula cosmos-nebula--violet" />
      <div className="cosmos-nebula cosmos-nebula--amber" />
      <div className="cosmos-stars">
        {stars.map((s) => (
          <span
            key={s.id}
            className={`cosmos-star t${s.tier}${s.warm ? ' warm' : ''}${s.twinkle ? ' twinkle' : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}s` }}
          />
        ))}
      </div>
      <div className="cosmos-grain" />
    </div>
  );
};

export default SpaceBackground;

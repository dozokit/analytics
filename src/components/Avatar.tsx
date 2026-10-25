// A face and a name made up from the visitor id: the same visitor always gets
// the same one, and nothing about the person goes into it.

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Takes a few bits at a time, so every feature varies on its own.
function picker(seed: string) {
  let h = hash(seed);
  let h2 = hash(seed + "~");
  return (n: number) => {
    const v = h % n;
    h = Math.floor(h / n) || (h2 = Math.imul(h2 ^ (h2 >>> 15), 2246822507) >>> 0);
    return v;
  };
}

const ADJECTIVES = ["Quiet", "Bright", "Lucky", "Brave", "Sunny", "Curious", "Gentle", "Swift", "Calm", "Clever", "Jolly", "Bold", "Merry", "Witty", "Cosy", "Nimble", "Sleepy", "Proud", "Shy", "Eager"];
const ANIMALS = ["Otter", "Fox", "Heron", "Lynx", "Badger", "Robin", "Hare", "Owl", "Seal", "Wren", "Moose", "Panda", "Puffin", "Gecko", "Bison", "Marten", "Lark", "Newt", "Ibex", "Stoat"];

export function visitorName(id: string) {
  const pick = picker(id + "name");
  return `${ADJECTIVES[pick(ADJECTIVES.length)]} ${ANIMALS[pick(ANIMALS.length)]}`;
}

const MOUTHS = [
  "M12 22.5q6 5 12 0", // smile
  "M13 23h10", // flat
  "M12.5 21.5q5.5 7 11 0z", // open grin
  "M14 23.5q4 -3 8 0", // unsure
  "M13 22q3 3 5 0q2 3 5 0", // cat
];

const TOPS = [
  null,
  "M10 9q8 -7 16 0q-8 -3 -16 0z", // tuft
  "M6 13q12 -14 24 0v-3q-12 -11 -24 0z", // band
  "M8 12q4 -9 14 -6q-6 0 -14 6z", // swoop
];

export function Avatar({ seed, size = 32, x, y }: { seed: string; size?: number; x?: number; y?: number }) {
  const pick = picker(seed);
  const bg = pick(8) + 1;
  const eyeGap = 3.2 + pick(3) * 0.6;
  const eyeY = 15 + pick(3) * 0.8;
  const eyes = pick(4); // 0-1 open, 2 closed, 3 wink
  const mouth = MOUTHS[pick(MOUTHS.length)];
  const top = TOPS[pick(TOPS.length)];
  const blush = pick(3) === 0;
  const tilt = pick(9) - 4;
  const shift = pick(5) - 2;

  const eye = (cx: number, closed: boolean) =>
    closed ? <path d={`M${cx - 1.8} ${eyeY}q1.8 1.6 3.6 0`} className="avatar-line" /> : <circle cx={cx} cy={eyeY} r={1.7} className="avatar-ink" />;

  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 36 36" className="avatar" aria-hidden="true">
      <circle cx="18" cy="18" r="18" style={{ fill: `var(--avatar-${bg})` }} />
      <g transform={`rotate(${tilt} 18 18) translate(${shift} 0)`}>
        {top && <path d={top} className="avatar-ink" />}
        {eye(18 - eyeGap, eyes === 2)}
        {eye(18 + eyeGap, eyes >= 2)}
        {blush && (
          <>
            <circle cx={18 - eyeGap - 2.6} cy={eyeY + 4} r={1.8} className="avatar-blush" />
            <circle cx={18 + eyeGap + 2.6} cy={eyeY + 4} r={1.8} className="avatar-blush" />
          </>
        )}
        <path d={mouth} className={mouth.endsWith("z") ? "avatar-ink" : "avatar-line"} />
      </g>
    </svg>
  );
}

export function VisitorTag({ id, children }: { id: string; children?: React.ReactNode }) {
  return (
    <span className="visitor-tag">
      <Avatar seed={id} size={28} />
      <span className="visitor-tag-text">
        <span className="visitor-name">{visitorName(id)}</span>
        {children}
      </span>
    </span>
  );
}

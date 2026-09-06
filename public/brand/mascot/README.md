# Mascot renders

Drop rendered variants of the canonical StudentOS French Bulldog here, one per
state, named after the state:

```
neutral.webp   thinking.webp   happy.webp     excited.webp   celebrating.webp
budget.webp    concerned.webp  explorer.webp  social.webp    arrival.webp
survival.webp  error.webp      empty.webp     travel.webp    focus.webp
```

Then run:

```bash
pnpm mascot:manifest
```

That rewrites `mascotAssets` in `src/brand/mascot.config.ts` from what is on
disk. `MascotArt` switches to a render for any state that has one and keeps the
vector character for the rest. Nothing is declared that does not exist.

## Requirements for every render

- Square, at least 512×512, WebP or AVIF preferred (PNG accepted).
- Transparent background, or the warm paper ground `#fbfaf7`.
- The same character: black coat, large upright bat ears, big warm brown eyes,
  matte black rectangular frames, soft key light from the upper left.
- Only the expression and (where the state calls for it) one small accessory
  change between states. A variant that changes fur, eyes, glasses, head or ear
  shape, proportions or lighting is rejected.

The canonical reference portrait is `neutral`. Generate every other state from
it, not from each other, so drift does not compound.

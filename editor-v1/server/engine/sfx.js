// A small, royalty-free sound-effect kit synthesised with ffmpeg on first use, so the
// editor needs no sound library or licence to place SFX.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { ffmpeg } from '../lib/proc.js';

export const SFX_KINDS = {
  whoosh: { label: 'Whoosh', src: "anoisesrc=d=0.55:c=pink:a=0.9,highpass=f=350,lowpass=f=4200,afade=t=in:d=0.32:curve=exp,afade=t=out:st=0.32:d=0.23,volume=0.9" },
  click: { label: 'Photo click', src: "aevalsrc='(random(0)*2-1)*exp(-90*t)+0.4*sin(2*PI*2400*t)*exp(-140*t)':d=0.09:s=48000,highpass=f=900,volume=0.9" },
  impact: { label: 'Impact', src: "aevalsrc='0.95*sin(2*PI*(42+90*exp(-14*t))*t)*exp(-4.5*t)+0.25*(random(0)*2-1)*exp(-35*t)':d=0.9:s=48000,lowpass=f=6000" },
  pop: { label: 'Pop', src: "aevalsrc='0.8*sin(2*PI*(1100*exp(-18*t)+180)*t)*exp(-28*t)':d=0.16:s=48000" },
  riser: { label: 'Riser', src: "aevalsrc='0.35*sin(2*PI*(160+700*t*t)*t)*(t/1.1)+0.12*(random(0)*2-1)*(t/1.1)':d=1.1:s=48000,highpass=f=120,afade=t=out:st=1.0:d=0.1" },
  glitch: { label: 'Glitch', src: "aevalsrc='0.5*sgn(sin(2*PI*(220+880*floor(mod(t*40,4)))*t))*exp(-6*t)':d=0.3:s=48000,lowpass=f=5000" },
};

export function sfxDir() {
  return path.join(config.dataDir, 'sfx');
}

export function sfxFile(kind) {
  if (!SFX_KINDS[kind]) throw new Error(`Unknown SFX kind: ${kind}`);
  return path.join(sfxDir(), `${kind}.wav`);
}

export async function ensureSfxKit() {
  await mkdir(sfxDir(), { recursive: true });
  for (const [kind, def] of Object.entries(SFX_KINDS)) {
    const out = sfxFile(kind);
    if (existsSync(out)) continue;
    await ffmpeg(['-f', 'lavfi', '-i', def.src, '-ac', '2', '-ar', '48000', out]);
  }
}

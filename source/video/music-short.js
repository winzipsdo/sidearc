// 竖屏短片的配乐:每分钟 120 拍、节奏更紧的电子流行,段落和画面对齐(见 short.js 的 CUES):
// 开头是拨弦、沙锤和标签页一个个冒出来的「嗒」,越来越紧,升调的噪声推到按下 Alt+S 的那一拍;这一拍起底鼓、拍手、低音和和弦一起进来;
// 叶子落下时有一串清脆的高音,鼠标来回扫的每一下有一声风,关掉标签页「啵」一声;结尾鼓停下,和弦收住。
// 和 music.js 一样只用正弦波和噪声合成,同样的参数每次生成的结果都一样。返回 16 位立体声 wav 文件的内容。

import { SR, hz, random, reverb, wavOf } from './music.js';

const BEAT = 0.5; // 每分钟 120 拍
const BAR = BEAT * 4;
// 和弦进行 Am → F → C → G,每个和弦一小节:[和弦的音, 低音]
const CHORDS = [
  [[57, 60, 64], 45],
  [[53, 57, 60], 41],
  [[55, 60, 64], 48],
  [[55, 59, 62], 43],
];
const SCALE = [69, 72, 74, 76, 79, 81, 84]; // 落叶的高音:A 小调五声音阶

export function renderShortMusic(duration, cues) {
  const { drop, ticks = [], leaves = [], sweeps = [], pops = [], clicks = [], end } = cues;
  const n = Math.ceil(duration * SR);
  const dry = [new Float32Array(n), new Float32Array(n)];
  const send = new Float32Array(n);
  const rnd = random(11);
  const add = (i, l, r = l) => {
    if (i >= 0 && i < n) {
      dry[0][i] += l;
      dry[1][i] += r;
    }
  };
  const chordAt = (t) => CHORDS[Math.floor(t / BAR + 1e-6) % CHORDS.length];
  // 一个音:f 赫兹,从 t0 开始,len 秒,env(t) 是包络,wave(ph, t) 是波形
  const tone = (t0, len, f, env, wave, { gain = 1, pan = 0.5, wet = 0 } = {}) => {
    for (let s = 0; s < len * SR; s++) {
      const t = s / SR;
      const v = wave(2 * Math.PI * f * t, t) * env(t) * gain;
      const i = Math.round((t0 + t) * SR);
      add(i, v * (1 - pan) * 2 * 0.5, v * pan * 2 * 0.5);
      if (wet && i >= 0 && i < n) send[i] += v * wet;
    }
  };
  const noise = (t0, len, env, { gain = 1, hp = true, pan = 0.5, wet = 0 } = {}) => {
    let prev = 0;
    for (let s = 0; s < len * SR; s++) {
      const t = s / SR;
      const x = rnd() * 2 - 1;
      const v = (hp ? x - prev : x) * env(t) * gain;
      prev = x;
      const i = Math.round((t0 + t) * SR);
      add(i, v * (1 - pan) * 2 * 0.5, v * pan * 2 * 0.5);
      if (wet && i >= 0 && i < n) send[i] += v * wet;
    }
  };
  const pluck = (ph, t) => Math.sin(ph) + 0.4 * Math.sin(2 * ph) * Math.exp(-t / 0.06) + 0.15 * Math.sin(3 * ph) * Math.exp(-t / 0.03);

  // 拨弦琶音:从头到结尾,八分音符,左右交替;按 Alt+S 前音量小、音短,之后放开
  for (let step = 0; step * BEAT / 2 < end + BAR; step++) {
    const t0 = (step * BEAT) / 2;
    const [notes] = chordAt(t0);
    const note = notes[[0, 1, 2, 1, 2, 0, 1, 2][step % 8]] + 12;
    const before = t0 < drop;
    const decay = before ? 0.12 + 0.08 * (t0 / drop) : 0.22;
    tone(t0, 0.7, hz(note), (t) => Math.min(1, t / 0.003) * Math.exp(-t / decay), pluck, { gain: before ? 0.085 : 0.06, pan: step % 2 ? 0.68 : 0.32, wet: 0.5 });
  }

  // 开头的沙锤:十六分音符,越来越密、越来越响
  for (let t0 = 0; t0 < drop; t0 += BEAT / 4) {
    const k = t0 / drop;
    if (k < 0.5 && Math.round(t0 / (BEAT / 4)) % 2) continue;
    noise(t0, 0.06, (t) => Math.exp(-t / 0.015), { gain: 0.035 + 0.04 * k, pan: 0.6 });
  }
  // 推到 drop 的那一下:升调的噪声 + 上滑的正弦波
  {
    const len = 1.5;
    const t0 = drop - len;
    noise(t0, len, (t) => (t / len) ** 2.2, { gain: 0.09, wet: 0.3 });
    let ph = 0;
    for (let s = 0; s < len * SR; s++) {
      const t = s / SR;
      ph += (2 * Math.PI * (220 * 2 ** ((t / len) * 2))) / SR;
      const v = Math.sin(ph) * (t / len) ** 2 * 0.035;
      add(Math.round((t0 + t) * SR), v);
    }
  }
  // drop:一声低沉的「咚」和镲片
  {
    let ph = 0;
    for (let s = 0; s < 1.2 * SR; s++) {
      const t = s / SR;
      ph += (2 * Math.PI * (40 + 90 * Math.exp(-t / 0.08))) / SR;
      add(Math.round((drop + t) * SR), Math.sin(ph) * Math.exp(-t / 0.45) * 0.17);
    }
    noise(drop, 1.8, (t) => Math.exp(-t / 0.5), { gain: 0.07, wet: 0.6 });
  }

  // drop 之后的鼓和低音,到 end 停
  for (let step = Math.round(drop / (BEAT / 2)); step * BEAT / 2 < end; step++) {
    const t0 = (step * BEAT) / 2;
    const onBeat = step % 2 === 0;
    const beat = Math.floor(step / 2) % 4;
    // 底鼓:每一拍
    if (onBeat) {
      let ph = 0;
      for (let s = 0; s < 0.4 * SR; s++) {
        const t = s / SR;
        ph += (2 * Math.PI * (50 + 80 * Math.exp(-t / 0.04))) / SR;
        add(Math.round((t0 + t) * SR), Math.sin(ph) * Math.exp(-t / 0.12) * 0.15);
      }
    }
    // 拍手:第 2、4 拍
    if (onBeat && beat % 2 === 1) noise(t0, 0.18, (t) => Math.exp(-t / 0.05) * (t < 0.012 ? 0.6 : 1), { gain: 0.07, wet: 0.4 });
    // 闭镲:反拍
    if (!onBeat) noise(t0, 0.05, (t) => Math.exp(-t / 0.012), { gain: 0.035, pan: 0.62 });
    // 低音:反拍上的八分音符,给一点律动
    if (!onBeat) {
      const f = hz(chordAt(t0)[1]);
      tone(t0, BEAT / 2, f, (t) => Math.min(1, t / 0.005) * Math.exp(-t / 0.16), (ph) => Math.sin(ph) + 0.5 * Math.sin(2 * ph), { gain: 0.13 });
    }
  }
  // 和弦铺底:drop 之后每小节一个,慢起慢收
  for (let t0 = drop; t0 < duration; t0 += BAR) {
    const [notes] = chordAt(t0);
    const last = t0 >= end;
    const len = last ? duration - t0 : BAR + 0.6;
    for (const [k, note] of notes.entries()) {
      for (const cents of [-6, 6]) {
        const f = hz(note) * 2 ** (cents / 1200);
        tone(t0, len, f, (t) => Math.min(1, t / 0.08) * Math.min(1, Math.max(0, (len - t) / (last ? 2.5 : 0.6))), (ph) => Math.sin(ph) + 0.25 * Math.sin(2 * ph), {
          gain: 0.022,
          pan: 0.5 + (cents > 0 ? 0.2 : -0.2) * (k % 2 ? 1 : -1),
          wet: 0.5,
        });
      }
    }
  }
  // 结尾:鼓停下的那一拍一个长一点的和弦,加一声高音收尾
  tone(end, 2.8, hz(81), (t) => Math.min(1, t / 0.004) * Math.exp(-t / 0.8), pluck, { gain: 0.06, wet: 0.8 });

  // 落叶:每片叶子落下时一声清脆的高音(五声音阶里挑)
  leaves.forEach((t0, i) => {
    const note = SCALE[Math.floor(rnd() * SCALE.length)] + 12 * (i % 3 === 0 ? 1 : 0);
    tone(t0, 0.9, hz(note), (t) => Math.min(1, t / 0.002) * Math.exp(-t / 0.22), (ph) => Math.sin(ph) + 0.2 * Math.sin(3.01 * ph), { gain: 0.03, pan: 0.25 + 0.5 * rnd(), wet: 0.9 });
  });
  // 扫:每一下一声短促的风(带通的噪声,先起后落)
  for (const t0 of sweeps) {
    let lo = 0;
    let band = 0;
    const len = 0.24;
    const pan = 0.3 + 0.4 * rnd();
    for (let s = 0; s < len * SR; s++) {
      const t = s / SR;
      const x = rnd() * 2 - 1;
      lo += (x - lo) * 0.35;
      band += (lo - band) * 0.08;
      const v = (lo - band) * Math.sin((Math.PI * t) / len) ** 2 * 0.14;
      const i = Math.round((t0 + t) * SR);
      add(i, v * (1 - pan) * 2 * 0.5, v * pan * 2 * 0.5);
      if (i < n) send[i] += v * 0.3;
    }
  }
  // 关掉标签页:「啵」
  for (const t0 of pops) {
    let ph = 0;
    for (let s = 0; s < 0.18 * SR; s++) {
      const t = s / SR;
      ph += (2 * Math.PI * (380 + 900 * Math.exp(-t / 0.02))) / SR;
      add(Math.round((t0 + t) * SR), Math.sin(ph) * Math.exp(-t / 0.05) * 0.16);
    }
  }
  // 标签页一个接一个冒出来:每个一声短促的「嗒」,音越来越高
  ticks.forEach((t0, i) => {
    const f = 900 * 2 ** ((i / Math.max(1, ticks.length - 1)) * 1.2);
    tone(t0, 0.04, f, (t) => Math.exp(-t / 0.007), (ph) => Math.sin(ph) + 0.3 * Math.sin(2 * ph), { gain: 0.09, pan: 0.35 + 0.3 * ((i * 7) % 5) / 4 });
  });
  // 鼠标点击、按键:很短的「嗒」
  for (const t0 of clicks) {
    noise(t0, 0.05, (t) => Math.exp(-t / 0.008), { gain: 0.12 });
    tone(t0, 0.05, 2100, (t) => Math.exp(-t / 0.008), Math.sin, { gain: 0.06 });
  }

  const wet = [reverb(send, 0), reverb(send, 23)];
  const mix = [new Float32Array(n), new Float32Array(n)];
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const fade = Math.min(1, t / 0.05) * Math.min(1, (duration - t) / 1.5);
      const v = Math.tanh((dry[ch][i] + wet[ch][i] * 0.3) * 1.7) * fade;
      mix[ch][i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  return wavOf(mix, 0.94 / peak);
}

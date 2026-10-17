// 介绍视频的背景音乐:用正弦波合成的一段轻音乐(铺底和弦、低音、琶音、轻鼓),加上鼠标点击的音效。
// 不用任何音频素材,也不依赖第三方包;同样的参数每次生成的结果都一样。返回 16 位立体声 wav 文件的内容。

const SR = 44100;
const BEAT = 60 / 96; // 每分钟 96 拍
const BAR = BEAT * 4;
// 和弦进行 Fmaj7 → Em7 → Dm7 → Cmaj7,每个和弦一小节:[铺底和弦的音, 低音]
const CHORDS = [
  [[53, 57, 60, 64], 41],
  [[52, 55, 59, 62], 40],
  [[50, 53, 57, 60], 38],
  [[55, 59, 60, 64], 36],
];
const ARP = [0, 1, 2, 3, 2, 1, 3, 2]; // 每小节 8 个八分音符,取和弦里的第几个音
// 各声部从第几秒开始(对应视频里的段落)
const BASS_FROM = 4.2;
const GROOVE_FROM = 9;
const GROOVE_TO = 49.8;

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// 固定种子的随机数,保证每次生成一样
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 简单的 Schroeder 混响:4 个梳状滤波器并联,再串 2 个全通滤波器
function reverb(input, spread) {
  const out = new Float32Array(input.length);
  for (const len of [1557, 1617, 1491, 1422]) {
    const buf = new Float32Array(len + spread);
    let i = 0;
    let low = 0;
    for (let n = 0; n < input.length; n++) {
      const y = buf[i];
      low = y * 0.8 + low * 0.2;
      buf[i] = input[n] + low * 0.84;
      out[n] += y / 4;
      i = (i + 1) % buf.length;
    }
  }
  for (const len of [225, 556]) {
    const buf = new Float32Array(len + spread);
    let i = 0;
    for (let n = 0; n < out.length; n++) {
      const b = buf[i];
      const x = out[n];
      buf[i] = x + b * 0.5;
      out[n] = b - x * 0.5;
      i = (i + 1) % buf.length;
    }
  }
  return out;
}

export function renderMusic(duration, clicks = []) {
  const n = Math.ceil(duration * SR);
  const dry = [new Float32Array(n), new Float32Array(n)];
  const send = new Float32Array(n); // 送进混响的部分
  const rnd = random(7);
  const add = (ch, i, v) => {
    if (i >= 0 && i < n) dry[ch][i] += v;
  };

  // 铺底和弦:每个音两个略微失谐的振荡器,慢起慢收,和下一个和弦交叠
  for (let bar = 0; bar * BAR < duration; bar++) {
    const [notes] = CHORDS[bar % CHORDS.length];
    const t0 = bar * BAR;
    const len = BAR + 1.2;
    for (const [k, note] of notes.entries()) {
      for (const cents of [-5, 5]) {
        const f = hz(note) * 2 ** (cents / 1200);
        const pan = 0.5 + (cents > 0 ? 0.18 : -0.18) * (k % 2 ? 1 : -1);
        for (let s = 0; s < len * SR; s++) {
          const t = s / SR;
          const env = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (len - t) / 1.2));
          const ph = 2 * Math.PI * f * t;
          const v = (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph)) * env * 0.03;
          const i = Math.round((t0 + t) * SR);
          add(0, i, v * (1 - pan));
          add(1, i, v * pan);
          if (i < n) send[i] += v * 0.5;
        }
      }
    }
  }

  // 低音:每两拍一个音
  for (let t0 = Math.ceil(BASS_FROM / (BEAT * 2)) * BEAT * 2; t0 < duration; t0 += BEAT * 2) {
    const f = hz(CHORDS[Math.floor(t0 / BAR + 1e-6) % CHORDS.length][1]);
    for (let s = 0; s < BEAT * 2 * SR; s++) {
      const t = s / SR;
      const env = Math.min(1, t / 0.012) * Math.exp(-t / 0.7);
      const ph = 2 * Math.PI * f * t;
      const v = (Math.sin(ph) + 0.45 * Math.sin(2 * ph)) * env * 0.075;
      const i = Math.round((t0 + t) * SR);
      add(0, i, v);
      add(1, i, v);
    }
  }

  // 琶音和轻鼓
  for (let step = 0; step * BEAT / 2 < duration; step++) {
    const t0 = (step * BEAT) / 2;
    if (t0 < GROOVE_FROM) continue;
    const bar = Math.floor(t0 / BAR + 1e-6);
    const [notes] = CHORDS[bar % CHORDS.length];
    // 琶音:拨弦一样的音色,左右交替
    const f = hz(notes[ARP[step % 8]] + 12);
    const vel = 0.75 + 0.25 * rnd();
    const pan = step % 2 ? 0.66 : 0.34;
    for (let s = 0; s < 0.9 * SR; s++) {
      const t = s / SR;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.3);
      const ph = 2 * Math.PI * f * t;
      const v = (Math.sin(ph) + 0.35 * Math.sin(2 * ph) * Math.exp(-t / 0.08)) * env * 0.065 * vel;
      const i = Math.round((t0 + t) * SR);
      add(0, i, v * (1 - pan));
      add(1, i, v * pan);
      if (i < n) send[i] += v * 0.6;
    }
    if (t0 >= GROOVE_TO) continue;
    // 底鼓:第 1、3 拍,音高快速下滑的正弦波
    if (step % 4 === 0) {
      let ph = 0;
      for (let s = 0; s < 0.5 * SR; s++) {
        const t = s / SR;
        ph += (2 * Math.PI * (48 + 70 * Math.exp(-t / 0.05))) / SR;
        const v = Math.sin(ph) * Math.exp(-t / 0.14) * 0.16;
        const i = Math.round((t0 + t) * SR);
        add(0, i, v);
        add(1, i, v);
      }
    }
    // 沙锤:反拍上一小段高通的噪声
    if (step % 2 === 1) {
      let prev = 0;
      for (let s = 0; s < 0.12 * SR; s++) {
        const t = s / SR;
        const x = rnd() * 2 - 1;
        const v = (x - prev) * Math.exp(-t / 0.022) * 0.022;
        prev = x;
        const i = Math.round((t0 + t) * SR);
        add(0, i, v * 0.8);
        add(1, i, v);
      }
    }
  }

  // 鼠标点击的音效:很短的「嗒」
  for (const t0 of clicks) {
    let prev = 0;
    for (let s = 0; s < 0.06 * SR; s++) {
      const t = s / SR;
      const x = rnd() * 2 - 1;
      const v = (Math.sin(2 * Math.PI * 2100 * t) * 0.5 + (x - prev) * 0.35) * Math.exp(-t / 0.009) * 0.16;
      prev = x;
      const i = Math.round((t0 + t) * SR);
      add(0, i, v);
      add(1, i, v);
    }
  }

  const wet = [reverb(send, 0), reverb(send, 23)];
  // 混合、柔和限幅、淡入淡出,再统一音量
  const mix = [new Float32Array(n), new Float32Array(n)];
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const fade = Math.min(1, t / 1.2) * Math.min(1, (duration - t) / 3);
      const v = Math.tanh((dry[ch][i] + wet[ch][i] * 0.32) * 1.2) * fade;
      mix[ch][i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  const gain = 0.8 / peak;

  const wav = Buffer.alloc(44 + n * 4);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + n * 4, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(2, 22); // 立体声
  wav.writeUInt32LE(SR, 24);
  wav.writeUInt32LE(SR * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    wav.writeInt16LE(Math.round(mix[0][i] * gain * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(mix[1][i] * gain * 32767), 46 + i * 4);
  }
  return wav;
}

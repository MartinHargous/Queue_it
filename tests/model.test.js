import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newProject, newSection, buildTimeline, cueTime, buildEvents, beatIndexAt, newGrid } from '../src/lib/model.js'

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)

test('un compás 4/4 a 120 bpm dura 2 s', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 1, bpm: 120, num: 4, den: 4 }]
  const tl = buildTimeline(p)
  assert.equal(tl.beats.length, 4)
  near(tl.duration, 2)
  assert.deepEqual(tl.beats.map((b) => b.accent), [1, 3, 3, 3])
})

test('varias secciones con distinto tempo y compás se encadenan sin huecos', () => {
  const p = newProject('metronome')
  p.sections = [
    { ...newSection(), bars: 2, bpm: 120, num: 4, den: 4 }, // 4 s
    { ...newSection(), bars: 2, bpm: 90, num: 3, den: 4 }, // 6 tiempos × 0,666… s = 4 s
  ]
  const tl = buildTimeline(p)
  assert.equal(tl.bars.length, 4)
  near(tl.bars[2].t, 4)
  assert.equal(tl.bars[2].num, 3)
  near(tl.duration, 8)
  assert.equal(tl.beats.at(-1).bar, 4)
})

test('6/8 marca el tiempo 4 como acento secundario', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 1, bpm: 180, num: 6, den: 8 }]
  assert.deepEqual(buildTimeline(p).beats.map((b) => b.accent), [1, 3, 3, 2, 3, 3])
})

test('el cambio gradual de tempo interpola de bpm a bpmEnd', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 2, bpm: 100, bpmEnd: 140, num: 4, den: 4 }]
  const { beats } = buildTimeline(p)
  near(beats[0].bpm, 100)
  near(beats.at(-1).bpm, 140)
  assert.ok(beats[3].bpm < beats[4].bpm)
})

test('los cues se anclan a compás:tiempo y se mueven con el tempo', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 4, bpm: 120, num: 4, den: 4 }]
  const cue = { id: 'c', bar: 3, beat: 2, kind: 'tts', text: 'coro', blobId: null, gain: 1 }
  p.cues = [cue]
  near(cueTime(buildTimeline(p), cue), 4.5)
  p.sections[0].bpm = 60
  near(cueTime(buildTimeline(p), cue), 9)
})

test('un cue fuera de la estructura no genera evento ni rompe', () => {
  const p = newProject('metronome')
  p.cues = [{ id: 'x', bar: 99, beat: 1, kind: 'tts', text: 'nada', blobId: null, gain: 1 }]
  const ev = buildEvents(p, buildTimeline(p))
  assert.equal(ev.filter((e) => e.type === 'cue').length, 0)
})

test('los cues "solo texto" no suenan', () => {
  const p = newProject('metronome')
  p.cues = [{ id: 't', bar: 1, beat: 1, kind: 'text', text: 'nota', blobId: null, gain: 1 }]
  assert.equal(buildEvents(p, buildTimeline(p)).filter((e) => e.type === 'cue').length, 0)
})

test('beatIndexAt encuentra el pulso vigente', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 1, bpm: 120, num: 4, den: 4 }]
  const tl = buildTimeline(p)
  assert.equal(beatIndexAt(tl, -1), -1)
  assert.equal(beatIndexAt(tl, 0.74), 1)
  assert.equal(beatIndexAt(tl, 99), 3)
})

test('grilla fija sobre audio: el offset desplaza el compás 1', () => {
  const p = newProject('audio')
  p.audio = { blobId: 'a', name: 'x', mime: 'audio/wav', duration: 10 }
  p.grid = newGrid({ bpm: 120, offset: 1, num: 4 })
  const tl = buildTimeline(p)
  near(tl.beats[0].t, 1)
  near(tl.bars[1].t, 3)
})

test('grilla detectada: downbeat elige el primer tiempo del compás', () => {
  const p = newProject('audio')
  p.audio = { blobId: 'a', name: 'x', mime: 'audio/wav', duration: 10 }
  p.grid = newGrid({ bpm: 120, beats: [0.5, 1, 1.5, 2, 2.5, 3], downbeat: 2, num: 4 })
  const tl = buildTimeline(p)
  assert.equal(tl.beats[2].bar, 1)
  assert.equal(tl.beats[2].beat, 1)
  assert.equal(tl.beats[0].bar, 0) // anacrusa
})

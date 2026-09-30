import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newProject, newSection, newCue, newTimeCue, buildTimeline, cueTime, cueBarBeat, buildEvents, beatIndexAt, newGrid, sortCues, skipTarget, countInPlan, moveItem, newSetlist } from '../src/lib/model.js'

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

test('un cue fijo en segundos no se mueve al cambiar el tempo', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 8, bpm: 120, num: 4, den: 4 }]
  const cue = newTimeCue(4.5)
  p.cues = [cue]
  near(cueTime(buildTimeline(p), cue), 4.5)
  assert.deepEqual(cueBarBeat(buildTimeline(p), cue), { bar: 3, beat: 2 })
  p.sections[0].bpm = 60
  near(cueTime(buildTimeline(p), cue), 4.5)
  assert.deepEqual(cueBarBeat(buildTimeline(p), cue), { bar: 2, beat: 1 })
  assert.equal(buildEvents(p, buildTimeline(p)).find((e) => e.type === 'cue').t, 4.5)
})

test('un cue fijo más allá del final queda fuera', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 1, bpm: 120, num: 4, den: 4 }]
  assert.equal(cueTime(buildTimeline(p), newTimeCue(10)), null)
})

test('sortCues ordena por instante real mezclando anclajes', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 4, bpm: 120, num: 4, den: 4 }]
  const tl = buildTimeline(p)
  const a = { ...newCue(3, 1), id: 'a' } // 4 s
  const b = { ...newTimeCue(1), id: 'b' }
  assert.deepEqual(sortCues([a, b], tl).map((c) => c.id), ['b', 'a'])
})

test('skipTarget salta al compás siguiente o anterior', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 4, bpm: 120, num: 4, den: 4 }] // compases cada 2 s
  const tl = buildTimeline(p)
  near(skipTarget(tl, 3, 1), 4)
  near(skipTarget(tl, 3, -1), 2)
  near(skipTarget(tl, 2.2, -1), 0) // recién empezado el compás: va al anterior
  near(skipTarget(tl, 7, 1), 7) // último compás: no avanza más
})

test('cuenta inicial automática: un compás al tempo de la sección, termina en el compás 1', () => {
  const p = newProject('metronome')
  p.sections = [{ ...newSection(), bars: 4, bpm: 120, num: 3, den: 4 }]
  p.countIn = { enabled: true, bars: 1, mode: 'auto' }
  const { clicks, lead } = countInPlan(p, buildTimeline(p), 0)
  assert.equal(clicks.length, 3)
  near(clicks[0].t, -1.5)
  near(lead, 1.5)
  assert.deepEqual(clicks.map((c) => c.accent), [1, 3, 3])
  assert.deepEqual(clicks.map((c) => c.n), [1, 2, 3])
})

test('cuenta inicial automática en audio: queda en fase con la grilla detectada', () => {
  const p = newProject('audio')
  p.audio = { blobId: 'a', name: 'x', mime: 'audio/wav', duration: 10 }
  p.grid = newGrid({ bpm: 120, beats: [0.3, 0.8, 1.3, 1.8, 2.3, 2.8], downbeat: 0, num: 4 })
  p.countIn = { enabled: true, bars: 2, mode: 'auto' }
  const { clicks, lead } = countInPlan(p, buildTimeline(p), 0)
  assert.equal(clicks.length, 8)
  near(clicks.at(-1).t, -0.2) // un pulso antes del primer tiempo (0,3 s)
  near(lead, 3.7)
  assert.equal(clicks[0].accent, 1)
  assert.equal(clicks[4].accent, 1)
})

test('cuenta inicial manual y desactivada', () => {
  const p = newProject('metronome')
  const tl = buildTimeline(p)
  assert.deepEqual(countInPlan(p, tl, 0), { clicks: [], lead: 0 })
  p.countIn = { enabled: true, bars: 1, mode: 'manual', bpm: 60, num: 2 }
  const plan = countInPlan(p, tl, 5)
  assert.deepEqual(plan.clicks.map((c) => c.t), [3, 4])
  near(plan.lead, 2)
})

test('listas: mover canciones respeta los bordes', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c'])
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b'])
  const same = ['a', 'b']
  assert.equal(moveItem(same, 0, -1), same)
  assert.equal(newSetlist('Show').items.length, 0)
})

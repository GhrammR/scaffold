import { describe, expect, it } from 'vitest'
import { countLineDiff, diffLines } from './lineDiff'

describe('diffLines', () => {
  it('marks every line unchanged when the text is identical', () => {
    const text = 'line one\nline two\nline three'
    expect(diffLines(text, text)).toEqual([
      { type: 'unchanged', line: 'line one' },
      { type: 'unchanged', line: 'line two' },
      { type: 'unchanged', line: 'line three' },
    ])
  })

  it('shows a removed line immediately followed by the added replacement, in place', () => {
    const previous = 'header\ndivide by zero shows an error\nfooter'
    const next = 'header\nnegative sqrt shows an error\nfooter'
    expect(diffLines(previous, next)).toEqual([
      { type: 'unchanged', line: 'header' },
      { type: 'removed', line: 'divide by zero shows an error' },
      { type: 'added', line: 'negative sqrt shows an error' },
      { type: 'unchanged', line: 'footer' },
    ])
  })

  it('detects a pure insertion with no removals', () => {
    const previous = 'header\nfooter'
    const next = 'header\nnew middle line\nfooter'
    expect(diffLines(previous, next)).toEqual([
      { type: 'unchanged', line: 'header' },
      { type: 'added', line: 'new middle line' },
      { type: 'unchanged', line: 'footer' },
    ])
  })

  it('detects a pure deletion with no additions', () => {
    const previous = 'header\nmiddle line\nfooter'
    const next = 'header\nfooter'
    expect(diffLines(previous, next)).toEqual([
      { type: 'unchanged', line: 'header' },
      { type: 'removed', line: 'middle line' },
      { type: 'unchanged', line: 'footer' },
    ])
  })

  it('handles multiple separate changed regions in one file', () => {
    const previous = 'a\nb\nc\nd\ne'
    const next = 'a\nX\nc\nY\ne'
    expect(diffLines(previous, next)).toEqual([
      { type: 'unchanged', line: 'a' },
      { type: 'removed', line: 'b' },
      { type: 'added', line: 'X' },
      { type: 'unchanged', line: 'c' },
      { type: 'removed', line: 'd' },
      { type: 'added', line: 'Y' },
      { type: 'unchanged', line: 'e' },
    ])
  })
})

describe('countLineDiff', () => {
  it('counts added and removed lines, ignoring unchanged ones', () => {
    const ops = diffLines('a\nb\nc', 'a\nX\nY\nc')
    expect(countLineDiff(ops)).toEqual({ added: 2, removed: 1 })
  })

  it('reports zero for identical text', () => {
    expect(countLineDiff(diffLines('same', 'same'))).toEqual({ added: 0, removed: 0 })
  })
})

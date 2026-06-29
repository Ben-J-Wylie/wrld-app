// src/components/sections/MarkdownView.tsx
//
// A small dependency-free Markdown renderer for legal/policy documents (served
// as Markdown by GET /legal). It covers exactly the subset those documents use —
// headings (#/##/###), paragraphs (soft-wrapped lines are re-joined), unordered
// and ordered lists, and inline **bold** / _italic_ / [links](url). Deliberately
// not a general Markdown engine: keeping it dependency-free avoids adding a native
// module / lockfile churn for what is a handful of static documents.

import { Fragment, type ReactNode } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = { markdown: string }

// Inline: **bold**, _italic_, [label](url). The documents don't nest these, so a
// single left-to-right scan over the three patterns is enough.
const INLINE = /(\*\*([^*]+)\*\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)]+)\))/g

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE.lastIndex = 0
  let i = 0
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</Fragment>)
    if (m[2] != null) {
      out.push(<Text key={`${keyBase}-b${i}`} variant="bodyEmphasized">{m[2]}</Text>)
    } else if (m[4] != null) {
      out.push(<Text key={`${keyBase}-i${i}`} style={styles.italic}>{m[4]}</Text>)
    } else if (m[6] != null) {
      const url = m[7] ?? ''
      out.push(
        <Text
          key={`${keyBase}-l${i}`}
          color={theme.colors.accent.default}
          style={styles.link}
          onPress={() => { Linking.openURL(url).catch(() => {}) }}
        >
          {m[6]}
        </Text>,
      )
    }
    last = m.index + m[0].length
    i += 1
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}-tEnd`}>{text.slice(last)}</Fragment>)
  return out
}

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }

// Group the raw lines into blocks. Blank lines separate blocks; consecutive plain
// lines are re-joined into one paragraph (the source hard-wraps paragraphs).
function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = [] }
  }
  const flushList = () => {
    if (list) { blocks.push(list); list = null }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()

    if (t === '') { flushPara(); flushList(); continue }

    const heading = /^(#{1,3})\s+(.*)$/.exec(t)
    if (heading) {
      flushPara(); flushList()
      blocks.push({ kind: 'h', level: (heading[1]?.length ?? 1) as 1 | 2 | 3, text: heading[2] ?? '' })
      continue
    }

    const ul = /^[-*]\s+(.*)$/.exec(t)
    if (ul) {
      flushPara()
      if (!list || list.kind !== 'ul') { flushList(); list = { kind: 'ul', items: [] } }
      list.items.push(ul[1] ?? '')
      continue
    }

    const ol = /^\d+\.\s+(.*)$/.exec(t)
    if (ol) {
      flushPara()
      if (!list || list.kind !== 'ol') { flushList(); list = { kind: 'ol', items: [] } }
      list.items.push(ol[1] ?? '')
      continue
    }

    flushList()
    para.push(t)
  }
  flushPara(); flushList()
  return blocks
}

export function MarkdownView({ markdown }: Props) {
  const blocks = parseBlocks(markdown)
  return (
    <View>
      {blocks.map((b, i) => {
        const key = `b${i}`
        if (b.kind === 'h') {
          const variant = b.level === 1 ? 'display' : b.level === 2 ? 'heading' : 'bodyEmphasized'
          return (
            <Text key={key} variant={variant} style={b.level === 1 ? styles.h1 : styles.h}>
              {renderInline(b.text, key)}
            </Text>
          )
        }
        if (b.kind === 'p') {
          return (
            <Text key={key} variant="body" color={theme.colors.text.primary} style={styles.p}>
              {renderInline(b.text, key)}
            </Text>
          )
        }
        return (
          <View key={key} style={styles.list}>
            {b.items.map((item, j) => (
              <View key={`${key}-${j}`} style={styles.li}>
                <Text variant="body" color={theme.colors.text.muted} style={styles.bullet}>
                  {b.kind === 'ol' ? `${j + 1}.` : '•'}
                </Text>
                <Text variant="body" color={theme.colors.text.primary} style={styles.liText}>
                  {renderInline(item, `${key}-${j}`)}
                </Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  h1: { marginBottom: theme.spacing.sm },
  h: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
  p: { marginTop: theme.spacing.md },
  list: { marginTop: theme.spacing.sm },
  li: { flexDirection: 'row', marginTop: theme.spacing.xs },
  bullet: { width: 22 },
  liText: { flex: 1 },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
})

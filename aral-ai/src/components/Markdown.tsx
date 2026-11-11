import React from 'react';
import { Text, View, StyleSheet, type TextStyle } from 'react-native';
import { colors } from '../theme';

/** Maliit na markdown renderer: **bold**, *italic*, headings, bullets, numbered list. */
function inline(text: string, base: TextStyle, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    const k = keyPrefix + i;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
      return (
        <Text key={k} style={[base, { fontWeight: '700' }]}>
          {p.slice(2, -2)}
        </Text>
      );
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <Text key={k} style={[base, styles.code]}>
          {p.slice(1, -1)}
        </Text>
      );
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
      return (
        <Text key={k} style={[base, { fontStyle: 'italic' }]}>
          {p.slice(1, -1)}
        </Text>
      );
    return p;
  });
}

export function Markdown({ text, color = colors.ink }: { text: string; color?: string }) {
  const base: TextStyle = { color, fontSize: 15.5, lineHeight: 23 };
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h)
          return (
            <Text key={i} style={[base, { fontWeight: '800', fontSize: h[1].length <= 2 ? 18 : 16, marginTop: 4 }]}>
              {inline(h[2], { ...base, fontWeight: '800' }, `h${i}-`)}
            </Text>
          );
        const b = line.match(/^(\s*)[-*•]\s+(.*)$/);
        if (b)
          return (
            <View key={i} style={[styles.row, { paddingLeft: Math.min(b[1].length, 6) * 4 }]}>
              <Text style={[base, styles.bullet]}>•</Text>
              <Text style={[base, styles.flex]}>{inline(b[2], base, `b${i}-`)}</Text>
            </View>
          );
        const n = line.match(/^(\s*)(\d+|[A-Da-d])[.)]\s+(.*)$/);
        if (n)
          return (
            <View key={i} style={[styles.row, { paddingLeft: Math.min(n[1].length, 6) * 4 }]}>
              <Text style={[base, styles.num]}>{n[2]}.</Text>
              <Text style={[base, styles.flex]}>{inline(n[3], base, `n${i}-`)}</Text>
            </View>
          );
        return (
          <Text key={i} style={base}>
            {inline(line, base, `p${i}-`)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  bullet: { width: 16, fontWeight: '700' },
  num: { minWidth: 22, fontWeight: '700' },
  flex: { flex: 1 },
  code: { fontFamily: 'monospace', backgroundColor: '#00000010' },
});

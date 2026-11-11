import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';
import { engine, type EngineState } from '../llm/engine';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
}) {
  const bg =
    kind === 'primary' ? colors.primary : kind === 'danger' ? colors.danger : kind === 'accent' ? colors.accent : 'transparent';
  const fg = kind === 'ghost' ? colors.primary : kind === 'accent' ? colors.ink : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1.5, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, small && { fontSize: 13.5 }, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

export function useEngineState() {
  const [s, setS] = useState<EngineState>(engine.getState());
  useEffect(() => engine.subscribe(setS), []);
  return s;
}

export function EnginePill() {
  const s = useEngineState();
  const map = {
    idle: { t: 'No model', c: colors.muted },
    loading: { t: 'Loading…', c: colors.accent },
    ready: { t: 'Offline AI ready', c: colors.primary },
    error: { t: 'Error', c: colors.danger },
  } as const;
  const m = map[s.status];
  return (
    <View style={[styles.pill, { borderColor: m.c }]}>
      <View style={[styles.dot, { backgroundColor: m.c }]} />
      <Text style={[styles.pillText, { color: m.c }]}>
        {m.t}
        {s.status === 'loading' ? ` ${Math.round(s.progress)}%` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { minHeight: 38, paddingHorizontal: 12, borderRadius: radius.sm },
  btnText: { fontSize: 15.5, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
});

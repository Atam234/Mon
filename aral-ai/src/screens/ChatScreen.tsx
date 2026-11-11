import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { colors, radius } from '../theme';
import { useApp } from '../AppContext';
import { Markdown } from '../components/Markdown';
import { Button, EnginePill, useEngineState } from '../components/ui';
import { engine, type ChatMsg } from '../llm/engine';
import { getPages } from '../docs/store';
import { chunkPages, search } from '../docs/retrieval';
import { docQuestionPrompt } from '../prompts';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** The actual text sent to the AI (including PDF excerpts). */
  modelText?: string;
  docName?: string;
  pages?: number[];
};

const KEY = 'aral-ai:chat:v1';
const SUGGESTIONS = [
  'What is the difference between mitosis and meiosis?',
  'How do I solve 2x + 5 = 15? Step by step.',
  'Explain the Pythagorean theorem simply.',
  'Give me tips for reviewing for an exam.',
];

export function ChatScreen() {
  const { activeDoc, setActiveDoc, setTab, modelPath } = useApp();
  const es = useEngineState();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => s && setMsgs(JSON.parse(s)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(msgs.slice(-60))).catch(() => {});
  }, [msgs]);

  const send = async (textArg?: string) => {
    const q = (textArg ?? input).trim();
    if (!q || busy) return;
    if (es.status !== 'ready') {
      Alert.alert('No AI model yet', 'Download or import the model first in the "AI Model" tab.', [
        { text: 'OK', onPress: () => setTab('model') },
      ]);
      return;
    }
    setInput('');
    const user: Msg = { id: Date.now() + 'u', role: 'user', text: q };

    if (activeDoc) {
      const pages = await getPages(activeDoc.id);
      const hits = search(chunkPages(pages), q, 3);
      user.modelText = docQuestionPrompt(
        activeDoc.name,
        hits.map((h) => `(page ${h.page}) ${h.text}`),
        q,
      );
      user.docName = activeDoc.name;
      user.pages = Array.from(new Set(hits.map((h) => h.page)));
    }

    const next = [...msgs, user];
    setMsgs(next);
    setBusy(true);
    setStreaming('');
    activateKeepAwakeAsync('gen').catch(() => {});

    // To save memory: include PDF context only for the latest question.
    const history: ChatMsg[] = next.map((m, i) => ({
      role: m.role,
      content: i === next.length - 1 && m.modelText ? m.modelText : m.text,
    }));

    let answer = '';
    try {
      answer = await engine.generate(history, (t) => setStreaming(t));
    } catch (e: any) {
      answer = '⚠️ ' + String(e?.message ?? e);
    } finally {
      deactivateKeepAwake('gen');
    }
    setMsgs((m) => [...m, { id: Date.now() + 'a', role: 'assistant', text: answer.trim() || '(no answer)' }]);
    setStreaming(null);
    setBusy(false);
  };

  const newChat = () =>
    Alert.alert('New chat?', 'The current conversation will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => setMsgs([]) },
    ]);

  const data: Msg[] = streaming !== null ? [...msgs, { id: 'stream', role: 'assistant', text: streaming || '…' }] : msgs;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Neo.1</Text>
          <EnginePill />
        </View>
        {msgs.length > 0 && <Button title="New chat" kind="ghost" small onPress={newChat} disabled={busy} />}
      </View>

      {activeDoc && (
        <View style={styles.docBanner}>
          <Text style={styles.docBannerText} numberOfLines={2}>
            📄 Asking about: <Text style={{ fontWeight: '800' }}>{activeDoc.name}</Text>
          </Text>
          <Pressable onPress={() => setActiveDoc(null)} hitSlop={12} accessibilityLabel="Remove PDF">
            <Text style={styles.docBannerX}>✕</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>Hi! What are we studying today?</Text>
            <Text style={styles.emptySub}>
              Ask anything — no load or mobile data needed. I'll answer in Taglish.
              {!modelPath ? '\n\nBut first, set up the AI model in the "AI Model" tab.' : ''}
            </Text>
            <View style={{ gap: 8, marginTop: 14, alignSelf: 'stretch' }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.role === 'user' ? (
            <View style={[styles.bubble, styles.user]}>
              <Text style={styles.userText}>{item.text}</Text>
              {item.docName && (
                <Text style={styles.userMeta}>
                  📄 {item.docName}
                  {item.pages?.length ? ` · p. ${item.pages.join(', ')}` : ''}
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.bubble, styles.ai]}>
              <Markdown text={item.text} />
            </View>
          )
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={activeDoc ? 'Ask about this PDF…' : 'Type your question…'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
        />
        {busy ? (
          <Button title="Stop" kind="danger" small onPress={() => engine.stop()} style={styles.sendBtn} />
        ) : (
          <Button title="Send" small onPress={() => send()} disabled={!input.trim()} style={styles.sendBtn} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  docBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  docBannerText: { flex: 1, color: colors.ink, fontSize: 14 },
  docBannerX: { fontSize: 18, color: colors.ink, fontWeight: '700' },
  list: { padding: 14, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.userBubble, borderBottomRightRadius: 6 },
  userText: { color: '#fff', fontSize: 15.5, lineHeight: 22 },
  userMeta: { color: '#ffffffbb', fontSize: 12, marginTop: 4 },
  ai: {
    alignSelf: 'flex-start',
    backgroundColor: colors.aiBubble,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: colors.ink, marginTop: 8, textAlign: 'center' },
  emptySub: { color: colors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 6, textAlign: 'center' },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipText: { color: colors.ink, fontSize: 14.5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15.5,
    color: colors.ink,
  },
  sendBtn: { minHeight: 46, minWidth: 72 },
});

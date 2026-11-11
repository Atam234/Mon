import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { colors, radius } from '../theme';
import { useApp } from '../AppContext';
import { Button, Card, ProgressBar, useEngineState } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { extractPdfText } from '../docs/PdfExtractor';
import { addDoc, deleteDoc, getPages, listDocs, updateDoc, type DocMeta } from '../docs/store';
import { splitForSummary } from '../docs/retrieval';
import { engine } from '../llm/engine';
import { chunkSummaryPrompt, finalSummaryPrompt, quizPrompt } from '../prompts';

const MAX_PDF_BYTES = 40 * 1024 * 1024;

export function LibraryScreen() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [importing, setImporting] = useState<{ name: string; page: number; total: number } | null>(null);
  const [open, setOpen] = useState<DocMeta | null>(null);
  const { setActiveDoc, setTab } = useApp();

  const refresh = useCallback(() => {
    listDocs().then(setDocs);
  }, []);
  useEffect(refresh, [refresh]);

  const addPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const file = new File(a.uri);
    try {
      if (file.size > MAX_PDF_BYTES) throw new Error('This PDF is too large (over 40 MB). Please split it first.');
      setImporting({ name: a.name, page: 0, total: 0 });
      const b64 = await file.base64();
      const pages = await extractPdfText(b64, (page, total) => setImporting({ name: a.name, page, total }));
      const chars = pages.reduce((n, p) => n + p.trim().length, 0);
      if (chars < 30) {
        throw new Error(
          'No readable text found in this PDF. It may be scanned/image-only. Try a PDF with selectable text.',
        );
      }
      const meta = await addDoc(a.name, pages);
      refresh();
      setOpen(meta);
    } catch (e: any) {
      Alert.alert('Could not add PDF', String(e?.message ?? e));
    } finally {
      setImporting(null);
      try {
        if (file.exists) file.delete();
      } catch {}
    }
  };

  const ask = (d: DocMeta) => {
    setActiveDoc(d);
    setTab('chat');
  };

  const remove = (d: DocMeta) =>
    Alert.alert('Delete this PDF?', d.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(d.id);
          setActiveDoc(null);
          setOpen(null);
          refresh();
        },
      },
    ]);

  if (open) {
    return (
      <DocView
        doc={open}
        onBack={() => {
          setOpen(null);
          refresh();
        }}
        onAsk={() => ask(open)}
        onDelete={() => remove(open)}
      />
    );
  }

  return (
    <KeyboardAwareScrollView bottomOffset={32} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>PDFs</Text>
      <Text style={styles.sub}>
        Add your modules, handouts, or reviewers here. The AI can summarize them or answer questions about them — offline.
      </Text>

      {importing ? (
        <Card style={{ gap: 8 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            Reading: {importing.name}
          </Text>
          <ProgressBar value={importing.total ? importing.page / importing.total : 0.03} />
          <Text style={styles.meta}>
            {importing.total ? `Page ${importing.page} / ${importing.total}` : 'Opening PDF…'}
          </Text>
        </Card>
      ) : (
        <Button title="＋  Add a PDF" onPress={addPdf} />
      )}

      <View style={{ gap: 12, marginTop: 16 }}>
        {docs.length === 0 && !importing && (
          <Text style={[styles.meta, { textAlign: 'center', marginTop: 24 }]}>No PDFs yet. Tap the button above.</Text>
        )}
        {docs.map((d) => (
          <Pressable key={d.id} onPress={() => setOpen(d)}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 30 }}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {d.name}
                  </Text>
                  <Text style={styles.meta}>
                    {d.pages} pages{d.summary ? ' · ✅ summarized' : ''}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="💬 Ask" small onPress={() => ask(d)} style={{ flex: 1 }} />
                <Button title="📝 Summary / Quiz" small kind="ghost" onPress={() => setOpen(d)} style={{ flex: 1 }} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </KeyboardAwareScrollView>
  );
}

function DocView({ doc, onBack, onAsk, onDelete }: { doc: DocMeta; onBack: () => void; onAsk: () => void; onDelete: () => void }) {
  const es = useEngineState();
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState(String(Math.min(doc.pages, 15)));
  const [output, setOutput] = useState<string>(doc.summary ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const stopped = useRef(false);

  const range = () => {
    const f = Math.max(1, Math.min(doc.pages, parseInt(from, 10) || 1));
    const t = Math.max(f, Math.min(doc.pages, parseInt(to, 10) || doc.pages));
    return [f, t] as const;
  };

  const guard = () => {
    if (es.status !== 'ready') {
      Alert.alert('No AI model yet', 'Set up the model first in the "AI Model" tab.');
      return false;
    }
    if (engine.isBusy()) {
      Alert.alert('AI is busy', 'It is still answering in the Ask tab. Please wait.');
      return false;
    }
    return true;
  };

  const summarize = async () => {
    if (!guard()) return;
    const [f, t] = range();
    const pages = await getPages(doc.id);
    const parts = splitForSummary(pages, f, t);
    if (!parts.length) {
      Alert.alert('No text', 'No readable text on those pages.');
      return;
    }
    stopped.current = false;
    setRunning(true);
    activateKeepAwakeAsync('sum').catch(() => {});
    const partials: string[] = [];
    try {
      for (let i = 0; i < parts.length; i++) {
        if (stopped.current) break;
        setStatus(`Reading part ${i + 1} of ${parts.length}…`);
        setProgress(i / (parts.length + (parts.length > 1 ? 1 : 0)));
        const prev = partials.map((p, k) => `**Part ${k + 1}**\n${p}`).join('\n\n');
        const s = await engine.generate(
          [{ role: 'user', content: chunkSummaryPrompt(doc.name, i + 1, parts.length, parts[i]) }],
          (txt) => setOutput((prev ? prev + '\n\n' : '') + `**Part ${i + 1}**\n` + txt),
          { maxTokens: 260, temperature: 0.3 },
        );
        partials.push(s.trim());
      }
      let final = partials.length === 1 ? partials[0] : partials.map((p, k) => `**Part ${k + 1}**\n${p}`).join('\n\n');
      if (partials.length > 1 && !stopped.current) {
        // If there are too many, merge them in stages first.
        let layer = partials;
        while (layer.join('\n').length > 6000 && !stopped.current) {
          const next: string[] = [];
          for (let i = 0; i < layer.length; i += 4) {
            setStatus('Combining summaries…');
            next.push(
              await engine.generate(
                [{ role: 'user', content: chunkSummaryPrompt(doc.name, next.length + 1, Math.ceil(layer.length / 4), layer.slice(i, i + 4).join('\n')) }],
                () => {},
                { maxTokens: 260, temperature: 0.3 },
              ),
            );
          }
          layer = next;
        }
        if (!stopped.current) {
          setStatus('Writing the final reviewer…');
          setProgress(parts.length / (parts.length + 1));
          final = await engine.generate([{ role: 'user', content: finalSummaryPrompt(doc.name, layer) }], setOutput, {
            maxTokens: 600,
            temperature: 0.3,
          });
        }
      }
      const header = `_Summary of pages ${f}–${t}_\n\n`;
      setOutput(header + final.trim());
      if (!stopped.current) await updateDoc(doc.id, { summary: header + final.trim() });
    } catch (e: any) {
      Alert.alert('Error', String(e?.message ?? e));
    } finally {
      setStatus(null);
      setRunning(false);
      deactivateKeepAwake('sum');
    }
  };

  const quiz = async () => {
    if (!guard()) return;
    const [f, t] = range();
    const pages = await getPages(doc.id);
    const parts = splitForSummary(pages, f, t, 3200);
    if (!parts.length) return;
    const pick = parts[Math.floor(Math.random() * parts.length)];
    stopped.current = false;
    setRunning(true);
    setStatus('Creating a practice quiz…');
    setProgress(0.5);
    activateKeepAwakeAsync('sum').catch(() => {});
    try {
      const q = await engine.generate([{ role: 'user', content: quizPrompt(doc.name, pick) }], setOutput, {
        maxTokens: 700,
        temperature: 0.5,
      });
      setOutput(`_Practice quiz (page ${f}–${t})_\n\n` + q.trim());
    } catch (e: any) {
      Alert.alert('Error', String(e?.message ?? e));
    } finally {
      setStatus(null);
      setRunning(false);
      deactivateKeepAwake('sum');
    }
  };

  const stop = () => {
    stopped.current = true;
    engine.stop();
  };

  const [f, t] = range();
  const estParts = Math.max(1, Math.ceil(((t - f + 1) / doc.pages) * (doc.chars / 2800)));

  return (
    <KeyboardAwareScrollView bottomOffset={32} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}>
      <Pressable onPress={onBack} disabled={running} hitSlop={10}>
        <Text style={[styles.back, running && { opacity: 0.4 }]}>‹ PDFs</Text>
      </Pressable>
      <Text style={styles.h1} numberOfLines={3}>
        {doc.name}
      </Text>
      <Text style={styles.meta}>{doc.pages} pages</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Button title="💬 Ask about this PDF" onPress={onAsk} style={{ flex: 1 }} disabled={running} />
      </View>

      <Card style={{ marginTop: 14, gap: 10 }}>
        <Text style={styles.cardTitle}>Which pages do you want to study?</Text>
        <View style={styles.rangeRow}>
          <Text style={styles.meta}>From page</Text>
          <TextInput style={styles.num} keyboardType="number-pad" value={from} onChangeText={setFrom} editable={!running} />
          <Text style={styles.meta}>to</Text>
          <TextInput style={styles.num} keyboardType="number-pad" value={to} onChangeText={setTo} editable={!running} />
        </View>
        <Text style={styles.meta}>
          {estParts} part(s) · about {Math.max(1, Math.round((estParts * 35) / 60))} min on a typical phone
          {estParts > 12 ? '. Tip: use a shorter page range for faster results.' : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="📝 Summarize" onPress={summarize} style={{ flex: 1 }} disabled={running} />
          <Button title="❓ Quiz me" kind="accent" onPress={quiz} style={{ flex: 1 }} disabled={running} />
        </View>
      </Card>

      {running && (
        <Card style={{ marginTop: 14, gap: 8 }}>
          <Text style={styles.meta}>{status}</Text>
          <ProgressBar value={progress} />
          <Button title="Stop" kind="danger" small onPress={stop} />
        </Card>
      )}

      {!!output && (
        <Card style={{ marginTop: 14 }}>
          <Markdown text={output} />
        </Card>
      )}

      <Button title="Delete this PDF" kind="danger" small onPress={onDelete} style={{ marginTop: 24 }} disabled={running} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  num: {
    minWidth: 58,
    height: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
});

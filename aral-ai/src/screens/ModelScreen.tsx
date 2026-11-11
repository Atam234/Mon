import React, { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, Card, ProgressBar, useEngineState } from '../components/ui';
import { colors } from '../theme';
import { useApp } from '../AppContext';
import { engine } from '../llm/engine';
import {
  MODEL_APPROX_BYTES,
  MODEL_NAME,
  deleteModel,
  downloadModel,
  formatBytes,
  getInstalledModel,
  importModelFromUri,
  type DownloadHandle,
} from '../llm/model';

export function ModelScreen() {
  const { modelPath, setModelPath, setTab } = useApp();
  const es = useEngineState();
  const [dl, setDl] = useState<{ written: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const handle = useRef<DownloadHandle | null>(null);
  const installed = modelPath ? getInstalledModel() : null;

  const loadAndGo = async (path: string) => {
    setModelPath(path);
    try {
      await engine.load(path);
      setTab('chat');
    } catch {}
  };

  const startDownload = () => {
    Alert.alert(
      'Download the AI model?',
      `It is about ${formatBytes(MODEL_APPROX_BYTES)}. Use Wi-Fi (school, home, or piso-WiFi). You only need to do this ONCE — after that, everything works offline.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            setDl({ written: 0, total: MODEL_APPROX_BYTES });
            activateKeepAwakeAsync('dl').catch(() => {});
            const h = downloadModel((written, total) => setDl({ written, total }));
            handle.current = h;
            try {
              const path = await h.done;
              await loadAndGo(path);
            } catch (e: any) {
              Alert.alert('Download failed', String(e?.message ?? e) + '\n\nPlease try again when your internet connection is stable.');
            } finally {
              handle.current = null;
              setDl(null);
              deactivateKeepAwake('dl');
            }
          },
        },
      ],
    );
  };

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!/\.gguf$/i.test(a.name)) {
      Alert.alert('Wrong file', 'Please choose a .gguf file (e.g. ' + MODEL_NAME + ').');
      return;
    }
    setImporting(true);
    try {
      const path = await importModelFromUri(a.uri);
      await loadAndGo(path);
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    } finally {
      setImporting(false);
    }
  };

  const shareModel = async () => {
    if (!installed) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Not available', 'Sharing is not available on this phone.');
      return;
    }
    await Sharing.shareAsync(installed.path, { dialogTitle: 'Share the AI model with a classmate', mimeType: 'application/octet-stream' });
  };

  const remove = () =>
    Alert.alert('Delete the AI model?', 'You will need to download or import it again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await engine.unload();
          deleteModel();
          setModelPath(null);
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>AI Model</Text>
      <Text style={styles.sub}>
        Neo.1 uses <Text style={styles.b}>Gemma 3 1B</Text> (Q8_0), running entirely on your phone. No load, no
        mobile data — once installed, it works even in airplane mode.
      </Text>

      {installed ? (
        <Card style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>✅ Model installed</Text>
          <Text style={styles.meta}>
            {MODEL_NAME} · {formatBytes(installed.size)}
          </Text>
          {es.status === 'loading' && (
            <View style={{ gap: 6 }}>
              <Text style={styles.meta}>Loading into memory… {Math.round(es.progress)}%</Text>
              <ProgressBar value={es.progress / 100} />
            </View>
          )}
          {es.status === 'ready' && <Text style={[styles.meta, { color: colors.primary }]}>Ready! Go to the Ask tab.</Text>}
          {es.status === 'error' && <Text style={[styles.meta, { color: colors.danger }]}>{es.message}</Text>}
          {(es.status === 'idle' || es.status === 'error') && (
            <Button title="Load model" onPress={() => loadAndGo(installed.path)} />
          )}
          <Button title="📤  Share with a classmate (Bluetooth / Nearby)" kind="ghost" onPress={shareModel} />
          <Button title="Delete model" kind="danger" small onPress={remove} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: 12 }}>
            <Text style={styles.cardTitle}>Option 1: Download (one time only)</Text>
            <Text style={styles.meta}>About {formatBytes(MODEL_APPROX_BYTES)} — use Wi-Fi.</Text>
            {dl ? (
              <View style={{ gap: 8 }}>
                <ProgressBar value={dl.written / dl.total} />
                <Text style={styles.meta}>
                  {formatBytes(dl.written)} / {formatBytes(dl.total)} ({Math.floor((dl.written / dl.total) * 100)}%)
                </Text>
                <Button title="Stop" kind="ghost" small onPress={() => handle.current?.cancel()} />
              </View>
            ) : (
              <Button title="⬇️  Download AI model" onPress={startDownload} disabled={importing} />
            )}
          </Card>

          <Card style={{ gap: 12, marginTop: 14 }}>
            <Text style={styles.cardTitle}>Option 2: Get it from a classmate (no load needed!)</Text>
            <Text style={styles.meta}>
              If a classmate already has Neo.1, ask them to share the model file (Bluetooth, Nearby Share, ShareMe, or USB).
              Then pick the <Text style={styles.b}>.gguf</Text> file here.
            </Text>
            <Button title="📁  Choose a .gguf file" kind="ghost" onPress={importFile} loading={importing} disabled={!!dl} />
          </Card>
        </>
      )}

      <Card style={{ marginTop: 14, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <Text style={styles.cardTitle}>💡 Notes</Text>
        <Text style={styles.tip}>• Requires a 64-bit phone with 3 GB RAM or more (4 GB recommended).</Text>
        <Text style={styles.tip}>• About 1.5 GB of free storage is needed.</Text>
        <Text style={styles.tip}>• This is a small AI, so it can make mistakes. Always double-check with your book or teacher.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 16 },
  b: { fontWeight: '700', color: colors.ink },
  cardTitle: { fontSize: 16.5, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  tip: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 4 },
});

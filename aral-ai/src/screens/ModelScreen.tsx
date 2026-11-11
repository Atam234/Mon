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
      'I-download ang AI model?',
      `Mga ${formatBytes(MODEL_APPROX_BYTES)} ito. Gawin ito sa Wi-Fi (school, bahay, o piso-WiFi). ISANG BESES lang ito — pagkatapos, offline na lahat.`,
      [
        { text: 'Hindi muna', style: 'cancel' },
        {
          text: 'I-download',
          onPress: async () => {
            setDl({ written: 0, total: MODEL_APPROX_BYTES });
            activateKeepAwakeAsync('dl').catch(() => {});
            const h = downloadModel((written, total) => setDl({ written, total }));
            handle.current = h;
            try {
              const path = await h.done;
              await loadAndGo(path);
            } catch (e: any) {
              Alert.alert('Hindi natuloy ang download', String(e?.message ?? e) + '\n\nSubukan ulit kapag maayos na ang internet.');
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
      Alert.alert('Maling file', 'Pumili ng .gguf na file (hal. ' + MODEL_NAME + ').');
      return;
    }
    setImporting(true);
    try {
      const path = await importModelFromUri(a.uri);
      await loadAndGo(path);
    } catch (e: any) {
      Alert.alert('Hindi ma-import', String(e?.message ?? e));
    } finally {
      setImporting(false);
    }
  };

  const shareModel = async () => {
    if (!installed) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Hindi available', 'Walang share feature sa phone na ito.');
      return;
    }
    await Sharing.shareAsync(installed.path, { dialogTitle: 'I-share ang AI model sa kaklase', mimeType: 'application/octet-stream' });
  };

  const remove = () =>
    Alert.alert('Burahin ang AI model?', 'Kailangan mo ulit itong i-download o i-import para magamit ang app.', [
      { text: 'Huwag', style: 'cancel' },
      {
        text: 'Burahin',
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
        Gumagamit ang Neo.1 ng <Text style={styles.b}>Gemma 3 1B</Text> (Q8_0) na tumatakbo mismo sa phone mo. Walang load,
        walang data — pagka-install, kahit naka-airplane mode ka pa.
      </Text>

      {installed ? (
        <Card style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>✅ Naka-install na ang model</Text>
          <Text style={styles.meta}>
            {MODEL_NAME} · {formatBytes(installed.size)}
          </Text>
          {es.status === 'loading' && (
            <View style={{ gap: 6 }}>
              <Text style={styles.meta}>Nilo-load sa memory… {Math.round(es.progress)}%</Text>
              <ProgressBar value={es.progress / 100} />
            </View>
          )}
          {es.status === 'ready' && <Text style={[styles.meta, { color: colors.primary }]}>Handa na! Pumunta sa Tanong tab.</Text>}
          {es.status === 'error' && <Text style={[styles.meta, { color: colors.danger }]}>{es.message}</Text>}
          {(es.status === 'idle' || es.status === 'error') && (
            <Button title="I-load ang model" onPress={() => loadAndGo(installed.path)} />
          )}
          <Button title="📤  I-share sa kaklase (Bluetooth / Nearby)" kind="ghost" onPress={shareModel} />
          <Button title="Burahin ang model" kind="danger" small onPress={remove} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: 12 }}>
            <Text style={styles.cardTitle}>Option 1: I-download (isang beses lang)</Text>
            <Text style={styles.meta}>Mga {formatBytes(MODEL_APPROX_BYTES)} — gamitin ang Wi-Fi.</Text>
            {dl ? (
              <View style={{ gap: 8 }}>
                <ProgressBar value={dl.written / dl.total} />
                <Text style={styles.meta}>
                  {formatBytes(dl.written)} / {formatBytes(dl.total)} ({Math.floor((dl.written / dl.total) * 100)}%)
                </Text>
                <Button title="Ihinto" kind="ghost" small onPress={() => handle.current?.cancel()} />
              </View>
            ) : (
              <Button title="⬇️  I-download ang AI model" onPress={startDownload} disabled={importing} />
            )}
          </Card>

          <Card style={{ gap: 12, marginTop: 14 }}>
            <Text style={styles.cardTitle}>Option 2: Kunin sa kaklase (walang load!)</Text>
            <Text style={styles.meta}>
              Kung may kaklase kang may Neo.1 na, ipa-share sa kanya ang model file (Bluetooth, Nearby Share, ShareMe, o USB).
              Tapos piliin dito ang <Text style={styles.b}>.gguf</Text> file.
            </Text>
            <Button title="📁  Pumili ng .gguf file" kind="ghost" onPress={importFile} loading={importing} disabled={!!dl} />
          </Card>
        </>
      )}

      <Card style={{ marginTop: 14, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <Text style={styles.cardTitle}>💡 Paalala</Text>
        <Text style={styles.tip}>• Kailangan ng phone na 64-bit, may 3 GB RAM pataas (mas maganda kung 4 GB).</Text>
        <Text style={styles.tip}>• Mga 1.5 GB na libreng storage ang kailangan.</Text>
        <Text style={styles.tip}>• Maliit na AI ito, kaya minsan nagkakamali. I-double check pa rin sa libro o sa teacher.</Text>
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

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppContext, type Tab } from './src/AppContext';
import { colors } from './src/theme';
import { ChatScreen } from './src/screens/ChatScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ModelScreen } from './src/screens/ModelScreen';
import { PdfExtractorHost } from './src/docs/PdfExtractor';
import { getInstalledModel } from './src/llm/model';
import { engine } from './src/llm/engine';
import type { DocMeta } from './src/docs/store';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'chat', label: 'Ask', icon: '💬' },
  { key: 'pdf', label: 'PDFs', icon: '📄' },
  { key: 'model', label: 'AI Model', icon: '🧠' },
];

export default function App() {
  const [modelPath, setModelPath] = useState<string | null>(() => getInstalledModel()?.path ?? null);
  const [tab, setTab] = useState<Tab>(modelPath ? 'chat' : 'model');
  const [activeDoc, setActiveDoc] = useState<DocMeta | null>(null);

  // Load the model right away if it is installed.
  useEffect(() => {
    if (modelPath && engine.getState().status === 'idle') engine.load(modelPath).catch(() => {});
  }, [modelPath]);

  const ctx = useMemo(
    () => ({ tab, setTab, modelPath, setModelPath, activeDoc, setActiveDoc }),
    [tab, modelPath, activeDoc],
  );

  return (
    <SafeAreaProvider>
      <AppContext.Provider value={ctx}>
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar style="dark" />
          <PdfExtractorHost />
          {/* Keep all screens mounted so AI work is not interrupted when switching tabs. */}
          <View style={[styles.screen, tab !== 'chat' && styles.hidden]}>
            <ChatScreen />
          </View>
          <View style={[styles.screen, tab !== 'pdf' && styles.hidden]}>
            <LibraryScreen />
          </View>
          <View style={[styles.screen, tab !== 'model' && styles.hidden]}>
            <ModelScreen />
          </View>
          <View style={styles.tabbar}>
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  style={styles.tab}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tabIcon, !on && { opacity: 0.55 }]}>{t.icon}</Text>
                  <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                  {on && <View style={styles.tabMark} />}
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  hidden: { display: 'none' },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 8, minHeight: 58 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '600' },
  tabLabelOn: { color: colors.primary, fontWeight: '800' },
  tabMark: { position: 'absolute', top: 0, width: 36, height: 3, borderRadius: 2, backgroundColor: colors.primary },
});

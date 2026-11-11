import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import pdfjsHtml from './pdfjsHtml';

/**
 * Hidden WebView running pdf.js to extract PDF text — 100% offline.
 * Mount <PdfExtractorHost /> once in App, then call
 * extractPdfText() from anywhere.
 */

type Job = {
  resolve: (pages: string[]) => void;
  reject: (e: Error) => void;
  onProgress?: (page: number, total: number) => void;
};

let webview: WebView | null = null;
let ready = false;
let readyWaiters: (() => void)[] = [];
const jobs = new Map<string, Job>();

function waitReady(timeoutMs = 15000) {
  if (ready && webview) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('The PDF reader failed to start.')), timeoutMs);
    readyWaiters.push(() => {
      clearTimeout(t);
      resolve();
    });
  });
}

export async function extractPdfText(
  base64: string,
  onProgress?: (page: number, total: number) => void,
): Promise<string[]> {
  await waitReady();
  const id = Math.random().toString(36).slice(2);
  return new Promise<string[]>((resolve, reject) => {
    jobs.set(id, { resolve, reject, onProgress });
    webview!.postMessage(JSON.stringify({ type: 'extract', id, base64 }));
  });
}

export function PdfExtractorHost() {
  const ref = useRef<WebView>(null);

  useEffect(() => {
    webview = ref.current;
    return () => {
      webview = null;
      ready = false;
    };
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      ready = true;
      webview = ref.current;
      const w = readyWaiters;
      readyWaiters = [];
      w.forEach((f) => f());
      return;
    }
    const job = jobs.get(msg.id);
    if (!job) return;
    if (msg.type === 'progress') job.onProgress?.(msg.page, msg.total);
    else if (msg.type === 'done') {
      jobs.delete(msg.id);
      job.resolve(msg.pages as string[]);
    } else if (msg.type === 'error') {
      jobs.delete(msg.id);
      const m = String(msg.message || '');
      job.reject(
        new Error(/password/i.test(m) ? 'This PDF is password-protected.' : 'Could not read the PDF: ' + m),
      );
    }
  };

  return (
    <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: pdfjsHtml, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        onContentProcessDidTerminate={() => ref.current?.reload()}
        onRenderProcessGone={() => {
          ready = false;
          jobs.forEach((j) => j.reject(new Error('This PDF is too large for this phone.')));
          jobs.clear();
          ref.current?.reload();
        }}
      />
    </View>
  );
}

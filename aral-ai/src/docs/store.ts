import { Directory, File, Paths } from 'expo-file-system';

export type DocMeta = {
  id: string;
  name: string;
  pages: number;
  chars: number;
  addedAt: number;
  summary?: string;
};

const dir = () => new Directory(Paths.document, 'library');
const indexFile = () => new File(dir(), 'index.json');
const pagesFile = (id: string) => new File(dir(), `${id}.json`);

function ensure() {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

export async function listDocs(): Promise<DocMeta[]> {
  ensure();
  const f = indexFile();
  if (!f.exists) return [];
  try {
    return JSON.parse(await f.text()) as DocMeta[];
  } catch {
    return [];
  }
}

function saveIndex(docs: DocMeta[]) {
  ensure();
  const f = indexFile();
  if (!f.exists) f.create();
  f.write(JSON.stringify(docs));
}

export async function addDoc(name: string, pages: string[]): Promise<DocMeta> {
  ensure();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pf = pagesFile(id);
  pf.create();
  pf.write(JSON.stringify(pages));
  const meta: DocMeta = {
    id,
    name: name.replace(/\.pdf$/i, ''),
    pages: pages.length,
    chars: pages.reduce((a, p) => a + p.length, 0),
    addedAt: Date.now(),
  };
  const docs = await listDocs();
  saveIndex([meta, ...docs]);
  return meta;
}

export async function getPages(id: string): Promise<string[]> {
  const f = pagesFile(id);
  if (!f.exists) return [];
  return JSON.parse(await f.text()) as string[];
}

export async function updateDoc(id: string, patch: Partial<DocMeta>) {
  const docs = await listDocs();
  saveIndex(docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

export async function deleteDoc(id: string) {
  const f = pagesFile(id);
  if (f.exists) f.delete();
  const docs = await listDocs();
  saveIndex(docs.filter((d) => d.id !== id));
}

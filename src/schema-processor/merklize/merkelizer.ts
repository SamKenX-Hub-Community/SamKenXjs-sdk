import MerkleTree, { addEntriesToMerkleTree } from './merkleTree';
import { IHasher } from './types';
import { Literal, Parser, Quad } from 'n3';
import { DEFAULT_HASHER } from './constants';
import { RdfEntry } from './rdfEntry';
import { newPathFromDocument, Path } from './path';
import { canonize, JsonLdDocument } from 'jsonld';
import { getJsonLdDocLoader } from './documentLoaders/dlJSONLD';
import { Value } from './value';
import { getQuadKey } from './quadKey';
import { newRelationship } from './relationship';
import { newNodeId } from './nodeID';
import LDCtx from './ldCTX';
import { Hash } from '@iden3/js-merkletree';

export class Merkelizer {
  constructor(
    public srcDoc: string = null,
    public mt: MerkleTree = new MerkleTree(),
    public hasher: IHasher = DEFAULT_HASHER,
    public entries: Map<string, RdfEntry> = new Map()
  ) {}

  async proof(p: Path) {
    const kHash = await p.mtEntry();
    const { proof } = await this.mt.generateProof(kHash);

    let value: Value;

    if (proof.existence) {
      if (!this.entries.has(kHash.toString())) {
        throw 'error: [assertion] no entry found while existence is true';
      }

      const entry = this.entries.get(kHash.toString());
      value = new Value(entry.value);
    }

    return { proof, value };
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  mkValue(val: any): Value {
    return new Value(val);
  }

  async resolveDocPath(path: string): Promise<Path> {
    const ldCTX = new LDCtx();
    const realPath = await newPathFromDocument(ldCTX, this.srcDoc, path);
    realPath.hasher = this.hasher;
    return realPath;
  }

  root(): Hash {
    return this.mt.root();
  }
}
export const getDataSet = async (doc: JsonLdDocument) => {
  const normalizedData = await canonize(doc, {
    format: 'application/n-quads',
    documentLoader: getJsonLdDocLoader()
  });

  const parser = new Parser({ format: 'application/N-Quads' });
  return parser.parse(normalizedData);
};

export const merkelizeJSONLD = async (docStr: string): Promise<Merkelizer> => {
  const mz = new Merkelizer(docStr);
  const dataset = await getDataSet(JSON.parse(mz.srcDoc));
  const entries = await entriesFromRDFHasher(dataset, DEFAULT_HASHER);

  for (const e of entries) {
    const k = await e.getKeyMtEntry();
    mz.entries.set(k.toString(), e);
  }

  await addEntriesToMerkleTree(mz.mt, entries);
  return mz;
};

export const countEntries = (nodes: Array<Quad>) => {
  const res: Map<string, number> = new Map();
  nodes.forEach((q) => {
    const key = getQuadKey(q);
    if (!key) {
      throw 'error: empty quad key';
    }
    const c = res.has(key.toString()) ? res.get(key.toString()) : 0;
    res.set(key.toString(), c + 1);
  });

  return res;
};

export const entriesFromRDF = (quads: Array<Quad>, hasher: IHasher) => {
  return entriesFromRDFHasher(quads, hasher);
};

export const entriesFromRDFHasher = async (quads: Array<Quad>, hasher: IHasher) => {
  if (!quads.length) {
    throw 'error: quads are empty';
  }

  const counts = countEntries(quads);
  const seenCount: Map<string, number> = new Map();

  const rs = await newRelationship(quads, hasher);

  const entries: Array<RdfEntry> = [];

  for (const q of quads) {
    const e = new RdfEntry(new Path(), null);
    const qo = q.object.termType;
    const qoVal = q.object.value;

    switch (qo) {
      case 'Literal':
        // eslint-disable-next-line no-case-declarations
        const dataType = getObjectDatatype(q.object as Literal);
        switch (dataType) {
          case 'http://www.w3.org/2001/XMLSchema#boolean':
            switch (qoVal) {
              case 'false':
                e.value = false;
                break;
              case 'true':
                e.value = true;
                break;
              default:
                throw 'incorrect boolean value.ts';
            }
            break;
          case 'http://www.w3.org/2001/XMLSchema#integer':
          case 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger':
          case 'http://www.w3.org/2001/XMLSchema#nonPositiveInteger':
          case 'http://www.w3.org/2001/XMLSchema#negativeInteger':
          case 'http://www.w3.org/2001/XMLSchema#positiveInteger':
            e.value = BigInt(parseInt(qoVal));
            break;
          case 'http://www.w3.org/2001/XMLSchema#dateTime':
            // e.value.ts = DateTime.fromISO("1958-07-17 00:00:00 +0000")
            // const dateRegEx = /^\d{4}-\d{2}-\d{2}$/
            if (isNaN(Date.parse(qoVal))) {
              throw `error: error parsing time string ${qoVal}`;
            }
            e.value = new Date(Date.parse(qoVal));
            break;
          default:
            e.value = qoVal;
        }
        break;
      case 'BlankNode':
        // eslint-disable-next-line no-case-declarations
        const nID = newNodeId(q.object);
        // eslint-disable-next-line no-case-declarations
        const p = rs.getParten(nID);
        if (p) {
          continue;
        }
        throw '[1] BlankNode is not supported yet';
      case 'NamedNode':
      case 'Variable':
        e.value = qoVal;
        break;
      default:
        throw "unexpected Quad's Object type";
    }

    const qKey = getQuadKey(q);
    let idx = NaN;
    switch (counts.get(qKey.toString())) {
      case 0:
        throw '[assertion] key not found in counts';
      case 1:
        // leave idx nil: only one element, do not consider it as an array
        break;
      default:
        idx = seenCount.get(qKey.toString()) ? seenCount.get(qKey.toString()) : 0;
        seenCount.set(qKey.toString(), idx + 1);
    }
    e.key = rs.path(q, idx);
    entries.push(e);
  }
  return entries;
};

const getObjectDatatype = (q: Literal) => {
  return q.datatype.value;
};

import { BrowserLocalStorage } from './index';
import { ProofQuery, W3CCredential } from '../../verifiable';
import { StorageErrors } from '../errors';
import { StandardJSONCredentielsQueryFilter } from '../filters/jsonQuery';
import { ICredentialStorage } from '../interfaces';

export type W3CStoreRecord = {
  [v in string]: W3CCredential[];
};

export class BrowserCredentialStorage
  extends BrowserLocalStorage<W3CStoreRecord>
  implements ICredentialStorage
{
  constructor(private secret: string = 'main') {
    super(BrowserCredentialStorage.storageKey);
  }

  get data(): W3CCredential[] {
    const data = this.load();
    return data[this.secret] || [];
  }

  set data(newData) {
    const data = this.load();
    data[this.secret] = newData;
    this.save(data);
  }

  static storageKey = 'credentials';

  async listCredentials(): Promise<W3CCredential[]> {
    return this.data;
  }

  async saveCredential(credential: W3CCredential): Promise<void> {
    this.data = [...this.data, credential];
  }

  async saveAllCredentials(credentials: W3CCredential[]): Promise<void> {
    this.data = [...this.data, ...credentials];
  }

  async removeCredential(id: string): Promise<void> {
    const newData = this.data.filter((credential) => credential.id !== id);

    if (newData.length === this.data.length) {
      throw new Error(StorageErrors.NotFoundCredentialForRemove);
    }

    this.data = newData;
  }

  async findCredentialById(id: string): Promise<W3CCredential | undefined> {
    return this.data.find((cred) => cred.id === id);
  }

  async findCredentialsByQuery(query: ProofQuery): Promise<W3CCredential[]> {
    const filters = StandardJSONCredentielsQueryFilter(query);
    return this.data.filter((credential) => filters.every((filter) => filter.execute(credential)));
  }
}

// StateInfo information about state from chain.
export interface StateInfo {
  state: bigint;
  blockNumber: number;
  blockTime: number;
}
export interface IStateStorage {
  getLatestStateById(address: string, issuerId: bigint): StateInfo;
}
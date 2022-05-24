import {PiniaPluginContext, StateTree, PiniaCustomStateProperties} from 'pinia';

import {AES} from 'crypto-js'

type Store = PiniaPluginContext['store'];

type PersistOptions = {
  // Turn on the log function , feature under development ...
  log?: boolean;
  // 是否开启持久化存储
  enabled?: boolean;
  // A single store needs to store part of the key-value, the default is to store all
  keys?: string[]
  // Using Storage Types, default is localStorage
  storage?: Storage;
  //  Encrypt key, if not passed then not encrypted
  encryptionKey?: string;
  // Whether to retain data after component destruction
  detached?: boolean
}

declare module 'pinia' {
  export interface DefineStoreOptionsBase<S, Store> {
    persist?: PersistOptions;
  }
}


const stateEncrypt = (state: StateTree & PiniaCustomStateProperties, key?: string,) => {
  return key ? AES.encrypt(JSON.stringify(state), key).toString() : JSON.stringify(state);
}

const storageSet = (store: Store, storage: Storage, encryptionKey?: string, keys?: string[]) => {
  if (!keys) {
    const state = stateEncrypt(store.$state, encryptionKey);
    storage.setItem(store.$id, state);
  } else {
    const state: Record<string, any> = {};
    keys.forEach(key => {
      const value = store.$state[key];
      if (value !== undefined && value !== null) {
        state[key] = store.$state[key];
      } else {
        console.warn('Persist key not found', key, store.$id);
      }
    });
    storage.setItem(store.$id, stateEncrypt(state, encryptionKey)
    );
  }
}

const storageSync = (store: Store, storage: Storage, oldState: string | null, encryptionKey?: string, keys?: string[]) => {
  if (oldState) {
    let stateObj = JSON.parse(oldState);
    if (encryptionKey) {
      const bytes = AES.decrypt(oldState, encryptionKey);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      stateObj = JSON.parse(originalText);
    }

    if (!keys) {
      store.$patch(stateObj);
    } else {
      keys.forEach(key => {
        store.$patch((state: StateTree) => {
          if (state?.[key] !== undefined && state?.[key] !== null) {
            state[key] = stateObj[key];
          } else {
            console.warn(`${store.$id} not found key ${key}`);
          }
        });
      })
    }
  } else {
    storageSet(store, storage, encryptionKey, keys);
  }
}

export function myPiniaPlugin({store, options}: PiniaPluginContext) {
  if (options.persist?.enabled) {
    if (options.persist.keys && !Array.isArray(options.persist.keys)) {
      console.warn('Persist keys is String[]', store.$id);
    }

    const keys = options.persist?.keys
    const storage = options.persist?.storage || localStorage;
    const encryptionKey = options.persist?.encryptionKey

    try {
      const oldState = storage.getItem(store.$id);
      storageSync(store, storage, oldState, encryptionKey, keys);
    } catch (error) {
      console.error('Persist error', error);
    }

    store.$subscribe(() => {
      console.log('Persist update', store.$state);
      storageSet(store, storage, encryptionKey, keys);
    }, {
      detached: options.persist?.detached || true,
      deep: true,
    });
  } else {
    console.warn('Persistence is used but persistent storage is not enabled, please check the configuration', store.$id);
  }
}
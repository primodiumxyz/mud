import { EntityID } from "@latticexyz/recs";
import { packTuple } from "@latticexyz/utils";
import { NetworkComponentUpdate } from "../../types";
import {
  createCacheStore,
  getCacheStoreEntries,
  getIndexDbECSCache,
  loadIndexDbCacheStore,
  mergeCacheStores,
  saveCacheStoreToIndexDb,
  storeEvent,
} from "./CacheStore";

import "fake-indexeddb/auto";

describe("CacheStore", () => {
  describe("createCacheStore", () => {
    it("should return a new cache store object", () => {
      const cacheStore = createCacheStore();
      expect(cacheStore.components.length).toBe(0);
      expect(cacheStore.entities.length).toBe(0);
      expect(cacheStore.componentToIndex.size).toBe(0);
      expect(cacheStore.entityToIndex.size).toBe(0);
      expect(cacheStore.state.size).toBe(0);
      expect(cacheStore.blockNumber).toBe(0);
    });
  });

  describe("storeEvent", () => {
    it("should store events to the cacheStore", () => {
      const event: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 1, y: 2 },
        lastEventInTx: false,
        blockNumber: 1,
        txHash: "",
      };

      const cacheStore = createCacheStore();
      storeEvent(cacheStore, event);

      expect(cacheStore.components).toEqual(["Position"]);
      expect(cacheStore.entities).toEqual(["0x0"]);
      expect(cacheStore.componentToIndex.get("Position")).toBe(0);
      expect(cacheStore.entityToIndex.get("0x0")).toBe(0);
      expect(cacheStore.state.size).toBe(1);
      expect(cacheStore.blockNumber).toBe(0);
      expect([...cacheStore.state.entries()]).toEqual([[packTuple([0, 0]), { x: 1, y: 2 }]]);

      const event2: NetworkComponentUpdate = {
        entity: "0x1" as EntityID,
        component: "Position",
        value: { x: 1, y: 2 },
        lastEventInTx: true,
        blockNumber: 1,
        txHash: "",
      };
      storeEvent(cacheStore, event2);

      expect(cacheStore.components).toEqual(["Position"]);
      expect(cacheStore.entities).toEqual(["0x0", "0x1"]);
      expect(cacheStore.componentToIndex.get("Position")).toBe(0);
      expect(cacheStore.entityToIndex.get("0x0")).toBe(0);
      expect(cacheStore.entityToIndex.get("0x1")).toBe(1);
      expect(cacheStore.state.size).toBe(2);
      expect(cacheStore.blockNumber).toBe(0);
      expect([...cacheStore.state.entries()]).toEqual([
        [packTuple([0, 0]), { x: 1, y: 2 }],
        [packTuple([0, 1]), { x: 1, y: 2 }],
      ]);
    });

    it("should set block number to one less than the last received event", () => {
      const event: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 1, y: 2 },
        lastEventInTx: false,
        blockNumber: 1,
        txHash: "",
      };

      const cacheStore = createCacheStore();
      storeEvent(cacheStore, event);
      expect(cacheStore.blockNumber).toBe(0);

      storeEvent(cacheStore, { ...event, blockNumber: 2 });
      expect(cacheStore.blockNumber).toBe(1);
    });
  });

  describe("getCacheStoreEntries", () => {
    it("should return an interator of NetworkComponentUpdates representing the current state", () => {
      const cacheStore = createCacheStore();

      const event: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 1, y: 2 },
        lastEventInTx: false,
        blockNumber: 1,
        txHash: "",
      };

      storeEvent(cacheStore, event);

      expect([...getCacheStoreEntries(cacheStore)]).toEqual([
        {
          entity: "0x0",
          component: "Position",
          value: { x: 1, y: 2 },
          lastEventInTx: false,
          blockNumber: 0,
          txHash: "cache",
        },
      ]);

      const event2: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 2, y: 2 },
        lastEventInTx: false,
        blockNumber: 2,
        txHash: "",
      };

      storeEvent(cacheStore, event2);

      expect([...getCacheStoreEntries(cacheStore)]).toEqual([
        {
          entity: "0x0",
          component: "Position",
          value: { x: 2, y: 2 },
          lastEventInTx: false,
          blockNumber: 1,
          txHash: "cache",
        },
      ]);

      const event3: NetworkComponentUpdate = {
        entity: "0x1" as EntityID,
        component: "Position",
        value: { x: -1, y: 2 },
        lastEventInTx: false,
        blockNumber: 3,
        txHash: "",
      };

      storeEvent(cacheStore, event3);

      expect([...getCacheStoreEntries(cacheStore)]).toEqual([
        {
          entity: "0x0",
          component: "Position",
          value: { x: 2, y: 2 },
          lastEventInTx: false,
          blockNumber: 2,
          txHash: "cache",
        },
        {
          entity: "0x1",
          component: "Position",
          value: { x: -1, y: 2 },
          lastEventInTx: false,
          blockNumber: 2,
          txHash: "cache",
        },
      ]);
    });
  });

  describe("mergeCacheStores", () => {
    it("should return a new cache store including the state of all input cache stores", () => {
      const cacheStore1 = createCacheStore();
      const cacheStore2 = createCacheStore();

      const event1: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 1, y: 2 },
        lastEventInTx: false,
        blockNumber: 1,
        txHash: "",
      };

      const event2: NetworkComponentUpdate = {
        entity: "0x1" as EntityID,
        component: "Health",
        value: { value: 1 },
        lastEventInTx: false,
        blockNumber: 2,
        txHash: "",
      };

      storeEvent(cacheStore1, event1);
      storeEvent(cacheStore1, event2);

      const event3: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 3, y: 2 },
        lastEventInTx: false,
        blockNumber: 3,
        txHash: "",
      };

      const event4: NetworkComponentUpdate = {
        entity: "0x0" as EntityID,
        component: "Speed",
        value: { value: 10 },
        lastEventInTx: true,
        blockNumber: 4,
        txHash: "",
      };

      storeEvent(cacheStore2, event3);
      storeEvent(cacheStore2, event4);

      const mergedCacheStore = mergeCacheStores([cacheStore1, cacheStore2]);

      const entries = [...getCacheStoreEntries(mergedCacheStore)];

      expect(entries).toEqual([
        {
          entity: "0x0",
          component: "Position",
          value: { x: 3, y: 2 },
          lastEventInTx: false,
          blockNumber: 3,
          txHash: "cache",
        },
        {
          entity: "0x1",
          component: "Health",
          value: { value: 1 },
          lastEventInTx: false,
          blockNumber: 3,
          txHash: "cache",
        },
        {
          entity: "0x0",
          component: "Speed",
          value: { value: 10 },
          lastEventInTx: false,
          blockNumber: 3,
          txHash: "cache",
        },
      ]);
    });
  });

  describe("indexDB", () => {
    it("should store and load a cacheStore to/from indexDB", async () => {
      const cache = await getIndexDbECSCache(4242, "0x0", 1, indexedDB);

      const cacheStore = createCacheStore();

      storeEvent(cacheStore, {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 1, y: 2 },
        blockNumber: 1,
      });

      storeEvent(cacheStore, {
        entity: "0x1" as EntityID,
        component: "Health",
        value: { value: 1 },
        blockNumber: 2,
      });

      storeEvent(cacheStore, {
        entity: "0x0" as EntityID,
        component: "Position",
        value: { x: 3, y: 2 },
        blockNumber: 3,
      });

      storeEvent(cacheStore, {
        entity: "0x0" as EntityID,
        component: "Speed",
        value: { value: 10 },
        blockNumber: 4,
      });

      await saveCacheStoreToIndexDb(cache, cacheStore);
      const loadedCacheStore = await loadIndexDbCacheStore(cache);

      expect([...getCacheStoreEntries(loadedCacheStore)]).toEqual([...getCacheStoreEntries(cacheStore)]);
    });
  });
});

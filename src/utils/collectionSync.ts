import { logger } from "./logger";

export async function syncAppidsToCollection(
  appids: number[],
  collectionName: string
): Promise<boolean> {
  try {
    const collectionStore = (window as any).collectionStore;
    const appStore = (window as any).appStore;
    if (!collectionStore || !appStore) {
      logger.warn("[SuggestMe] Steam stores not available for collection sync");
      return false;
    }

    const overviews = appids
      .map((id: number) => appStore.GetAppOverviewByAppID(id))
      .filter((app: any) => app != null);

    let collection = collectionStore.userCollections?.find(
      (c: any) => (c.displayName || c.strName) === collectionName
    );

    if (!collection) {
      collection = collectionStore.NewUnsavedCollection(collectionName, undefined, []);
      if (collection) {
        await collection.Save();
      }
    }

    if (collection && collection.AsDragDropCollection) {
      const currentCollectionAppIds: number[] = Array.from(collection.apps?.keys?.() || []);
      const listAppIds = new Set(appids);

      const toRemove = currentCollectionAppIds.filter(id => !listAppIds.has(id));
      if (toRemove.length > 0) {
        const removeOverviews = toRemove
          .map(id => appStore.GetAppOverviewByAppID(id))
          .filter((app: any) => app != null);
        if (removeOverviews.length > 0) {
          collection.AsDragDropCollection().RemoveApps(removeOverviews);
        }
      }

      if (overviews.length > 0) {
        collection.AsDragDropCollection().AddApps(overviews);
      }
      await collection.Save();
      return true;
    }

    return false;
  } catch (e) {
    logger.error(`[SuggestMe] Failed to sync collection "${collectionName}":`, e);
    return false;
  }
}

(() => {
  const storageArea = chrome?.storage?.local;
  const PATCH_FLAG = "__tabBeaconStoragePromiseBridgePatched";

  if (!storageArea || storageArea[PATCH_FLAG]) {
    return;
  }

  const runtimeApi = chrome?.runtime;

  function wrapMethod(methodName) {
    const original = storageArea[methodName];
    if (typeof original !== "function") return;
    const bound = original.bind(storageArea);

    storageArea[methodName] = function patchedStorageMethod(...args) {
      if (typeof args[args.length - 1] === "function") {
        return bound(...args);
      }

      return new Promise((resolve, reject) => {
        bound(...args, (result) => {
          const lastError = runtimeApi?.lastError;
          if (lastError) {
            reject(new Error(lastError.message || String(lastError)));
            return;
          }
          resolve(result);
        });
      });
    };
  }

  ["get", "set", "remove", "clear"].forEach(wrapMethod);

  Object.defineProperty(storageArea, PATCH_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
})();

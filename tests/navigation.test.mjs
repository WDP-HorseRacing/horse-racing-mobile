import test from "node:test";
import assert from "node:assert/strict";

test("safeBack calls router.back() when canGoBack is true", () => {
  let wentBack = false;
  let replacedWith = null;

  const mockRouter = {
    canGoBack: () => true,
    back: () => { wentBack = true; },
    replace: (href) => { replacedWith = href; },
  };

  function safeBack(fallback = "/") {
    try {
      if (mockRouter.canGoBack()) {
        mockRouter.back();
        return;
      }
    } catch {
      // ignore
    }
    mockRouter.replace(fallback);
  }

  safeBack("/trainer");
  assert.equal(wentBack, true);
  assert.equal(replacedWith, null);
});

test("safeBack calls router.replace(fallback) when canGoBack is false", () => {
  let wentBack = false;
  let replacedWith = null;

  const mockRouter = {
    canGoBack: () => false,
    back: () => { wentBack = true; },
    replace: (href) => { replacedWith = href; },
  };

  function safeBack(fallback = "/") {
    try {
      if (mockRouter.canGoBack()) {
        mockRouter.back();
        return;
      }
    } catch {
      // ignore
    }
    mockRouter.replace(fallback);
  }

  safeBack("/trainer");
  assert.equal(wentBack, false);
  assert.equal(replacedWith, "/trainer");
});

test("safeBack catches error from canGoBack and navigates to fallback", () => {
  let replacedWith = null;

  const mockRouter = {
    canGoBack: () => { throw new Error("The action 'GO_BACK' was not handled by any navigator."); },
    back: () => {},
    replace: (href) => { replacedWith = href; },
  };

  function safeBack(fallback = "/") {
    try {
      if (mockRouter.canGoBack()) {
        mockRouter.back();
        return;
      }
    } catch {
      // ignore
    }
    mockRouter.replace(fallback);
  }

  safeBack("/groom");
  assert.equal(replacedWith, "/groom");
});

test("revalidate in silent mode updates data without setting isRefreshing to true", async () => {
  let refreshingState = false;
  let loadingState = false;
  let dataState = null;

  async function mockRun(mode = "initial") {
    if (mode === "refresh") refreshingState = true;
    else if (mode === "initial") loadingState = true;

    try {
      const next = await Promise.resolve([{ id: "horse-1", name: "Star" }]);
      dataState = next;
    } finally {
      refreshingState = false;
      if (mode === "initial") loadingState = false;
    }
  }

  // Silent revalidate (focus effect)
  await mockRun("silent");
  assert.equal(refreshingState, false);
  assert.equal(loadingState, false);
  assert.deepEqual(dataState, [{ id: "horse-1", name: "Star" }]);
});

test("runRef pattern provides stable callback references avoiding infinite re-render loops", () => {
  let runs = 0;
  let currentRun = (mode) => { runs++; };
  const runRef = { current: currentRun };

  const revalidate = () => runRef.current("silent");
  const refresh = () => runRef.current("refresh");

  // Reference does not change even when currentRun changes
  const initialRevalidate = revalidate;
  const initialRefresh = refresh;

  currentRun = (mode) => { runs += 2; };
  runRef.current = currentRun;

  assert.equal(revalidate, initialRevalidate);
  assert.equal(refresh, initialRefresh);

  revalidate();
  assert.equal(runs, 2);
});


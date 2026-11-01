const CLEAN_START_VERSION = "texmind-clean-start-v1";

if (typeof window !== "undefined") {
  try {
    if (window.localStorage.getItem(CLEAN_START_VERSION) !== "done") {
      window.localStorage.removeItem("texmind-session");
      window.localStorage.removeItem("texmind_employees");
      window.localStorage.removeItem("texmind-order-costing");
      window.localStorage.setItem(CLEAN_START_VERSION, "done");
    }
  } catch {
    // The portal can still load when browser storage is unavailable.
  }
}

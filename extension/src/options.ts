import { loadSettings } from "./types";

const box = document.getElementById("showOnLists") as HTMLInputElement;

loadSettings().then((s) => {
  box.checked = s.showOnLists;
});

box.addEventListener("change", () => {
  chrome.storage.sync.set({ showOnLists: box.checked });
});

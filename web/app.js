/* global fetch, localStorage, navigator */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const SVG_NS = "http://www.w3.org/2000/svg";

  const dom = {
    welcomeView: $("#welcomeView"),
    scoringView: $("#scoringView"),
    finishView: $("#finishView"),
    loadForm: $("#loadForm"),
    rootInput: $("#rootInput"),
    browseBtn: $("#browseBtn"),
    demoBtn: $("#demoBtn"),
    loadBtn: $("#loadBtn"),
    loadError: $("#loadError"),
    recentNote: $("#recentNote"),
    helpBtn: $("#helpBtn"),
    helpDialog: $("#helpDialog"),
    closeHelpBtn: $("#closeHelpBtn"),
    helpDoneBtn: $("#helpDoneBtn"),
    folderDialog: $("#folderDialog"),
    closeFolderBtn: $("#closeFolderBtn"),
    cancelFolderBtn: $("#cancelFolderBtn"),
    chooseFolderBtn: $("#chooseFolderBtn"),
    shortcutList: $("#shortcutList"),
    pickerPathForm: $("#pickerPathForm"),
    pickerPathInput: $("#pickerPathInput"),
    pickerUpBtn: $("#pickerUpBtn"),
    pickerCurrentPath: $("#pickerCurrentPath"),
    dirList: $("#dirList"),
    pickerError: $("#pickerError"),
    discardDialog: $("#discardDialog"),
    cancelDiscardBtn: $("#cancelDiscardBtn"),
    confirmDiscardBtn: $("#confirmDiscardBtn"),
    lightboxDialog: $("#lightboxDialog"),
    closeLightboxBtn: $("#closeLightboxBtn"),
    lightboxImg: $("#lightboxImg"),
    lightboxFolder: $("#lightboxFolder"),
    lightboxFile: $("#lightboxFile"),
    loadingOverlay: $("#loadingOverlay"),
    loadingText: $("#loadingText"),
    toastHost: $("#toastHost"),
    scoring: {
      rootName: $("#rootName"),
      rootPathBtn: $("#rootPathBtn"),
      positionNow: $("#positionNow"),
      positionTotal: $("#positionTotal"),
      positionFill: $("#positionFill"),
      savedCount: $("#savedCount"),
      summaryBtn: $("#summaryBtn"),
      changeRootBtn: $("#changeRootBtn"),
      groupEyebrow: $("#groupEyebrow"),
      groupTitle: $("#groupTitle"),
      groupCounter: $("#groupCounter"),
      recordState: $("#recordState"),
      recordKey: $("#recordKey"),
      keyWarning: $("#keyWarning"),
      cardGrid: $("#cardGrid"),
      winnerReadout: $("#winnerReadout"),
      loserReadout: $("#loserReadout"),
      saveStatus: $("#saveStatus"),
      discardBtn: $("#discardBtn"),
      prevBtn: $("#prevBtn"),
      saveBtn: $("#saveBtn"),
      saveBtnText: $("#saveBtnText"),
    },
    finish: {
      saved: $("#finishSaved"),
      skipped: $("#finishSkipped"),
      total: $("#finishTotal"),
      path: $("#finishPath"),
      copyPathBtn: $("#copyPathBtn"),
      downloadBtn: $("#downloadBtn"),
      resumeBtn: $("#resumeBtn"),
      firstUnrecordedBtn: $("#firstUnrecordedBtn"),
      newDatasetBtn: $("#newDatasetBtn"),
    },
  };

  const state = {
    env: null,
    dataset: null,
    records: {},
    index: 0,
    winner: null,
    loser: null,
    dirty: false,
    busy: false,
    drafts: new Map(),
    skipped: new Set(),
    picker: {
      path: null,
      parent: null,
      busy: false,
      initialized: false,
    },
    initialised: false,
    lastRoot: "",
  };

  /* ----------------------------------------------------------------------- */
  /* Utilities                                                               */
  /* ----------------------------------------------------------------------- */

  function icon(id, className = "icon") {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `#${id}`);
    svg.append(use);
    return svg;
  }

  function basename(path) {
    if (!path) return "";
    const cleaned = path.replace(/[/\\]+$/, "");
    const parts = cleaned.split(/[/\\]/);
    return parts[parts.length - 1] || cleaned;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
    } catch {
      throw new Error("无法连接本地服务，请确认启动窗口仍在运行。");
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error((payload && payload.error) || `请求失败（HTTP ${response.status}）`);
    }
    return payload;
  }

  function showToast(message, type = "ok", duration = 2800) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : ""}`;
    const text = document.createElement("span");
    text.textContent = message;
    toast.append(text);
    dom.toastHost.append(toast);
    while (dom.toastHost.children.length > 3) {
      dom.toastHost.firstElementChild.remove();
    }
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function setLoading(active, text = "正在读取图片…") {
    dom.loadingText.textContent = text;
    dom.loadingOverlay.hidden = !active;
    dom.loadBtn.disabled = active;
    dom.loadBtn.classList.toggle("is-busy", active);
    if (!active) {
      dom.loadBtn.disabled = false;
    }
  }

  function showInlineError(element, message) {
    element.textContent = message;
    element.hidden = !message;
  }

  function switchView(name) {
    dom.welcomeView.hidden = name !== "welcome";
    dom.scoringView.hidden = name !== "scoring";
    dom.finishView.hidden = name !== "finish";
  }

  function currentGroup() {
    if (!state.dataset) return null;
    return state.dataset.groups[state.index] || null;
  }

  function groupHasRecord(group) {
    return Boolean(group && Object.prototype.hasOwnProperty.call(state.records, group.key));
  }

  function savedGroupCount() {
    if (!state.dataset) return 0;
    return state.dataset.groups.reduce(
      (count, group) => count + (groupHasRecord(group) ? 1 : 0),
      0,
    );
  }

  function winnerIndexFromRecord(group) {
    if (!groupHasRecord(group)) return null;
    const folder = state.records[group.key].win;
    const image = group.images.find((item) => item.folder === folder);
    return image ? group.images.indexOf(image) : null;
  }

  function loserIndexFromRecord(group) {
    if (!groupHasRecord(group)) return null;
    const folder = state.records[group.key].lose;
    const image = group.images.find((item) => item.folder === folder);
    return image ? group.images.indexOf(image) : null;
  }

  function computeDirty() {
    const group = currentGroup();
    if (!group) return false;
    const baseWinner = winnerIndexFromRecord(group);
    const baseLoser = loserIndexFromRecord(group);
    return state.winner !== baseWinner || state.loser !== baseLoser;
  }

  function isTextEntryTarget(target) {
    return Boolean(
      target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']"),
    );
  }

  function isButtonTarget(target) {
    return Boolean(target instanceof Element && target.closest("button, a"));
  }

  function dialogIsOpen() {
    return Boolean(document.querySelector("dialog[open]"));
  }

  function scrollToStageTop() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }

  function copyText(text, successMessage) {
    const fallback = () => {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      try {
        document.execCommand("copy");
        showToast(successMessage);
      } catch {
        showToast("复制失败，请手动选择路径。", "error");
      } finally {
        helper.remove();
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMessage),
        fallback,
      );
    } else {
      fallback();
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Initialisation                                                          */
  /* ----------------------------------------------------------------------- */

  async function initialise() {
    if (state.initialised) return;
    state.initialised = true;
    bindEvents();
    bindDialogBackdrops();

    try {
      state.env = await api("/api/environment");
    } catch (error) {
      showToast(error.message, "error", 6000);
      return;
    }

    if (state.env.demo_path) {
      dom.demoBtn.hidden = false;
    }

    try {
      state.lastRoot = localStorage.getItem("fiveframe.lastRoot") || "";
    } catch {
      state.lastRoot = "";
    }
    if (state.lastRoot) {
      dom.rootInput.value = state.lastRoot;
      const note = document.createElement("span");
      note.append("上次打开 · ");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = basename(state.lastRoot) || state.lastRoot;
      button.title = state.lastRoot;
      button.addEventListener("click", () => loadDataset(state.lastRoot));
      note.append(button, " · 点击继续");
      dom.recentNote.replaceChildren(note);
      dom.recentNote.hidden = false;
    }

    dom.rootInput.focus({ preventScroll: true });
  }

  function bindEvents() {
    dom.loadForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loadDataset(dom.rootInput.value, { errorTarget: dom.loadError });
    });

    dom.browseBtn.addEventListener("click", () => {
      openFolderDialog(dom.rootInput.value.trim() || state.lastRoot);
    });

    dom.demoBtn.addEventListener("click", () => {
      if (!state.env || !state.env.demo_path) return;
      dom.rootInput.value = state.env.demo_path;
      loadDataset(state.env.demo_path, { errorTarget: dom.loadError });
    });

    dom.helpBtn.addEventListener("click", () => openDialog(dom.helpDialog));
    dom.closeHelpBtn.addEventListener("click", () => dom.helpDialog.close());
    dom.helpDoneBtn.addEventListener("click", () => dom.helpDialog.close());

    dom.closeFolderBtn.addEventListener("click", () => dom.folderDialog.close());
    dom.cancelFolderBtn.addEventListener("click", () => dom.folderDialog.close());
    dom.chooseFolderBtn.addEventListener("click", choosePickedFolder);

    dom.pickerUpBtn.addEventListener("click", () => {
      if (state.picker.parent) browseFolder(state.picker.parent);
    });

    dom.pickerPathForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = dom.pickerPathInput.value.trim();
      if (next) browseFolder(next);
    });

    dom.scoring.prevBtn.addEventListener("click", goPrevious);
    dom.scoring.saveBtn.addEventListener("click", saveCurrentGroup);
    dom.scoring.discardBtn.addEventListener("click", requestDiscard);
    dom.scoring.summaryBtn.addEventListener("click", () => showFinish(true));
    dom.scoring.changeRootBtn.addEventListener("click", returnToWelcome);
    dom.scoring.rootPathBtn.addEventListener("click", () => {
      if (state.dataset) copyText(state.dataset.root, "根目录路径已复制");
    });

    dom.cancelDiscardBtn.addEventListener("click", () => dom.discardDialog.close());
    dom.confirmDiscardBtn.addEventListener("click", confirmDiscard);

    dom.closeLightboxBtn.addEventListener("click", () => dom.lightboxDialog.close());

    dom.finish.copyPathBtn.addEventListener("click", () => {
      if (state.dataset) copyText(state.dataset.json_path, "JSON 路径已复制");
    });
    dom.finish.downloadBtn.addEventListener("click", downloadRecords);
    dom.finish.resumeBtn.addEventListener("click", resumeReview);
    dom.finish.firstUnrecordedBtn.addEventListener("click", goFirstUnrecorded);
    dom.finish.newDatasetBtn.addEventListener("click", () => {
      returnToWelcome();
      openFolderDialog(dom.rootInput.value.trim() || state.lastRoot);
    });

    document.addEventListener("keydown", onGlobalKeydown);
  }

  function bindDialogBackdrops() {
    const dialogs = [dom.folderDialog, dom.discardDialog, dom.lightboxDialog, dom.helpDialog];
    dialogs.forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (!inside) dialog.close();
      });
    });
    dom.lightboxImg.addEventListener("error", () => {
      showToast("大图加载失败，请重试。", "error");
    });
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function onGlobalKeydown(event) {
    if (dialogIsOpen()) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (dom.scoringView.hidden) return;
    if (isTextEntryTarget(event.target)) return;

    if (event.key === "Enter") {
      if (isButtonTarget(event.target)) return;
      if (!dom.scoring.saveBtn.disabled) {
        event.preventDefault();
        saveCurrentGroup();
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      if (!dom.scoring.prevBtn.disabled) {
        event.preventDefault();
        goPrevious();
      }
      return;
    }
    if (event.key.toLowerCase() === "d") {
      event.preventDefault();
      requestDiscard();
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Loading a dataset                                                       */
  /* ----------------------------------------------------------------------- */

  async function loadDataset(rawPath, { errorTarget = null, fromPicker = false } = {}) {
    if (state.busy) return;
    const path = (rawPath || "").trim();
    if (!path) {
      if (errorTarget) showInlineError(errorTarget, "请先填写或选择图片根文件夹。");
      else showToast("请先填写或选择图片根文件夹。", "error");
      return;
    }

    if (errorTarget) showInlineError(errorTarget, "");
    showInlineError(dom.pickerError, "");
    state.busy = true;

    if (fromPicker) {
      dom.chooseFolderBtn.disabled = true;
      dom.chooseFolderBtn.textContent = "正在读取…";
      dom.cancelFolderBtn.disabled = true;
    } else {
      setLoading(true, "正在扫描 5 个子文件夹…");
    }

    try {
      const data = await api("/api/load", {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      state.dataset = data;
      state.records = data.records || {};
      state.index = 0;
      state.winner = null;
      state.loser = null;
      state.dirty = false;
      state.drafts.clear();
      state.skipped.clear();
      state.lastRoot = data.root;
      try {
        localStorage.setItem("fiveframe.lastRoot", data.root);
      } catch {
        // Private browsing can disable storage; the app still works for this session.
      }
      dom.rootInput.value = data.root;

      if (fromPicker) dom.folderDialog.close();
      renderWorkspace();
      switchView("scoring");
      showToast(`${data.total} 组图片已载入，开始评判吧`);
      document.title = `${basename(data.root)} · 五图鉴`;
      enterGroup(0, { scroll: false });
    } catch (error) {
      if (fromPicker) showInlineError(dom.pickerError, error.message);
      else if (errorTarget) showInlineError(errorTarget, error.message);
      else showToast(error.message, "error", 5000);
      if (fromPicker) {
        dom.chooseFolderBtn.disabled = false;
        dom.chooseFolderBtn.textContent = "使用此文件夹";
        dom.cancelFolderBtn.disabled = false;
      }
    } finally {
      state.busy = false;
      if (!fromPicker) setLoading(false);
      if (fromPicker) {
        dom.chooseFolderBtn.disabled = false;
        dom.chooseFolderBtn.textContent = "使用此文件夹";
        dom.cancelFolderBtn.disabled = false;
      }
    }
  }

  function renderWorkspace() {
    const data = state.dataset;
    if (!data) return;
    dom.scoring.rootName.textContent = basename(data.root) || data.root;
    dom.scoring.rootName.title = data.root;
    dom.scoring.positionTotal.textContent = String(data.total);
    dom.scoring.savedCount.textContent = String(savedGroupCount());
  }

  /* ----------------------------------------------------------------------- */
  /* Group lifecycle                                                         */
  /* ----------------------------------------------------------------------- */

  function enterGroup(index, { scroll = true } = {}) {
    if (!state.dataset) return;
    if (index < 0) index = 0;

    if (index >= state.dataset.total) {
      showFinish(true);
      return;
    }

    rememberDraft();
    state.index = index;
    const group = currentGroup();
    if (!group) return;

    const baseWinner = winnerIndexFromRecord(group);
    const baseLoser = loserIndexFromRecord(group);
    const draft = state.drafts.get(group.key);

    if (draft) {
      state.winner = draft.winner;
      state.loser = draft.loser;
    } else {
      state.winner = baseWinner;
      state.loser = baseLoser;
    }

    if (state.winner === state.loser) state.loser = null;
    state.dirty = computeDirty();
    if (!state.dirty) state.drafts.delete(group.key);

    renderGroupHeader();
    renderCards(group);
    updateSelectionUI();

    dom.scoring.prevBtn.disabled = index === 0;
    if (scroll) scrollToStageTop();

    prefetchNextGroup();
  }

  function rememberDraft() {
    const group = currentGroup();
    if (!group) return;
    if (state.dirty && (state.winner !== null || state.loser !== null)) {
      state.drafts.set(group.key, { winner: state.winner, loser: state.loser });
    } else {
      state.drafts.delete(group.key);
    }
  }

  function renderGroupHeader() {
    const group = currentGroup();
    const data = state.dataset;
    if (!group || !data) return;

    const number = group.index + 1;
    dom.scoring.positionNow.textContent = String(number);
    dom.scoring.positionFill.style.width = `${(number / data.total) * 100}%`;
    dom.scoring.groupEyebrow.textContent = `GROUP ${pad2(number)} / ${pad2(data.total)}`;
    dom.scoring.groupTitle.textContent = `第 ${number} 组`;
    dom.scoring.groupCounter.textContent = `${number} / ${data.total}`;
    dom.scoring.recordKey.textContent = group.key;
    dom.scoring.recordKey.title = group.identical_names
      ? "5 张图片共享此文件名（不含扩展名）"
      : "各文件夹文件名不一致，记录名取第一个文件夹中的图片名";
    dom.scoring.keyWarning.hidden = group.identical_names;
  }

  function renderCards(group) {
    dom.scoring.cardGrid.replaceChildren();

    group.images.forEach((image, slot) => {
      const card = document.createElement("article");
      card.className = "image-card";
      card.dataset.slot = String(slot);
      card.style.setProperty("--i", String(slot));

      const frame = document.createElement("div");
      frame.className = "image-frame";

      const backdrop = document.createElement("img");
      backdrop.className = "image-backdrop";
      backdrop.src = image.url;
      backdrop.alt = "";
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.draggable = false;

      const skeleton = document.createElement("div");
      skeleton.className = "image-skeleton";

      const img = document.createElement("img");
      img.src = image.url;
      img.alt = `${image.folder} 的图片：${image.filename}`;
      img.decoding = "async";
      img.draggable = false;
      img.loading = slot < 3 ? "eager" : "lazy";

      const imgFallback = document.createElement("div");
      imgFallback.className = "image-fallback";
      imgFallback.hidden = true;
      imgFallback.append(icon("i-image"), document.createTextNode("图片加载失败"));

      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "expand-btn";
      expand.setAttribute("aria-label", `放大查看 ${image.folder} 的图片`);
      expand.append(icon("i-expand"));

      const winBadge = document.createElement("span");
      winBadge.className = "verdict-badge verdict-win";
      winBadge.hidden = true;
      winBadge.append(icon("i-crown"), document.createTextNode("WINNER"));

      const loseBadge = document.createElement("span");
      loseBadge.className = "verdict-badge verdict-lose";
      loseBadge.hidden = true;
      loseBadge.append(icon("i-down"), document.createTextNode("LOSER"));

      frame.append(backdrop, img, skeleton, imgFallback, expand, winBadge, loseBadge);

      backdrop.addEventListener("load", () => backdrop.classList.add("is-loaded"));

      img.addEventListener("load", () => {
        img.classList.add("is-loaded");
        skeleton.hidden = true;
      });
      img.addEventListener("error", () => {
        skeleton.hidden = true;
        img.hidden = true;
        backdrop.hidden = true;
        imgFallback.hidden = false;
        expand.hidden = true;
      });

      const openImage = () => openLightbox(image, img);
      expand.addEventListener("click", openImage);
      img.addEventListener("click", openImage);

      const meta = document.createElement("div");
      meta.className = "card-meta";
      const folderIndex = document.createElement("span");
      folderIndex.className = "folder-index";
      folderIndex.textContent = pad2(slot + 1);

      const folderName = document.createElement("h3");
      folderName.className = "folder-name";
      folderName.textContent = image.folder;
      folderName.title = image.folder;

      const filename = document.createElement("p");
      filename.className = "file-name";
      filename.textContent = image.filename;
      filename.title = image.filename;

      meta.append(folderIndex, folderName, filename);

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const winButton = document.createElement("button");
      winButton.type = "button";
      winButton.className = "vote-btn vote-win";
      winButton.setAttribute("aria-pressed", "false");
      winButton.setAttribute("aria-label", `选择 ${image.folder} 为胜者`);
      winButton.append(icon("i-crown"), document.createTextNode("胜者"));

      const loseButton = document.createElement("button");
      loseButton.type = "button";
      loseButton.className = "vote-btn vote-lose";
      loseButton.setAttribute("aria-pressed", "false");
      loseButton.setAttribute("aria-label", `选择 ${image.folder} 为败者`);
      loseButton.append(icon("i-down"), document.createTextNode("败者"));

      winButton.addEventListener("click", () => selectWinner(slot));
      loseButton.addEventListener("click", () => selectLoser(slot));

      actions.append(winButton, loseButton);
      card.append(frame, meta, actions);
      dom.scoring.cardGrid.append(card);
    });
  }

  function selectWinner(slot) {
    if (state.winner === slot) {
      state.winner = null;
    } else {
      state.winner = slot;
      if (state.loser === slot) state.loser = null;
    }
    afterSelectionChange();
  }

  function selectLoser(slot) {
    if (state.loser === slot) {
      state.loser = null;
    } else {
      state.loser = slot;
      if (state.winner === slot) state.winner = null;
    }
    afterSelectionChange();
  }

  function afterSelectionChange() {
    state.dirty = computeDirty();
    rememberDraft();
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const group = currentGroup();
    if (!group) return;

    $$(".image-card", dom.scoring.cardGrid).forEach((card) => {
      const slot = Number(card.dataset.slot);
      const isWinner = state.winner === slot;
      const isLoser = state.loser === slot;
      card.classList.toggle("is-winner", isWinner);
      card.classList.toggle("is-loser", isLoser);

      const winButton = $(".vote-win", card);
      const loseButton = $(".vote-lose", card);
      winButton.classList.toggle("is-active", isWinner);
      loseButton.classList.toggle("is-active", isLoser);
      winButton.setAttribute("aria-pressed", String(isWinner));
      loseButton.setAttribute("aria-pressed", String(isLoser));

      const winBadge = $(".verdict-win", card);
      const loseBadge = $(".verdict-lose", card);
      winBadge.hidden = !isWinner;
      loseBadge.hidden = !isLoser;
    });

    const winnerName = state.winner === null ? null : group.images[state.winner].folder;
    const loserName = state.loser === null ? null : group.images[state.loser].folder;

    dom.scoring.winnerReadout.textContent = winnerName || "尚未选择";
    dom.scoring.loserReadout.textContent = loserName || "尚未选择";
    dom.scoring.winnerReadout.closest(".selection-item").classList.toggle("has-value", Boolean(winnerName));
    dom.scoring.loserReadout.closest(".selection-item").classList.toggle("has-value", Boolean(loserName));

    const canSave = winnerName && loserName && state.winner !== state.loser && !state.busy;
    dom.scoring.saveBtn.disabled = !canSave;
    dom.scoring.saveBtnText.textContent = groupHasRecord(group) ? "更新并下一组" : "保存并下一组";

    const recordState = dom.scoring.recordState;
    recordState.classList.remove("is-saved", "is-dirty");
    if (groupHasRecord(group) && !state.dirty) {
      recordState.textContent = "已记录";
      recordState.classList.add("is-saved");
    } else if (groupHasRecord(group) && state.dirty) {
      recordState.textContent = "待更新";
      recordState.classList.add("is-dirty");
    } else if (state.dirty) {
      recordState.textContent = "待保存";
      recordState.classList.add("is-dirty");
    } else {
      recordState.textContent = "未记录";
    }

    const saveStatus = dom.scoring.saveStatus;
    saveStatus.classList.remove("is-success", "is-warning", "is-error");
    if (state.dirty) {
      saveStatus.textContent = "当前选择尚未写入 JSON";
      saveStatus.classList.add("is-warning");
    } else if (groupHasRecord(group)) {
      saveStatus.textContent = "已从 scores.json 恢复";
      saveStatus.classList.add("is-success");
    } else {
      saveStatus.textContent = "选出胜者与败者后保存";
    }
  }

  function goPrevious() {
    if (!state.dataset || state.index <= 0) return;
    rememberDraft();
    enterGroup(state.index - 1);
  }

  function advanceAfterDecision() {
    if (!state.dataset) return;
    state.drafts.delete(currentGroup()?.key);
    dom.scoring.savedCount.textContent = String(savedGroupCount());
    if (state.index + 1 >= state.dataset.total) {
      showFinish(true);
    } else {
      enterGroup(state.index + 1);
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Save / discard                                                          */
  /* ----------------------------------------------------------------------- */

  async function saveCurrentGroup() {
    const group = currentGroup();
    if (!group || state.busy || state.winner === null || state.loser === null) return;
    if (state.winner === state.loser) return;

    const win = group.images[state.winner].folder;
    const lose = group.images[state.loser].folder;
    state.busy = true;
    dom.scoring.saveBtn.disabled = true;
    dom.scoring.saveBtnText.textContent = "保存中…";
    dom.scoring.saveStatus.textContent = "正在写入 JSON…";
    dom.scoring.saveStatus.className = "save-status";

    try {
      const payload = await api("/api/record", {
        method: "POST",
        body: JSON.stringify({
          session_id: state.dataset.session_id,
          key: group.key,
          win,
          lose,
        }),
      });
      state.records = payload.records || state.records;
      state.dirty = false;
      state.skipped.delete(group.key);
      showToast(`已记录：${win} 胜 · ${lose} 负`);
      advanceAfterDecision();
    } catch (error) {
      showToast(error.message, "error", 5000);
      dom.scoring.saveStatus.textContent = "写入失败，请重试";
      dom.scoring.saveStatus.className = "save-status is-error";
    } finally {
      state.busy = false;
      dom.scoring.saveBtn.disabled =
        state.winner === null || state.loser === null || state.winner === state.loser;
      if (state.dataset && currentGroup()) {
        dom.scoring.saveBtnText.textContent = groupHasRecord(currentGroup())
          ? "更新并下一组"
          : "保存并下一组";
      }
    }
  }

  function requestDiscard() {
    const group = currentGroup();
    if (!group || state.busy) return;
    if (groupHasRecord(group)) {
      dom.confirmDiscardBtn.disabled = false;
      dom.confirmDiscardBtn.textContent = "丢弃并下一组";
      openDialog(dom.discardDialog);
      return;
    }
    discardCurrent();
  }

  async function confirmDiscard() {
    dom.discardDialog.close();
    await discardCurrent();
  }

  async function discardCurrent() {
    const group = currentGroup();
    if (!group || state.busy) return;

    if (groupHasRecord(group)) {
      state.busy = true;
      dom.scoring.discardBtn.disabled = true;
      try {
        const payload = await api("/api/discard", {
          method: "POST",
          body: JSON.stringify({
            session_id: state.dataset.session_id,
            key: group.key,
          }),
        });
        state.records = payload.records || {};
        showToast("已丢弃本组，并删除原有记录");
      } catch (error) {
        showToast(error.message, "error", 5000);
        state.busy = false;
        dom.scoring.discardBtn.disabled = false;
        return;
      }
      state.busy = false;
      dom.scoring.discardBtn.disabled = false;
    } else {
      showToast("已丢弃本组，不会写入 JSON");
    }

    state.skipped.add(group.key);
    state.drafts.delete(group.key);
    state.dirty = false;
    advanceAfterDecision();
  }

  /* ----------------------------------------------------------------------- */
  /* Finish                                                                  */
  /* ----------------------------------------------------------------------- */

  function showFinish(remember = false) {
    if (!state.dataset) return;
    if (remember) rememberDraft();
    const total = state.dataset.total;
    const saved = savedGroupCount();
    dom.finish.saved.textContent = String(saved);
    dom.finish.skipped.textContent = String(Math.max(0, total - saved));
    dom.finish.total.textContent = String(total);
    dom.finish.path.textContent = state.dataset.json_path;
    dom.finish.path.title = state.dataset.json_path;
    dom.scoring.savedCount.textContent = String(saved);
    switchView("finish");
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "汇总 · 五图鉴";
  }

  function resumeReview() {
    if (!state.dataset) return;
    switchView("scoring");
    const index = Math.min(state.index, state.dataset.total - 1);
    enterGroup(index, { scroll: false });
    document.title = `${basename(state.dataset.root)} · 五图鉴`;
  }

  function goFirstUnrecorded() {
    if (!state.dataset) return;
    const index = state.dataset.groups.findIndex((group) => !groupHasRecord(group));
    switchView("scoring");
    if (index === -1) {
      showToast("全部图片组都已有记录。");
      enterGroup(Math.min(state.index, state.dataset.total - 1), { scroll: false });
    } else {
      enterGroup(index);
    }
    document.title = `${basename(state.dataset.root)} · 五图鉴`;
  }

  function downloadRecords() {
    if (!state.dataset) return;
    const data = JSON.stringify(state.records, null, 2) + "\n";
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scores.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("已导出当前 scores.json");
  }

  function returnToWelcome() {
    rememberDraft();
    switchView("welcome");
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "五图鉴 · 人工图片评分";
    if (state.lastRoot) dom.rootInput.value = state.lastRoot;
    window.setTimeout(() => dom.rootInput.focus({ preventScroll: true }), 60);
  }

  /* ----------------------------------------------------------------------- */
  /* Folder picker                                                           */
  /* ----------------------------------------------------------------------- */

  function openFolderDialog(startPath) {
    showInlineError(dom.pickerError, "");
    dom.chooseFolderBtn.disabled = true;
    openDialog(dom.folderDialog);
    const initial = (startPath || "").trim() || (state.env && state.env.home) || "~";
    browseFolder(initial);
    window.setTimeout(() => dom.pickerPathInput.focus({ preventScroll: true }), 80);
  }

  async function browseFolder(path) {
    if (state.picker.busy) return;
    state.picker.busy = true;
    showInlineError(dom.pickerError, "");
    dom.dirList.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "dir-loading";
    loading.textContent = "正在读取目录…";
    dom.dirList.append(loading);
    dom.chooseFolderBtn.disabled = true;

    try {
      const data = await api(`/api/browse?path=${encodeURIComponent(path)}`);
      state.picker.path = data.path;
      state.picker.parent = data.parent;
      state.picker.initialized = true;
      dom.chooseFolderBtn.disabled = false;
      dom.pickerPathInput.value = data.path;
      dom.pickerPathInput.title = data.path;
      dom.pickerCurrentPath.textContent = data.path;
      dom.pickerCurrentPath.title = data.path;
      dom.pickerUpBtn.disabled = !data.parent;
      renderShortcuts(data.shortcuts || []);
      renderDirectoryEntries(data.entries || [], data.truncated);
    } catch (error) {
      state.picker.initialized = false;
      state.picker.path = null;
      dom.dirList.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "dir-empty";
      empty.append(icon("i-folder"), document.createTextNode("无法读取此目录"));
      dom.dirList.append(empty);
      showInlineError(dom.pickerError, error.message);
    } finally {
      state.picker.busy = false;
      dom.chooseFolderBtn.disabled = !state.picker.initialized;
    }
  }

  function renderShortcuts(shortcuts) {
    dom.shortcutList.replaceChildren();
    shortcuts.forEach((shortcut) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "shortcut-chip";
      button.textContent = shortcut.name;
      button.title = shortcut.path;
      button.addEventListener("click", () => browseFolder(shortcut.path));
      dom.shortcutList.append(button);
    });
  }

  function renderDirectoryEntries(entries, truncated) {
    dom.dirList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "dir-empty";
      empty.append(icon("i-folder"), document.createTextNode("此目录下没有子文件夹"));
      dom.dirList.append(empty);
    } else {
      entries.forEach((entry) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "dir-row";
        row.title = entry.path;

        const folderIcon = icon("i-folder");
        const main = document.createElement("span");
        main.className = "dir-row-main";
        const name = document.createElement("span");
        name.className = "dir-row-name";
        name.textContent = entry.name;
        const count = document.createElement("span");
        count.className = "dir-row-count";
        const details = [];
        if (entry.image_count) details.push(`${entry.image_count} 张图片`);
        if (entry.subdir_count) details.push(`${entry.subdir_count} 个子文件夹`);
        count.textContent = details.join(" · ") || "空文件夹";
        main.append(name, count);

        const chevron = icon("i-chevron", "icon chev");
        row.append(folderIcon, main, chevron);
        row.addEventListener("click", () => browseFolder(entry.path));
        dom.dirList.append(row);
      });
    }

    if (truncated) {
      const note = document.createElement("p");
      note.className = "dir-empty";
      note.style.minHeight = "40px";
      note.textContent = "目录过多，仅显示前 600 个，请使用路径栏直接输入。";
      dom.dirList.append(note);
    }
  }

  async function choosePickedFolder() {
    if (!state.picker.path) {
      showInlineError(dom.pickerError, "请先选择一个文件夹。");
      return;
    }
    await loadDataset(state.picker.path, { fromPicker: true });
  }

  /* ----------------------------------------------------------------------- */
  /* Lightbox                                                                */
  /* ----------------------------------------------------------------------- */

  function openLightbox(image, sourceImage) {
    dom.lightboxImg.src = sourceImage.currentSrc || sourceImage.src;
    dom.lightboxImg.alt = `${image.folder} 的图片：${image.filename}`;
    dom.lightboxFolder.textContent = image.folder;
    dom.lightboxFile.textContent = image.filename;
    openDialog(dom.lightboxDialog);
  }

  /* ----------------------------------------------------------------------- */
  /* Prefetch                                                                */
  /* ----------------------------------------------------------------------- */

  function prefetchNextGroup() {
    if (!state.dataset) return;
    const nextGroup = state.dataset.groups[state.index + 1];
    if (!nextGroup) return;
    const start = () => {
      nextGroup.images.forEach((image) => {
        const prefetcher = new Image();
        prefetcher.src = image.url;
      });
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 1200 });
    } else {
      window.setTimeout(start, 250);
    }
  }

  window.addEventListener("DOMContentLoaded", initialise, { once: true });
  if (document.readyState !== "loading") initialise();
})();

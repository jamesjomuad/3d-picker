import { create } from 'zustand';

const EMPTY_ACTIONS = [];

let dismissHandler = null;

/**
 * Global host state for the contextual action sheet.
 *
 * The sheet renders at the app root so its layout is independent of the
 * screen that opened it. Actions stay transient; they are replaced whenever
 * the owning screen's context changes.
 */
const useContextualSheetStore = create((set, get) => ({
  visible: false,
  title: '',
  actions: EMPTY_ACTIONS,
  onCancel: null,

  showContextualSheet: ({ title = '', actions = EMPTY_ACTIONS, onCancel = null }) =>
    set({ visible: true, title, actions, onCancel }),

  hideContextualSheet: () =>
    set({ visible: false, title: '', actions: EMPTY_ACTIONS, onCancel: null }),

  registerDismiss: (handler) => {
    dismissHandler = handler;
    return () => {
      if (dismissHandler === handler) dismissHandler = null;
    };
  },

  requestDismiss: (callback = null) => {
    const finish = () => {
      get().hideContextualSheet();
      callback?.();
    };
    if (dismissHandler) dismissHandler(finish);
    else finish();
  },
}));

export { useContextualSheetStore };

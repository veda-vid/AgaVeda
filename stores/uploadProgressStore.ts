// stores/uploadProgressStore.ts — Instagram-style background publish jobs

import { create } from 'zustand';

export type UploadKind = 'spark' | 'post';

export type UploadJobStatus = 'queued' | 'uploading' | 'saving' | 'success' | 'error';

export type UploadJob = {
  id: string;
  kind: UploadKind;
  status: UploadJobStatus;
  /** 0–100 */
  progress: number;
  caption: string;
  thumbnailUri?: string | null;
  errorMessage?: string | null;
  createdAt: number;
};

type UploadProgressState = {
  jobs: UploadJob[];
  activeJobId: string | null;
  startJob: (input: {
    kind: UploadKind;
    caption: string;
    thumbnailUri?: string | null;
  }) => string;
  setProgress: (id: string, progress: number, status?: UploadJobStatus) => void;
  completeJob: (id: string) => void;
  failJob: (id: string, errorMessage: string) => void;
  dismissJob: (id: string) => void;
  clearFinished: () => void;
};

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export const useUploadProgressStore = create<UploadProgressState>((set, get) => ({
  jobs: [],
  activeJobId: null,

  startJob: ({ kind, caption, thumbnailUri }) => {
    const id = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: UploadJob = {
      id,
      kind,
      status: 'queued',
      progress: 2,
      caption: caption.trim() || (kind === 'spark' ? 'Posting Moment…' : 'Posting…'),
      thumbnailUri: thumbnailUri ?? null,
      errorMessage: null,
      createdAt: Date.now(),
    };
    set(state => ({
      jobs: [job, ...state.jobs].slice(0, 5),
      activeJobId: id,
    }));
    return id;
  },

  setProgress: (id, progress, status) => {
    set(state => ({
      jobs: state.jobs.map(j =>
        j.id === id
          ? {
              ...j,
              progress: clampPct(progress),
              status: status ?? (progress >= 90 ? 'saving' : 'uploading'),
            }
          : j,
      ),
    }));
  },

  completeJob: (id) => {
    set(state => ({
      jobs: state.jobs.map(j =>
        j.id === id
          ? { ...j, progress: 100, status: 'success', errorMessage: null }
          : j,
      ),
      activeJobId: get().activeJobId === id ? null : get().activeJobId,
    }));
  },

  failJob: (id, errorMessage) => {
    set(state => ({
      jobs: state.jobs.map(j =>
        j.id === id
          ? { ...j, status: 'error', errorMessage, progress: Math.max(j.progress, 8) }
          : j,
      ),
      activeJobId: get().activeJobId === id ? null : get().activeJobId,
    }));
  },

  dismissJob: (id) => {
    set(state => ({
      jobs: state.jobs.filter(j => j.id !== id),
      activeJobId: get().activeJobId === id ? null : get().activeJobId,
    }));
  },

  clearFinished: () => {
    set(state => ({
      jobs: state.jobs.filter(j => j.status === 'uploading' || j.status === 'saving' || j.status === 'queued'),
    }));
  },
}));

export function activeUploadJob(jobs: UploadJob[]): UploadJob | null {
  return (
    jobs.find(j => j.status === 'queued' || j.status === 'uploading' || j.status === 'saving')
    ?? jobs.find(j => j.status === 'success' || j.status === 'error')
    ?? null
  );
}

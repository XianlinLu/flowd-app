export type ToastType = 'info' | 'success' | 'error';

export interface ToastOptions {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

type ToastListener = (toasts: ToastOptions[]) => void;

class ToastStore {
  private toasts: ToastOptions[] = [];
  private listeners: ToastListener[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(message: string, options?: { type?: ToastType; duration?: number }) {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastOptions = {
      id,
      message,
      type: options?.type || 'info',
      duration: options?.duration || 3000,
    };

    this.toasts = [...this.toasts, toast];
    this.notify();

    setTimeout(() => {
      this.remove(id);
    }, toast.duration);
  }

  success(message: string, duration?: number) {
    this.show(message, { type: 'success', duration });
  }

  error(message: string, duration?: number) {
    this.show(message, { type: 'error', duration });
  }

  info(message: string, duration?: number) {
    this.show(message, { type: 'info', duration });
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

export const toast = new ToastStore();

/**
 * Simple Toast Notification Utility
 */
export class Toast {
    private static container: HTMLElement | null = null;
    private static styleId = 'appdev-design-mode-toast-styles';

    private static ensureContainer() {
        if (this.container && document.body.contains(this.container)) return;

        // Inject styles
        if (!document.getElementById(this.styleId)) {
            const style = document.createElement('style');
            style.id = this.styleId;
            style.textContent = `
        .design-mode-toast-container {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .design-mode-toast {
          background: white;
          color: #333;
          padding: 10px 20px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: design-mode-toast-in 0.3s ease-out forwards;
          border: 1px solid #eee;
          min-width: 200px;
          max-width: 400px;
        }
        .design-mode-toast.error {
          border-left: 4px solid #ef4444;
        }
        .design-mode-toast.success {
          border-left: 4px solid #22c55e;
        }
        .design-mode-toast.info {
          border-left: 4px solid #3b82f6;
        }
        @keyframes design-mode-toast-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes design-mode-toast-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }
      `;
            document.head.appendChild(style);
        }

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'design-mode-toast-container';
        document.body.appendChild(this.container);
    }

    public static show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
        this.ensureContainer();

        const toast = document.createElement('div');
        toast.className = `design-mode-toast ${type}`;
        toast.textContent = message;

        this.container!.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'design-mode-toast-out 0.3s ease-in forwards';
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, duration);
    }

    public static error(message: string, duration = 4000) {
        this.show(message, 'error', duration);
    }

    public static success(message: string, duration = 3000) {
        this.show(message, 'success', duration);
    }

    public static info(message: string, duration = 3000) {
        this.show(message, 'info', duration);
    }
}

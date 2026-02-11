export interface ModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'alert' | 'confirm' | 'toast';
  allowOutsideClick?: boolean;
  allowEsc?: boolean;
  duration?: number; // For toast
}

class ModalManager {
  private container: HTMLElement | null = null;
  private activeModals: Set<string> = new Set();

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'modal-manager-container';
      document.body.appendChild(this.container);
      
      // Add global styles for ModalManager if not already in global.scss
      const style = document.createElement('style');
      style.textContent = `
        #modal-manager-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 0;
          z-index: 9999;
          pointer-events: none;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: auto;
          z-index: 10000;
        }
        .modal-overlay.active {
          opacity: 1;
        }
        .modal-content {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
          transform: scale(0.9);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .modal-overlay.active .modal-content {
          transform: scale(1);
        }
        .modal-header h3 {
          margin: 0 0 16px 0;
          font-size: 1.25rem;
          color: #fff;
        }
        .modal-body {
          margin-bottom: 24px;
          color: #ccc;
          line-height: 1.6;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .modal-btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .cancel-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .confirm-btn.primary-btn {
          background: #ff3366;
          color: white;
        }
        .confirm-btn.primary-btn:hover {
          background: #ff4d7d;
          transform: translateY(-1px);
        }

        /* Toast Styles */
        .toast-container {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          z-index: 10001;
        }
        .toast-item {
          background: rgba(40, 40, 40, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 12px 24px;
          border-radius: 50px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          pointer-events: auto;
          animation: toast-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes toast-in {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .toast-item.hiding {
          animation: toast-out 0.3s ease forwards;
        }
        @keyframes toast-out {
          to { transform: translateY(-20px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  async alert(message: string, title: string = '提示'): Promise<void> {
    return this.show({ message, title, type: 'alert' });
  }

  async confirm(message: string, title: string = '确认'): Promise<boolean> {
    try {
      await this.show({ 
        message, 
        title, 
        type: 'confirm',
        allowOutsideClick: false,
        allowEsc: true
      });
      return true;
    } catch {
      return false;
    }
  }

  toast(message: string, duration: number = 3000) {
    this.ensureContainer();
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      this.container!.appendChild(toastContainer);
    }

    const toastItem = document.createElement('div');
    toastItem.className = 'toast-item';
    toastItem.textContent = message;
    toastContainer.appendChild(toastItem);

    setTimeout(() => {
      toastItem.classList.add('hiding');
      setTimeout(() => toastItem.remove(), 300);
    }, duration);
  }

  private show(options: ModalOptions): Promise<void> {
    this.ensureContainer();
    
    return new Promise((resolve, reject) => {
      const modalId = `modal-${Date.now()}`;
      const modalHtml = `
        <div id="${modalId}" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="${modalId}-title">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="${modalId}-title">${options.title || '提示'}</h3>
            </div>
            <div class="modal-body">
              <p>${options.message}</p>
            </div>
            <div class="modal-footer">
              ${options.type === 'confirm' ? `
                <button class="modal-btn cancel-btn">${options.cancelText || '取消'}</button>
              ` : ''}
              <button class="modal-btn confirm-btn primary-btn">${options.confirmText || '确定'}</button>
            </div>
          </div>
        </div>
      `;

      this.container!.insertAdjacentHTML('beforeend', modalHtml);
      const modalElement = document.getElementById(modalId)!;
      
      // Trigger reflow for animation
      void modalElement.offsetWidth;
      modalElement.classList.add('active');

      const confirmBtn = modalElement.querySelector('.confirm-btn') as HTMLButtonElement;
      const cancelBtn = modalElement.querySelector('.cancel-btn') as HTMLButtonElement;

      // Focus trap basic: focus confirm button
      confirmBtn.focus();

      const cleanup = () => {
        modalElement.classList.remove('active');
        setTimeout(() => {
          modalElement.remove();
          this.activeModals.delete(modalId);
        }, 300);
      };

      const handleConfirm = () => {
        cleanup();
        resolve();
      };

      const handleCancel = () => {
        cleanup();
        reject();
      };

      confirmBtn.addEventListener('click', handleConfirm);
      if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);

      if (options.allowOutsideClick !== false) {
        modalElement.addEventListener('click', (e) => {
          if (e.target === modalElement) handleCancel();
        });
      }

      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && options.allowEsc !== false) {
          handleCancel();
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);
      
      this.activeModals.add(modalId);
    });
  }
}

export const modalManager = new ModalManager();

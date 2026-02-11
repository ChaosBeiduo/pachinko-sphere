export interface ModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'alert' | 'confirm';
}

class ModalManager {
  private container: HTMLElement | null = null;

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'modal-manager-container';
      document.body.appendChild(this.container);
    }
  }

  async alert(message: string, title: string = '提示'): Promise<void> {
    return this.show({ message, title, type: 'alert' });
  }

  async confirm(message: string, title: string = '确认'): Promise<boolean> {
    try {
      await this.show({ message, title, type: 'confirm' });
      return true;
    } catch {
      return false;
    }
  }

  private show(options: ModalOptions): Promise<void> {
    this.ensureContainer();
    
    return new Promise((resolve, reject) => {
      const modalId = `modal-${Date.now()}`;
      const modalHtml = `
        <div id="${modalId}" class="modal-overlay active">
          <div class="modal-content">
            <div class="modal-header">
              <h3>${options.title || '提示'}</h3>
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

      if (this.container) {
        this.container.insertAdjacentHTML('beforeend', modalHtml);
      }

      const modalElement = document.getElementById(modalId)!;
      const confirmBtn = modalElement.querySelector('.confirm-btn')!;
      const cancelBtn = modalElement.querySelector('.cancel-btn');

      const cleanup = () => {
        modalElement.classList.remove('active');
        setTimeout(() => {
          modalElement.remove();
        }, 300);
      };

      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve();
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          cleanup();
          reject();
        });
      }

      // Close on backdrop click if needed
      modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
          cleanup();
          reject();
        }
      });
    });
  }
}

export const modalManager = new ModalManager();

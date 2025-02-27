class IXDialogElement extends HTMLElement {
  static observedAttributes = ['theme', 'title', 'image', 'open'];

  constructor() {
    super();

    this._root = this.attachShadow({ mode: 'closed' });

    this._root.innerHTML = `
    <style>
      @import "./css/open-props.css";
      @import "./css/themes.css";
      @import "./css/normalize.css";
      @import "./css/dialog.css";
    </style>
    <div id="container">
      <header>
        <h1>
          <img draggable="false" width="40" src="data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==">
          <span>HelpBot AI</span>
        </h1>
  
        <a id="ctrl-resize">
          <svg class="with-stroke" width="24" height="24" viewBox="0 0 24 24">
            <path d="M21 15L15 21M21 8L8 21" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
  
        <span id="ctrl-close" title="Close chat window">
          <svg class="with-stroke" width="24" height="24" viewBox="0 0 24 24">
            <path d="M6 6L18 18M18 6L6 18" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </header>
  
      <main>
        <div id="messages"></div>
      </main>
  
      <footer>
        <textarea id="textarea" placeholder="Your message"></textarea>
        <button id="btn-send">Send</button>
        <button id="btn-thread">New Thread</button>
        <div id="loader" style="visibility: hidden;"></div>
      </footer>
    </div>
    `;

    this._style = this._root.querySelector('style');
    this._main = this._root.querySelector('main');
    this._footer = this._root.querySelector('footer');

    this._style_template = `
      @import "https://ai.ioix.net/_/widget/css/open-props.css";
      @import "https://ai.ioix.net/_/widget/css/themes.css";
      @import "https://ai.ioix.net/_/widget/css/normalize.css";
      @import "https://ai.ioix.net/_/widget/css/dialog.css";
    `;
    this._main_template = '';
    this._footer_template = '';

    this.isRendered = false;
  }

  addMoveListener() {
      const control = this._root.querySelector('header h1');

      let isDragging = false;
      let offsetX = 0, offsetY = 0;

      const onMouseMove = (event) => {
          if (!isDragging) return;
          this.style.left = `${event.clientX - offsetX}px`;
          this.style.top = `${event.clientY - offsetY}px`;
      };

      const onMouseUp = () => {
          isDragging = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };

      control.addEventListener('mousedown', (event) => {
          isDragging = true;
          offsetX = event.clientX - this.offsetLeft;
          offsetY = event.clientY - this.offsetTop;
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
      });
  }

  addResizeListener() {
      const control = this._root.querySelector('#ctrl-resize');
      
      let isResizing = false;
      let startX, startY, startWidth, startHeight;

      const onMouseMove = (event) => {
          if (!isResizing) return;
          const newWidth = startWidth + (event.clientX - startX);
          const newHeight = startHeight + (event.clientY - startY);
          this.style.width = `${newWidth}px`;
          this.style.height = `${newHeight}px`;
      };

      const onMouseUp = () => {
          isResizing = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };

      control.addEventListener('mousedown', (event) => {
          isResizing = true;
          startX = event.clientX;
          startY = event.clientY;
          startWidth = this.offsetWidth;
          startHeight = this.offsetHeight;
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
      });
  }

  addCloseListener() {
      const control = this._root.querySelector('#ctrl-close');

      control.addEventListener('click', (event) => {
          this.removeAttribute('open');
      });
  }

  render() {

    if (!this.isRendered) {
      this._style.textContent = this._style_template;
    }

    if (!this._main_template) {
      let mainTemplateId = this.getAttribute('template');
      let mainTemplateNode = this.firstElementChild;

      if (mainTemplateId) mainTemplateNode = document.querySelector(`#${mainTemplateId}`);

      if (mainTemplateNode && mainTemplateNode.nodeName == 'TEMPLATE') {
        this._main_template = String(mainTemplateNode.innerHTML);
      } else {
        this._main_template = String(this.innerHTML);
      }
    }

    if (typeof Mustache !== 'undefined' && this._main_template.includes('{{')) {
      this._main.innerHTML = Mustache.render(this._main_template, this);
    } else {
      this._main.innerHTML = this._main_template;
    }

    if (typeof Mustache !== 'undefined' && this._footer_template.includes('{{')) {
      this._footer.innerHTML = Mustache.render(this._footer_template, this);
    } else {
      this._footer.innerHTML = this._footer_template;
    }

    this.isRendered = true;

    this.addMoveListener();
    this.addResizeListener();
    this.addCloseListener();
    this.renderedCallback();

    const container = this._root.querySelector('#container');
    container.style.visibility = 'visible';
  }

  connectedCallback() {
    setTimeout(() => this.render());
  }

  renderedCallback() {
  }

  showCallback() {
  }

  hideCallback() {
  }

  disconnectedCallback() {
    // this.resizeHandle.removeEventListener('mousedown', this.handleResizeStart);
    // this.moveHandle.removeEventListener('mousedown', this.handleMoveStart);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name == 'title') {
      const title = this._root.querySelector('header h1 span');
      title.innerText = newValue || '';
    } else if (name == 'image') {
      const image = this._root.querySelector('header h1 img');
      image.src = newValue || 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
    } else if (name == 'open') {
      if (newValue == null) {
        this.hideCallback();
      } else {
        this.showCallback();
      }
    }
  }
}

window.customElements.define('ix-dialog', IXDialogElement);


// Utility function to get cookie by name
const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return ''
}

// Utility function to set a cookie
const setCookie = (name, value, days) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = `${name}=${value || ""}${expires}; path=/`;
}

function markdownToHtml(markdown) {
    function escapeHtml(text) {
        return text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');
    }

    let lines = markdown.split('\n');
    let result = '';
    let listStack = [];
    let prevIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (/^\s*$/.test(line)) {
            continue;
        }

        // Обработка заголовков
        if (/^######\s+(.*)/.test(line)) {
            line = line.replace(/^######\s+(.*)/, '<h6>$1</h6>');
            result += line;
            continue;
        } else if (/^#####\s+(.*)/.test(line)) {
            line = line.replace(/^#####\s+(.*)/, '<h5>$1</h5>');
            result += line;
            continue;
        } else if (/^####\s+(.*)/.test(line)) {
            line = line.replace(/^####\s+(.*)/, '<h4>$1</h4>');
            result += line;
            continue;
        } else if (/^###\s+(.*)/.test(line)) {
            line = line.replace(/^###\s+(.*)/, '<h3>$1</h3>');
            result += line;
            continue;
        } else if (/^##\s+(.*)/.test(line)) {
            line = line.replace(/^##\s+(.*)/, '<h2>$1</h2>');
            result += line;
            continue;
        } else if (/^#\s+(.*)/.test(line)) {
            line = line.replace(/^#\s+(.*)/, '<h1>$1</h1>');
            result += line;
            continue;
        }

        if (/^>\s+(.*)/.test(line)) {
            line = line.replace(/^>\s+(.*)/, '<blockquote>$1</blockquote>');
            result += line;
            continue;
        }

        if (/^---$/.test(line)) {
            result += '<hr>';
            continue;
        }

        let listMatch = /^(\s*)([-\*\+]|\d+\.)\s+(.*)/.exec(line);
        if (listMatch) {
            let indent = listMatch[1].length;
            let listType = isNaN(parseInt(listMatch[2])) ? 'ul' : 'ol';
            let content = listMatch[3];

            // Жирный и курсив
            content = content.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
            // Инлайновый код
            content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Ссылки
            content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
            // Изображения
            content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

            if (indent > prevIndent) {
                result += `<${listType}>`.repeat((indent - prevIndent) / 2);
                listStack.push(listType);
            } else if (indent < prevIndent) {
                let diff = (prevIndent - indent) / 2;
                for (let j = 0; j < diff; j++) {
                    let lastList = listStack.pop();
                    result += `</li></${lastList}>`;
                }
                result += '</li>';
            } else {
                result += '</li>';
            }
            result += `<li>${content}`;
            prevIndent = indent;
            continue;
        } else {
            while (listStack.length > 0) {
                let lastList = listStack.pop();
                result += `</li></${lastList}>`;
            }
            prevIndent = 0;
        }

        if (!/^<\/?(h\d|ul|ol|li|blockquote|pre|code|img|a|strong|em|hr)/.test(line)) {
            line = `<p>${line}</p>`;
        }
        // Жирный и курсив
        line = line.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Инлайновый код
        line = line.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Ссылки
        line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
        // Изображения
        line = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

        result += line;
    }

    while (listStack.length > 0) {
        let lastList = listStack.pop();
        result += `</li></${lastList}>`;
    }

    return result;
}


class IXHelpbotElement extends IXDialogElement {
  constructor() {
    super();

    this._style_template = this._style_template + `
      @import "https://ai.ioix.net/_/widget/css/helpbot.css";
    `;

    this._main_template = `
      <div id="messages">
      </div>
    `;

    this._footer_template = `
      <textarea id="textarea" placeholder="" disabled></textarea>

      <div id="controls">
        <button id="btn-thread" title="New Topic" disabled>
           <svg class="with-stroke" width="24" height="24" viewBox="0 0 24 24">
             <path d="M11 4H7.2C6.0799 4 5.51984 4 5.09202 4.21799C4.71569 4.40974 4.40973 4.7157 4.21799 5.09202C4 5.51985 4 6.0799 4 7.2V16.8C4 17.9201 4 18.4802 4.21799 18.908C4.40973 19.2843 4.71569 19.5903 5.09202 19.782C5.51984 20 6.0799 20 7.2 20H16.8C17.9201 20 18.4802 20 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V12.5M15.5 5.5L18.3284 8.32843M10.7627 10.2373L17.411 3.58902C18.192 2.80797 19.4584 2.80797 20.2394 3.58902C21.0205 4.37007 21.0205 5.6364 20.2394 6.41745L13.3774 13.2794C12.6158 14.0411 12.235 14.4219 11.8012 14.7247C11.4162 14.9936 11.0009 15.2162 10.564 15.3882C10.0717 15.582 9.54378 15.6885 8.48793 15.9016L8 16L8.04745 15.6678C8.21536 14.4925 8.29932 13.9048 8.49029 13.3561C8.65975 12.8692 8.89125 12.4063 9.17906 11.9786C9.50341 11.4966 9.92319 11.0768 10.7627 10.2373Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
           New Topic
        </button>

        <div id="loader">
            <span></span>
            <span></span>
            <span></span>
        </div>

        <button id="btn-send" title="Send Message" disabled>
           <svg class="with-stroke" width="24" height="24" viewBox="0 0 24 24">
             <path d="M10.3009 13.6949L20.102 3.89742M10.5795 14.1355L12.8019 18.5804C13.339 19.6545 13.6075 20.1916 13.9458 20.3356C14.2394 20.4606 14.575 20.4379 14.8492 20.2747C15.1651 20.0866 15.3591 19.5183 15.7472 18.3818L19.9463 6.08434C20.2845 5.09409 20.4535 4.59896 20.3378 4.27142C20.2371 3.98648 20.013 3.76234 19.7281 3.66167C19.4005 3.54595 18.9054 3.71502 17.9151 4.05315L5.61763 8.2523C4.48114 8.64037 3.91289 8.83441 3.72478 9.15032C3.56153 9.42447 3.53891 9.76007 3.66389 10.0536C3.80791 10.3919 4.34498 10.6605 5.41912 11.1975L9.86397 13.42C10.041 13.5085 10.1295 13.5527 10.2061 13.6118C10.2742 13.6643 10.3352 13.7253 10.3876 13.7933C10.4468 13.87 10.491 13.9585 10.5795 14.1355Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
           Send Message
        </button>
      </div>

      <p id="slogan">
        Powered by <a href="https://ai.ioix.net/" target="_blank">HelpBot</a>
      </p>
    `;

    this.ws = null;
  }

  renderedCallback() {
    this._loader = this._root.querySelector('#loader');
    this._messages = this._root.querySelector('#messages');
    this._textarea = this._root.querySelector('#textarea');
    this._btn_send = this._root.querySelector('#btn-send');
    this._btn_thread = this._root.querySelector('#btn-thread');

    const description = this.getAttribute('description');
    if (description) {
        this.displayMessage({
            role: 'system',
            content: description,
        });
    }

    this._textarea.setAttribute('placeholder', this.getAttribute('placeholder') || 'Your message');

    this._textarea.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            if (this._textarea.value) {
                event.preventDefault(); // Prevent adding a new line
                this.sendMessage(this._textarea.value);
                this._textarea.value = '';
            }
        }
    });

    this._btn_send.addEventListener('click', (event) => {
        if (this._textarea.value) {
            this.sendMessage(this._textarea.value);
            this._textarea.value = '';
        }
    });

    this._btn_thread.addEventListener('click', (event) => {
        let asstId = this.getAttribute('assistant');
        setCookie(asstId, '', 3);  // reset cookie value

        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        this._textarea.value = '';

        this.websocketConnect();
    });

    this.websocketConnect();
  }

  websocketConnect() {
    let wsUrl = this.getAttribute('websocket');

    if (this.ws) return;
    if (!wsUrl) return;

    let asstId = this.getAttribute('assistant');
    let threadId = getCookie(asstId);
    if (threadId) wsUrl = `${wsUrl}?thread=${threadId}`;

    this.ws = new WebSocket(wsUrl);

    // Handle incoming messages
    this.ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);

        if (msg.object === 'assistant') {
            // this.header_title.innerHTML = msg.name;
            this._messages.innerHTML = '';
            if (msg.description) {
                this.displayMessage({
                    role: 'system',
                    content: msg.description,
                });
            }
            this._textarea.removeAttribute('disabled');
            this._btn_send.removeAttribute('disabled');
            this._btn_thread.removeAttribute('disabled');
            this._loader.style.visibility = 'hidden';

        } else if (msg.object === 'thread') {
            setCookie(msg.assistant_id, msg.thread_id, 3);

        } else {
            this.displayMessage(msg);
        }
    });

    this.ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

  }

  displayMessage(msg) {
    const msgEl = document.createElement('div');
    msgEl.classList.add('message');
    msgEl.classList.add(`role-${msg.role}`);
    if (msg.role == 'user') {
        msgEl.innerHTML = `<p>${msg.content}</p>`;
    } else {
        let content = msg.content.replace(/【[^】]+】/g, '');
        msgEl.innerHTML = markdownToHtml(content);
    }
    this._messages.appendChild(msgEl);
    this._messages.scrollTop = this._messages.scrollHeight; // Scroll to the latest message

    if (msg.role == 'assistant') {
        this._textarea.removeAttribute('disabled');
        this._btn_send.removeAttribute('disabled');
        this._btn_thread.removeAttribute('disabled');
        this._loader.style.visibility = 'hidden';
    }

  }

  // Send messages via WebSocket
  sendMessage(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(msg);
    } else {
        console.error('WebSocket is not connected.');
    }
    this._textarea.setAttribute('disabled', 'disabled');
    this._btn_send.setAttribute('disabled', 'disabled');
    this._btn_thread.setAttribute('disabled', 'disabled');
    this._loader.style.visibility = 'visible';
  }
}

window.customElements.define('ix-helpbot', IXHelpbotElement);

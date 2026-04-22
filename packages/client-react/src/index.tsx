import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { DesignModeProvider } from './DesignModeContext';
import { DesignModeManager } from './DesignModeManager';

const init = () => {
  const containerId = '__vite_plugin_design_mode__';
  if (document.getElementById(containerId)) return;

  const container = document.createElement('div');
  container.id = containerId;
  document.body.appendChild(container);

  // Use Shadow DOM to isolate styles
  const shadowRoot = container.attachShadow({ mode: 'open' });
  const rootElement = document.createElement('div');
  shadowRoot.appendChild(rootElement);

  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <DesignModeProvider>
        <DesignModeManager />
      </DesignModeProvider>
    </StrictMode>
  );
};

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

if (typeof window !== 'undefined') {
  init();
}

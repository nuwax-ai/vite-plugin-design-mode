# Vue3 Design Mode Client

Vue3 Single File Component implementation of the design mode UI, ported from React.

## Structure

```
src/client-vue/
├── DesignModeApp.vue          # Root component (160 lines)
├── components/
│   ├── ContextMenu.vue        # Right-click context menu (175 lines)
│   ├── DesignModeUI.vue       # Main UI with toggle & edit panel (333 lines)
│   ├── Toast.vue              # Toast notification component (101 lines)
│   └── ToastContainer.vue     # Toast container manager (31 lines)
├── composables/
│   ├── useDesignMode.ts       # Design mode state & actions (210 lines)
│   ├── useEditManager.ts      # Direct editing logic (367 lines)
│   ├── useObserverManager.ts  # MutationObserver management (99 lines)
│   ├── useSelectionManager.ts # Selection & hover logic (540 lines)
│   └── useToast.ts            # Toast notification system (50 lines)
├── index.ts                   # Entry point with Shadow DOM (32 lines)
└── exports.ts                 # Public API exports (7 lines)
```

**Total: ~2,103 lines**

## Components

### 1. DesignModeApp.vue
Root component that:
- Creates and provides design mode context via `createDesignMode()`
- Sets up global event listeners (click, hover, mouseout)
- Injects global CSS for hover/selected states
- Manages lifecycle and cleanup

### 2. DesignModeUI.vue
Main UI component featuring:
- **Toggle Button**: Fixed bottom-right position
- **Edit Panel**: 320px wide panel when element selected
- **Tailwind Presets**:
  - Background colors (7 options)
  - Text colors (5 options)
  - Padding (6 options)
  - Border radius (5 options)
- **Reset Button**: Reload page to reset all modifications

### 3. ContextMenu.vue
Right-click context menu with:
- Dynamic positioning with viewport boundary checks
- Menu items with hover states
- Close handlers: click outside, ESC, scroll, resize
- Hover state restoration after close

### 4. Toast.vue & ToastContainer.vue
Toast notification system:
- Three types: success, error, info
- Slide-in/out animations
- Auto-dismiss (3-4s configurable)
- Stacked display at top-center

## Composables

### useDesignMode.ts
Core design mode state management:
- `isDesignMode`: Boolean toggle state
- `selectedElement`: Currently selected element
- `hoveredElement`: Currently hovered element
- `toggleDesignMode()`: Toggle design mode on/off
- `selectElement()`: Select element and notify parent
- `modifyElementClass()`: Update element classes
- `updateElementContent()`: Update element text content
- `resetModifications()`: Reload page

Uses Vue3 `provide/inject` pattern for global state.

### useToast.ts
Toast notification management:
- `show()`: Display toast with type and duration
- `error()`: Show error toast (4s)
- `success()`: Show success toast (3s)
- `info()`: Show info toast (3s)
- `remove()`: Remove toast by ID

### useEditManager.ts
Direct editing functionality:
- Double-click to edit text content
- ContentEditable mode with save/cancel
- Real-time sync across list items
- Keyboard shortcuts (Enter to save, ESC to cancel)

### useObserverManager.ts
MutationObserver for DOM changes:
- Watches content and style changes
- Filters ignored mutations (`data-ignore-mutation`)
- Triggers callbacks for edits

### useSelectionManager.ts
Advanced selection management:
- Click/hover selection
- Element validation (static-content/static-class)
- Highlight/unhighlight elements
- Keyboard shortcuts (ESC to clear)
- Component root detection

## Usage

### Entry Point (index.ts)
```typescript
import { createApp } from 'vue';
import DesignModeApp from './DesignModeApp.vue';

// Creates Shadow DOM container
// Mounts Vue app
// Detects iframe environment
```

### In Components
```vue
<script setup lang="ts">
import { useDesignMode } from './composables/useDesignMode';

const designMode = useDesignMode();

// Access state
console.log(designMode.isDesignMode);
console.log(designMode.selectedElement);

// Actions
designMode.toggleDesignMode();
designMode.selectElement(element);
</script>
```

### Toast Notifications
```typescript
import { useToast } from './composables/useToast';

const toast = useToast();

toast.success('Changes saved!');
toast.error('Failed to update');
toast.info('Element selected');
```

## Key Features

### 1. Shadow DOM Isolation
- Styles isolated from host page
- No CSS conflicts
- Clean encapsulation

### 2. Iframe Communication
- PostMessage API for parent ↔ iframe
- Message types: ELEMENT_SELECTED, STYLE_UPDATED, CONTENT_UPDATED
- Automatic source info resolution

### 3. List Synchronization
- Elements with same `element-id` update together
- Real-time preview across all instances
- Prevents desync in mapped lists

### 4. Tailwind Integration
- Preset buttons for common utilities
- Visual color pickers
- Class merging (simple Set-based)

### 5. Keyboard Shortcuts
- **Enter**: Save content edit
- **ESC**: Cancel edit or clear selection
- **Ctrl/Cmd+A**: Select first element
- **Ctrl/Cmd+D**: Clear selection

## Differences from React Version

### Architecture
- **React**: Context API + hooks
- **Vue3**: Provide/Inject + composables

### State Management
- **React**: `useState`, `useEffect`
- **Vue3**: `ref`, `watch`, `onMounted`

### Event Handling
- **React**: Inline event handlers
- **Vue3**: `@click`, `@mouseenter` directives

### Styling
- **React**: Inline style objects
- **Vue3**: `:style` bindings + scoped CSS

### Lifecycle
- **React**: `useEffect` with cleanup
- **Vue3**: `onMounted`, `onUnmounted`

## Shared Utilities

Both React and Vue3 clients use shared utilities from `client-shared/`:

- `attributeNames.ts`: Data attribute name resolution
- `sourceInfo.ts`: Source mapping extraction
- `sourceInfoResolver.ts`: Advanced source resolution
- `elementUtils.ts`: Element validation helpers
- `bridge.ts`: Iframe bridge communication
- `UpdateService.ts`: Update API client
- `HistoryManager.ts`: Undo/redo functionality

## Integration

### Vite Plugin Configuration
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import appdevDesignMode from 'vite-plugin-appdev-design-mode';

export default defineConfig({
  plugins: [
    vue(),
    appdevDesignMode({
      framework: 'vue3', // Use Vue3 client
      enabled: true,
    }),
  ],
});
```

### Build Output
The plugin will:
1. Inject Vue3 client code into your app
2. Create Shadow DOM container
3. Mount DesignModeApp component
4. Enable design mode features

## API Reference

### createDesignMode()
Creates design mode context. Call once in root component.

**Returns**: `DesignModeContext`

### useDesignMode()
Access design mode context. Must be called within a component that has `createDesignMode()` in its ancestor tree.

**Returns**: `DesignModeContext`

### DesignModeContext
```typescript
interface DesignModeContext {
  // State
  isDesignMode: Ref<boolean>;
  selectedElement: Ref<HTMLElement | null>;
  hoveredElement: Ref<HTMLElement | null>;
  
  // Actions
  toggleDesignMode: () => void;
  selectElement: (element: HTMLElement | null) => void;
  setHoveredElement: (element: HTMLElement | null) => void;
  modifyElementClass: (element: HTMLElement, newClass: string) => Promise<void>;
  updateElementContent: (element: HTMLElement, newContent: string) => Promise<void>;
  resetModifications: () => void;
}
```

## Development

### Prerequisites
- Vue 3.x
- TypeScript 5.x
- Vite 5.x

### Testing
```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

## Future Enhancements

- [ ] Undo/redo functionality
- [ ] Attribute editing UI
- [ ] Style inspector panel
- [ ] Component hierarchy viewer
- [ ] Keyboard shortcut customization
- [ ] Multi-select support
- [ ] Drag-to-reorder elements
- [ ] Copy/paste element styles
- [ ] Export changes as patch file

## License

MIT

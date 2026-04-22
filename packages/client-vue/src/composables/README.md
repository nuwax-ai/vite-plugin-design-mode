# Vue3 Design Mode Composables

Vue3 Composition API equivalents of the React design mode hooks.

## Overview

This directory contains Vue3 composables that provide the same functionality as the React hooks in `/src/client/`. These composables enable design mode functionality in Vue3 applications.

## Composables

### 1. `useDesignMode.ts` (912 lines)

**Purpose**: Global design mode state management and bridge communication.

**Ported from**: `src/client/DesignModeContext.tsx` (1,079 lines)

**Key Features**:
- Global state management using `reactive()` and `provide/inject`
- Bridge communication with parent window via postMessage
- Message handling for style/content updates
- Batch update support with debouncing
- Health check and connection monitoring

**Usage**:
```typescript
import { createDesignMode, useDesignMode } from './composables';

// In root component
const designMode = createDesignMode({
  enabled: true,
  iframeMode: {
    enabled: true,
    enableSelection: true,
    enableDirectEdit: true,
  },
  batchUpdate: {
    enabled: true,
    debounceMs: 300,
  },
});

// In child components
const { 
  isDesignMode, 
  selectedElement, 
  toggleDesignMode,
  selectElement,
  modifyElementClass,
  updateElementContent 
} = useDesignMode();
```

**Key Methods**:
- `toggleDesignMode()` - Toggle design mode on/off
- `selectElement(element)` - Select an element for editing
- `modifyElementClass(element, newClass)` - Update element classes
- `updateElementContent(element, newContent)` - Update element text content
- `batchUpdateElements(updates)` - Batch multiple updates
- `resetModifications()` - Reload page to reset changes

### 2. `useSelectionManager.ts` (539 lines)

**Purpose**: Element selection and interaction handling.

**Ported from**: `src/client/SelectionManager.tsx` (597 lines)

**Key Features**:
- Click and hover event handling
- Element validation (must have source mapping + static-content/static-class)
- Visual highlighting with outline and shadow
- Keyboard shortcuts (Esc to clear, Ctrl/Cmd+A to select)
- Element info extraction with hierarchy
- Component root detection for library components

**Usage**:
```typescript
import { useSelectionManager } from './composables';

const {
  selectedElement,
  hoverElement,
  selectElement,
  clearSelection,
  extractElementInfo,
  addSelectionListener,
} = useSelectionManager(document.body, {
  enableSelection: true,
  enableHover: true,
  selectionDelay: 0,
  excludeSelectors: ['script', 'style', 'meta'],
  includeOnlyElements: false,
});

// Listen to selection changes
const unsubscribe = addSelectionListener((element) => {
  if (element) {
    const info = extractElementInfo(element);
    console.log('Selected:', info);
  }
});
```

**Key Methods**:
- `selectElement(element)` - Select and highlight element
- `clearSelection()` - Clear current selection
- `extractElementInfo(element)` - Get detailed element information
- `addSelectionListener(callback)` - Subscribe to selection changes

### 3. `useEditManager.ts` (367 lines)

**Purpose**: Content editing with contentEditable mode.

**Ported from**: `src/client/managers/EditManager.ts` (365 lines)

**Key Features**:
- ContentEditable mode for inline text editing
- Real-time sync to related elements (list items with same element-id)
- Throttled notifications (300ms) during typing
- Enter saves, Escape cancels
- Click outside to save
- Automatic peer element synchronization

**Usage**:
```typescript
import { useEditManager } from './composables';

const processUpdate = async (update: UpdateState) => {
  // Handle update logic
  return { success: true };
};

const {
  handleDirectEdit,
  editTextContent,
  updateContent,
  updateStyle,
  updateAttribute,
} = useEditManager(processUpdate, config);

// Double-click to edit
element.addEventListener('dblclick', () => {
  handleDirectEdit(element, 'content');
});
```

**Key Methods**:
- `handleDirectEdit(element, type)` - Trigger edit mode
- `editTextContent(element)` - Enable contentEditable editing
- `updateContent(element, newValue)` - Programmatic content update
- `updateStyle(element, newClass)` - Programmatic style update
- `updateAttribute(element, name, value)` - Update element attribute

### 4. `useObserverManager.ts` (98 lines)

**Purpose**: DOM mutation observation.

**Ported from**: `src/client/managers/ObserverManager.ts` (81 lines)

**Key Features**:
- MutationObserver setup for DOM changes
- Watches: childList, characterData, attributes (class, style)
- Skips elements with `data-ignore-mutation` attribute
- Callbacks for content/style edits and node additions

**Usage**:
```typescript
import { useObserverManager } from './composables';

const { enable, disable, isEnabled } = useObserverManager(
  (target, type) => {
    console.log(`Edit detected: ${type} on`, target);
  },
  (node) => {
    console.log('Node added:', node);
  }
);

// Start observing
enable();

// Stop observing
disable();
```

**Key Methods**:
- `enable()` - Start observing DOM mutations
- `disable()` - Stop observing and disconnect

## Key Differences from React Version

### State Management
- **React**: `useState`, `useCallback`, `useEffect`
- **Vue3**: `ref`, `reactive`, `computed`, `watch`, `onMounted`, `onBeforeUnmount`

### Context/Injection
- **React**: `createContext`, `useContext`, `Provider`
- **Vue3**: `provide`, `inject`, `InjectionKey`

### Lifecycle
- **React**: `useEffect` with cleanup
- **Vue3**: `onMounted`, `onBeforeUnmount`

### Reactivity
- **React**: Explicit state setters
- **Vue3**: Direct mutation of `ref.value` or `reactive` properties

## Integration with Shared Code

All composables import shared utilities from `/src/client-shared/`:
- `bridge.ts` - PostMessage communication
- `attributeNames.ts` - Data attribute name resolution
- `sourceInfo.ts` - Source mapping extraction
- `sourceInfoResolver.ts` - Usage-site resolution
- `elementUtils.ts` - Element validation helpers

## Type Safety

All composables are fully typed with TypeScript, importing types from:
- `/src/types/messages.ts` - Message type definitions
- `/src/types/UpdateTypes.ts` - Update operation types

## Testing

To test these composables:

1. Import in a Vue3 component
2. Call `createDesignMode()` in the root component
3. Use `useDesignMode()` in child components
4. Verify bridge communication with parent window
5. Test element selection and editing

## Future Enhancements

- [ ] Add Vue3-specific optimizations (e.g., `shallowRef` for large objects)
- [ ] Create Vue3 component wrappers for easier integration
- [ ] Add Pinia store integration option
- [ ] Implement Vue DevTools integration
- [ ] Add unit tests with Vitest

# DFDVisualizer Component

## Overview

The `DFDVisualizer` component provides interactive visualization of Data Flow Diagrams (DFDs) using Mermaid.js. It supports multi-level views (service/component/code), risk-based coloring, trust boundary visualization, and export capabilities.

## Features

✅ **Interactive Mermaid Rendering** - Real-time diagram generation from DFD data
✅ **Click Interactions** - Click nodes to view details (threat count, compliance status)
✅ **Zoom Controls** - Zoom in/out/reset with buttons and keyboard shortcuts
✅ **Export Options** - Export to SVG or PNG formats
✅ **Multi-Level Views** - Toggle between service, component, and code level abstractions
✅ **Risk Coloring** - Color nodes by risk level (critical=red, high=orange, etc.)
✅ **Trust Boundaries** - Highlight trust boundaries as subgraphs
✅ **Responsive Design** - Adapts to container size with mobile support
✅ **Dark/Light Mode** - Theme support with automatic styling
✅ **Accessibility** - ARIA labels, keyboard navigation, screen reader support
✅ **Error Handling** - Loading states, error boundaries, empty states

## Usage

```tsx
import { DFDVisualizer } from './components/DFDVisualizer';
import { useAnalysis } from './hooks/useAnalysis';

function ArchitectView() {
  const { currentDfd, selectedDfdLevel, setSelectedDfdLevel } = useAnalysis();
  
  return (
    <DFDVisualizer
      dfd={currentDfd}
      level={selectedDfdLevel}
      onLevelChange={setSelectedDfdLevel}
      onNodeClick={(nodeId) => {
        console.log('Node clicked:', nodeId);
        // Show node details
      }}
      selectedNode="node-id-123"
      theme="light"
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `dfd` | `DFD \| null` | Yes | - | DFD data with nodes, edges, and trust boundaries |
| `onNodeClick` | `(nodeId: string) => void` | No | - | Callback when a node is clicked |
| `selectedNode` | `string` | No | - | ID of currently selected node (highlighted) |
| `level` | `'service' \| 'component' \| 'code'` | No | `'service'` | Current DFD abstraction level |
| `onLevelChange` | `(level: ...) => void` | No | - | Callback when level is changed |
| `theme` | `'light' \| 'dark'` | No | `'light'` | Color theme for diagram |

## Node Types

The component renders different shapes based on node type:

- **EXTERNAL_ENTITY** → Rectangle with double border `[[ ]]`
- **PROCESS** → Standard rectangle `[ ]`
- **DATA_STORE** → Cylinder shape `[( )]`
- **DATA_FLOW** → Arrow shape `>[ ]`

## Risk Coloring

Nodes are automatically colored based on their `metadata.risk_level`:

- 🔴 **CRITICAL** - Red (#fa5252) - Critical security issues
- 🟠 **HIGH** - Orange (#fd7e14) - High priority threats
- 🟡 **MEDIUM** - Yellow (#fab005) - Medium risk
- 🟢 **LOW** - Green (#51cf66) - Low severity
- ⚪ **INFO** - Light green (#94d82d) - Informational

## Controls

### Zoom Controls
- **Zoom In** - Click button or press `+` key
- **Zoom Out** - Click button or press `-` key
- **Reset Zoom** - Click button or press `0` key
- **Range**: 50% - 300%

### Display Options
- **Color by Risk** - Toggle risk-based node coloring
- **Show Trust Boundaries** - Toggle trust boundary subgraphs

### Export Options
- **Export SVG** - Download diagram as vector SVG
- **Export PNG** - Download diagram as raster PNG (with background)

### Level Selector
- **Service Level** - High-level service architecture
- **Component Level** - Component-level interactions
- **Code Level** - Code-level data flows

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` or `=` | Zoom in |
| `-` or `_` | Zoom out |
| `0` | Reset zoom |
| `Tab` | Navigate between controls |
| `Enter` | Activate focused control |

## Accessibility

- **ARIA Labels** - All interactive elements have descriptive labels
- **Keyboard Navigation** - Full keyboard support for all features
- **Screen Reader** - Diagram described as "Data flow diagram showing N nodes and M connections"
- **Focus Indicators** - Visible focus states for all controls
- **High Contrast Mode** - Increased stroke widths in high contrast
- **Reduced Motion** - Respects `prefers-reduced-motion` settings

## Styling

The component uses CSS modules with Mantine theme tokens:

```css
/* Responsive to container */
.diagram {
  width: 100%;
  height: 100%;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  /* Automatic adjustments */
}

/* Mobile responsive */
@media (max-width: 768px) {
  /* Stacked toolbar */
}
```

## Custom Hook: `useMermaidRender`

Lower-level hook for custom implementations:

```tsx
import { useMermaidRender } from './components/DFDVisualizer';

const {
  containerRef,
  svgRef,
  isLoading,
  error,
  renderDiagram,
  exportSvg,
  exportPng,
} = useMermaidRender({
  dfd,
  selectedNode,
  colorByRisk: true,
  showTrustBoundaries: true,
  theme: 'light',
});
```

## Error Handling

### Empty State
Shows when `dfd` is `null`:
- Icon + message: "No DFD data available"
- Guidance: "Upload Terraform configuration to generate diagrams"

### Error State
Shows when Mermaid rendering fails:
- Alert with error message
- Automatically logged to console

### Loading State
Shows during initial render:
- Centered spinner
- Text: "Rendering diagram..."
- Overlay prevents interaction

## Testing

Run tests with:

```bash
npm test DFDVisualizer
```

Test coverage includes:
- Empty state rendering
- Diagram rendering with nodes/edges
- Level change handling
- Zoom controls (in/out/reset/limits)
- Node click handling
- Keyboard navigation
- Export functionality
- ARIA labels and accessibility
- Theme switching
- Selected node highlighting

## Performance Considerations

- **Memoization** - Callbacks are memoized with `useCallback`
- **Lazy Rendering** - Diagrams only render when data changes
- **Export Optimization** - PNG export uses canvas for efficiency
- **Large Diagrams** - Tested with 100+ nodes and edges
- **Zoom Performance** - CSS transforms for smooth zooming

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Dependencies

- `mermaid` - Diagram rendering
- `@mantine/core` - UI components
- `@mantine/notifications` - Toast notifications
- `@tabler/icons-react` - Icons

## Examples

### Basic Usage

```tsx
<DFDVisualizer dfd={myDfd} />
```

### With All Features

```tsx
<DFDVisualizer
  dfd={dfd}
  level="component"
  onLevelChange={(level) => console.log('Level:', level)}
  onNodeClick={(id) => showNodeDetails(id)}
  selectedNode={activeNodeId}
  theme={colorScheme}
/>
```

### Read-Only Mode

```tsx
<DFDVisualizer
  dfd={dfd}
  // No callbacks = read-only
/>
```

## Troubleshooting

### Diagram Not Rendering
- Check `dfd` has valid nodes and edges
- Ensure Mermaid is installed: `npm install mermaid`
- Check browser console for Mermaid errors

### Click Not Working
- Ensure `onNodeClick` prop is provided
- Check node IDs don't contain special characters
- Verify SVG rendered correctly (inspect element)

### Export Failing
- SVG export: Check browser supports `XMLSerializer`
- PNG export: Check browser supports Canvas API
- Try exporting after diagram fully loads

## Future Enhancements

- [ ] Pan/drag support for large diagrams
- [ ] Mini-map for navigation
- [ ] Node clustering for very large diagrams
- [ ] Animation for data flows
- [ ] Custom node styling via props
- [ ] Layout algorithm selection (TB, LR, RL, BT)
- [ ] Diff view for comparing DFDs
- [ ] Collaborative editing features

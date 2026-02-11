# ThreatMatrix Component

## Overview

The `ThreatMatrix` component provides a risk matrix visualization with likelihood (Y-axis) vs. impact (X-axis). Threats are displayed as bubbles where size represents threat count and color represents severity.

## Features

✅ **5x5 Risk Matrix** - Likelihood vs Impact grid
✅ **Interactive Bubbles** - Click to view threat details
✅ **Color-Coded** - Severity-based coloring (Critical=red, High=orange, etc.)
✅ **Size-Coded** - Bubble size based on threat count
✅ **Filtering** - By severity, cloud provider, compliance framework, category
✅ **Statistics** - Total threats, critical count, high count, etc.
✅ **Export** - CSV and PNG (coming soon) export
✅ **Responsive** - Desktop, tablet, and mobile layouts
✅ **Accessible** - ARIA labels, keyboard navigation
✅ **Legend** - Color and size explanations

## Usage

```tsx
import { ThreatMatrix } from './components/ThreatMatrix';
import { useThreatModel } from './hooks/useThreatModel';

function BusinessView() {
  const { threats } = useThreatModel();
  
  return (
    <ThreatMatrix
      threats={threats}
      onThreatClick={(threats) => {
        console.log('Cell clicked with threats:', threats);
        // Show threat details drawer or modal
      }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `threats` | `MatchedThreat[]` | Yes | Array of matched threats to visualize |
| `onThreatClick` | `(threats: MatchedThreat[]) => void` | No | Callback when a cell is clicked with its threats |

## Matrix Structure

### Axes
- **Y-Axis (Likelihood)**: VERY_HIGH, HIGH, MEDIUM, LOW, VERY_LOW
- **X-Axis (Impact/Severity)**: CRITICAL, HIGH, MEDIUM, LOW, INFO

### Cell Colors
Cells are colored based on the combination of likelihood and impact:
- **Red shades**: High likelihood + Critical/High impact
- **Orange shades**: Medium likelihood + High impact
- **Yellow shades**: Medium likelihood + Medium impact
- **Green shades**: Low likelihood + any impact

### Bubble Sizing
- **Minimum**: 20px for cells with 1 threat
- **Maximum**: 60px for cells with maximum threat count
- **Dynamic**: Scales linearly between min and max

## Features Detail

### Statistics

Displayed at the top of the matrix:
- **Total Threats**: Count of all threats
- **Critical**: Count of CRITICAL severity threats
- **High**: Count of HIGH severity threats
- **Medium**: Count of MEDIUM severity threats
- **Low**: Count of LOW severity threats

### Filtering

Four filter types available:

1. **Severity Filter**
   - Multi-select dropdown
   - Options: Critical, High, Medium, Low, Info
   - Filters threats by severity level

2. **Cloud Provider Filter**
   - Multi-select dropdown
   - Dynamically populated from threats
   - Common values: AWS, GCP, Azure

3. **Compliance Framework Filter**
   - Multi-select dropdown
   - Only shows threats mapped to selected frameworks
   - Examples: DORA, BAFIN, NIST-800-53, PCI-DSS

4. **Category Filter**
   - Multi-select dropdown
   - Filters by threat category
   - Examples: Data Exposure, Access Control, Data Protection

**Clear All**: Button to reset all filters at once

### Interactions

#### Cell Click
- Click any cell with threats to view details
- Opens modal with list of threats in that cell
- Each threat shows:
  - Name and description
  - Severity badge
  - Category
  - Affected resource

#### Cell Hover
- Tooltip shows:
  - Threat count
  - Likelihood level
  - Impact level
- Cell scales up slightly (1.05x)
- Bubble scales up (1.1x)

#### Keyboard Navigation
- `Tab`: Navigate between cells
- `Enter` or `Space`: Activate focused cell
- Full keyboard support for filters

### Export

**CSV Export**:
- Downloads `threat-matrix-[timestamp].csv`
- Contains: Likelihood, Impact, Count, Threat IDs
- Compatible with Excel, Google Sheets

**PNG Export** (Coming Soon):
- Will export visual representation of matrix
- Useful for presentations and reports

## Styling

### Color Palette

#### Severity Colors
```css
CRITICAL: #fa5252 (Red)
HIGH:     #fd7e14 (Orange)
MEDIUM:   #fab005 (Yellow)
LOW:      #51cf66 (Green)
INFO:     #94d82d (Light Green)
```

#### Cell Background Colors
Gradient based on risk level:
- High risk: Dark red (#c92a2a)
- Medium risk: Orange/Yellow (#f59f00)
- Low risk: Light green (#82c91e)

### Responsive Breakpoints

```css
Desktop (>1024px): Full layout, 80px cells
Tablet (768-1024px): Compact layout, 60px cells
Mobile (480-768px): Condensed layout, 50px cells
Small Mobile (<480px): Minimal layout, 40px cells
```

### Dark Mode
- Automatic theme switching
- Adjusted colors for better contrast
- Border colors adapt to theme

## Accessibility

### ARIA Labels
- Each cell: `"[Likelihood] likelihood, [Impact] impact: [N] threats"`
- Matrix container: `role="grid"`
- Cells: `role="button"`, `tabindex="0"`

### Keyboard Support
- Full keyboard navigation
- Focus indicators visible
- Enter/Space activate cells

### Screen Readers
- Descriptive labels for all interactive elements
- Statistics announced clearly
- Filter states announced

### High Contrast Mode
- Increased border widths
- Enhanced bubble borders
- Better color differentiation

### Reduced Motion
- No animations for users with motion sensitivity
- Transitions disabled
- Transforms removed

## Data Requirements

### Threat Structure

Each threat must include:
```typescript
{
  resource: {
    id: string;
    type: string;
    name: string;
    cloud_provider?: 'AWS' | 'GCP' | 'Azure';
    properties: Record<string, any>;
  },
  matched_threat: {
    id: string;
    name: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    likelihood: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
    category?: string;
    stride: string[];
    references: string[];
  },
  compliance_mappings?: {
    [framework: string]: ComplianceMapping[];
  },
  // ... other fields
}
```

### Minimum Data
- At least `resource.type`, `resource.name`
- At least `matched_threat.severity`, `matched_threat.likelihood`

## Examples

### Basic Usage

```tsx
<ThreatMatrix threats={allThreats} />
```

### With Click Handler

```tsx
<ThreatMatrix
  threats={allThreats}
  onThreatClick={(threats) => {
    setSelectedThreats(threats);
    setDrawerOpen(true);
  }}
/>
```

### In Dashboard

```tsx
function DashboardView() {
  const { threats } = useThreatModel();
  
  return (
    <Stack>
      <Title>Risk Overview</Title>
      <ThreatMatrix threats={threats} />
    </Stack>
  );
}
```

## Testing

Run tests:
```bash
npm test ThreatMatrix
```

Test coverage (15 tests):
- Statistics rendering
- 5x5 grid structure
- Bubble display
- Cell clicks
- Filtering (severity, cloud, compliance, category)
- Clear filters
- CSV export
- Modal display
- Keyboard navigation
- ARIA labels
- Legend display
- Empty state

## Performance

### Optimization
- `useMemo` for filtered threats
- `useMemo` for matrix cells
- `useMemo` for statistics
- `useCallback` for event handlers

### Scalability
- Tested with 100+ threats
- Efficient filtering algorithms
- No re-renders on unrelated state changes

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Dependencies

- `@mantine/core` - UI components
- `@mantine/notifications` - Toast notifications
- `@tabler/icons-react` - Icons
- `react` - React framework

## Future Enhancements

- [ ] PNG export implementation
- [ ] Drill-down to individual threats
- [ ] Historical trend view
- [ ] Risk score calculations
- [ ] Heat map color gradients
- [ ] Animation on data changes
- [ ] Custom color schemes
- [ ] Tooltips with more details
- [ ] Comparison mode (before/after)
- [ ] Integration with reports

## Troubleshooting

### No bubbles showing
- Check threats have valid likelihood and severity
- Verify threats array is not empty
- Check filters are not excluding all threats

### Filters not working
- Ensure threat data includes relevant fields
- Check compliance_mappings structure
- Verify cloud_provider is set

### Export not working
- CSV: Check browser allows downloads
- PNG: Feature coming soon

### Modal not opening
- Verify cell has threats (count > 0)
- Check onThreatClick callback
- Look for JavaScript errors in console

## License

MIT
